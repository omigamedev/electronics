/* Chapter 8 widgets: motors, sensors and control */
(function () {
  'use strict';
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const col = (c) => W.col(c);
  const clamp = W.clamp;

  // ---------- small shared helpers ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
  function arrow(ctx, x1, y1, x2, y2, color, width = 2, head = 8) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
    ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function text(ctx, s, x, y, o = {}) {
    ctx.save(); ctx.font = (o.bold ? '600 ' : '') + (o.size || 12) + 'px system-ui, sans-serif';
    ctx.fillStyle = o.color || col('ink'); ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
    ctx.fillText(s, x, y); ctx.restore();
  }
  function clear(c) { const x = c.ctx; x.clearRect(0, 0, c.w, c.h); x.fillStyle = col('surface'); x.fillRect(0, 0, c.w, c.h); }
  // colour every stroke of a schematic part (inline style beats the CSS rules on children)
  function paint(sch, id, c) {
    const r = sch.parts[id]; if (!r) return;
    r.g.querySelectorAll('line,polyline,polygon,path,circle,rect').forEach((e) => {
      e.style.stroke = c ? `var(--${c})` : '';
      if (e.classList.contains('fill')) e.style.fill = c ? `var(--${c})` : '';
    });
  }
  const ctlOf = (id) => { const d = W.h('div', { class: 'w-controls' }); W.$(id).append(d); return d; };
  const redrawOnTheme = (fn) => document.addEventListener('themechange', fn);

  /* =====================================================================
   * Figure 8.1 — animated brushed DC motor
   * ===================================================================== */
  (function motorFig() {
    const host = '#w-motor';
    const c = W.canvas(host, { height: 380 });
    const ctl = ctlOf('#w-motor-ctl');
    const P = { V: 6, load: 0.2, comm: true, coils: 1 };
    // toy units: k = 1 V·s/rad, R = 4 Ω, J chosen for a 0.3 s mechanical time constant
    const k = 1, R = 4, J = 0.075, b = 0.004;
    let th = 0.35, w = 0, I = 0, tq = 0;
    W.slider(ctl, { label: 'Supply \\(V\\)', min: 0, max: 12, step: 0.1, value: P.V, unit: 'V', onInput: (v) => { P.V = v; } });
    W.slider(ctl, { label: 'Load', min: 0, max: 1.2, step: 0.01, value: P.load, format: (v) => (v / 1.2 * 100).toFixed(0) + ' %', onInput: (v) => { P.load = v; } });
    W.segmented(ctl, { options: [[true, 'Commutator on'], [false, 'off']], value: true, onChange: (v) => { P.comm = v; } });
    W.segmented(ctl, { options: [[1, '1 coil'], [3, '3 coils']], value: 1, onChange: (v) => { P.coils = v; } });
    const rS = W.readout(ctl, { label: 'speed', fmt: (v) => v.toFixed(0) + ' rpm' });
    const rI = W.readout(ctl, { label: 'current', unit: 'A' });
    const rE = W.readout(ctl, { label: 'back-EMF', unit: 'V' });

    function coilAngles(theta) { const n = P.coils; const a = []; for (let j = 0; j < n; j++) a.push(theta + j * Math.PI / n); return a; }
    function gain(theta) { // torque factor per unit current (normalised so its average ≈ 1 with commutator)
      const n = P.coils, G = n * 2 / Math.PI; let s = 0;
      for (const a of coilAngles(theta)) { const cs = Math.cos(a); s += (P.comm ? Math.sign(cs) || 1 : 1) * cs; }
      return s / G;
    }
    function step(dt) {
      const n = 20, h = dt / n;
      for (let i = 0; i < n; i++) {
        const g = gain(th);
        I = (P.V - k * w * g) / R;
        const te = k * I * g;
        let net;
        if (Math.abs(w) > 0.05) net = te - b * w - P.load * Math.sign(w);
        else if (Math.abs(te) > P.load) net = te - P.load * Math.sign(te);
        else { net = 0; w = 0; }
        w += h * net / J; th += h * w;
        tq = te;
      }
      th = ((th % TAU) + TAU) % TAU;
    }
    function draw() {
      clear(c);
      const x = c.ctx, W_ = c.w, stripH = 92, H = c.h - stripH - 6;
      const cx = W_ / 2, cy = H / 2 + 4, Rr = Math.min(H * 0.36, W_ * 0.2);
      // magnets
      const mw = Math.max(26, Rr * 0.38), gap = 14;
      const magH = Rr * 2.2;
      x.save();
      x.fillStyle = col('c4'); x.globalAlpha = 0.85;
      x.beginPath(); x.roundRect(cx - Rr - gap - mw, cy - magH / 2, mw, magH, 6); x.fill();
      x.fillStyle = col('c1');
      x.beginPath(); x.roundRect(cx + Rr + gap, cy - magH / 2, mw, magH, 6); x.fill();
      x.restore();
      text(x, 'N', cx - Rr - gap - mw / 2, cy, { color: '#fff', size: 20, bold: true });
      text(x, 'S', cx + Rr + gap + mw / 2, cy, { color: '#fff', size: 20, bold: true });
      // field lines
      x.save(); x.globalAlpha = 0.35;
      for (let yy = -2; yy <= 2; yy++) arrow(x, cx - Rr - gap + 2, cy + yy * Rr * 0.42, cx + Rr + gap - 2, cy + yy * Rr * 0.42, col('muted'), 1.2, 7);
      x.restore();
      text(x, 'B', cx + Rr + gap - 10, cy - magH / 2 + 10, { color: col('muted'), size: 13, bold: true });
      // armature
      x.save(); x.fillStyle = col('surface2'); x.strokeStyle = col('line'); x.lineWidth = 2;
      x.beginPath(); x.arc(cx, cy, Rr * 0.92, 0, TAU); x.fill(); x.stroke(); x.restore();
      // coils
      const g = gain(th);
      const Iabs = Math.abs(I);
      coilAngles(th).forEach((a, j) => {
        const cs = Math.cos(a);
        const s = P.comm ? (Math.sign(cs) || 1) : 1; // current sense: + means end1 is "out of screen"
        const ex = Math.cos(a) * Rr * 0.8, ey = -Math.sin(a) * Rr * 0.8;
        x.save(); x.strokeStyle = col('c2'); x.globalAlpha = 0.55; x.lineWidth = 3; x.setLineDash([5, 4]);
        x.beginPath(); x.moveTo(cx + ex, cy + ey); x.lineTo(cx - ex, cy - ey); x.stroke(); x.restore();
        [[1, ex, ey], [-1, -ex, -ey]].forEach(([sg, px, py]) => {
          const out = s * sg * Math.sign(I || 1) > 0;
          const X = cx + px, Y = cy + py, r = 9;
          x.save(); x.fillStyle = col('surface'); x.strokeStyle = col('ink'); x.lineWidth = 2;
          x.beginPath(); x.arc(X, Y, r, 0, TAU); x.fill(); x.stroke();
          if (Iabs > 0.02) {
            if (out) { x.fillStyle = col('ink'); x.beginPath(); x.arc(X, Y, 2.8, 0, TAU); x.fill(); }
            else { x.beginPath(); x.moveTo(X - 5, Y - 5); x.lineTo(X + 5, Y + 5); x.moveTo(X + 5, Y - 5); x.lineTo(X - 5, Y + 5); x.stroke(); }
          }
          x.restore();
          if (Iabs > 0.02) {
            // F = I L x B with B along +x: current out of screen -> force up (screen -y)
            const L = 16 + 26 * Math.min(1, Iabs / 1.5);
            const dir = out ? -1 : 1;
            arrow(x, X, Y + dir * 11, X, Y + dir * (11 + L), col('c2'), 2.5, 8);
          }
        });
      });
      // commutator + brushes
      const cr = Math.max(12, Rr * 0.2), nseg = P.coils * 2;
      for (let i = 0; i < nseg; i++) {
        const a0 = th + i * TAU / nseg + 0.12, a1 = th + (i + 1) * TAU / nseg - 0.12;
        x.save(); x.strokeStyle = P.comm ? (i % 2 ? col('c1') : col('c4')) : col('muted'); x.lineWidth = 6;
        x.beginPath(); x.arc(cx, cy, cr, -a1, -a0); x.stroke(); x.restore();
      }
      if (P.comm) {
        x.save(); x.fillStyle = col('muted');
        x.fillRect(cx - cr - 13, cy - 5, 9, 10); x.fillRect(cx + cr + 4, cy - 5, 9, 10); x.restore();
        text(x, '+', cx - cr - 20, cy - 13, { size: 12, color: col('c4'), bold: true });
        text(x, '−', cx + cr + 20, cy - 13, { size: 12, color: col('c1'), bold: true });
      } else {
        text(x, 'slip rings: current never reverses', cx, cy + Rr + 14, { size: 11, color: col('muted') });
      }
      // torque strip
      const y0 = c.h - stripH, x0 = 46, x1 = W_ - 12, sh = stripH - 26;
      x.save(); x.strokeStyle = col('line'); x.lineWidth = 1; x.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, sh); x.restore();
      const mid = y0 + sh / 2, sc = sh / 2 / 1.7;
      x.save(); x.strokeStyle = col('muted'); x.setLineDash([3, 3]); x.beginPath(); x.moveTo(x0, mid); x.lineTo(x1, mid); x.stroke(); x.restore();
      x.save(); x.strokeStyle = col('c3'); x.lineWidth = 2; x.beginPath();
      for (let i = 0; i <= 200; i++) { const a = i / 200 * TAU; const X = x0 + (x1 - x0) * i / 200; const Y = mid - gain(a) * sc; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }
      x.stroke(); x.restore();
      const mx = x0 + (x1 - x0) * th / TAU;
      x.save(); x.fillStyle = col('c2'); x.beginPath(); x.arc(mx, mid - g * sc, 5, 0, TAU); x.fill(); x.restore();
      text(x, 'torque', 22, mid, { size: 11, color: col('muted') });
      text(x, 'per amp', 22, mid + 13, { size: 11, color: col('muted') });
      text(x, '0°', x0, y0 + sh + 10, { size: 11, color: col('muted') });
      text(x, '180°', (x0 + x1) / 2, y0 + sh + 10, { size: 11, color: col('muted') });
      text(x, '360°  rotor angle', x1 - 40, y0 + sh + 10, { size: 11, color: col('muted') });
    }
    let acc = 0;
    W.anim((dt) => {
      step(dt); draw();
      acc += dt; if (acc > 0.12) { acc = 0; rS.set(w * 60 / TAU); rI.set(I); rE.set(k * w * gain(th)); }
    }, c.canvas);
    draw();
  })();

  /* =====================================================================
   * Figure 8.2 — equivalent circuit, live
   * ===================================================================== */
  (function eqFig() {
    const R = 1.5, k = 0.0057, I0 = 0.12;
    const sch = W.schematic('#w-eq', {
      w: 480, h: 250, title: 'DC motor equivalent circuit: supply, winding resistance, inductance and back-EMF source',
      items: [
        { t: 'V', id: 'v', a: [50, 95], b: [50, 160], label: '6 V' },
        { t: 'wire', pts: [[50, 95], [50, 40], [100, 40]] },
        { t: 'R', id: 'r', a: [100, 40], b: [180, 40], label: 'R = 1.5 Ω' },
        { t: 'wire', pts: [[180, 40], [210, 40]] },
        { t: 'L', id: 'l', a: [210, 40], b: [290, 40], label: 'L ≈ 0.5 mH' },
        { t: 'wire', pts: [[290, 40], [330, 40], [330, 85]] },
        { t: 'Vdc', id: 'e', a: [330, 85], b: [330, 155], label: 'e = kω' },
        { t: 'wire', pts: [[330, 155], [330, 210], [50, 210], [50, 160]] },
        { t: 'tag', id: 'ti', at: [190, 105], text: 'I = 0 A' },
        { t: 'tag', id: 'te', at: [190, 145], text: 'e = 0 V' },
        { t: 'text', at: [420, 62], text: 'the real motor', cls: '' },
        { t: 'M', id: 'm', a: [420, 90], b: [420, 150] },
        { t: 'tag', id: 'tw', at: [420, 185], text: '0 rpm' },
      ],
    });
    const flow = sch.flow([[50, 95], [50, 40], [330, 40], [330, 210], [50, 210], [50, 95]], { speed: 0 });
    const ctl = ctlOf('#w-eq-ctl');
    let V = 6, TL = 0.008, stall = false;
    W.slider(ctl, { label: 'Supply \\(V\\)', min: 0, max: 6, step: 0.1, value: V, unit: 'V', onInput: (v) => { V = v; upd(); } });
    W.slider(ctl, { label: 'Load torque', min: 0, max: 0.025, step: 0.0005, value: TL, format: (v) => (v * 1000).toFixed(1) + ' mN·m', onInput: (v) => { TL = v; upd(); } });
    W.segmented(ctl, { options: [[false, 'Free'], [true, 'Stall']], value: false, onChange: (v) => { stall = v; upd(); } });
    const rp = W.readout(ctl, { label: '\\(P_{out}\\)', unit: 'W' });
    const re = W.readout(ctl, { label: 'efficiency', fmt: (v) => (v * 100).toFixed(0) + ' %' });
    function upd() {
      let I, w;
      if (stall) { I = V / R; w = 0; }
      else {
        I = V > 0 ? I0 + TL / k : 0; w = (V - I * R) / k;
        if (w < 0) { w = 0; I = V / R; }
      }
      const e = k * w, P = Math.max(0, (I - I0)) * k * w;
      sch.set('v', { label: W.fix(V, 1) + ' V' });
      sch.set('ti', { text: 'I = ' + W.si(I, 'A', 3) });
      sch.set('te', { text: 'e = kω = ' + W.si(e, 'V', 3) });
      sch.set('tw', { text: Math.round(w * 60 / TAU) + ' rpm' + (w === 0 && V > 0 ? ' (stalled)' : '') });
      sch.set('m', { spin: w / 300 });
      flow.set(Math.min(4, I * 1.2));
      rp.set(P); re.set(V > 0 && I > 0 ? P / (V * I) : 0);
      rp.setClass(''); re.setClass(P / (V * I) > 0.5 ? 'good' : '');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 8.3 — speed–torque curves
   * ===================================================================== */
  (function curveFig() {
    const S = { V: 6, R: 1.5, k: 0.0057, I0: 0.12, T: 0.004 };
    const p = W.plot('#w-curve', { xmin: 0, xmax: 25, ymin: 0, ymax: 100, xlabel: 'Load torque (mN·m)', ylabel: '% of maximum', hover: true, height: 300, xunit: '', yunit: '' });
    const ctl = ctlOf('#w-curve-ctl');
    W.slider(ctl, { label: 'Supply \\(V\\)', min: 1, max: 12, step: 0.1, value: S.V, unit: 'V', onInput: (v) => { S.V = v; upd(); } });
    W.slider(ctl, { label: 'Winding \\(R\\)', min: 0.3, max: 10, log: true, value: S.R, unit: 'Ω', onInput: (v) => { S.R = v; upd(); } });
    W.slider(ctl, { label: 'Operating point (% of stall torque)', min: 0, max: 1, step: 0.005, value: 0.3, format: (v) => (v * 100).toFixed(1) + ' %', onInput: (v) => { S.f = v; upd(); } });
    S.f = 0.3;
    const ro = {
      w0: W.readout(ctl, { label: 'no-load', fmt: (v) => Math.round(v) + ' rpm' }),
      is: W.readout(ctl, { label: '\\(I_{stall}\\)', unit: 'A' }),
      pm: W.readout(ctl, { label: '\\(P_{max}\\)', unit: 'W' }),
      em: W.readout(ctl, { label: '\\(\\eta_{max}\\)', fmt: (v) => (v * 100).toFixed(0) + ' %' }),
      op: W.readout(ctl, { label: 'at operating point', fmt: (v) => v }),
    };
    const model = () => {
      const Is = S.V / S.R, Ts = S.k * (Is - S.I0), w0 = (S.V - S.I0 * S.R) / S.k;
      const I = (t) => S.I0 + t / S.k, w = (t) => Math.max(0, (S.V - I(t) * S.R) / S.k);
      const P = (t) => t * w(t), eta = (t) => P(t) / (S.V * I(t));
      return { Is, Ts, w0, I, w, P, eta, Pm: Ts / 2 * w0 / 2 };
    };
    function upd() {
      const m = model();
      const xmax = Math.max(0.5, m.Ts * 1000);
      p.set({ xmax });
      let etamax = 0, tEta = 0;
      for (let i = 1; i < 400; i++) { const t = m.Ts * i / 400; const e = m.eta(t); if (e > etamax) { etamax = e; tEta = t; } }
      p.draw((p) => {
        const t = (x) => x / 1000;
        p.fn((x) => 100 * m.w(t(x)) / m.w0, { color: 'c1', label: 'speed (% of no-load)', hoverFmt: (x, y) => `${Math.round(m.w(t(x)) * 60 / TAU)} rpm` });
        p.fn((x) => 100 * m.I(t(x)) / m.Is, { color: 'c4', label: 'current (% of stall)', hoverFmt: (x, y) => W.si(m.I(t(x)), 'A') });
        p.fn((x) => 100 * m.P(t(x)) / m.Pm, { color: 'c2', label: 'output power (% of max)', hoverFmt: (x, y) => W.si(m.P(t(x)), 'W') });
        p.fn((x) => 100 * m.eta(t(x)), { color: 'c3', label: 'efficiency (%)', hoverFmt: (x, y) => `η ${y.toFixed(0)} %` });
        p.vline(tEta * 1000, { color: 'c3' });
        const xo = S.f * m.Ts * 1000;
        p.vline(xo, { color: 'c5', dash: [2, 3], width: 2 });
        p.point(xo, 100 * m.eta(S.f * m.Ts), { color: 'c5', r: 4 });
      });
      ro.w0.set(m.w0 * 60 / TAU); ro.is.set(m.Is); ro.pm.set(m.Pm); ro.em.set(etamax);
      const t0 = S.f * m.Ts;
      ro.op.set(`${(t0 * 1000).toFixed(1)} mN·m, ${Math.round(m.w(t0) * 60 / TAU)} rpm, ${W.si(m.I(t0), 'A')}, η ${(m.eta(t0) * 100).toFixed(0)} %`);
    }
    upd();
  })();

  /* =====================================================================
   * Figure 8.4 — H-bridge modes
   * ===================================================================== */
  (function hbridgeFig() {
    const sch = W.schematic('#w-hb', {
      w: 460, h: 300, title: 'H-bridge with four N-channel MOSFETs and a motor',
      items: [
        { t: 'nmos', id: 'q1', at: [120, 90], label: 'Q1' },
        { t: 'nmos', id: 'q2', at: [120, 190], label: 'Q2' },
        { t: 'nmos', id: 'q3', at: [340, 90], label: 'Q3' },
        { t: 'nmos', id: 'q4', at: [340, 190], label: 'Q4' },
        { t: 'wire', pts: [[135, 60], [135, 40], [355, 40], [355, 60]] },
        { t: 'vcc', at: [245, 40], label: 'VM (battery +)' },
        { t: 'wire', pts: [[135, 120], [135, 160]] },
        { t: 'wire', pts: [[355, 120], [355, 160]] },
        { t: 'wire', pts: [[135, 140], [200, 140]] },
        { t: 'M', id: 'm', a: [200, 140], b: [290, 140] },
        { t: 'wire', pts: [[290, 140], [355, 140]] },
        { t: 'dot', at: [135, 140] }, { t: 'dot', at: [355, 140] },
        { t: 'wire', pts: [[135, 220], [135, 245], [355, 245], [355, 220]] },
        { t: 'gnd', at: [245, 245] },
        { t: 'text', at: [70, 90], text: 'H1' }, { t: 'text', at: [70, 190], text: 'L1' },
        { t: 'text', at: [295, 75], text: 'H2' }, { t: 'text', at: [295, 175], text: 'L2' },
        { t: 'wire', pts: [[80, 90], [90, 90]] }, { t: 'wire', pts: [[80, 190], [90, 190]] },
        { t: 'tag', id: 'mode', at: [245, 285], text: 'Forward' },
      ],
    });
    const paths = {
      fwd: sch.flow([[245, 40], [135, 40], [135, 140], [355, 140], [355, 245], [245, 245]], { speed: 0 }),
      rev: sch.flow([[245, 40], [355, 40], [355, 140], [135, 140], [135, 245], [245, 245]], { speed: 0 }),
      brk: sch.flow([[135, 140], [355, 140], [355, 245], [135, 245], [135, 140]], { speed: 0 }),
      sht: sch.flow([[245, 40], [135, 40], [135, 245], [245, 245]], { speed: 0, color: 'c4' }),
    };
    const ctl = ctlOf('#w-hb-ctl');
    const modes = {
      fwd: { on: ['q1', 'q4'], txt: 'Forward: Q1 + Q4 on, current left → right', spin: 0.8 },
      rev: { on: ['q3', 'q2'], txt: 'Reverse: Q3 + Q2 on, current right → left', spin: -0.8 },
      brk: { on: ['q2', 'q4'], txt: 'Brake: both low sides on, back-EMF drives a braking current', spin: 0.25 },
      coast: { on: [], txt: 'Coast: all off, motor spins down freely', spin: 0.15 },
      sht: { on: ['q1', 'q2'], txt: '⚠ Shoot-through: Q1 + Q2 short the supply!', spin: 0 },
    };
    function set(m) {
      ['q1', 'q2', 'q3', 'q4'].forEach((q) => paint(sch, q, modes[m].on.includes(q) ? (m === 'sht' ? 'c4' : 'c3') : ''));
      for (const k in paths) paths[k].set(k === m ? (m === 'brk' ? 1.2 : m === 'sht' ? 4 : 1.6) : 0);
      sch.set('mode', { text: modes[m].txt });
      sch.set('m', { spin: modes[m].spin });
    }
    W.segmented(ctl, { options: [['fwd', 'Forward'], ['rev', 'Reverse'], ['brk', 'Brake'], ['coast', 'Coast'], ['sht', 'Short!']], value: 'fwd', onChange: set });
    set('fwd');
  })();

  /* =====================================================================
   * Figure 8.5 — PWM current ripple
   * ===================================================================== */
  (function pwmFig() {
    const V = 6, L = 0.5e-3, R = 1.5, Iload = 0.5, tau = L / R;
    let f = 1000, D = 0.5, data = [], stats = {};
    const p = W.plot('#w-pwm', { xmin: 0, xmax: 4, ymin: -1, ymax: 3, xlabel: 'Time (PWM periods)', ylabel: 'Motor current (A)', hover: true, height: 270, yunit: 'A', xfmt: (v) => W.fix(v, 1), hoverFmt: null });
    const ctl = ctlOf('#w-pwm-ctl');
    W.slider(ctl, { label: 'PWM frequency', min: 200, max: 40000, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    W.slider(ctl, { label: 'Duty cycle \\(D\\)', min: 0.05, max: 0.95, step: 0.01, value: D, format: (v) => (v * 100).toFixed(0) + ' %', onInput: (v) => { D = v; upd(); } });
    const rr = W.readout(ctl, { label: 'ripple p-p', unit: 'A' });
    const ra = W.readout(ctl, { label: '\\(I_{avg}\\)', unit: 'A' });
    const rx = W.readout(ctl, { label: 'extra copper loss', fmt: (v) => '+' + (v * 100).toFixed(1) + ' %' });
    function simulate() {
      const T = 1 / f, E = Math.max(0, D * V - R * Iload);
      const iOn = (V - E) / R, iOff = -E / R;
      let i = Iload;
      const seg = (i0, iinf, t) => iinf + (i0 - iinf) * Math.exp(-t / tau);
      for (let n = 0; n < 400; n++) { i = seg(i, iOn, D * T); i = seg(i, iOff, (1 - D) * T); }
      data = []; let s = 0, s2 = 0, mn = 1e9, mx = -1e9; const N = 800;
      let ic = i;
      for (let k = 0; k <= N; k++) {
        const tt = (k / N) * 4 * T, ph = (tt / T) % 1;
        const cyc = Math.floor(tt / T + 1e-12);
        const t0 = cyc * T; // start of this period
        // current at start of each period is ic (periodic steady state)
        let cur;
        if (ph < D) cur = seg(ic, iOn, tt - t0);
        else cur = seg(seg(ic, iOn, D * T), iOff, tt - t0 - D * T);
        data.push([tt / T, cur]);
        if (k < N) { s += cur; s2 += cur * cur; mn = Math.min(mn, cur); mx = Math.max(mx, cur); }
      }
      const avg = s / N, rms2 = s2 / N;
      stats = { pp: mx - mn, avg, extra: avg > 1e-6 ? rms2 / (avg * avg) - 1 : 0, E };
    }
    function upd() {
      simulate();
      p.draw((p) => {
        for (let n = 0; n < 4; n++) p.area(() => 3, n, n + D, { color: 'c2', alpha: 0.12 }, () => -1);
        p.hline(0, { color: 'muted', dash: [2, 3] });
        p.hline(stats.avg, { color: 'c3', dash: [6, 4], width: 1.5 });
        p.line(data, { color: 'c1', label: 'motor current', width: 2.25 });
        p.text(3.97, stats.avg + 0.16, 'average', { align: 'right', color: 'c3', size: 11 });
      });
      rr.set(stats.pp); ra.set(stats.avg); rx.set(stats.extra);
      rr.setClass(stats.pp < 0.1 * Math.max(0.05, stats.avg) ? 'good' : stats.pp > stats.avg ? 'bad' : '');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 8.6 — servo following pulse width
   * ===================================================================== */
  (function servoFig() {
    const c = W.canvas('#w-servo', { height: 250 });
    const p = W.plot('#w-servo-plot', { xmin: 0, xmax: 45, ymin: -0.3, ymax: 1.5, xlabel: 'Time (ms)', ylabel: 'Signal', height: 250, scope: true, yfmt: (v) => (v === 0 ? '0' : v === 1 ? '1' : '') });
    const ctl = ctlOf('#w-servo-ctl');
    let pw = 1.5, ang = 40, vel = 0, loadT = 0, settle = 0;
    const cmdAng = () => clamp((pw - 0.5) / 2 * 180, 0, 180);
    W.slider(ctl, { label: 'Pulse width', min: 0.5, max: 2.5, step: 0.005, value: pw, format: (v) => v.toFixed(3) + ' ms', onInput: (v) => { pw = v; drawPlot(); } });
    W.button(ctl, 'Load (push the horn)', () => { loadT = 1.2; });
    const rc = W.readout(ctl, { label: 'command', fmt: (v) => v.toFixed(1) + '°' });
    const ra = W.readout(ctl, { label: 'horn', fmt: (v) => v.toFixed(1) + '°' });
    function drawPlot() {
      p.draw((p) => {
        const pts = []; for (let n = 0; n < 3; n++) { const t0 = 2 + n * 20; pts.push([t0 - 2, 0], [t0, 0], [t0, 1], [t0 + pw, 1], [t0 + pw, 0], [t0 + 20 - 2, 0]); }
        p.line(pts, { color: '#69db7c', width: 2 });
        p.text(2 + pw + 1, 1.2, pw.toFixed(2) + ' ms', { color: '#b2f2bb', size: 11 });
        p.text(22, 1.35, '← 20 ms period →', { color: '#b2f2bb', size: 11, align: 'center' });
      });
      rc.set(cmdAng());
    }
    function step(dt) {
      const err = cmdAng() - ang;
      // the internal loop is roughly proportional; an external push acts like a speed offset it must fight
      vel = clamp(18 * err - (loadT > 0 ? 150 : 0), -400, 400);
      ang = clamp(ang + vel * dt, 0, 180);
      if (loadT > 0) loadT -= dt;
      const ok = loadT <= 0 && Math.abs(ang - 135) <= 2 && Math.abs(cmdAng() - 135) <= 2.5;
      settle = ok ? settle + dt : 0;
      if (settle > 0.4) Book.solve('servo-task');
    }
    function draw() {
      clear(c);
      const x = c.ctx, cx = c.w / 2, cy = c.h * 0.66, Rh = Math.min(c.w * 0.36, c.h * 0.5);
      // body (the output shaft sits near one end of a real servo case)
      x.save(); x.fillStyle = col('surface2'); x.strokeStyle = col('muted'); x.lineWidth = 2;
      x.beginPath(); x.roundRect(cx - 30, cy - 24, Rh * 1.05, 48, 8); x.fill(); x.stroke(); x.restore();
      // protractor
      x.save(); x.strokeStyle = col('line'); x.lineWidth = 1.5;
      x.beginPath(); x.arc(cx, cy, Rh, Math.PI, TAU); x.stroke();
      for (let a = 0; a <= 180; a += 15) {
        const r0 = a % 45 ? Rh - 6 : Rh - 11, A = Math.PI + a * D2R;
        x.beginPath(); x.moveTo(cx + Math.cos(A) * r0, cy + Math.sin(A) * r0); x.lineTo(cx + Math.cos(A) * Rh, cy + Math.sin(A) * Rh); x.stroke();
        if (a % 45 === 0) text(x, a + '°', cx + Math.cos(A) * (Rh + 14), cy + Math.sin(A) * (Rh + 12), { size: 11, color: col('muted') });
      }
      x.restore();
      // error wedge
      const A1 = Math.PI + ang * D2R, A2 = Math.PI + cmdAng() * D2R;
      x.save(); x.fillStyle = col('c4'); x.globalAlpha = 0.22; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, Rh * 0.85, Math.min(A1, A2), Math.max(A1, A2)); x.closePath(); x.fill(); x.restore();
      // target mark
      x.save(); x.strokeStyle = col('c4'); x.setLineDash([4, 4]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(A2) * Rh * 0.95, cy + Math.sin(A2) * Rh * 0.95); x.stroke(); x.restore();
      // horn
      x.save(); x.translate(cx, cy); x.rotate(A1);
      x.fillStyle = col('c2'); x.beginPath(); x.moveTo(0, -11); x.lineTo(Rh * 0.78, -5); x.arc(Rh * 0.78, 0, 5, -Math.PI / 2, Math.PI / 2); x.lineTo(0, 11); x.arc(0, 0, 11, Math.PI / 2, Math.PI * 1.5); x.fill();
      x.fillStyle = col('surface'); for (let i = 1; i <= 4; i++) { x.beginPath(); x.arc(Rh * 0.16 * i + 6, 0, 2, 0, TAU); x.fill(); }
      x.restore();
      x.save(); x.fillStyle = col('ink'); x.beginPath(); x.arc(cx, cy, 5, 0, TAU); x.fill(); x.restore();
      if (loadT > 0) text(x, '← push!', cx + Math.cos(A1) * Rh * 0.6 + 26, cy + Math.sin(A1) * Rh * 0.6 - 14, { color: col('c4'), bold: true });
      text(x, 'servo case: motor + gearbox + pot + controller', cx + Rh * 0.5 - 30, cy + 38, { size: 11, color: col('muted') });
    }
    let acc = 0;
    W.anim((dt) => { step(dt); draw(); acc += dt; if (acc > 0.1) { acc = 0; ra.set(ang); } }, c.canvas);
    drawPlot(); draw();
  })();

  /* =====================================================================
   * Figure 8.7 — BLDC commutation
   * ===================================================================== */
  (function bldcFig() {
    const c = W.canvas('#w-bldc', { height: (W.$('#w-bldc').clientWidth || 600) < 560 ? 480 : 360 });
    const ctl = ctlOf('#w-bldc-ctl');
    const S = { mode: 'six', lead: 90, thr: 0.6 };
    const axes = [90, 210, 330].map((d) => d * D2R); // phase A, B, C magnetic axes
    let th = 0, w = 0, ia = [0, 0, 0], field = { a: 0, m: 0 }, tq = 0;
    const hist = [];
    W.segmented(ctl, { options: [['six', 'Six-step'], ['foc', 'Sinusoidal (FOC)']], value: 'six', onChange: (v) => { S.mode = v; } });
    W.slider(ctl, { label: 'Throttle', min: 0, max: 1, step: 0.01, value: S.thr, format: (v) => (v * 100).toFixed(0) + ' %', onInput: (v) => { S.thr = v; } });
    W.slider(ctl, { label: 'Field lead', min: 0, max: 150, step: 1, value: S.lead, format: (v) => v.toFixed(0) + '°', onInput: (v) => { S.lead = v; } });
    const rt = W.readout(ctl, { label: 'torque ripple', fmt: (v) => v.toFixed(0) + ' %' });
    const hall = (theta) => axes.map((a) => (Math.cos(theta - a + Math.PI / 2) > 0 ? 1 : 0)); // sensors 90° behind each axis
    function currents(theta) {
      const I = S.thr;
      if (S.mode === 'foc') {
        const phi = theta + S.lead * D2R;
        return axes.map((a) => (2 / 3) * I * Math.cos(phi - a) * 1.5);
      }
      // six-step: choose the 60°-sector state whose field is nearest to rotor + lead
      const want = theta + S.lead * D2R;
      const sector = Math.round(((want % TAU) + TAU) % TAU / (Math.PI / 3)) % 6; // field directions 0,60,...
      const fa = sector * Math.PI / 3;
      // pick the two phases whose axis difference gives this direction: + on phase nearest fa+30, - on nearest fa+150... simpler: project
      const proj = axes.map((a) => Math.cos(fa - a));
      const order = [0, 1, 2].sort((p, q) => proj[q] - proj[p]);
      const out = [0, 0, 0]; out[order[0]] = I; out[order[2]] = -I;
      return out;
    }
    function step(dt) {
      const n = 10, h = dt / n;
      for (let i = 0; i < n; i++) {
        ia = currents(th);
        let fx = 0, fy = 0; ia.forEach((v, j) => { fx += v * Math.cos(axes[j]); fy += v * Math.sin(axes[j]); });
        field = { a: Math.atan2(fy, fx), m: Math.hypot(fx, fy) };
        tq = field.m * Math.sin(field.a - th);
        w += h * (tq * 60 - 0.9 * w);
        th += h * w;
      }
      th = ((th % TAU) + TAU) % TAU;
      hist.push(tq); if (hist.length > 240) hist.shift();
    }
    function draw() {
      clear(c);
      const x = c.ctx, narrow = c.w < 560;
      const cx = narrow ? c.w / 2 : c.w * 0.33, cy = narrow ? 128 : c.h / 2, R = narrow ? 104 : Math.min(150, c.h * 0.42);
      // stator ring and teeth
      x.save(); x.strokeStyle = col('muted'); x.lineWidth = 10; x.globalAlpha = 0.5; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke(); x.restore();
      const names = ['A', 'B', 'C'], cols = ['c4', 'c3', 'c1'];
      axes.forEach((a, j) => {
        [0, Math.PI].forEach((off, s) => {
          const A = a + off, x1 = cx + Math.cos(A) * (R - 4), y1 = cy - Math.sin(A) * (R - 4), x2 = cx + Math.cos(A) * R * 0.62, y2 = cy - Math.sin(A) * R * 0.62;
          const v = ia[j] * (s ? -1 : 1);
          x.save(); x.strokeStyle = col(cols[j]); x.lineWidth = 16; x.globalAlpha = 0.25 + 0.6 * Math.min(1, Math.abs(ia[j]) / 0.7); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); x.restore();
          text(x, names[j] + (s ? "'" : ''), cx + Math.cos(A) * (R + 16), cy - Math.sin(A) * (R + 16), { bold: true, color: col(cols[j]) });
          void v;
        });
      });
      // rotor
      x.save(); x.translate(cx, cy); x.rotate(-th);
      x.fillStyle = col('c4'); x.beginPath(); x.arc(0, 0, R * 0.5, -Math.PI / 2, Math.PI / 2); x.fill();
      x.fillStyle = col('c1'); x.beginPath(); x.arc(0, 0, R * 0.5, Math.PI / 2, Math.PI * 1.5); x.fill();
      x.restore();
      text(x, 'N', cx + Math.cos(th) * R * 0.3, cy - Math.sin(th) * R * 0.3, { color: '#fff', bold: true, size: 15 });
      text(x, 'S', cx - Math.cos(th) * R * 0.3, cy + Math.sin(th) * R * 0.3, { color: '#fff', bold: true, size: 15 });
      // field vector
      const L = R * 0.85 * Math.min(1, field.m / 1.1);
      if (L > 4) arrow(x, cx, cy, cx + Math.cos(field.a) * L, cy - Math.sin(field.a) * L, col('c2'), 4, 13);
      // side panel
      const px = narrow ? 16 : c.w * 0.62, py = narrow ? 252 : 40, bw = narrow ? (c.w - 32) / 3 - 8 : 44;
      if (!narrow) text(x, 'Phase currents', px, py - 18, { align: 'left', bold: true, size: 12 });
      ia.forEach((v, j) => {
        const bx = narrow ? px + j * (bw + 12) : px + j * 58, by = narrow ? py + 30 : py + 70, bh = narrow ? 28 : 60;
        x.save(); x.strokeStyle = col('line'); x.strokeRect(bx, by - bh, bw, bh * 2); x.fillStyle = col(cols[j]);
        const hh = clamp(v / 0.7, -1, 1) * bh; x.fillRect(bx + 2, by - Math.max(0, hh), bw - 4, Math.abs(hh)); x.restore();
        const lab = Math.abs(v) < 0.02 ? 'float' : v > 0 ? '+' : '−';
        text(x, names[j] + (S.mode === 'six' ? ' ' + lab : ''), bx + bw / 2, by + bh + 12, { size: 11, color: col(cols[j]), bold: true });
      });
      const hs = hall(th);
      const hy = narrow ? py + 90 : py + 170;
      text(x, 'Hall sensors  ' + hs.map((b, j) => names[j] + '=' + b).join('  '), px, hy, { align: 'left', size: 12, color: col('muted') });
      // torque history
      const gx = px, gy = narrow ? hy + 30 : hy + 22, gw = narrow ? c.w - 32 : c.w - px - 16, gh = narrow ? c.h - gy - 8 : 80;
      x.save(); x.strokeStyle = col('line'); x.strokeRect(gx, gy, gw, gh); x.strokeStyle = col('c5'); x.lineWidth = 2; x.beginPath();
      hist.forEach((v, i) => { const X = gx + gw * i / 240, Y = gy + gh - 4 - (gh - 8) * clamp(v / 2, 0, 1); i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
      x.stroke(); x.restore();
      text(x, 'torque vs time', gx, gy - 8, { align: 'left', size: 11, color: col('muted') });
    }
    let acc = 0;
    W.anim((dt) => {
      step(dt); draw(); acc += dt;
      if (acc > 0.25 && hist.length > 60) {
        acc = 0; const h = hist.slice(-120); const mx = Math.max(...h), mn = Math.min(...h), av = h.reduce((a, b) => a + b, 0) / h.length;
        rt.set(av > 0.02 ? (mx - mn) / av * 100 : 0);
      }
    }, c.canvas);
    draw();
  })();

  /* =====================================================================
   * Figure 8.8 — stepper motor, steps and missed steps
   * ===================================================================== */
  (function stepperFig() {
    const c = W.canvas('#w-step', { height: (W.$('#w-step').clientWidth || 600) < 560 ? 420 : 330 });
    const ctl = ctlOf('#w-step-ctl');
    const S = { mode: 'full', rate: 20, load: 0.2, ramp: false, run: true };
    const Th = 1, J = 1 / Math.pow(TAU * 70, 2), b = 1.2e-4, tauE = 0.5e-3;
    let phiCmd = 0, phiR = 0, wR = 0, curRate = 0, stepAcc = 0, stepsCmd = 0, missed = 0;
    const lagHist = [];
    const micro = () => (S.mode === 'full' ? 1 : S.mode === 'half' ? 2 : 16);
    W.segmented(ctl, { options: [['full', 'Full step'], ['half', 'Half step'], ['micro', '1/16 micro']], value: 'full', onChange: (v) => { S.mode = v; } });
    W.slider(ctl, { label: 'Full steps/s', min: 2, max: 3000, log: true, value: S.rate, format: (v) => String(Math.round(v)), onInput: (v) => { S.rate = v; } });
    W.slider(ctl, { label: 'Load', min: 0, max: 0.9, step: 0.01, value: S.load, format: (v) => (v * 100).toFixed(0) + ' %', onInput: (v) => { S.load = v; } });
    W.toggle(ctl, { label: 'acceleration ramp', value: false, onChange: (v) => { S.ramp = v; } });
    W.toggle(ctl, { label: 'run', value: true, onChange: (v) => { S.run = v; } });
    W.button(ctl, 'Reset', () => { phiCmd = phiR = wR = curRate = stepAcc = stepsCmd = missed = 0; lagHist.length = 0; });
    const rc = W.readout(ctl, { label: 'commanded', fmt: (v) => v.toFixed(0) + ' full steps' });
    const rm = W.readout(ctl, { label: 'missed', fmt: (v) => v.toFixed(0) + ' steps' });
    const rsh = W.readout(ctl, { label: 'shaft', fmt: (v) => v.toFixed(1) + '°' });
    function coil(phi) {
      const m = S.mode;
      if (m === 'micro') return [Math.cos(phi), Math.sin(phi)];
      if (m === 'full') return [Math.sign(Math.cos(phi)) || 1, Math.sign(Math.sin(phi)) || 1].map((v) => v * 0.8);
      // half: phi on multiples of 45°
      const ca = Math.cos(phi), sa = Math.sin(phi);
      return [Math.abs(ca) < 0.3 ? 0 : Math.sign(ca), Math.abs(sa) < 0.3 ? 0 : Math.sign(sa)].map((v) => v * 0.85);
    }
    // step positions: full (two-phase on) sits at 45° + k·90°, half at k·45°, micro at k·5.625°
    const offset = () => (S.mode === 'full' ? Math.PI / 4 : 0);
    function step(dt) {
      const n = 300, h = dt / n;
      const target = S.run ? S.rate : 0;
      for (let i = 0; i < n; i++) {
        if (S.ramp) { const a = 1500 * h; curRate += clamp(target - curRate, -a, a); } else curRate = target;
        const usRate = curRate * micro();
        stepAcc += usRate * h;
        while (stepAcc >= 1) { stepAcc -= 1; phiCmd += (Math.PI / 2) / micro(); stepsCmd += 1 / micro(); }
        const qPhi = phiCmd + offset();
        const cur = coil(qPhi);
        const wE = curRate * Math.PI / 2;
        const fade = 1 / Math.sqrt(1 + Math.pow(wE * tauE, 2));
        const fa = Math.atan2(cur[1], cur[0]), fm = Math.hypot(cur[0], cur[1]) * fade;
        const tmag = Th * fm * Math.sin(fa - (phiR + offset()));
        const load = S.load * Th * (Math.abs(wR) > 0.5 ? Math.sign(wR) : clamp(tmag / (S.load * Th + 1e-9), -1, 1));
        // damping: a little viscous friction, plus electrical damping of oscillation about the field (only while locked)
        const rel = Math.cos(fa - (phiR + offset())) > 0.3 ? 6e-4 * (wR - wE) : 0;
        const acc = (tmag - load - rel - b * wR) / J;
        wR += acc * h; phiR += wR * h;
      }
      const lag = phiCmd - phiR;
      missed = Math.max(0, Math.round(lag / TAU) * 4);
      lagHist.push(lag); if (lagHist.length > 300) lagHist.shift();
    }
    function draw() {
      clear(c);
      const x = c.ctx, narrow = c.w < 560;
      const cx = narrow ? c.w * 0.28 : c.w * 0.2, cy = narrow ? 112 : c.h / 2, R = narrow ? Math.min(78, c.w * 0.17) : 115;
      // electrical view: 4 poles A+, B+, A-, B-
      const cur = coil(phiCmd + offset());
      const poles = [[0, 0, 'A'], [Math.PI / 2, 1, 'B'], [Math.PI, 0, "A'"], [Math.PI * 1.5, 1, "B'"]];
      poles.forEach(([a, ph, nm], i) => {
        const v = cur[ph] * (i >= 2 ? -1 : 1);
        x.save(); x.strokeStyle = col(ph ? 'c1' : 'c4'); x.globalAlpha = 0.2 + 0.7 * Math.abs(cur[ph]); x.lineWidth = 18;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R); x.lineTo(cx + Math.cos(a) * R * 0.66, cy - Math.sin(a) * R * 0.66); x.stroke(); x.restore();
        // the stator field points from N faces toward S faces, so the pole the field points at is an S pole
        text(x, nm + (Math.abs(v) < 0.05 ? '' : v > 0 ? ' S' : ' N'), cx + Math.cos(a) * (R + 18), cy - Math.sin(a) * (R + 15), { size: 11, bold: true, color: col(ph ? 'c1' : 'c4') });
      });
      const fa = Math.atan2(cur[1], cur[0]);
      arrow(x, cx, cy, cx + Math.cos(fa) * R * 0.6, cy - Math.sin(fa) * R * 0.6, col('c2'), 3, 11);
      const pr = phiR + offset();
      x.save(); x.translate(cx, cy); x.rotate(-pr);
      x.fillStyle = col('c5'); x.beginPath(); x.moveTo(R * 0.5, 0); x.lineTo(-R * 0.25, -R * 0.14); x.lineTo(-R * 0.25, R * 0.14); x.closePath(); x.fill(); x.restore();
      text(x, 'electrical view', cx, 12, { size: 11, color: col('muted') });
      // mechanical shaft view
      const mx = narrow ? c.w * 0.75 : c.w * 0.47, my = cy, mr = narrow ? Math.min(60, c.w * 0.16) : 80;
      const mech = phiR / 50; // 50 rotor teeth
      x.save(); x.strokeStyle = col('muted'); x.lineWidth = 2; x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.stroke();
      for (let i = 0; i < 50; i++) { const a = i / 50 * TAU - mech; x.beginPath(); x.moveTo(mx + Math.cos(a) * mr * 0.86, my - Math.sin(a) * mr * 0.86); x.lineTo(mx + Math.cos(a) * mr, my - Math.sin(a) * mr); x.stroke(); }
      x.restore();
      arrow(x, mx, my, mx + Math.cos(-mech + Math.PI / 2) * mr * 0.75, my - Math.sin(-mech + Math.PI / 2) * mr * 0.75, col('ink'), 3, 10);
      text(x, 'shaft (200 steps/rev)', mx, 12, { size: 11, color: col('muted') });
      // lag plot
      const gx = narrow ? 14 : c.w * 0.62, gy = narrow ? cy + R + 50 : 30, gw = narrow ? c.w - 28 : c.w - gx - 14, gh = narrow ? c.h - gy - 10 : c.h - 60;
      x.save(); x.strokeStyle = col('line'); x.strokeRect(gx, gy, gw, gh);
      const yz = gy + gh * 0.75, sc = gh * 0.7 / (2 * TAU);
      x.setLineDash([3, 3]); x.strokeStyle = col('muted');
      [0, Math.PI / 2, TAU].forEach((v) => { x.beginPath(); x.moveTo(gx, yz - v * sc); x.lineTo(gx + gw, yz - v * sc); x.stroke(); });
      x.setLineDash([]); x.strokeStyle = col('c4'); x.lineWidth = 2; x.beginPath();
      lagHist.forEach((v, i) => { const X = gx + gw * i / 300, Y = clamp(yz - v * sc, gy + 2, gy + gh - 2); i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
      x.stroke(); x.restore();
      text(x, 'rotor lag (electrical)', gx + 6, gy + 10, { align: 'left', size: 11, color: col('muted') });
      text(x, '90°: max torque', gx + gw - 4, yz - Math.PI / 2 * sc - 8, { align: 'right', size: 10, color: col('muted') });
      text(x, '360° = 4 steps lost', gx + gw - 4, yz - TAU * sc - 8, { align: 'right', size: 10, color: col('muted') });
    }
    let acc = 0;
    W.anim((dt) => {
      step(dt); draw(); acc += dt;
      if (acc > 0.1) { acc = 0; rc.set(stepsCmd); rm.set(missed); rm.setClass(missed > 0 ? 'bad' : 'good'); rsh.set(((phiR / 50) / D2R) % 360); }
    }, c.canvas);
    draw();
  })();

  /* =====================================================================
   * Figure 8.9 — A4988 wiring (static schematic)
   * ===================================================================== */
  (function a4988Fig() {
    W.schematic('#w-a4988', {
      w: 640, h: 320, title: 'ESP32 driving an A4988 stepper driver and a bipolar stepper motor',
      items: [
        { t: 'ic', id: 'mcu', at: [90, 160], name: 'ESP32', right: ['GPIO26', 'GPIO27', 'GPIO25', '3V3', 'GND'], w: 90, h: 140, pitch: 24 },
        { t: 'ic', id: 'drv', at: [310, 160], name: 'A4988 / TMC2209', left: ['STEP', 'DIR', 'EN', 'VDD', 'GND'], right: ['1A', '1B', '2A', '2B'], bottom: ['GND ', 'VMOT'], w: 110, h: 140, pitch: 24 },
        { t: 'wire', pts: ['mcu.GPIO26', 'drv.STEP'] },
        { t: 'wire', pts: ['mcu.GPIO27', 'drv.DIR'] },
        { t: 'wire', pts: ['mcu.GPIO25', 'drv.EN'] },
        { t: 'wire', pts: ['mcu.3V3', 'drv.VDD'] },
        { t: 'wire', pts: ['mcu.GND', 'drv.GND'] },
        { t: 'gnd', at: [298, 248] },
        { t: 'wire', pts: ['drv.VMOT', [322, 262], [480, 262], [480, 245]] },
        { t: 'vcc', at: [480, 245], label: 'VMOT 12 V' },
        { t: 'Cpol', id: 'c1', a: [400, 262], b: [400, 296], label: '100 µF' },
        { t: 'gnd', at: [400, 296] },
        { t: 'dot', at: [400, 262] },
        { t: 'wire', pts: ['drv.1A', [540, 124], [540, 95]] },
        { t: 'L', id: 'la', a: [540, 95], b: [600, 95], label: 'coil A' },
        { t: 'wire', pts: [[600, 95], [600, 148], 'drv.1B'] },
        { t: 'wire', pts: ['drv.2A', [540, 172], [540, 222]] },
        { t: 'L', id: 'lb', a: [540, 222], b: [600, 222], label: 'coil B', side: -1 },
        { t: 'wire', pts: [[600, 222], [600, 196], 'drv.2B'] },
        { t: 'text', at: [110, 268], text: 'MS1–MS3 → VDD: 1/16 step' },
        { t: 'text', at: [110, 288], text: 'RESET ↔ SLEEP (A4988)' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 8.10 — quadrature encoder
   * ===================================================================== */
  (function encFig() {
    const c = W.canvas('#w-enc', { height: 300 });
    const ctl = ctlOf('#w-enc-ctl');
    const SLOTS = 12, pitch = TAU / SLOTS;
    const S = { speed: 0.5, dec: 4, noise: false };
    let th = 0, count = 0, errors = 0, prev = 0, prevA = 0, prevB = 0, hist = [], win = [], rpm = 0;
    const R = rng(11);
    W.slider(ctl, { label: 'Shaft speed', min: -2, max: 2, step: 0.01, value: S.speed, format: (v) => v.toFixed(2) + ' rev/s', onInput: (v) => { S.speed = v; } });
    W.segmented(ctl, { options: [[1, '×1'], [2, '×2'], [4, '×4']], value: 4, onChange: (v) => { S.dec = v; count = 0; } });
    W.toggle(ctl, { label: 'Noise', value: false, onChange: (v) => { S.noise = v; } });
    W.button(ctl, 'Reset count', () => { count = 0; errors = 0; });
    const rcnt = W.readout(ctl, { label: 'count' });
    const rdir = W.readout(ctl, { label: 'direction' });
    const rcpr = W.readout(ctl, { label: 'counts/rev' });
    const rrpm = W.readout(ctl, { label: 'speed est. (100 ms)', fmt: (v) => v.toFixed(0) + ' rpm' });
    const rerr = W.readout(ctl, { label: 'illegal', fmt: (v) => v.toFixed(0) });
    const QD = [0, -1, 1, 2, 1, 0, 2, -1, -1, 2, 0, 1, 2, 1, -1, 0];
    // B sits 2¼ slot pitches further round: same as a quarter pitch electrically, so A leads when turning forward (CCW)
    const sensA = Math.PI / 2 + pitch * 0.4, sensB = sensA + pitch * 2.25;
    const open = (sa) => { const f = (((sa - th) / pitch) % 1 + 1) % 1; return f < 0.5 ? 1 : 0; };
    let tAcc = 0, lastCount = 0;
    function sample(h) {
      th += S.speed * TAU * h;
      let A = open(sensA), B = open(sensB);
      if (S.noise && R() < 0.0015) { A ^= 1; B ^= 1; }
      const ab = (A << 1) | B;
      if (S.dec === 4) { const d = QD[(prev << 2) | ab]; if (d === 2) errors++; else count += d; }
      else {
        if (A !== prevA) {
          if (A === 1) count += B === 0 ? 1 : -1;
          else if (S.dec === 2) count += B === 1 ? 1 : -1;
        }
        if (((prev ^ ab) === 3)) errors++;
      }
      prev = ab; prevA = A; prevB = B;
      return [A, B];
    }
    function step(dt) {
      const n = Math.max(1, Math.round(dt * 4000)), h = dt / n;
      let last;
      for (let i = 0; i < n; i++) last = sample(h);
      hist.push(last); if (hist.length > 160) hist.shift();
      tAcc += dt; if (tAcc >= 0.1) { rpm = (count - lastCount) / (SLOTS * S.dec) / tAcc * 60; lastCount = count; tAcc = 0; }
    }
    function draw() {
      clear(c);
      const x = c.ctx, narrow = c.w < 560;
      const cx = narrow ? c.w / 2 : c.w * 0.2, cy = narrow ? 92 : c.h / 2, R0 = narrow ? 76 : 110;
      x.save(); x.fillStyle = col('surface2'); x.strokeStyle = col('muted'); x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R0, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = col('c6'); x.globalAlpha = 0.85;
      for (let i = 0; i < SLOTS; i++) { const a0 = th + i * pitch; x.beginPath(); x.arc(cx, cy, R0 - 4, -(a0 + pitch / 2), -a0, false); x.arc(cx, cy, R0 * 0.7, -a0, -(a0 + pitch / 2), true); x.closePath(); x.fill(); }
      x.restore();
      x.save(); x.fillStyle = col('ink'); x.beginPath(); x.arc(cx, cy, 6, 0, TAU); x.fill(); x.restore();
      [[sensA, 'A', 'c4'], [sensB, 'B', 'c1']].forEach(([a, nm, cc]) => {
        const X = cx + Math.cos(a) * R0 * 0.85, Y = cy - Math.sin(a) * R0 * 0.85;
        const on = open(a);
        x.save(); x.fillStyle = on ? col(cc) : col('surface'); x.strokeStyle = col(cc); x.lineWidth = 2; x.beginPath(); x.arc(X, Y, 7, 0, TAU); x.fill(); x.stroke(); x.restore();
        text(x, nm, cx + Math.cos(a) * (R0 + 12), cy - Math.sin(a) * (R0 + 12), { bold: true, color: col(cc) });
      });
      text(x, 'cyan = slot (light passes)', cx, cy + R0 + 14, { size: 11, color: col('muted') });
      // waveforms
      const gx = narrow ? 14 : c.w * 0.42, gy = narrow ? cy + R0 + 34 : 30, gw = narrow ? c.w - 28 : c.w - gx - 14, gh = narrow ? c.h - gy - 10 : c.h - 60;
      x.save(); x.strokeStyle = col('line'); x.strokeRect(gx, gy, gw, gh); x.restore();
      const lane = gh / 2;
      [[0, 'A', 'c4'], [1, 'B', 'c1']].forEach(([k, nm, cc]) => {
        const base = gy + lane * (k + 1) - 10, amp = lane - 22;
        x.save(); x.strokeStyle = col(cc); x.lineWidth = 2; x.beginPath();
        hist.forEach((s, i) => { const X = gx + 24 + (gw - 30) * i / 160, Y = base - s[k] * amp; if (!i) x.moveTo(X, Y); else { const py = base - hist[i - 1][k] * amp; x.lineTo(X, py); x.lineTo(X, Y); } });
        x.stroke(); x.restore();
        text(x, nm, gx + 11, base - amp / 2, { bold: true, color: col(cc) });
      });
      text(x, 'newest →', gx + gw - 6, gy + 10, { align: 'right', size: 10, color: col('muted') });
    }
    let acc = 0;
    W.anim((dt) => {
      step(dt); draw(); acc += dt;
      if (acc > 0.1) {
        acc = 0; rcnt.set(String(count)); rdir.set(Math.abs(S.speed) < 0.005 ? 'stopped' : S.speed > 0 ? 'forward (A leads)' : 'reverse (B leads)');
        rcpr.set(String(SLOTS * S.dec)); rrpm.set(rpm); rerr.set(errors); rerr.setClass(errors ? 'bad' : '');
      }
    }, c.canvas);
    draw();
  })();

  /* =====================================================================
   * Figure 8.11 — complementary filter
   * ===================================================================== */
  (function compFig() {
    const truth = (t) => 12 * Math.sin(TAU * 0.25 * t) + 5 * Math.sin(TAU * 0.9 * t + 1) + 6 * Math.tanh((t - 5) * 4);
    const dtruth = (t) => (truth(t + 1e-4) - truth(t - 1e-4)) / 2e-4;
    const S = { alpha: 0.5, bias: 2, sa: 4 };
    let D = null;
    const p = W.plot('#w-comp', { xmin: 0, xmax: 10, ymin: -35, ymax: 35, xlabel: 'Time (s)', ylabel: 'Tilt angle (°)', hover: true, height: 300, xunit: 's', yunit: '°' });
    const ctl = ctlOf('#w-comp-ctl');
    W.slider(ctl, { label: 'Blend \\(\\alpha\\)', min: 0, max: 1, step: 0.001, value: S.alpha, format: (v) => v.toFixed(3), onInput: (v) => { S.alpha = v; upd(); } });
    W.slider(ctl, { label: 'Gyro bias', min: 0, max: 6, step: 0.1, value: S.bias, unit: '°/s', format: (v) => v.toFixed(1) + ' °/s', onInput: (v) => { S.bias = v; gen(); upd(); } });
    W.slider(ctl, { label: 'Accel noise', min: 0, max: 10, step: 0.1, value: S.sa, format: (v) => v.toFixed(1) + '°', onInput: (v) => { S.sa = v; gen(); upd(); } });
    const rtau = W.readout(ctl, { label: 'crossover \\(\\tau\\)', fmt: (v) => (isFinite(v) ? v.toFixed(2) + ' s' : '∞ (gyro only)') });
    const re = W.readout(ctl, { label: 'filter RMS error', fmt: (v) => v.toFixed(2) + '°' });
    function gen() {
      const R = rng(7), dt = 0.01; D = { t: [], tr: [], acc: [], gyr: [] };
      for (let k = 0; k <= 1000; k++) {
        const t = k * dt;
        D.t.push(t); D.tr.push(truth(t));
        D.acc.push(truth(t) + gauss(R) * S.sa + 2.5 * Math.sin(TAU * 17 * t) * (S.sa / 4));
        D.gyr.push(dtruth(t) + S.bias + gauss(R) * 0.8);
      }
    }
    function upd() {
      const dt = 0.01, a = S.alpha; let est = null, gi = null, se = 0, n = 0;
      const F = [], G = [], A = [], T = [];
      D.t.forEach((t, k) => {
        est = est === null ? D.acc[k] : a * (est + D.gyr[k] * dt) + (1 - a) * D.acc[k];
        gi = gi === null ? D.acc[0] : gi + D.gyr[k] * dt;
        F.push([t, est]); G.push([t, gi]); A.push([t, D.acc[k]]); T.push([t, D.tr[k]]);
        if (t >= 0.5) { se += (est - D.tr[k]) ** 2; n++; }
      });
      const rms = Math.sqrt(se / n);
      p.draw((p) => {
        p.line(A, { color: 'c2', width: 1, label: 'accelerometer angle' });
        p.line(G, { color: 'c1', width: 1.8, label: 'gyro integrated' });
        p.line(T, { color: 'muted', width: 3, label: 'true angle' });
        p.line(F, { color: 'c3', width: 2.2, label: 'complementary filter' });
      });
      rtau.set(S.alpha < 1 ? S.alpha * 0.01 / (1 - S.alpha) : Infinity);
      re.set(rms); re.setClass(rms < 1 ? 'good' : rms > 3 ? 'bad' : '');
      if (rms < 1 && Math.abs(S.bias - 2) < 0.05 && Math.abs(S.sa - 4) < 0.05) Book.solve('comp-task');
    }
    gen(); upd();
  })();

  /* =====================================================================
   * Figure 8.12 — ultrasonic timing
   * ===================================================================== */
  (function sonarFig() {
    const S = { d: 1.0, T: 20 };
    const p = W.plot('#w-sonar', { xmin: 0, xmax: 25, ymin: -0.5, ymax: 6.2, xlabel: 'Time (ms)', ylabel: '', height: 260, scope: true, yfmt: () => '', pad: { l: 64 } });
    const ctl = ctlOf('#w-sonar-ctl');
    W.slider(ctl, { label: 'Distance', min: 0.03, max: 4, step: 0.01, value: S.d, unit: 'm', format: (v) => v.toFixed(2) + ' m', onInput: (v) => { S.d = v; upd(); } });
    W.slider(ctl, { label: 'Air temperature', min: -10, max: 40, step: 1, value: S.T, format: (v) => v + ' °C', onInput: (v) => { S.T = v; upd(); } });
    const rw = W.readout(ctl, { label: 'ECHO width', fmt: (v) => (v * 1000).toFixed(3) + ' ms' });
    const rd = W.readout(ctl, { label: 'code assumes 20 °C →', fmt: (v) => (v * 100).toFixed(1) + ' cm' });
    const rerr = W.readout(ctl, { label: 'error', fmt: (v) => (Math.round(v * 1000) || 0) + ' mm' });
    function upd() {
      const v = 331.3 + 0.606 * S.T, te = 2 * S.d / v * 1000; // ms
      const t0 = 0.45; // burst starts ~0.45 ms after trigger
      const g = '#69db7c', g2 = '#b2f2bb';
      p.draw((p) => {
        p.line([[0, 5], [0.05, 5], [0.05, 5.8], [0.15, 5.8], [0.15, 5], [25, 5]], { color: g, width: 2 });
        p.text(0.6, 5.5, 'TRIG (10 µs)', { color: g2, size: 11 });
        p.area(() => 3.6, t0, t0 + 0.2, { color: '#ffd43b', alpha: 0.8 }, () => 2.4);
        const amp = Math.max(0.08, 0.6 / (1 + S.d));
        p.area(() => 3 + amp, t0 + te, t0 + te + 0.35, { color: '#ffd43b', alpha: 0.8 }, () => 3 - amp);
        p.line([[0, 3], [25, 3]], { color: '#ffd43b', width: 1 });
        p.text(t0 + 0.4, 3.85, '40 kHz burst out', { color: '#ffe066', size: 11 });
        p.text(Math.min(t0 + te + 0.5, 19), 2.25, 'echo returns', { color: '#ffe066', size: 11 });
        p.line([[0, 0], [t0 + 0.2, 0], [t0 + 0.2, 1], [t0 + te, 1], [t0 + te, 0], [25, 0]], { color: g, width: 2 });
        p.text(0.6, 1.4, `ECHO high for ${te.toFixed(2)} ms`, { color: g2, size: 11 });
      });
      const width = te / 1000, est = 343.4 * width / 2;
      rw.set(width); rd.set(est); rerr.set(est - S.d); rerr.setClass(Math.abs(est - S.d) > 0.02 ? 'bad' : 'good');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 8.13 — HC-SR04 level divider (static)
   * ===================================================================== */
  (function sonarSch() {
    W.schematic('#w-sonar-sch', {
      w: 520, h: 290, title: 'HC-SR04 connected to an ESP32 with a resistor divider on ECHO',
      items: [
        { t: 'ic', id: 'us', at: [100, 130], name: 'HC-SR04', right: ['VCC', 'GND', 'TRIG', 'ECHO'], pitch: 30 },
        { t: 'ic', id: 'esp', at: [430, 130], name: 'ESP32', left: ['5V', 'GND', 'GPIO5', 'GPIO18'], pitch: 30 },
        { t: 'wire', pts: ['us.VCC', 'esp.5V'] },
        { t: 'wire', pts: ['us.GND', 'esp.GND'] },
        { t: 'wire', pts: ['us.TRIG', 'esp.GPIO5'] },
        { t: 'wire', pts: ['us.ECHO', [185, 175]] },
        { t: 'R', id: 'r1', a: [185, 175], b: [255, 175], label: 'R1 1 kΩ', side: -1 },
        { t: 'wire', pts: [[255, 175], 'esp.GPIO18'] },
        { t: 'dot', at: [300, 175] },
        { t: 'R', id: 'r2', a: [300, 175], b: [300, 250], label: 'R2 2 kΩ' },
        { t: 'gnd', at: [300, 250] },
        { t: 'tag', at: [430, 240], text: 'GPIO18 sees 5 V × 2/3 ≈ 3.3 V' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 8.14 — PID simulator
   * ===================================================================== */
  (function pidFig() {
    const Km = 10, tm = 0.1, umax = 12, Tend = 2;
    const S = { mode: 'speed', kp: 0.5, ki: 0, kd: 0, rate: 200, aw: false, dmeas: true, noise: false };
    const defaults = { speed: { kp: 0.5, ki: 0, kd: 0 }, pos: { kp: 5, ki: 0, kd: 0 } };
    const ranges = { speed: { kp: [0, 5, 0.01], ki: [0, 60, 0.1], kd: [0, 0.1, 0.001] }, pos: { kp: [0, 60, 0.1], ki: [0, 100, 0.5], kd: [0, 4, 0.01] } };
    const pY = W.plot('#w-pid', { xmin: 0, xmax: Tend, ymin: 0, ymax: 90, xlabel: '', ylabel: 'Speed (rad/s)', hover: true, height: 250, xunit: 's', xfmt: (v) => W.fix(v, 1) });
    const pU = W.plot('#w-pid-u', { xmin: 0, xmax: Tend, ymin: -14, ymax: 14, xlabel: 'Time (s)', ylabel: 'Output (V)', height: 150, xunit: 's', yunit: 'V', xfmt: (v) => W.fix(v, 1) });
    const top = ctlOf('#w-pid-ctl');
    W.segmented(top, { options: [['speed', 'Speed loop'], ['pos', 'Position loop']], value: 'speed', onChange: (v) => { S.mode = v; Object.assign(S, defaults[v]); build(); run(); } });
    W.toggle(top, { label: 'anti-windup', value: S.aw, onChange: (v) => { S.aw = v; run(); } });
    W.toggle(top, { label: 'D on measurement', value: S.dmeas, onChange: (v) => { S.dmeas = v; run(); } });
    W.toggle(top, { label: 'sensor noise', value: S.noise, onChange: (v) => { S.noise = v; run(); } });
    const sl = W.h('div', { class: 'w-controls' }); W.$('#w-pid-ctl').append(sl);
    const rd = W.h('div', { class: 'w-controls' }); W.$('#w-pid-ctl').append(rd);
    const rOS = W.readout(rd, { label: 'overshoot', fmt: (v) => v.toFixed(1) + ' %' });
    const rTS = W.readout(rd, { label: 'settling (2 %)', fmt: (v) => (v >= 0.999 ? '> 1 s' : (v * 1000).toFixed(0) + ' ms') });
    const rSS = W.readout(rd, { label: 'error at end', fmt: (v) => v.toFixed(1) + ' %' });
    const note = W.$('#w-pid-note');
    function build() {
      sl.innerHTML = '';
      const r = ranges[S.mode];
      W.slider(sl, { label: '\\(K_p\\)', min: r.kp[0], max: r.kp[1], step: r.kp[2], value: S.kp, format: (v) => W.fix(v, 3), onInput: (v) => { S.kp = v; run(); } });
      W.slider(sl, { label: '\\(K_i\\)', min: r.ki[0], max: r.ki[1], step: r.ki[2], value: S.ki, format: (v) => W.fix(v, 2), onInput: (v) => { S.ki = v; run(); } });
      W.slider(sl, { label: '\\(K_d\\)', min: r.kd[0], max: r.kd[1], step: r.kd[2], value: S.kd, format: (v) => W.fix(v, 3), onInput: (v) => { S.kd = v; run(); } });
      W.slider(sl, { label: 'Loop rate', min: 10, max: 1000, log: true, value: S.rate, format: (v) => Math.round(v) + ' Hz', onInput: (v) => { S.rate = v; run(); } });
      if (window.Book && Book.renderMath) Book.renderMath(sl);
      pY.set({ ymax: S.mode === 'pos' ? 5 : 90, ylabel: S.mode === 'pos' ? 'Angle (rad)' : 'Speed (rad/s)' });
    }
    function run() {
      const r = S.mode === 'pos' ? Math.PI : 60, dts = 0.0005, dtc = 1 / S.rate, R = rng(5);
      let w = 0, th = 0, integ = 0, prevM = 0, prevE = 0, u = 0, tNext = 0, first = true;
      const Y = [], U = [], SP = [];
      for (let k = 0; k * dts <= Tend; k++) {
        const t = k * dts;
        if (t >= tNext - 1e-9) {
          tNext += dtc;
          const yv = (S.mode === 'pos' ? th : w) + (S.noise ? gauss(R) * (S.mode === 'pos' ? 0.01 : 1) : 0);
          const e = r - yv;
          if (first) { prevM = yv; prevE = S.dmeas ? e : 0; first = false; }
          const p = S.kp * e;
          const d = S.dmeas ? -S.kd * (yv - prevM) / dtc : S.kd * (e - prevE) / dtc;
          prevM = yv; prevE = e;
          const un = p + integ + d;
          const sh = un >= umax, slo = un <= -umax;
          if (!S.aw || (!(sh && e > 0) && !(slo && e < 0))) integ += S.ki * e * dtc;
          if (S.aw) integ = clamp(integ, -umax, umax);
          u = clamp(p + integ + d, -umax, umax);
        }
        const dist = t >= 1 ? 3 : 0;
        w += dts * (Km * (u - dist) - w) / tm; th += dts * w;
        if (k % 4 === 0) { Y.push([t, S.mode === 'pos' ? th : w]); U.push([t, u]); SP.push([t, r]); }
      }
      let mx = -1e9, ts = 0;
      for (const [t, y] of Y) if (t < 1) { mx = Math.max(mx, y); if (Math.abs(y - r) > 0.02 * r) ts = t; }
      const os = Math.max(0, (mx - r) / r * 100), ss = Math.abs(Y[Y.length - 1][1] - r) / r * 100;
      pY.draw((p) => {
        p.vline(1, { color: 'muted' });
        p.text(1.02, S.mode === 'pos' ? 4.6 : 84, 'load applied', { color: 'muted', size: 11 });
        p.area(() => r * 1.02, 0, Tend, { color: 'c3', alpha: 0.12 }, () => r * 0.98);
        p.line(SP, { color: 'c2', dash: [6, 4], label: 'setpoint' });
        p.line(Y, { color: 'c1', label: S.mode === 'pos' ? 'angle' : 'speed' });
      });
      pU.draw((p) => {
        p.hline(12, { color: 'c4' }); p.hline(-12, { color: 'c4' });
        p.line(U, { color: 'c5', width: 1.6, label: 'controller output u' });
      });
      rOS.set(os); rTS.set(ts); rSS.set(ss);
      const okOS = os < 5, okTS = ts < 0.25, okSS = ss < 2;
      rOS.setClass(okOS ? 'good' : 'bad'); rTS.setClass(okTS ? 'good' : 'bad'); rSS.setClass(okSS ? 'good' : 'bad');
      if (S.mode === 'speed') {
        note.textContent = okOS && okTS && okSS ? '✓ Speed-loop goal met: < 5 % overshoot, settled by 0.25 s, no steady-state error.' : 'Speed-loop goal: overshoot < 5 %, settling < 250 ms, error at end < 2 %.';
        if (okOS && okTS && okSS) Book.solve('pid-task');
      } else note.textContent = 'Position loop: step to π rad (half a turn). P alone rings; D damps it. A load needs I to remove the final error.';
    }
    build(); run();
  })();

  /* =====================================================================
   * Figure 8.15 — self-balancing robot
   * ===================================================================== */
  (function balanceFig() {
    const c = W.canvas('#w-bal', { height: 300 });
    const ctl = ctlOf('#w-bal-ctl');
    const g = 9.81, l = 0.3, amax = 12;
    const S = { kp: 5, ki: 0, kd: 0.5, kv: 0, gusts: false };
    let st, R = rng(3), fell = false, upTime = 0, tc = 0, I = 0, ac = 0, a = 0, gust = 0, gustShow = 0;
    function reset() { st = { th: 5 * D2R, w: 0, x: 0, v: 0 }; fell = false; upTime = 0; tc = 0; I = 0; ac = 0; a = 0; gust = 0; }
    reset();
    W.slider(ctl, { label: '\\(K_p\\)', min: 0, max: 80, step: 0.5, value: S.kp, format: (v) => v.toFixed(1), onInput: (v) => { S.kp = v; } });
    W.slider(ctl, { label: '\\(K_i\\)', min: 0, max: 20, step: 0.1, value: S.ki, format: (v) => v.toFixed(1), onInput: (v) => { S.ki = v; } });
    W.slider(ctl, { label: '\\(K_d\\)', min: 0, max: 10, step: 0.05, value: S.kd, format: (v) => v.toFixed(2), onInput: (v) => { S.kd = v; } });
    W.slider(ctl, { label: '\\(K_v\\) (speed)', min: 0, max: 3, step: 0.05, value: S.kv, format: (v) => v.toFixed(2), onInput: (v) => { S.kv = v; } });
    W.toggle(ctl, { label: 'gusts', value: false, onChange: (v) => { S.gusts = v; upTime = 0; } });
    W.button(ctl, 'Restart', reset);
    W.button(ctl, 'Push', () => { if (!fell) st.w += 0.7; });
    const rt = W.readout(ctl, { label: 'upright', fmt: (v) => v.toFixed(1) + ' s' });
    const ra = W.readout(ctl, { label: 'tilt', fmt: (v) => v.toFixed(1) + '°' });
    const note = W.$('#w-bal-note');
    function step(dt) {
      if (fell) return;
      const h = 0.001, n = Math.round(dt / h);
      for (let i = 0; i < n; i++) {
        if (tc <= 0) {
          tc += 0.005;
          const thm = st.th + gauss(R) * 0.003, wm = st.w + gauss(R) * 0.02;
          I = clamp(I + thm * 0.005, -2, 2);
          ac = clamp(S.kp * thm + S.ki * I + S.kd * wm + S.kv * st.v, -amax, amax);
        }
        tc -= h;
        a += (ac - a) * h / 0.02;
        if (S.gusts) { if (R() < h * 0.8) { gust = (R() - 0.5) * 6; gustShow = 0.4; } gust *= Math.exp(-h / 0.3); } else gust = 0;
        const thdd = (g * Math.sin(st.th) - a * Math.cos(st.th) + gust) / l;
        st.w += thdd * h; st.th += st.w * h; st.v += a * h; st.x += st.v * h;
        if (Math.abs(st.th) > Math.PI / 4) { fell = true; break; }
        upTime += h;
      }
      gustShow = Math.max(0, gustShow - dt);
      if (!fell && S.gusts && upTime >= 10) Book.solve('bal-task');
    }
    function draw() {
      clear(c);
      const x = c.ctx, scale = Math.min(320, c.h * 0.9) / 0.55, gy = c.h - 40, cx = c.w / 2;
      // ground with scrolling ticks
      x.save(); x.strokeStyle = col('muted'); x.lineWidth = 2; x.beginPath(); x.moveTo(0, gy); x.lineTo(c.w, gy); x.stroke();
      x.lineWidth = 1; const sp = 0.1 * scale, off = ((st.x * scale) % sp + sp) % sp;
      for (let X = -off; X < c.w; X += sp) { x.beginPath(); x.moveTo(X, gy); x.lineTo(X - 8, gy + 10); x.stroke(); }
      x.restore();
      const wr = 0.05 * scale, wx = cx, wy = gy - wr;
      // body
      const th = st.th, bl = 0.42 * scale, bw = 0.09 * scale;
      x.save(); x.translate(wx, wy); x.rotate(th);
      x.fillStyle = fell ? col('c4') : col('c5'); x.globalAlpha = 0.85; x.beginPath(); x.roundRect(-bw / 2, -bl, bw, bl, 6); x.fill();
      x.globalAlpha = 1; x.fillStyle = col('c2'); x.fillRect(-bw / 2 + 3, -bl * 0.55, bw - 6, bl * 0.18);
      x.fillStyle = col('surface'); x.beginPath(); x.arc(0, -l * scale, 6, 0, TAU); x.fill(); x.strokeStyle = col('ink'); x.lineWidth = 2; x.stroke();
      x.restore();
      // wheel
      x.save(); x.fillStyle = col('ink'); x.beginPath(); x.arc(wx, wy, wr, 0, TAU); x.fill();
      x.strokeStyle = col('surface'); x.lineWidth = 2; const ang = st.x / 0.05;
      x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx + Math.cos(ang) * wr * 0.8, wy + Math.sin(ang) * wr * 0.8); x.stroke(); x.restore();
      // vertical reference
      x.save(); x.strokeStyle = col('muted'); x.setLineDash([4, 4]); x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx, wy - bl * 1.1); x.stroke(); x.restore();
      // accel arrow
      if (!fell && Math.abs(a) > 0.3) arrow(x, wx, gy + 22, wx + clamp(a, -12, 12) * 6, gy + 22, col('c3'), 3, 9);
      if (gustShow > 0) text(x, '💨 gust', wx - 70, wy - bl * 0.8, { size: 13 });
      text(x, `x = ${st.x.toFixed(2)} m`, 12, 16, { align: 'left', size: 12, color: col('muted') });
      if (fell) text(x, 'Fell over: adjust the gains and press Restart', cx, 40, { bold: true, color: col('c4'), size: 14 });
    }
    let acc = 0;
    W.anim((dt) => {
      step(dt); draw(); acc += dt;
      if (acc > 0.1) {
        acc = 0; rt.set(upTime); ra.set(st.th / D2R);
        rt.setClass(fell ? 'bad' : upTime >= 10 ? 'good' : '');
        note.textContent = fell ? (S.kp < g ? `Kp = ${S.kp.toFixed(1)} is below g = 9.81: the wheels can never catch the fall.` : (S.kd < 0.3 ? 'Kp is above g, but with almost no damping it oscillates until it saturates. Add Kd.' : 'It fell. Check the tilt-rate damping and try again.'))
          : (S.gusts ? (upTime >= 10 ? '✓ Ten seconds in the gusts.' : 'Gusts on: survive 10 s.') : 'Balancing. Turn on gusts for the challenge.');
      }
    }, c.canvas);
    draw();
  })();

  /* =====================================================================
   * Figure 8.16 — differential drive
   * ===================================================================== */
  (function diffFig() {
    const c = W.canvas('#w-diff', { height: 300 });
    const ctl = ctlOf('#w-diff-ctl');
    const b = 0.15, S = { vl: 0.2, vr: 0.3 };
    let pose = { x: 0, y: -0.3, h: 0 }, trail = [];
    W.slider(ctl, { label: '\\(v_L\\)', min: -0.3, max: 0.3, step: 0.01, value: S.vl, format: (v) => v.toFixed(2) + ' m/s', onInput: (v) => { S.vl = v; } });
    W.slider(ctl, { label: '\\(v_R\\)', min: -0.3, max: 0.3, step: 0.01, value: S.vr, format: (v) => v.toFixed(2) + ' m/s', onInput: (v) => { S.vr = v; } });
    W.button(ctl, 'Reset', () => { pose = { x: 0, y: -0.3, h: 0 }; trail = []; });
    const rv = W.readout(ctl, { label: '\\(v\\)', fmt: (v) => v.toFixed(3) + ' m/s' });
    const rw = W.readout(ctl, { label: '\\(\\omega\\)', fmt: (v) => v.toFixed(3) + ' rad/s' });
    const rR = W.readout(ctl, { label: '\\(R\\)', fmt: (v) => (isFinite(v) ? v.toFixed(3) + ' m' : '∞ (straight)') });
    const kin = () => { const v = (S.vr + S.vl) / 2, w = (S.vr - S.vl) / b; return { v, w, R: Math.abs(w) < 1e-9 ? Infinity : v / w }; };
    function step(dt) {
      const k = kin();
      pose.x += k.v * Math.cos(pose.h) * dt; pose.y += k.v * Math.sin(pose.h) * dt; pose.h += k.w * dt;
      const lim = 1.2;
      if (Math.abs(pose.x) > lim || Math.abs(pose.y) > 0.75) { pose.x = 0; pose.y = 0; trail = []; }
      trail.push([pose.x, pose.y]); if (trail.length > 900) trail.shift();
    }
    function draw() {
      clear(c);
      const x = c.ctx, s = Math.min(c.w / 2.6, c.h / 1.7), ox = c.w / 2, oy = c.h / 2;
      const P = (px, py) => [ox + px * s, oy - py * s];
      x.save(); x.strokeStyle = col('line'); x.lineWidth = 1;
      for (let gx = -1.2; gx <= 1.21; gx += 0.2) { const [X] = P(gx, 0); x.beginPath(); x.moveTo(X, 0); x.lineTo(X, c.h); x.stroke(); }
      for (let gy = -0.8; gy <= 0.81; gy += 0.2) { const [, Y] = P(0, gy); x.beginPath(); x.moveTo(0, Y); x.lineTo(c.w, Y); x.stroke(); }
      x.restore();
      x.save(); x.strokeStyle = col('c2'); x.lineWidth = 2; x.beginPath(); trail.forEach(([px, py], i) => { const [X, Y] = P(px, py); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); x.restore();
      const k = kin();
      if (isFinite(k.R) && Math.abs(k.R) < 3) {
        const icx = pose.x - k.R * Math.sin(pose.h), icy = pose.y + k.R * Math.cos(pose.h);
        const [X, Y] = P(icx, icy);
        x.save(); x.strokeStyle = col('muted'); x.setLineDash([5, 5]); x.beginPath(); x.arc(X, Y, Math.abs(k.R) * s, 0, TAU); x.stroke();
        x.fillStyle = col('muted'); x.beginPath(); x.arc(X, Y, 3, 0, TAU); x.fill(); x.restore();
      }
      const [X, Y] = P(pose.x, pose.y);
      x.save(); x.translate(X, Y); x.rotate(-pose.h);
      const L = 0.2 * s, Wd = b * s;
      x.fillStyle = col('c5'); x.globalAlpha = 0.85; x.beginPath(); x.roundRect(-L * 0.45, -Wd / 2, L * 0.9, Wd, 5); x.fill(); x.globalAlpha = 1;
      x.fillStyle = col('ink'); x.fillRect(-L * 0.2, -Wd / 2 - 5, L * 0.4, 6); x.fillRect(-L * 0.2, Wd / 2 - 1, L * 0.4, 6);
      x.fillStyle = col('c2'); x.beginPath(); x.moveTo(L * 0.45, 0); x.lineTo(L * 0.2, -6); x.lineTo(L * 0.2, 6); x.closePath(); x.fill();
      x.restore();
      text(x, 'grid: 20 cm', 10, c.h - 10, { align: 'left', size: 11, color: col('muted') });
    }
    let acc = 0;
    W.anim((dt) => { step(dt); draw(); acc += dt; if (acc > 0.1) { acc = 0; const k = kin(); rv.set(k.v); rw.set(k.w); rR.set(k.R); } }, c.canvas);
    draw();
  })();

  redrawOnTheme(() => {});
})();
