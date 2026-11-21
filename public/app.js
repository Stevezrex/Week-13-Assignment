(function () {
'use strict';
const week = 13;
const title = 'Week 13: Cloud files and collaborative work';
const minutes = null;      // no deadline
const marking = 'server';
var D = window.W13;
var app = document.getElementById('app');
var sceneHost = document.getElementById('scene-host');
var MAXA = 3;
var TOTAL_ITEMS = 94;

// ---------- small DOM helpers ----------
function h(tag, a) {
  var el = document.createElement(tag);
  a = a || {};
  Object.keys(a).forEach(function (k) {
    var v = a[k];
    if (v == null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
  return el;
}
function add(el, k) {
  if (k == null || k === false) return;
  if (Array.isArray(k)) { k.forEach(function (x) { add(el, x); }); return; }
  el.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
}
function icon(name) {
  var ns = 'http://www.w3.org/2000/svg';
  var s = document.createElementNS(ns, 'svg'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
  var u = document.createElementNS(ns, 'use'); u.setAttribute('href', 'img/sprite.svg#i-' + name);
  s.appendChild(u); return s;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
var uid = 0;
function nid(p) { uid += 1; return (p || 'x') + uid; }

// ---------- state ----------
function freshState() {
  return {
  screen: 'login', name: '', email: '', token: null, learnerId: null, n: 0, attemptsUsed: 0, endMsg: '',
  A: {}, rev: 0, stage: 1, locked: [], resetUsed: false,
  view: 'task', task: { 1: 0, 2: 0, 3: 0, 4: 0 }, ui: {}, save: 'saved', readonly: false
  };
}
var S = freshState();
var els = {};

function stageOf(id) { return Number(id.charAt(1)); }
function get(id) { return S.A[id]; }
function set(id, v) {
  if (S.readonly || S.locked.indexOf(stageOf(id)) >= 0) return;
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) delete S.A[id]; else S.A[id] = v;
  changed();
}

// ---------- API and autosave ----------
function api(path, body) {
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }, function () { return { status: r.status, j: {} }; }); },
      function () { return { net: true }; });
}
// A change is kept on this device at once. The server copy follows at the next task change, when the page is hidden,
// at Continue and log out, and at the latest CAP_MS after the first unsaved change.
var CAP_MS = 5 * 60 * 1000;
var timer = null, quick = null, inflight = false, queued = false, lastSaved = '{}', retryIdx = 0, retryTimer = null, beaconed = '';
var RETRY = [5000, 10000, 20000, 30000];
function stopTimers() { clearTimeout(timer); timer = null; clearTimeout(quick); quick = null; clearTimeout(retryTimer); }

function localKey() { return 'w13:' + S.learnerId + ':' + S.n; }
function writeLocal(dirty) {
  try { localStorage.setItem(localKey(), JSON.stringify({ rev: S.rev, answers: S.A, stage: S.stage, locked: S.locked, dirty: dirty })); return true; } catch { return false; /* page works from memory */ }
}
function readLocal() {
  try { var r = localStorage.getItem(localKey()); return r ? JSON.parse(r) : null; } catch { return null; }
}
function dropLocal() { try { localStorage.removeItem(localKey()); } catch { /* ignore */ } }

function setSave(state) { S.save = state; renderState(); }
function changed() {
  var kept = writeLocal(true);
  if (!timer) timer = setTimeout(flush, CAP_MS);
  if (!kept) { clearTimeout(quick); quick = setTimeout(flush, 2000); setSave('saving'); }   // no copy on this device: save soon
  else if (!inflight && S.save !== 'waiting') setSave('saved');
  refreshLive();
}
function flush() {
  stopTimers();
  if (S.readonly || !S.token) return;
  if (inflight) { queued = true; return; }
  var snap = JSON.stringify(S.A);
  if (snap === lastSaved) { writeLocal(false); setSave('saved'); return; }
  inflight = true; setSave('saving');
  api('/api/save', { token: S.token, rev: S.rev, stage: S.stage, answers: S.A }).then(function (r) {
    inflight = false;
    if (r.net || r.status >= 500) { setSave('waiting'); var d = RETRY[Math.min(retryIdx, RETRY.length - 1)] || 30000; retryIdx += 1; retryTimer = setTimeout(flush, d); return; }
    if (r.status === 409 && r.j && r.j.reason === 'device') { goReadonly(); return; }
    if (r.status !== 200) { setSave('waiting'); retryTimer = setTimeout(flush, 30000); return; }
    retryIdx = 0; S.rev = r.j.rev; lastSaved = snap;
    var moved = JSON.stringify(S.A) !== snap;
    if (queued) { queued = false; if (moved) { flush(); return; } }
    if (moved) { timer = setTimeout(flush, CAP_MS); setSave('saved'); return; }   // changed during the request
    writeLocal(false); setSave('saved');
  });
}
// Leaving the page: visibilitychange to hidden is the reliable moment on phones. A beacon is queued by the browser even as the page goes.
function flushOnHide() {
  if (S.screen !== 'shift' || S.readonly || !S.token) return;
  var snap = JSON.stringify(S.A);
  if (snap === lastSaved || snap === beaconed) return;
  var body = JSON.stringify({ token: S.token, rev: S.rev, stage: S.stage, answers: S.A }), sent = false;
  try { sent = navigator.sendBeacon('/api/save', new Blob([body], { type: 'text/plain' })); } catch { /* falls back to fetch */ }
  if (!sent) { try { fetch('/api/save', { method: 'POST', body: body, keepalive: true }); sent = true; } catch { /* the copy on this device holds it */ } }
  if (sent) beaconed = snap;
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushOnHide(); });
window.addEventListener('pagehide', flushOnHide);
window.addEventListener('online', function () { if (S.save === 'waiting') { retryIdx = 0; flush(); } });

function goReadonly() {
  S.readonly = true; S.save = 'saved'; render();
}

// ---------- scenes ----------
var SCENES = {
  login: ['s-login', [['i', 'wall'], ['i', 'glass'], ['b', 'plate', 'Ireti Advisory'], ['i', 'floor'], ['i', 'haze'], ['i', 'base']]],
  brief: ['s-brief wood', [['i', 'phone'], ['i', 'bub b1'], ['i', 'bub me b2'], ['i', 'bub b3'], ['i', 'clip'], ['i', 'mug']]],
  st1: ['s-st1 wood', [['i', 'f f1'], ['i', 'f f2'], ['i', 'f f3'], ['b', 'tag', 'CL021_PRJ01'], ['i', 'doc d1', 'PDF'], ['i', 'doc d2', 'DOCX'], ['i', 'doc d3', 'PDF']]],
  st2: ['s-st2', [['i', 'shelf sh1'], ['i', 'shelf sh2'], ['i', 'shelf sh3'], ['i', 'pane'], ['i', 'key'], ['b', 'role r1', 'Viewer'], ['b', 'role r2', 'Commenter'], ['b', 'role r3', 'Editor']]],
  st3: ['s-st3', [['i', 'ledger'], ['i', 'pin pin-l'], ['i', 'pin pin-r'], ['i', 'note'], ['b', 'stamp', 'ACKNOWLEDGED']]],
  st4: ['s-st4', [['i', 'cone'], ['i', 'mat'], ['i', 'shade'], ['i', 'bulb'], ['i', 'sheet1'], ['i', 'sheet2'], ['i', 'grip'], ['i', 'lens']]],
  end: ['s-end', [['i', 'tray'], ['i', 'band-v'], ['i', 'band-h'], ['i', 'loop l1'], ['i', 'loop l2'], ['i', 'knot'], ['b', 'slip', 'Thank you']]]
};
var sceneNow = '';
function setScene(kind, color) {
  app.className = color;
  if (sceneNow === kind) return;
  sceneNow = kind;
  clear(sceneHost);
  var def = SCENES[kind];
  var sc = h('div', { class: 'scene ' + def[0], 'aria-hidden': 'true' });
  def[1].forEach(function (l) {
    var attrs = { class: l[1] };
    if (l[1].indexOf('doc') === 0) attrs['data-t'] = l[2];
    sc.appendChild(h(l[0], attrs, l[0] === 'b' || l[1].indexOf('role') === 0 ? l[2] : null));
  });
  sceneHost.appendChild(sc);
}

// ---------- shared builders ----------
function radioQ(q) {
  var cur = get(q.id);
  var fs = h('fieldset', { class: 'opts' }, h('legend', { text: q.text }));
  q.opts.forEach(function (o) {
    var id = nid('r');
    var inp = h('input', { type: 'radio', name: q.id, id: id, value: o[0], checked: cur === o[0],
      on: { change: function () { set(q.id, o[0]); fs.querySelectorAll('.opt').forEach(function (l) { l.classList.toggle('on', l.getAttribute('for') === id); }); } } });
    fs.appendChild(h('label', { class: 'opt' + (cur === o[0] ? ' on' : ''), for: id }, inp, h('span', { text: o[1] })));
  });
  return fs;
}
function selectEl(id, opts, cur, placeholder, onchange, fk) {
  var s = h('select', { id: id, 'data-fk': fk || null });
  s.appendChild(h('option', { value: '', text: placeholder || 'Choose', selected: !cur }));
  opts.forEach(function (o) {
    var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
    s.appendChild(h('option', { value: v, text: t, selected: cur === v }));
  });
  s.addEventListener('change', function () { onchange(s.value); });
  return s;
}
function fieldSelect(f, afterChange) {
  var id = nid('s');
  return h('div', { class: 'fld' }, h('label', { for: id, text: f.label }),
    selectEl(id, f.opts, get(f.id), 'Choose', function (v) { set(f.id, v); if (afterChange) afterChange(f.id, v); }, f.id));
}
function table(t) {
  return h('div', { class: 'tablewrap', role: 'region', 'aria-label': 'Table', tabindex: '0' },
    h('table', { class: 't' },
      h('thead', {}, h('tr', {}, t.head.map(function (c) { return h('th', { scope: 'col', text: c }); }))),
      h('tbody', {}, t.rows.map(function (r) { return h('tr', {}, r.map(function (c) { return h('td', { text: c }); })); }))));
}
function kv(rows) {
  var dl = h('dl', { class: 'kv' });
  rows.forEach(function (r) { dl.appendChild(h('dt', { text: r[0] })); dl.appendChild(h('dd', { text: r[1] })); });
  return dl;
}
function optText(q, letter) {
  for (var i = 0; i < q.opts.length; i++) if (q.opts[i][0] === letter) return q.opts[i][1];
  return null;
}
function levelOf(group, folder) {
  var best = -1;
  (get('s2.lines') || []).forEach(function (l) { if (l.folder === folder && l.group === group) best = Math.max(best, D.levels.indexOf(l.level)); });
  return best < 0 ? 'Closed' : D.levels[best];
}
function splitName(s) {
  var t = String(s || '').trim(), dot = t.lastIndexOf('.');
  return { segs: (dot > 0 ? t.slice(0, dot) : t).split('_'), ext: dot > 0 ? t.slice(dot + 1) : '' };
}
function fileRec(id) {
  var f = D.stage1.files.filter(function (x) { return x.id === id; })[0];
  var a = get('s1.files.' + id);
  return { meta: f, folder: a ? a.folder : '', name: a ? a.name : f.messy, touched: !!a };
}
function countAnswered() {
  var n = 0;
  Object.keys(S.A).forEach(function (k) {
    if (k.indexOf('s4.find.') === 0) return;
    var v = S.A[k];
    if (Array.isArray(v)) { if (v.length) n++; } else if (v && typeof v === 'object') {
      if (Object.keys(v).some(function (x) { return v[x]; })) n++;
    } else if (v) n++;
  });
  return n;
}

// ---------- login, brief, end ----------
function renderLogin() {
  setScene('login', 'c-sky');
  var msg = h('p', { class: 'msg err', role: 'alert', 'aria-live': 'polite' });
  var name = h('input', { type: 'text', id: 'ln', autocomplete: 'name', value: S.name, maxlength: '80', autocapitalize: 'words' });
  var email = h('input', { type: 'email', id: 'le', autocomplete: 'email', value: S.email, maxlength: '120', inputmode: 'email' });
  var btn = h('button', { type: 'button', class: 'btn c-sky', text: 'Log in' });
  function go() {
    msg.textContent = '';
    btn.disabled = true;
    S.name = name.value; S.email = email.value;
    api('/api/start', { name: name.value, email: email.value }).then(function (r) {
      btn.disabled = false;
      if (r.net) { msg.textContent = 'Waiting for signal. Check your connection and try again.'; return; }
      if (r.status !== 200) {
        if (r.status === 403 && r.j.reason === 'attempts') { S.attemptsUsed = r.j.attemptsUsed; S.endMsg = r.j.error; S.screen = 'end'; render(); return; }
        msg.textContent = r.j.error || 'Try again.'; return;
      }
      S.name = r.j.name; S.attemptsUsed = r.j.attemptsUsed;
      if (r.j.open) { adopt(r.j.open); S.screen = 'shift'; } else if (S.attemptsUsed >= MAXA) { S.endMsg = 'You have used all 3 attempts. Your highest score counts.'; S.screen = 'end'; } else S.screen = 'brief';
      render();
    });
  }
  btn.addEventListener('click', go);
  [name, email].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); }); });
  clear(app).appendChild(h('div', { class: 'center' },
    h('section', { class: 'card', 'aria-labelledby': 'lh' },
      h('h1', { id: 'lh', text: 'Log in' }),
      h('p', { class: 'small', text: 'Use the name and email you first used.' }),
      h('div', { class: 'fld' }, h('label', { for: 'ln', text: 'Name' }), name),
      h('div', { class: 'fld' }, h('label', { for: 'le', text: 'Email' }), email),
      msg, btn,
      h('p', { class: 'small muted' }, icon('lock'), ' Your work saves as you go.'))));
}

function adopt(open) {
  S.token = open.token; S.learnerId = open.token.slice(0, 12); S.n = open.n; S.rev = open.rev;
  S.stage = open.stage; S.locked = open.locked || []; S.A = open.answers || {}; S.resetUsed = !!open.resetUsed;
  S.readonly = false; S.view = 'task'; S.ui = {}; S.task = { 1: 0, 2: 0, 3: 0, 4: 0 };
  lastSaved = JSON.stringify(S.A); inflight = false; queued = false; retryIdx = 0; beaconed = ''; S.save = 'saved';
  var loc = readLocal();
  if (loc && loc.dirty && loc.rev === open.rev && JSON.stringify(loc.locked) === JSON.stringify(S.locked)) {
    S.A = loc.answers || S.A;
    if (JSON.stringify(S.A) !== lastSaved) setTimeout(flush, 0);
  }
}

function renderBrief() {
  setScene('brief', 'c-sky');
  var b = D.brief;
  var start = h('button', { type: 'button', class: 'btn c-sky', text: 'Start shift' });
  var msg = h('p', { class: 'msg err', role: 'alert' });
  start.addEventListener('click', function () {
    start.disabled = true;
    api('/api/start', { name: S.name, email: S.email, begin: true }).then(function (r) {
      start.disabled = false;
      if (r.net) { msg.textContent = 'Waiting for signal. Try again.'; return; }
      if (r.status !== 200) { msg.textContent = r.j.error || 'Try again.'; return; }
      S.attemptsUsed = r.j.attemptsUsed; adopt(r.j.open); S.screen = 'shift'; render();
    });
  });
  var out = h('button', { type: 'button', class: 'btn auto ghost', on: { click: function () { toLogin(); } } }, icon('out'), 'Log out');
  clear(app).appendChild(h('div', { class: 'center brief' },
    h('section', { class: 'card', 'aria-labelledby': 'bh' },
      h('h1', { id: 'bh', text: 'Brief' }),
      h('p', { class: 'small', text: 'Attempt ' + (S.attemptsUsed + 1) + ' of 3' }),
      h('div', { class: 'quote' }, h('b', { text: 'Message from ' + b.from }), b.body),
      h('h3', { text: 'Dates in the pack' }),
      table({ head: ['Date', 'Event'], rows: b.dates }),
      h('h3', { text: 'Four stages' }),
      table({ head: ['Stage', 'Minutes'], rows: D.stages.map(function (s) { return [s.n + ' ' + s.name, String(s.minutes)]; }) }),
      h('p', { class: 'small', text: 'The attempt counts when you press Start shift. Logging in to look around keeps all 3 attempts available.' }),
      msg, start, h('div', { class: 'nav' }, out))));
}

function renderEnd() {
  setScene('end', 'c-rose');
  var left = MAXA - S.attemptsUsed;
  var msg = S.endMsg || ('You have used ' + S.attemptsUsed + ' of 3 attempts.');
  clear(app).appendChild(h('div', { class: 'center endc' },
    h('section', { class: 'card', 'aria-labelledby': 'eh' },
      h('h1', { id: 'eh', text: 'Thank you' }),
      h('p', { text: msg }),
      left > 0 && !S.endMsg ? h('p', { text: 'Log in again to begin your next attempt.' }) : null,
      h('button', { type: 'button', class: 'btn c-rose', text: 'Back to log in', on: { click: function () { toLogin(); } } }))));
}

function toLogin() {
  stopTimers();
  S = freshState();
  inflight = false; queued = false; lastSaved = '{}';
  render();
}

function render() {
  document.body.classList.toggle('has-dock', S.screen === 'shift');
  if (S.screen === 'login') renderLogin();
  else if (S.screen === 'brief') renderBrief();
  else if (S.screen === 'end') renderEnd();
  else renderShift();
  closeModal();
}

// ---------- modal ----------
var modalEl = null, modalPrev = null;
function openModal(card) {
  closeModal();
  modalPrev = document.activeElement;
  modalEl = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, card);
  document.body.appendChild(modalEl);
  var f = modalEl.querySelector('button, select, input'); if (f) f.focus();
  modalEl.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      var items = modalEl.querySelectorAll('button:not([disabled]), select, input'); if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
function closeModal() {
  if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
  modalEl = null;
  if (modalPrev && modalPrev.focus && document.body.contains(modalPrev)) { try { modalPrev.focus(); } catch { /* ignore */ } }
  modalPrev = null;
}
function dialog(heading, paras, buttons) {
  var nav = h('div', { class: 'nav' });
  buttons.forEach(function (b) { nav.appendChild(h('button', { type: 'button', class: 'btn ' + (b.cls || 'ghost'), text: b.text, on: { click: b.fn } })); });
  openModal(h('section', { class: 'card', 'aria-labelledby': 'dh' }, h('h2', { id: 'dh', text: heading }), paras.map(function (p) { return h('p', { text: p }); }), nav));
}

// ---------- shift shell ----------
function stageDef() { return D.stages[S.stage - 1]; }
function renderShift() {
  var st = stageDef();
  setScene('st' + S.stage, st.color);
  els = {};
  els.top = h('header', { class: 'top' });
  els.task = h('div', { class: 'col-task' });
  els.ws = h('section', { class: 'card pane-ws', 'aria-label': 'Workspace' });
  els.ref = h('section', { class: 'card pane-ref', 'aria-label': 'Reference' });
  els.side = h('div', { class: 'col-side' }, h('div', { class: 'sidebtns' },
    h('button', { type: 'button', class: 'btn ghost auto', 'data-v': 'workspace', on: { click: function () { setView('workspace'); } } }, icon('ws'), 'Workspace'),
    h('button', { type: 'button', class: 'btn ghost auto', 'data-v': 'reference', on: { click: function () { setView('reference'); } } }, icon('ref'), 'Reference')), els.ws, els.ref);
  els.dock = h('nav', { class: 'dock', 'aria-label': 'Shift controls' });
  els.shift = h('div', { class: 'shift', 'data-view': S.view });
  els.shift.appendChild(els.task); els.shift.appendChild(els.side);
  clear(app).appendChild(els.top); app.appendChild(els.shift); app.appendChild(els.dock);
  renderTop(); renderTask(); renderSide(); renderDock();
}
function setView(v) {
  var phone = window.innerWidth < 900, was = S.view;
  if (was === 'task') S.taskY = window.scrollY;
  S.view = S.view === v && v !== 'task' ? 'task' : v;
  els.shift.setAttribute('data-view', S.view);
  renderDock(); renderSideButtons();
  if (phone) window.scrollTo(0, S.view === 'task' ? (S.taskY || 0) : 0);
}
function renderSideButtons() {
  els.side.querySelectorAll('.sidebtns .btn').forEach(function (b) { b.classList.toggle('on', S.view === b.getAttribute('data-v')); });
}
function stageComplete4() {
  return !!(get('s4.sign.reviewer') && get('s4.sign.date') && s4Ready());
}
function renderTop() {
  var pills = h('div', { class: 'pills', role: 'list', 'aria-label': 'Stages' });
  D.stages.forEach(function (s) {
    var locked = S.locked.indexOf(s.n) >= 0, cur = s.n === S.stage;
    pills.appendChild(h('span', { role: 'listitem', class: (cur ? 'on' : locked ? 'done' : ''), 'aria-current': cur ? 'step' : null }, locked ? icon('tick') : null, s.n + ' ' + s.name));
  });
  var logLabel = S.stage === 4 && stageComplete4() ? 'Submit and log out' : 'Log out';
  els.stateEl = h('span', { class: 'state', role: 'status', 'aria-live': 'polite' });
  clear(els.top).appendChild(pills);
  els.top.appendChild(h('div', { class: 'row' }, els.stateEl, h('span', { class: 'grow' }),
    h('button', { type: 'button', class: 'btn auto ghost lg-only', id: 'resetTop', disabled: S.resetUsed, on: { click: doReset } }, icon('reset'), S.resetUsed ? 'Reset used' : 'Reset'),
    h('button', { type: 'button', class: 'btn auto ' + stageDef().color, id: 'logout', on: { click: doLogout } }, icon('out'), logLabel)));
  renderState();
}
function renderState() {
  if (!els.stateEl) return;
  var m = { saved: ['tick', 'Saved'], saving: ['dots', 'Saving'], waiting: ['wifi', 'Waiting for signal'] }[S.save];
  clear(els.stateEl); els.stateEl.className = 'state' + (S.save === 'waiting' ? ' waiting' : '');
  els.stateEl.appendChild(icon(m[0])); els.stateEl.appendChild(document.createTextNode(m[1]));
}
function renderDock() {
  var items = [['task', 'Task', 'task'], ['workspace', 'Workspace', 'ws'], ['reference', 'Reference', 'ref']];
  clear(els.dock);
  items.forEach(function (i) {
    els.dock.appendChild(h('button', { type: 'button', class: S.view === i[0] ? 'on ' + stageDef().color : '', 'aria-pressed': S.view === i[0] ? 'true' : 'false', on: { click: function () { setView(i[0]); } } }, icon(i[2]), i[1]));
  });
  els.dock.appendChild(h('button', { type: 'button', disabled: S.resetUsed, on: { click: doReset } }, icon('reset'), S.resetUsed ? 'Reset used' : 'Reset'));
}
function refreshLive() {
  if (S.screen !== 'shift' || !els.top) return;
  refreshTopLabel();
  renderSide();
}

// ---------- reset and log out ----------
function doReset() {
  if (S.resetUsed || S.readonly) return;
  dialog('Reset this attempt?', ['Reset clears all your work and restarts the shift. You can do this once. The attempt count stays the same.'], [
    { text: 'Keep working', fn: closeModal },
    { text: 'Reset', cls: stageDef().color, fn: function () {
      closeModal(); stopTimers();
      api('/api/reset', { token: S.token }).then(function (r) {
        if (r.net) { dialog('Waiting for signal', ['Reset needs a connection. Try again when the signal returns.'], [{ text: 'Close', fn: closeModal }]); return; }
        if (r.status === 409 && r.j.reason === 'device') { goReadonly(); return; }
        if (r.status !== 200) return;
        var o = r.j.open; S.A = o.answers || {}; S.locked = o.locked || []; S.stage = o.stage; S.rev = o.rev; S.resetUsed = !!o.resetUsed;
        lastSaved = JSON.stringify(S.A); S.ui = {}; S.task = { 1: 0, 2: 0, 3: 0, 4: 0 }; S.view = 'task'; writeLocal(false); setSave('saved'); render();
      });
    } }]);
}
function doLogout() {
  if (S.readonly) { toLogin(); return; }
  var done = S.stage === 4 && stageComplete4();
  dialog(done ? 'Submit and log out?' : 'Log out?', [
    'You have answered ' + countAnswered() + ' of ' + TOTAL_ITEMS + ' items.',
    'Logging out submits your work so far and ends this attempt. The attempt is used.',
    'If you close the page or log in on another device instead, the attempt stays open.'], [
    { text: 'Keep working', fn: closeModal },
    { text: done ? 'Submit and log out' : 'Log out', cls: stageDef().color, fn: submitNow }]);
}
function submitNow() {
  closeModal(); stopTimers();
  api('/api/submit', { token: S.token, answers: S.A }).then(function (r) {
    if (r.net) { setSave('waiting'); dialog('Waiting for signal', ['Your work is saved on this device. Try again when the signal returns.'], [{ text: 'Close', fn: closeModal }]); return; }
    if (r.status === 409 && r.j.reason === 'device') { goReadonly(); return; }
    if (r.status !== 200) { dialog('Try again', [r.j.error || 'Something went wrong.'], [{ text: 'Close', fn: closeModal }]); return; }
    dropLocal(); S.attemptsUsed = r.j.attemptsUsed; S.endMsg = ''; S.screen = 'end'; S.token = null; render();
  });
}

// ---------- tasks ----------
function eqi(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
function tree() { return get('s1.tree') || []; }

function childFolders(parent) { return tree().filter(function (f) { return eqi(f.parent, parent); }); }

// Stage 1
function t1Radios(ids) {
  return function () { var w = h('div'); ids.forEach(function (q) { w.appendChild(radioQ(q)); }); return w; };
}
function folderNameError(nm, ignore) {
  if (!nm) return 'Type a folder name.';
  if (!/^[A-Za-z0-9 _.\-]{1,60}$/.test(nm)) return 'Use letters, numbers and underscores.';
  if (eqi(nm, 'CLIENTS')) return 'That name is already used.';
  var dup = tree().some(function (f) { return eqi(f.name, nm) && !eqi(f.name, ignore); });
  return dup ? 'That name is already used.' : '';
}
function renameFolder(oldN, newN) {
  set('s1.tree', tree().map(function (f) { return { name: eqi(f.name, oldN) ? newN : f.name, parent: eqi(f.parent, oldN) ? newN : f.parent }; }));
  D.stage1.files.forEach(function (f) { var a = get('s1.files.' + f.id); if (a && eqi(a.folder, oldN)) set('s1.files.' + f.id, { folder: newN, name: a.name }); });
}
function removeFolder(name) {
  var gone = [name.toLowerCase()], grew = true;
  while (grew) {
    grew = false;
    tree().forEach(function (f) { if (gone.indexOf(f.name.toLowerCase()) < 0 && gone.indexOf(f.parent.toLowerCase()) >= 0) { gone.push(f.name.toLowerCase()); grew = true; } });
  }
  set('s1.tree', tree().filter(function (f) { return gone.indexOf(f.name.toLowerCase()) < 0; }));
  D.stage1.files.forEach(function (f) { var a = get('s1.files.' + f.id); if (a && gone.indexOf(String(a.folder).toLowerCase()) >= 0) set('s1.files.' + f.id, { folder: '', name: a.name }); });
}
function t1Tree() {
  var b = D.stage1.treeBrief, w = h('div');
  w.appendChild(h('p', { text: 'Build the folder tree for the Lagoon Foods project under the root folder CLIENTS. The file protocol in the Reference pane gives the pattern.' }));
  w.appendChild(kv([['Client code and name', b.client], ['Project code and name', b.project]]));
  w.appendChild(h('p', { class: 'small', text: 'The eight work areas, in order:' }));
  w.appendChild(h('ol', { class: 'small' }, b.areas.map(function (a) { return h('li', { text: a }); })));
  var msg = h('p', { class: 'msg err', role: 'alert' });
  var pid = nid('p'), nidv = nid('n');
  var parentSel = selectEl(pid, [['CLIENTS', 'CLIENTS']].concat(tree().map(function (f) { return [f.name, f.name]; })), S.ui.parent || 'CLIENTS', 'Choose', function (v) { S.ui.parent = v; }, 'parent');
  parentSel.firstChild.remove();
  var nameIn = h('input', { type: 'text', id: nidv, maxlength: '60', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'data-fk': 'newname' });
  function addFolder() {
    var nm = nameIn.value.trim(), err = folderNameError(nm);
    if (!err && tree().length >= 30) err = 'That is enough folders for this task.';
    if (err) { msg.textContent = err; return; }
    set('s1.tree', tree().concat([{ name: nm, parent: parentSel.value || 'CLIENTS' }]));
    renderTask('newname');
  }
  nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') addFolder(); });
  w.appendChild(h('h3', { text: 'New folder' }));
  w.appendChild(h('div', { class: 'fld' }, h('label', { for: pid, text: 'Parent folder' }), parentSel));
  w.appendChild(h('div', { class: 'fld' }, h('label', { for: nidv, text: 'Folder name' }), nameIn));
  w.appendChild(msg);
  w.appendChild(h('button', { type: 'button', class: 'btn c-orange', on: { click: addFolder } }, icon('plus'), ' New folder'));
  w.appendChild(h('h3', { text: 'Your folders' }));
  if (!tree().length) w.appendChild(h('p', { class: 'empty', text: 'No folders yet. The root folder CLIENTS is ready.' }));
  tree().forEach(function (f, i) {
    var editing = S.ui.editFolder === f.name;
    var card = h('div', { class: 'fcard open' });
    if (editing) {
      var inp = h('input', { type: 'text', value: f.name, maxlength: '60', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'New name for ' + f.name, 'data-fk': 'edit' + i });
      var em = h('p', { class: 'msg err', role: 'alert' });
      card.appendChild(h('div', { class: 'body' }, h('p', { class: 'small', text: 'Inside ' + f.parent }), inp, em,
        h('div', { class: 'nav' },
          h('button', { type: 'button', class: 'btn ghost sm', text: 'Cancel', on: { click: function () { S.ui.editFolder = null; renderTask('rn' + i); } } }),
          h('button', { type: 'button', class: 'btn c-orange sm', text: 'Save name', on: { click: function () {
            var nm = inp.value.trim(), err = folderNameError(nm, f.name);
            if (err) { em.textContent = err; return; }
            S.ui.editFolder = null; if (nm !== f.name) renameFolder(f.name, nm); renderTask('rn' + i);
          } } }))));
    } else {
      card.appendChild(h('div', { class: 'body' }, h('p', {}, h('b', { class: 'mono', text: f.name })), h('p', { class: 'small', text: 'Inside ' + f.parent }),
        h('div', { class: 'nav' },
          h('button', { type: 'button', class: 'btn ghost sm', 'data-fk': 'rn' + i, text: 'Rename', on: { click: function () { S.ui.editFolder = f.name; renderTask('edit' + i); } } }),
          h('button', { type: 'button', class: 'btn ghost sm', text: 'Remove', on: { click: function () { removeFolder(f.name); renderTask('newname'); } } }))));
    }
    w.appendChild(card);
  });
  return w;
}
function t1Files() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Ten files sit in the Incoming tray. Open each one, read its details, move it to the right folder and give it a proper name.' }));
  if (!tree().length) w.appendChild(h('p', { class: 'empty', text: 'Build your folders in the previous task first. Then you can move files into them.' }));
  D.stage1.files.forEach(function (f) {
    var rec = fileRec(f.id), open = S.ui.openFile === f.id;
    var head = h('button', { type: 'button', 'aria-expanded': open ? 'true' : 'false', 'data-fk': 'file' + f.id,
      on: { click: function () { S.ui.openFile = open ? null : f.id; renderTask('file' + f.id); } } }, icon('file'), h('span', { class: 'mono', text: rec.name }));
    var card = h('div', { class: 'fcard' + (open ? ' open' : '') }, head);
    if (open) {
      var mid = nid('m'), rid = nid('rn');
      var nameIn = h('input', { type: 'text', id: rid, value: rec.name, maxlength: '120', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'data-fk': 'ren' + f.id });
      nameIn.addEventListener('input', function () { var a = fileRec(f.id); set('s1.files.' + f.id, { folder: a.folder, name: nameIn.value }); head.querySelector('.mono').textContent = nameIn.value; });
      var folderSel = selectEl(mid, [['', 'Incoming tray']].concat(tree().map(function (t) { return [t.name, t.name]; })), rec.folder, 'Incoming tray', function (v) {
        var a = fileRec(f.id); set('s1.files.' + f.id, { folder: v, name: a.name }); renderTask('file' + f.id);
      }, 'mv' + f.id);
      folderSel.firstChild.textContent = 'Incoming tray';
      card.appendChild(h('div', { class: 'body' },
        kv([['Last saved', f.saved], ['Version in header', f.ver], ['Status shown', f.status], ['Saved by', f.by]]),
        h('div', { class: 'fld' }, h('label', { for: mid, text: 'Move to' }), folderSel),
        h('div', { class: 'fld' }, h('label', { for: rid, text: 'Rename' }), nameIn)));
    } else if (rec.folder) card.appendChild(h('div', { class: 'body where', text: 'In ' + rec.folder }));
    w.appendChild(card);
  });
  return w;
}

// Stage 2
function t2People() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Place each person in the group that fits what the work needs.' }));
  D.people.forEach(function (p) {
    var id = nid('g'), key = 's2.group.' + p.key;
    w.appendChild(h('div', { class: 'fcard open' }, h('div', { class: 'body' },
      h('p', {}, icon('user'), ' ', h('b', { text: p.name })), h('p', { class: 'small', text: p.job }), h('p', { class: 'small', text: p.needs }),
      h('div', { class: 'fld' }, h('label', { for: id, text: 'Group for ' + p.name }), selectEl(id, D.groups, get(key), 'Choose a group', function (v) { set(key, v); }, key)))));
  });
  return w;
}
function t2Lines() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Set the group access on each folder. A line placed on a folder passes to every file inside it. You hold the Owner or admin level on every folder as document custodian.' }));
  S.ui.add = S.ui.add || {};
  D.folders.forEach(function (folder, fi) {
    var lines = get('s2.lines') || [];
    var box = h('div', { class: 'fcard open' });
    var body = h('div', { class: 'body' }, h('h3', {}, icon('folder'), ' ', h('span', { class: 'mono', text: folder })));
    var mine = lines.filter(function (l) { return l.folder === folder; });
    if (!mine.length) body.appendChild(h('p', { class: 'small empty', text: 'No access lines. The folder is closed to every group.' }));
    mine.forEach(function (l, li) {
      var sid = nid('lv');
      body.appendChild(h('div', { class: 'line' }, h('span', { text: l.group }),
        h('select', { id: sid, 'aria-label': 'Level for ' + l.group + ' on ' + folder, 'data-fk': 'lv' + fi + li, on: { change: function (e) {
          var all = (get('s2.lines') || []).map(function (x) { return x.folder === folder && x.group === l.group ? { folder: x.folder, group: x.group, level: e.target.value } : x; }); set('s2.lines', all); renderTask('lv' + fi + li);
        } } }, D.levels.map(function (lv) { return h('option', { value: lv, text: lv, selected: lv === l.level }); })),
        h('button', { type: 'button', class: 'btn ghost sm auto', text: 'Remove', 'aria-label': 'Remove ' + l.group + ' from ' + folder, on: { click: function () {
          set('s2.lines', (get('s2.lines') || []).filter(function (x) { return !(x.folder === folder && x.group === l.group); })); renderTask('ag' + fi);
        } } })));
    });
    var st = S.ui.add[folder] || { group: '', level: '' };
    var gid = nid('ag'), lid = nid('al'), em = h('p', { class: 'msg err', role: 'alert' });
    var gsel = selectEl(gid, D.groups, st.group, 'Choose a group', function (v) { st.group = v; S.ui.add[folder] = st; }, 'ag' + fi);
    var lsel = selectEl(lid, D.levels, st.level, 'Choose a level', function (v) { st.level = v; S.ui.add[folder] = st; });
    body.appendChild(h('div', { class: 'addline' },
      h('div', { class: 'fld' }, h('label', { for: gid, text: 'Group' }), gsel),
      h('div', { class: 'fld' }, h('label', { for: lid, text: 'Level' }), lsel),
      h('button', { type: 'button', class: 'btn c-violet', on: { click: function () {
        if (!gsel.value || !lsel.value) { em.textContent = 'Choose a group and a level.'; return; }
        if (mine.some(function (l) { return l.group === gsel.value; })) { em.textContent = 'That group already has a line here. Change its level instead.'; return; }
        set('s2.lines', lines.concat([{ folder: folder, group: gsel.value, level: lsel.value }])); S.ui.add[folder] = { group: '', level: '' }; renderTask('ag' + fi);
      } } }, icon('plus'), ' Add access line')));
    body.appendChild(em);
    box.appendChild(body); w.appendChild(box);
  });
  return w;
}
function t2Gov() { var w = h('div'); w.appendChild(radioQ(D.stage2.tempEnd)); w.appendChild(radioQ(D.stage2.reviewersOwner)); return w; }
function t2Links() { var w = h('div'); D.stage2.links.forEach(function (q) { w.appendChild(radioQ(q)); }); return w; }
function t2Ext() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Record the access for Mr Nwosu on 04_Approved_Deliverables.' }));
  w.appendChild(kv([['Person', 'Mr Emeka Nwosu'], ['Organization', 'Lagoon Foods'], ['Reason', 'Reads approved deliverables'], ['Items', '04_Approved_Deliverables']]));
  D.stage2.ext.forEach(function (f) { w.appendChild(fieldSelect(f)); });
  return w;
}
function t2Intake() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Set up a file request so Lagoon Foods can send its data files.' }));
  D.stage2.intake.forEach(function (f) { w.appendChild(fieldSelect(f)); });
  return w;
}
function t2Test() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Test the sensitive folder with a test account. Record the account and the folder you tested. The Workspace pane then shows the result from your own access lines.' }));
  D.stage2.test.forEach(function (f) { w.appendChild(fieldSelect(f, function () { renderTask(f.id); renderSide(); })); });
  var acc = { A: 'Directors', B: 'Internal Team', C: 'Client Reviewers' }[get('s2.test.account')];
  var fol = { A: '00_Governance', B: '03_Review_and_Comments', C: '04_Approved_Deliverables' }[get('s2.test.folder')];
  if (acc && fol) {
    S.ui.testAs = acc;
    w.appendChild(h('div', { class: 'sheet' }, h('h3', { text: 'Test result' }), h('p', {}, acc + ' on ' + fol + ': ', h('span', { class: 'lvl on', text: levelOf(acc, fol) }))));
  }
  return w;
}

// Stage 3
function sel3(id, label, opts, ph) {
  var sid = nid('v');
  return h('div', { class: 'fld' }, h('label', { for: sid, text: label }), selectEl(sid, opts, get(id), ph || 'Choose', function (v) { set(id, v); }, id));
}
function t3VS() {
  var w = h('div');
  w.appendChild(h('h3', { text: 'Versions' }));
  w.appendChild(h('p', { text: 'The supplier review report moves through the project. Choose the version number each event produces.' }));
  D.stage3.versions.forEach(function (v) { w.appendChild(sel3(v[0], v[1], D.stage3.versionOpts, 'Choose a version')); });
  w.appendChild(h('h3', { text: 'Statuses' }));
  w.appendChild(h('p', { text: 'Choose the status each file carries.' }));
  D.stage3.statuses.forEach(function (v) { w.appendChild(sel3(v[0], v[1], D.statuses, 'Choose a status')); });
  return w;
}
function t3CA() {
  var w = h('div');
  w.appendChild(h('h3', { text: 'Actionable comment' }));
  w.appendChild(h('div', { class: 'quote' }, h('b', { text: 'Ngozi\u2019s comment on the review copy' }), '\u201C' + D.stage3.commentQuote + '\u201D'));
  w.appendChild(h('p', { text: 'Chidi asks you to turn it into a comment someone can act on.' }));
  D.stage3.comment.forEach(function (f) { w.appendChild(fieldSelect(f)); });
  w.appendChild(h('h3', { text: 'Approval decision' }));
  w.appendChild(h('div', { class: 'quote' }, h('b', { text: 'Chidi writes' }), '\u201C' + D.stage3.approvalQuote + '\u201D'));
  D.stage3.approval.forEach(function (q) { w.appendChild(radioQ(q)); });
  return w;
}
function t3Co() { var w = h('div'); D.stage3.co.forEach(function (q) { w.appendChild(radioQ(q)); }); return w; }
function regVersion(fileId) {
  var rec = fileRec(fileId), seg = splitName(rec.name).segs;
  return seg.length === 7 && /^v\d+\.\d+$/.test(seg[5]) ? seg[5] : rec.meta.ver;
}
function t3Reg() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Complete the document register. Title, version and location come from your workspace. Enter the document ID, the owner and the status.' }));
  D.stage3.reg.forEach(function (r) {
    var key = 's3.reg.' + r.r, cur = get(key) || { id: '', owner: '', status: '' };
    var rec = fileRec(r.file);
    var iid = nid('ri'), oid = nid('ro'), sid = nid('rs');
    function save(part, v) { var c = Object.assign({ id: '', owner: '', status: '' }, get(key)); c[part] = v; set(key, (c.id || c.owner || c.status) ? c : null); }
    var idIn = h('input', { type: 'text', id: iid, value: cur.id, maxlength: '40', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'data-fk': key });
    idIn.addEventListener('input', function () { save('id', idIn.value.trim()); });
    w.appendChild(h('div', { class: 'fcard open' }, h('div', { class: 'body' },
      h('p', {}, h('b', { text: r.title })),
      kv([['Version', regVersion(r.file)], ['Location', rec.folder || 'Not filed']]),
      h('div', { class: 'fld' }, h('label', { for: iid, text: 'Document ID for ' + r.title }), idIn),
      h('div', { class: 'fld' }, h('label', { for: oid, text: 'Owner' }), selectEl(oid, D.owners7, cur.owner, 'Choose an owner', function (v) { save('owner', v); })),
      h('div', { class: 'fld' }, h('label', { for: sid, text: 'Status' }), selectEl(sid, D.statuses, cur.status, 'Choose a status', function (v) { save('status', v); })))));
  });
  return w;
}
function t3Hand() {
  var w = h('div');
  w.appendChild(h('p', { text: 'The project ends on Friday 18 December 2026. Lagoon Foods may keep copies of approved deliverables under the agreement.' }));
  w.appendChild(h('h3', { text: 'Handoff manifest' }));
  w.appendChild(h('p', { class: 'small', text: 'Mark each card Include or Set aside.' }));
  D.stage3.manifest.forEach(function (m) {
    w.appendChild(radioQ({ id: m[0], text: m[1], opts: [['Include', 'Include'], ['Set aside', 'Set aside']] }));
  });
  w.appendChild(h('h3', { text: 'Handoff route' }));
  w.appendChild(radioQ(D.stage3.route));
  w.appendChild(h('h3', { text: 'Handoff classification' }));
  w.appendChild(h('p', { class: 'small', text: 'Give each statement one label.' }));
  D.stage3.cls.forEach(function (c) { w.appendChild(sel3(c[0], c[1], D.stage3.clsOpts, 'Choose a label')); });
  return w;
}

// Stage 4
function findDone(id) { var f = get('s4.find.' + id); return !!(f && f.risk && f.action && f.owner && f.due); }
function s4Ready() {
  return D.stage4.tests.every(function (t) { var r = get('s4.result.' + t.id); return r && (r !== 'Fail' || findDone(t.id)); });
}
function s4Counts() {
  var rec = 0, fails = 0, fd = 0;
  D.stage4.tests.forEach(function (t) { var r = get('s4.result.' + t.id); if (r) rec++; if (r === 'Fail') { fails++; if (findDone(t.id)) fd++; } });
  return { rec: rec, fails: fails, fd: fd };
}
function chipFor(id) {
  var r = get('s4.result.' + id);
  if (!r) return h('span', { class: 'chip', text: 'Open' });
  if (r === 'Fail') return h('span', { class: 'chip fail', text: findDone(id) ? 'Fail' : 'Fail, finding needed' });
  return h('span', { class: 'chip ' + (r === 'Pass' ? 'pass' : 'nt'), text: r });
}
function findingForm(t) {
  var key = 's4.find.' + t.id, cur = Object.assign({ risk: '', action: '', owner: '', due: '' }, get(key));
  var acts = D.stage4.actions[t.id].map(function (txt, i) { return [String.fromCharCode(65 + i), txt]; });
  function f(part, label, opts, ph) {
    var sid = nid('f');
    return h('div', { class: 'fld' }, h('label', { for: sid, text: label }), selectEl(sid, opts, cur[part], ph, function (v) {
      var c = Object.assign({ risk: '', action: '', owner: '', due: '' }, get(key)); c[part] = v; set(key, c); renderTask('f' + part);
    }, 'f' + part));
  }
  return h('div', { class: 'sheet' }, h('h3', { text: 'Finding for ' + t.id + ' ' + t.name }),
    f('risk', 'Risk', D.stage4.risks, 'Choose a risk'), f('action', 'Corrective action', acts, 'Choose an action'),
    f('owner', 'Owner', D.stage4.owners, 'Choose an owner'), f('due', 'Due date', D.stage4.dues, 'Choose a date'));
}
function t4Check() {
  var w = h('div'), c = s4Counts();
  w.appendChild(h('div', { class: 'quote' }, h('b', { text: 'Message from Mrs Adebayo' }), D.stage4.message));
  w.appendChild(h('p', { class: 'small', text: D.stage4.facts }));
  w.appendChild(table({ head: ['Result', 'Meaning'], rows: D.stage4.resultMeaning }));
  w.appendChild(h('p', { class: 'prog', role: 'status' }, 'Results recorded ' + c.rec + ' of 14. Findings written ' + c.fd + ' of ' + c.fails + '.'));
  var groups = [['Structure', 0, 4], ['Access', 4, 9], ['Working practice', 9, 14]];
  groups.forEach(function (g) {
    w.appendChild(h('p', { class: 'grp', text: g[0] }));
    var list = h('div', { class: 'tlist' });
    D.stage4.tests.slice(g[1], g[2]).forEach(function (t) {
      list.appendChild(h('button', { type: 'button', class: 'trow ' + 'c-lime' + (S.ui.t4 === t.id ? ' on' : ''), 'data-fk': 'row' + t.id, 'aria-pressed': S.ui.t4 === t.id ? 'true' : 'false',
        on: { click: function () { S.ui.t4 = t.id; renderTask('row' + t.id); var ev = document.getElementById('evidence'); if (ev) ev.scrollIntoView({ block: 'start' }); } } },
        h('span', { class: 'tn', text: t.id }), h('span', { class: 'tt', text: t.name }), chipFor(t.id)));
    });
    w.appendChild(list);
  });
  var t = D.stage4.tests.filter(function (x) { return x.id === S.ui.t4; })[0];
  if (t) {
    var ev = D.stage4.evidence[t.id], card = h('div', { class: 'sheet', id: 'evidence', tabindex: '-1' });
    card.appendChild(h('h3', { text: t.id + ' ' + t.name }));
    card.appendChild(h('p', {}, h('b', { text: 'Test question. ' }), t.q));
    card.appendChild(h('h3', { text: 'Evidence' }));
    ev.text.forEach(function (p) { card.appendChild(h('p', { text: p })); });
    if (ev.table) card.appendChild(table(ev.table));
    if (ev.after) card.appendChild(h('p', { text: ev.after }));
    var rid = nid('res');
    card.appendChild(h('div', { class: 'fld' }, h('label', { for: rid, text: 'Result for ' + t.id }),
      selectEl(rid, D.stage4.results, get('s4.result.' + t.id), 'Choose a result', function (v) { set('s4.result.' + t.id, v); renderTask('res'); }, 'res')));
    if (get('s4.result.' + t.id) === 'Fail') card.appendChild(findingForm(t));
    w.appendChild(card);
  }
  if (c.rec === 14 && s4Ready()) w.appendChild(h('p', { class: 'msg', role: 'status', text: 'All 14 results are recorded and every Fail has a finding. The sign off task is open.' }));
  else w.appendChild(h('p', { class: 'small', text: 'Sign off opens when all 14 results are recorded and every Fail has a finding.' }));
  return w;
}
function t4Sign() {
  var w = h('div');
  w.appendChild(h('p', { text: 'Check your record, then sign it off. Your sign off becomes the audit record for this workspace.' }));
  w.appendChild(table({ head: ['Test', 'Result', 'Risk'], rows: D.stage4.tests.map(function (t) {
    var f = get('s4.find.' + t.id), r = get('s4.result.' + t.id);
    return [t.id + ' ' + t.name, r || 'Open', r === 'Fail' && f ? f.risk : ''];
  }) }));
  D.stage4.sign.forEach(function (f) { w.appendChild(fieldSelect(f, function () { renderTask(f.id); refreshLive(); })); });
  return w;
}

var TASKS = {
  1: [{ name: 'Home and owner', render: t1Radios(D.stage1.home) }, { name: 'Purpose and classification', render: t1Radios(D.stage1.purpose) },
    { name: 'Folder tree', render: t1Tree }, { name: 'Name and file ten documents', render: t1Files }],
  2: [{ name: 'People into groups', render: t2People }, { name: 'Folder access lines', render: t2Lines }, { name: 'Group governance', render: t2Gov },
    { name: 'Link types', render: t2Links }, { name: 'External user record', render: t2Ext }, { name: 'File request for Lagoon Foods data', render: t2Intake },
    { name: 'Test account log', render: t2Test }],
  3: [{ name: 'Versions and statuses', render: t3VS }, { name: 'Comment and approval', render: t3CA }, { name: 'Coauthoring', render: t3Co },
    { name: 'Register', render: t3Reg }, { name: 'Handoff', render: t3Hand }],
  4: [{ name: 'Workspace check', render: t4Check }, { name: 'Sign off', render: t4Sign }]
};

function renderTask(fk) {
  var list = TASKS[S.stage], i = Math.min(S.task[S.stage] || 0, list.length - 1), t = list[i];
  S.task[S.stage] = i;
  clear(els.task);
  if (S.readonly) {
    els.task.appendChild(h('section', { class: 'card', role: 'alert' }, h('p', { text: D.msg.device }),
      h('button', { type: 'button', class: 'btn ' + stageDef().color, text: 'Log in again', on: { click: toLogin } })));
  }
  var card = h('section', { class: 'card', 'aria-labelledby': 'th' },
    h('div', { class: 'prog' }, h('span', { text: 'Stage ' + S.stage + ': ' + stageDef().name }), h('span', { text: 'Task ' + (i + 1) + ' of ' + list.length })),
    h('h2', { id: 'th', tabindex: '-1', text: t.name }), t.render());
  var nav = h('div', { class: 'nav' });
  if (i > 0) nav.appendChild(h('button', { type: 'button', class: 'btn ghost', text: 'Back', on: { click: function () { flush(); S.task[S.stage] = i - 1; renderTask(); window.scrollTo(0, 0); } } }));
  if (i < list.length - 1) {
    var blocked = S.stage === 4 && !s4Ready();
    nav.appendChild(h('button', { type: 'button', class: 'btn ' + stageDef().color, disabled: blocked, text: 'Next task', on: { click: function () { flush(); S.task[S.stage] = i + 1; renderTask(); window.scrollTo(0, 0); } } }));
  } else if (S.stage < 4) {
    nav.appendChild(h('button', { type: 'button', class: 'btn ' + stageDef().color, text: 'Continue', on: { click: askContinue } }));
  } else {
    nav.appendChild(h('button', { type: 'button', class: 'btn ' + stageDef().color, disabled: !stageComplete4(), text: 'Submit and log out', on: { click: doLogout } }));
  }
  card.appendChild(nav);
  els.task.appendChild(card);
  if (S.readonly) els.task.querySelectorAll('input, select, textarea, .nav button, .fcard button, .trow, .btn.sm').forEach(function (x) { if (x.textContent !== 'Log in again') x.disabled = true; });
  if (fk) { var f = els.task.querySelector('[data-fk="' + fk + '"]'); if (f) f.focus(); }
  refreshTopLabel();
}
function refreshTopLabel() {
  var lo = document.getElementById('logout');
  if (lo) { var label = S.stage === 4 && stageComplete4() ? 'Submit and log out' : 'Log out'; if (lo.lastChild.textContent !== label) lo.lastChild.textContent = label; }
}

// ---------- continue and lock ----------
function askContinue() {
  dialog('Continue to Stage ' + (S.stage + 1) + '?', [D.msg.confirm], [
    { text: 'Not yet', fn: closeModal }, { text: 'Continue', cls: stageDef().color, fn: function () { lockStage(S.stage); } }]);
}
function lockStage(n) {
  closeModal(); stopTimers();
  api('/api/save', { token: S.token, rev: S.rev, stage: S.stage, answers: S.A, lock: n }).then(function (r) {
    if (r.net) { setSave('waiting'); dialog('Waiting for signal', ['Continue needs a connection. Try again when the signal returns.'], [{ text: 'Close', fn: closeModal }]); return; }
    if (r.status === 409 && r.j.reason === 'device') { goReadonly(); return; }
    if (r.status !== 200) { dialog('Try again', [r.j.error || 'Something went wrong.'], [{ text: 'Close', fn: closeModal }]); return; }
    S.rev = r.j.rev; S.locked = r.j.locked; S.stage = r.j.stage; S.view = 'task'; S.ui.t4 = null;
    lastSaved = JSON.stringify(S.A); writeLocal(false); S.save = 'saved';
    render(); window.scrollTo(0, 0);
    if (n === 3) openSheet(true);
  });
}

// ---------- workspace pane ----------
function folderNode(name, depth) {
  var li = h('li', {}, h('span', { class: 'fl' }, icon('folder'), name));
  var inner = h('ul');
  if (depth < 8) childFolders(name).forEach(function (c) { inner.appendChild(folderNode(c.name, depth + 1)); });
  D.stage1.files.forEach(function (f) {
    var rec = fileRec(f.id);
    if (rec.touched && eqi(rec.folder, name)) inner.appendChild(h('li', { class: 'file' }, icon('file'), h('span', { class: 'mono', text: rec.name })));
  });
  if (inner.firstChild) li.appendChild(inner);
  return li;
}
function buildWs() {
  var c = clear(els.ws);
  c.appendChild(h('h2', { text: 'Workspace' }));
  c.appendChild(h('h3', { text: 'Folders and files' }));
  var root = h('ul', { class: 'tree' }, folderNode('CLIENTS', 0));
  c.appendChild(root);
  var incoming = D.stage1.files.map(function (f) { return fileRec(f.id); }).filter(function (r) { return !r.folder; });
  c.appendChild(h('h3', { text: 'Incoming tray' }));
  if (incoming.length) c.appendChild(h('ul', { class: 'tree' }, incoming.map(function (r) { return h('li', { class: 'file' }, icon('file'), h('span', { class: 'mono', text: r.name })); })));
  else c.appendChild(h('p', { class: 'empty small', text: 'The tray is empty.' }));
  if (S.stage >= 2) {
    c.appendChild(h('h3', { text: 'Groups' }));
    var rows = D.groups.map(function (g) {
      var m = D.people.filter(function (p) { return get('s2.group.' + p.key) === g; }).map(function (p) { return p.name; });
      return [g, m.length ? m.join(', ') : 'No members yet'];
    });
    c.appendChild(table({ head: ['Group', 'Members'], rows: rows }));
    c.appendChild(h('h3', { text: 'Access lines' }));
    var lines = get('s2.lines') || [];
    if (!lines.length) c.appendChild(h('p', { class: 'empty small', text: 'No access lines yet. Every folder is closed.' }));
    else c.appendChild(table({ head: ['Folder', 'Group and level'], rows: D.folders.filter(function (f) { return lines.some(function (l) { return l.folder === f; }); }).map(function (f) {
      return [f, lines.filter(function (l) { return l.folder === f; }).map(function (l) { return l.group + ' ' + l.level; }).join('. ')];
    }) }));
    c.appendChild(h('h3', { text: 'Test as' }));
    var tid = 'testas';
    var sel = selectEl(tid, D.groups, S.ui.testAs, 'Choose a test account', function (v) { S.ui.testAs = v; buildWs(); var x = document.getElementById(tid); if (x) x.focus(); }, 'testas');
    c.appendChild(h('div', { class: 'fld' }, h('label', { for: tid, text: 'Test account' }), sel));
    if (S.ui.testAs) {
      var box = h('div');
      D.folders.forEach(function (f) { var lv = levelOf(S.ui.testAs, f); box.appendChild(h('div', { class: 'testrow' }, h('span', { class: 'mono', text: f }), h('span', { class: 'lvl' + (lv === 'Closed' ? '' : ' on'), text: lv }))); });
      c.appendChild(box);
    }
  }
  if (S.locked.indexOf(3) >= 0) c.appendChild(h('button', { type: 'button', class: 'btn c-teal', on: { click: function () { openSheet(false); } } }, icon('sheet'), ' Protocol sheet'));
}
function buildRef() {
  var c = clear(els.ref);
  c.appendChild(h('h2', { text: 'Reference: file protocol' }));
  D.ref.cards.forEach(function (k) {
    var sec = h('div', { class: 'sheet' }, h('h3', { text: k.h }));
    (k.p || []).forEach(function (p) { sec.appendChild(h('p', { text: p })); });
    if (k.kv) sec.appendChild(kv(k.kv));
    if (k.list) {
      if (k.listLabel) sec.appendChild(h('p', {}, h('b', { text: k.listLabel })));
      sec.appendChild(h(k.listLabel ? 'ol' : 'ul', {}, k.list.map(function (x) { return h('li', { text: x }); })));
    }
    if (k.table) sec.appendChild(table(k.table));
    c.appendChild(sec);
  });
}
function renderSide() {
  if (!els.ws) return;
  buildWs();
  if (!els.ref.firstChild) buildRef();
  renderSideButtons();
}

// ---------- protocol sheet ----------
function ans(q) { var a = get(q.id); return a ? (optText(q, a) || a) : 'Not answered'; }
function folderList(parent, depth) {
  var items = childFolders(parent);
  if (!items.length || depth > 8) return null;
  return h('ul', { class: 'tree' }, items.map(function (f) { return h('li', {}, h('span', { class: 'fl' }, icon('folder'), f.name), folderList(f.name, depth + 1)); }));
}
function buildSheet() {
  var s = h('div', { class: 'sheet' });
  var H = D.stage1.home.concat(D.stage1.purpose);
  s.appendChild(h('h3', { text: 'Workspace home, owner, purpose and classification' }));
  s.appendChild(kv([['Home', ans(H[0])], ['Owner', ans(H[1])], ['Purpose', ans(H[2])], ['Classification', ans(H[3])]]));
  s.appendChild(h('h3', { text: 'Folder tree' }));
  s.appendChild(tree().length ? h('ul', { class: 'tree' }, h('li', {}, h('span', { class: 'fl' }, icon('folder'), 'CLIENTS'), folderList('CLIENTS', 0))) : h('p', { text: 'No folders built.' }));
  s.appendChild(h('h3', { text: 'Naming specimens' }));
  var spec = ['F1', 'F5', 'F8'].map(function (id) { return fileRec(id); }).filter(function (r) { return r.touched; });
  s.appendChild(spec.length ? h('ul', {}, spec.map(function (r) { return h('li', {}, h('span', { class: 'mono', text: r.name })); })) : h('p', { text: 'No files named.' }));
  s.appendChild(h('h3', { text: 'Access table' }));
  s.appendChild(table({ head: ['Folder', 'Group and level'], rows: D.folders.map(function (f) {
    var l = (get('s2.lines') || []).filter(function (x) { return x.folder === f; });
    return [f, l.length ? l.map(function (x) { return x.group + ' ' + x.level; }).join('. ') : 'Closed'];
  }) }));
  s.appendChild(h('h3', { text: 'Link rule for each situation' }));
  s.appendChild(table({ head: ['Situation', 'Link choice'], rows: D.stage2.links.map(function (q) { return [q.text, ans(q)]; }) }));
  s.appendChild(h('h3', { text: 'Version and status rule' }));
  s.appendChild(table({ head: ['Event or file', 'Version or status'], rows: D.stage3.versions.map(function (v) { return [v[1], get(v[0]) || 'Not answered']; })
    .concat(D.stage3.statuses.map(function (v) { return [v[1], get(v[0]) || 'Not answered']; })) }));
  s.appendChild(h('h3', { text: 'Register' }));
  s.appendChild(table({ head: ['Document ID', 'Document', 'Owner', 'Status'], rows: D.stage3.reg.map(function (r) {
    var v = get('s3.reg.' + r.r) || {}; return [v.id || 'Blank', r.title, v.owner || 'Blank', v.status || 'Blank'];
  }) }));
  s.appendChild(h('h3', { text: 'Handoff route' }));
  s.appendChild(h('p', { text: ans(D.stage3.route) }));
  return s;
}
function openSheet(first) {
  var nav = h('div', { class: 'nav' }, h('button', { type: 'button', class: 'btn c-teal', text: first ? 'Close and start Stage 4' : 'Close', on: { click: closeModal } }));
  openModal(h('section', { class: 'card', 'aria-labelledby': 'sh' }, h('h2', { id: 'sh', text: 'Protocol sheet' }),
    h('p', { class: 'small', text: 'This sheet is built from your own answers.' }), buildSheet(), nav));
}

// ---------- start ----------
render();
})();
