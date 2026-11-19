/* Sparky's Circuit Adventure — small shared toolkit for the kids' levels (window.K).
 * Load after widgets.js and book.js, before the level script.
 * Cartoon SVG parts (Sparky, battery, bulb, wires, moving Sparky dots), big buttons, beeps.
 */
(function () {
  'use strict';
  const S = W.svg;
  let uid = 0;
  const K = {};

  /** K.svg(parent, w, h, {title, max, cls}) → <svg class="art"> with a viewBox */
  K.svg = (parent, w, h, o = {}) => {
    const s = S('svg', { viewBox: `0 0 ${w} ${h}`, class: 'art ' + (o.cls || ''), role: 'img', 'aria-label': o.title || 'picture' });
    if (o.max) s.style.maxWidth = o.max + 'px';
    W.$(parent).append(s);
    return s;
  };
  /** K.add(parent, tag, attrs, text) → new SVG element appended to parent */
  K.add = (parent, tag, attrs, text) => { const e = S(tag, attrs || {}, text); parent.append(e); return e; };
  K.g = (parent, attrs) => K.add(parent, 'g', attrs || {});
  K.text = (parent, x, y, str, o = {}) => K.add(parent, 'text', { x, y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', style: `fill:${o.fill || 'var(--ink)'};font:${o.weight || 600} ${o.size || 16}px Fredoka, system-ui, sans-serif;${o.style || ''}` }, str);
  K.emoji = (parent, x, y, str, size = 30) => K.add(parent, 'text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font-size:${size}px` }, str);
  /** a blur filter in the svg's defs; returns its url() */
  K.blur = (svg, sd = 8) => {
    let defs = svg.querySelector('defs');
    if (!defs) { defs = S('defs'); svg.prepend(defs); }
    const id = 'kblur' + (++uid);
    const f = S('filter', { id, x: '-80%', y: '-80%', width: '260%', height: '260%' });
    f.append(S('feGaussianBlur', { stdDeviation: sd }));
    defs.append(f);
    return `url(#${id})`;
  };
  K.place = (el, x, y, s = 1, rot = 0) => el.setAttribute('transform', `translate(${x} ${y}) rotate(${rot}) scale(${s})`);

  /** Sparky the electron: a cheerful yellow ball with a lightning-bolt tuft. Returns a <g> with .move(x,y,scale,rot) */
  K.sparky = (parent, x, y, r = 20, o = {}) => {
    const g = K.g(parent, { class: 'sparky' });
    const sw = (k) => (r * k).toFixed(2);
    if (!o.tiny) K.add(g, 'path', { d: `M ${-r * 0.2} ${-r * 0.9} L ${r * 0.18} ${-r * 1.55} L ${r * 0.08} ${-r * 1.1} L ${r * 0.45} ${-r * 1.25} L ${r * 0.18} ${-r * 0.85} Z`, style: `fill:#fab005;stroke:#e67700;stroke-width:${sw(0.07)};stroke-linejoin:round` });
    K.add(g, 'circle', { r, style: `fill:#ffd43b;stroke:#f08c00;stroke-width:${sw(0.1)}` });
    K.add(g, 'circle', { cx: -r * 0.36, cy: -r * 0.12, r: r * 0.17, style: 'fill:#1d2026' });
    K.add(g, 'circle', { cx: r * 0.36, cy: -r * 0.12, r: r * 0.17, style: 'fill:#1d2026' });
    if (!o.tiny) {
      K.add(g, 'circle', { cx: -r * 0.3, cy: -r * 0.19, r: r * 0.06, style: 'fill:#fff' });
      K.add(g, 'circle', { cx: r * 0.42, cy: -r * 0.19, r: r * 0.06, style: 'fill:#fff' });
      K.add(g, 'circle', { cx: -r * 0.62, cy: r * 0.22, r: r * 0.14, style: 'fill:#ff8787;opacity:.6' });
      K.add(g, 'circle', { cx: r * 0.62, cy: r * 0.22, r: r * 0.14, style: 'fill:#ff8787;opacity:.6' });
    }
    K.add(g, 'path', { d: o.sad ? `M ${-r * 0.35} ${r * 0.45} Q 0 ${r * 0.15} ${r * 0.35} ${r * 0.45}` : `M ${-r * 0.4} ${r * 0.2} Q 0 ${r * 0.68} ${r * 0.4} ${r * 0.2}`, style: `fill:none;stroke:#1d2026;stroke-width:${sw(0.1)};stroke-linecap:round` });
    g.move = (xx, yy, s = 1, rot = 0) => K.place(g, xx, yy, s, rot);
    g.move(x, y);
    return g;
  };

  /** Cartoon AA-style battery centred at (x,y). rot=-90 puts + at the top. Returns {g, plus, minus} */
  K.battery = (parent, x, y, o = {}) => {
    const w = o.w || 96, h = o.h || 42, rot = o.rot || 0;
    const g = K.g(parent, { class: 'kbat', transform: `translate(${x} ${y}) rotate(${rot})` });
    K.add(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: h * 0.22, style: 'fill:#343a40;stroke:var(--wire);stroke-width:2' });
    K.add(g, 'path', { d: `M ${w * 0.18} ${-h / 2} H ${w / 2 - h * 0.22} Q ${w / 2} ${-h / 2} ${w / 2} ${-h / 2 + h * 0.22} V ${h / 2 - h * 0.22} Q ${w / 2} ${h / 2} ${w / 2 - h * 0.22} ${h / 2} H ${w * 0.18} Z`, style: 'fill:' + (o.color || '#f08c00') });
    K.add(g, 'rect', { x: w / 2, y: -h * 0.18, width: 7, height: h * 0.36, rx: 2, style: 'fill:#adb5bd;stroke:var(--wire);stroke-width:1.5' });
    const t = (xx, str, sz) => K.add(g, 'text', { x: xx, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: `rotate(${-rot} ${xx} 0)`, style: `fill:#fff;font:700 ${sz}px system-ui, sans-serif` }, str);
    t(w * 0.34, '+', h * 0.6); t(-w * 0.33, '−', h * 0.6);
    if (o.label) {
      const lab = K.add(g, 'text', { x: -w * 0.06, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: `rotate(${-rot} ${-w * 0.06} 0)`, style: `fill:#fff;font:600 ${Math.round(h * 0.34)}px Fredoka, system-ui, sans-serif` }, o.label);
      g.label = lab;
    }
    const r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const pt = (lx) => [x + lx * c, y + lx * s];
    return { g, plus: pt(w / 2 + 7), minus: pt(-w / 2) };
  };

  /** Cartoon light bulb with its socket bottom at (x,y). Returns {g, set(0..1), pins:[left,right]} */
  K.lamp = (parent, x, y, o = {}) => {
    const s = o.s || 1, col = o.color || '#ffd43b';
    const svg = parent.ownerSVGElement || parent;
    const g = K.g(parent, { class: 'klamp', transform: `translate(${x} ${y}) scale(${s})` });
    const halo = K.add(g, 'circle', { cx: 0, cy: -52, r: 44, style: `fill:${col};opacity:0`, filter: K.blur(svg, 10) });
    const rays = K.g(g, { style: 'opacity:0;stroke:' + col + ';stroke-width:4;stroke-linecap:round' });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; K.add(rays, 'line', { x1: Math.cos(a) * 40, y1: -52 + Math.sin(a) * 40, x2: Math.cos(a) * 52, y2: -52 + Math.sin(a) * 52 }); }
    const glass = K.add(g, 'path', { d: 'M -16 -20 C -18 -30 -30 -38 -30 -54 C -30 -72 -16 -82 0 -82 C 16 -82 30 -72 30 -54 C 30 -38 18 -30 16 -20 Z', style: 'fill:color-mix(in srgb, var(--surface) 75%, transparent);stroke:var(--wire);stroke-width:3' });
    const fil = K.add(g, 'path', { d: 'M -8 -20 L -6 -48 Q -3 -56 0 -48 Q 3 -56 6 -48 L 8 -20', style: 'fill:none;stroke:var(--muted);stroke-width:2.5;stroke-linejoin:round' });
    K.add(g, 'rect', { x: -17, y: -20, width: 34, height: 18, rx: 4, style: 'fill:#adb5bd;stroke:var(--wire);stroke-width:2' });
    K.add(g, 'line', { x1: -17, y1: -11, x2: 17, y2: -11, style: 'stroke:var(--wire);stroke-width:1.5' });
    K.add(g, 'rect', { x: -30, y: -2, width: 60, height: 10, rx: 4, style: 'fill:var(--muted);stroke:var(--wire);stroke-width:2' });
    let cur = 0;
    const api = {
      g, halo,
      pins: [[x - 30 * s, y + 3 * s], [x + 30 * s, y + 3 * s]],
      set(b) {
        b = W.clamp(b, 0, 1); cur = b;
        halo.style.opacity = b;
        rays.style.opacity = b > 0.55 ? (b - 0.55) / 0.45 : 0;
        glass.style.fill = b > 0.02 ? `color-mix(in srgb, ${col} ${Math.round(25 + 75 * b)}%, var(--surface))` : 'color-mix(in srgb, var(--surface) 75%, transparent)';
        fil.style.stroke = b > 0.02 ? '#ff922b' : 'var(--muted)';
      },
      get: () => cur,
    };
    return api;
  };

  /** Thick cartoon wire through points. o.cls adds a class; o.color overrides */
  K.wire = (parent, pts, o = {}) => K.add(parent, 'polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'kwire ' + (o.cls || ''), style: `fill:none;stroke:${o.color || 'var(--wire)'};stroke-width:${o.width || 6};stroke-linecap:round;stroke-linejoin:round` });

  /** Path helpers for flows */
  function pathOf(pts) {
    const seg = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
    const at = (d) => {
      d = ((d % total) + total) % total;
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) { const t = seg[i] ? Math.min(1, d / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; }
        d -= seg[i];
      }
      return pts[0];
    };
    return { seg, total, at };
  }
  K.pathOf = pathOf;

  /** Moving little Sparkies along a polyline (repeat the first point to close a loop).
   *  K.flow(svg, pts, {spacing, r, speed(px/s), parent}) → {set(speed), speed} */
  K.flow = (svg, pts, o = {}) => {
    const P = pathOf(pts);
    const n = Math.max(1, Math.round(P.total / (o.spacing || 34)));
    const g = K.g(o.parent || svg, { class: 'kflow', style: 'pointer-events:none' });
    const r = o.r || 7;
    const dots = Array.from({ length: n }, () => K.sparky(g, 0, 0, r, { tiny: true }));
    const f = { phase: 0, speed: o.speed || 0, g };
    const place = () => { dots.forEach((d, i) => { const [x, y] = P.at(f.phase + i * P.total / n); d.move(x, y); }); g.style.opacity = (o.hideWhenStopped && !f.speed) ? 0 : 1; };
    f.set = (v) => { f.speed = v; place(); };
    W.anim((dt) => { if (f.speed) { f.phase += f.speed * dt; place(); } }, svg);
    place();
    return f;
  };

  /** Big kid button. K.btn(parent, html, onClick, {cls, title}) */
  K.btn = (parent, html, fn, o = {}) => {
    const b = W.h('button', { class: 'kbtn ' + (o.cls || ''), type: 'button', html, title: o.title || null, 'aria-label': o.title || null });
    b.addEventListener('click', (e) => { fn && fn(e, b); });
    if (parent) W.$(parent).append(b);
    return b;
  };
  K.row = (parent, cls = '') => { const d = W.h('div', { class: 'toy-row ' + cls }); W.$(parent).append(d); return d; };

  /** Simple tone (respects the 🔊 sound setting) */
  let actx = null;
  K.tone = (freq = 600, dur = 0.15, type = 'sine', vol = 0.1) => {
    try {
      if (window.Book && Book.state && Book.state.sound === false) return;
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.setValueAtTime(vol, t0 + Math.max(0.02, dur - 0.03)); g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* no audio */ }
  };

  /** Toy achievement: solve the task exercise and celebrate (once per page visit) */
  const won = new Set();
  K.win = (id, msg) => {
    if (won.has(id)) return;
    won.add(id);
    const ex = document.querySelector(`.ex[data-id="${id}"]`);
    const fresh = ex && !ex.classList.contains('solved');
    Book.solve(id);
    if (fresh || !ex) { Book.confetti(); if (msg) Book.toast(msg); }
  };

  window.K = K;
})();
