/* Appendix A · Math Toolkit — widgets */
(function () {
  'use strict';
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const pal = () => ({
    ink: W.col('ink'), muted: W.col('muted'), line: W.col('line'), surface: W.col('surface'), surface2: W.col('surface2'),
    c1: W.col('c1'), c2: W.col('c2'), c3: W.col('c3'), c4: W.col('c4'), c5: W.col('c5'), c6: W.col('c6'), wire: W.col('wire'),
  });
  function arrow(ctx, x1, y1, x2, y2, head = 8) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (Math.hypot(x2 - x1, y2 - y1) < 2) return;
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
    ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }
  const ptr = (e, el) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const renderMath = (el) => { if (window.Book && Book.renderMath) Book.renderMath(el); };
  const sup = (n) => String(n).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

  /* ============ A.1 orders of magnitude ruler ============ */
  (function () {
    const host = W.$('#f-orders');
    const c = W.canvas(host, { height: 190 });
    const ctl = W.controls(host);
    let val = 4.7e3;
    W.slider(ctl, { label: 'Value', min: 1e-12, max: 1e9, log: true, value: val, format: (v) => W.si(v, '', 3), onInput: (v) => { val = v; draw(); } });
    const rs = W.readout(ctl, { label: 'Scientific' }), re = W.readout(ctl, { label: 'Engineering' });
    const MARK = [[22e-12, '22 pF load cap', -1], [1e-9, '1 ns edge', 1], [100e-9, '100 nF decoupling', -1], [5e-6, '5 µA deep sleep', 1], [1e-3, '1 ms debounce', -1], [20e-3, '20 mA LED', 1], [3.3, '3.3 V rail', -1], [4.7e3, '4.7 kΩ pull-up', 1], [400e3, '400 kHz I²C', -1], [16e6, '16 MHz clock', 1], [2.4e9 / 3, '', 0], [1e9 * 0.999, '≈ GHz radio', -1]];
    function draw() {
      const { ctx, w, h } = c, P = pal();
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      const x0 = 24, x1 = w - 24, y = h / 2;
      const X = (v) => x0 + (Math.log10(v) + 12) / 21 * (x1 - x0);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.font = '11px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = P.muted;
      const PF = { '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '1', '3': 'k', '6': 'M', '9': 'G' };
      for (let e = -12; e <= 9; e++) {
        const x = X(Math.pow(10, e)), big = e % 3 === 0;
        ctx.strokeStyle = P.muted; ctx.lineWidth = big ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x, y - (big ? 9 : 5)); ctx.lineTo(x, y + (big ? 9 : 5)); ctx.stroke();
        if (big) { ctx.fillStyle = P.ink; ctx.font = 'bold 13px ' + FONT; ctx.fillText(PF[e], x, y + 24); ctx.fillStyle = P.muted; ctx.font = '11px ' + FONT; ctx.fillText('10' + sup(e), x, y + 40); }
      }
      const narrow = w < 600;
      MARK.forEach(([v, t, s], k) => {
        if (!t || (narrow && ![0, 3, 7, 11].includes(k))) return;
        const x = X(v), yy = y + s * (narrow ? 34 : 40) * (s < 0 ? 1.2 : 1.6);
        ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, yy + (s < 0 ? 6 : -10)); ctx.stroke();
        ctx.fillStyle = P.c6; ctx.font = '11px ' + FONT; ctx.textAlign = x < 60 ? 'left' : x > w - 60 ? 'right' : 'center';
        ctx.fillText(t, x, yy);
      });
      const xp = X(val);
      ctx.fillStyle = P.c4; ctx.beginPath(); ctx.moveTo(xp, y - 4); ctx.lineTo(xp - 8, y - 20); ctx.lineTo(xp + 8, y - 20); ctx.closePath(); ctx.fill();
      ctx.textAlign = 'center';
      const e = Math.floor(Math.log10(val)), m = val / Math.pow(10, e);
      rs.set(m.toFixed(2) + ' × 10' + sup(e)); re.set(W.si(val, '', 3));
    }
    draw();
    new ResizeObserver(draw).observe(c.wrap);
    document.addEventListener('themechange', draw);
  })();

  /* ============ A.2 formula explorer ============ */
  (function () {
    const host = W.$('#f-algebra');
    const top = W.controls(host);
    const tex = W.h('div', { class: 'ma-tex' }); host.append(tex);
    const sl = W.h('div', { class: 'w-controls' }); host.append(sl);
    const out = W.controls(host);
    const res = W.readout(out, { label: 'Result' });
    const F = {
      ohm: { name: 'Ohm: V = IR', vars: { V: [0.1, 24, 5, 'V', '\\(V\\)'], I: [1e-4, 2, 0.01, 'A', '\\(I\\)', 1], R: [1, 1e6, 470, 'Ω', '\\(R\\)', 1] },
        solve: { V: ['V = I\\,R', (v) => v.I * v.R], I: ['I = \\dfrac{V}{R}', (v) => v.V / v.R], R: ['R = \\dfrac{V}{I}', (v) => v.V / v.I] } },
      pow: { name: 'Power: P = V²/R', vars: { P: [0.001, 10, 0.25, 'W', '\\(P\\)', 1], V: [0.1, 24, 5, 'V', '\\(V\\)'], R: [1, 1e5, 100, 'Ω', '\\(R\\)', 1] },
        solve: { P: ['P = \\dfrac{V^2}{R}', (v) => v.V * v.V / v.R], V: ['V = \\sqrt{P\\,R}', (v) => Math.sqrt(v.P * v.R)], R: ['R = \\dfrac{V^2}{P}', (v) => v.V * v.V / v.P] } },
      div: { name: 'Divider: Vout = Vin·R2/(R1+R2)', vars: { Vout: [0.1, 11.9, 3.3, 'V', '\\(V_{out}\\)'], Vin: [1, 12, 5, 'V', '\\(V_{in}\\)'], R1: [100, 1e6, 10e3, 'Ω', '\\(R_1\\)', 1], R2: [100, 1e6, 20e3, 'Ω', '\\(R_2\\)', 1] },
        solve: { Vout: ['V_{out} = V_{in}\\,\\dfrac{R_2}{R_1 + R_2}', (v) => v.Vin * v.R2 / (v.R1 + v.R2)], R2: ['R_2 = R_1\\,\\dfrac{V_{out}}{V_{in} - V_{out}}', (v) => (v.Vout < v.Vin ? v.R1 * v.Vout / (v.Vin - v.Vout) : NaN)], R1: ['R_1 = R_2\\,\\dfrac{V_{in} - V_{out}}{V_{out}}', (v) => (v.Vout < v.Vin ? v.R2 * (v.Vin - v.Vout) / v.Vout : NaN)] } },
      led: { name: 'LED: Vs = I·R + Vf', vars: { R: [10, 1e4, 150, 'Ω', '\\(R\\)', 1], I: [1e-4, 0.05, 0.01, 'A', '\\(I\\)', 1], Vs: [2, 12, 3.3, 'V', '\\(V_s\\)'], Vf: [1.6, 3.4, 1.9, 'V', '\\(V_F\\)'] },
        solve: { R: ['R = \\dfrac{V_s - V_F}{I}', (v) => (v.Vs > v.Vf ? (v.Vs - v.Vf) / v.I : NaN)], I: ['I = \\dfrac{V_s - V_F}{R}', (v) => (v.Vs > v.Vf ? (v.Vs - v.Vf) / v.R : NaN)], Vs: ['V_s = I\\,R + V_F', (v) => v.I * v.R + v.Vf] } },
    };
    let f = 'div', unk = 'R2', vals = {}, seg = null;
    W.select(top, { label: 'Formula', options: Object.entries(F).map(([k, o]) => [k, o.name]), value: f, onChange: (v) => { f = v; unk = Object.keys(F[f].solve)[0]; build(); } });
    const segHost = W.h('span'); top.append(segHost);
    function build() {
      const o = F[f];
      segHost.innerHTML = '';
      seg = W.segmented(segHost, { options: Object.keys(o.solve).map((k) => [k, 'Solve for ' + k]), value: unk, onChange: (v) => { unk = v; build(); } });
      sl.innerHTML = '';
      vals = {};
      for (const [k, [mn, mx, d, u, lab, lg]] of Object.entries(o.vars)) {
        vals[k] = d;
        if (k === unk) continue;
        W.slider(sl, { label: lab, min: mn, max: mx, log: !!lg, step: lg ? undefined : (mx - mn) / 200, value: d, unit: u, onInput: (v) => { vals[k] = v; calc(); } });
      }
      renderMath(sl);
      W.tex(tex, o.solve[unk][0], true);
      calc();
    }
    function calc() {
      const o = F[f], r = o.solve[unk][1](vals);
      res.set(isFinite(r) ? unk + ' = ' + W.si(r, o.vars[unk][3], 3) : 'no solution (check inputs)');
    }
    build();
    void seg;
  })();

  /* ============ A.3 exponentials ============ */
  (function () {
    let R = 10e3, C = 100e-9, mode = 'charge';
    const host = W.$('#f-exp');
    const p = W.plot(host, { xmin: 0, xmax: 5e-3, ymin: 0, ymax: 1.05, xlabel: 'Time', ylabel: 'Fraction of supply', hover: true, xunit: 's', height: 260, yfmt: (v) => Math.round(v * 100) + '%', });
    const ctl = W.controls(host);
    W.segmented(ctl, { options: [['charge', 'Charge'], ['discharge', 'Discharge']], value: mode, onChange: (v) => { mode = v; upd(); } });
    W.slider(ctl, { label: '\\(R\\)', min: 100, max: 1e6, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 1e-9, max: 100e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    const rt = W.readout(ctl, { label: 'τ = RC', unit: 's' });
    const f = (t) => (mode === 'charge' ? 1 - Math.exp(-t / (R * C)) : Math.exp(-t / (R * C)));
    p.draw((p) => {
      const tau = R * C;
      p.fn(f, { color: 'c1', label: mode === 'charge' ? 'v / Vs = 1 − e^(−t/τ)' : 'v / V0 = e^(−t/τ)', hoverFmt: (x, y) => `${W.si(x, 's')}: ${(y * 100).toFixed(1)}%` });
      p.line(mode === 'charge' ? [[0, 0], [tau, 1]] : [[0, 1], [tau, 0]], { color: 'c2', dash: [6, 4], width: 1.5 });
      for (let k = 1; k <= 5; k++) p.point(k * tau, f(k * tau), { color: k === 1 ? 'c4' : 'c3', r: 4, label: k + 'τ', align: mode === 'charge' ? 'right' : 'left' });
      p.hline(mode === 'charge' ? 0.632 : 0.368, { color: 'c4', width: 1 });
    });
    function upd() {
      const tau = R * C;
      p.set({ xmax: 6 * tau }); p.update(); rt.set(tau);
      if (mode === 'charge' && Math.abs(tau - 2e-3) < 0.1e-3) Book.solve('exp-task');
    }
    upd();
  })();

  /* ============ A.4 decibels ============ */
  (function () {
    let r = 10;
    const host = W.$('#f-db');
    const p = W.plot(host, { xmin: 0.01, xmax: 100, logx: true, ymin: -45, ymax: 45, xlabel: 'Ratio (output / input)', ylabel: 'Gain (dB)', hover: true, height: 260, yunit: 'dB' });
    const ctl = W.controls(host);
    W.slider(ctl, { label: 'Ratio', min: 0.01, max: 100, log: true, value: r, format: (v) => '×' + (+v.toPrecision(3)), onInput: (v) => { r = v; upd(); } });
    const rp = W.readout(ctl, { label: 'as power ratio', fmt: (v) => v.toFixed(2) + ' dB' }), rv = W.readout(ctl, { label: 'as voltage ratio', fmt: (v) => v.toFixed(2) + ' dB' });
    p.draw((p) => {
      p.fn((x) => 10 * Math.log10(x), { color: 'c2', label: 'power: 10·log₁₀', hoverFmt: (x, y) => `×${x.toPrecision(3)} → ${y.toFixed(1)} dB` });
      p.fn((x) => 20 * Math.log10(x), { color: 'c1', label: 'voltage: 20·log₁₀', hoverFmt: (x, y) => `×${x.toPrecision(3)} → ${y.toFixed(1)} dB` });
      p.point(2, 3.01, { color: 'c2', r: 4 }); p.text(2.4, 1, '×2 → +3 dB', { color: 'c2', size: 11 });
      p.point(2, 6.02, { color: 'c1', r: 4 }); p.text(1.7, 9, '×2 → +6 dB', { color: 'c1', size: 11, align: 'right' });
      p.point(0.7071, -3.01, { color: 'c1', r: 4 }); p.text(0.6, -6, '0.707 → −3 dB', { color: 'c1', size: 11, align: 'right' });
      p.vline(r, { color: 'c4' });
      p.point(r, 10 * Math.log10(r), { color: 'c2', r: 6 }); p.point(r, 20 * Math.log10(r), { color: 'c1', r: 6 });
    });
    function upd() { rp.set(10 * Math.log10(r)); rv.set(20 * Math.log10(r)); p.update(); }
    upd();
  })();

  /* ============ A.5 derivative ============ */
  (function () {
    const C = 1e-6;
    const WF = {
      sine: { v: (t) => 5 * Math.sin(2 * Math.PI * 1000 * t), dv: (t) => 5 * 2 * Math.PI * 1000 * Math.cos(2 * Math.PI * 1000 * t) },
      rc: { v: (t) => 5 * (1 - Math.exp(-t / 4e-4)), dv: (t) => 5 / 4e-4 * Math.exp(-t / 4e-4) },
      tri: { v: (t) => { const ph = (t / 1e-3) % 1; return ph < 0.5 ? -5 + 20 * ph : 15 - 20 * ph; }, dv: (t) => (((t / 1e-3) % 1) < 0.5 ? 20000 : -20000) },
    };
    let wf = 'sine', t0 = 0.3e-3;
    const host = W.$('#f-deriv');
    const pv = W.plot(host, { xmin: 0, xmax: 2e-3, ymin: -6, ymax: 6, xlabel: '', ylabel: 'v (V)', height: 190, xunit: 's', yunit: 'V' });
    const pi = W.plot(host, { xmin: 0, xmax: 2e-3, ymin: -0.04, ymax: 0.04, xlabel: 'Time', ylabel: 'i = C dv/dt (A)', height: 170, xunit: 's', yunit: 'A' });
    pv.canvas.classList.add('ma-canvas');
    const ctl = W.controls(host);
    W.segmented(ctl, { options: [['sine', 'Sine'], ['rc', 'RC charge'], ['tri', 'Triangle']], value: wf, onChange: (v) => { wf = v; upd(); } });
    const ts = W.slider(ctl, { label: 'Tangent at', min: 0, max: 2e-3, step: 1e-6, value: t0, unit: 's', onInput: (v) => { t0 = v; upd(); } });
    const rs = W.readout(ctl, { label: 'slope dv/dt', fmt: (v) => W.si(v, 'V/s') }), ri = W.readout(ctl, { label: 'i (C = 1 µF)', unit: 'A' });
    pv.draw((p) => {
      const w = WF[wf], v0 = w.v(t0), s = w.dv(t0), d = 0.25e-3;
      p.fn(w.v, { color: 'c1', label: 'capacitor voltage v(t)' });
      p.line([[t0 - d, v0 - s * d], [t0 + d, v0 + s * d]], { color: 'c4', width: 2.5 });
      p.point(t0, v0, { color: 'c4' });
    });
    pi.draw((p) => {
      const w = WF[wf];
      p.fn((t) => C * w.dv(t), { color: 'c2', label: 'current i(t)', samples: 600 });
      p.vline(t0, { color: 'c4' }); p.point(t0, C * w.dv(t0), { color: 'c4' });
    });
    let drag = false;
    const mv = (e) => { const [x] = ptr(e, pv.canvas); t0 = W.clamp(pv.invX(x), 0, 2e-3); ts.set(t0, false); upd(); };
    pv.canvas.addEventListener('pointerdown', (e) => { drag = true; pv.canvas.setPointerCapture(e.pointerId); mv(e); });
    pv.canvas.addEventListener('pointermove', (e) => { if (drag) mv(e); });
    pv.canvas.addEventListener('pointerup', () => { drag = false; });
    function upd() {
      const s = WF[wf].dv(t0);
      rs.set(s); ri.set(C * s); pv.update(); pi.update();
      if (wf === 'sine' && Math.abs(C * s) < 0.02 * C * 5 * 2 * Math.PI * 1000) Book.solve('deriv-task');
    }
    upd();
  })();

  /* ============ A.6 integral ============ */
  (function () {
    const Cap = 100e-6;
    const WF = {
      pulse: { i: (t) => ((t % 2e-3) < 1e-3 ? 2e-3 : 0), ymax: 3e-3, ymin: -0.5e-3 },
      sine: { i: (t) => 5e-3 * Math.sin(2 * Math.PI * 500 * t), ymax: 6e-3, ymin: -6e-3 },
      decay: { i: (t) => 10e-3 * Math.exp(-t / 0.5e-3), ymax: 11e-3, ymin: -1e-3 },
    };
    let wf = 'pulse', t1 = 2.5e-3;
    const host = W.$('#f-integ');
    const pi = W.plot(host, { xmin: 0, xmax: 4e-3, ymin: -0.5e-3, ymax: 3e-3, ylabel: 'current i (A)', height: 190, xunit: 's', yunit: 'A' });
    const pq = W.plot(host, { xmin: 0, xmax: 4e-3, ymin: 0, ymax: 5e-6, xlabel: 'Time', ylabel: 'charge Q (C)', height: 170, xunit: 's', yunit: 'C', hover: true });
    const ctl = W.controls(host);
    W.segmented(ctl, { options: [['pulse', 'Pulses'], ['sine', 'Sine'], ['decay', 'Decay']], value: wf, onChange: (v) => { wf = v; upd(); } });
    W.slider(ctl, { label: 'Up to time', min: 0, max: 4e-3, step: 1e-5, value: t1, unit: 's', onInput: (v) => { t1 = v; upd(); } });
    const rq = W.readout(ctl, { label: 'Q = ∫i dt', unit: 'C' }), rv = W.readout(ctl, { label: 'ΔV on 100 µF', unit: 'V' });
    let cum = [];
    const N = 800, dt = 4e-3 / N;
    const Q = (t) => cum[Math.min(N, Math.max(0, Math.round(t / dt)))];
    pi.draw((p) => {
      const w = WF[wf];
      p.area(w.i, 0, t1, { color: 'c3', alpha: 0.3 });
      p.fn(w.i, { color: 'c3', label: 'i(t)', samples: 800 });
      p.vline(t1, { color: 'c4' });
    });
    pq.draw((p) => { p.fn(Q, { color: 'c5', label: 'running total Q(t)', samples: 400 }); p.point(t1, Q(t1), { color: 'c4' }); });
    function upd() {
      const w = WF[wf];
      cum = [0]; for (let k = 1; k <= N; k++) cum.push(cum[k - 1] + 0.5 * (w.i((k - 1) * dt) + w.i(k * dt)) * dt);
      const mx = Math.max(...cum), mn = Math.min(0, ...cum);
      pi.set({ ymin: w.ymin, ymax: w.ymax }); pq.set({ ymin: mn, ymax: mx * 1.1 || 1e-6 });
      pi.update(); pq.update();
      rq.set(Q(t1)); rv.set(Q(t1) / Cap);
    }
    upd();
  })();

  /* ============ A.7 Euler ============ */
  (function () {
    let r = 0.3;
    const Vs = 5;
    const host = W.$('#f-euler');
    const p = W.plot(host, { xmin: 0, xmax: 8, ymin: -4, ymax: 14, xlabel: 'Time (in τ)', ylabel: 'v (V)', height: 270, hover: true, xfmt: (v) => v + 'τ' });
    const ctl = W.controls(host);
    W.slider(ctl, { label: 'Step \\(dt/\\tau\\)', min: 0.05, max: 2.5, step: 0.01, value: r, format: (v) => v.toFixed(2), onInput: (v) => { r = v; upd(); } });
    const rf = W.readout(ctl, { label: 'Error factor 1 − dt/τ', fmt: (v) => v.toFixed(2) }), rs = W.readout(ctl, { label: 'Behaviour' });
    p.draw((p) => {
      p.fn((t) => Vs * (1 - Math.exp(-t)), { color: 'c1', label: 'exact: 5(1 − e^(−t/τ))' });
      const pts = []; let v = 0;
      for (let t = 0; t <= 8 + 1e-9; t += r) { pts.push([t, v]); v = v + (Vs - v) / 1 * r; if (Math.abs(v) > 1e4) break; }
      p.line(pts, { color: 'c4', label: 'forward Euler', width: 1.8 });
      for (const [x, y] of pts) if (y > -4 && y < 14) p.point(x, y, { color: 'c4', r: 3.5 });
      p.hline(Vs);
    });
    function upd() {
      const f = 1 - r;
      rf.set(f); p.update();
      const s = r < 1 ? 'smooth, converges' : r <= 1.0001 ? 'lands exactly in one step' : r < 2 ? 'oscillates, converges' : r < 2.0001 ? 'oscillates forever' : 'UNSTABLE: blows up';
      rs.set(s); rs.setClass(r >= 2 ? 'bad' : r > 1 ? '' : 'good');
      if (r > 1.02 && r < 1.98) Book.solve('euler-task');
    }
    upd();
  })();

  /* ============ A.8 sine ============ */
  (function () {
    let A = 3, f = 1, ph = 0;
    const host = W.$('#f-sine');
    const p = W.plot(host, { xmin: 0, xmax: 2, ymin: -5.5, ymax: 5.5, xlabel: 'Time (s)', ylabel: 'v (V)', height: 270, hover: true, xunit: 's', yunit: 'V' });
    const ctl = W.controls(host);
    W.slider(ctl, { label: 'Amplitude \\(A\\)', min: 0, max: 5, step: 0.1, value: A, unit: 'V', onInput: (v) => { A = v; upd(); } });
    W.slider(ctl, { label: 'Frequency \\(f\\)', min: 0.5, max: 4, step: 0.1, value: f, format: (v) => v.toFixed(1) + ' Hz', onInput: (v) => { f = v; upd(); } });
    W.slider(ctl, { label: 'Phase \\(\\varphi\\)', min: -180, max: 180, step: 5, value: ph, format: (v) => v + '°', onInput: (v) => { ph = v; upd(); } });
    const out = W.controls(host);
    const rw = W.readout(out, { label: 'ω = 2πf', fmt: (v) => v.toFixed(2) + ' rad/s' }), rT = W.readout(out, { label: 'T', unit: 's' }), rr = W.readout(out, { label: 'RMS', unit: 'V' }), rd = W.readout(out, { label: 'Shift', unit: 's' });
    const v = (t) => A * Math.sin(2 * Math.PI * f * t + ph * Math.PI / 180);
    p.draw((p) => {
      p.area((t) => v(t) * v(t) / 5, 0, 2, { color: 'c2', alpha: 0.18 });
      p.fn((t) => 3 * Math.sin(2 * Math.PI * t), { color: 'muted', width: 1.5, label: 'reference 3 sin(2π·1·t)', hover: false });
      p.fn(v, { color: 'c1', label: 'A sin(ωt + φ)' });
      p.hline(A * A / 2 / 5, { color: 'c2' });
      p.hline(A / Math.SQRT2, { color: 'c3', dash: [], width: 2 });
      p.text(1.98, A / Math.SQRT2 + 0.35, 'RMS = A/√2', { color: 'c3', align: 'right', size: 11 });
      p.text(1.98, A * A / 10 - 0.35, 'mean of v²/5', { color: 'c2', align: 'right', size: 11 });
    });
    function upd() { rw.set(2 * Math.PI * f); rT.set(1 / f); rr.set(A / Math.SQRT2); rd.set(-(ph / 360) / f); p.update(); }
    upd();
  })();

  /* ============ A.9 phasors ============ */
  (function () {
    const host = W.$('#f-phasor');
    const c = W.canvas(host, { height: 260 });
    const ctl = W.controls(host);
    let A2 = 0.7, dph = 90, run = true, th = 0;
    W.slider(ctl, { label: 'Amplitude of \\(I\\)', min: 0, max: 1, step: 0.05, value: A2, format: (v) => v.toFixed(2), onInput: (v) => { A2 = v; } });
    W.slider(ctl, { label: 'Phase of \\(I\\) vs \\(V\\)', min: -180, max: 180, step: 5, value: dph, format: (v) => v + '°', onInput: (v) => { dph = v; } });
    W.toggle(ctl, { label: 'Rotate', value: true, onChange: (v) => { run = v; } });
    const rs = W.readout(ctl, { label: '|V + I|', fmt: (v) => v.toFixed(2) });
    W.anim((dt) => {
      if (run) th += dt * 1.2;
      const { ctx, w, h } = c, P = pal();
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      const R = Math.min(70, h / 2 - 30, w * 0.16), cx = R + 24, cy = h / 2, x0 = cx + R + 30, x1 = w - 10;
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R - 12, cy); ctx.lineTo(x1, cy); ctx.moveTo(cx, cy - R - 12); ctx.lineTo(cx, cy + R + 12); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('Im', cx + 4, 12); ctx.fillText('Re', cx + R + 2, cy - 4);
      const ph2 = dph * Math.PI / 180;
      // phasor angle measured so that the "shadow" is the vertical (sine) projection
      const vec = (a, ang) => [a * Math.cos(ang), a * Math.sin(ang)];
      const V = vec(1, th), I = vec(A2, th + ph2), S = [V[0] + I[0], V[1] + I[1]];
      const k = R;
      // waveforms on the right: Im part vs time (time runs to the right as phase decreases)
      const span = x1 - x0, cyc = 2;
      const wave = (amp, off, col, wd) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); for (let i = 0; i <= 200; i++) { const x = x0 + i / 200 * span, a = th - i / 200 * cyc * 2 * Math.PI; const y = cy - k * amp * Math.sin(a + off); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
      const Sa = Math.hypot(S[0], S[1]), So = Math.atan2(S[1], S[0]) - th;
      wave(1, 0, P.c1, 2); wave(A2, ph2, P.c2, 2); wave(Sa, So, P.c3, 2.5);
      const drawV = (v, col, from = [0, 0]) => { ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = 3; arrow(ctx, cx + k * from[0], cy - k * from[1], cx + k * (from[0] + v[0]), cy - k * (from[1] + v[1]), 9); };
      drawV(V, P.c1); drawV(I, P.c2, V); drawV(S, P.c3);
      ctx.globalAlpha = 0.5; drawV(I, P.c2); ctx.globalAlpha = 1;
      // projection lines
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      for (const [v, col] of [[V, P.c1], [S, P.c3]]) { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(cx + k * v[0], cy - k * v[1]); ctx.lineTo(x0, cy - k * v[1]); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left';
      ctx.fillStyle = P.c1; ctx.fillText('V', x0 + 4, 16); ctx.fillStyle = P.c2; ctx.fillText('I', x0 + 22, 16); ctx.fillStyle = P.c3; ctx.fillText('V + I', x0 + 36, 16);
      rs.set(Sa);
    }, c.canvas);
  })();

  /* ============ A.10 impedance in the complex plane ============ */
  (function () {
    const host = W.$('#f-imp');
    const c = W.canvas(host, { height: 270 });
    const ctl = W.controls(host);
    let kind = 'RC', R = 1000, C = 100e-9, L = 10e-3, f = 1000;
    W.segmented(ctl, { options: [['RC', 'R + C'], ['RL', 'R + L']], value: kind, onChange: (v) => { kind = v; draw(); } });
    W.slider(ctl, { label: '\\(R\\)', min: 10, max: 10e3, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; draw(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 1e-9, max: 10e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; draw(); } });
    W.slider(ctl, { label: '\\(L\\)', min: 1e-6, max: 1, log: true, value: L, unit: 'H', onInput: (v) => { L = v; draw(); } });
    W.slider(ctl, { label: 'Frequency \\(f\\)', min: 10, max: 1e6, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; draw(); } });
    const out = W.controls(host);
    const rX = W.readout(out, { label: 'X', unit: 'Ω' }), rZ = W.readout(out, { label: '|Z|', unit: 'Ω' }), rA = W.readout(out, { label: '∠Z', fmt: (v) => v.toFixed(1) + '°' });
    function draw() {
      const { ctx, w, h } = c, P = pal();
      const X = kind === 'RC' ? -1 / (2 * Math.PI * f * C) : 2 * Math.PI * f * L;
      const Z = Math.hypot(R, X), ang = Math.atan2(X, R) * 180 / Math.PI;
      rX.set(X); rZ.set(Z); rA.set(ang);
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      const cx = 50, cy = h / 2, sc = Math.min((w - 90) / R, (h / 2 - 24) / Math.abs(X || 1), (w - 90) / Z) * 0.95;
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(w - 10, cy); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = '11px ' + FONT; ctx.textAlign = 'left';
      ctx.textAlign = 'right'; ctx.fillText('Re (resistance)', w - 12, cy - 6); ctx.textAlign = 'left'; ctx.fillText('+j (inductive)', cx - 44, 16); ctx.fillText('−j (capacitive)', cx - 44, h - 6);
      const zx = cx + R * sc, zy = cy - X * sc;
      ctx.setLineDash([4, 4]); ctx.strokeStyle = P.muted;
      ctx.beginPath(); ctx.moveTo(zx, cy); ctx.lineTo(zx, zy); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = ctx.fillStyle = P.c1; arrow(ctx, cx, cy, zx, cy, 8);
      ctx.strokeStyle = ctx.fillStyle = kind === 'RC' ? P.c6 : P.c5; ctx.globalAlpha = 0.6; arrow(ctx, zx, cy, zx, zy, 8); ctx.globalAlpha = 1;
      ctx.strokeStyle = ctx.fillStyle = P.c4; arrow(ctx, cx, cy, zx, zy, 10);
      ctx.font = '600 12px ' + FONT;
      ctx.fillStyle = P.c1; ctx.fillText('R', (cx + zx) / 2, cy + (X > 0 ? 16 : -8));
      ctx.fillStyle = P.c4; const zl = 'Z = ' + W.si(R, '', 3) + (X >= 0 ? ' + j' : ' − j') + W.si(Math.abs(X), 'Ω', 3); ctx.textAlign = zx + 16 + ctx.measureText(zl).width < w ? 'left' : 'right'; ctx.fillText(zl, ctx.textAlign === 'left' ? zx + 14 : zx - 14, zy + 4); ctx.textAlign = 'left';
      const a0 = 0, a1 = -Math.atan2(X, R);
      ctx.strokeStyle = P.c2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 28, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      ctx.fillStyle = P.c2; ctx.fillText(ang.toFixed(0) + '°', cx + 32, cy + (X > 0 ? -10 : 18));
    }
    draw();
    new ResizeObserver(draw).observe(c.wrap);
    document.addEventListener('themechange', draw);
  })();

  /* ============ A.11 vectors ============ */
  (function () {
    const host = W.$('#f-vec');
    const c = W.canvas(host, { height: 300 });
    c.canvas.classList.add('ma-canvas');
    const out = W.controls(host);
    const rd = W.readout(out, { label: 'a · b', fmt: (v) => v.toFixed(2) }), rc = W.readout(out, { label: '(a × b)_z', fmt: (v) => v.toFixed(2) }), rt = W.readout(out, { label: 'angle', fmt: (v) => v.toFixed(0) + '°' });
    let a = [3, 1], b = [1, 2.5], drag = null;
    const S = () => Math.min(c.w / 12, c.h / 7);
    const O = () => [c.w / 2 - S() * 1.5, c.h / 2 + S() * 1.2];
    const toPx = (v) => { const [ox, oy] = O(), s = S(); return [ox + v[0] * s, oy - v[1] * s]; };
    const fromPx = (x, y) => { const [ox, oy] = O(), s = S(); return [Math.round((x - ox) / s * 4) / 4, Math.round((oy - y) / s * 4) / 4]; };
    function draw() {
      const { ctx, w, h } = c, P = pal(), s = S(), [ox, oy] = O();
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      for (let x = ox % s; x < w; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = oy % s; y < h; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const dot = a[0] * b[0] + a[1] * b[1], cr = a[0] * b[1] - a[1] * b[0], la = Math.hypot(...a) || 1e-9, lb = Math.hypot(...b);
      // parallelogram
      const pa = toPx(a), pb = toPx(b), pab = toPx([a[0] + b[0], a[1] + b[1]]);
      ctx.fillStyle = cr >= 0 ? P.c5 : P.c4; ctx.globalAlpha = 0.14;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(...pa); ctx.lineTo(...pab); ctx.lineTo(...pb); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      // projection of b onto a
      const pr = dot / (la * la), pp = toPx([a[0] * pr, a[1] * pr]);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = P.muted; ctx.beginPath(); ctx.moveTo(...pb); ctx.lineTo(...pp); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = P.c3; ctx.lineWidth = 6; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(...pp); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = ctx.fillStyle = P.c1; arrow(ctx, ox, oy, ...pa, 11);
      ctx.strokeStyle = ctx.fillStyle = P.c2; arrow(ctx, ox, oy, ...pb, 11);
      for (const [p, col] of [[pa, P.c1], [pb, P.c2]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill(); }
      ctx.font = '600 14px ' + FONT; ctx.textAlign = 'left';
      ctx.fillStyle = P.c1; ctx.fillText('a (' + a.join(', ') + ')', pa[0] + 10, pa[1] - 8);
      ctx.fillStyle = P.c2; ctx.fillText('b (' + b.join(', ') + ')', pb[0] + 10, pb[1] - 8);
      // cross product symbol at origin
      ctx.strokeStyle = ctx.fillStyle = cr >= 0 ? P.c5 : P.c4; ctx.lineWidth = 2;
      const sx = ox - 28, sy = oy + 26;
      ctx.beginPath(); ctx.arc(sx, sy, 10, 0, 7); ctx.stroke();
      if (cr >= 0) { ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(sx - 7, sy - 7); ctx.lineTo(sx + 7, sy + 7); ctx.moveTo(sx - 7, sy + 7); ctx.lineTo(sx + 7, sy - 7); ctx.stroke(); }
      ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.fillText(cr >= 0 ? 'a×b: out of screen' : 'a×b: into screen', sx - 10, sy + 26);
      rd.set(dot); rc.set(cr); rt.set(Math.acos(W.clamp(dot / (la * (lb || 1e-9)), -1, 1)) * 180 / Math.PI);
      rd.setClass(Math.abs(dot) < 1e-9 ? 'good' : '');
    }
    c.canvas.addEventListener('pointerdown', (e) => {
      const [x, y] = ptr(e, c.canvas), pa = toPx(a), pb = toPx(b);
      drag = Math.hypot(x - pa[0], y - pa[1]) < 18 ? a : Math.hypot(x - pb[0], y - pb[1]) < 18 ? b : null;
      if (drag) { c.canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    c.canvas.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = ptr(e, c.canvas); const v = fromPx(W.clamp(x, 5, c.w - 5), W.clamp(y, 5, c.h - 5)); drag[0] = v[0]; drag[1] = v[1]; draw(); });
    c.canvas.addEventListener('pointerup', () => { drag = null; });
    draw();
    new ResizeObserver(draw).observe(c.wrap);
    document.addEventListener('themechange', draw);
  })();

  /* ============ A.12 node matrix ============ */
  (function () {
    const sch = W.schematic('#f-matrix', {
      w: 460, h: 205, title: 'Two-node resistor network driven by a voltage source',
      items: [
        { t: 'V', id: 'vs', a: [50, 90], b: [50, 150], label: 'Vs 10 V' },
        { t: 'wire', pts: [[50, 90], [50, 40], [80, 40]] },
        { t: 'R', id: 'r1', a: [80, 40], b: [160, 40], label: 'R1' },
        { t: 'wire', pts: [[160, 40], [230, 40]] },
        { t: 'wire', pts: [[200, 40], [200, 75]] },
        { t: 'R', id: 'r2', a: [200, 75], b: [200, 145], label: 'R2' },
        { t: 'R', id: 'r3', a: [230, 40], b: [310, 40], label: 'R3' },
        { t: 'wire', pts: [[310, 40], [360, 40], [360, 75]] },
        { t: 'R', id: 'r4', a: [360, 75], b: [360, 145], label: 'R4' },
        { t: 'wire', pts: [[360, 145], [360, 180], [50, 180], [50, 150]] },
        { t: 'wire', pts: [[200, 145], [200, 180]] },
        { t: 'dot', at: [200, 40] }, { t: 'dot', at: [200, 180] },
        { t: 'gnd', at: [120, 180] },
        { t: 'tag', id: 't1', at: [200, 14], text: '' },
        { t: 'tag', id: 't2', at: [360, 14], text: '' },
      ],
    });
    const texEl = W.$('#f-matrix-tex');
    const ctl = W.controls('#f-matrix-ctl');
    const Rv = [1000, 1000, 1000, 1000];
    Rv.forEach((v, k) => W.slider(ctl, { label: '\\(R_' + (k + 1) + '\\)', min: 100, max: 100e3, log: true, value: v, unit: 'Ω', onInput: (x) => { Rv[k] = x; upd(); } }));
    const out = W.controls('#f-matrix-ctl');
    const rA = W.readout(out, { label: 'Direct 2×2: v₁, v₂' }), rB = W.readout(out, { label: 'W.solveDC: v₁, v₂' });
    const Vs = 10;
    function upd() {
      const [G1, G2, G3, G4] = Rv.map((r) => 1 / r);
      const a = G1 + G2 + G3, b = -G3, c = -G3, d = G3 + G4, i1 = G1 * Vs;
      const det = a * d - b * c, v1 = (i1 * d) / det, v2 = (-c * i1) / det;
      const s = W.solveDC([
        { name: 'V', type: 'V', n: ['in', '0'], value: Vs },
        { name: 'R1', type: 'R', n: ['in', 'n1'], value: Rv[0] }, { name: 'R2', type: 'R', n: ['n1', '0'], value: Rv[1] },
        { name: 'R3', type: 'R', n: ['n1', 'n2'], value: Rv[2] }, { name: 'R4', type: 'R', n: ['n2', '0'], value: Rv[3] },
      ]);
      const m = (g) => (g * 1000).toFixed(3);
      W.tex(texEl, `\\underbrace{\\begin{pmatrix} ${m(a)} & ${m(b)} \\\\ ${m(c)} & ${m(d)} \\end{pmatrix}}_{\\mathbf G\\ (\\text{mS})}\\begin{pmatrix} v_1 \\\\ v_2 \\end{pmatrix} = \\underbrace{\\begin{pmatrix} ${(i1 * 1000).toFixed(3)} \\\\ 0 \\end{pmatrix}}_{\\mathbf i\\ (\\text{mA})} \\;\\Rightarrow\\; \\begin{pmatrix} v_1 \\\\ v_2 \\end{pmatrix} = \\begin{pmatrix} ${v1.toFixed(3)} \\\\ ${v2.toFixed(3)} \\end{pmatrix}\\text{ V}`, true);
      rA.set(v1.toFixed(3) + ' V, ' + v2.toFixed(3) + ' V');
      rB.set(s.v.n1.toFixed(3) + ' V, ' + s.v.n2.toFixed(3) + ' V');
      Rv.forEach((r, k) => sch.set('r' + (k + 1), { label: 'R' + (k + 1) + ' ' + W.si(r, 'Ω', 2) }));
      sch.set('t1', { text: 'v₁ = ' + W.fix(v1, 2) + ' V' }); sch.set('t2', { text: 'v₂ = ' + W.fix(v2, 2) + ' V' });
    }
    upd();
  })();
})();
