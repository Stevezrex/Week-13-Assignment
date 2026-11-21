// Keys, accepted forms, weights and markAttempt. These live in this file only.

const LADDER = ['Viewer', 'Commenter', 'Contributor', 'Editor'];
const FOLDERS = ['00_Governance', '01_Client_Inputs', '02_Working_Documents', '03_Review_and_Comments',
  '04_Approved_Deliverables', '05_Decisions_and_Meeting_Records', '06_Handoff_and_Acceptance', '99_Archive'];

// ---- Simple one answer items: id -> [key, marks] ----
const CHOICE = {
  's1.model': ['B', 1], 's1.owner': ['C', 1], 's1.purpose': ['B', 1], 's1.class': ['C', 1],
  's2.group.adebayo': ['Directors', .5], 's2.group.okafor': ['Internal Team', .5],
  's2.group.ogunleye': ['Temporary Analysts', .5], 's2.group.bello': ['Finance', .5],
  's2.group.nwosu': ['Client Sponsor', .5], 's2.group.eze': ['Client Reviewers', .5],
  's2.group.bakare': ['Client Reviewers', .5],
  's2.tempEnd': ['B', 1], 's2.reviewersOwner': ['A', 1],
  's2.link.a': ['B', .5], 's2.link.b': ['A', .5], 's2.link.c': ['D', .5],
  's2.ext.account': ['A', .5], 's2.ext.level': ['A', .5], 's2.ext.review': ['B', .5],
  's2.ext.reshare': ['B', .5], 's2.ext.download': ['A', .5],
  's2.intake.folder': ['01_Client_Inputs', .5], 's2.intake.check': ['B', .5], 's2.intake.end': ['A', .5],
  's2.test.account': ['C', .5], 's2.test.folder': ['A', .5],
  's3.ver.e1': ['v0.2', .5], 's3.ver.e2': ['v0.3', .5], 's3.ver.e3': ['v1.0', .5],
  's3.ver.e4': ['v1.1', .5], 's3.ver.e5': ['v2.0', .5],
  's3.status.s1': ['Draft', .5], 's3.status.s2': ['In review', .5], 's3.status.s3': ['Awaiting approval', .5],
  's3.status.s4': ['Issued', .5], 's3.status.s5': ['Superseded', .5],
  's3.comment.issue': ['C', .5], 's3.comment.reason': ['A', .5], 's3.comment.action': ['B', .5],
  's3.comment.owner': ['C', .5], 's3.comment.due': ['B', .5],
  's3.approval.basis': ['C', .5], 's3.approval.separate': ['B', .5], 's3.approval.record': ['A', .5],
  's3.co.a': ['B', 1], 's3.co.b': ['C', 1], 's3.co.c': ['A', 1],
  's3.man.m1': ['Include', .25], 's3.man.m2': ['Include', .25], 's3.man.m3': ['Include', .25],
  's3.man.m4': ['Include', .25], 's3.man.m5': ['Set aside', .25], 's3.man.m6': ['Set aside', .25],
  's3.man.m7': ['Set aside', .25], 's3.man.m8': ['Set aside', .25],
  's3.route': ['B', 1],
  's3.cls.c1': ['Acceptance', .25], 's3.cls.c2': ['Receipt', .25],
  's3.cls.c3': ['Ownership transfer', .25], 's3.cls.c4': ['Access transfer', .25],
  's4.sign.reviewer': ['C', 1], 's4.sign.date': ['B', 1]
};
const TESTS = Array.from({ length: 14 }, (_, i) => 'T' + (i + 1));
const RESULT_KEY = { T1: 'Fail', T2: 'Pass', T3: 'Pass', T4: 'Fail', T5: 'Fail', T6: 'Fail', T7: 'Fail', T8: 'Not tested',
  T9: 'Pass', T10: 'Pass', T11: 'Fail', T12: 'Fail', T13: 'Not tested', T14: 'Fail' };
for (const t of TESTS) CHOICE['s4.result.' + t] = [RESULT_KEY[t], 1];

// ---- Stage 1 ----
const TREE = [
  ['CL021_Lagoon_Foods', 'CLIENTS', 'CL021'],
  ['PRJ01_Supplier_Review', 'CL021_Lagoon_Foods', 'PRJ01'],
  ...FOLDERS.map(f => [f, 'PRJ01_Supplier_Review', f.slice(0, 2) + '_' + f.slice(3).split('_')[0]])
];
const FILE_KEY = {
  F1: ['00_Governance', 'CL021_PRJ01_Engagement_AGR_20261102_v1.0_APPROVED.pdf', ['engagement', 'engagementletter'], ['agr', 'agreement']],
  F2: ['00_Governance', 'CL021_PRJ01_Scope_AGR_20261102_v1.0_APPROVED.docx', ['scope', 'scopeannex'], ['agr', 'agreement']],
  F3: ['01_Client_Inputs', 'CL021_PRJ01_SampleInvoices_INV_20261105_v1.0_ISSUED.pdf', ['sampleinvoices', 'invoices', 'octoberinvoices'], ['inv', 'invoice']],
  F4: ['01_Client_Inputs', 'CL021_PRJ01_SupplierOnboarding_SOP_20261105_v2.3_ISSUED.pdf', ['supplieronboarding', 'onboarding'], ['sop', 'procedure']],
  F5: ['02_Working_Documents', 'CL021_PRJ01_SupplierReview_RPT_20261117_v0.2_DRAFT.docx', ['supplierreview', 'review'], ['rpt', 'report']],
  F6: ['99_Archive', 'CL021_PRJ01_SupplierReview_RPT_20261112_v0.1_SUPERSEDED.docx', ['supplierreview', 'review'], ['rpt', 'report']],
  F7: ['03_Review_and_Comments', 'CL021_PRJ01_SupplierReview_RPT_20261118_v0.2_REVIEW.pdf', ['supplierreview', 'review'], ['rpt', 'report']],
  F8: ['05_Decisions_and_Meeting_Records', 'CL021_PRJ01_Kickoff_MIN_20261104_v1.0_APPROVED.docx', ['kickoff', 'kickoffmeeting'], ['min', 'minutes']],
  F9: ['05_Decisions_and_Meeting_Records', 'CL021_PRJ01_Weekly_MIN_20261113_v0.1_DRAFT.docx', ['weekly', 'weeklymeeting'], ['min', 'minutes']],
  F10: ['02_Working_Documents', 'CL021_PRJ01_GoodsReceipt_SOP_20261110_v0.1_DRAFT.docx', ['goodsreceipt'], ['sop', 'procedure']]
};

// ---- Stage 2 ----
const LINE_KEY = {
  '00_Governance': [['Directors', 'Editor'], ['Finance', 'Viewer']],
  '01_Client_Inputs': [['Client Sponsor', 'Contributor'], ['Internal Team', 'Viewer']],
  '02_Working_Documents': [['Internal Team', 'Editor'], ['Temporary Analysts', 'Editor']],
  '03_Review_and_Comments': [['Client Reviewers', 'Commenter'], ['Internal Team', 'Editor']],
  '04_Approved_Deliverables': [['Client Sponsor', 'Viewer'], ['Internal Team', 'Viewer'], ['Directors', 'Viewer']],
  '05_Decisions_and_Meeting_Records': [['Directors', 'Editor'], ['Internal Team', 'Contributor']],
  '06_Handoff_and_Acceptance': [['Directors', 'Editor'], ['Client Sponsor', 'Contributor']],
  '99_Archive': [['Directors', 'Viewer']]
};

// ---- Stage 3 register ----
const REG_KEY = {
  R1: ['AGR', 'Mrs Funke Adebayo', 'Approved'], R2: ['AGR', 'Mrs Funke Adebayo', 'Approved'],
  R3: ['MIN', 'Chidi Okafor', 'Approved'], R4: ['MIN', 'Chidi Okafor', 'Draft'],
  R5: ['RPT', 'Chidi Okafor', 'In review'], R6: ['SOP', 'Mr Emeka Nwosu', 'Issued']
};

// ---- Stage 4 findings ----
const RISK_KEY = { T1: 'High', T5: 'High', T7: 'High', T4: 'Medium', T6: 'Medium', T11: 'Medium', T12: 'Medium', T14: 'Low' };
const DUE_FOR_RISK = { High: 'Monday 23 November 2026', Medium: 'Friday 27 November 2026', Low: 'Friday 4 December 2026' };
const OWNER_KEY = { T1: 'Mrs Funke Adebayo', T4: 'Mrs Funke Adebayo', T5: 'Document custodian (you)', T6: 'Document custodian (you)',
  T7: 'Document custodian (you)', T11: 'Document custodian (you)', T12: 'Document custodian (you)', T14: 'Document custodian (you)' };
const ACTION_MARKS = {
  T1: { C: .75, B: .375 }, T4: { A: .75, C: .375 }, T5: { D: .75, C: .375 }, T6: { B: .75, D: .375 },
  T7: { C: .75, B: .375 }, T11: { A: .75, C: .375 }, T12: { D: .75, C: .375 }, T14: { B: .75, C: .375 }
};

// ---- Known ids and value shapes ----
const str = (v, n) => typeof v === 'string' && v.length <= n;
const SHAPES = {
  tree: v => Array.isArray(v) && v.length <= 40 && v.every(x => x && str(x.name, 60) && str(x.parent, 60)),
  file: v => v && str(v.folder, 60) && str(v.name, 120),
  lines: v => Array.isArray(v) && v.length <= 40 && v.every(x => x && str(x.folder, 60) && str(x.group, 40) && str(x.level, 20)),
  reg: v => v && str(v.id, 40) && str(v.owner, 40) && str(v.status, 30),
  find: v => v && str(v.risk, 10) && str(v.action, 2) && str(v.owner, 40) && str(v.due, 40),
  text: v => str(v, 80)
};
const ID_SHAPE = {};
for (const id of Object.keys(CHOICE)) ID_SHAPE[id] = 'text';
ID_SHAPE['s1.tree'] = 'tree';
for (const f of Object.keys(FILE_KEY)) ID_SHAPE['s1.files.' + f] = 'file';
ID_SHAPE['s2.lines'] = 'lines';
for (const r of Object.keys(REG_KEY)) ID_SHAPE['s3.reg.' + r] = 'reg';
for (const t of TESTS) ID_SHAPE['s4.find.' + t] = 'find';

function isKnownItem(id) { return Object.prototype.hasOwnProperty.call(ID_SHAPE, id); }
export function stageOfItem(id) { return Number(id[1]); }
export function acceptValue(id, v) { return isKnownItem(id) && SHAPES[ID_SHAPE[id]](v); }

// ---- Marking helpers ----
const r4 = x => Math.round(x * 10000) / 10000;
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const norm = s => String(s == null ? '' : s).trim().toLowerCase();

function markTree(tree) {
  const entries = Array.isArray(tree) ? tree : [];
  let total = 0;
  for (const [name, parent, code] of TREE) {
    let best = 0;
    for (const e of entries) {
      if (norm(e.parent) !== norm(parent)) continue;
      const n = norm(e.name);
      if (n === norm(name)) { best = Math.max(best, .5); continue; }
      const c = norm(code);
      if (n === c || n.startsWith(c + '_')) best = Math.max(best, .25);
    }
    total += best;
  }
  return total;
}

function validDate(s) {
  if (!/^\d{8}$/.test(s)) return false;
  const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function splitName(s) {
  const t = String(s == null ? '' : s).trim();
  const dot = t.lastIndexOf('.');
  const base = dot > 0 ? t.slice(0, dot) : t;
  const ext = dot > 0 ? t.slice(dot + 1) : '';
  return { segs: base.split('_'), ext };
}

function markName(file, given) {
  const key = splitName(FILE_KEY[file][1]);
  const [subj, type] = [FILE_KEY[file][2], FILE_KEY[file][3]];
  const g = splitName(given);
  if (g.segs.length !== 7) return 0;
  if (!validDate(g.segs[4]) || !/^v\d+\.\d+$/.test(g.segs[5])) return 0;
  let fixed = 0;
  if (g.segs[0] !== key.segs[0]) fixed++;
  if (g.segs[1] !== key.segs[1]) fixed++;
  if (g.segs[4] !== key.segs[4]) fixed++;
  if (g.segs[5] !== key.segs[5]) fixed++;
  if (g.segs[6] !== key.segs[6]) fixed++;
  if (norm(g.ext) !== norm(key.ext)) fixed++;
  const a = g.segs[2].toLowerCase(), b = g.segs[3].toLowerCase();
  const straight = (subj.includes(a) ? 0 : 1) + (type.includes(b) ? 0 : 1);
  const swapped = (type.includes(a) ? 0 : 1) + (subj.includes(b) ? 0 : 1);
  const diffs = fixed + Math.min(straight, swapped);
  if (diffs === 0) return 1;
  return diffs <= 2 ? .5 : .25;
}

function markLines(lines) {
  const all = Array.isArray(lines) ? lines : [];
  const items = {};
  let total = 0;
  for (const folder of FOLDERS) {
    const req = LINE_KEY[folder];
    const mine = all.filter(l => l.folder === folder);
    let earned = 0;
    for (const [group, level] of req) {
      let best = 0;
      for (const l of mine) {
        if (l.group !== group) continue;
        const d = Math.abs(LADDER.indexOf(l.level) - LADDER.indexOf(level));
        if (LADDER.indexOf(l.level) < 0) continue;
        best = Math.max(best, d === 0 ? .75 : d === 1 ? .375 : 0);
      }
      earned += best;
    }
    const outside = mine.some(l => !req.some(([g]) => g === l.group));
    if (outside) earned /= 2;
    items[folder] = r4(earned);
    total += earned;
  }
  return { total, items };
}

function markRegister(answers) {
  const out = {};
  const ids = {};
  for (const r of Object.keys(REG_KEY)) {
    const v = answers['s3.reg.' + r];
    if (v && typeof v.id === 'string') ids[r] = v.id.trim();
  }
  const counts = {};
  Object.values(ids).forEach(i => { counts[i] = (counts[i] || 0) + 1; });
  for (const [r, [type, owner, status]] of Object.entries(REG_KEY)) {
    const v = answers['s3.reg.' + r];
    let m = 0;
    if (v) {
      const id = ids[r];
      if (id && counts[id] === 1 && new RegExp('^CL021_PRJ01_' + type + '_\\d{3}$').test(id)) m += .4;
      if (v.owner === owner) m += .3;
      if (v.status === status) m += .3;
    }
    out['s3.reg.' + r] = r4(m);
  }
  return out;
}

function markFinding(t, answers) {
  const f = answers['s4.find.' + t];
  if (!f || RESULT_KEY[t] !== 'Fail' || answers['s4.result.' + t] !== 'Fail') return 0;
  let m = 0;
  if (f.risk === RISK_KEY[t]) m += .5;
  m += ACTION_MARKS[t][f.action] || 0;
  if (f.owner === OWNER_KEY[t]) m += .25;
  if (f.due === DUE_FOR_RISK[RISK_KEY[t]]) m += .25;
  return m;
}

export function markAttempt(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const items = {};
  for (const [id, [key, marks]] of Object.entries(CHOICE)) items[id] = a[id] === key ? marks : 0;

  items['s1.tree'] = r4(markTree(a['s1.tree']));
  for (const f of Object.keys(FILE_KEY)) {
    const v = a['s1.files.' + f];
    let m = 0;
    if (v) {
      if (norm(v.folder) === norm(FILE_KEY[f][0])) m += .5;
      m += markName(f, v.name);
    }
    items['s1.files.' + f] = r4(m);
  }

  const lines = markLines(a['s2.lines']);
  items['s2.lines'] = r4(lines.total);
  items['s2.lines.byFolder'] = lines.items;
  Object.assign(items, markRegister(a));
  for (const t of TESTS) items['s4.find.' + t] = r4(markFinding(t, a));

  const sum = prefix => Object.entries(items)
    .filter(([id]) => id.startsWith(prefix) && typeof items[id] === 'number').reduce((s, [, v]) => s + v, 0);
  const stages = { s1: r2(sum('s1.')), s2: r2(sum('s2.')), s3: r2(sum('s3.')), s4: r2(sum('s4.')) };
  const total = r2(stages.s1 + stages.s2 + stages.s3 + stages.s4);
  return { stages, total, items };
}
