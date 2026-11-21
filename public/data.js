// Scenario text, options and accepted input lists. No keys and no marks live here.
window.W13 = (function () {
  var L = ['Viewer', 'Commenter', 'Contributor', 'Editor'];
  var GROUPS = ['Directors', 'Internal Team', 'Temporary Analysts', 'Finance', 'Client Sponsor', 'Client Reviewers'];
  var FOLDERS = ['00_Governance', '01_Client_Inputs', '02_Working_Documents', '03_Review_and_Comments',
    '04_Approved_Deliverables', '05_Decisions_and_Meeting_Records', '06_Handoff_and_Acceptance', '99_Archive'];
  var STATUSES = ['Draft', 'In review', 'Awaiting approval', 'Approved', 'Issued', 'Superseded', 'Archived'];
  var PEOPLE = [
    { key: 'adebayo', name: 'Mrs Funke Adebayo', job: 'Ireti Advisory, engagement director', needs: 'Edits governance records and decision records. Reads approved deliverables and the archive. Edits the handoff records.' },
    { key: 'okafor', name: 'Chidi Okafor', job: 'Ireti Advisory, consultant', needs: 'Reads client inputs. Edits working documents and review copies. Reads approved deliverables. Adds minutes to the decision records.' },
    { key: 'ogunleye', name: 'Seun Ogunleye', job: 'Freelance analyst, contract ends Friday 4 December 2026', needs: 'Edits working documents.' },
    { key: 'bello', name: 'Zainab Bello', job: 'Ireti Advisory, finance officer', needs: 'Reads the agreement and scope annex to check Ireti\u2019s fee invoices.' },
    { key: 'nwosu', name: 'Mr Emeka Nwosu', job: 'Lagoon Foods, operations director and client sponsor. Account emeka.nwosu@lagoonfoods.example, as written in the engagement letter', needs: 'Adds Lagoon Foods files for the project. Reads approved deliverables. Adds the acceptance record at handoff. The agreement lets Lagoon Foods keep copies of approved deliverables.' },
    { key: 'eze', name: 'Ngozi Eze', job: 'Lagoon Foods, procurement officer and client reviewer', needs: 'Comments on the review copy.' },
    { key: 'bakare', name: 'Tunde Bakare', job: 'Lagoon Foods, quality manager and client reviewer', needs: 'Comments on the review copy.' }
  ];
  var OWNERS7 = PEOPLE.map(function (p) { return p.name; });

  function q(id, text, opts) { return { id: id, text: text, opts: opts }; }
  function o(a) { return a.map(function (t, i) { return [String.fromCharCode(65 + i), t]; }); }

  var T = [
    ['T1', 'Ownership', 'Does the workspace belong to the organization under a named business owner?'],
    ['T2', 'Purpose and classification', 'Does a README state the purpose and the classification?'],
    ['T3', 'Folder design', 'Does the workspace follow the standard folder design with audiences separated?'],
    ['T4', 'Current membership', 'Does the member list match the people who work on the project today?'],
    ['T5', 'Effective access', 'Does a test account see only what its role needs?'],
    ['T6', 'External users', 'Does every guest hold a reason, a level and an expiry or review date?'],
    ['T7', 'Sharing links', 'Do links open to named people at the lowest level the task needs?'],
    ['T8', 'Sensitive folders', 'Has a test account confirmed that 00_Governance reaches only the audiences that need it?'],
    ['T9', 'Upload intake', 'Does file intake have a destination, a confirmed submitter and an end date?'],
    ['T10', 'Coauthoring', 'Has a shared edit been tested with attribution?'],
    ['T11', 'Version control', 'Does each document have one current version with an approval record?'],
    ['T12', 'Document register', 'Does the register match the files?'],
    ['T13', 'Handoff readiness', 'Is the handoff package ready?'],
    ['T14', 'Audit evidence', 'Does the last audit record hold a reviewer, a date and findings?']
  ].map(function (t) { return { id: t[0], name: t[1], q: t[2] }; });

  var EVIDENCE = {
    T1: { text: ['Workspace settings.', 'Home: personal drive of Bola Adekunle, created Wednesday 12 August 2026.', 'Business owner field: blank.', 'Organization admin field: blank.'] },
    T2: { text: ['README at the project root, updated Monday 10 August 2026.', 'Purpose: Cost review for Sahel Textiles, Kano.', 'Classification: Confidential client material.'] },
    T3: { text: ['Folder tree with the eight standard folders under PRJ02_Cost_Review.', 'Client facing and internal audiences hold separate access lines.'] },
    T4: { text: ['Members table of 8, with last review Monday 10 August 2026. The milestone review of Friday 30 October 2026 is blank.'],
      table: { head: ['Member', 'Group', 'Status shown'], rows: [
        ['Mrs Funke Adebayo', 'Directors', 'Active'], ['Chidi Okafor', 'Internal Team', 'Active'],
        ['Bola Adekunle', 'Internal Team', 'Left Ireti on Friday 6 November 2026'],
        ['Amaka Dike', 'Temporary Analysts', 'Contract ended Friday 30 October 2026'],
        ['Zainab Bello', 'Finance', 'Active'], ['Mr Ibrahim Sani', 'Client Sponsor', 'Active'],
        ['Mrs Hauwa Musa', 'Client Reviewers', 'Active'], ['Mr Yusuf Garba', 'Client Reviewers', 'Active']] } },
    T5: { text: ['Test account: Client Reviewer. Intended access: 03_Review_and_Comments at Commenter.'],
      table: { head: ['Folder', 'Result shown'], rows: [
        ['00_Governance', 'Opens at Viewer'], ['03_Review_and_Comments', 'Opens at Commenter'], ['04_Approved_Deliverables', 'Opens at Viewer']] },
      after: 'Cause shown under the table: a Viewer line for Client Reviewers on the project folder PRJ02_Cost_Review passes to every folder inside it.' },
    T6: { text: ['Guest list of 4.'],
      table: { head: ['Guest', 'Organization', 'Level', 'Reason', 'Expiry or review'], rows: [
        ['Mr Ibrahim Sani', 'Sahel Textiles', 'Viewer', 'Reads approved deliverables', 'Blank'],
        ['Mrs Hauwa Musa', 'Sahel Textiles', 'Commenter', 'Comments on the review copy', 'Blank'],
        ['Mr Yusuf Garba', 'Sahel Textiles', 'Commenter', 'Comments on the review copy', 'Blank'],
        ['Mr K. Sule', 'Blank', 'Editor', 'Blank', 'Blank']] } },
    T7: { text: ['Link on 03_Review_and_Comments: Anyone with the link, Editor level, created Wednesday 14 October 2026, expiry field blank.'] },
    T8: { text: ['Test log for 00_Governance: 0 test runs recorded.'] },
    T9: { text: ['File request: destination 01_Client_Inputs.', 'Submitter confirmed by a call from Chidi Okafor on Tuesday 3 November 2026.', 'Link ends Friday 27 November 2026.'] },
    T10: { text: ['Recorded test edit, Thursday 22 October 2026: Chidi Okafor and Amaka Dike edited different sections of one working draft at the same time.', 'Both edits saved and each carries its author name.'] },
    T11: { text: ['Folder listing, 04_Approved_Deliverables.'],
      table: { head: ['File', 'Approval record'], rows: [
        ['CL008_PRJ02_CostReview_RPT_20261016_v1.0_APPROVED.pdf', 'Mrs Funke Adebayo, Friday 16 October 2026'],
        ['CL008_PRJ02_CostReview_RPT_20261019_v1.0_FINAL.pdf', 'Blank']] } },
    T12: { text: ['Register extract. 12 rows. Owner blank on three rows and version different from the file on two rows.'],
      table: { head: ['Row ID', 'Document', 'Owner', 'Version in register', 'Version on file'], rows: [
        ['CL008_PRJ02_RPT_001', 'Cost review report', 'Mrs Funke Adebayo', 'v0.9', 'v1.0'],
        ['CL008_PRJ02_RPT_002', 'Supplier cost workbook', 'Blank', 'v1.0', 'v1.0'],
        ['CL008_PRJ02_MIN_002', 'Weekly minutes, 9 October', 'Chidi Okafor', 'v1.0', 'v0.1'],
        ['CL008_PRJ02_MIN_003', 'Weekly minutes, 16 October', 'Blank', 'v0.1', 'v0.1'],
        ['CL008_PRJ02_SOP_001', 'Cost approval procedure', 'Blank', 'v1.0', 'v1.0']] },
      after: 'The other seven rows are complete and match their files.' },
    T13: { text: ['Handoff package: assembly planned for Monday 30 November 2026.', 'Manifest: planned.', 'Handoff Friday 4 December 2026.'] },
    T14: { text: ['Previous audit record, Monday 10 August 2026.', 'Reviewer: blank.', 'Date: blank.', 'Findings: blank.'] }
  };

  // Corrective actions. Letters carry no meaning to the learner.
  var ACTIONS = {
    T1: ['Rename the workspace folder.', 'Ask Bola to share the personal drive with the team.', 'Move the workspace into an Ireti team workspace under the engagement director and record the business owner.', 'Transfer ownership to Chidi\u2019s personal drive.'],
    T2: ['Rewrite the README with a new purpose line.', 'Move the README into 99_Archive.', 'Change the classification label to Public.', 'Delete the README.'],
    T3: ['Merge the eight folders into one folder.', 'Rename the project folder.', 'Give both audiences the Editor level on every folder.', 'Add a ninth folder for each client contact.'],
    T4: ['Remove Bola Adekunle and Amaka Dike, then record a membership review with the date and the reviewer.', 'Rename the groups.', 'Remove Bola Adekunle only.', 'Add every Ireti staff member to the Directors group.'],
    T5: ['Email the reviewers a list of the folders to open.', 'Give Client Reviewers the Editor level on the project folder.', 'Remove the Viewer line from the project folder only.', 'Remove the Viewer line from the project folder, add lines to the folders each audience needs, then run the test account again.'],
    T6: ['Raise every guest to the Editor level.', 'Record a reason and a review date for every guest, and close Mr K. Sule\u2019s access until Mrs Adebayo confirms who he is.', 'Move the guests into the Internal Team group.', 'Record a reason and a review date for the three Sahel Textiles guests.'],
    T7: ['Copy the link into the register.', 'Lower the Anyone link to the Viewer level.', 'Switch the link to Restricted for named accounts at the Commenter level, and record the change.', 'Extend the link to the whole project folder.'],
    T8: ['Remove the 00_Governance folder.', 'Give the client sponsor the Viewer level on 00_Governance.', 'Record a Pass without running a test.', 'Rename 00_Governance.'],
    T9: ['Delete the file request link.', 'Change the destination to 04_Approved_Deliverables.', 'Open the link to anyone with no end date.', 'Ask Chidi to confirm the sender again.'],
    T10: ['Stop shared editing.', 'Ask both editors to work on private copies.', 'Rename the draft FINAL.', 'Test a shared edit again on a new draft.'],
    T11: ['Confirm the approved file with Mrs Adebayo, set the other file to Superseded and move it to 99_Archive.', 'Move both files to 02_Working_Documents.', 'Rename the FINAL file to v1.1.', 'Delete the approved file and keep the FINAL file.'],
    T12: ['Sort the register by date.', 'Change the file versions to match the register.', 'Fill the three owner fields.', 'Fill the three owner fields, match the two versions to their files and add a register check at each milestone.'],
    T13: ['Send the package to Mr Sani by email.', 'Finish the manifest before the package is assembled.', 'Transfer ownership of the workspace to Sahel Textiles.', 'Skip the handoff.'],
    T14: ['Add a cover page to the record.', 'Complete the record with the reviewer, the date and the findings, then file it in 00_Governance.', 'Add the reviewer\u2019s name only.', 'Backdate the record to August with a reviewer\u2019s name.']
  };

  return {
    groups: GROUPS, folders: FOLDERS, levels: L, statuses: STATUSES, people: PEOPLE, owners7: OWNERS7,
    stages: [
      { n: 1, name: 'Structure', minutes: 25, color: 'c-orange' },
      { n: 2, name: 'Access', minutes: 25, color: 'c-violet' },
      { n: 3, name: 'Practice', minutes: 20, color: 'c-teal' },
      { n: 4, name: 'Audit', minutes: 30, color: 'c-lime' }
    ],
    brief: {
      from: 'Mrs Funke Adebayo',
      body: 'Good morning. Ireti Advisory has won a supplier review for Lagoon Foods Ltd in Ikeja. The project starts this week and ends on Friday 18 December 2026. You are the document custodian for this project. Please set up a workspace that answers where, which and who for every file: where the authoritative file is, which version is current, and who may change, approve or issue it. When it is ready, please run our workspace check on the Sahel Textiles workspace that Bola left behind. I want to use it as our model. Thank you. Funke',
      dates: [
        ['Friday 20 November 2026', 'Today'],
        ['Friday 27 November 2026', 'Lagoon Foods data collection ends. Client review of the report ends'],
        ['Friday 4 December 2026', 'Seun Ogunleye\u2019s contract ends. Sahel Textiles handoff'],
        ['Friday 18 December 2026', 'Lagoon Foods project ends and the handoff is accepted']
      ]
    },
    stage1: {
      home: [
        q('s1.model', 'Where should the Lagoon Foods project files live?', o(['An individual drive, such as a personal My Drive or OneDrive.', 'A project or client workspace owned by the team, such as a shared drive or a SharePoint site.', 'A published repository for approved public material.', 'Chat threads and email attachments.'])),
        q('s1.owner', 'Who owns the workspace?', o(['Your personal account.', 'Chidi\u2019s personal account.', 'Ireti Advisory, as a team workspace under the engagement director.', 'Mr Nwosu\u2019s account at Lagoon Foods.']))
      ],
      purpose: [
        q('s1.purpose', 'Which purpose line goes on the workspace?', o(['Files for every Ireti client.', 'Every file for the Lagoon Foods supplier review, from client inputs to handoff.', 'Anything the team might need.'])),
        q('s1.class', 'Which classification label fits?', o(['Public.', 'Internal.', 'Confidential client material.']))
      ],
      treeBrief: {
        client: 'CL021, Lagoon Foods', project: 'PRJ01, Supplier Review',
        areas: ['Governance', 'Client inputs', 'Working documents', 'Review and comments', 'Approved deliverables', 'Decisions and meeting records', 'Handoff and acceptance', 'Archive']
      },
      files: [
        { id: 'F1', messy: 'engagement letter signed.pdf', saved: '2 Nov 2026', ver: 'v1.0', status: 'Approved', by: 'Mrs Funke Adebayo' },
        { id: 'F2', messy: 'scope annex.docx', saved: '2 Nov 2026', ver: 'v1.0', status: 'Approved', by: 'Mrs Funke Adebayo' },
        { id: 'F3', messy: 'october invoices sample.pdf', saved: '5 Nov 2026', ver: 'v1.0', status: 'Issued', by: 'Mr Emeka Nwosu' },
        { id: 'F4', messy: 'supplier onboarding steps.pdf', saved: '5 Nov 2026', ver: 'v2.3', status: 'Issued', by: 'Mr Emeka Nwosu' },
        { id: 'F5', messy: 'supplier review draft 2.docx', saved: '17 Nov 2026', ver: 'v0.2', status: 'Draft', by: 'Chidi Okafor' },
        { id: 'F6', messy: 'supplier review draft 1.docx', saved: '12 Nov 2026', ver: 'v0.1', status: 'Superseded', by: 'Chidi Okafor' },
        { id: 'F7', messy: 'review copy for Lagoon.pdf', saved: '18 Nov 2026', ver: 'v0.2', status: 'In review', by: 'Chidi Okafor' },
        { id: 'F8', messy: 'kick off meeting.docx', saved: '4 Nov 2026', ver: 'v1.0', status: 'Approved', by: 'Chidi Okafor' },
        { id: 'F9', messy: 'weekly meeting 13 Nov.docx', saved: '13 Nov 2026', ver: 'v0.1', status: 'Draft', by: 'Chidi Okafor' },
        { id: 'F10', messy: 'goods receipt steps draft.docx', saved: '10 Nov 2026', ver: 'v0.1', status: 'Draft', by: 'Seun Ogunleye' }
      ]
    },
    stage2: {
      tempEnd: q('s2.tempEnd', 'The Temporary Analysts group ends on', o(['Friday 27 November 2026.', 'Friday 4 December 2026.', 'Friday 18 December 2026.', 'Open until removed.'])),
      reviewersOwner: q('s2.reviewersOwner', 'The owner of the Client Reviewers group is', o(['Mrs Funke Adebayo.', 'Ngozi Eze.', 'Seun Ogunleye.', 'Zainab Bello.'])),
      links: [
        q('s2.link.a', 'Mr Nwosu needs to read the approved report. His address is on the engagement letter.', o(['Anyone with the link.', 'Restricted to his named account.', 'Organization only.', 'People with existing access.'])),
        q('s2.link.b', 'Chidi asks for a link to a working draft in the project chat. Seun already has access to that folder.', o(['People with existing access.', 'Anyone with the link.', 'Organization only.', 'Restricted to a new named guest.'])),
        q('s2.link.c', 'A message from a new address says: \u201CPlease send me a quick link to the report.\u201D It claims to be Ngozi Eze.', o(['Send an Anyone link so she opens it quickly.', 'Share to the new address.', 'Share to the old address and the new address.', 'Confirm the address with Ngozi through a second channel, then share to her named account.']))
      ],
      ext: [
        { id: 's2.ext.account', label: 'Exact account', opts: o(['emeka.nwosu@lagoonfoods.example', 'emeka.nwosu@lagoonfood.example', 'enwosu@lagoonfoods.example']) },
        { id: 's2.ext.level', label: 'Level', opts: o(['Viewer', 'Commenter', 'Editor']) },
        { id: 's2.ext.review', label: 'Expiry or review date', opts: o(['Friday 27 November 2026', 'Friday 18 December 2026', 'Open until removed']) },
        { id: 's2.ext.reshare', label: 'Resharing', opts: o(['Resharing on', 'Resharing off']) },
        { id: 's2.ext.download', label: 'Download', opts: o(['Download on', 'Download off']) }
      ],
      intake: [
        { id: 's2.intake.folder', label: 'Destination folder', opts: FOLDERS.map(function (f) { return [f, f]; }) },
        { id: 's2.intake.check', label: 'Submitter check', opts: o(['Take the name typed on the form as proof.', 'Confirm the sender through an approved channel, then move the files into the workspace.', 'Accept any file from anyone with the link.']) },
        { id: 's2.intake.end', label: 'The link ends on', opts: o(['Friday 27 November 2026', 'Friday 18 December 2026', 'Open until removed']) }
      ],
      test: [
        { id: 's2.test.account', label: 'Account tested', opts: o(['Directors', 'Internal Team', 'Client Reviewers']) },
        { id: 's2.test.folder', label: 'Folder tested', opts: o(['00_Governance', '03_Review_and_Comments', '04_Approved_Deliverables']) }
      ]
    },
    stage3: {
      versions: [
        ['s3.ver.e1', 'Chidi revises the report after the internal review. It was v0.1.'],
        ['s3.ver.e2', 'Chidi revises the review copy after the Lagoon Foods comments. It was v0.2.'],
        ['s3.ver.e3', 'Mrs Adebayo approves the report. This is the first approved issue. It was v0.3.'],
        ['s3.ver.e4', 'A label in a table is corrected after approval. The scope stays as agreed. It was v1.0.'],
        ['s3.ver.e5', 'A second phase adds a new supplier group to the scope. It was v1.1.']
      ],
      versionOpts: ['v0.1', 'v0.2', 'v0.3', 'v0.4', 'v1.0', 'v1.1', 'v2.0', 'v2.1'],
      statuses: [
        ['s3.status.s1', 'Chidi\u2019s working draft v0.2 sits in 02_Working_Documents.'],
        ['s3.status.s2', 'The review copy is with Ngozi and Tunde for comments.'],
        ['s3.status.s3', 'All comments are resolved. The report waits for Mrs Adebayo\u2019s decision.'],
        ['s3.status.s4', 'Report v1.0 went to Mr Nwosu and the transmittal is recorded.'],
        ['s3.status.s5', 'Version v1.1 replaced v1.0 as the current report. What does v1.0 carry?']
      ],
      commentQuote: 'Page 4 needs checking.',
      comment: [
        { id: 's3.comment.issue', label: 'Issue', opts: o(['Page 4 needs checking.', 'The report needs another look.', 'Page 4 cites 2025 delivery costs beside a table labelled 2024.']) },
        { id: 's3.comment.reason', label: 'Reason', opts: o(['A reader may compare costs from two different years.', 'The page layout feels crowded.', 'The font differs from page 3.']) },
        { id: 's3.comment.action', label: 'Action', opts: o(['Rewrite the whole report.', 'Check the source figures and correct the table or its label.', 'Delete page 4.']) },
        { id: 's3.comment.owner', label: 'Owner', opts: o(['Ngozi Eze', 'Mrs Funke Adebayo', 'Chidi Okafor']) },
        { id: 's3.comment.due', label: 'Due date', opts: o(['Friday 18 December 2026', 'Wednesday 25 November 2026', 'Friday 4 December 2026']) }
      ],
      approvalQuote: 'All comments are resolved, so the report is approved.',
      approval: [
        q('s3.approval.basis', 'What makes v1.0 approved?', o(['All comments are resolved.', 'Two reviewers have opened the file.', 'Mrs Adebayo, as the authorized approver, accepts the version.'])),
        q('s3.approval.separate', 'Resolving comments and giving approval are', o(['One event, recorded once.', 'Two events, each recorded on its own.', 'The same as issuing the report.'])),
        q('s3.approval.record', 'The approval record states', o(['The approver\u2019s name, the date, the document ID, the version and the scope approved.', 'The number of comments resolved.', 'The size of the file.']))
      ],
      co: [
        q('s3.co.a', 'Chidi and Seun both need to write in the supplier review report this afternoon.', o(['Each person works on a private copy and they merge the copies at the end.', 'One shared file. Sections are assigned first and comments attach to the text they concern.', 'The file travels by email between them.'])),
        q('s3.co.b', 'Seun sees a message saying he needs access to the shared report. What does the custodian check first?', o(['Send him an Anyone link.', 'Copy the file to his personal drive.', 'His workspace membership and permission level.'])),
        q('s3.co.c', 'Two edited versions of the same report exist after both people worked offline.', o(['Keep both, compare them, combine them into one controlled version, record the decision and tell the collaborators.', 'Keep the newer file and delete the other.', 'Rename both files FINAL.']))
      ],
      reg: [
        { r: 'R1', title: 'Engagement letter', file: 'F1' }, { r: 'R2', title: 'Scope annex', file: 'F2' },
        { r: 'R3', title: 'Kickoff minutes', file: 'F8' }, { r: 'R4', title: 'Weekly minutes, 13 November', file: 'F9' },
        { r: 'R5', title: 'Supplier review report, review copy', file: 'F7' },
        { r: 'R6', title: 'Supplier onboarding procedure (Lagoon Foods document)', file: 'F4' }
      ],
      manifest: [
        ['s3.man.m5', 'Supplier review report v0.2, superseded draft'],
        ['s3.man.m1', 'Supplier review report v1.0, approved PDF'],
        ['s3.man.m7', 'Chidi\u2019s rough notes'],
        ['s3.man.m3', 'Handoff summary'],
        ['s3.man.m8', 'Temporary finance export'],
        ['s3.man.m2', 'Supplier scoring workbook, final'],
        ['s3.man.m6', 'Review copy with Lagoon Foods comments'],
        ['s3.man.m4', 'Open actions list']
      ],
      route: q('s3.route', 'How does Lagoon Foods receive the approved deliverables?', o(['Ownership of the whole project folder moves to Mr Nwosu\u2019s account.', 'Copies go into Lagoon Foods\u2019 own workspace, with named view access to the approved deliverables for a set transition period.', 'Every file goes by email and the project folder closes.'])),
      cls: [
        ['s3.cls.c1', 'Mr Nwosu signs that the handoff package meets the scope annex.'],
        ['s3.cls.c2', 'Lagoon Foods confirms the copies reached its own workspace.'],
        ['s3.cls.c3', 'Lagoon Foods keeps the copies as its own files.'],
        ['s3.cls.c4', 'Mr Nwosu\u2019s named account holds view access to 04_Approved_Deliverables until a set date.']
      ],
      clsOpts: ['Acceptance', 'Receipt', 'Ownership transfer', 'Access transfer']
    },
    stage4: {
      message: 'Bola Adekunle left Ireti on 6 November 2026. Please run our workspace check on CL008_Sahel_Textiles / PRJ02_Cost_Review in Kano. Record a result for each of the 14 tests. Write a finding for each fail.',
      facts: 'Client Sahel Textiles, Kano. Project PRJ02 Cost Review. Built and run by Bola Adekunle, former document controller, who left Ireti on Friday 6 November 2026. Handoff to Sahel Textiles on Friday 4 December 2026. Today is Friday 20 November 2026. You are the document custodian.',
      results: ['Pass', 'Fail', 'Not tested'],
      resultMeaning: [['Pass', 'The evidence meets the test'], ['Fail', 'The evidence shows a gap'], ['Not tested', 'The test waits for evidence that arrives later']],
      tests: T, evidence: EVIDENCE, actions: ACTIONS,
      risks: ['High', 'Medium', 'Low'],
      owners: ['Mrs Funke Adebayo', 'Chidi Okafor', 'Zainab Bello', 'Document custodian (you)'],
      dues: ['Monday 23 November 2026', 'Friday 27 November 2026', 'Friday 4 December 2026', 'Friday 18 December 2026'],
      sign: [
        { id: 's4.sign.reviewer', label: 'Reviewer', opts: o(['Mrs Funke Adebayo', 'Chidi Okafor', 'Document custodian (you)']) },
        { id: 's4.sign.date', label: 'Date of this audit', opts: o(['Monday 10 August 2026', 'Friday 20 November 2026', 'Friday 4 December 2026']) }
      ]
    },
    // Reference pane: the file protocol as drawn cards.
    ref: {
      cards: [
        { h: '1 Folder rule', p: ['The root folder CLIENTS holds one client folder per client, then one project folder per project, then eight numbered folders.', 'Words in a name are joined by underscores. Numbers use two digits and run in order from 00. The archive is 99.'],
          kv: [['Client folder pattern', 'CL021_Lagoon_Foods'], ['Project folder pattern', 'PRJ01_Supplier_Review']],
          list: ['Governance', 'Client inputs', 'Working documents', 'Review and comments', 'Approved deliverables', 'Decisions and meeting records', 'Handoff and acceptance', 'Archive'], listLabel: 'The eight folders in order' },
        { h: '2 Name rule', p: ['Client, project, subject, type, date, version, status, then the extension. Subject and type may swap places.', 'Type uses the agreed abbreviations: MIN minutes, RPT report, AGR agreement, INV invoice, SOP procedure. The date is YYYYMMDD.', 'The version is v0.1 to v0.9 for drafts, v1.0 for the first approved issue, v1.1 for a small approved change and v2.0 for a major revision.', 'The status is a capital word: DRAFT, REVIEW, AWAITING, APPROVED, ISSUED or SUPERSEDED. Names use plain words about the document, such as the subject and the type.'],
          kv: [['Specimen from another project', 'CL014_PRJ01_ProcessReview_Report_20261116_v1.0_APPROVED.pdf']] },
        { h: '3 Statuses', p: ['Draft, In review, Awaiting approval, Approved, Issued, Superseded, Archived.', 'Version says which revision. Status says where the document stands.'] },
        { h: '4 Permission ladder', p: ['Role names differ by product, so the panel shows the permission set each level carries in this workspace.'],
          table: { head: ['Level', 'Can do', 'Product names'], rows: [
            ['Closed', 'The folder stays closed to the group', 'Private folder'],
            ['Viewer', 'View', 'Google: Viewer. Microsoft: Visitors, Read'],
            ['Commenter', 'View and comment', 'Google: Commenter'],
            ['Contributor', 'View, comment and add files', 'Google shared drives: Contributor. Microsoft: Contribute'],
            ['Editor', 'View, comment, add and change files', 'Google: Editor. Microsoft: Members, Edit'],
            ['Owner or admin', 'Everything above and manage access', 'Google shared drives: Manager. Microsoft: Owners, Full Control']] } },
        { h: '5 Link types', table: { head: ['Link type', 'Meaning', 'Product names'], rows: [
            ['Restricted', 'Named people only', 'Google: Restricted. Microsoft: Specific people'],
            ['Organization only', 'Members of the organization, signed in', 'Google: Your organization (work or school accounts). Microsoft: People in your organization'],
            ['Anyone with the link', 'Whoever holds the link, signed in or signed out', 'Google: Anyone with the link. Microsoft: Anyone'],
            ['People with existing access', 'The link opens for people who already hold access', 'The panel shows the meaning']] } },
        { h: '6 Classification labels', list: ['Public', 'Internal', 'Confidential client material'] },
        { h: '7 Register fields', p: ['Four groups of fields. Document ID pattern: CL021_PRJ01_TYPE_NNN, with the type code and a three digit sequence.'],
          kv: [['Identify', 'Document ID, title, type'], ['Responsibility', 'Owner'], ['Control', 'Version, status'], ['Handling', 'Classification, location']] },
        { h: '8 Three moments for every share', kv: [['Before', 'Confirm the file and its current approved version.'], ['Choose', 'The narrowest item, the lowest level the task needs, a named or restricted link, an expiry or review date.'], ['After', 'Record the share.']] },
        { h: '9 Group owners', p: ['Every group has an owner. The engagement director owns every group and reviews its membership at each project milestone.'] }
      ]
    },
    msg: {
      device: 'This attempt is open on another device. Log in again to continue here.',
      confirm: 'Continue saves this stage and opens the next one. Your answers stay as submitted.'
    }
  };
})();
