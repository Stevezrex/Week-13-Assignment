# UI driver shared by browser tests: completes every task with the keyed answers.
import json, re, subprocess, time, os, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open('/tmp/d.json'))
D, PERFECT = DATA['D'], DATA['perfect']

def start_server(port=8899):
    p = subprocess.Popen(['node', 'test/harness.mjs'], cwd=ROOT, stdout=open('/tmp/h.log', 'w'), stderr=subprocess.STDOUT)
    time.sleep(2)
    return p

def api(base, path, body=None, headers=None):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers or {}, method='POST' if body is not None else 'GET')
    try:
        r = urllib.request.urlopen(req); return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def opt_text(q, letter):
    for l, t in q['opts']:
        if l == letter: return t

def radio(page, q, letter):
    fs = page.locator('fieldset.opts', has=page.locator('legend', has_text=q['text'][:40]))
    text = opt_text(q, letter) if letter in 'ABCD' and len(letter) == 1 else letter
    fs.locator('label.opt').filter(has_text=re.compile(r'^\s*' + re.escape(text) + r'\s*$')).click()

def field(page, label, value, exact=True):
    page.get_by_label(label, exact=exact).select_option(value)

PACE = [0]
def next_task(page):
    page.get_by_role('button', name='Next task').click()
    if PACE[0]: page.wait_for_timeout(PACE[0])

def lines_card(page, folder):
    return page.locator('.fcard', has=page.locator('.mono', has_text=re.compile('^' + re.escape(folder) + '$')))

def fill_stage1(page):
    s1 = D['stage1']
    radio(page, s1['home'][0], PERFECT['s1.model']); radio(page, s1['home'][1], PERFECT['s1.owner']); next_task(page)
    radio(page, s1['purpose'][0], PERFECT['s1.purpose']); radio(page, s1['purpose'][1], PERFECT['s1.class']); next_task(page)
    for f in PERFECT['s1.tree']:
        page.locator('select[data-fk=parent]').select_option(f['parent'])
        page.locator('input[data-fk=newname]').fill(f['name'])
        page.get_by_role('button', name='New folder').click()
    next_task(page)
    for fid in [f['id'] for f in s1['files']]:
        folder, name = PERFECT['s1.files.' + fid]['folder'], PERFECT['s1.files.' + fid]['name']
        page.locator('[data-fk=file' + fid + ']').click()
        page.locator('[data-fk=mv' + fid + ']').select_option(folder)
        page.locator('[data-fk=ren' + fid + ']').fill(name)
        page.locator('[data-fk=file' + fid + ']').click()

def fill_stage2(page):
    s2 = D['stage2']
    for p in D['people']:
        field(page, 'Group for ' + p['name'], PERFECT['s2.group.' + p['key']])
    next_task(page)
    for l in PERFECT['s2.lines']:
        card = lines_card(page, l['folder'])
        card.get_by_label('Group', exact=True).select_option(l['group'])
        card.get_by_label('Level', exact=True).select_option(l['level'])
        card.get_by_role('button', name='Add access line').click()
    next_task(page)
    radio(page, s2['tempEnd'], PERFECT['s2.tempEnd']); radio(page, s2['reviewersOwner'], PERFECT['s2.reviewersOwner']); next_task(page)
    for q, k in zip(s2['links'], 'abc'): radio(page, q, PERFECT['s2.link.' + k])
    next_task(page)
    for f in s2['ext']: field(page, f['label'], PERFECT[f['id']])
    next_task(page)
    for f in s2['intake']: field(page, f['label'], PERFECT[f['id']])
    next_task(page)
    for f in s2['test']: field(page, f['label'], PERFECT[f['id']])

def fill_stage3(page):
    s3 = D['stage3']
    for v in s3['versions']: field(page, v[1], PERFECT[v[0]])
    for v in s3['statuses']: field(page, v[1], PERFECT[v[0]])
    next_task(page)
    for f in s3['comment']: field(page, f['label'], PERFECT[f['id']])
    for q in s3['approval']: radio(page, q, PERFECT[q['id']])
    next_task(page)
    for q in s3['co']: radio(page, q, PERFECT[q['id']])
    next_task(page)
    for r in s3['reg']:
        v = PERFECT['s3.reg.' + r['r']]
        page.get_by_label('Document ID for ' + r['title'], exact=True).fill(v['id'])
        card = page.locator('.fcard', has=page.locator('b', has_text=re.compile('^' + re.escape(r['title']) + '$')))
        card.get_by_label('Owner', exact=True).select_option(v['owner'])
        card.get_by_label('Status', exact=True).select_option(v['status'])
    next_task(page)
    for mid, text in s3['manifest']:
        radio(page, {'text': text, 'opts': [['A', 'Include'], ['B', 'Set aside']]}, 'Include' if PERFECT[mid] == 'Include' else 'Set aside')
    radio(page, s3['route'], PERFECT['s3.route'])
    for cid, text in s3['cls']: field(page, text, PERFECT[cid])

def fill_stage4(page):
    s4 = D['stage4']
    for t in s4['tests']:
        page.locator('[data-fk=row' + t['id'] + ']').click()
        r = PERFECT['s4.result.' + t['id']]
        page.get_by_label('Result for ' + t['id'], exact=True).select_option(r)
        if r == 'Fail':
            f = PERFECT['s4.find.' + t['id']]
            ev = page.locator('#evidence')
            ev.get_by_label('Risk', exact=True).select_option(f['risk'])
            ev.get_by_label('Corrective action', exact=True).select_option(f['action'])
            ev.get_by_label('Owner', exact=True).select_option(f['owner'])
            ev.get_by_label('Due date', exact=True).select_option(f['due'])
    page.get_by_role('button', name='Next task').click()
    for f in s4['sign']: field(page, f['label'], PERFECT[f['id']])

def login(page, base, name, email):
    page.goto(base)
    page.fill('#ln', name); page.fill('#le', email); page.get_by_role('button', name='Log in', exact=True).click()

def begin(page):
    page.get_by_role('button', name='Start shift').click()
    page.wait_for_selector('.shift')

def cont(page):
    page.get_by_role('button', name='Continue', exact=True).click()
    page.locator('.modal').get_by_role('button', name='Continue', exact=True).click()

def full_run(page, base, name, email, upto=4, submit=True):
    login(page, base, name, email); begin(page)
    fill_stage1(page); cont(page)
    if upto == 1: return
    page.locator('.col-task .prog span', has_text='Stage 2').first.wait_for()
    fill_stage2(page); cont(page)
    page.locator('.col-task .prog span', has_text='Stage 3').first.wait_for()
    fill_stage3(page); cont(page)
    page.wait_for_selector('.modal button:has-text("Close and start Stage 4")')
    page.locator('.modal button:has-text("Close and start Stage 4")').click()
    page.locator('.col-task .prog span', has_text='Stage 4').first.wait_for()
    fill_stage4(page)
    if submit:
        page.get_by_role('button', name='Submit and log out').first.click()
        page.locator('.modal').get_by_role('button', name='Submit and log out').click()
        page.wait_for_selector('text=Thank you')
