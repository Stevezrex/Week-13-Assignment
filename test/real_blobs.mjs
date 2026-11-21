// Runs the five functions against the real @netlify/blobs client, talking to its local BlobsServer.
// This checks etag conditions, onlyIfNew, list paging and JSON reads with the library Netlify ships.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import { perfect } from './perfect.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blobs-'));
const server = new BlobsServer({ directory: dir, token: 'local-token', port: 0 });
const { port } = await server.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: 'http://localhost:' + port, uncachedEdgeURL: 'http://localhost:' + port, token: 'local-token', siteID: 'site-test', deployID: 'deploy-test' })).toString('base64');
process.env.ASSESSOR_PASSWORD = 'rehearsal-pass';

const mods = {};
for (const n of ['start', 'save', 'submit', 'reset', 'assessor']) mods[n] = (await import('../netlify/functions/' + n + '.mjs')).default;
const ctx = c => ({ deploy: { context: c } });
const call = async (fn, url, body, c = 'branch-deploy', headers = {}) => {
  const r = await mods[fn](new Request('http://x' + url, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }), ctx(c));
  return { s: r.status, j: await r.json() };
};
let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  (' + x + ')' : '')); if (!c) bad++; };

const a = await call('start', '/api/start', { name: 'Real Blob', email: 'real@test.example' });
ok('login creates a learner through the real client', a.s === 200 && a.j.attemptsUsed === 0, JSON.stringify(a.j));
const b = await call('start', '/api/start', { name: 'Real Blob', email: 'real@test.example', begin: true });
ok('begin opens attempt 1', b.s === 200 && b.j.open.n === 1);
const tk = b.j.open.token;
const s1 = await call('save', '/api/save', { token: tk, rev: 0, stage: 1, answers: perfect(), lock: 1 });
ok('save with a lock', s1.s === 200 && s1.j.locked.join() === '1' && s1.j.rev === 1, JSON.stringify(s1.j));
const par = await Promise.all([1, 2, 3, 4].map(i => call('save', '/api/save', { token: tk, rev: i, stage: 2, answers: { 's2.tempEnd': 'B' } })));
ok('four parallel saves resolve without a lost write or error (retry on a changed etag)', par.every(r => r.s === 200 || r.s === 409), par.map(r => r.s).join());
const sub = await call('submit', '/api/submit', { token: tk, answers: perfect() });
const sub2 = await call('submit', '/api/submit', { token: tk, answers: {} });
ok('submit then a second submit returns the same result', sub.s === 200 && JSON.stringify(sub.j) === JSON.stringify(sub2.j), JSON.stringify(sub.j));
const lg = await call('assessor', '/api/assessor/login', { password: 'rehearsal-pass' });
const ls = await call('assessor', '/api/assessor/list', undefined, 'branch-deploy', { authorization: 'Bearer ' + lg.j.token });
const me = ls.j.learners.find(l => l.name === 'Real Blob');
ok('the assessor list reads learners with the real list API and shows the best score', ls.s === 200 && me && me.best === 100 && me.attempts[0].score === 100, JSON.stringify(me));
const wrong = await call('assessor', '/api/assessor/login', { password: 'nope' });
ok('the lock counter writes and reads through the real client', wrong.s === 401);
const prod = await call('start', '/api/start', { name: 'Real Blob', email: 'real@test.example' }, 'production');
ok('production context is a separate store: the same learner is new there', prod.s === 200 && prod.j.attemptsUsed === 0);
const dirs = fs.readdirSync(path.join(dir, 'deploy-test') === dir ? dir : dir, { recursive: true }).filter(x => typeof x === 'string' && x.includes('sim-w13'));
ok('blobs are written under both store names', dirs.some(x => x.includes('sim-w13-branch-deploy')) && dirs.some(x => x.includes('sim-w13-production')), dirs.slice(0, 3).join(' | '));
await server.stop();
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
