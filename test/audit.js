// Evaluated in the page: overflow, tap targets, contrast. Returns a plain object.
() => {
  const num = s => s.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const colours = s => (s.match(/rgba?\([^)]*\)/g) || []).map(c => num(c)).filter(c => c.length < 4 || c[3] > 0.9).map(c => c.slice(0, 3));
  const stops = el => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage.includes('gradient')) { const c = colours(cs.backgroundImage); if (c.length) return c; }
      const bg = colours(cs.backgroundColor); if (bg.length) return bg;
    }
    return [[11, 18, 48]];
  };
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const out = { overflowX: document.documentElement.scrollWidth - window.innerWidth, small: [], low: [], bodyText: [], texts: 0 };
  const sel = 'button, select, input:not([type=radio]):not([type=checkbox]), a[href], label.opt, label.hit, .trow, label.chk';
  document.querySelectorAll(sel).forEach(el => {
    if (el.classList.contains('skip') || !visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) out.small.push((el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (el.textContent || '').slice(0, 20));
  });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || !visible(el) || el.closest('.scene,.sr,noscript,option,script')) continue;
    if (el.disabled || el.closest('button[disabled]')) continue;
    const cs = getComputedStyle(el); const fg = colours(cs.color)[0]; if (!fg) continue;
    out.texts++;
    const worst = Math.min(...stops(el).map(b => ratio(fg, b)));
    if (worst < 4.5) out.low.push(n.nodeValue.trim().slice(0, 30) + ' ' + worst.toFixed(2));
    const fs = parseFloat(cs.fontSize);
    if (fs < 16 && el.closest('.card, .sheet') && !el.closest('button, .chip, .pill-tag, .lvl, th')) out.bodyText.push(n.nodeValue.trim().slice(0, 24) + ' ' + fs);
  }
  return out;
}
