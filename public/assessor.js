(function () {
'use strict';
var root = document.getElementById('root');
var SK = 'w13assessor';
var data = null;               // { generated, learners }
var ui = { view: 'learners', q: '', tests: false, sort: { key: 'name', dir: 1 }, sel: {} };
var mq = window.matchMedia('(min-width:760px)');

function h(tag, a) {
  var el = document.createElement(tag); a = a || {};
  Object.keys(a).forEach(function (k) {
    var v = a[k]; if (v == null || v === false) return;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
    else if (k === 'on') Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
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
  var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), u = document.createElementNS(ns, 'use');
  s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); u.setAttribute('href', 'img/sprite.svg#i-' + name); s.appendChild(u); return s;
}
function reset() { while (root.lastChild && root.lastChild.className !== 'blot') root.removeChild(root.lastChild); }

function getTok() { try { var r = sessionStorage.getItem(SK); return r ? JSON.parse(r) : null; } catch { return null; } }
function setTok(t) { try { if (t) sessionStorage.setItem(SK, JSON.stringify(t)); else sessionStorage.removeItem(SK); } catch { /* memory only */ } }
var tok = getTok();
if (tok && tok.expires * 1000 <= Date.now()) { tok = null; setTok(null); }

// ---------- locked screen ----------
function locked(message) {
  reset();
  var msg = h('p', { class: 'msg err', role: 'status', 'aria-live': 'polite', text: message || '' });
  var pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password' });
  var btn = h('button', { type: 'button', class: 'btn c-teal', text: 'Open records' });
  function go() {
    btn.disabled = true; msg.textContent = '';
    fetch('/api/assessor/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw.value }) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (r) {
        btn.disabled = false;
        if (r.s === 200) { tok = { token: r.j.token, expires: r.j.expires }; setTok(tok); load(); return; }
        msg.textContent = r.j.error || 'Check the password and try again.';
      }, function () { btn.disabled = false; msg.textContent = 'Waiting for signal. Try again.'; });
  }
  btn.addEventListener('click', go);
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  root.appendChild(h('section', { class: 'sheet lock', 'aria-labelledby': 'ah' },
    h('h2', { id: 'ah' }, icon('lock'), ' Assessor'),
    h('div', { class: 'fld' }, h('label', { for: 'pw', text: 'Password' }), pw), msg, btn));
  pw.focus();
}

function load() {
  reset();
  root.appendChild(h('section', { class: 'sheet lock', role: 'status' }, h('h2', { text: 'Assessor' }), h('p', { text: 'Loading records.' })));
  fetch('/api/assessor/list', { headers: { authorization: 'Bearer ' + (tok ? tok.token : '') } })
    .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
    .then(function (r) {
      if (r.s === 401) { tok = null; setTok(null); locked('Log in again.'); return; }
      if (r.s !== 200) { locked(r.j.error || 'Try again.'); return; }
      data = r.j; render();
    }, function () { locked('Waiting for signal. Try again.'); });
}

// ---------- model ----------
function bestOf(l) { return l.attempts.some(function (a) { return a.state === 'submitted'; }) ? l.best : null; }
function scoreText(l) { var b = bestOf(l); return b == null ? (l.attempts.length ? 'In progress' : 'Not started') : b.toFixed(2); }
function shown() {
  var q = ui.q.trim().toLowerCase();
  return data.learners.filter(function (l) {
    if (l.test && !ui.tests) return false;
    return !q || l.name.toLowerCase().indexOf(q) >= 0 || l.email.toLowerCase().indexOf(q) >= 0;
  });
}
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function learnerSort(list) {
  var k = ui.sort.key, d = ui.sort.dir;
  var f = { name: function (l) { return l.name.toLowerCase(); }, email: function (l) { return l.email.toLowerCase(); },
    attempts: function (l) { return l.attempts.length; }, score: function (l) { var b = bestOf(l); return b == null ? -1 : b; } }[k];
  if (!f) { f = function (l) { return l.name.toLowerCase(); }; d = 1; }
  return list.slice().sort(function (x, y) { return cmp(f(x), f(y)) * d || cmp(x.name.toLowerCase(), y.name.toLowerCase()); });
}
function attemptRows(list) {
  var rows = [];
  list.forEach(function (l) { l.attempts.forEach(function (a) { rows.push({ l: l, a: a }); }); });
  var k = ui.sort.key, d = ui.sort.dir;
  var f = { name: function (r) { return r.l.name.toLowerCase(); }, email: function (r) { return r.l.email.toLowerCase(); },
    attempt: function (r) { return r.a.n; }, status: function (r) { return r.a.state; }, score: function (r) { return r.a.score == null ? -1 : r.a.score; } }[k] || function (r) { return r.l.name.toLowerCase(); };
  return rows.sort(function (x, y) { return cmp(f(x), f(y)) * d || cmp(x.l.name.toLowerCase(), y.l.name.toLowerCase()) || x.a.n - y.a.n; });
}

// ---------- CSV ----------
function cell(v) {
  var s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = '\t' + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function csvFor(list) {
  var out = ['name,email,score'];
  list.forEach(function (l) { var b = bestOf(l); out.push([cell(l.name), cell(l.email), cell(b == null ? '' : b.toFixed(2))].join(',')); });
  return '\uFEFF' + out.join('\r\n') + '\r\n';
}
function stamp() { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function download(list) {
  var blob = new Blob([csvFor(list)], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'week13_scores_' + stamp() + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

// ---------- open screen ----------
function selCount() { return Object.keys(ui.sel).filter(function (k) { return ui.sel[k]; }).length; }
function toggle(id, on) { if (on) ui.sel[id] = true; else delete ui.sel[id]; }
function sortBy(k) { ui.sort = { key: k, dir: ui.sort.key === k ? -ui.sort.dir : 1 }; render(); }

function render(focusId) {
  reset();
  var list = shown();
  var sheet = h('section', { class: 'sheet', 'aria-labelledby': 'ah' });
  sheet.appendChild(h('div', { class: 'head' }, h('h2', { id: 'ah', text: 'Assessor' }),
    h('span', { class: 'grow' }),
    h('button', { type: 'button', class: 'btn auto ghost', on: { click: load } }, 'Refresh'),
    h('button', { type: 'button', class: 'btn auto ghost', on: { click: function () { tok = null; setTok(null); data = null; ui.sel = {}; locked(''); } } }, icon('out'), 'Log out'),
    h('p', { text: 'Showing ' + list.length + ' learners', role: 'status' })));
  var view = h('select', { id: 'view', 'aria-label': 'View', on: { change: function (e) { ui.view = e.target.value; ui.sort = { key: 'name', dir: 1 }; render('view'); } } },
    h('option', { value: 'learners', text: 'Learners and attempts', selected: ui.view === 'learners' }),
    h('option', { value: 'attempts', text: 'All attempts', selected: ui.view === 'attempts' }));
  var search = h('input', { type: 'search', id: 'q', 'aria-label': 'Search name or email', placeholder: 'Search name or email', value: ui.q });
  search.addEventListener('input', function () { ui.q = search.value; render('q'); });
  var tests = h('input', { type: 'checkbox', id: 'tests', checked: ui.tests, on: { change: function (e) { ui.tests = e.target.checked; render('tests'); } } });
  sheet.appendChild(h('div', { class: 'bar' }, view, search,
    h('label', { class: 'chk', for: 'tests' }, tests, 'Show test accounts'),
    h('button', { type: 'button', class: 'btn c-teal', id: 'dlall', on: { click: function () { download(learnerSort(data.learners.filter(function (l) { return ui.tests || !l.test; }))); } } }, 'Download all')));
  sheet.appendChild(ui.view === 'learners' ? learnersList(list) : attemptsList(list));
  var n = selCount();
  sheet.appendChild(h('div', { class: 'selbar' }, h('b', { text: n + ' selected', role: 'status' }),
    h('button', { type: 'button', class: 'btn auto ghost', text: 'Select all shown', on: { click: function () { list.forEach(function (l) { toggle(l.id, true); }); render(); } } }),
    h('button', { type: 'button', class: 'btn auto ghost', text: 'Clear', on: { click: function () { ui.sel = {}; render(); } } }),
    h('button', { type: 'button', class: 'btn c-sun auto', id: 'dlsel', disabled: n === 0, text: 'Download selected', on: { click: function () {
      download(learnerSort(data.learners.filter(function (l) { return ui.sel[l.id]; })));
    } } })));
  root.appendChild(sheet);
  if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); if (f.setSelectionRange && f.type === 'search') f.setSelectionRange(f.value.length, f.value.length); } }
}
function th(label, key) {
  var on = ui.sort.key === key;
  return h('th', { scope: 'col', 'aria-sort': on ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none' },
    h('button', { type: 'button', on: { click: function () { sortBy(key); } } }, label + (on ? (ui.sort.dir > 0 ? ' \u25B2' : ' \u25BC') : '')));
}
function cb(l) {
  return h('label', { class: 'hit' }, h('input', { type: 'checkbox', class: 'cb', checked: !!ui.sel[l.id], 'aria-label': 'Select ' + l.name, on: { change: function (e) { toggle(l.id, e.target.checked); render(); } } }));
}
function learnersList(list) {
  var rows = learnerSort(list);
  if (mq.matches) {
    return h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Select' }), th('Name', 'name'), th('Email', 'email'), th('Attempts', 'attempts'), th('Score', 'score'))),
      h('tbody', {}, rows.map(function (l) { return h('tr', {}, h('td', {}, cb(l)), h('td', { text: l.name }), h('td', { text: l.email }), h('td', { text: l.attempts.length + ' of 3' }), h('td', { text: scoreText(l) })); }))));
  }
  return h('div', { class: 'rows' }, rows.map(function (l) {
    return h('div', { class: 'rowc' }, cb(l), h('b', { text: l.name }), h('span', { text: l.email }), h('span', { text: 'Attempts ' + l.attempts.length + ' of 3, Score ' + scoreText(l) }));
  }));
}
function attemptsList(list) {
  var rows = attemptRows(list);
  var st = function (a) { return a.state === 'submitted' ? 'Submitted' : 'Open'; };
  var sc = function (a) { return a.score == null ? 'In progress' : a.score.toFixed(2); };
  if (mq.matches) {
    return h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Select' }), th('Name', 'name'), th('Email', 'email'), th('Attempt', 'attempt'), th('Status', 'status'), th('Score', 'score'))),
      h('tbody', {}, rows.map(function (r) { return h('tr', {}, h('td', {}, cb(r.l)), h('td', { text: r.l.name }), h('td', { text: r.l.email }), h('td', { text: String(r.a.n) }), h('td', { text: st(r.a) }), h('td', { text: sc(r.a) })); }))));
  }
  return h('div', { class: 'rows' }, rows.map(function (r) {
    return h('div', { class: 'rowc' }, cb(r.l), h('b', { text: r.l.name }), h('span', { text: r.l.email }), h('span', { text: 'Attempt ' + r.a.n + ', ' + st(r.a) + ', Score ' + sc(r.a) }));
  }));
}
mq.addEventListener('change', function () { if (data) render(); });

if (tok) load(); else locked('');
})();
