// An independent copy of the keyed answer set, typed from the plan. It checks marking.mjs.
export const FILES = {
  F1: ['00_Governance', 'CL021_PRJ01_Engagement_AGR_20261102_v1.0_APPROVED.pdf'],
  F2: ['00_Governance', 'CL021_PRJ01_Scope_AGR_20261102_v1.0_APPROVED.docx'],
  F3: ['01_Client_Inputs', 'CL021_PRJ01_SampleInvoices_INV_20261105_v1.0_ISSUED.pdf'],
  F4: ['01_Client_Inputs', 'CL021_PRJ01_SupplierOnboarding_SOP_20261105_v2.3_ISSUED.pdf'],
  F5: ['02_Working_Documents', 'CL021_PRJ01_SupplierReview_RPT_20261117_v0.2_DRAFT.docx'],
  F6: ['99_Archive', 'CL021_PRJ01_SupplierReview_RPT_20261112_v0.1_SUPERSEDED.docx'],
  F7: ['03_Review_and_Comments', 'CL021_PRJ01_SupplierReview_RPT_20261118_v0.2_REVIEW.pdf'],
  F8: ['05_Decisions_and_Meeting_Records', 'CL021_PRJ01_Kickoff_MIN_20261104_v1.0_APPROVED.docx'],
  F9: ['05_Decisions_and_Meeting_Records', 'CL021_PRJ01_Weekly_MIN_20261113_v0.1_DRAFT.docx'],
  F10: ['02_Working_Documents', 'CL021_PRJ01_GoodsReceipt_SOP_20261110_v0.1_DRAFT.docx']
};
export const TEN_NAMES = Object.values(FILES).map(f => f[1]);
const FOLD = ['00_Governance', '01_Client_Inputs', '02_Working_Documents', '03_Review_and_Comments', '04_Approved_Deliverables',
  '05_Decisions_and_Meeting_Records', '06_Handoff_and_Acceptance', '99_Archive'];
const LINES = [
  ['00_Governance', 'Directors', 'Editor'], ['00_Governance', 'Finance', 'Viewer'],
  ['01_Client_Inputs', 'Client Sponsor', 'Contributor'], ['01_Client_Inputs', 'Internal Team', 'Viewer'],
  ['02_Working_Documents', 'Internal Team', 'Editor'], ['02_Working_Documents', 'Temporary Analysts', 'Editor'],
  ['03_Review_and_Comments', 'Client Reviewers', 'Commenter'], ['03_Review_and_Comments', 'Internal Team', 'Editor'],
  ['04_Approved_Deliverables', 'Client Sponsor', 'Viewer'], ['04_Approved_Deliverables', 'Internal Team', 'Viewer'], ['04_Approved_Deliverables', 'Directors', 'Viewer'],
  ['05_Decisions_and_Meeting_Records', 'Directors', 'Editor'], ['05_Decisions_and_Meeting_Records', 'Internal Team', 'Contributor'],
  ['06_Handoff_and_Acceptance', 'Directors', 'Editor'], ['06_Handoff_and_Acceptance', 'Client Sponsor', 'Contributor'],
  ['99_Archive', 'Directors', 'Viewer']
];
export function perfect() {
  const a = {
    's1.model': 'B', 's1.owner': 'C', 's1.purpose': 'B', 's1.class': 'C',
    's1.tree': [{ name: 'CL021_Lagoon_Foods', parent: 'CLIENTS' }, { name: 'PRJ01_Supplier_Review', parent: 'CL021_Lagoon_Foods' }]
      .concat(FOLD.map(name => ({ name, parent: 'PRJ01_Supplier_Review' }))),
    's2.lines': LINES.map(([folder, group, level]) => ({ folder, group, level })),
    's2.group.adebayo': 'Directors', 's2.group.okafor': 'Internal Team', 's2.group.ogunleye': 'Temporary Analysts', 's2.group.bello': 'Finance',
    's2.group.nwosu': 'Client Sponsor', 's2.group.eze': 'Client Reviewers', 's2.group.bakare': 'Client Reviewers',
    's2.tempEnd': 'B', 's2.reviewersOwner': 'A', 's2.link.a': 'B', 's2.link.b': 'A', 's2.link.c': 'D',
    's2.ext.account': 'A', 's2.ext.level': 'A', 's2.ext.review': 'B', 's2.ext.reshare': 'B', 's2.ext.download': 'A',
    's2.intake.folder': '01_Client_Inputs', 's2.intake.check': 'B', 's2.intake.end': 'A', 's2.test.account': 'C', 's2.test.folder': 'A',
    's3.ver.e1': 'v0.2', 's3.ver.e2': 'v0.3', 's3.ver.e3': 'v1.0', 's3.ver.e4': 'v1.1', 's3.ver.e5': 'v2.0',
    's3.status.s1': 'Draft', 's3.status.s2': 'In review', 's3.status.s3': 'Awaiting approval', 's3.status.s4': 'Issued', 's3.status.s5': 'Superseded',
    's3.comment.issue': 'C', 's3.comment.reason': 'A', 's3.comment.action': 'B', 's3.comment.owner': 'C', 's3.comment.due': 'B',
    's3.approval.basis': 'C', 's3.approval.separate': 'B', 's3.approval.record': 'A',
    's3.co.a': 'B', 's3.co.b': 'C', 's3.co.c': 'A',
    's3.reg.R1': { id: 'CL021_PRJ01_AGR_001', owner: 'Mrs Funke Adebayo', status: 'Approved' },
    's3.reg.R2': { id: 'CL021_PRJ01_AGR_002', owner: 'Mrs Funke Adebayo', status: 'Approved' },
    's3.reg.R3': { id: 'CL021_PRJ01_MIN_001', owner: 'Chidi Okafor', status: 'Approved' },
    's3.reg.R4': { id: 'CL021_PRJ01_MIN_002', owner: 'Chidi Okafor', status: 'Draft' },
    's3.reg.R5': { id: 'CL021_PRJ01_RPT_001', owner: 'Chidi Okafor', status: 'In review' },
    's3.reg.R6': { id: 'CL021_PRJ01_SOP_001', owner: 'Mr Emeka Nwosu', status: 'Issued' },
    's3.route': 'B',
    's3.cls.c1': 'Acceptance', 's3.cls.c2': 'Receipt', 's3.cls.c3': 'Ownership transfer', 's3.cls.c4': 'Access transfer',
    's4.sign.reviewer': 'C', 's4.sign.date': 'B'
  };
  for (const [f, [folder, name]] of Object.entries(FILES)) a['s1.files.' + f] = { folder, name };
  for (const m of ['m1', 'm2', 'm3', 'm4']) a['s3.man.' + m] = 'Include';
  for (const m of ['m5', 'm6', 'm7', 'm8']) a['s3.man.' + m] = 'Set aside';
  const res = { T1: 'Fail', T2: 'Pass', T3: 'Pass', T4: 'Fail', T5: 'Fail', T6: 'Fail', T7: 'Fail', T8: 'Not tested', T9: 'Pass', T10: 'Pass',
    T11: 'Fail', T12: 'Fail', T13: 'Not tested', T14: 'Fail' };
  for (const [t, r] of Object.entries(res)) a['s4.result.' + t] = r;
  const find = { T1: ['High', 'C', 'Mrs Funke Adebayo', 'Monday 23 November 2026'], T4: ['Medium', 'A', 'Mrs Funke Adebayo', 'Friday 27 November 2026'],
    T5: ['High', 'D', 'Document custodian (you)', 'Monday 23 November 2026'], T6: ['Medium', 'B', 'Document custodian (you)', 'Friday 27 November 2026'],
    T7: ['High', 'C', 'Document custodian (you)', 'Monday 23 November 2026'], T11: ['Medium', 'A', 'Document custodian (you)', 'Friday 27 November 2026'],
    T12: ['Medium', 'D', 'Document custodian (you)', 'Friday 27 November 2026'], T14: ['Low', 'B', 'Document custodian (you)', 'Friday 4 December 2026'] };
  for (const [t, [risk, action, owner, due]] of Object.entries(find)) a['s4.find.' + t] = { risk, action, owner, due };
  return a;
}
