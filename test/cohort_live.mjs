// Cohort run: 30 learners by 3 attempts, all learners at once.
//   node test/cohort_live.mjs --local                 runs against the local stand in (no credits)
//   node test/cohort_live.mjs --url https://<rehearsal-deploy>   runs against a deploy and spends credits
//   add --calls 200 for the worst case of 200 calls per attempt (about 35 credits on a real deploy)
// Compare the printed credits with Usage in the Netlify dashboard. The dashboard is the authority.
import { perfect } from './perfect.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const CALLS = Number(arg('calls', 21)), LEARNERS = Number(arg('learners', 30)), ATTEMPTS = 3;
let base = arg('url', null), local = null;
if (arg('local', false)) { const { startServer } = await import('./harness.mjs'); local = await startServer({ context: 'branch-deploy' }); base = local.url; }
if (!base) { console.log('Give --local or --url <site address>'); process.exit(2); }
base = base.replace(/\/$/, '');

const lat = []; let failed = 0, calls = 0;
async function post(p, body) {
  const t = performance.now(); calls++;
  try {
    const r = await fetch(base + p, { method: 'POST', body: JSON.stringify(body) });
    const j = await r.json(); lat.push(performance.now() - t);
    if (r.status >= 400) failed++;
    return j;
  } catch { failed++; lat.push(performance.now() - t); return {}; }
}
const full = perfect(), keys = Object.keys(full);
async function attempt(name, email) {
  let n = 0; const c = async (p, b) => { n++; return post(p, b); };
  await c('/api/start', { name, email });
  const b = await c('/api/start', { name, email, begin: true });
  const token = b.open && b.open.token; if (!token) return n;
  let rev = 0; const answers = {};
  for (let t = 0; t < 18; t++) {
    keys.filter((_, k) => k % 18 === t).forEach(k => { answers[k] = full[k]; });
    const lock = t === 3 ? 1 : t === 10 ? 2 : t === 15 ? 3 : undefined;
    const r = await c('/api/save', { token, rev, stage: 1, answers, lock }); rev = r.rev || rev;
  }
  let flip = 0;
  while (n < CALLS - 1) { flip ^= 1; const r = await c('/api/save', { token, rev, stage: 4, answers: Object.assign({}, answers, { 's4.sign.date': flip ? 'A' : 'B' }) }); rev = r.rev || rev; }
  await c('/api/submit', { token, answers });
  return n;
}
const t0 = performance.now();
const per = await Promise.all(Array.from({ length: LEARNERS }, async (_, i) => {
  const name = 'Cohort ' + String.fromCharCode(65 + (i % 26)) + ' ' + String.fromCharCode(97 + Math.floor(i / 26)) + 'ee';
  const out = []; for (let a = 0; a < ATTEMPTS; a++) out.push(await attempt(name, 'live' + i + '@test.example')); return out;
}));
const secs = (performance.now() - t0) / 1000;
const all = per.flat(), avg = all.reduce((a, b) => a + b, 0) / all.length;
lat.sort((a, b) => a - b);
const q = p => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))];
const meanSec = lat.reduce((a, b) => a + b, 0) / lat.length / 1000;

const credits = (callsTotal, secsPerCall, loads) => {
  const compute = callsTotal * secsPerCall / 3600 * 10;
  const web = (callsTotal + LEARNERS * loads * 7) / 10000 * 2;
  const band = LEARNERS * loads * 0.45 / 1000 * 20;
  return { compute, web, band, total: compute + web + band };
};
const f = x => x.toFixed(3);
console.log(`Run: ${LEARNERS} learners x ${ATTEMPTS} attempts = ${all.length} attempts, ${calls} calls, ${failed} failed, ${secs.toFixed(1)} s wall time`);
console.log(`Calls per attempt: average ${avg.toFixed(1)}, max ${Math.max(...all)}`);
console.log(`Call latency: mean ${(meanSec * 1000).toFixed(0)} ms, p50 ${q(0.5).toFixed(0)} ms, p95 ${q(0.95).toFixed(0)} ms`);
const spec = credits(calls, CALLS >= 100 ? 0.5 : 0.25, CALLS >= 100 ? 15 : 3);
const meas = credits(calls, meanSec, CALLS >= 100 ? 15 : 3);
console.log(`Learner credits with the plan's seconds per call (${CALLS >= 100 ? 0.5 : 0.25}): ${f(spec.total)}  (compute ${f(spec.compute)}, requests ${f(spec.web)}, bandwidth ${f(spec.band)})`);
console.log(`Learner credits with the measured mean latency per call: ${f(meas.total)}  (latency includes network time, so this overstates compute on a real deploy)`);
if (local) { console.log('Local run: latency is in memory, so only the call counts and failures are meaningful.'); await local.close(); }
process.exit(failed ? 1 : 0);
