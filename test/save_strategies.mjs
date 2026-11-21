// Compares save strategies by simulating learners. Counts server calls per attempt, then prices them.
//   node test/save_strategies.mjs
// A change is one answer entered. A pass is the 172 changes of a full attempt in 18 tasks.
const TASKS = [2, 2, 10, 20, 7, 16, 2, 3, 5, 3, 2, 10, 8, 3, 18, 13, 46, 2];   // changes per task, 172 in all
const LOCK_AFTER = [3, 10, 15];                                                   // task indexes (0 based) that end a stage
const BUDGET = 75;                                                                // 25 percent of 300 credits, deploy included
let seed = 7; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const logn = (median, sigma = 0.7) => median * Math.exp(sigma * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()));

// strategy: { debounce (null = none, 0 = every change), boundary, hide, maxWait }
const STRATS = {
  'A  2 s wait (now)':                     { debounce: 2, boundary: false, hide: false },
  'B  save every change':                  { debounce: 0, boundary: false, hide: false },
  'C  10 s wait + task change + hide':     { debounce: 10, boundary: true, hide: true },
  'D  task change + hide only':            { debounce: null, boundary: true, hide: true },
  'E  task change + hide + 2 min cap':     { debounce: null, boundary: true, hide: true, maxWait: 120 },
  'F  task change + 2 min cap, no hide':   { debounce: null, boundary: true, hide: false, maxWait: 120 },
  'G  task change + hide + 5 min cap':     { debounce: null, boundary: true, hide: true, maxWait: 300 }
};

// One pass over `ntasks` tasks. Returns saves (not counting lock calls) and the minutes it took.
function pass(st, ntasks, median, corr, hideRate) {
  let t = 0, saves = 0, locks = 0, dirty = false, firstUnsaved = 0, lastChange = 0;
  const events = [];
  for (let k = 0; k < ntasks; k++) {
    const n = Math.round(TASKS[k] * corr);
    for (let i = 0; i < n; i++) { t += logn(median); events.push([t, 'c']); }
    t += 4; events.push([t, 'b', k]);
  }
  const minutes = t / 60;
  const hides = Math.round(hideRate * minutes * (0.6 + rnd() * 0.8));
  for (let i = 0; i < hides; i++) events.push([rnd() * t, 'h']);
  events.sort((a, b) => a[0] - b[0]);
  const fire = upto => {                         // timers that expire before `upto`
    for (;;) {
      if (!dirty) return;
      const d = st.debounce > 0 ? lastChange + st.debounce : Infinity, m = st.maxWait ? firstUnsaved + st.maxWait : Infinity;
      const at = Math.min(d, m);
      if (at > upto) return;
      saves++; dirty = false;
    }
  };
  for (const [et, type, k] of events) {
    fire(et);
    if (type === 'c') {
      if (st.debounce === 0) { saves++; continue; }
      if (!dirty) { dirty = true; firstUnsaved = et; }
      lastChange = et;
    } else if (type === 'b') {
      if (dirty && st.boundary) { if (LOCK_AFTER.includes(k)) locks++; else saves++; dirty = false; }
      else if (LOCK_AFTER.includes(k)) locks++;
    } else if (type === 'h' && st.hide && dirty) { saves++; dirty = false; if (rnd() < 0.5) { dirty = true; } }   // half the time the next boundary sends it again
  }
  fire(Infinity);
  return { saves, locks, minutes };
}
function attempt(st, p) {
  const first = pass(st, p.firstTasks, p.median, p.corr, p.hideRate);
  const second = pass(st, 18, p.median, p.corr, p.hideRate);
  return 2 + 1 + 1 + first.saves + first.locks + second.saves + second.locks;      // start, begin, reset, submit
}
const PACES = {
  'fast (3 s between answers)': { median: 3, corr: 1, hideRate: 0.1, firstTasks: 11 },
  'typical (12 s)': { median: 12, corr: 1, hideRate: 0.1, firstTasks: 11 },
  'plan pace (35 s, from 105 min for 172 changes)': { median: 35, corr: 1, hideRate: 0.1, firstTasks: 11 }
};
const WORST = { median: 35, corr: 1.25, hideRate: 0.6, firstTasks: 18 };            // slow, corrects answers, switches apps a lot, resets after a full pass

// pricing as in credit_sim.mjs: plan seconds per call, plan page loads and assessor visits
const other = (worst) => worst ? { band: 0.791 - 0.0 , web0: 0, assessor: 1.003, staticReq: 30 * 15 * 7 } : { band: 0.055, web0: 0, assessor: 0.095, staticReq: 30 * (7 + 2 * 4) };
const credits = (callsPerAttempt, worst) => {
  const calls = 90 * callsPerAttempt, o = other(worst);
  const compute = calls * (worst ? 0.5 : 0.25) / 3600 * 10;
  const web = (calls + o.staticReq) / 10000 * 2;
  const band = o.band + (worst ? calls * 35 : calls * 41) / 1e9 * 20 - (worst ? 39060 * 35 : 2970 * 41) / 1e9 * 20;
  return compute + web + band + o.assessor + 15;
};
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const N = 300;
console.log('Calls per attempt (start, begin, reset, submit, locks and saves), mean of %d simulated attempts\n', N);
const names = Object.keys(STRATS);
console.log('Strategy'.padEnd(40) + Object.keys(PACES).map(k => k.slice(0, 22).padStart(24)).join('') + '   WORST'.padStart(10));
const res = {};
for (const n of names) {
  const row = Object.values(PACES).map(p => mean(Array.from({ length: N }, () => attempt(STRATS[n], p))));
  const w = mean(Array.from({ length: N }, () => attempt(STRATS[n], WORST)));
  res[n] = { row, w };
  console.log(n.padEnd(40) + row.map(x => x.toFixed(1).padStart(24)).join('') + w.toFixed(1).padStart(10));
}
console.log('\nTotal credits with the production deploy (budget %d). Average uses the plan pace column, worst uses WORST.\n', BUDGET);
console.log('Strategy'.padEnd(40) + 'average'.padStart(10) + 'worst'.padStart(10) + '   within 75 at worst');
for (const n of names) { const a = credits(res[n].row[2], false), w = credits(res[n].w, true); console.log(n.padEnd(40) + a.toFixed(1).padStart(10) + w.toFixed(1).padStart(10) + '   ' + (w <= BUDGET ? 'yes' : 'NO')); }
import('node:fs').then(fs => fs.writeFileSync(new URL('./save_strategies.json', import.meta.url), JSON.stringify(res, null, 1)));
