/* Sparks & Circuits — interactive widget library (no dependencies).
 * Exposes window.W. See docs/AUTHORING.md for the full API.
 */
(function () {
  'use strict';
  const W = {};
  const root = document.documentElement;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  /* ---------------- DOM helpers ---------------- */
  W.$ = (s, r = document) => (typeof s === 'string' ? r.querySelector(s) : s);
  W.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  W.h = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    attrs = attrs || {};
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  W.cssVar = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const NAMED = ['ink', 'muted', 'accent', 'good', 'bad', 'wire', 'line', 'surface', 'surface2', 'bg', 'link'];
  /** Resolve a colour: 'c1'..'c6', a named token ('ink','muted','accent'...), or any CSS colour. */
  W.col = (c) => {
    if (!c) return W.cssVar('--ink');
    if (/^c\d$/.test(c) || NAMED.includes(c)) return W.cssVar('--' + c);
    return c;
  };
  W.tex = (el, latex, display = false) => {
    el = W.$(el);
    if (window.katex) window.katex.render(latex, el, { throwOnError: false, displayMode: display });
    else el.textContent = latex;
  };
  W.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  W.lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- number formatting & parsing ---------------- */
  const SI = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  /** Format with SI prefix: W.si(0.0123,'A') → "12.3 mA" */
  W.si = (v, unit = '', digits = 3) => {
    if (v == null || !isFinite(v)) return '—';
    if (v === 0) return '0 ' + unit;
    const a = Math.abs(v);
    for (const [m, p] of SI) if (a >= m * 0.99995) return +(v / m).toPrecision(digits) + ' ' + p + unit;
    return v.toExponential(2) + ' ' + unit;
  };
  W.tick = (v) => {
    if (Math.abs(v) < 1e-15) return '0';
    const a = Math.abs(v);
    for (const [m, p] of SI) if (a >= m * 0.9999) return +(v / m).toPrecision(3) + p;
    return v.toExponential(1);
  };
  W.fix = (v, d = 2) => (isFinite(v) ? (+v.toFixed(d)).toString() : '—');
  const PFX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
  /** Parse "20m", "20 mA", "4.7k", "1e-3", "0,02" → number (or NaN) */
  W.parseSI = (s) => {
    s = String(s).trim().replace(/,/g, '.').replace(/\s+/g, '');
    const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)([pnuµμmkMG]?)([A-Za-zΩ°%/²·]*)$/);
    if (!m) return NaN;
    let v = parseFloat(m[1]);
    let p = m[2];
    // "5m" alone is milli; but "5M" with unit like "MHz" still mega. "5 mm"? treat first as prefix.
    if (p) v *= PFX[p];
    return v;
  };

  /* ---------------- animation loop ---------------- */
  /** W.anim((dt, t) => {...}, targetEl?) — RAF loop; pauses while target is off-screen. */
  W.anim = (fn, target) => {
    let run = false, last = 0, id = 0;
    const loop = (t) => {
      if (!run) return;
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      fn(dt, t / 1000);
      id = requestAnimationFrame(loop);
    };
    const h = {
      start() { if (run) return; run = true; last = performance.now(); id = requestAnimationFrame(loop); },
      stop() { run = false; cancelAnimationFrame(id); },
      get running() { return run; },
    };
    const el = target && W.$(target);
    if (el && window.IntersectionObserver) {
      new IntersectionObserver((es) => (es[0].isIntersecting ? h.start() : h.stop())).observe(el);
    } else h.start();
    return h;
  };

  /* ---------------- controls ---------------- */
  W.controls = (parent) => { const d = W.h('div', { class: 'w-controls' }); W.$(parent).append(d); return d; };

  /** W.slider(parent, {label, min, max, step, value, unit, log, format, onInput}) → {get,set,el} */
  W.slider = (parent, o) => {
    const log = !!o.log;
    const input = W.h('input', { type: 'range' });
    const toPos = (v) => (log ? 1000 * Math.log(v / o.min) / Math.log(o.max / o.min) : v);
    const fromPos = (p) => (log ? o.min * Math.pow(o.max / o.min, p / 1000) : +p);
    if (log) { input.min = 0; input.max = 1000; input.step = 1; }
    else { input.min = o.min; input.max = o.max; input.step = o.step ?? (o.max - o.min) / 200; }
    const out = W.h('output');
    const fmt = o.format || ((v) => W.si(v, o.unit || '', 3));
    const lab = W.h('span', { class: 'w-slider-label', html: o.label || '' });
    const row = W.h('label', { class: 'w-slider' }, lab, input, out);
    W.$(parent).append(row);
    let val;
    const set = (v, fire = true) => { val = v; input.value = toPos(v); out.textContent = fmt(v); if (fire && o.onInput) o.onInput(v); };
    input.addEventListener('input', () => { val = fromPos(input.value); out.textContent = fmt(val); if (o.onInput) o.onInput(val); });
    set(o.value ?? o.min, false);
    return { get: () => val, set, el: row, input };
  };

  /** W.readout(parent, {label, unit, fmt}) → {set(v), el} */
  W.readout = (parent, o = {}) => {
    const val = W.h('b', {}, '—');
    const el = W.h('span', { class: 'w-readout' }, W.h('span', { html: o.label || '' }), val);
    W.$(parent).append(el);
    const fmt = o.fmt || ((v) => W.si(v, o.unit || '', 3));
    return { el, set(v) { val.textContent = typeof v === 'string' ? v : fmt(v); }, setClass(c) { el.className = 'w-readout ' + (c || ''); } };
  };

  W.button = (parent, label, onclick, cls = '') => {
    const b = W.h('button', { class: 'btn small ' + cls, type: 'button', html: label });
    b.addEventListener('click', onclick);
    W.$(parent).append(b);
    return b;
  };

  W.toggle = (parent, o) => {
    const inp = W.h('input', { type: 'checkbox' });
    inp.checked = !!o.value;
    const el = W.h('label', { class: 'w-toggle' }, inp, W.h('span', { html: o.label || '' }));
    inp.addEventListener('change', () => o.onChange && o.onChange(inp.checked));
    W.$(parent).append(el);
    return { el, get: () => inp.checked, set(v) { inp.checked = v; o.onChange && o.onChange(v); } };
  };

  W.select = (parent, o) => {
    const s = W.h('select');
    for (const [v, t] of o.options) s.append(W.h('option', { value: v }, t));
    if (o.value != null) s.value = o.value;
    s.addEventListener('change', () => o.onChange && o.onChange(s.value));
    const el = W.h('label', { class: 'w-select' }, W.h('span', { html: o.label || '' }), s);
    W.$(parent).append(el);
    return { el, get: () => s.value, set(v) { s.value = v; o.onChange && o.onChange(v); } };
  };

  /** Segmented buttons: W.segmented(parent, {options:[[val,label]], value, onChange}) */
  W.segmented = (parent, o) => {
    const el = W.h('div', { class: 'w-seg', role: 'group' });
    let cur = o.value ?? o.options[0][0];
    const btns = o.options.map(([v, t]) => {
      const b = W.h('button', { type: 'button', html: t });
      b.addEventListener('click', () => { set(v); });
      el.append(b);
      return [v, b];
    });
    const paint = () => btns.forEach(([v, b]) => b.classList.toggle('on', v === cur));
    const set = (v, fire = true) => { cur = v; paint(); if (fire && o.onChange) o.onChange(v); };
    paint();
    W.$(parent).append(el);
    return { el, get: () => cur, set };
  };

  /* ---------------- canvas ---------------- */
  /** W.canvas(parent, {height | aspect, onResize}) → {canvas, ctx, w, h} (CSS pixels, DPR-aware) */
  W.canvas = (parent, o = {}) => {
    const wrap = W.h('div', { class: 'w-canvas-wrap' });
    const cv = W.h('canvas', { class: 'w-canvas' });
    wrap.append(cv);
    W.$(parent).append(wrap);
    const ctx = cv.getContext('2d');
    const st = { canvas: cv, ctx, w: 0, h: 0, wrap };
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth || 600;
      const h = o.height || Math.round(w / (o.aspect || 2));
      st.w = w; st.h = h;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (o.onResize) o.onResize(st);
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(() => { if (wrap.clientWidth && wrap.clientWidth !== st.w) fit(); }).observe(wrap);
    return st;
  };

  /* ---------------- plotting ---------------- */
  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  class Plot {
    constructor(parent, o = {}) {
      this.o = Object.assign({ xmin: 0, xmax: 1, ymin: -1, ymax: 1, height: 260, xlabel: '', ylabel: '',
        logx: false, logy: false, grid: true, scope: false, hover: false, xfmt: null, yfmt: null }, o);
      this.wrap = W.h('div', { class: 'w-plot-wrap' });
      this.canvas = W.h('canvas', { class: 'w-plot' + (this.o.scope ? ' scope' : '') });
      this.wrap.append(this.canvas);
      W.$(parent).append(this.wrap);
      this.ctx = this.canvas.getContext('2d');
      this.pad = Object.assign({ l: 56, r: 16, t: 14, b: 42 }, o.pad || {});
      this._fn = null; this._leg = []; this._mx = null;
      this._size();
      if (window.ResizeObserver) new ResizeObserver(() => { if (this._size()) this.update(); }).observe(this.wrap);
      document.addEventListener('themechange', () => this.update());
      if (this.o.hover) {
        const mv = (e) => {
          const r = this.canvas.getBoundingClientRect();
          const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
          this._mx = x >= this.pad.l && x <= this.W - this.pad.r ? x : null;
          this.update();
        };
        this.canvas.addEventListener('mousemove', mv);
        this.canvas.addEventListener('touchmove', mv, { passive: true });
        this.canvas.addEventListener('mouseleave', () => { this._mx = null; this.update(); });
      }
    }
    _size() {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(220, this.wrap.clientWidth || 600), h = this.o.height;
      if (w === this.W && h === this.H) return false;
      this.W = w; this.H = h;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    get pw() { return this.W - this.pad.l - this.pad.r; }
    get ph() { return this.H - this.pad.t - this.pad.b; }
    X(x) { const o = this.o; const t = o.logx ? Math.log(x / o.xmin) / Math.log(o.xmax / o.xmin) : (x - o.xmin) / (o.xmax - o.xmin); return this.pad.l + t * this.pw; }
    Y(y) { const o = this.o; const t = o.logy ? Math.log(y / o.ymin) / Math.log(o.ymax / o.ymin) : (y - o.ymin) / (o.ymax - o.ymin); return this.pad.t + (1 - t) * this.ph; }
    invX(px) { const o = this.o; const t = (px - this.pad.l) / this.pw; return o.logx ? o.xmin * Math.pow(o.xmax / o.xmin, t) : o.xmin + t * (o.xmax - o.xmin); }
    invY(py) { const o = this.o; const t = 1 - (py - this.pad.t) / this.ph; return o.logy ? o.ymin * Math.pow(o.ymax / o.ymin, t) : o.ymin + t * (o.ymax - o.ymin); }
    /** Register a draw callback: p.draw(p => { p.fn(...); }) — re-run on resize/theme/hover. */
    draw(fn) { this._fn = fn; this.update(); return this; }
    update() { this.clear(); if (this._fn) this._fn(this); this._drawLegend(); return this; }
    set(o) { Object.assign(this.o, o); return this; }
    _ticks(min, max, log, n) {
      if (log) { const out = []; for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++) out.push(Math.pow(10, e)); return out; }
      const st = niceStep(max - min, n), out = [];
      for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + st * 1e-6; v += st) out.push(Math.abs(v) < st * 1e-6 ? 0 : v);
      return out;
    }
    _clip() { const c = this.ctx; c.beginPath(); c.rect(this.pad.l, this.pad.t, this.pw, this.ph); c.clip(); }
    _style(s, fill) {
      const c = this.ctx, col = W.col(s.color || 'c1');
      c.strokeStyle = col; c.fillStyle = col;
      c.lineWidth = s.width || 2.25; c.setLineDash(s.dash || []);
      c.lineJoin = 'round'; c.lineCap = 'round';
      if (fill) c.globalAlpha = s.alpha ?? 0.18;
      return col;
    }
    clear() {
      const c = this.ctx, o = this.o, sc = o.scope;
      this._leg = [];
      c.setLineDash([]); c.globalAlpha = 1;
      c.clearRect(0, 0, this.W, this.H);
      c.fillStyle = sc ? W.cssVar('--scope-bg') : W.cssVar('--surface');
      c.fillRect(0, 0, this.W, this.H);
      const gridC = sc ? W.cssVar('--scope-grid') : W.cssVar('--line');
      const inkC = sc ? W.cssVar('--scope-ink') : W.cssVar('--muted');
      c.font = '11px ' + FONT; c.lineWidth = 1;
      const xt = this._ticks(o.xmin, o.xmax, o.logx, this.pw / 80);
      const yt = this._ticks(o.ymin, o.ymax, o.logy, this.ph / 42);
      c.strokeStyle = gridC; c.fillStyle = inkC;
      c.textAlign = 'center'; c.textBaseline = 'top';
      const vgrid = (v) => { const x = Math.round(this.X(v)) + 0.5; c.beginPath(); c.moveTo(x, this.pad.t); c.lineTo(x, this.pad.t + this.ph); c.stroke(); };
      const hgrid = (v) => { const y = Math.round(this.Y(v)) + 0.5; c.beginPath(); c.moveTo(this.pad.l, y); c.lineTo(this.pad.l + this.pw, y); c.stroke(); };
      if (o.grid) {
        c.save(); c.globalAlpha = 0.45;
        if (o.logx) for (const d of [xt[0] / 10, ...xt]) for (let k = 2; k < 10; k++) { const v = d * k; if (v > o.xmin && v < o.xmax) vgrid(v); }
        if (o.logy) for (const d of [yt[0] / 10, ...yt]) for (let k = 2; k < 10; k++) { const v = d * k; if (v > o.ymin && v < o.ymax) hgrid(v); }
        c.restore();
      }
      for (const v of xt) { if (o.grid) vgrid(v); c.fillText((o.xfmt || W.tick)(v), this.X(v), this.pad.t + this.ph + 6); }
      c.textAlign = 'right'; c.textBaseline = 'middle';
      for (const v of yt) { if (o.grid) hgrid(v); c.fillText((o.yfmt || W.tick)(v), this.pad.l - 7, this.Y(v)); }
      if (!o.logy && o.ymin < 0 && o.ymax > 0) { c.save(); c.strokeStyle = inkC; c.globalAlpha = 0.6; hgrid(0); c.restore(); }
      if (!o.logx && o.xmin < 0 && o.xmax > 0) { c.save(); c.strokeStyle = inkC; c.globalAlpha = 0.6; vgrid(0); c.restore(); }
      c.strokeStyle = sc ? gridC : W.cssVar('--muted');
      c.strokeRect(this.pad.l + 0.5, this.pad.t + 0.5, this.pw, this.ph);
      c.fillStyle = sc ? inkC : W.cssVar('--ink');
      c.font = '12px ' + FONT;
      if (o.xlabel) { c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(o.xlabel, this.pad.l + this.pw / 2, this.H - 2); }
      if (o.ylabel) { c.save(); c.translate(13, this.pad.t + this.ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.ylabel, 0, 0); c.restore(); }
      if (this._mx != null) { c.save(); c.strokeStyle = inkC; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(this._mx + 0.5, this.pad.t); c.lineTo(this._mx + 0.5, this.pad.t + this.ph); c.stroke(); c.restore(); }
      return this;
    }
    /** Plot y=f(x). s: {color, width, dash, label, samples} */
    fn(f, s = {}) {
      const c = this.ctx, o = this.o, n = s.samples || Math.max(240, Math.round(this.pw * 1.5));
      c.save(); this._clip(); const col = this._style(s);
      c.beginPath(); let pen = false;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = o.logx ? o.xmin * Math.pow(o.xmax / o.xmin, t) : o.xmin + t * (o.xmax - o.xmin);
        const y = f(x);
        if (!isFinite(y) || (o.logy && y <= 0)) { pen = false; continue; }
        const px = this.X(x), py = W.clamp(this.Y(y), -5000, 5000);
        pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true;
      }
      c.stroke(); c.restore();
      if (s.label) this._leg.push([s.label, col, s.dash]);
      if (this._mx != null && s.hover !== false) {
        const x = this.invX(this._mx), y = f(x);
        if (isFinite(y)) {
          this.point(x, y, { color: s.color, r: 4 });
          c.save(); c.font = '12px ' + FONT; c.fillStyle = col; c.textAlign = this._mx > this.W - 140 ? 'right' : 'left'; c.textBaseline = 'bottom';
          const dx = c.textAlign === 'right' ? -8 : 8;
          c.fillText((s.hoverFmt || ((x, y) => `${W.si(x, o.xunit || '')}, ${W.si(y, o.yunit || '')}`))(x, y), this._mx + dx, W.clamp(this.Y(y) - 6, 14, this.H));
          c.restore();
        }
      }
      return this;
    }
    /** Polyline from data points [[x,y],...] */
    line(pts, s = {}) {
      const c = this.ctx; c.save(); this._clip(); const col = this._style(s);
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
      if (s.fill) { c.globalAlpha = s.alpha ?? 0.18; c.closePath(); c.fill(); } else c.stroke();
      c.restore(); if (s.label) this._leg.push([s.label, col, s.dash]);
      return this;
    }
    /** Shade between f and g (or the x-axis) from x0..x1 */
    area(f, x0, x1, s = {}, g = () => 0) {
      const n = 200, pts = [];
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push([x, f(x)]); }
      for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n; pts.push([x, g(x)]); }
      return this.line(pts, Object.assign({ fill: true }, s));
    }
    point(x, y, s = {}) {
      const c = this.ctx; c.save(); const col = this._style(s);
      c.beginPath(); c.arc(this.X(x), this.Y(y), s.r || 5, 0, Math.PI * 2); c.fill();
      if (s.label) { c.font = '12px ' + FONT; c.textAlign = s.align || 'left'; c.textBaseline = 'bottom'; c.fillText(s.label, this.X(x) + (s.align === 'right' ? -8 : 8), this.Y(y) - 6); }
      c.restore(); return this;
    }
    vline(x, s = {}) { const o = this.o; return this.line([[x, o.ymin], [x, o.ymax]], Object.assign({ width: 1.5, dash: [5, 4], color: 'muted' }, s)); }
    hline(y, s = {}) { const o = this.o; return this.line([[o.xmin, y], [o.xmax, y]], Object.assign({ width: 1.5, dash: [5, 4], color: 'muted' }, s)); }
    text(x, y, str, s = {}) {
      const c = this.ctx; c.save(); c.font = (s.size || 12) + 'px ' + FONT; c.fillStyle = W.col(s.color || 'ink');
      c.textAlign = s.align || 'left'; c.textBaseline = s.baseline || 'middle';
      c.fillText(str, this.X(x), this.Y(y)); c.restore(); return this;
    }
    _drawLegend() {
      if (!this._leg.length) return;
      const c = this.ctx; c.save(); c.font = '12px ' + FONT; c.textBaseline = 'middle'; c.textAlign = 'left';
      let y = this.pad.t + 12; const x = this.pad.l + 10;
      const wmax = Math.max(...this._leg.map(([l]) => c.measureText(l).width)) + 36;
      c.fillStyle = this.o.scope ? W.cssVar('--scope-bg') : W.cssVar('--surface'); c.globalAlpha = 0.85;
      c.fillRect(x - 6, y - 10, wmax, this._leg.length * 18 + 2); c.globalAlpha = 1;
      for (const [l, col, dash] of this._leg) {
        c.strokeStyle = col; c.lineWidth = 2.5; c.setLineDash(dash || []);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20, y); c.stroke();
        c.fillStyle = this.o.scope ? W.cssVar('--scope-ink') : W.cssVar('--ink'); c.fillText(l, x + 26, y); y += 18;
      }
      c.restore();
    }
  }
  W.Plot = Plot;
  /** W.plot(parent, opts) → Plot */
  W.plot = (parent, o) => new Plot(parent, o);

  /* ---------------- schematics (SVG) ---------------- */
  const NS = 'http://www.w3.org/2000/svg';
  let schId = 0;
  const S = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  W.svg = S;

  // Two-terminal bodies, drawn along +x centred at origin. len = body length, half = half-height (for label offset).
  // `up(g, x, y, str)` draws text that stays upright regardless of rotation.
  const BODY = {
    R: { len: 40, half: 7, draw: (g) => g.append(S('polyline', { points: '-20,0 -16.7,-6 -10,6 -3.3,-6 3.3,6 10,-6 16.7,6 20,0' })) },
    C: { len: 8, half: 13, draw: (g) => g.append(S('line', { x1: -4, y1: -13, x2: -4, y2: 13 }), S('line', { x1: 4, y1: -13, x2: 4, y2: 13 })) },
    Cpol: { len: 8, half: 13, draw: (g, it, up) => { g.append(S('line', { x1: -4, y1: -13, x2: -4, y2: 13 }), S('path', { d: 'M 8 -13 Q 2 0 8 13' })); up(g, -12, -12, '+', 'sym'); } },
    L: { len: 40, half: 8, draw: (g) => g.append(S('path', { d: 'M -20 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0' })) },
    V: { len: 10, half: 15, draw: (g, it, up) => { g.append(S('line', { x1: -5, y1: -15, x2: -5, y2: 15 }), S('line', { x1: 5, y1: -8, x2: 5, y2: 8, 'stroke-width': 4 })); up(g, -14, -14, '+', 'sym'); } },
    bat2: { len: 26, half: 15, draw: (g, it, up) => { g.append(S('line', { x1: -13, y1: -15, x2: -13, y2: 15 }), S('line', { x1: -5, y1: -8, x2: -5, y2: 8, 'stroke-width': 4 }), S('line', { x1: 5, y1: -15, x2: 5, y2: 15 }), S('line', { x1: 13, y1: -8, x2: 13, y2: 8, 'stroke-width': 4 })); up(g, -21, -14, '+', 'sym'); } },
    Vdc: { len: 34, half: 18, draw: (g, it, up) => { g.append(S('circle', { cx: 0, cy: 0, r: 17 })); up(g, -8, 0, '+', 'sym'); up(g, 8, 0, '−', 'sym'); } },
    Vac: { len: 34, half: 18, draw: (g) => g.append(S('circle', { cx: 0, cy: 0, r: 17 }), S('path', { d: 'M -9 0 q 4.5 -10 9 0 t 9 0' })) },
    Vsq: { len: 34, half: 18, draw: (g) => g.append(S('circle', { cx: 0, cy: 0, r: 17 }), S('polyline', { points: '-10,4 -10,-5 -2,-5 -2,5 6,5 6,-5 10,-5' })) },
    I: { len: 34, half: 18, draw: (g) => g.append(S('circle', { cx: 0, cy: 0, r: 17 }), S('line', { x1: -9, y1: 0, x2: 7, y2: 0 }), S('polygon', { points: '10,0 3,-5 3,5', class: 'fill' })) },
    D: { len: 18, half: 10, draw: (g) => g.append(S('polygon', { points: '-9,-9 -9,9 9,0', class: 'fill' }), S('line', { x1: 9, y1: -10, x2: 9, y2: 10 })) },
    Z: { len: 18, half: 10, draw: (g) => g.append(S('polygon', { points: '-9,-9 -9,9 9,0', class: 'fill' }), S('polyline', { points: '5,-12 9,-10 9,10 13,12' })) },
    S: { len: 18, half: 10, draw: (g) => g.append(S('polygon', { points: '-9,-9 -9,9 9,0', class: 'fill' }), S('polyline', { points: '13,-7 13,-10 9,-10 9,10 5,10 5,7' })) },
    LED: { len: 18, half: 22, draw: (g, it) => {
      g.append(S('circle', { cx: 0, cy: 0, r: 18, class: 'glow', style: `fill:${it.color || '#ffd43b'}` }));
      g.append(S('polygon', { points: '-9,-9 -9,9 9,0', class: 'fill body', style: it.color ? `fill:${it.color}` : null }), S('line', { x1: 9, y1: -10, x2: 9, y2: 10 }));
      g.append(S('path', { d: 'M -2 -12 l 6 -9 M 0 -21 l 4 0 l 0 4 M 5 -11 l 6 -9 M 7 -20 l 4 0 l 0 4' }));
    } },
    SW: { len: 30, half: 12, draw: (g, it) => {
      g.append(S('circle', { cx: -13, cy: 0, r: 2.6, class: 'fill' }), S('circle', { cx: 13, cy: 0, r: 2.6, class: 'fill' }));
      const lever = S('line', { x1: -13, y1: 0, x2: 13, y2: it.closed ? 0 : -13, class: 'lever' });
      g.append(lever, S('rect', { x: -18, y: -20, width: 36, height: 28, class: 'hit' }));
      g.classList.add('clickable');
    } },
    PB: { len: 30, half: 14, draw: (g, it) => {
      g.append(S('circle', { cx: -13, cy: 0, r: 2.6, class: 'fill' }), S('circle', { cx: 13, cy: 0, r: 2.6, class: 'fill' }));
      const bar = S('g', { class: 'lever' }); bar.append(S('line', { x1: -15, y1: -9, x2: 15, y2: -9 }), S('line', { x1: 0, y1: -9, x2: 0, y2: -18 }));
      if (it.closed) bar.setAttribute('transform', 'translate(0 7)');
      g.append(bar, S('rect', { x: -18, y: -22, width: 36, height: 30, class: 'hit' }));
      g.classList.add('clickable');
    } },
    lamp: { len: 26, half: 14, draw: (g, it) => {
      g.append(S('circle', { cx: 0, cy: 0, r: 24, class: 'glow', style: `fill:${it.color || '#ffd43b'}` }));
      g.append(S('circle', { cx: 0, cy: 0, r: 12, class: 'bulb' }), S('line', { x1: -8.5, y1: -8.5, x2: 8.5, y2: 8.5 }), S('line', { x1: -8.5, y1: 8.5, x2: 8.5, y2: -8.5 }));
    } },
    fuse: { len: 30, half: 7, draw: (g) => g.append(S('rect', { x: -15, y: -5, width: 30, height: 10 }), S('line', { x1: -15, y1: 0, x2: 15, y2: 0 })) },
    M: { len: 30, half: 16, draw: (g, it, up) => { g.append(S('circle', { cx: 0, cy: 0, r: 15, class: 'rotor' })); up(g, 0, 0, 'M', 'sym big'); } },
    A: { len: 26, half: 14, draw: (g, it, up) => { g.append(S('circle', { cx: 0, cy: 0, r: 13 })); up(g, 0, 0, 'A', 'sym'); } },
    Vm: { len: 26, half: 14, draw: (g, it, up) => { g.append(S('circle', { cx: 0, cy: 0, r: 13 })); up(g, 0, 0, 'V', 'sym'); } },
    spk: { len: 20, half: 14, draw: (g) => g.append(S('rect', { x: -6, y: -10, width: 8, height: 20 }), S('polygon', { points: '2,-10 12,-18 12,18 2,10' })) },
    xtal: { len: 20, half: 12, draw: (g) => g.append(S('line', { x1: -9, y1: -10, x2: -9, y2: 10 }), S('rect', { x: -5, y: -12, width: 10, height: 24 }), S('line', { x1: 9, y1: -10, x2: 9, y2: 10 })) },
    pot: { len: 40, half: 7, draw: (g) => g.append(S('polyline', { points: '-20,0 -16.7,-6 -10,6 -3.3,-6 3.3,6 10,-6 16.7,6 20,0' }), S('line', { x1: 0, y1: 24, x2: 0, y2: 11 }), S('polygon', { points: '0,7 -4,14 4,14', class: 'fill' })) },
    open: { len: 0, half: 6, draw: () => {} },
  };
  BODY.bat = BODY.V;

  /**
   * W.schematic(parent, {w, h, title, items:[...]}) → api
   * Two-terminal: {t:'R'|'C'|'Cpol'|'L'|'V'|'bat2'|'Vdc'|'Vac'|'Vsq'|'I'|'D'|'Z'|'S'|'LED'|'SW'|'PB'|'lamp'|'fuse'|'M'|'A'|'Vm'|'spk'|'xtal'|'pot',
   *                a:[x,y]|'id.pin', b:[x,y]|'id.pin', id, label, side:1|-1, color, closed, onToggle}
   *   a is the + terminal for V/Vdc, the anode for diodes; I arrow points a→b.
   * Placed: {t:'gnd'|'vcc'|'dot'|'text'|'tag'|'nmos'|'pmos'|'npn'|'pnp'|'opamp'|'ic', at:[x,y], ...}
   * Wires:  {t:'wire', pts:[[x,y]|'id.pin', ...]}
   * Arrow:  {t:'arrow', a, b, label} (current/voltage annotation)
   */
  W.schematic = function (parent, spec) {
    const w = spec.w || 400, h = spec.h || 240, uid = 'sch' + (++schId);
    const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, class: 'w-sch', role: 'img', 'aria-label': spec.title || 'schematic' });
    svg.style.maxWidth = Math.round(w * (spec.scale || 1.3)) + 'px';
    const defs = S('defs');
    const filt = S('filter', { id: uid + 'blur', x: '-60%', y: '-60%', width: '220%', height: '220%' });
    filt.append(S('feGaussianBlur', { stdDeviation: 5 }));
    defs.append(filt); svg.append(defs);
    const gW = S('g', { class: 'wires' }), gF = S('g', { class: 'flow' }), gP = S('g', { class: 'parts' }), gT = S('g', { class: 'labels' });
    svg.append(gW, gP, gF, gT);
    W.$(parent).append(svg);
    const pins = {}, parts = {};
    const api = { svg, pins, parts };
    const P = (p) => {
      if (typeof p !== 'string') return p;
      if (pins[p]) return pins[p];
      console.warn('schematic: unknown pin', p); return [0, 0];
    };
    api.pin = P;
    const label = (x, y, str, anchor = 'middle', cls = 'lbl') => {
      const t = S('text', { x, y, class: cls, 'text-anchor': anchor, 'dominant-baseline': 'middle' }, str);
      gT.append(t); return t;
    };

    function two(it) {
      const a = P(it.a), b = P(it.b);
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const body = BODY[it.t];
      const g = S('g', { class: 'part p-' + it.t, transform: `translate(${mx} ${my}) rotate(${ang})` });
      const bl = Math.min(body.len, L);
      if (L > bl) g.append(S('line', { x1: -L / 2, y1: 0, x2: -bl / 2, y2: 0 }), S('line', { x1: bl / 2, y1: 0, x2: L / 2, y2: 0 }));
      const up = (gg, x, y, str, cls) => gg.append(S('text', { x, y, class: cls || 'sym', 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: `rotate(${-ang} ${x} ${y})` }, str));
      body.draw(g, it, up);
      const glow = g.querySelector('.glow');
      if (glow) { glow.setAttribute('filter', `url(#${uid}blur)`); glow.style.opacity = it.glow || 0; }
      gP.append(g);
      const rec = { g, it, glow, mx, my, a, b };
      if (it.id) { parts[it.id] = rec; pins[it.id + '.a'] = a; pins[it.id + '.b'] = b; }
      const nx = dy / L, ny = -dx / L; // normal: "above" for left→right, "right" for top→bottom
      if (it.t === 'pot' && it.id) pins[it.id + '.w'] = [mx - nx * 24, my - ny * 24];
      const side = it.side || 1, off = (body.half || 12) + 9;
      if (it.label) {
        const lx = mx + nx * off * side, ly = my + ny * off * side;
        const anchor = Math.abs(nx) > 0.5 ? (nx * side > 0 ? 'start' : 'end') : 'middle';
        rec.text = label(lx, ly, it.label, anchor);
      }
      if (it.t === 'SW' || it.t === 'PB') {
        const tog = () => {
          if (it.t === 'PB') return;
          api.set(it.id, { closed: !it.closed });
          if (it.onToggle) it.onToggle(it.closed);
        };
        g.addEventListener('click', tog);
        if (it.t === 'PB') {
          const press = (v) => (e) => { e.preventDefault(); api.set(it.id, { closed: v }); if (it.onToggle) it.onToggle(v); };
          g.addEventListener('pointerdown', press(true));
          g.addEventListener('pointerup', press(false));
          g.addEventListener('pointerleave', (e) => { if (it.closed) press(false)(e); });
        }
      }
      return rec;
    }

    function placed(it) {
      const [x, y] = it.at || [0, 0];
      const g = S('g', { class: 'part p-' + it.t });
      const rec = { g, it };
      const pin = (n, p) => { if (it.id) pins[it.id + '.' + n] = p; };
      switch (it.t) {
        case 'gnd':
          g.append(S('line', { x1: x, y1: y, x2: x, y2: y + 8 }), S('line', { x1: x - 11, y1: y + 8, x2: x + 11, y2: y + 8 }),
            S('line', { x1: x - 7, y1: y + 12.5, x2: x + 7, y2: y + 12.5 }), S('line', { x1: x - 3, y1: y + 17, x2: x + 3, y2: y + 17 }));
          break;
        case 'vcc':
          g.append(S('line', { x1: x, y1: y, x2: x, y2: y - 10 }), S('line', { x1: x - 9, y1: y - 10, x2: x + 9, y2: y - 10 }));
          rec.text = label(x, y - 20, it.label || 'VCC');
          break;
        case 'dot': g.append(S('circle', { cx: x, cy: y, r: 3.2, class: 'fill' })); break;
        case 'text': rec.text = label(x, y, it.text, it.anchor || 'middle', 'lbl ' + (it.cls || '')); break;
        case 'tag': {
          const t = S('text', { x, y, class: 'tag-t', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, it.text || '');
          const r = S('rect', { class: 'tag-r', rx: 6, ry: 6 });
          g.append(r, t); rec.text = t; rec.rect = r;
          rec.fit = () => { const wd = Math.max(28, (t.textContent.length * 7.2) + 14); r.setAttribute('x', x - wd / 2); r.setAttribute('y', y - 11); r.setAttribute('width', wd); r.setAttribute('height', 22); };
          rec.fit();
          break;
        }
        case 'nmos': case 'pmos': {
          const n = it.t === 'nmos';
          g.append(S('line', { x1: x - 30, y1: y, x2: x - 7, y2: y }), S('line', { x1: x - 7, y1: y - 13, x2: x - 7, y2: y + 13 }));
          for (const yy of [-10, 0, 10]) g.append(S('line', { x1: x, y1: y + yy - 4.5, x2: x, y2: y + yy + 4.5 }));
          const top = n ? 'D' : 'S', bot = n ? 'S' : 'D';
          g.append(S('polyline', { points: `${x},${y - 10} ${x + 15},${y - 10} ${x + 15},${y - 30}` }),
            S('polyline', { points: `${x},${y + 10} ${x + 15},${y + 10} ${x + 15},${y + 30}` }),
            S('line', { x1: x, y1: y, x2: x + 15, y2: y }), S('line', { x1: x + 15, y1: y, x2: x + 15, y2: y + (n ? 10 : -10) }));
          g.append(S('polygon', { class: 'fill', points: n ? `${x + 1},${y} ${x + 8},${y - 4} ${x + 8},${y + 4}` : `${x + 14},${y} ${x + 7},${y - 4} ${x + 7},${y + 4}` }));
          pin('G', [x - 30, y]); pin(top, [x + 15, y - 30]); pin(bot, [x + 15, y + 30]);
          if (it.label) rec.text = label(x + 22, y, it.label, 'start');
          break;
        }
        case 'npn': case 'pnp': {
          const n = it.t === 'npn';
          g.append(S('line', { x1: x - 30, y1: y, x2: x - 8, y2: y }), S('line', { x1: x - 8, y1: y - 14, x2: x - 8, y2: y + 14, 'stroke-width': 3 }));
          g.append(S('polyline', { points: `${x - 8},${y - 6} ${x + 15},${y - 20} ${x + 15},${y - 30}` }), S('polyline', { points: `${x - 8},${y + 6} ${x + 15},${y + 20} ${x + 15},${y + 30}` }));
          // arrow on emitter (bottom for npn, top for pnp)
          if (n) g.append(S('polygon', { class: 'fill', points: `${x + 13},${y + 19} ${x + 3},${y + 18} ${x + 8},${y + 11}` }));
          else g.append(S('polygon', { class: 'fill', points: `${x - 6},${y - 7} ${x + 4},${y - 6} ${x - 1},${y - 13}` }));
          pin('B', [x - 30, y]); pin(n ? 'C' : 'E', [x + 15, y - 30]); pin(n ? 'E' : 'C', [x + 15, y + 30]);
          if (it.label) rec.text = label(x + 22, y, it.label, 'start');
          break;
        }
        case 'opamp': {
          const sw = !!it.plusTop;
          g.append(S('polygon', { points: `${x - 30},${y - 34} ${x - 30},${y + 34} ${x + 34},${y}` }));
          g.append(S('line', { x1: x - 50, y1: y - 15, x2: x - 30, y2: y - 15 }), S('line', { x1: x - 50, y1: y + 15, x2: x - 30, y2: y + 15 }), S('line', { x1: x + 34, y1: y, x2: x + 54, y2: y }));
          g.append(S('text', { x: x - 23, y: y - 15, class: 'sym', 'dominant-baseline': 'central' }, sw ? '+' : '−'), S('text', { x: x - 23, y: y + 15, class: 'sym', 'dominant-baseline': 'central' }, sw ? '−' : '+'));
          pin(sw ? '+' : '-', [x - 50, y - 15]); pin(sw ? '-' : '+', [x - 50, y + 15]); pin('out', [x + 54, y]);
          if (it.power) { g.append(S('line', { x1: x, y1: y - 17, x2: x, y2: y - 34 }), S('line', { x1: x, y1: y + 17, x2: x, y2: y + 34 })); pin('V+', [x, y - 34]); pin('V-', [x, y + 34]); }
          if (it.label) rec.text = label(x + 4, y - 40, it.label);
          break;
        }
        case 'ic': {
          const L = it.left || [], R = it.right || [], T = it.top || [], B = it.bottom || [];
          const sp = it.pitch || 20;
          const bw = it.w || Math.max(80, Math.max(T.length, B.length) * sp + 20);
          const bh = it.h || Math.max(L.length, R.length, 1) * sp + 20;
          const x0 = x - bw / 2, y0 = y - bh / 2;
          g.append(S('rect', { x: x0, y: y0, width: bw, height: bh, rx: 4, class: 'icbox' }));
          L.forEach((n, i) => { const yy = y0 + (bh - (L.length - 1) * sp) / 2 + i * sp; g.append(S('line', { x1: x0 - 18, y1: yy, x2: x0, y2: yy })); g.append(S('text', { x: x0 + 5, y: yy, class: 'pin', 'dominant-baseline': 'central' }, n)); pin(n, [x0 - 18, yy]); });
          R.forEach((n, i) => { const yy = y0 + (bh - (R.length - 1) * sp) / 2 + i * sp; g.append(S('line', { x1: x0 + bw, y1: yy, x2: x0 + bw + 18, y2: yy })); g.append(S('text', { x: x0 + bw - 5, y: yy, class: 'pin', 'text-anchor': 'end', 'dominant-baseline': 'central' }, n)); pin(n, [x0 + bw + 18, yy]); });
          T.forEach((n, i) => { const xx = x0 + (bw - (T.length - 1) * sp) / 2 + i * sp; g.append(S('line', { x1: xx, y1: y0 - 18, x2: xx, y2: y0 })); g.append(S('text', { x: xx, y: y0 + 9, class: 'pin', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, n)); pin(n, [xx, y0 - 18]); });
          B.forEach((n, i) => { const xx = x0 + (bw - (B.length - 1) * sp) / 2 + i * sp; g.append(S('line', { x1: xx, y1: y0 + bh, x2: xx, y2: y0 + bh + 18 })); g.append(S('text', { x: xx, y: y0 + bh - 9, class: 'pin', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, n)); pin(n, [xx, y0 + bh + 18]); });
          if (it.name) g.append(S('text', { x, y: L.length || R.length ? y0 - 8 - (T.length ? 18 : 0) : y, class: 'lbl icname', 'text-anchor': 'middle' }, it.name));
          break;
        }
        default: console.warn('schematic: unknown part', it.t);
      }
      gP.append(g);
      if (it.id) parts[it.id] = rec;
      return rec;
    }

    const wires = [];
    for (const it of spec.items || []) {
      if (it.t === 'wire' || it.t === 'arrow') wires.push(it);
      else if (BODY[it.t]) two(it);
      else placed(it);
    }
    for (const it of wires) {
      if (it.t === 'wire') {
        const pts = it.pts.map(P);
        const pl = S('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'wire' + (it.cls ? ' ' + it.cls : '') });
        gW.append(pl);
        if (it.id) parts[it.id] = { g: pl, it };
      } else {
        const a = P(it.a), b = P(it.b), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const g = S('g', { class: 'anno' + (it.color ? '' : '') , style: it.color ? `color:${W.col(it.color)}` : null });
        g.append(S('line', { x1: a[0], y1: a[1], x2: b[0] - 7 * Math.cos(ang), y2: b[1] - 7 * Math.sin(ang) }));
        g.append(S('polygon', { class: 'fill', points: `${b[0]},${b[1]} ${b[0] - 10 * Math.cos(ang) + 5 * Math.sin(ang)},${b[1] - 10 * Math.sin(ang) - 5 * Math.cos(ang)} ${b[0] - 10 * Math.cos(ang) - 5 * Math.sin(ang)},${b[1] - 10 * Math.sin(ang) + 5 * Math.cos(ang)}` }));
        gT.append(g);
        const rec = { g, it };
        if (it.label) rec.text = label((a[0] + b[0]) / 2 + 12 * Math.sin(ang) * (it.side || 1), (a[1] + b[1]) / 2 - 12 * Math.cos(ang) * (it.side || 1), it.label, 'middle', 'lbl anno-t');
        if (it.id) parts[it.id] = rec;
      }
    }

    /** api.set(id, {label, text, glow:0..1, closed, color, spin, hidden, cls}) */
    api.set = (id, props) => {
      const r = parts[id];
      if (!r) return console.warn('schematic: no part', id);
      if ('label' in props && r.text) r.text.textContent = props.label;
      if ('text' in props && r.text) { r.text.textContent = props.text; if (r.fit) r.fit(); }
      if ('glow' in props && r.glow) { r.glow.style.opacity = W.clamp(props.glow, 0, 1); }
      if ('glow' in props && r.g.querySelector('.bulb')) r.g.querySelector('.bulb').style.fill = props.glow > 0.05 ? `rgba(255,212,59,${W.clamp(props.glow, 0, 1)})` : '';
      if ('closed' in props) {
        r.it.closed = props.closed;
        const lv = r.g.querySelector('.lever');
        if (r.it.t === 'SW') lv.setAttribute('y2', props.closed ? 0 : -13);
        else if (lv) lv.setAttribute('transform', props.closed ? 'translate(0 7)' : '');
      }
      if ('hidden' in props) r.g.style.display = props.hidden ? 'none' : '';
      if ('cls' in props) r.g.classList.toggle(props.cls[0], props.cls[1]);
      if ('stroke' in props) r.g.style.stroke = props.stroke ? W.col(props.stroke) : '';
      if ('spin' in props) {
        const rot = r.g.querySelector('.rotor');
        if (rot) { r.spin = props.spin; ensureLoop(); }
      }
    };
    api.on = (id, ev, fn) => parts[id] && parts[id].g.addEventListener(ev, fn);

    /* ----- moving charge dots ----- */
    const flows = [];
    let loop = null;
    function ensureLoop() {
      if (loop) return;
      loop = W.anim((dt) => {
        for (const f of flows) { f.phase = ((f.phase + f.speed * f.dir * 60 * dt) % f.total + f.total) % f.total; place(f); }
        for (const id in parts) {
          const r = parts[id];
          if (r.spin == null) continue;
          r.ang = ((r.ang || 0) + r.spin * 360 * dt) % 360;
          const rot = r.g.querySelector('.rotor');
          rot.style.strokeDasharray = r.spin ? '18 6' : '';
          rot.style.strokeDashoffset = -r.ang / 3;
        }
      }, svg);
    }
    function at(f, d) {
      for (let i = 0; i < f.seg.length; i++) {
        if (d <= f.seg[i] || i === f.seg.length - 1) {
          const [x1, y1] = f.pts[i], [x2, y2] = f.pts[i + 1], t = f.seg[i] ? Math.min(1, d / f.seg[i]) : 0;
          return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
        }
        d -= f.seg[i];
      }
      return f.pts[0];
    }
    function place(f) {
      const n = f.dots.length;
      f.dots.forEach((c, i) => { const [x, y] = at(f, (f.phase + i * f.total / n) % f.total); c.setAttribute('cx', x); c.setAttribute('cy', y); });
      const hide = f.hideWhenStopped && Math.abs(f.speed) < 1e-4;
      f.g.style.opacity = hide ? 0 : 1;
    }
    /**
     * api.flow(pts, {speed, spacing, r, color, electrons, hideWhenStopped}) → {set(speed)}
     * Animated dots moving along a polyline (closed loops: repeat first point at end).
     * electrons:true → blue dots moving opposite to the path direction.
     */
    api.flow = (pts, o = {}) => {
      pts = pts.map(P);
      const seg = []; let total = 0;
      for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
      const n = Math.max(1, Math.round(total / (o.spacing || 18)));
      const g = S('g'); gF.append(g);
      const col = W.col(o.color || (o.electrons ? 'c1' : 'c2'));
      const dots = Array.from({ length: n }, () => { const c = S('circle', { r: o.r || 2.8, class: 'flowdot', style: `fill:${col}` }); g.append(c); return c; });
      const f = { pts, seg, total, dots, g, phase: 0, speed: o.speed ?? 1, dir: o.electrons ? -1 : 1, hideWhenStopped: o.hideWhenStopped !== false && !o.electrons };
      f.set = (v) => { f.speed = v; if (!loop || !loop.running) place(f); };
      f.remove = () => { g.remove(); flows.splice(flows.indexOf(f), 1); };
      flows.push(f); place(f); ensureLoop();
      return f;
    };
    return api;
  };

  /* ---------------- DC circuit solver (Modified Nodal Analysis) ---------------- */
  function gauss(A, b) {
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-18) return null;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
    return x;
  }
  /**
   * W.solveDC([{name, type:'R'|'V'|'I'|'D', n:[a,b], value, vf, rs}]) → {v:{node:volts}, i:{name:amps}}
   * Ground node is '0' (or 'gnd'). R current is a→b. V: n[0] is +, i = current delivered out of +.
   * I: current value flows from n[0] through the source out of n[1]. D: piecewise-linear (vf, rs), i anode→cathode.
   */
  W.solveDC = function (els) {
    const GND = new Set(['0', 'gnd', 'GND']);
    const idx = {}; let n = 0;
    els.forEach((e, k) => { if (!e.name) e.name = e.type + k; for (const nd of e.n) if (!GND.has(nd) && !(nd in idx)) idx[nd] = n++; });
    const on = new Map(els.filter((e) => e.type === 'D').map((e) => [e, false]));
    let res = null;
    for (let iter = 0; iter < 40; iter++) {
      const vs = els.filter((e) => e.type === 'V' || (e.type === 'D' && on.get(e)));
      const m = vs.length, N = n + m;
      const A = Array.from({ length: N }, () => new Float64Array(N)), z = new Float64Array(N);
      const I = (nd) => (GND.has(nd) ? -1 : idx[nd]);
      const G = (a, b, g) => { const i = I(a), j = I(b); if (i >= 0) A[i][i] += g; if (j >= 0) A[j][j] += g; if (i >= 0 && j >= 0) { A[i][j] -= g; A[j][i] -= g; } };
      for (const e of els) {
        if (e.type === 'R') G(e.n[0], e.n[1], 1 / Math.max(Math.abs(e.value), 1e-9));
        else if (e.type === 'I') { const i = I(e.n[0]), j = I(e.n[1]); if (i >= 0) z[i] -= e.value; if (j >= 0) z[j] += e.value; }
        else if (e.type === 'D' && !on.get(e)) G(e.n[0], e.n[1], 1e-12);
      }
      for (let i = 0; i < n; i++) A[i][i] += 1e-12;
      vs.forEach((e, k) => {
        const r = n + k, i = I(e.n[0]), j = I(e.n[1]);
        if (i >= 0) { A[i][r] += 1; A[r][i] += 1; }
        if (j >= 0) { A[j][r] -= 1; A[r][j] -= 1; }
        if (e.type === 'V') z[r] = e.value; else { z[r] = e.vf ?? 0.7; A[r][r] -= e.rs ?? 0.5; }
      });
      const x = gauss(A, z);
      if (!x) return null;
      const v = {}; for (const k in idx) v[k] = x[idx[k]]; for (const g of GND) v[g] = 0;
      const cur = {}; let changed = false;
      for (const e of els) {
        const va = v[e.n[0]], vb = v[e.n[1]];
        if (e.type === 'R') cur[e.name] = (va - vb) / e.value;
        else if (e.type === 'I') cur[e.name] = e.value;
        else if (e.type === 'V') cur[e.name] = -x[n + vs.indexOf(e)];
        else if (e.type === 'D') {
          if (on.get(e)) { const id = x[n + vs.indexOf(e)]; cur[e.name] = id; if (id < -1e-12) { on.set(e, false); changed = true; } }
          else { cur[e.name] = 0; if (va - vb > (e.vf ?? 0.7) + 1e-9) { on.set(e, true); changed = true; } }
        }
      }
      res = { v, i: cur };
      if (!changed) break;
    }
    return res;
  };

  /* ---------------- small visuals ---------------- */
  /** W.bulb(parent, {size, color}) → {set(brightness 0..1), el} — a friendly light bulb */
  W.bulb = (parent, o = {}) => {
    const s = o.size || 90, col = o.color || '#ffd43b';
    const svg = S('svg', { viewBox: '0 0 100 140', width: s, height: s * 1.4, class: 'w-bulb' });
    const id = 'bulb' + (++schId);
    const f = S('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }); f.append(S('feGaussianBlur', { stdDeviation: 9 }));
    const d = S('defs'); d.append(f); svg.append(d);
    const halo = S('circle', { cx: 50, cy: 52, r: 46, fill: col, filter: `url(#${id})`, opacity: 0 });
    const glass = S('path', { d: 'M50 8 C 24 8 12 28 12 48 C 12 66 26 76 32 90 L 68 90 C 74 76 88 66 88 48 C 88 28 76 8 50 8 Z', class: 'glass' });
    const fil = S('path', { d: 'M38 90 L 42 58 Q 46 50 50 58 Q 54 50 58 58 L 62 90', class: 'filament' });
    const base = S('g', { class: 'base' });
    for (let i = 0; i < 4; i++) base.append(S('rect', { x: 32, y: 92 + i * 9, width: 36, height: 7, rx: 3 }));
    base.append(S('path', { d: 'M42 128 L58 128 L54 136 L46 136 Z' }));
    svg.append(halo, glass, fil, base);
    W.$(parent).append(svg);
    return {
      el: svg,
      set(b) { b = W.clamp(b, 0, 1); halo.setAttribute('opacity', b); glass.style.fill = b > 0.02 ? `color-mix(in srgb, ${col} ${Math.round(20 + 80 * b)}%, transparent)` : ''; fil.style.stroke = b > 0.02 ? '#ff922b' : ''; },
    };
  };

  window.W = W;
})();
