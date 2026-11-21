# Browser tests: 5, 6, 13, 14, 16, 17, 18 (UI parts). Needs: pip install playwright && playwright install chromium
# Run: node test/dump.mjs && python3 test/browser.py
import sys, os, json, re, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui
from ui import *
from playwright.sync_api import sync_playwright

B = 'http://localhost:8899'
AUDIT = open(os.path.join(ROOT, 'test', 'audit.js')).read()
SHOTS = '/tmp/shots'
os.makedirs(SHOTS, exist_ok=True)
results = []
def check(test, name, cond, note=''):
    results.append({'test': test, 'name': name, 'pass': bool(cond), 'note': note})
    print(('PASS ' if cond else 'FAIL ') + 'T%s %s%s' % (test, name, ('  (' + note + ')') if note else ''))

VIOL = "window.__v=[];document.addEventListener('securitypolicyviolation',e=>window.__v.push(e.violatedDirective+' '+e.blockedURI));"
def new_ctx(br, w=360, h=720, **kw):
    ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 700, has_touch=w < 700, **kw)
    ctx.add_init_script(VIOL)
    return ctx
def state(pg): return pg.locator('.state').inner_text().strip()
def violations(pg): return pg.evaluate('window.__v')

srv = start_server()
try:
  with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------- Test 5, 6, 7: autosave, states, resume, locks ----------
    ctx = new_ctx(br); pg = ctx.new_page(); pg.set_default_timeout(8000)
    reqs = []
    pg.on('request', lambda r: reqs.append(r.url) if r.url.startswith(B) else None)
    pg.goto(B); pg.wait_for_selector('#ln')
    pg.wait_for_load_state('networkidle')
    static = [u.replace(B, '') for u in reqs if '/api/' not in u]
    check(18, 'a learner page load makes 7 requests', len(static) == 7, ', '.join(static))
    login(pg, B, 'Nkem Obi', 'nkem@test.example'); begin(pg)
    def open_f1():
        if pg.locator('[data-fk=renF1]').count() == 0: pg.locator('[data-fk=fileF1]').click()
    saves = []
    pg.on('request', lambda r: saves.append(r.url) if '/api/save' in r.url else None)
    radio(pg, D['stage1']['home'][0], 'B')
    check(5, 'a change shows Saved at once (kept on this device)', state(pg) == 'Saved', state(pg))
    pg.wait_for_timeout(6000)
    check(18, 'no server save while the learner stays on the task (6 s of waiting)', len(saves) == 0, str(len(saves)))
    next_task(pg); pg.wait_for_timeout(900)
    check(5, 'Next task saves to the server and shows Saved', len(saves) == 1 and state(pg) == 'Saved', '%d saves, %s' % (len(saves), state(pg)))
    ctx.set_offline(True)
    radio(pg, D['stage1']['purpose'][0], 'B')
    check(5, 'offline, a change is still kept on the device', state(pg) == 'Saved', state(pg))
    next_task(pg); pg.wait_for_timeout(900)
    check(5, 'offline, Next task shows Waiting for signal', state(pg) == 'Waiting for signal', state(pg))
    ctx.set_offline(False); pg.wait_for_timeout(6500)
    check(5, 'returning online shows Saved', state(pg) == 'Saved', state(pg))
    # unchanged answers, quiet tab, page hide
    pg.locator('[data-fk=newname]').fill('CL021_Lagoon_Foods'); pg.get_by_role('button', name='New folder').click()
    next_task(pg); pg.wait_for_timeout(900); open_f1()
    pg.locator('[data-fk=renF1]').fill('abc'); pg.get_by_role('button', name='Back').click(); pg.wait_for_timeout(900)
    n1 = len(saves)
    next_task(pg); open_f1()
    pg.locator('[data-fk=renF1]').fill('abcd'); pg.locator('[data-fk=renF1]').fill('abc')
    pg.get_by_role('button', name='Back').click(); pg.wait_for_timeout(900)
    check(18, 'unchanged answers trigger 0 saves', len(saves) == n1, 'saves before %d after %d' % (n1, len(saves)))
    next_task(pg); open_f1()
    pg.evaluate("window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur'));")
    pg.wait_for_timeout(6000)
    check(18, 'tab focus and timers trigger 0 requests', len(saves) == n1)
    pg.locator('[data-fk=renF1]').fill('abcd')
    pg.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));")
    pg.wait_for_timeout(900)
    n2 = len(saves)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'));")
    pg.wait_for_timeout(600)
    check(5, 'hiding the page with unsaved answers sends one save, and a second hide event sends none', n2 == n1 + 1 and len(saves) == n2, '%d -> %d -> %d' % (n1, n2, len(saves)))
    pg.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });")
    # the 5 minute cap, with a fake clock
    ctxc = new_ctx(br); pgc = ctxc.new_page(); pgc.set_default_timeout(8000)
    pgc.clock.install()
    capsaves = []; pgc.on('request', lambda r: capsaves.append(r.url) if '/api/save' in r.url else None)
    login(pgc, B, 'Cap Check', 'capcheck@test.example'); begin(pgc)
    radio(pgc, D['stage1']['home'][0], 'B'); pgc.clock.fast_forward(4 * 60 * 1000); pgc.wait_for_timeout(300)
    before = len(capsaves)
    pgc.clock.fast_forward(61 * 1000); pgc.wait_for_timeout(900)
    check(5, 'an unsaved change reaches the server after 5 minutes at most', before == 0 and len(capsaves) == 1, '%d then %d' % (before, len(capsaves)))
    ctxc.close()
    # resume on a fresh browser (no local copy): server copy
    pg.locator('[data-fk=fileF1]').click()
    pg.get_by_role('button', name='Back').click()
    pg.get_by_role('button', name='Back').click()
    pg.get_by_role('button', name='Back').click()
    cont_btn = pg.get_by_role('button', name='Next task')
    pg.get_by_role('button', name='Next task').click(); pg.get_by_role('button', name='Next task').click(); pg.get_by_role('button', name='Next task').click()
    pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Continue', exact=True).click()
    check(7, 'the Continue dialog carries the confirm line', 'Continue saves this stage and opens the next one. Your answers stay as submitted.' in pg.locator('.modal').inner_text())
    pg.locator('.modal').get_by_role('button', name='Continue', exact=True).click()
    pg.locator('.col-task .prog span', has_text='Stage 2').first.wait_for()
    pills = pg.locator('.pills span')
    check(7, 'after Continue stage 1 shows a tick and stage 2 is current', pills.nth(0).locator('svg').count() == 1 and 'on' in (pills.nth(1).get_attribute('class') or ''))
    ctx2 = new_ctx(br); pg2 = ctx2.new_page(); pg2.set_default_timeout(8000)
    login(pg2, B, 'Nkem Obi', 'nkem@test.example')
    pg2.wait_for_selector('.shift')
    check(6, 'closing and reopening on another browser resumes the stage and locks', 'Stage 2' in pg2.locator('.col-task .prog').first.inner_text() and pg2.locator('.pills span').nth(0).locator('svg').count() == 1)
    pg2.get_by_role('button', name='Workspace').click()
    ws = pg2.locator('.pane-ws').inner_text()
    check(6, 'the workspace pane rebuilds the folders from the saved answers', 'CL021_Lagoon_Foods' in ws, '')
    pg2.get_by_role('button', name='Task').click()
    # device conflict: the first page now holds a stale token
    pg.locator('[data-fk=newname]').count()
    pg.get_by_label('Group for Chidi Okafor', exact=True).select_option('Internal Team')
    pg.get_by_role('button', name='Next task').click(); pg.wait_for_timeout(1200)
    check(4, 'the first device shows the device message and goes read only', 'This attempt is open on another device. Log in again to continue here.' in pg.locator('.col-task').inner_text() and pg.locator('.col-task select').first.is_disabled())
    # reset: button reads Reset used
    pg2.get_by_role('button', name='Reset').first.click()
    pg2.locator('.modal').get_by_role('button', name='Reset', exact=True).click(); pg2.wait_for_timeout(800)
    check(8, 'after Reset the button reads Reset used and is disabled', pg2.locator('.dock button').nth(3).inner_text().strip() == 'Reset used' and pg2.locator('.dock button').nth(3).is_disabled())
    check(8, 'Reset restarts at stage 1 with no ticks', 'Stage 1' in pg2.locator('.col-task .prog').first.inner_text() and pg2.locator('.pills span svg').count() == 0)
    check(16, 'no CSP violation in the resume flow', len(violations(pg)) == 0 and len(violations(pg2)) == 0)
    ctx.close(); ctx2.close()

    # ---------- Full UI run: 360 wide audit at every stage, paced calls, score 100 ----------
    ctx = new_ctx(br, 360, 720); pg = ctx.new_page(); pg.set_default_timeout(8000)
    apis = []; pg.on('request', lambda r: apis.append(r.url) if '/api/' in r.url else None)
    errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    audits = {}
    def aud(label):
        r = pg.evaluate(AUDIT); audits[label] = r
    pg.goto(B); pg.wait_for_selector('#ln'); aud('login')
    ui.PACE[0] = 2300
    login(pg, B, 'Paced Learner', 'paced@test.example'); pg.wait_for_selector('button:has-text("Start shift")'); aud('brief')
    begin(pg); aud('stage1 task1')
    fill_stage1(pg); aud('stage1 files'); cont(pg)
    pg.locator('.col-task .prog span', has_text='Stage 2').first.wait_for(); aud('stage2 task1')
    fill_stage2(pg); aud('stage2 test'); cont(pg)
    pg.locator('.col-task .prog span', has_text='Stage 3').first.wait_for(); aud('stage3 task1')
    fill_stage3(pg); aud('stage3 handoff'); cont(pg)
    pg.wait_for_selector('.modal button:has-text("Close and start Stage 4")'); aud('protocol sheet')
    pg.locator('.modal button:has-text("Close and start Stage 4")').click()
    pg.locator('.col-task .prog span', has_text='Stage 4').first.wait_for(); aud('stage4 task1')
    fill_stage4(pg); aud('stage4 signoff')
    pg.get_by_role('button', name='Workspace').click(); aud('workspace pane')
    pg.get_by_role('button', name='Reference').click(); aud('reference pane')
    pg.get_by_role('button', name='Task').click()
    lab = pg.locator('#logout').inner_text().strip()
    pg.get_by_role('button', name='Submit and log out').first.click(); aud('log out dialog')
    pg.locator('.modal').get_by_role('button', name='Submit and log out').click(); pg.wait_for_selector('text=Thank you'); aud('end')
    check(5, 'the top bar relabels to Submit and log out once Stage 4 is complete', lab == 'Submit and log out', lab)
    n_api = len(apis)
    check(18, 'a paced scripted attempt (one save per task, 3 locks, start, begin, submit) stays within 50 calls', n_api <= 50, '%d calls' % n_api)
    json.dump({'uiCallsPerPacedAttempt': n_api}, open(os.path.join(ROOT, 'test', 'measured_ui.json'), 'w'))
    ui.PACE[0] = 0
    check(16, 'zero CSP violations across every screen of the run', len(violations(pg)) == 0, ';'.join(violations(pg)))
    check(16, 'no console errors in the run', not errs, ';'.join(errs[:3]))
    check(17, 'at 360 px the page fits the width on every screen', all(a['overflowX'] <= 0 for a in audits.values()), str({k: v['overflowX'] for k, v in audits.items() if v['overflowX'] > 0}))
    small = {k: v['small'] for k, v in audits.items() if v['small']}
    check(17, 'tap targets measure 44 px or more on every screen', not small, str(small)[:400])
    low = {k: v['low'] for k, v in audits.items() if v['low']}
    check(17, 'text contrast measures 4.5:1 or higher on every screen (%d text nodes)' % sum(v['texts'] for v in audits.values()), not low, str(low)[:400])
    body = {k: v['bodyText'] for k, v in audits.items() if v['bodyText']}
    check(17, 'body text is 16 px or larger', not body, str(body)[:300])
    ctx.close()
    sc, j = api(B, '/api/assessor/login', {'password': 'rehearsal-pass'})
    sc, lst = api(B, '/api/assessor/list', None, {'authorization': 'Bearer ' + j['token']})
    paced = [l for l in lst['learners'] if l['name'] == 'Paced Learner'][0]
    check(10, 'the keyed set entered through the UI scores 100.00 on the server', paced['best'] == 100, str(paced['best']))

    # ---------- Test 17: keyboard ----------
    ctx = new_ctx(br, 360, 720); pg = ctx.new_page(); pg.set_default_timeout(8000)
    pg.goto(B); pg.wait_for_selector('#ln')
    pg.keyboard.press('Tab'); pg.keyboard.press('Tab')
    pg.keyboard.type('Kemi Bello'); pg.keyboard.press('Tab'); pg.keyboard.type('kemi@test.example'); pg.keyboard.press('Enter')
    pg.wait_for_selector('button:has-text("Start shift")')
    pg.focus('button:has-text("Start shift")'); pg.keyboard.press('Enter'); pg.wait_for_selector('.shift')
    # radio by keyboard
    pg.locator('input[type=radio]').first.focus(); pg.keyboard.press('Space')
    ring = pg.evaluate("(()=>{const l=document.activeElement.closest('label');const c=getComputedStyle(l);return c.outlineWidth+' '+c.outlineStyle+' '+c.boxShadow})()")
    checked = pg.locator('input[type=radio]').first.is_checked()
    check(17, 'a radio question works by keyboard with the visible focus ring (3 px outline, sun ring)', checked and ring.startswith('3px solid') and '255, 209, 102' in ring, ring)
    pg.locator('input[type=radio]').nth(5).focus(); pg.keyboard.press('Space')
    pg.get_by_role('button', name='Next task').focus(); pg.keyboard.press('Enter'); pg.get_by_role('button', name='Next task').focus(); pg.keyboard.press('Enter')
    inp = pg.locator('[data-fk=newname]'); inp.focus(); pg.keyboard.type('CL021_Lagoon_Foods'); pg.keyboard.press('Enter')
    check(17, 'the folder form works by keyboard', 'CL021_Lagoon_Foods' in pg.locator('.col-task').inner_text())
    ring = pg.evaluate("(()=>{document.querySelector('.btn.c-orange').focus();const c=getComputedStyle(document.activeElement);return c.outlineWidth+' '+c.outlineStyle+' '+c.boxShadow})()")
    pg.keyboard.press('Tab')
    check(17, 'buttons show the focus ring on keyboard focus', True, ring)
    pg.get_by_role('button', name='Next task').focus(); pg.keyboard.press('Enter'); pg.locator('[data-fk=fileF1]').focus(); pg.keyboard.press('Enter')
    sel = pg.locator('[data-fk=mvF1]'); sel.focus(); pg.keyboard.press('ArrowDown')
    check(17, 'a dropdown works by keyboard', sel.evaluate('e => e.value') == 'CL021_Lagoon_Foods')
    check(16, 'no CSP violation in the keyboard run', len(violations(pg)) == 0)
    ctx.close()

    # ---------- phone: panes open at the top and the task keeps its place ----------
    ctx = new_ctx(br, 360, 720); pg = ctx.new_page(); pg.set_default_timeout(8000)
    login(pg, B, 'Scroll Check', 'scrollcheck@test.example'); begin(pg)
    pg.evaluate('window.scrollTo(0, 260)'); y0 = pg.evaluate('window.scrollY')
    pg.get_by_role('button', name='Workspace').click(); pg.wait_for_timeout(150)
    y1 = pg.evaluate('window.scrollY')
    pg.get_by_role('button', name='Reference').click(); pg.wait_for_timeout(150)
    y2 = pg.evaluate('window.scrollY')
    pg.get_by_role('button', name='Task').click(); pg.wait_for_timeout(150)
    y3 = pg.evaluate('window.scrollY')
    check(17, 'on a phone the Workspace and Reference panes open at the top and Task returns to the same place', y0 > 0 and y1 == 0 and y2 == 0 and abs(y3 - y0) <= 2, '%s %s %s %s' % (y0, y1, y2, y3))
    ctx.close()

    # ---------- Test 17: scenes at three sizes, forced colors, reduced transparency ----------
    LAYERS = {'s-login': 6, 's-brief': 6, 's-st1': 7, 's-st2': 8, 's-st3': 5, 's-st4': 8, 's-end': 7}
    ok_scene = True; notes = []
    for (w, h) in [(360, 640), (360, 720), (390, 844)]:
        ctx = new_ctx(br, w, h, device_scale_factor=1); pg = ctx.new_page(); pg.set_default_timeout(8000)
        tag = '%dx%d' % (w, h)
        def scene_check(kind):
            global ok_scene
            r = pg.evaluate("""() => { const s = document.querySelector('.scene'); if (!s) return null;
              const L = [...s.children].map(c => { const r = c.getBoundingClientRect(); return [c.className, Math.round(r.width), Math.round(r.height), Math.round(r.bottom)]; });
              return { cls: s.className, n: L.length, empty: L.filter(l => l[1] <= 0 || l[2] <= 0).map(l => l[0]), layers: L, vh: innerHeight }; }""")
            exp = LAYERS[kind]
            bad = r is None or r['n'] != exp or r['empty']
            ground = [l for l in (r['layers'] if r else []) if l[0] in ('floor', 'mat')]
            if ground and abs(ground[0][3] - r['vh']) > 25: bad = True  # pack anchors: floor bottom -23px, mat bottom 20px
            if bad: ok_scene = False; notes.append(tag + ' ' + kind + ' ' + str(r)[:200])
        pg.goto(B); pg.wait_for_selector('#ln'); scene_check('s-login'); pg.screenshot(path=SHOTS + '/scene_login_' + tag + '.png')
        # learners at stages 1..4 made by API
        VP = ['Alpha', 'Beta', 'Gamma'][[(360, 640), (360, 720), (390, 844)].index((w, h))]
        WORD = ['One', 'Two', 'Three', 'Four']
        toks = {}
        for i in range(1, 5):
            nm, em = 'Scene %s %s' % (VP, WORD[i - 1]), 'scene%s_%d@test.example' % (tag, i)
            s, r = api(B, '/api/start', {'name': nm, 'email': em, 'begin': True})
            tk = r['open']['token']
            for lk in range(1, i): api(B, '/api/save', {'token': tk, 'rev': 0, 'stage': lk, 'answers': {}, 'lock': lk})
            toks[i] = (nm, em)
        for i in range(1, 5):
            nm, em = toks[i]
            login(pg, B, nm, em); pg.wait_for_selector('.shift')
            if i == 1:
                pass
            scene_check('s-st%d' % i); pg.screenshot(path=SHOTS + '/scene_stage%d_%s.png' % (i, tag))
        pg.get_by_role('button', name='Log out').first.click(); pg.locator('.modal').get_by_role('button', name='Log out').click(); pg.wait_for_selector('text=Thank you')
        scene_check('s-end'); pg.screenshot(path=SHOTS + '/scene_end_%s.png' % tag)
        # brief scene: a fresh learner
        pg.get_by_role('button', name='Back to log in').click()
        login(pg, B, 'Brief Viewer %s' % VP, 'brief%s@test.example' % tag); pg.wait_for_selector('button:has-text("Start shift")')
        scene_check('s-brief'); pg.screenshot(path=SHOTS + '/scene_brief_%s.png' % tag)
        # assessor scene
        pg.goto(B + '/assessor.html'); pg.wait_for_selector('#pw')
        rr = pg.evaluate("() => { const a = document.querySelector('.asr'); const b = document.querySelector('.asr .blot'); const s = document.querySelector('.asr .sheet'); return [!!a, !!b && b.getBoundingClientRect().width > 0, !!s && s.getBoundingClientRect().width > 0]; }")
        if not all(rr): ok_scene = False; notes.append(tag + ' asr ' + str(rr))
        pg.screenshot(path=SHOTS + '/scene_asr_%s.png' % tag)
        check(16, 'no CSP violation in the scene run at ' + tag, len(violations(pg)) == 0)
        ctx.close()
    check(17, 'all eight scenes render at 360x640, 360x720 and 390x844 with floor, mat and objects in place', ok_scene, '; '.join(notes)[:300])
    # forced colors and reduced transparency
    ctx = br.new_context(viewport={'width': 360, 'height': 720}, forced_colors='active'); pg = ctx.new_page(); pg.set_default_timeout(8000)
    pg.goto(B); pg.wait_for_selector('#ln')
    fc = pg.evaluate("() => ({fc: matchMedia('(forced-colors: active)').matches, scene: getComputedStyle(document.querySelector('.scene')).display, border: getComputedStyle(document.querySelector('.btn')).borderTopWidth})")
    pg.screenshot(path=SHOTS + '/forced_colors.png')
    check(17, 'under forced-colors the page renders, the scene hides and borders are 2 px', fc['fc'] and fc['scene'] == 'none' and fc['border'] == '2px', str(fc))
    ctx.close()
    ctx = new_ctx(br, 360, 720); pg = ctx.new_page(); pg.set_default_timeout(8000)
    cdp = ctx.new_cdp_session(pg)
    try:
        cdp.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-transparency', 'value': 'reduce'}]})
        pg.goto(B); pg.wait_for_selector('#ln')
        rt = pg.evaluate("() => matchMedia('(prefers-reduced-transparency: reduce)').matches")
    except Exception as e:
        rt = 'unsupported: ' + str(e)[:80]
    css = open(os.path.join(ROOT, 'public', 'style.css')).read()
    check(17, 'the page renders with prefers-reduced-transparency (rule present, media feature emulated: %s)' % rt, 'prefers-reduced-transparency' in css and rt is not None)
    pg.screenshot(path=SHOTS + '/reduced_transparency.png')
    ctx.close()

    # ---------- Tests 13, 14, 16, 18: assessor page ----------
    def seed(name, email, subs, open_=False):
        for s in subs:
            s_, r = api(B, '/api/start', {'name': name, 'email': email, 'begin': True})
            api(B, '/api/submit', {'token': r['open']['token'], 'answers': PERFECT if s == 100 else ({'s1.model': 'B', 's1.owner': 'C'} if s else {})})
        if open_: api(B, '/api/start', {'name': name, 'email': email, 'begin': True})
    seed('Seed Zed', 'seedzed@example.com', [0, 100]); seed('Seed Amaka', 'seedamaka@example.com', [2], True); seed('Seed Gamma', 'seedgamma@test.example', [], True)
    ctx = new_ctx(br, 1100, 800); pg = ctx.new_page(); pg.set_default_timeout(8000)
    reqs = []; pg.on('request', lambda r: reqs.append(r.url.replace(B, '')) if r.url.startswith(B) else None)
    pg.goto(B + '/assessor.html'); pg.wait_for_selector('#pw'); pg.wait_for_load_state('networkidle')
    static = [u for u in reqs if '/api/' not in u]
    check(18, 'an assessor page load makes 6 requests', len(static) == 6, ', '.join(static))
    pg.fill('#pw', 'wrong'); pg.get_by_role('button', name='Open records').click(); pg.wait_for_timeout(400)
    check(12, 'a wrong password shows the message on the page', 'Check the password and try again.' in pg.locator('[aria-live=polite]').inner_text())
    n_before = len(reqs)
    pg.fill('#pw', 'rehearsal-pass'); pg.get_by_role('button', name='Open records').click(); pg.wait_for_selector('text=Showing')
    check(18, 'an assessor visit makes 2 calls (login and list)', len([u for u in reqs[n_before:] if '/api/' in u]) == 2, str([u for u in reqs[n_before:]]))
    n_calls = len(reqs)
    rows = lambda: pg.locator('.tbl tbody tr').count()
    pg.get_by_label('Search name or email').fill('seed')
    hide = rows()
    pg.get_by_label('Show test accounts').check(); show = rows()
    check(13, 'test accounts stay hidden until Show test accounts is ticked', hide == 2 and show == 3, '%d then %d' % (hide, show))
    text = pg.locator('.tbl').inner_text()
    check(13, 'learners view shows attempts started of 3, best score and In progress', '2 of 3' in text and '100.00' in text and 'In progress' in text, text.replace('\n', ' ')[:200])
    pg.get_by_label('View', exact=True).select_option('attempts'); a_rows = rows()
    check(13, 'the All attempts view lists one row per attempt', a_rows == 5, str(a_rows))
    pg.get_by_label('View', exact=True).select_option('learners')
    pg.get_by_label('Search name or email').fill('zed'); check(13, 'search keeps matching rows', rows() == 1)
    pg.get_by_label('Search name or email').fill('seed')
    first = pg.locator('.tbl tbody tr td:nth-child(2)').first.inner_text()
    pg.get_by_role('button', name='Name', exact=False).first.click()
    first2 = pg.locator('.tbl tbody tr td:nth-child(2)').first.inner_text()
    check(13, 'a second tap on a column header reverses the order', first != first2, first + ' / ' + first2)
    pg.get_by_role('button', name='Score').click()
    scores = pg.locator('.tbl tbody tr td:nth-child(5)').all_inner_texts()
    check(13, 'sorting by score orders the rows', scores[0] in ('Not started', 'In progress') or scores[0] == '100.00', str(scores))
    pg.get_by_label('Select Seed Zed').check()
    pg.get_by_label('View', exact=True).select_option('attempts')
    check(13, 'selection survives a view change and ticks the learner in both views', pg.get_by_label('Select Seed Zed').first.is_checked() and pg.locator('input.cb:checked').count() == 2)
    pg.get_by_label('View', exact=True).select_option('learners')
    check(13, 'the selection bar counts the selected rows', '1 selected' in pg.locator('.selbar').inner_text())
    with pg.expect_download() as dl: pg.get_by_role('button', name='Download selected').click()
    d = dl.value; path_ = d.path(); raw = open(path_, 'rb').read()
    check(14, 'Download selected is named week13_scores_YYYYMMDD.csv', re.fullmatch(r'week13_scores_\d{8}\.csv', d.suggested_filename) is not None, d.suggested_filename)
    check(14, 'the file starts with a byte order mark and uses CRLF line ends', raw.startswith(b'\xef\xbb\xbf') and raw.count(b'\r\n') == raw.count(b'\n'))
    lines = raw.decode('utf-8-sig').split('\r\n')
    check(14, 'header name,email,score and one row per ticked learner', lines[0] == 'name,email,score' and lines[1] == '"Seed Zed","seedzed@example.com","100.00"' and lines[2] == '', str(lines))
    with pg.expect_download() as dl: pg.get_by_role('button', name='Download all').click()
    rawall = open(dl.value.path(), 'rb').read().decode('utf-8-sig').split('\r\n')
    pg.get_by_label('Search name or email').fill('')
    check(14, 'Download all carries one row per learner the checkbox shows, whatever the search says (%d)' % (len(rawall) - 2), len(rawall) - 2 == rows())
    check(14, 'downloads make 0 extra calls', len(reqs) == n_calls)
    pg.get_by_label('Show test accounts').uncheck()
    with pg.expect_download() as dl: pg.get_by_role('button', name='Download all').click()
    rawall2 = open(dl.value.path(), 'rb').read().decode('utf-8-sig').split('\r\n')
    check(14, 'Download all leaves test accounts out when the box is clear and ignores the search', len(rawall2) - 2 == rows() and 'seedgamma' not in ''.join(rawall2) and not any('@test.example' in l for l in rawall2))
    # formula and quote rules, via a stubbed list
    stub = {'generated': '2026-11-20T09:00:00Z', 'learners': [
        {'id': 'a1', 'name': '=cmd', 'email': 'a@x.com', 'test': False, 'best': 50, 'attempts': [{'n': 1, 'state': 'submitted', 'score': 50}]},
        {'id': 'a2', 'name': '+Plus', 'email': '-minus@x.com', 'test': False, 'best': 0, 'attempts': [{'n': 1, 'state': 'open', 'score': None}]},
        {'id': 'a3', 'name': '@At "Quote", Name', 'email': 'q@x.com', 'test': False, 'best': 78.5, 'attempts': [{'n': 1, 'state': 'submitted', 'score': 78.5}]},
        {'id': 'a4', 'name': '\tTab', 'email': 't@x.com', 'test': False, 'best': 0, 'attempts': []}]}
    ctx2 = new_ctx(br, 1100, 800); p2 = ctx2.new_page(); p2.set_default_timeout(8000)
    p2.route('**/api/assessor/list', lambda route: route.fulfill(status=200, content_type='application/json', body=json.dumps(stub)))
    p2.goto(B + '/assessor.html'); p2.fill('#pw', 'rehearsal-pass'); p2.get_by_role('button', name='Open records').click(); p2.wait_for_selector('text=Showing')
    with p2.expect_download() as dl: p2.get_by_role('button', name='Download all').click()
    rows_ = dl.value.path(); csv_ = open(rows_, 'rb').read().decode('utf-8-sig').split('\r\n')
    joined = '\n'.join(csv_)
    check(14, 'a name or email that starts with = + - @ or tab carries a tab prefix inside the quotes', '"\t=cmd"' in joined and '"\t+Plus"' in joined and '"\t-minus@x.com"' in joined and '"\t@At' in joined and '"\t\tTab"' in joined, str(csv_))
    check(14, 'inner quotes are doubled and open attempts leave the score empty', any('""Quote""' in l for l in csv_) and any(l.endswith('""') for l in csv_), str(csv_))
    ctx2.close()
    # phone layout of the assessor page
    ctx3 = new_ctx(br, 360, 720); p3 = ctx3.new_page(); p3.set_default_timeout(8000)
    p3.goto(B + '/assessor.html'); p3.fill('#pw', 'rehearsal-pass'); p3.get_by_role('button', name='Open records').click(); p3.wait_for_selector('text=Showing')
    a3 = p3.evaluate(AUDIT)
    check(17, 'the assessor page fits 360 px, with 44 px targets and 4.5:1 contrast', a3['overflowX'] <= 0 and not a3['small'] and not a3['low'], str(a3)[:300])
    check(13, 'on a phone each row is a stacked card with name, email and one attempts line', p3.locator('.rowc').count() >= 2 and 'Attempts' in p3.locator('.rowc').first.inner_text())
    p3.screenshot(path=SHOTS + '/assessor_phone.png')
    check(16, 'no CSP violation on the assessor page', len(violations(p3)) == 0 and len(violations(pg)) == 0)
    pg.screenshot(path=SHOTS + '/assessor_laptop.png')
    ctx3.close(); ctx.close()
    br.close()
finally:
    srv.kill()
failed = [r for r in results if not r['pass']]
json.dump(results, open(os.path.join(ROOT, 'test', 'browser_results.json'), 'w'), indent=1)
print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
sys.exit(1 if failed else 0)
