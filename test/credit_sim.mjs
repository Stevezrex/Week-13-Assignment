// Simulated credit run: 30 learners x 3 attempts with one reset in every attempt, average and worst case.
// It runs the real function code against a counted Blobs store, measures calls, Blobs operations, response bytes
// and file sizes, then prices them with Netlify's published rates (checked November 2026).
//   node test/credit_sim.mjs
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { memoryBlobs } from './harness.mjs';
import { setStoreFactory } from '../netlify/lib/attempts.mjs';
import { perfect } from './perfect.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.ASSESSOR_PASSWORD = 'sim-pass';
const RATE = { compute: 10, bandwidthGB: 20, per10kRequests: 2, deploy: 15, allowance: 300 }; // credits, Free plan
const LEARNERS = 30, ATTEMPTS = 3;

// ---- counted store ----
const ops = { get: 0, set: 0, list: 0 };
let mem = memoryBlobs();
setStoreFactory(name => {
  const s = mem.factory(name), w = {};
  for (const k of ['get', 'getWithMetadata']) w[k] = (...a) => { ops.get++; return s[k](...a); };
  for (const k of ['set', 'setJSON']) w[k] = (...a) => { ops.set++; return s[k](...a); };
  w.list = (...a) => { ops.list++; return s.list(...a); };
  return w;
});
const mods = {};
for (const n of ['start', 'save', 'submit', 'reset', 'assessor']) mods[n] = (await import('../netlify/functions/' + n + '.mjs')).default;
const meter = { calls: 0, bytes: 0, byEndpoint: {} };
async function call(fn, url, body, headers) {
  const r = await mods[fn](new Request('http://x' + url, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }), { deploy: { context: 'branch-deploy' } });
  const text = await r.text();
  meter.calls++; meter.bytes += Buffer.byteLength(text);
  const e = meter.byEndpoint[url] || (meter.byEndpoint[url] = { calls: 0, bytes: 0, ops: 0 });
  e.calls++; e.bytes += Buffer.byteLength(text);
  return { s: r.status, j: JSON.parse(text) };
}

// ---- attempt scripts ----
const full = perfect(), keys = Object.keys(full);
// One pass of `saves` autosaves. Answers grow as in a real attempt. Locks follow stages 1, 2, 3 (tasks 4, 11 and 16 of 18).
async function pass(token, saves, rev0, flip) {
  let rev = rev0; const answers = {};
  const lockAt = [Math.round(saves * 4 / 18), Math.round(saves * 11 / 18), Math.round(saves * 16 / 18)];
  for (let i = 1; i <= saves; i++) {
    const upto = Math.min(keys.length, Math.ceil(i / saves * keys.length));
    for (let k = 0; k < upto; k++) answers[keys[k]] = full[keys[k]];
    if (i > keys.length * 1.0 && flip) answers['s4.sign.date'] = i % 2 ? 'A' : 'B';  // a corrected answer saved again
    const li = lockAt.indexOf(i);
    const r = await call('save', '/api/save', { token, rev, stage: 1, answers, lock: li >= 0 ? li + 1 : undefined });
    rev = r.j.rev;
  }
  return { answers, rev };
}
async function attempt(name, email, plan) {
  await call('start', '/api/start', { name, email });
  const b = await call('start', '/api/start', { name, email, begin: true });
  if (!b.j.open) throw new Error('begin failed ' + b.s + ' ' + JSON.stringify(b.j) + ' ' + name);
  const token = b.j.open.token;
  // first pass up to the reset, then the reset, then a full pass
  const first = await pass(token, plan.firstSaves, 0, plan.corrections);
  const rs = await call('reset', '/api/reset', { token });
  const second = await pass(token, plan.fullSaves, rs.j.open.rev, plan.corrections);
  await call('submit', '/api/submit', { token, answers: second.answers });
  void first;
}
async function cohort(plan, tag) {
  mem = memoryBlobs();
  const before = { ...meter, byEndpoint: {} };
  Object.assign(meter, { calls: 0, bytes: 0, byEndpoint: {} }); ops.get = ops.set = ops.list = 0;
  await Promise.all(Array.from({ length: LEARNERS }, async (_, i) => {
    const name = 'Sim ' + String.fromCharCode(65 + (i % 26)) + ' ' + String.fromCharCode(97 + Math.floor(i / 26)) + 'x';
    for (let a = 0; a < ATTEMPTS; a++) await attempt(name, 'sim' + i + '@test.example', plan);
  }));
  const res = { tag, calls: meter.calls, bytes: meter.bytes, ops: { ...ops }, byEndpoint: JSON.parse(JSON.stringify(meter.byEndpoint)) };
  const store = [...mem.stores.get('sim-w13-branch-deploy').entries()].filter(([k]) => k.startsWith('learner/'));
  res.recordKB = Math.max(...store.map(([, v]) => v.data.length)) / 1024;
  res.records = store.length;
  void before;
  return res;
}
async function assessorVisit() {
  const lg = await call('assessor', '/api/assessor/login', { password: 'sim-pass' });
  const ls = await call('assessor', '/api/assessor/list', undefined, { authorization: 'Bearer ' + lg.j.token });
  return { listBytes: Buffer.byteLength(JSON.stringify(ls.j)), learners: ls.j.learners.length };
}

// ---- file sizes (brotli, as Netlify serves them) ----
const br = f => zlib.brotliCompressSync(fs.readFileSync(path.join(root, 'public', f))).length;
const learnerFiles = ['index.html', 'style.css', 'app.js', 'data.js', 'img/sprite.svg', 'fonts/Fredoka.woff2', 'fonts/Nunito.woff2'];
const assessorFiles = ['assessor.html', 'style.css', 'assessor.js', 'img/sprite.svg', 'fonts/Fredoka.woff2', 'fonts/Nunito.woff2'];
const learnerLoad = learnerFiles.reduce((a, f) => a + br(f), 0), assessorLoad = assessorFiles.reduce((a, f) => a + br(f), 0);
const REVAL = 350; // bytes of a 304 response with headers

// ---- scenarios ----
// Calls per attempt come from test/save_strategies.mjs for the strategy the app uses: task change, page hide and a 5 minute cap.
const strat = JSON.parse(fs.readFileSync(path.join(root, 'test', 'save_strategies.json'), 'utf8'))['G  task change + hide + 5 min cap'];
const split = total => { const n = Math.round(total) - 4; const first = Math.round(n * 0.4); return { firstSaves: first, fullSaves: n - first }; };
const average = Object.assign({ name: 'Average', corrections: false, secs: 0.25, loginSecs: 0.25, listSecs: 1.0, loads: 3, cold: false, visits: 20 }, split(strat.row[2]));   // plan pace, reset after Stage 2
const worst = Object.assign({ name: 'Worst', corrections: true, secs: 0.5, loginSecs: 0.5, listSecs: 2.0, loads: 15, cold: true, visits: 100 }, split(strat.w));                // slow, corrections, many app switches, reset after a full pass
const out = [];
for (const sc of [average, worst]) {
  const r = await cohort(sc, sc.name);
  const attempts = LEARNERS * ATTEMPTS;
  const visit = await assessorVisit();
  // pricing
  const compute = r.calls * sc.secs / 3600 * 1 * RATE.compute;
  const learnerStaticReq = LEARNERS * (sc.cold ? sc.loads * 7 : 7 + (sc.loads - 1) * 4);
  const learnerStaticBytes = LEARNERS * (sc.cold ? sc.loads * learnerLoad : learnerLoad + (sc.loads - 1) * 4 * REVAL);
  const web = (r.calls + learnerStaticReq) / 10000 * RATE.per10kRequests;
  const band = (learnerStaticBytes + r.bytes) / 1e9 * RATE.bandwidthGB;
  const aCompute = sc.visits * (sc.loginSecs + sc.listSecs) / 3600 * RATE.compute;
  const aReq = sc.cold ? sc.visits * 8 : 8 + (sc.visits - 1) * 5;
  const aBytes = (sc.cold ? sc.visits * assessorLoad : assessorLoad + (sc.visits - 1) * 3 * REVAL) + sc.visits * (visit.listBytes + 200);
  const aWeb = aReq / 10000 * RATE.per10kRequests, aBand = aBytes / 1e9 * RATE.bandwidthGB;
  const learner = compute + web + band, assessor = aCompute + aWeb + aBand;
  out.push({ sc, r, attempts, compute, web, band, learner, aCompute, aWeb, aBand, assessor, total: learner + assessor, withDeploy: learner + assessor + RATE.deploy, learnerStaticReq, learnerStaticBytes, visit });
}
const f3 = x => x.toFixed(3), pad = (s, n) => String(s).padStart(n);
const [A, W] = out;
console.log('Simulation: %d learners x %d attempts = %d attempts per scenario, one reset in every attempt', LEARNERS, ATTEMPTS, LEARNERS * ATTEMPTS);
console.log('Rates (Netlify, Free plan): compute %d per GB hour, bandwidth %d per GB, web requests %d per 10,000, production deploy %d, allowance %d\n', RATE.compute, RATE.bandwidthGB, RATE.per10kRequests, RATE.deploy, RATE.allowance);
const rows = [
  ['Function calls per attempt', x => (x.r.calls / x.attempts).toFixed(1)],
  ['Function calls, cohort', x => x.r.calls],
  ['Blob reads, cohort', x => x.r.ops.get], ['Blob writes, cohort', x => x.r.ops.set],
  ['Largest learner record (KB)', x => x.r.recordKB.toFixed(1)],
  ['Function response bytes, cohort', x => x.r.bytes],
  ['Seconds per call (plan)', x => x.sc.secs],
  ['Compute credits', x => f3(x.compute)], ['Web request credits', x => f3(x.web)], ['Bandwidth credits', x => f3(x.band)],
  ['Learner credits', x => f3(x.learner)], ['Assessor credits (%d / %d visits)'.replace('%d', 20).replace('%d', 100), x => f3(x.assessor)],
  ['Total credits', x => f3(x.total)], ['Total with the production deploy', x => f3(x.withDeploy)],
  ['Share of the 300 credit allowance', x => (x.withDeploy / 3).toFixed(1) + ' percent']];
console.log('Result'.padEnd(40) + pad('Average', 14) + pad('Worst', 14));
for (const [label, fn] of rows) console.log(label.padEnd(40) + pad(fn(A), 14) + pad(fn(W), 14));
console.log('\nPer endpoint calls per attempt (average | worst):');
for (const u of Object.keys(A.r.byEndpoint)) console.log('  ' + u.padEnd(22) + pad((A.r.byEndpoint[u].calls / A.attempts).toFixed(1), 8) + ' |' + pad((W.r.byEndpoint[u].calls / W.attempts).toFixed(1), 8));
console.log('\nFile weight, brotli: learner first load %d bytes, assessor visit %d bytes', learnerLoad, assessorLoad);
console.log('Plan model for comparison: average total 5.242 (20.242 with deploy), worst 35.034 (50.034 with deploy)');
fs.writeFileSync(path.join(root, 'test', 'credit_sim.json'), JSON.stringify({ average: { calls: A.r.calls, total: A.total, withDeploy: A.withDeploy, learner: A.learner, assessor: A.assessor }, worst: { calls: W.r.calls, total: W.total, withDeploy: W.withDeploy, learner: W.learner, assessor: W.assessor }, learnerLoad, assessorLoad }, null, 1));
process.exit(0);
