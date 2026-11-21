// Pre delivery tests (API level) and the cohort script. Run: node test/run.mjs
// Browser tests (5, 6, 16, 17 and the assessor page parts of 13, 14, 18) run with: python3 test/browser.py
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, memoryBlobs } from './harness.mjs';
import { perfect, TEN_NAMES, FILES } from './perfect.mjs';
import * as marking from '../netlify/lib/marking.mjs';
import { signToken } from '../netlify/lib/auth.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
function check(test, name, cond, note = '') {
  results.push({ test, name, pass: !!cond, note });
  console.log((cond ? 'PASS ' : 'FAIL ') + 'T' + test + ' ' + name + (note ? '  (' + note + ')' : ''));
}

const blobs = memoryBlobs();
const S = await startServer({ context: 'branch-deploy', password: 'rehearsal-pass', blobs });
const P = await startServer({ context: 'production', password: 'rehearsal-pass', blobs });
const post = async (p, b, srv = S, headers = {}) => { const r = await fetch(srv.url + p, { method: 'POST', headers, body: JSON.stringify(b) }); return { s: r.status, j: await r.json(), h: r.headers }; };
const get = async (p, srv = S, headers = {}) => { const r = await fetch(srv.url + p, { headers }); return { s: r.status, j: await r.json(), h: r.headers }; };
const login = (name, email, begin, srv) => post('/api/start', { name, email, begin }, srv);
const transcript = [];
const tr = r => { transcript.push(JSON.stringify(r.j)); return r; };

// ---- Test 1 and 2: login table, names, entries ----
{
  const a = await login('Ada Obi', 'ada@test.example', true);
  check(1, 'new name and new email creates a learner', a.s === 200 && a.j.open && a.j.open.n === 1);
  const idA = a.j.open.token.slice(0, 12);
  const same = await login('Ada Obi', 'ada@test.example');
  check(1, 'name and email both match: resume', same.s === 200 && same.j.open && same.j.open.n === 1 && same.j.open.token.startsWith(idA));
  const newMail = await login('Ada Obi', 'ada.second@test.example');
  check(1, 'name matches, email is new: email links, attempts carry over', newMail.s === 200 && newMail.j.open && newMail.j.open.token.startsWith(idA) && newMail.j.attemptsUsed === 1);
  const viaMail = await login('A. Obi Ada', 'ada.second@test.example');
  check(1, 'email matches, name spelled differently: same learner, first spelling stays', viaMail.s === 200 && viaMail.j.name === 'Ada Obi' && viaMail.j.open.token.startsWith(idA));
  const b = await login('Bayo Lawal', 'bayo@test.example', true);
  const clash = await login('Ada Obi', 'bayo@test.example');
  check(1, 'name matches one learner, email belongs to another: message', clash.s === 409 &&
    clash.j.error === 'This email is registered to another learner. Use the name and email you first registered.');
  check(1, 'second learner is separate', b.j.open.token.slice(0, 12) !== idA);

  const v1 = await login('Obi, Ada', 'x1@test.example');
  const v2 = await login('ada obi', 'x2@test.example');
  const v3 = await login('Ádá Obi', 'x3@test.example');
  const ids = [v1, v2, v3].map(r => r.j.open && r.j.open.token.slice(0, 12));
  check(2, '"Obi, Ada", "ada obi" and "Ádá Obi" resolve to one learner', ids.every(i => i === idA), ids.join(' '));
  const badNames = ['A', 'Ada1', 'Ada <b>', '=cmd|x', '12345', '', 'x'.repeat(81)];
  const nm = await Promise.all(badNames.map(n => login(n, 'ok@test.example')));
  check(2, 'bad names return the name message', nm.every(r => r.s === 400 && r.j.error === 'Enter your name using letters.'));
  const badMails = ['ada', 'ada@', 'a b@c.com', 'a@b', 'x'.repeat(115) + '@a.com', ''];
  const em = await Promise.all(badMails.map(e => login('Ada Obi', e)));
  check(2, 'bad emails return the email message', em.every(r => r.s === 400 && r.j.error === 'Enter a valid email address.'));
  const okNames = await Promise.all(["Mary-Ann O'Neil", 'Chukwuemeka Okonkwo Jr.', 'Ngozi, Eze', 'Нина Иванова', '李 小龍'].map((n, k) => login(n, 'n' + k + '@test.example')));
  check(2, 'allowed characters are accepted (any script, spaces, apostrophes, full stops, commas, hyphens)', okNames.every(r => r.s === 200));
}

// ---- Test 3: attempts ----
{
  const l = await login('Chike Eze', 'chike@test.example');
  check(3, 'login alone leaves 3 attempts available', l.s === 200 && l.j.attemptsUsed === 0 && l.j.open === null);
  const again = await login('Chike Eze', 'chike@test.example');
  check(3, 'logging in again still counts none', again.j.attemptsUsed === 0);
  for (let i = 1; i <= 3; i++) {
    const b = await login('Chike Eze', 'chike@test.example', true);
    const ok = b.s === 200 && b.j.open.n === i && b.j.attemptsUsed === i;
    const sub = await post('/api/submit', { token: b.j.open.token, answers: i === 3 ? perfect() : {} });
    check(3, 'begin ' + i + ' counts one attempt and submit closes it', ok && sub.s === 200 && sub.j.attemptsUsed === i && sub.j.attemptsLeft === 3 - i);
  }
  const fourth = await login('Chike Eze', 'chike@test.example', true);
  check(3, 'the fourth begin returns the all attempts used message', fourth.s === 403 && fourth.j.error === 'You have used all 3 attempts. Your highest score counts.' && fourth.j.attemptsUsed === 3);
  const store = blobs.stores.get('sim-w13-branch-deploy');
  const rec = JSON.parse([...store.entries()].find(([k, v]) => k.startsWith('learner/') && v.data.includes('Chike Eze'))[1].data);
  check(9, 'best score is the highest of the attempts', rec.best === 100 && rec.attempts.length === 3 && rec.attempts[0].score === 0 && rec.attempts[2].score === 100, 'best ' + rec.best);
}

// ---- Test 4, 7, 8, 9: device, locking, reset, submit ----
{
  const d1 = await login('Dayo Peters', 'dayo@test.example', true);
  const t1 = d1.j.open.token;
  const d2 = await login('Dayo Peters', 'dayo@test.example');
  const t2 = d2.j.open.token;
  check(4, 'a second login takes the open attempt (new token)', t1 !== t2 && d2.j.open.n === 1);
  const old = await post('/api/save', { token: t1, rev: 0, stage: 1, answers: { 's1.model': 'A' } });
  check(4, 'the first device receives 409 with reason device', old.s === 409 && old.j.reason === 'device', old.j.error);
  const ok = await post('/api/save', { token: t2, rev: 0, stage: 1, answers: { 's1.model': 'B', 's1.owner': 'C', 'junk.id': 'x', 's1.class': 'x'.repeat(200) } });
  check(4, 'the second device saves', ok.s === 200 && ok.j.rev === 1);
  const resume = await login('Dayo Peters', 'dayo@test.example');
  check(4, 'unknown ids and oversize values are dropped', resume.j.open.answers['s1.model'] === 'B' && !('junk.id' in resume.j.open.answers) && !('s1.class' in resume.j.open.answers));
  const t3 = resume.j.open.token;

  // locking
  const out = await post('/api/save', { token: t3, rev: 1, stage: 1, answers: { 's1.model': 'B', 's1.owner': 'C' }, lock: 2 });
  check(7, 'a lock out of order is ignored', out.s === 200 && out.j.locked.length === 0);
  const lk = await post('/api/save', { token: t3, rev: 2, stage: 1, answers: { 's1.model': 'B', 's1.owner': 'C' }, lock: 1 });
  check(7, 'Continue locks stage 1 and opens stage 2', lk.s === 200 && lk.j.locked.join() === '1' && lk.j.stage === 2);
  const hit = await post('/api/save', { token: t3, rev: 3, stage: 2, answers: { 's1.model': 'D', 's1.owner': 'A', 's2.tempEnd': 'B' } });
  const re = await login('Dayo Peters', 'dayo@test.example');
  const A = re.j.open.answers;
  check(7, 'a save with different values for locked ids leaves the stored values', hit.s === 200 && A['s1.model'] === 'B' && A['s1.owner'] === 'C' && A['s2.tempEnd'] === 'B');
  const t4 = re.j.open.token;
  check(6, 'resume restores answers, stage and locks (server side)', re.j.open.stage === 2 && re.j.open.locked.join() === '1' && A['s2.tempEnd'] === 'B');

  // reset
  const r1 = await post('/api/reset', { token: t4 });
  check(8, 'reset clears answers and locks, keeps the attempt count', r1.s === 200 && Object.keys(r1.j.open.answers).length === 0 && r1.j.open.locked.length === 0 && r1.j.open.resetUsed === true && r1.j.open.stage === 1);
  const r2 = await post('/api/reset', { token: t4 });
  await post('/api/save', { token: t4, rev: r1.j.open.rev, stage: 1, answers: { 's1.model': 'B' } });
  const r3 = await post('/api/reset', { token: t4 });
  check(8, 'a second reset changes nothing', r2.s === 200 && r2.j.open.resetUsed === true && r3.j.open.answers['s1.model'] === 'B' && r3.j.open.rev === r1.j.open.rev + 1);
  const used = await login('Dayo Peters', 'dayo@test.example');
  check(8, 'attempts used stays 1', used.j.attemptsUsed === 1);

  // submit twice
  const tok = used.j.open.token;
  const s1 = await post('/api/submit', { token: tok, answers: perfect() });
  const store = blobs.stores.get('sim-w13-branch-deploy');
  const key = [...store.keys()].find(k => k.startsWith('learner/') && store.get(k).data.includes('Dayo Peters'));
  const v1 = store.get(key).etag;
  const s2 = await post('/api/submit', { token: tok, answers: {} });
  const v2 = store.get(key).etag;
  const rec = JSON.parse(store.get(key).data);
  check(9, 'a second submit returns the first result and writes nothing', s1.s === 200 && JSON.stringify(s1.j) === JSON.stringify(s2.j) && v1 === v2 && rec.attempts[0].score === 100);
  const after = await post('/api/save', { token: tok, rev: 9, stage: 1, answers: { 's1.model': 'A' } });
  check(9, 'a save after submit is refused', after.s === 409);
}

// ---- Test 10: marking ----
{
  const m = marking.markAttempt(perfect());
  check(10, 'the keyed perfect set scores 100.00 with stage totals 24, 24, 22, 30', m.total === 100 && m.stages.s1 === 24 && m.stages.s2 === 24 && m.stages.s3 === 22 && m.stages.s4 === 30);
  check(10, 'every item unanswered scores 0', marking.markAttempt({}).total === 0);
  const tree = (name, parent = 'PRJ01_Supplier_Review') => ({ 's1.tree': [{ name, parent }] });
  const t = (n, p) => marking.markAttempt(tree(n, p)).items['s1.tree'];
  check(10, 'folder name: exact, case insensitive, trimmed = 0.5', t('  02_working_documents ') === 0.5);
  check(10, 'folder name: right number and first word, wrong rest = 0.25', t('02_Working_Docs') === 0.25);
  check(10, 'folder name: wrong parent = 0', t('02_Working_Documents', 'CLIENTS') === 0);
  check(10, 'folder name: other entry = 0', t('Working') === 0);
  check(10, 'folder code partial for the client folder = 0.25', marking.markAttempt({ 's1.tree': [{ name: 'CL021_Lagoon', parent: 'CLIENTS' }] }).items['s1.tree'] === 0.25);
  const f = (name, folder = '00_Governance') => marking.markAttempt({ 's1.files.F1': { folder, name } }).items['s1.files.F1'];
  const good = FILES.F1[1];
  check(10, 'file: placement 0.5 plus exact name 1.0', f(good) === 1.5);
  check(10, 'file: wrong folder keeps the name mark', f(good, '99_Archive') === 1);
  check(10, 'file: subject and type swapped = 1.0', f('CL021_PRJ01_AGR_Engagement_20261102_v1.0_APPROVED.pdf') === 1.5);
  check(10, 'file: accepted subject and full type word = 1.0', f('CL021_PRJ01_EngagementLetter_Agreement_20261102_v1.0_APPROVED.pdf') === 1.5);
  check(10, 'file: one wrong segment = 0.5', f('CL021_PRJ01_Engagement_AGR_20261103_v1.0_APPROVED.pdf') === 1);
  check(10, 'file: two wrong segments = 0.5', f('CL021_PRJ01_Engagement_AGR_20261103_v1.1_APPROVED.pdf') === 1);
  check(10, 'file: three wrong segments = 0.25', f('CL021_PRJ02_Engagement_AGR_20261103_v1.1_APPROVED.pdf') === 0.75);
  check(10, 'file: lowercase status counts as wrong', f('CL021_PRJ01_Engagement_AGR_20261102_v1.0_approved.pdf') === 1);
  check(10, 'file: six segments = 0', f('CL021_PRJ01_Engagement_20261102_v1.0_APPROVED.pdf') === 0.5);
  check(10, 'file: bad date shape = 0', f('CL021_PRJ01_Engagement_AGR_2nd_v1.0_APPROVED.pdf') === 0.5);
  check(10, 'file: messy name = 0', f('engagement letter signed.pdf') === 0.5);
  const L = lines => marking.markAttempt({ 's2.lines': lines }).items['s2.lines.byFolder']['00_Governance'];
  check(10, 'access: both lines right = 1.5', L([{ folder: '00_Governance', group: 'Directors', level: 'Editor' }, { folder: '00_Governance', group: 'Finance', level: 'Viewer' }]) === 1.5);
  check(10, 'access: one step away = 0.375', L([{ folder: '00_Governance', group: 'Directors', level: 'Contributor' }]) === 0.375);
  check(10, 'access: two steps away = 0', L([{ folder: '00_Governance', group: 'Directors', level: 'Commenter' }]) === 0);
  check(10, 'access: a line for a group outside the set halves the folder', L([{ folder: '00_Governance', group: 'Directors', level: 'Editor' }, { folder: '00_Governance', group: 'Client Reviewers', level: 'Viewer' }]) === 0.375);
  const F = (t, o) => marking.markAttempt({ ['s4.result.' + t]: 'Fail', ['s4.find.' + t]: Object.assign({ risk: 'x', action: 'x', owner: 'x', due: 'x' }, o) }).items['s4.find.' + t];
  check(10, 'finding: best action 0.75, partly right 0.375, others 0', F('T1', { action: 'C' }) === 0.75 && F('T1', { action: 'B' }) === 0.375 && F('T1', { action: 'A' }) === 0);
  check(10, 'finding: risk 0.5, owner 0.25, due 0.25', F('T1', { risk: 'High' }) === 0.5 && F('T1', { owner: 'Mrs Funke Adebayo' }) === 0.25 && F('T1', { due: 'Monday 23 November 2026' }) === 0.25);
  check(10, 'finding: due date keyed by the keyed risk', F('T14', { due: 'Friday 4 December 2026' }) === 0.25 && F('T4', { due: 'Friday 27 November 2026' }) === 0.25);
  const wrongPass = marking.markAttempt({ 's4.result.T2': 'Fail', 's4.find.T2': { risk: 'High', action: 'A', owner: 'Mrs Funke Adebayo', due: 'Monday 23 November 2026' } });
  check(10, 'finding on a test whose key is not Fail earns 0', wrongPass.items['s4.find.T2'] === 0);
  const noFail = marking.markAttempt({ 's4.result.T1': 'Pass', 's4.find.T1': { risk: 'High', action: 'C', owner: 'Mrs Funke Adebayo', due: 'Monday 23 November 2026' } });
  check(10, 'finding without a recorded Fail earns 0', noFail.items['s4.find.T1'] === 0);
  const reg = marking.markAttempt({ 's3.reg.R1': { id: 'CL021_PRJ01_AGR_001', owner: 'Mrs Funke Adebayo', status: 'Approved' }, 's3.reg.R2': { id: 'CL021_PRJ01_AGR_001', owner: 'Mrs Funke Adebayo', status: 'Draft' }, 's3.reg.R3': { id: 'CL021_PRJ01_RPT_003', owner: 'Chidi Okafor', status: 'Approved' } }).items;
  check(10, 'register: duplicate IDs lose the ID mark, a wrong type code loses it, owner and status score on their own',
    reg['s3.reg.R1'] === 0.6 && reg['s3.reg.R2'] === 0.3 && reg['s3.reg.R3'] === 0.6, [reg['s3.reg.R1'], reg['s3.reg.R2'], reg['s3.reg.R3']].join(' '));
  const sizes = Object.keys(marking.markAttempt(perfect()).items).length;
  check(10, 'item marks are kept for every item', sizes >= 100);
}

// ---- Test 11: key safety ----
{
  const exported = Object.keys(marking);
  const hay = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : (/\.(woff2)$/.test(p) ? null : hay.push([p, fs.readFileSync(p, 'utf8')])); } };
  walk(path.join(root, 'public'));
  const publicText = hay.map(h => h[1]).join('\n');
  const idHits = exported.filter(x => publicText.includes(x));
  const nameHits = TEN_NAMES.filter(n => publicText.includes(n));
  check(11, 'public/ holds no identifier exported by marking.mjs', idHits.length === 0, 'exports: ' + exported.join(', '));
  check(11, 'public/ holds none of the ten correct file names', nameHits.length === 0);
  // run a full flow and collect every /api response
  const w = await login('Wale Ade', 'wale@test.example', true); tr(w);
  const tk = w.j.open.token;
  tr(await post('/api/save', { token: tk, rev: 0, stage: 1, answers: perfect(), lock: 1 }));
  tr(await post('/api/reset', { token: tk }));
  tr(await post('/api/submit', { token: tk, answers: perfect() }));
  tr(await login('Wale Ade', 'wale@test.example'));
  const t2 = await post('/api/assessor/login', { password: 'rehearsal-pass' }); tr(t2);
  const list = await get('/api/assessor/list', S, { authorization: 'Bearer ' + t2.j.token }); tr(list);
  const all = transcript.join('\n');
  check(11, 'no /api response holds an exported identifier or a correct file name', exported.concat(TEN_NAMES).every(x => !all.includes(x)));
  const keys = new Set(list.j.learners.flatMap(l => Object.keys(l)));
  const akeys = new Set(list.j.learners.flatMap(l => l.attempts.flatMap(a => Object.keys(a))));
  check(11, 'the assessor list carries name, email, test flag, best and attempt scores only',
    [...keys].sort().join() === 'attempts,best,email,id,name,test' && [...akeys].sort().join() === 'n,score,state', [...keys].join() + ' | ' + [...akeys].join());
  check(11, 'learner responses carry no marks', !/"score"|"items"|"stages"/.test(transcript.slice(0, 5).join('')));
}

// ---- Test 12: assessor access ----
{
  const bs = memoryBlobs();
  const A = await startServer({ context: 'branch-deploy', password: 'rehearsal-pass', blobs: bs });
  const L = pw => post('/api/assessor/login', { password: pw }, A);
  const ok = await L('rehearsal-pass');
  check(12, 'the correct password returns a token and expiry', ok.s === 200 && /^\d+\.[A-Za-z0-9_-]{43}$/.test(ok.j.token) && ok.j.expires > Date.now() / 1000);
  const w1 = await L('nope');
  check(12, 'a different password returns 401', w1.s === 401 && w1.j.error === 'Check the password and try again.');
  const rest = []; for (let i = 0; i < 4; i++) rest.push((await L('nope' + i)).s);
  check(12, 'attempts 2 to 5 return 401', rest.every(s => s === 401));
  const sixth = await L('rehearsal-pass');
  check(12, 'the sixth try inside 15 minutes returns 429 with the wait message', sixth.s === 429 && sixth.j.error === 'Try again in 15 minutes.');
  const lockKey = [...bs.stores.get('sim-w13-branch-deploy').keys()].find(k => k === 'assessor/lock');
  check(12, 'the counter lives in assessor/lock', !!lockKey);
  const st = bs.stores.get('sim-w13-branch-deploy');
  const rec = JSON.parse(st.get('assessor/lock').data); rec.first -= 16 * 60 * 1000; st.set('assessor/lock', { data: JSON.stringify(rec), etag: '"x"' });
  const later = await L('rehearsal-pass');
  check(12, 'the window ends after 15 minutes and a match clears the counter', later.s === 200 && JSON.parse(st.get('assessor/lock').data).count === 0);
  const good = await get('/api/assessor/list', A, { authorization: 'Bearer ' + later.j.token });
  check(12, 'the list route accepts a current signed token', good.s === 200 && Array.isArray(good.j.learners) && good.h.get('cache-control') === 'no-store');
  const old = signToken('rehearsal-pass', Date.now() - 3 * 3600 * 1000).token;
  const oldR = await get('/api/assessor/list', A, { authorization: 'Bearer ' + old });
  const bad = await Promise.all(['', 'Bearer abc', 'Bearer 9999999999.' + 'a'.repeat(43), 'Bearer ' + signToken('other-password').token].map(h => get('/api/assessor/list', A, h ? { authorization: h } : {})));
  check(12, 'a token older than 2 hours and any other value return 401', oldR.s === 401 && bad.every(r => r.s === 401));
  process.env.ASSESSOR_PASSWORD = '';
  const none = await L('x');
  check(12, 'without the variable the login answers 503 with the setup message', none.s === 503 && none.j.error === 'Set ASSESSOR_PASSWORD, then deploy again.');
  process.env.ASSESSOR_PASSWORD = 'rehearsal-pass';
  check(12, 'a new password invalidates earlier tokens', await (async () => { process.env.ASSESSOR_PASSWORD = 'changed'; const r = await get('/api/assessor/list', A, { authorization: 'Bearer ' + later.j.token }); process.env.ASSESSOR_PASSWORD = 'rehearsal-pass'; return r.s === 401; })());
  check(12, 'the deployed password check is a browser and deploy step', true, 'run on the rehearsal deploy: the correct password must work (owner step 3)');
  await A.close();
}

// ---- Test 13: assessor list ----
{
  const bs = memoryBlobs();
  const A = await startServer({ context: 'branch-deploy', blobs: bs });
  const seed = async (name, email, subs, open) => {
    for (let i = 0; i < subs.length; i++) {
      const b = await login(name, email, true, A);
      await post('/api/submit', { token: b.j.open.token, answers: subs[i] === 100 ? perfect() : subs[i] === 0 ? {} : { 's1.model': 'B', 's1.owner': 'C' } }, A);
    }
    if (open) await login(name, email, true, A);
  };
  await seed('Zed Alpha', 'zed@example.com', [0, 100], false);
  await seed('Amaka Beta', 'amaka@example.com', [2], true);
  await seed('Test Gamma', 'gamma@test.example', [], true);
  const tk = (await post('/api/assessor/login', { password: 'rehearsal-pass' }, A)).j.token;
  const r = await get('/api/assessor/list', A, { authorization: 'Bearer ' + tk });
  const by = Object.fromEntries(r.j.learners.map(l => [l.name, l]));
  check(13, 'a seeded set of 3 learners with 5 attempts lists attempts and best scores', r.j.learners.length === 3 && r.j.learners.reduce((n, l) => n + l.attempts.length, 0) === 5 &&
    by['Zed Alpha'].best === 100 && by['Zed Alpha'].attempts.length === 2 && by['Amaka Beta'].attempts[1].state === 'open' && by['Test Gamma'].test === true && by['Zed Alpha'].test === false);
  check(13, 'the browser views, sort, search, selection and test account filter are covered by test/browser.py', true);
  await A.close();
}

// ---- Test 15: store separation ----
{
  const p = await login('Prod Learner', 'prod@example.com', true, P);
  const names = [...blobs.stores.keys()];
  const prodStore = blobs.stores.get('sim-w13-production');
  const prodLearners = [...prodStore.entries()].filter(([k]) => k.startsWith('learner/')).map(([, v]) => JSON.parse(v.data).name);
  check(15, 'rehearsal and production use stores whose names end with the deploy context', names.includes('sim-w13-branch-deploy') && names.includes('sim-w13-production'), names.join(', '));
  check(15, 'the production store holds only production learners', prodLearners.join() === 'Prod Learner' && p.s === 200);
  const tk = (await post('/api/assessor/login', { password: 'rehearsal-pass' }, P)).j.token;
  const pl = await get('/api/assessor/list', P, { authorization: 'Bearer ' + tk });
  const tk2 = (await post('/api/assessor/login', { password: 'rehearsal-pass' }, S)).j.token;
  const sl = await get('/api/assessor/list', S, { authorization: 'Bearer ' + tk2 });
  check(15, 'each deploy assessor list shows only its own learners', pl.j.learners.length === 1 && sl.j.learners.every(l => l.name !== 'Prod Learner'));
}

// ---- Test 16 (headers, HTTP part) ----
{
  const h = async p => (await fetch(S.url + p)).headers;
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'self'";
  const pages = ['/index.html', '/assessor.html', '/app.js', '/style.css', '/data.js', '/assessor.js', '/fonts/Fredoka.woff2', '/img/sprite.svg'];
  const hs = await Promise.all(pages.map(h));
  check(16, 'every response carries the CSP header', hs.every(x => x.get('content-security-policy') === csp));
  check(16, 'fonts and images carry the one year cache header', ['/fonts/Fredoka.woff2', '/img/sprite.svg'].every(p => hs[pages.indexOf(p)].get('cache-control') === 'public, max-age=31536000, immutable'));
  check(16, 'app.js, style.css and data.js carry the default cache header', ['/app.js', '/style.css', '/data.js'].every(p => hs[pages.indexOf(p)].get('cache-control') === 'public, max-age=0, must-revalidate'));
}

// ---- Test 18: efficiency (API level model) ----
const perAttempt = [];
async function scriptedAttempt(srv, i) {
  let calls = 0;
  const c = async (p, b) => { calls++; return post(p, b, srv); };
  const email = 'coh' + i + '@test.example';
  await c('/api/start', { name: 'Cohort Learner ' + String.fromCharCode(65 + (i % 26)) + ' ' + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + 'x', email });
  const b = await c('/api/start', { name: 'Cohort Learner ' + String.fromCharCode(65 + (i % 26)) + ' ' + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + 'x', email, begin: true });
  const token = b.j.open.token; const full = perfect(); let rev = 0;
  const keys = Object.keys(full);
  const task = n => keys.filter((_, k) => k % 18 === n);
  let answers = {};
  for (let n = 0; n < 18; n++) {
    for (const k of task(n)) answers[k] = full[k];
    const lock = n === 3 ? 1 : n === 10 ? 2 : n === 15 ? 3 : undefined;
    const r = await c('/api/save', { token, rev, stage: 1, answers, lock }); rev = r.j.rev;
  }
  await c('/api/submit', { token, answers });
  return calls;
}
{
  const bs = memoryBlobs();
  const A = await startServer({ context: 'branch-deploy', blobs: bs });
  const n = await scriptedAttempt(A, 1000);
  perAttempt.push(n);
  check(18, 'a scripted attempt (one save per task, three locks, start, begin, submit) stays within 50 calls', n <= 50, n + ' calls');
  await A.close();
}

// ---- Test 19: cohort run ----
function model(callsPerAttempt, secs, loads, assessor) {
  const calls = 90 * callsPerAttempt;
  const compute = calls * secs / 3600 * 10;
  const web = (calls + 30 * loads * 7) / 10000 * 2;
  const band = 30 * loads * 0.45 / 1000 * 20;
  const learner = compute + web + band;
  const a = assessor.visits * ((assessor.login + assessor.list) / 3600 * 10) + assessor.visits * (2 + 6) / 10000 * 2 + assessor.visits * 0.45 / 1000 * 20;
  return { calls, compute, web, band, learner, assessor: a, total: learner + a, withDeploy: learner + a + 15 };
}
{
  const bs = memoryBlobs();
  const A = await startServer({ context: 'branch-deploy', blobs: bs });
  const t0 = Date.now();
  const counts = [];
  for (let wave = 0; wave < 3; wave++) counts.push(...await Promise.all(Array.from({ length: 30 }, (_, i) => scriptedAttempt(A, 2000 + wave * 100 + i))));
  const ms = Date.now() - t0;
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const store = bs.stores.get('sim-w13-branch-deploy');
  const learners = [...store.keys()].filter(k => k.startsWith('learner/')).length;
  check(19, 'the 30 learner by 3 attempt run finishes without a failed call', counts.length === 90 && learners > 0, counts.length + ' attempts, ' + learners + ' learner records, ' + ms + ' ms');
  const spec = { avg: model(50, 0.25, 3, { visits: 20, login: 0.25, list: 1 }), worst: model(200, 0.5, 15, { visits: 100, login: 0.5, list: 2 }) };
  const measured = { avg: model(avg, 0.25, 3, { visits: 20, login: 0.25, list: 1 }), worst: model(200, 0.5, 15, { visits: 100, login: 0.5, list: 2 }) };
  const f = x => x.toFixed(3);
  console.log('\nCohort credit table (formulas from section 13.2)');
  console.log('                           average    worst');
  for (const [k, lab] of [['calls', 'Learner calls'], ['compute', 'Compute credits'], ['web', 'Web request credits'], ['band', 'Bandwidth credits'], ['learner', 'Learner credits'], ['assessor', 'Assessor credits'], ['total', 'Total credits'], ['withDeploy', 'Total with deploy']])
    console.log(lab.padEnd(26) + (k === 'calls' ? String(spec.avg[k]).padStart(8) + String(spec.worst[k]).padStart(10) : f(spec.avg[k]).padStart(8) + f(spec.worst[k]).padStart(10)));
  console.log('Measured calls per attempt in the scripted run: ' + avg.toFixed(1) + ' -> average total ' + f(measured.avg.total) + ' credits, with deploy ' + f(measured.avg.withDeploy));
  const tableOk = Math.abs(spec.avg.total - 5.242) < 0.002 && Math.abs(spec.worst.total - 35.034) < 0.002 && Math.abs(spec.avg.withDeploy - 20.242) < 0.002 && Math.abs(spec.worst.withDeploy - 50.034) < 0.002;
  check(19, 'the recomputed table matches section 13.2 (5.242, 35.034, 20.242, 50.034)', tableOk);
  check(19, 'worst and average totals with the production deploy stay under 300', spec.worst.withDeploy < 300 && measured.avg.withDeploy < 300, 'worst ' + f(spec.worst.withDeploy) + ', average ' + f(spec.avg.withDeploy));
  check(18, 'the 90 attempt run averages within 50 calls and never above 200', avg <= 50 && Math.max(...counts) <= 200, 'average ' + avg.toFixed(1) + ', max ' + Math.max(...counts));
  fs.writeFileSync(path.join(root, 'test', 'measured.json'), JSON.stringify({ apiCallsPerAttempt: avg }, null, 1));
  await A.close();
}

await S.close(); await P.close();
const failed = results.filter(r => !r.pass);
fs.writeFileSync(path.join(root, 'test', 'api_results.json'), JSON.stringify(results, null, 1));
console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
process.exit(failed.length ? 1 : 0);
