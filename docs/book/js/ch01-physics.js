/* Chapter 1 · How Current Really Flows — widgets */
(function () {
  'use strict';
  const K = 8.99e9, QE = 1.602e-19, NCU = 8.5e28, RHO = 1.72e-8;
  const pal = () => ({
    ink: W.col('ink'), muted: W.col('muted'), line: W.col('line'), surface: W.col('surface'), surface2: W.col('surface2'),
    c1: W.col('c1'), c2: W.col('c2'), c3: W.col('c3'), c4: W.col('c4'), c5: W.col('c5'), c6: W.col('c6'), wire: W.col('wire'), accent: W.col('accent'),
  });
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const fmtTime = (s) => {
    if (!isFinite(s)) return '—';
    if (s < 60) return W.si(s, 's', 3);
    if (s < 3600) return (s / 60).toPrecision(3) + ' min';
    if (s < 86400 * 2) return (s / 3600).toPrecision(3) + ' h';
    if (s < 86400 * 365 * 2) return (s / 86400).toPrecision(3) + ' days';
    return (s / (86400 * 365)).toPrecision(3) + ' years';
  };
  function arrow(ctx, x1, y1, x2, y2, head = 5) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
    ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill();
  }
  function hide(sch, id, h) { const r = sch.parts[id]; sch.set(id, { hidden: h }); if (r && r.text) r.text.style.display = h ? 'none' : ''; }
  function ptr(e, el) { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  /* ================= Figure 1.1: Coulomb force ================= */
  (function () {
    let q1 = 1e-6, q2 = 1e-7;
    const p = W.plot('#f-coulomb', { xmin: 0.001, xmax: 1, logx: true, ymin: 1e-6, ymax: 1e5, logy: true, xlabel: 'Distance r (m)', ylabel: 'Force (N)', hover: true, xunit: 'm', yunit: 'N', height: 270 });
    const ctl = W.controls('#f-coulomb');
    W.slider(ctl, { label: '\\(q_1\\)', min: 1e-9, max: 1e-5, log: true, value: q1, unit: 'C', onInput: (v) => { q1 = v; p.update(); } });
    W.slider(ctl, { label: '\\(q_2\\)', min: 1e-9, max: 1e-5, log: true, value: q2, unit: 'C', onInput: (v) => { q2 = v; p.update(); } });
    p.draw((p) => {
      p.hline(0.0098, { color: 'muted' });
      p.text(0.0012, 0.0098 * 2.2, 'weight of a 1 g paperclip', { color: 'muted', size: 11 });
      p.fn((r) => K * 1e-12 / (r * r), { color: 'muted', dash: [4, 4], width: 1.5, label: '1 µC and 1 µC', hover: false });
      p.fn((r) => K * q1 * q2 / (r * r), { color: 'c4', label: 'F = k q₁q₂ / r²' });
    });
  })();

  /* ================= Figure 1.2: Electric field ================= */
  (function () {
    const host = W.$('#f-field');
    const c = W.canvas(host, { height: 380 });
    c.canvas.classList.add('c1-canvas');
    const ctl = W.controls(host);
    const out = W.controls(host);
    const rE = W.readout(out, { label: '|E| at probe', unit: 'V/m' });
    const rV = W.readout(out, { label: 'V at probe', unit: 'V' });
    const QN = 1e-9; // 1 nC per charge
    let charges = [], probe = { x: 0.5, y: 0.25 }, preset = 'like';
    const PRESETS = {
      single: () => [{ x: 0.5, y: 0.5, s: 1 }],
      dipole: () => [{ x: 0.3, y: 0.5, s: 1 }, { x: 0.7, y: 0.5, s: -1 }],
      like: () => [{ x: 0.3, y: 0.5, s: 1 }, { x: 0.7, y: 0.5, s: 1 }],
      quad: () => [{ x: 0.35, y: 0.3, s: 1 }, { x: 0.65, y: 0.3, s: -1 }, { x: 0.65, y: 0.7, s: 1 }, { x: 0.35, y: 0.7, s: -1 }],
    };
    const seg = W.segmented(ctl, { options: [['single', 'Single'], ['dipole', 'Dipole'], ['like', 'Two like charges'], ['quad', 'Quadrupole']], value: preset, onChange: (v) => { preset = v; charges = PRESETS[v](); probe = { x: 0.5, y: 0.25 }; draw(); } });
    W.button(ctl, '+ Add positive', () => { charges.push({ x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.6, s: 1 }); markCustom(); draw(); });
    W.button(ctl, '− Add negative', () => { charges.push({ x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.6, s: -1 }); markCustom(); draw(); });
    W.button(ctl, 'Clear', () => { charges = []; markCustom(); draw(); }, 'ghost');
    function markCustom() { preset = 'custom'; seg.set(null, false); }
    charges = PRESETS[preset]();
    // physical scale: canvas width = 1 m
    const mpp = () => 1 / c.w;
    function field(px, py) {
      let ex = 0, ey = 0, v = 0;
      const m = mpp();
      for (const q of charges) {
        const dx = (px - q.x * c.w) * m, dy = (py - q.y * c.h) * m;
        const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
        if (r < 1e-4) continue;
        const e = K * q.s * QN / r2;
        ex += e * dx / r; ey += e * dy / r; v += K * q.s * QN / r;
      }
      return [ex, ey, v];
    }
    function draw() {
      const { ctx, w, h } = c, P = pal();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      // potential tint
      const cell = 10;
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        const v = field(x + cell / 2, y + cell / 2)[2];
        const a = 0.3 * W.clamp(Math.log10(Math.abs(v) / 30) / 2, 0, 1);
        if (a < 0.01) continue;
        ctx.globalAlpha = a; ctx.fillStyle = v > 0 ? P.c4 : P.c1; ctx.fillRect(x, y, cell, cell);
      }
      ctx.globalAlpha = 1;
      // field lines
      ctx.strokeStyle = P.muted; ctx.lineWidth = 1.2;
      const pos = charges.filter((q) => q.s > 0), neg = charges.filter((q) => q.s < 0);
      const seeds = pos.length ? pos : neg, dir = pos.length ? 1 : -1;
      for (const q of seeds) {
        const n = 16;
        for (let k = 0; k < n; k++) {
          const a0 = (k + 0.5) / n * 2 * Math.PI;
          let x = q.x * w + 10 * Math.cos(a0), y = q.y * h + 10 * Math.sin(a0);
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let i = 0; i < 700; i++) {
            const [ex, ey] = field(x, y); const m = Math.hypot(ex, ey); if (!m) break;
            x += dir * 3 * ex / m; y += dir * 3 * ey / m;
            ctx.lineTo(x, y);
            if (x < -20 || x > w + 20 || y < -20 || y > h + 20) break;
            if (charges.some((o) => o.s === -dir && Math.hypot(x - o.x * w, y - o.y * h) < 8)) break;
          }
          ctx.stroke();
        }
      }
      // arrows on grid
      const g = 30;
      for (let y = g / 2; y < h; y += g) for (let x = g / 2; x < w; x += g) {
        const [ex, ey] = field(x, y); const m = Math.hypot(ex, ey); if (!m) continue;
        if (charges.some((o) => Math.hypot(x - o.x * w, y - o.y * h) < 16)) continue;
        const a = W.clamp(0.15 + 0.25 * Math.log10(m / 20), 0.12, 1);
        ctx.globalAlpha = a; ctx.strokeStyle = ctx.fillStyle = P.ink; ctx.lineWidth = 1.4;
        arrow(ctx, x - 6 * ex / m, y - 6 * ey / m, x + 6 * ex / m, y + 6 * ey / m, 4);
      }
      ctx.globalAlpha = 1;
      // charges
      for (const q of charges) {
        const x = q.x * w, y = q.y * h;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fillStyle = q.s > 0 ? P.c4 : P.c1; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 17px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(q.s > 0 ? '+' : '−', x, y + 1);
      }
      // probe
      const px = probe.x * w, py = probe.y * h;
      const [ex, ey, v] = field(px, py), m = Math.hypot(ex, ey);
      ctx.strokeStyle = P.c3; ctx.fillStyle = P.c3; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke();
      if (m > 1) { const L = W.clamp(14 * Math.log10(m / 5), 6, 60); ctx.lineWidth = 3; arrow(ctx, px, py, px + L * ex / m, py + L * ey / m, 8); }
      ctx.fillStyle = P.muted; ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('canvas width = 1 m, each charge = ±1 nC', 8, h - 6);
      rE.set(m); rV.set(v);
      const single = K * QN / 0.01; // field 10 cm from one charge
      const ok = charges.length === 2 && charges[0].s === charges[1].s && m < 0.05 * single;
      rE.setClass(ok ? 'good' : '');
      if (ok) Book.solve('field-task');
    }
    let drag = null, moved = false, start = null;
    c.canvas.addEventListener('pointerdown', (e) => {
      const [x, y] = ptr(e, c.canvas);
      moved = false; start = [x, y];
      if (Math.hypot(x - probe.x * c.w, y - probe.y * c.h) < 18) drag = probe;
      else drag = charges.find((q) => Math.hypot(x - q.x * c.w, y - q.y * c.h) < 16) || null;
      if (drag) { c.canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    c.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const [x, y] = ptr(e, c.canvas);
      if (Math.hypot(x - start[0], y - start[1]) > 3) moved = true;
      drag.x = W.clamp(x / c.w, 0.02, 0.98); drag.y = W.clamp(y / c.h, 0.03, 0.97);
      draw();
    });
    c.canvas.addEventListener('pointerup', () => {
      if (drag && !moved && drag !== probe) { drag.s = -drag.s; markCustom(); draw(); }
      drag = null;
    });
    W.$('#f-field').addEventListener('dblclick', (e) => e.preventDefault());
    c.canvas.width && draw();
    new ResizeObserver(() => draw()).observe(c.wrap);
    document.addEventListener('themechange', draw);
  })();

  /* ================= Figure 1.3: Ground is a choice ================= */
  (function () {
    const sch = W.schematic('#f-ground', {
      w: 440, h: 245, title: 'Battery and three resistors in series with selectable ground reference',
      items: [
        { t: 'V', id: 'bat', a: [60, 95], b: [60, 150], label: '9 V' },
        { t: 'wire', pts: [[60, 95], [60, 40], [120, 40]] },
        { t: 'R', id: 'r1', a: [120, 40], b: [220, 40], label: 'R1 1 kΩ' },
        { t: 'wire', pts: [[220, 40], [340, 40], [340, 80]] },
        { t: 'R', id: 'r2', a: [340, 80], b: [340, 160], label: 'R2 1 kΩ' },
        { t: 'wire', pts: [[340, 160], [340, 200], [220, 200]] },
        { t: 'R', id: 'r3', a: [220, 200], b: [120, 200], label: 'R3 1 kΩ' },
        { t: 'wire', pts: [[120, 200], [60, 200], [60, 150]] },
        { t: 'dot', at: [280, 40] }, { t: 'dot', at: [280, 200] },
        { t: 'text', at: [280, 58], text: 'node A' }, { t: 'text', at: [280, 182], text: 'node B' },
        { t: 'tag', id: 'tp', at: [60, 16], text: '' },
        { t: 'tag', id: 'ta', at: [280, 16], text: '' },
        { t: 'tag', id: 'tb', at: [280, 226], text: '' },
        { t: 'tag', id: 'tn', at: [60, 226], text: '' },
      ],
    });
    sch.flow([[60, 95], [60, 40], [340, 40], [340, 200], [60, 200], [60, 95]], { speed: 0.8 });
    const ctl = W.controls('#f-ground-ctl');
    let ref = 'n', R2 = 1000;
    W.segmented(ctl, { options: [['p', '+ terminal'], ['a', 'node A'], ['b', 'node B'], ['n', '− terminal']], value: ref, onChange: (v) => { ref = v; upd(); } });
    W.slider(ctl, { label: 'R2', min: 100, max: 10000, log: true, value: R2, unit: 'Ω', onInput: (v) => { R2 = v; upd(); } });
    const ri = W.readout(ctl, { label: 'Current', unit: 'A' });
    const r2v = W.readout(ctl, { label: 'Across R2', unit: 'V' });
    function upd() {
      const s = W.solveDC([
        { name: 'V', type: 'V', n: ['p', '0'], value: 9 },
        { name: 'R1', type: 'R', n: ['p', 'a'], value: 1000 },
        { name: 'R2', type: 'R', n: ['a', 'b'], value: R2 },
        { name: 'R3', type: 'R', n: ['b', '0'], value: 1000 },
      ]);
      const v = { p: s.v.p, a: s.v.a, b: s.v.b, n: 0 };
      const v0 = v[ref];
      const f = (k) => (k === ref ? '⏚ 0 V' : (v[k] - v0 > 0 ? '+' : '') + W.fix(v[k] - v0, 2) + ' V');
      sch.set('tp', { text: f('p') }); sch.set('ta', { text: f('a') }); sch.set('tb', { text: f('b') }); sch.set('tn', { text: f('n') });
      sch.set('r2', { label: 'R2 ' + W.si(R2, 'Ω', 2) });
      ri.set(s.i.R1); r2v.set(s.v.a - s.v.b);
      if (Math.abs(v.p - v0 - 3) < 0.03) Book.solve('ground-task');
    }
    upd();
  })();

  /* ================= Figure 1.4: conventional vs electron flow ================= */
  (function () {
    const sch = W.schematic('#f-conv', {
      w: 400, h: 215, title: 'Battery, switch and lamp showing conventional current and electron flow',
      items: [
        { t: 'V', id: 'bat', a: [60, 95], b: [60, 145], label: '6 V' },
        { t: 'wire', pts: [[60, 95], [60, 40], [150, 40]] },
        { t: 'SW', id: 'sw', a: [150, 40], b: [210, 40], label: 'S1 (click)', closed: false },
        { t: 'wire', pts: [[210, 40], [320, 40], [320, 85]] },
        { t: 'lamp', id: 'lamp', a: [320, 85], b: [320, 145], label: 'lamp' },
        { t: 'wire', pts: [[320, 145], [320, 180], [60, 180], [60, 145]] },
        { t: 'arrow', id: 'ac', a: [235, 22], b: [295, 22], label: 'I (conventional)', color: 'c2' },
        { t: 'arrow', id: 'ae', a: [260, 198], b: [140, 198], label: 'e⁻ drift', color: 'c1', side: -1 },
      ],
    });
    const loop = [[60, 95], [60, 40], [320, 40], [320, 180], [60, 180], [60, 95]];
    const fc = sch.flow(loop, { speed: 0, color: 'c2' });
    const fe = sch.flow(loop, { speed: 0, electrons: true, spacing: 22, hideWhenStopped: true });
    fe.hideWhenStopped = true;
    const ctl = W.controls('#f-conv-ctl');
    let mode = 'conv';
    W.segmented(ctl, { options: [['conv', 'Conventional current'], ['elec', 'Electron flow'], ['both', 'Both']], value: mode, onChange: (v) => { mode = v; upd(); } });
    sch.parts.sw.it.onToggle = upd;
    sch.parts.ac.text.style.fill = 'var(--c2)'; sch.parts.ae.text.style.fill = 'var(--c1)';
    function upd() {
      const on = sch.parts.sw.it.closed;
      fc.set(on && mode !== 'elec' ? 1 : 0);
      fe.set(on && mode !== 'conv' ? 1 : 0);
      hide(sch, 'ac', mode === 'elec'); hide(sch, 'ae', mode === 'conv');
      sch.set('lamp', { glow: on ? 0.9 : 0 });
    }
    upd();
  })();

  /* ================= Figure 1.5: drift velocity plot ================= */
  (function () {
    const COND = [
      ['trace', '0.25 mm trace, 1 oz', 8.75e-9, 'c4'],
      ['awg30', 'AWG 30 (0.051 mm²)', 0.051e-6, 'c2'],
      ['awg22', 'AWG 22 (0.33 mm²)', 0.326e-6, 'c3'],
      ['awg18', 'AWG 18 (0.82 mm²)', 0.823e-6, 'c1'],
      ['awg12', 'AWG 12 (3.3 mm²)', 3.31e-6, 'c5'],
    ];
    let sel = 'awg22', I = 1;
    const p = W.plot('#f-drift', { xmin: 0.001, xmax: 100, logx: true, ymin: 1e-8, ymax: 1, logy: true, xlabel: 'Current (A)', ylabel: 'Drift velocity (m/s)', hover: true, xunit: 'A', yunit: 'm/s', height: 270 });
    const ctl = W.controls('#f-drift-ctl');
    W.select(ctl, { label: 'Conductor', options: COND.map((c) => [c[0], c[1]]), value: sel, onChange: (v) => { sel = v; upd(); } });
    W.slider(ctl, { label: 'Current', min: 0.001, max: 100, log: true, value: I, unit: 'A', onInput: (v) => { I = v; upd(); } });
    const rv = W.readout(ctl, { label: 'Drift', unit: 'm/s' });
    const rt = W.readout(ctl, { label: 'Electron: 1 m takes', fmt: fmtTime });
    const rs = W.readout(ctl, { label: 'Signal: 1 m takes', unit: 's' });
    function upd() {
      const c = COND.find((x) => x[0] === sel), v = I / (NCU * QE * c[2]);
      rv.set(v); rt.set(1 / v); rs.set(1 / 2e8);
      p.update();
    }
    p.draw((p) => {
      for (const c of COND) p.fn((i) => i / (NCU * QE * c[2]), { color: c[3], label: c[1], width: c[0] === sel ? 3 : 1.5 });
      const c = COND.find((x) => x[0] === sel);
      p.point(I, I / (NCU * QE * c[2]), { color: c[3], r: 6 });
      p.hline(1e-3, { color: 'muted' }); p.text(60, 1.6e-3, '1 mm/s', { color: 'muted', size: 11 });
    });
    upd();
  })();

  /* ================= Figure 1.6: signal vs drift (marbles) ================= */
  (function () {
    const host = W.$('#f-marbles');
    const c = W.canvas(host, { height: 300 });
    const ctl = W.controls('#f-marbles-ctl');
    let closed = false, tClose = -1, tOpen = -1, now = 0, Lm = 10;
    const btn = W.button(ctl, 'Close switch', () => {
      closed = !closed;
      if (closed) { tClose = now; tOpen = -1; } else tOpen = now;
      btn.textContent = closed ? 'Open switch' : 'Close switch';
    });
    W.button(ctl, 'Reset', () => { closed = false; tClose = tOpen = -1; btn.textContent = 'Close switch'; layout(); }, 'ghost');
    W.slider(ctl, { label: 'Wire length (each way)', min: 1, max: 1e6, log: true, value: Lm, unit: 'm', onInput: (v) => { Lm = v; upd(); } });
    const out = W.controls('#f-marbles-ctl');
    const rS = W.readout(out, { label: 'Signal reaches lamp in', unit: 's' });
    const rD = W.readout(out, { label: 'One electron needs', fmt: fmtTime });
    const vd = 1 / (NCU * QE * 0.5e-6); // 1 A in 0.5 mm²
    function upd() { rS.set(Lm / 2e8); rD.set(Lm / vd); }
    upd();
    // geometry: loop rectangle; s = arc length clockwise from top-left corner
    let G = null, marbles = [];
    function layout() {
      const w = c.w, h = c.h, l = 50, r = w - 50, t = 50, b = h - 60;
      const W_ = r - l, H_ = b - t, P = 2 * (W_ + H_);
      G = { l, r, t, b, W: W_, H: H_, P, sSw: W_ * 0.22, sLamp: W_ + H_ / 2, sBat: 2 * W_ + H_ + H_ / 2 };
      marbles = [];
      const n = Math.floor(P / 13);
      for (let i = 0; i < n; i++) marbles.push(i * P / n);
      G.hi = 0; // highlighted marble index nearest the switch
      let best = 1e9; marbles.forEach((s, i) => { const d = Math.abs(s - G.sSw - 30); if (d < best) { best = d; G.hi = i; } });
    }
    function at(s) {
      const g = G; s = ((s % g.P) + g.P) % g.P;
      if (s < g.W) return [g.l + s, g.t];
      s -= g.W; if (s < g.H) return [g.r, g.t + s];
      s -= g.H; if (s < g.W) return [g.r - s, g.b];
      s -= g.W; return [g.l, g.b - s];
    }
    const dist = (s, s0) => { const d = Math.abs(((s - s0) % G.P + G.P) % G.P); return Math.min(d, G.P - d); };
    const CV = () => G.P / 1.6; // visual front speed: half the loop in 0.8 s
    function reached(s, t0) { return t0 >= 0 && dist(s, G.sSw) <= CV() * (now - t0); }
    function moving(s) { return reached(s, tClose) && !(tOpen > tClose && reached(s, tOpen)); }
    layout();
    new ResizeObserver(() => layout()).observe(c.wrap);
    W.anim((dt) => {
      now += dt;
      const { ctx, w, h } = c, P = pal(), g = G;
      if (!g || g.r <= g.l) return;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      // tube
      ctx.lineJoin = 'round';
      ctx.strokeStyle = P.line; ctx.lineWidth = 16; ctx.strokeRect(g.l, g.t, g.W, g.H);
      ctx.strokeStyle = P.surface2; ctx.lineWidth = 12; ctx.strokeRect(g.l, g.t, g.W, g.H);
      // energised region glow
      const on = closed || (tOpen >= 0 && tOpen > tClose);
      if (tClose >= 0) {
        ctx.strokeStyle = P.c2; ctx.lineWidth = 12; ctx.globalAlpha = 0.35; ctx.lineCap = 'round';
        const N = 200;
        for (let i = 0; i < N; i++) {
          const s0 = i / N * g.P, s1 = (i + 1) / N * g.P;
          if (!moving((s0 + s1) / 2)) continue;
          const a = at(s0), b = at(s1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // front markers
        const df = CV() * (now - tClose);
        if (closed && df < g.P / 2) for (const sgn of [1, -1]) { const [x, y] = at(g.sSw + sgn * df); ctx.fillStyle = P.c2; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
      }
      void on;
      // marbles (electrons drift counter-clockwise = negative s)
      const v = 7; // px/s, hugely exaggerated
      marbles.forEach((s, i) => {
        if (moving(s)) marbles[i] = s - v * dt;
        const [x, y] = at(marbles[i]);
        const hi = i === g.hi;
        ctx.beginPath(); ctx.arc(x, y, hi ? 5 : 3.6, 0, 7); ctx.fillStyle = hi ? P.c4 : P.c1; ctx.globalAlpha = hi ? 1 : 0.75; ctx.fill(); ctx.globalAlpha = 1;
      });
      // battery on left side
      const by = g.t + g.H / 2, bx = g.l;
      ctx.fillStyle = P.surface; ctx.fillRect(bx - 18, by - 22, 36, 44);
      ctx.strokeStyle = P.wire; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx - 16, by - 8); ctx.lineTo(bx + 16, by - 8); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx - 9, by + 6); ctx.lineTo(bx + 9, by + 6); ctx.stroke();
      ctx.fillStyle = P.ink; ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', bx + 26, by - 12); ctx.fillText('−', bx + 26, by + 10);
      // switch
      const [sx, sy] = at(g.sSw);
      ctx.fillStyle = P.surface; ctx.fillRect(sx - 20, sy - 10, 40, 20);
      ctx.strokeStyle = P.wire; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(sx - 16, sy); ctx.lineTo(sx + 16, closed ? sy : sy - 14); ctx.stroke();
      ctx.fillStyle = P.wire; for (const dx of [-16, 16]) { ctx.beginPath(); ctx.arc(sx + dx, sy, 3, 0, 7); ctx.fill(); }
      // lamp
      const [lx, ly] = at(g.sLamp);
      const lit = moving(g.sLamp);
      if (lit) { const gr = ctx.createRadialGradient(lx, ly, 4, lx, ly, 46); gr.addColorStop(0, 'rgba(255,212,59,.9)'); gr.addColorStop(1, 'rgba(255,212,59,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(lx, ly, 46, 0, 7); ctx.fill(); }
      ctx.fillStyle = lit ? '#ffd43b' : P.surface; ctx.strokeStyle = P.wire; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx, ly, 14, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx - 10, ly - 10); ctx.lineTo(lx + 10, ly + 10); ctx.moveTo(lx - 10, ly + 10); ctx.lineTo(lx + 10, ly - 10); ctx.stroke();
      // captions
      ctx.fillStyle = P.muted; ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('● electrons   ● tracked one   ● field front', 12, h - 12);
      ctx.fillStyle = P.c1; ctx.fillText('●', 12, h - 12);
      const m1 = ctx.measureText('● electrons   ').width; ctx.fillStyle = P.c4; ctx.fillText('●', 12 + m1, h - 12);
      const m2 = ctx.measureText('● electrons   ● tracked one   ').width; ctx.fillStyle = P.c2; ctx.fillText('●', 12 + m2, h - 12);
      ctx.fillStyle = P.ink; ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText(lit ? 'Lamp ON' : 'Lamp off', lx - 50 > g.l + 60 ? lx - 52 : lx, ly - 26);
    }, c.canvas);
  })();

  /* ================= Figure 1.7: Poynting vector ================= */
  (function () {
    const host = W.$('#f-poynting');
    const c = W.canvas(host, { height: 320 });
    const ctl = W.controls('#f-poynting-ctl');
    const L = { E: true, B: true, S: true, lossy: false };
    W.toggle(ctl, { label: '<b style="color:var(--c1)">E</b> field', value: true, onChange: (v) => { L.E = v; } });
    W.toggle(ctl, { label: '<b style="color:var(--c5)">B</b> field', value: true, onChange: (v) => { L.B = v; } });
    W.toggle(ctl, { label: '<b style="color:var(--c2)">S</b> energy flow', value: true, onChange: (v) => { L.S = v; } });
    W.toggle(ctl, { label: 'Lossy wire', value: false, onChange: (v) => { L.lossy = v; } });
    let parts = [];
    const geo = () => { const w = c.w, h = c.h; return { x0: Math.min(80, w * 0.14), x1: w - Math.min(80, w * 0.14), y1: h / 2 - 48, y2: h / 2 + 48, cy: h / 2 }; };
    function flow(x, y) {
      const g = geo();
      const sx = g.x0, sy = g.cy, kx = g.x1, ky = g.cy;
      let dx = x - sx, dy = y - sy, r2 = dx * dx + dy * dy + 80;
      let vx = dx / r2, vy = dy / r2;
      dx = x - kx; dy = y - ky; r2 = dx * dx + dy * dy + 80;
      vx -= dx / r2; vy -= dy / r2;
      return [vx, vy];
    }
    function spawn() {
      const g = geo(), a = (Math.random() - 0.5) * 2 * Math.PI * 0.6;
      return { x: g.x0 + 22 * Math.cos(a), y: g.cy + 22 * Math.sin(a), age: 0 };
    }
    for (let i = 0; i < 110; i++) { const p = spawn(); p.age = 0; parts.push(p); }
    let t = 0, warm = false;
    function step(p, dt, w, h, g) {
      const [vx, vy] = flow(p.x, p.y), m = Math.hypot(vx, vy) || 1e-9;
      const sp = W.clamp(m * 6000, 70, 230);
      p.x += sp * vx / m * dt; p.y += sp * vy / m * dt; p.age += dt;
      if (Math.hypot(p.x - g.x1, p.y - g.cy) < 18 || p.x < 0 || p.x > w || p.y < 0 || p.y > h || p.age > 40) Object.assign(p, spawn());
      return [vx, vy, m];
    }
    W.anim((dt) => {
      t += dt;
      const { ctx, w, h } = c, P = pal(), g = geo();
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      // E arrows
      const Ey = (y) => 1 / (y - g.y1) - 1 / (y - g.y2);
      if (L.E) {
        ctx.strokeStyle = ctx.fillStyle = P.c1; ctx.lineWidth = 1.5;
        for (let x = g.x0 + 40; x < g.x1 - 30; x += 46) {
          for (const y of [g.cy - 24, g.cy, g.cy + 24, g.y1 - 26, g.y1 - 56, g.y2 + 26, g.y2 + 56]) {
            if (y < 8 || y > h - 8) continue;
            const e = Ey(y), m = W.clamp(Math.abs(e) * 260, 0.25, 1);
            const len = 7 + 7 * m;
            ctx.globalAlpha = 0.35 + 0.6 * m;
            const s = Math.sign(e);
            arrow(ctx, x, y - s * len, x, y + s * len, 5);
          }
        }
        ctx.globalAlpha = 1;
      }
      // B symbols
      if (L.B) {
        ctx.strokeStyle = ctx.fillStyle = P.c5; ctx.lineWidth = 1.4;
        for (let x = g.x0 + 63; x < g.x1 - 30; x += 46) {
          for (const y of [g.cy - 12, g.cy + 12, g.y1 - 40, g.y2 + 40]) {
            if (y < 8 || y > h - 8) continue;
            const inside = y > g.y1 && y < g.y2, m = W.clamp(Math.abs(Ey(y)) * 260, 0.25, 1), r = 3 + 3 * m;
            ctx.globalAlpha = 0.35 + 0.6 * m;
            ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
            if (inside) { ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7); ctx.moveTo(x - r * 0.7, y + r * 0.7); ctx.lineTo(x + r * 0.7, y - r * 0.7); ctx.stroke(); }
            else { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
          }
        }
        ctx.globalAlpha = 1;
      }
      // S particles
      if (L.S) {
        ctx.fillStyle = ctx.strokeStyle = P.c2;
        if (!warm) { warm = true; for (const p of parts) { const n = Math.random() * 400; for (let k = 0; k < n; k++) step(p, 0.03, w, h, g); } }
        for (const p of parts) {
          const [vx, vy, m] = step(p, dt, w, h, g);
          const a = W.clamp(m * 900, 0.2, 1);
          ctx.globalAlpha = a; ctx.lineWidth = 2;
          arrow(ctx, p.x - 9 * vx / m, p.y - 9 * vy / m, p.x + 4 * vx / m, p.y + 4 * vy / m, 6);
        }
        ctx.globalAlpha = 1;
        if (L.lossy) {
          ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
          for (let x = g.x0 + 50; x < g.x1 - 30; x += 38) {
            const ph = (t * 14 + x) % 12;
            for (const [y0, s] of [[g.y1 - 18, 1], [g.y1 + 18, -1], [g.y2 - 18, 1], [g.y2 + 18, -1]]) arrow(ctx, x, y0 - s * 6 + s * ph * 0.4, x, y0 + s * 6 + s * ph * 0.4, 4);
          }
          ctx.globalAlpha = 1;
        }
      }
      // wires
      ctx.lineCap = 'round';
      ctx.strokeStyle = L.lossy ? P.c4 : P.wire; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(g.x0, g.y1); ctx.lineTo(g.x1, g.y1); ctx.moveTo(g.x0, g.y2); ctx.lineTo(g.x1, g.y2); ctx.stroke();
      ctx.strokeStyle = P.wire; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(g.x0, g.y1); ctx.lineTo(g.x0, g.y2); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x1, g.y2); ctx.stroke();
      // battery body
      ctx.fillStyle = P.surface2; ctx.fillRect(g.x0 - 18, g.cy - 26, 36, 52); ctx.strokeRect(g.x0 - 18, g.cy - 26, 36, 52);
      ctx.fillStyle = P.ink; ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', g.x0, g.cy - 13); ctx.fillText('−', g.x0, g.cy + 13);
      // resistor zigzag
      ctx.fillStyle = P.surface; ctx.fillRect(g.x1 - 12, g.cy - 30, 24, 60);
      ctx.strokeStyle = P.wire; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(g.x1, g.cy - 30);
      for (let i = 0; i < 6; i++) ctx.lineTo(g.x1 + (i % 2 ? -9 : 9), g.cy - 25 + i * 10);
      ctx.lineTo(g.x1, g.cy + 30); ctx.stroke();
      ctx.font = '12px ' + FONT; ctx.fillStyle = P.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('battery', g.x0, g.cy + 44); ctx.fillText('resistor', g.x1, g.cy + 46);
      ctx.textAlign = 'left'; ctx.fillText('+ wire (higher V), current →', g.x0 + 30, g.y1 - 8);
      ctx.fillText('− wire, current ←', g.x0 + 30, g.y2 + 17);
    }, c.canvas);
  })();

  /* ================= Figure 1.8: Drude model ================= */
  (function () {
    const host = W.$('#f-drude');
    const c = W.canvas(host, { height: 290 });
    const ctl = W.controls('#f-drude-ctl');
    let Ef = 0, T = 300;
    W.slider(ctl, { label: 'Field \\(E\\)', min: 0, max: 1, step: 0.01, value: Ef, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { Ef = v; } });
    W.slider(ctl, { label: 'Temperature', min: 80, max: 600, step: 10, value: T, unit: 'K', format: (v) => Math.round(v) + ' K', onInput: (v) => { T = v; } });
    const out = W.controls('#f-drude-ctl');
    const rD = W.readout(out, { label: 'Avg. drift / random speed', fmt: (v) => (v * 100).toFixed(1) + '%' });
    const rR = W.readout(out, { label: 'Resistance (rel. to 300 K)', fmt: (v) => '×' + v.toFixed(2) });
    const VT = 110, A0 = 260, NU0 = 5;
    let el = [], ions = [], flashes = [], trail = [], drift = 0;
    function init() {
      el = []; ions = [];
      const w = c.w, h = c.h - 36;
      for (let y = 22; y < h; y += 34) for (let x = 20; x < w; x += 34) ions.push([x + ((y / 34) % 2) * 17, y]);
      for (let i = 0; i < 80; i++) { const a = Math.random() * 7; el.push({ x: Math.random() * w, y: 10 + Math.random() * (h - 20), vx: VT * Math.cos(a), vy: VT * Math.sin(a) }); }
      trail = [];
    }
    init();
    new ResizeObserver(() => init()).observe(c.wrap);
    W.anim((dt) => {
      const { ctx, w } = c, h = c.h - 36, P = pal();
      const nu = NU0 * T / 300, a = A0 * Ef;
      let sum = 0;
      for (const e of el) {
        e.vx -= a * dt; // electrons accelerate against the field (field points right)
        if (Math.random() < nu * dt) {
          const ang = Math.random() * 7, s = VT * (0.7 + 0.6 * Math.random());
          e.vx = s * Math.cos(ang); e.vy = s * Math.sin(ang);
          flashes.push({ x: e.x, y: e.y, t: 0 });
        }
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.y < 6) { e.y = 6; e.vy = Math.abs(e.vy); } if (e.y > h - 6) { e.y = h - 6; e.vy = -Math.abs(e.vy); }
        if (e.x < 0) { e.x += w; if (e === el[0]) trail.push(null); } if (e.x > w) { e.x -= w; if (e === el[0]) trail.push(null); }
        sum += e.vx;
      }
      trail.push([el[0].x, el[0].y]); if (trail.length > 260) trail.shift();
      drift += (-(sum / el.length) - drift) * Math.min(1, dt * 0.8);
      rD.set(Math.max(0, drift) / VT); rR.set(T / 300);
      ctx.clearRect(0, 0, w, c.h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, c.h);
      ctx.fillStyle = P.muted; ctx.globalAlpha = 0.45;
      for (const [x, y] of ions) { const j = (T / 300) * 1.3; ctx.beginPath(); ctx.arc(x + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j, 6, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      flashes = flashes.filter((f) => (f.t += dt) < 0.25);
      ctx.strokeStyle = P.c2; ctx.lineWidth = 1.5;
      for (const f of flashes) { ctx.globalAlpha = 1 - f.t / 0.25; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + 30 * f.t, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = P.c4; ctx.lineWidth = 1.5; ctx.beginPath(); let pen = false;
      for (const p of trail) { if (!p) { pen = false; continue; } pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; }
      ctx.stroke();
      for (const e of el) { ctx.fillStyle = e === el[0] ? P.c4 : P.c1; ctx.beginPath(); ctx.arc(e.x, e.y, e === el[0] ? 4.5 : 3.2, 0, 7); ctx.fill(); }
      // field arrow + drift bar
      const y0 = c.h - 18;
      ctx.fillStyle = P.surface2; ctx.fillRect(0, c.h - 36, w, 36);
      ctx.font = '12px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = P.ink;
      ctx.fillText('E →', 10, y0);
      ctx.strokeStyle = ctx.fillStyle = P.c1; ctx.lineWidth = 3;
      if (Ef > 0.01) arrow(ctx, 40, y0, 40 + 60 * Ef, y0, 7);
      ctx.fillStyle = P.ink; ctx.fillText('drift ←', 130, y0);
      const bw = Math.max(60, Math.min(w - 300, 300)), bx = 185;
      ctx.fillStyle = P.line; ctx.fillRect(bx, y0 - 5, bw, 10);
      ctx.fillStyle = P.c4; ctx.fillRect(bx, y0 - 5, bw * W.clamp(drift / VT, 0, 1), 10);
      ctx.fillStyle = P.muted; if (w > 560) ctx.fillText('(bar full = random speed)', bx + bw + 8, y0);
    }, c.canvas);
  })();

  /* ================= Figure 1.9: trace calculator ================= */
  (function () {
    let wmm = 0.25, oz = 1, Lcm = 10, I = 2;
    const p = W.plot('#f-trace', { xmin: 0, xmax: 10, ymin: 0, ymax: 2, xlabel: 'Current (A)', ylabel: 'Power in trace (W)', hover: true, xunit: 'A', yunit: 'W', height: 250 });
    const ctl = W.controls('#f-trace-ctl');
    W.slider(ctl, { label: 'Width', min: 0.1, max: 6, step: 0.05, value: wmm, format: (v) => v.toFixed(2) + ' mm', onInput: (v) => { wmm = v; upd(); } });
    W.segmented(ctl, { options: [[0.5, '½ oz'], [1, '1 oz'], [2, '2 oz']], value: oz, onChange: (v) => { oz = v; upd(); } });
    W.slider(ctl, { label: 'Length', min: 1, max: 50, step: 1, value: Lcm, format: (v) => v + ' cm', onInput: (v) => { Lcm = v; upd(); } });
    W.slider(ctl, { label: 'Current', min: 0, max: 10, step: 0.1, value: I, format: (v) => v.toFixed(1) + ' A', onInput: (v) => { I = v; upd(); } });
    const out = W.controls('#f-trace-ctl');
    const rR = W.readout(out, { label: 'R', unit: 'Ω' }), rV = W.readout(out, { label: 'Drop', unit: 'V' }), rP = W.readout(out, { label: 'P', unit: 'W' }), rJ = W.readout(out, { label: 'J', fmt: (v) => v.toFixed(1) + ' A/mm²' });
    const R = () => RHO * (Lcm / 100) / (wmm * 1e-3 * 35e-6 * oz);
    function upd() {
      const r = R(), dv = I * r, P = I * I * r;
      rR.set(r); rV.set(dv); rP.set(P); rJ.set(I / (wmm * 0.035 * oz));
      rV.setClass(dv > 0.1 ? 'bad' : dv < 0.05 ? 'good' : ''); rP.setClass(P > 0.5 ? 'bad' : '');
      p.set({ ymax: Math.max(0.5, Math.min(200, 100 * r * 1.05)) });
      p.update();
      if (oz === 1 && Lcm === 10 && Math.abs(I - 3) < 0.05 && dv < 0.05 && wmm <= 3.5) Book.solve('trace-task');
    }
    p.draw((p) => { const r = R(); p.fn((i) => i * i * r, { color: 'c4', label: 'P = I²R' }); p.point(I, I * I * r, { color: 'c4', label: W.si(I * I * r, 'W') }); });
    upd();
  })();

  /* ================= Figure 1.10: KCL ================= */
  (function () {
    const X = [220, 320, 420];
    const items = [
      { t: 'V', id: 'v', a: [50, 100], b: [50, 160], label: '5 V' },
      { t: 'wire', pts: [[50, 100], [50, 40], [90, 40]] },
      { t: 'R', id: 'r1', a: [90, 40], b: [170, 40], label: 'R1 100 Ω' },
      { t: 'wire', pts: [[170, 40], [420, 40]] },
      { t: 'wire', pts: [[420, 210], [50, 210], [50, 160]] },
      { t: 'dot', at: [220, 40] }, { t: 'dot', at: [320, 40] }, { t: 'dot', at: [220, 210] }, { t: 'dot', at: [320, 210] },
      { t: 'text', at: [200, 26], text: 'N' },
      { t: 'tag', id: 't1', at: [130, 76], text: '' },
      { t: 'tag', id: 'tr', at: [130, 234], text: '' },
    ];
    X.forEach((x, k) => {
      items.push({ t: 'wire', pts: [[x, 40], [x, 85]] }, { t: 'R', id: 'r' + (k + 2), a: [x, 85], b: [x, 165], label: 'R' + (k + 2) }, { t: 'wire', pts: [[x, 165], [x, 210]] });
      items.push({ t: 'tag', id: 't' + (k + 2), at: [x, 234], text: '' });
    });
    const sch = W.schematic('#f-kcl', { w: 500, h: 252, title: 'Supply feeding a node that splits into three branches', items });
    const flows = X.map((x) => sch.flow([[50, 100], [50, 40], [x, 40], [x, 210], [50, 210], [50, 100]], { speed: 0, spacing: 26 }));
    const Rs = [1000, 2200, 470];
    const ctl = W.controls('#f-kcl-ctl');
    Rs.forEach((v, k) => W.slider(ctl, { label: 'R' + (k + 2), min: 100, max: 10000, log: true, value: v, unit: 'Ω', onInput: (val) => { Rs[k] = val; upd(); } }));
    const r1 = W.readout(ctl, { label: '\\(I_1\\)', unit: 'A' }), rs = W.readout(ctl, { label: '\\(I_2+I_3+I_4\\)', unit: 'A' }), rk = W.readout(ctl, { label: '\\(V_{R1}+V_{R2}\\)', unit: 'V' });
    function upd() {
      const s = W.solveDC([
        { name: 'V', type: 'V', n: ['p', '0'], value: 5 },
        { name: 'R1', type: 'R', n: ['p', 'n'], value: 100 },
        { name: 'R2', type: 'R', n: ['n', '0'], value: Rs[0] },
        { name: 'R3', type: 'R', n: ['n', '0'], value: Rs[1] },
        { name: 'R4', type: 'R', n: ['n', '0'], value: Rs[2] },
      ]);
      const I = [s.i.R2, s.i.R3, s.i.R4];
      sch.set('t1', { text: 'I1 = ' + W.si(s.i.R1, 'A', 3) });
      sch.set('tr', { text: 'return ' + W.si(s.i.R1, 'A', 3) });
      I.forEach((i, k) => { sch.set('t' + (k + 2), { text: W.si(i, 'A', 2) }); sch.set('r' + (k + 2), { label: 'R' + (k + 2) + ' ' + W.si(Rs[k], 'Ω', 2) }); flows[k].set(i / 0.006); });
      r1.set(s.i.R1); rs.set(I[0] + I[1] + I[2]); rk.set((s.v.p - s.v.n) + s.v.n);
    }
    upd();
  })();

  /* ================= Figure 1.11: shared vs separate return ================= */
  (function () {
    const sch = W.schematic('#f-return', {
      w: 460, h: 250, title: 'Motor and MCU sharing or separating their ground return wires',
      items: [
        { t: 'V', id: 'bat', a: [50, 110], b: [50, 170], label: '7.4 V' },
        { t: 'wire', pts: [[50, 110], [50, 40], [340, 40]] },
        { t: 'ic', id: 'mcu', at: [190, 110], name: '', top: ['VCC'], bottom: ['GND'], w: 80, h: 60 },
        { t: 'text', at: [190, 111], text: 'MCU' },
        { t: 'wire', pts: [[190, 40], 'mcu.VCC'] },
        { t: 'M', id: 'mot', a: [340, 75], b: [340, 135], label: 'motor', side: -1 },
        { t: 'wire', pts: [[340, 40], [340, 75]] },
        { t: 'wire', pts: ['mcu.GND', [190, 180], [150, 180]] },
        { t: 'R', id: 'rw', a: [150, 180], b: [90, 180], label: 'Rw' },
        { t: 'wire', pts: [[90, 180], [50, 180], [50, 170]] },
        { t: 'wire', id: 'sh', pts: [[340, 135], [340, 180], [190, 180]] },
        { t: 'dot', id: 'shd', at: [190, 180] },
        { t: 'wire', id: 's1', pts: [[340, 135], [340, 222], [150, 222]] },
        { t: 'R', id: 'rw2', a: [150, 222], b: [90, 222], label: 'Rw', side: -1 },
        { t: 'wire', id: 's2', pts: [[90, 222], [50, 222], [50, 180]] },
        { t: 'dot', id: 's3', at: [50, 180] },
        { t: 'tag', id: 'gt', at: [275, 198], text: '' },
        { t: 'tag', id: 'mt', at: [405, 105], text: '' },
      ],
    });
    let mode = 'shared', Im = 3, Rw = 0.05, fm = null, fc = null;
    const ctl = W.controls('#f-return-ctl');
    W.segmented(ctl, { options: [['shared', 'Shared return'], ['sep', 'Separate returns']], value: mode, onChange: (v) => { mode = v; build(); } });
    W.slider(ctl, { label: 'Motor current', min: 0, max: 5, step: 0.1, value: Im, format: (v) => v.toFixed(1) + ' A', onInput: (v) => { Im = v; upd(); } });
    W.slider(ctl, { label: 'Wire \\(R_w\\)', min: 0.005, max: 0.2, step: 0.005, value: Rw, unit: 'Ω', onInput: (v) => { Rw = v; upd(); } });
    const rg = W.readout(ctl, { label: 'MCU ground shift', unit: 'V' });
    function build() {
      const sep = mode === 'sep';
      ['s1', 'rw2', 's2', 's3'].forEach((id) => hide(sch, id, !sep));
      ['sh', 'shd'].forEach((id) => hide(sch, id, sep));
      if (fm) fm.remove(); if (fc) fc.remove();
      fm = sch.flow(sep ? [[50, 110], [50, 40], [340, 40], [340, 222], [50, 222], [50, 110]] : [[50, 110], [50, 40], [340, 40], [340, 180], [50, 180], [50, 110]], { speed: 0, spacing: 16 });
      fc = sch.flow([[50, 110], [50, 40], [190, 40], [190, 180], [50, 180], [50, 110]], { speed: 0.3, spacing: 30, color: 'c3' });
      upd();
    }
    function upd() {
      const sep = mode === 'sep';
      const net = [
        { name: 'V', type: 'V', n: ['p', '0'], value: 7.4 },
        { name: 'Ic', type: 'I', n: ['p', 'j'], value: 0.08 },
        { name: 'Rw', type: 'R', n: ['j', '0'], value: Rw },
      ];
      if (sep) net.push({ name: 'Im', type: 'I', n: ['p', 'm'], value: Im }, { name: 'Rw2', type: 'R', n: ['m', '0'], value: Rw });
      else net.push({ name: 'Im', type: 'I', n: ['p', 'j'], value: Im });
      const s = W.solveDC(net), vg = s.v.j;
      sch.set('gt', { text: 'MCU GND = +' + W.si(vg, 'V', 3) });
      sch.set('mt', { text: 'I = ' + W.fix(Im, 1) + ' A' });
      rg.set(vg); rg.setClass(vg > 0.05 ? 'bad' : 'good');
      fm.set(Im / 1.2);
    }
    build();
  })();

  /* ================= Figure 1.12: capacitor ================= */
  (function () {
    const host = W.$('#f-cap');
    const c = W.canvas(host, { height: 230 });
    const ctl = W.controls('#f-cap-ctl');
    let Acm = 25, dmm = 0.5, er = 1, V = 9, R = 1e6, mode = 'charge', t = 1e9, v0 = 0, vTarget = 9;
    const EPS = 8.854e-12;
    const C = () => EPS * er * Acm * 1e-4 / (dmm * 1e-3);
    W.slider(ctl, { label: 'Plate area', min: 1, max: 100, step: 1, value: Acm, format: (v) => v + ' cm²', onInput: (v) => { Acm = v; upd(); } });
    W.slider(ctl, { label: 'Gap', min: 0.1, max: 2, step: 0.05, value: dmm, format: (v) => v.toFixed(2) + ' mm', onInput: (v) => { dmm = v; upd(); } });
    W.select(ctl, { label: 'Dielectric', options: [['1', 'air (εr = 1)'], ['4.4', 'FR-4 (εr ≈ 4.4)'], ['10', 'alumina (εr ≈ 10)']], value: '1', onChange: (v) => { er = +v; upd(); } });
    W.slider(ctl, { label: 'Battery \\(V\\)', min: 1, max: 12, step: 0.5, value: V, unit: 'V', onInput: (v) => { V = v; if (mode === 'charge') { vTarget = V; } upd(); } });
    W.slider(ctl, { label: 'Resistor \\(R\\)', min: 1e4, max: 1e8, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.button(ctl, '⚡ Charge', () => start('charge'));
    W.button(ctl, '⏚ Discharge', () => start('discharge'), 'ghost');
    const out = W.controls('#f-cap-ctl');
    const rC = W.readout(out, { label: 'C', unit: 'F' }), rQ = W.readout(out, { label: 'Q', unit: 'C' }), rE = W.readout(out, { label: 'E', unit: 'V/m' }), rU = W.readout(out, { label: '½CV²', unit: 'J' }), rT = W.readout(out, { label: 'τ = RC', unit: 's' });
    const tau = () => R * C();
    const vNow = () => vTarget + (v0 - vTarget) * Math.exp(-t / tau());
    function start(m) { v0 = vNow(); mode = m; vTarget = m === 'charge' ? V : 0; t = 0; }
    const p = W.plot('#f-cap-plot', { xmin: 0, xmax: 5, ymin: 0, ymax: 12.5, xlabel: 'Time (in units of τ = RC)', ylabel: 'Voltage (V)', height: 210, hover: true, yunit: 'V', xfmt: (v) => v + 'τ' });
    p.draw((p) => {
      const T = tau();
      p.fn((x) => vTarget + (v0 - vTarget) * Math.exp(-x), { color: 'c1', label: 'capacitor voltage', hoverFmt: (x, y) => `${W.si(x * T, 's')}: ${W.si(y, 'V')}` });
      const i0 = (vTarget - v0); // scaled current, I = i0/R e^{-t/τ}
      p.fn((x) => Math.abs(i0) * Math.exp(-x), { color: 'c2', dash: [6, 4], label: 'current (scaled, peak = ΔV/R)', hover: false });
      const tt = Math.min(5, t / T);
      p.point(tt, vNow(), { color: 'c1' });
      for (let k = 1; k <= 5; k++) p.vline(k, { width: 1, dash: [2, 4] });
    });
    function upd() {
      const Cv = C(), v = vNow();
      rC.set(Cv); rQ.set(Cv * v); rE.set(v / (dmm * 1e-3)); rU.set(0.5 * Cv * v * v); rT.set(tau());
      p.update();
    }
    W.anim((dt) => {
      if (t < 6 * tau()) { t += dt * tau() / 1.2; upd(); } // 1 τ per 1.2 s of animation
      const { ctx, w, h } = c, P = pal(), v = vNow();
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, gap = 16 + 70 * (dmm / 2), ph = 50 + 140 * Math.sqrt(Acm / 100), top = h / 2 - ph / 2;
      const xl = cx - gap / 2, xr = cx + gap / 2;
      if (er > 1) { ctx.fillStyle = P.c6; ctx.globalAlpha = 0.12 + 0.03 * er; ctx.fillRect(xl, top, gap, ph); ctx.globalAlpha = 1; }
      // field lines (density ~ E = V/d)
      const E = v / (dmm * 1e-3), nL = Math.round(Math.sqrt(W.clamp(E / 120000, 0, 1)) * 16);
      ctx.strokeStyle = ctx.fillStyle = P.c1; ctx.lineWidth = 1.4;
      for (let k = 0; k < nL; k++) { const y = top + (k + 0.5) * ph / nL; arrow(ctx, xl + 4, y, xr - 4, y, 4); }
      // plates
      ctx.fillStyle = P.wire; ctx.fillRect(xl - 6, top, 6, ph); ctx.fillRect(xr, top, 6, ph);
      // charges (count ~ log Q)
      const Q = C() * v, nQ = Q > 1e-14 ? Math.round(W.clamp(2 + 2.2 * Math.log10(Q / 1e-12), 1, 22)) : 0;
      ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 0; k < nQ; k++) {
        const y = top + (k + 0.5) * ph / nQ;
        ctx.fillStyle = P.c4; ctx.fillText('+', xl - 14, y);
        ctx.fillStyle = P.c1; ctx.fillText('−', xr + 14, y);
      }
      // wires to the left (battery) and right
      ctx.strokeStyle = P.wire; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xl - 6, h / 2); ctx.lineTo(Math.max(30, cx - 160), h / 2); ctx.moveTo(xr + 6, h / 2); ctx.lineTo(Math.min(w - 30, cx + 160), h / 2); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = '12px ' + FONT;
      ctx.fillText('to R and battery +', Math.max(80, cx - 150), h / 2 - 12);
      ctx.fillText('to battery −', Math.min(w - 70, cx + 140), h / 2 - 12);
      ctx.fillStyle = P.ink; ctx.font = '600 13px ' + FONT;
      ctx.fillText('V = ' + W.si(v, 'V', 3), cx, Math.max(14, top - 12));
      ctx.fillStyle = P.muted; ctx.font = '12px ' + FONT;
      ctx.fillText('field lines ∝ V/d   ·   ± marks ∝ log Q', cx, h - 10);
    }, c.canvas);
    v0 = 0; t = 0;
    upd();
  })();

  /* ================= Figure 1.13: Faraday ================= */
  (function () {
    const host = W.$('#f-faraday');
    const c = W.canvas(host, { height: 300 });
    c.canvas.classList.add('c1-canvas');
    const ctl = W.controls('#f-faraday-ctl');
    let auto = false, speed = 1, mx = -0.35, prevPhi = null, emf = 0, hist = [], tt = 0, drag = false;
    W.toggle(ctl, { label: 'Auto (oscillate)', value: false, onChange: (v) => { auto = v; } });
    W.slider(ctl, { label: 'Auto speed', min: 0.2, max: 3, step: 0.1, value: speed, format: (v) => v.toFixed(1) + '×', onInput: (v) => { speed = v; } });
    const rE = W.readout(ctl, { label: 'EMF', fmt: (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + ' (arb.)' });
    // mx: magnet centre relative to coil centre, in units of canvas width
    const coilX = () => (c.w < 560 ? c.w * 0.45 : c.w * 0.55);
    const phi = (x) => 1 / Math.pow(1 + Math.pow(x / 0.09, 2), 1.5);
    c.canvas.addEventListener('pointerdown', (e) => { const [x, y] = ptr(e, c.canvas); const cx = coilX() + mx * c.w; if (Math.abs(x - cx) < 50 && Math.abs(y - 110) < 30) { drag = true; c.canvas.setPointerCapture(e.pointerId); e.preventDefault(); } });
    c.canvas.addEventListener('pointermove', (e) => { if (!drag) return; const [x] = ptr(e, c.canvas); mx = W.clamp((x - coilX()) / c.w, -0.5, 0.42); });
    c.canvas.addEventListener('pointerup', () => { drag = false; });
    W.anim((dt) => {
      tt += dt;
      if (auto && !drag) mx = -0.05 - 0.3 * Math.cos(tt * speed * 2);
      const ph = phi(mx);
      if (prevPhi != null && dt > 0) { const raw = -(ph - prevPhi) / dt * 0.25; emf += (raw - emf) * Math.min(1, dt * 18); }
      prevPhi = ph;
      hist.push(emf); if (hist.length > 360) hist.shift();
      rE.set(emf);
      const { ctx, w, h } = c, P = pal(), cy = 110, ccx = coilX();
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      // coil (back halves)
      const cw = 90, nT = 9;
      ctx.lineWidth = 3; ctx.strokeStyle = P.c2; ctx.globalAlpha = 0.5;
      for (let k = 0; k < nT; k++) { const x = ccx - cw / 2 + k * cw / (nT - 1); ctx.beginPath(); ctx.ellipse(x, cy, 9, 40, 0, Math.PI / 2, 3 * Math.PI / 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // magnet
      const mxp = ccx + mx * w, mw = 100;
      ctx.fillStyle = P.c4; ctx.fillRect(mxp, cy - 15, mw / 2, 30);
      ctx.fillStyle = P.c1; ctx.fillRect(mxp - mw / 2, cy - 15, mw / 2, 30);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', mxp + mw / 4, cy + 1); ctx.fillText('S', mxp - mw / 4, cy + 1);
      // coil front halves
      ctx.strokeStyle = P.c2; ctx.lineWidth = 3;
      for (let k = 0; k < nT; k++) { const x = ccx - cw / 2 + k * cw / (nT - 1); ctx.beginPath(); ctx.ellipse(x, cy, 9, 40, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
      // leads to meter
      const mX = Math.min(w - 46, ccx + 150), mY = 90;
      ctx.strokeStyle = P.wire; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ccx - cw / 2, cy + 40); ctx.lineTo(ccx - cw / 2, cy + 62); ctx.lineTo(mX - 20, cy + 62); ctx.lineTo(mX - 20, mY + 30);
      ctx.moveTo(ccx + cw / 2, cy + 40); ctx.lineTo(ccx + cw / 2, cy + 54); ctx.lineTo(mX + 20, cy + 54); ctx.lineTo(mX + 20, mY + 30); ctx.stroke();
      // meter
      ctx.fillStyle = P.surface2; ctx.strokeStyle = P.wire; ctx.beginPath(); ctx.arc(mX, mY, 42, Math.PI, 2 * Math.PI); ctx.lineTo(mX + 42, mY + 30); ctx.lineTo(mX - 42, mY + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = '11px ' + FONT; ctx.fillText('−   0   +', mX, mY + 18);
      const ang = -Math.PI / 2 + Math.tanh(emf / 2) * 1.2;
      ctx.strokeStyle = P.c4; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(mX, mY + 8); ctx.lineTo(mX + 36 * Math.cos(ang), mY + 8 + 36 * Math.sin(ang)); ctx.stroke();
      // Lenz pole on the coil face toward the magnet
      const s = Math.abs(emf);
      if (s > 0.05) {
        const left = mx < 0; // magnet on the left side
        const approaching = emf < 0; // flux increasing -> emf negative in our sign convention
        // repel if approaching: face shows same pole as the facing magnet end
        const facing = left ? 'N' : 'S';
        const pole = approaching ? facing : (facing === 'N' ? 'S' : 'N');
        ctx.globalAlpha = W.clamp(s, 0.2, 1);
        ctx.fillStyle = pole === 'N' ? P.c4 : P.c1; ctx.font = 'bold 16px ' + FONT;
        ctx.fillText(pole, left ? ccx - cw / 2 - 24 : ccx + cw / 2 + 24, cy - 54);
        ctx.fillStyle = P.muted; ctx.font = '12px ' + FONT;
        ctx.fillText(approaching ? 'coil repels' : 'coil attracts', left ? ccx - cw / 2 - 24 : ccx + cw / 2 + 24, cy - 36);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = P.muted; ctx.font = '12px ' + FONT; ctx.textAlign = 'left';
      ctx.fillText('⟵ drag the magnet ⟶', 10, 18);
      // trace strip
      const y0 = 250, sh = 40;
      ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
      ctx.strokeStyle = P.c5; ctx.lineWidth = 2; ctx.beginPath();
      hist.forEach((e, i) => { const x = w - (hist.length - i) * (w / 360), y = y0 - W.clamp(e / 2.5, -1, 1) * sh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.fillStyle = P.muted; ctx.fillText('EMF vs time', 10, y0 - sh - 4);
      // flux bar
      ctx.fillText('flux Φ through coil', 10, 182);
      ctx.fillStyle = P.line; ctx.fillRect(130, 176, Math.min(220, w - 150), 10);
      ctx.fillStyle = P.c3; ctx.fillRect(130, 176, Math.min(220, w - 150) * ph, 10);
    }, c.canvas);
  })();

  /* ================= Figure 1.14: inductive kick ================= */
  (function () {
    const sch = W.schematic('#f-kick', {
      w: 360, h: 255, title: 'Relay coil switched by a MOSFET with optional flyback clamp',
      items: [
        { t: 'vcc', at: [150, 40], label: '+12 V' },
        { t: 'wire', id: 'wtop', pts: [[150, 40], [80, 40]] },
        { t: 'L', id: 'L', a: [150, 40], b: [150, 90], label: 'L' },
        { t: 'R', id: 'Rc', a: [150, 90], b: [150, 140], label: 'R coil' },
        { t: 'Z', id: 'z', a: [80, 40], b: [80, 85], label: '18 V', side: -1 },
        { t: 'wire', id: 'zb', pts: [[80, 40], [80, 85]] },
        { t: 'D', id: 'd', a: [80, 125], b: [80, 85], label: 'D', side: -1 },
        { t: 'wire', id: 'wd', pts: [[80, 125], [80, 140], [150, 140]] },
        { t: 'dot', id: 'dx', at: [150, 140] },
        { t: 'text', at: [162, 150], text: 'X', anchor: 'start' },
        { t: 'nmos', id: 'q', at: [135, 195], label: 'Q' },
        { t: 'wire', pts: [[150, 140], 'q.D'] },
        { t: 'gnd', at: [150, 225] },
        { t: 'wire', pts: ['q.S', [150, 225]] },
        { t: 'wire', pts: [[60, 195], 'q.G'] },
        { t: 'text', at: [56, 195], text: 'GPIO', anchor: 'end' },
        { t: 'tag', id: 'pk', at: [270, 140], text: '' },
      ],
    });
    let Lh = 0.1, Rc = 100, clamp = 'none', zoom = 'us';
    const ctl = W.controls('#f-kick-ctl');
    W.segmented(ctl, { options: [['none', 'No clamp'], ['diode', 'Diode'], ['zener', 'Diode + 18 V Zener']], value: clamp, onChange: (v) => { clamp = v; upd(); } });
    W.segmented(ctl, { options: [['us', '0–50 µs'], ['ms', '0–5 ms']], value: zoom, onChange: (v) => { zoom = v; upd(); } });
    W.slider(ctl, { label: 'Inductance \\(L\\)', min: 0.001, max: 1, log: true, value: Lh, unit: 'H', onInput: (v) => { Lh = v; upd(); } });
    W.slider(ctl, { label: 'Coil \\(R\\)', min: 20, max: 1000, log: true, value: Rc, unit: 'Ω', onInput: (v) => { Rc = v; upd(); } });
    const out = W.controls('#f-kick-ctl');
    const rI = W.readout(out, { label: '\\(I_0\\)', unit: 'A' }), rP = W.readout(out, { label: 'Peak at X', unit: 'V' }), rT = W.readout(out, { label: 'Current gone in', unit: 's' }), rU = W.readout(out, { label: '½LI²', unit: 'J' });
    const VS = 12, ROFF = 1e4;
    function model() {
      const I0 = VS / Rc;
      if (clamp === 'none') {
        const tau = Lh / (Rc + ROFF), If = VS / (Rc + ROFF);
        const i = (t) => (t < 0 ? I0 : If + (I0 - If) * Math.exp(-t / tau));
        return { I0, i, vx: (t) => (t < 0 ? 0 : i(t) * ROFF), peak: I0 * ROFF, tz: tau * Math.log((I0 - If) / (0.01 * I0)) };
      }
      const Vc = clamp === 'diode' ? 0.7 : 18.7, tau = Lh / Rc;
      const tz = tau * Math.log(1 + I0 * Rc / Vc);
      const i = (t) => (t < 0 ? I0 : t < tz ? (I0 + Vc / Rc) * Math.exp(-t / tau) - Vc / Rc : 0);
      return { I0, i, vx: (t) => (t < 0 ? 0 : t < tz ? VS + Vc : VS), peak: VS + Vc, tz };
    }
    const p = W.plot('#f-kick-plot', { xmin: -5e-6, xmax: 50e-6, ymin: -10, ymax: 1300, xlabel: 'Time after switch-off', ylabel: 'Voltage at X (V)', hover: true, xunit: 's', yunit: 'V', height: 240 });
    p.draw((p) => {
      const m = model(), o = p.o;
      p.hline(VS, { color: 'muted' });
      p.fn(m.vx, { color: 'c4', label: 'switch node X', samples: 800 });
      p.fn((t) => m.i(t) / m.I0 * o.ymax * 0.5, { color: 'c1', dash: [6, 4], label: 'coil current (scaled)', hover: false, samples: 800 });
    });
    function upd() {
      const m = model();
      const xmax = zoom === 'us' ? 50e-6 : 5e-3;
      p.set({ xmin: -xmax / 10, xmax, ymax: Math.max(20, m.peak * 1.15) });
      p.update();
      rI.set(m.I0); rP.set(m.peak); rT.set(m.tz); rU.set(0.5 * Lh * m.I0 * m.I0);
      rP.setClass(m.peak > 40 ? 'bad' : 'good');
      const none = clamp === 'none';
      hide(sch, 'z', clamp !== 'zener'); hide(sch, 'zb', clamp !== 'diode');
      ['d', 'wd', 'dx', 'wtop'].forEach((id) => hide(sch, id, none));
      sch.set('pk', { text: 'peak ≈ ' + W.si(m.peak, 'V', 3) });
      sch.set('L', { label: 'L ' + W.si(Lh, 'H', 2) }); sch.set('Rc', { label: 'R ' + W.si(Rc, 'Ω', 2) });
      if (m.peak < 40 && m.tz < 1e-3 && Math.abs(Lh - 0.1) < 0.01 && Math.abs(Rc - 100) < 5) Book.solve('kick-task');
    }
    upd();
  })();

  /* ================= Figure 1.15: battery sag and brown-out ================= */
  (function () {
    const sch = W.schematic('#f-sag', {
      w: 500, h: 255, title: 'Battery pack with internal resistance feeding a motor and an MCU regulator',
      items: [
        { t: 'bat2', id: 'bat', a: [50, 75], b: [50, 125], label: '4.5 V' },
        { t: 'R', id: 'ri', a: [50, 145], b: [50, 210], label: 'R_int' },
        { t: 'wire', pts: [[50, 125], [50, 145]] },
        { t: 'wire', pts: [[50, 75], [50, 40], [110, 40]] },
        { t: 'R', id: 'rw', a: [110, 40], b: [180, 40], label: 'R_wire' },
        { t: 'wire', id: 'rail', pts: [[180, 40], [460, 40]] },
        { t: 'ic', id: 'ldo', at: [300, 110], name: 'LDO', left: ['IN'], right: ['OUT'], bottom: ['GND'], w: 80 },
        { t: 'wire', id: 'inw', pts: [[242, 40], 'ldo.IN'] },
        { t: 'vcc', id: 'own', at: [242, 92], label: 'own batt' },
        { t: 'wire', id: 'ownw', pts: [[242, 92], 'ldo.IN'] },
        { t: 'wire', pts: ['ldo.GND', [300, 232]] },
        { t: 'ic', id: 'mcu', at: [390, 175], name: '', top: ['3V3'], bottom: ['GND'], w: 56, h: 56 },
        { t: 'text', at: [390, 176], text: 'MCU' },
        { t: 'wire', pts: ['ldo.OUT', [390, 110], 'mcu.3V3'] },
        { t: 'wire', pts: ['mcu.GND', [390, 232]] },
        { t: 'M', id: 'mot', a: [460, 80], b: [460, 140], label: 'M' },
        { t: 'wire', pts: [[460, 40], [460, 80]] },
        { t: 'wire', pts: [[460, 140], [460, 232], [50, 232], [50, 210]] },
        { t: 'tag', id: 'tv', at: [178, 96], text: '' },
        { t: 'tag', id: 'tr', at: [178, 130], text: '' },
      ],
    });
    let cells = 3, rc = 0.15, rw = 0.05, sep = false;
    const ctl = W.controls('#f-sag-ctl');
    W.segmented(ctl, { options: [[3, '3 cells (4.5 V)'], [4, '4 cells (6 V)']], value: cells, onChange: (v) => { cells = v; upd(); } });
    W.toggle(ctl, { label: 'MCU on separate supply', value: false, onChange: (v) => { sep = v; upd(); } });
    W.slider(ctl, { label: '\\(R_\\text{int}\\) per cell', min: 0.02, max: 1, step: 0.01, value: rc, unit: 'Ω', onInput: (v) => { rc = v; upd(); } });
    W.slider(ctl, { label: 'Wire \\(R\\)', min: 0.01, max: 0.5, step: 0.01, value: rw, unit: 'Ω', onInput: (v) => { rw = v; upd(); } });
    const out = W.controls('#f-sag-ctl');
    const rMin = W.readout(out, { label: 'Lowest MCU rail', unit: 'V' }), rIm = W.readout(out, { label: 'Start current', unit: 'A' }), rSt = W.readout(out, { label: 'Status' });
    const mflow = sch.flow([[50, 75], [50, 40], [460, 40], [460, 232], [50, 232], [50, 75]], { speed: 0, spacing: 20 });
    const RM = 2, T0 = 0.02, TM = 0.05, BTH = 2.8;
    let data = [];
    function solveAt(t) {
      const E = cells * 1.5, on = t >= T0, eb = on ? 0.75 * E * (1 - Math.exp(-(t - T0) / TM)) : 0;
      const net = [
        { name: 'E', type: 'V', n: ['e', '0'], value: E },
        { name: 'Ri', type: 'R', n: ['e', 't'], value: cells * rc },
        { name: 'Rw', type: 'R', n: ['t', 'r'], value: rw },
        { name: 'Rm', type: 'R', n: ['r', 'b'], value: on ? RM : 1e12 },
        { name: 'Eb', type: 'V', n: ['b', '0'], value: eb },
      ];
      if (!sep) net.push({ name: 'Imcu', type: 'I', n: ['r', '0'], value: 0.08 });
      const s = W.solveDC(net);
      const rail = sep ? 3.3 : Math.max(0, Math.min(3.3, s.v.r - 0.3));
      return { t, vt: s.v.t, vr: s.v.r, rail, im: s.i.Rm };
    }
    const p = W.plot('#f-sag-plot', { xmin: 0, xmax: 0.3, ymin: 0, ymax: 6.5, xlabel: 'Time (s)', ylabel: 'Voltage (V)', hover: true, xunit: 's', yunit: 'V', height: 250 });
    const interp = (key) => (t) => { const i = Math.min(data.length - 1, Math.max(0, Math.round(t / 0.3 * (data.length - 1)))); return data[i] ? data[i][key] : NaN; };
    p.draw((p) => {
      p.area(() => BTH, 0, 0.3, { color: 'c4', alpha: 0.08 }, () => 0);
      p.hline(BTH, { color: 'c4' });
      p.text(0.295, BTH - 0.25, 'brown-out 2.8 V', { color: 'c4', align: 'right', size: 11 });
      p.fn(interp('vt'), { color: 'c1', label: 'battery terminal', samples: 300 });
      p.fn(interp('rail'), { color: 'c3', label: 'MCU 3.3 V rail', samples: 300 });
      p.vline(T0); p.text(T0 + 0.003, 0.35, 'motor on', { color: 'muted', size: 11 });
    });
    function upd() {
      data = []; for (let k = 0; k <= 300; k++) data.push(solveAt(k / 1000));
      const min = Math.min(...data.map((d) => d.rail)), imax = Math.max(...data.map((d) => d.im));
      p.set({ ymax: cells === 4 ? 6.5 : 5 }); p.update();
      const bad = min < BTH;
      rMin.set(min); rMin.setClass(bad ? 'bad' : 'good'); rIm.set(imax);
      rSt.set(bad ? '⚠ BROWN-OUT → reset' : '✓ survives'); rSt.setClass(bad ? 'bad' : 'good');
      const last = data[data.length - 1];
      sch.set('bat', { label: cells * 1.5 + ' V' });
      sch.set('ri', { label: 'R_int ' + W.si(cells * rc, 'Ω', 2) });
      sch.set('rw', { label: 'R_wire ' + W.si(rw, 'Ω', 2) });
      sch.set('tv', { text: 'V_bat ≥ ' + W.fix(Math.min(...data.map((d) => d.vt)), 2) + ' V' });
      sch.set('tr', { text: 'rail ≥ ' + W.fix(min, 2) + ' V' });
      sch.set('tr', { cls: ['bad', bad] });
      hide(sch, 'inw', sep); hide(sch, 'own', !sep); hide(sch, 'ownw', !sep);
      mflow.set(last.im / 0.8);
      if (cells * rc >= cells * 0.4 - 1e-9 && rc >= 0.4 - 1e-9 && !bad) Book.solve('sag-task');
    }
    upd();
  })();
})();
