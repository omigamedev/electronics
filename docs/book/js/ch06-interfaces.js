/* Chapter 6 widgets: digital interfaces */
(function () {
  'use strict';
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';
  const col = (c) => W.col(c);
  const onTheme = (fn) => document.addEventListener('themechange', fn);

  /** Canvas whose draw(c) is re-run on resize and theme change. */
  function cv(sel, height, draw) {
    const o = { height };
    const c = W.canvas(sel, o);
    o.onResize = () => draw(c);
    onTheme(() => draw(c));
    return c;
  }
  function clear(c) { const x = c.ctx; x.setLineDash([]); x.globalAlpha = 1; x.fillStyle = col('surface'); x.fillRect(0, 0, c.w, c.h); }
  function txt(x, s, px, py, o = {}) {
    x.save(); x.font = (o.bold ? '600 ' : '') + (o.size || 12) + 'px ' + (o.mono ? MONO : FONT);
    x.fillStyle = col(o.color || 'ink'); x.textAlign = o.align || 'left'; x.textBaseline = o.base || 'middle';
    x.fillText(s, px, py); x.restore();
  }
  /** Sample level(t) (0..1, may be fractional) over [t0,t1] and draw it between yLo (0) and yHi (1). */
  function wave(x, level, t0, t1, X, yLo, yHi, o = {}) {
    const n = o.n || 600;
    x.save(); x.strokeStyle = col(o.color || 'c1'); x.lineWidth = o.width || 2; x.lineJoin = 'round'; x.setLineDash(o.dash || []);
    x.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, v = level(t);
      const px = X(t), py = yLo + (yHi - yLo) * v;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke(); x.restore();
  }
  function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  /** Highlight a schematic part. Works around sch.set(id,{stroke}) not reaching child elements (CSS on children wins). */
  function hl(sch, id, c) {
    const r = sch.parts[id]; if (!r) return;
    const v = c ? 'var(--' + c + ')' : '';
    r.g.querySelectorAll('line, polyline, path, circle, polygon, rect').forEach((e) => {
      if (e.classList.contains('hit') || e.classList.contains('icbox') || e.classList.contains('glow')) return;
      e.style.stroke = v; if (e.classList.contains('fill')) e.style.fill = v;
    });
  }
  const hex2 = (v) => '0x' + v.toString(16).toUpperCase().padStart(2, '0');
  const parseHex = (s, max, def) => { const v = parseInt(String(s).replace(/^0x/i, ''), 16); return isFinite(v) && v >= 0 && v <= max ? v : def; };
  function hexInput(parent, label, value, onInput) {
    const inp = W.h('input', { class: 'ch6-in', type: 'text', value, spellcheck: 'false', autocomplete: 'off' });
    inp.addEventListener('input', () => onInput(inp.value));
    W.$(parent).append(W.h('label', { class: 'ch6-lbl' }, W.h('span', { html: label }), inp));
    return inp;
  }

  /* =====================================================================
   * Figure 6.1 — logic levels & noise margins
   * ===================================================================== */
  (function () {
    const FAM = {
      ttl: { n: '5 V TTL (74LS)', vcc: 5, vol: 0.4, voh: 2.4, vil: 0.8, vih: 2.0 },
      hc: { n: '5 V CMOS (74HC)', vcc: 5, vol: 0.33, voh: 4.4, vil: 1.5, vih: 3.5 },
      hct: { n: '74HCT @ 5 V', vcc: 5, vol: 0.33, voh: 4.4, vil: 0.8, vih: 2.0 },
      avr: { n: 'ATmega328P @ 5 V', vcc: 5, vol: 0.9, voh: 4.2, vil: 1.5, vih: 3.0 },
      esp: { n: 'ESP32 (3.3 V)', vcc: 3.3, vol: 0.33, voh: 2.64, vil: 0.825, vih: 2.475 },
      v18: { n: '1.8 V LVCMOS', vcc: 1.8, vol: 0.45, voh: 1.35, vil: 0.63, vih: 1.17 },
    };
    const opts = Object.keys(FAM).map((k) => [k, FAM[k].n]);
    let drv = 'esp', rcv = 'avr', noise = 0.3, phase = 0;
    const ctl = W.controls('#w-levels');
    W.select(ctl, { label: 'Driver', options: opts, value: drv, onChange: (v) => { drv = v; upd(); } });
    W.select(ctl, { label: 'Receiver', options: opts, value: rcv, onChange: (v) => { rcv = v; upd(); } });
    W.slider(ctl, { label: 'Noise amplitude', min: 0, max: 1.5, step: 0.05, value: noise, unit: 'V', format: (v) => v.toFixed(2) + ' V', onInput: (v) => { noise = v; } });
    const rH = W.readout(ctl, { label: '\\(NM_H\\)', unit: 'V' });
    const rL = W.readout(ctl, { label: '\\(NM_L\\)', unit: 'V' });
    const rE = W.readout(ctl, { label: 'Misread samples' });
    // deterministic pseudo-noise
    const nz = (t) => 0.55 * Math.sin(2.1 * t) + 0.3 * Math.sin(5.3 * t + 1.3) + 0.25 * Math.sin(13.7 * t + 0.4) + 0.2 * Math.sin(29.1 * t + 2.2);
    function upd() {
      const d = FAM[drv], r = FAM[rcv];
      const nh = d.voh - r.vih, nl = r.vil - d.vol;
      rH.set(W.fix(nh, 2) + ' V'); rH.setClass(nh > 0 ? 'good' : 'bad');
      rL.set(W.fix(nl, 2) + ' V'); rL.setClass(nl > 0 ? 'good' : 'bad');
      if (drv === 'esp' && r.vcc === 5 && nh > 0 && nl > 0) Book.solve('lv-task');
    }
    const c = cv('#w-levels', 300, () => draw());
    c.wrap.parentNode.insertBefore(c.wrap, ctl);
    function draw() {
      const x = c.ctx, d = FAM[drv], r = FAM[rcv];
      clear(c);
      const vmax = Math.max(d.vcc, r.vcc) + 0.5, top = 18, bot = c.h - 28;
      const Y = (v) => bot - (bot - top) * v / vmax;
      const bw = Math.max(34, Math.min(70, c.w * 0.11));
      const ax = 38, dx = ax + 14, rx = dx + bw + 40, tx0 = rx + bw + 26, tx1 = c.w - 10;
      // axis
      x.strokeStyle = col('muted'); x.lineWidth = 1; x.beginPath(); x.moveTo(ax, top); x.lineTo(ax, bot); x.stroke();
      for (let v = 0; v <= vmax; v += 1) { x.beginPath(); x.moveTo(ax - 4, Y(v)); x.lineTo(ax, Y(v)); x.stroke(); txt(x, v + ' V', ax - 6, Y(v), { align: 'right', size: 11, color: 'muted' }); }
      // driver bar
      const box = (x0, v0, v1, c1, a) => { x.save(); x.globalAlpha = a; x.fillStyle = col(c1); x.fillRect(x0, Y(v1), bw, Y(v0) - Y(v1)); x.restore(); };
      box(dx, 0, d.vol, 'c3', 0.55); box(dx, d.voh, d.vcc, 'c3', 0.55); box(dx, d.vol, d.voh, 'muted', 0.12);
      txt(x, 'driver', dx + bw / 2, bot + 14, { align: 'center', size: 11, color: 'muted' });
      txt(x, 'VOH', dx + bw / 2, Y(d.voh) + 9, { align: 'center', size: 10 });
      txt(x, 'VOL', dx + bw / 2, Y(d.vol) - 9, { align: 'center', size: 10 });
      // receiver bar
      box(rx, 0, r.vil, 'c1', 0.45); box(rx, r.vih, vmax - 0.2, 'c1', 0.45); box(rx, r.vil, r.vih, 'c4', 0.45);
      txt(x, 'receiver', rx + bw / 2, bot + 14, { align: 'center', size: 11, color: 'muted' });
      txt(x, 'reads 1', rx + bw / 2, (Y(r.vih) + Y(vmax - 0.2)) / 2, { align: 'center', size: 10 });
      txt(x, 'reads 0', rx + bw / 2, (Y(0) + Y(r.vil)) / 2, { align: 'center', size: 10 });
      txt(x, '?', rx + bw / 2, (Y(r.vil) + Y(r.vih)) / 2, { align: 'center', size: 12, bold: true });
      // margins
      const mx = dx + bw + 20;
      const arrow = (v0, v1, lab) => {
        const ok = v1 > v0 === (lab === 'H');
        x.strokeStyle = col(ok ? 'good' : 'bad'); x.lineWidth = 2;
        x.setLineDash([3, 3]); x.beginPath(); x.moveTo(dx + bw, Y(v0)); x.lineTo(rx, Y(v0)); x.moveTo(dx + bw, Y(v1)); x.lineTo(rx, Y(v1)); x.stroke(); x.setLineDash([]);
        x.lineWidth = 3; x.beginPath(); x.moveTo(mx, Y(v0)); x.lineTo(mx, Y(v1)); x.stroke();
        txt(x, 'NM' + lab, mx, (Y(v0) + Y(v1)) / 2, { align: 'center', size: 10, bold: true, color: ok ? 'good' : 'bad' });
      };
      arrow(d.voh, r.vih, 'H'); arrow(r.vil, d.vol, 'L');
      // noisy trace
      if (tx1 - tx0 > 50) {
        x.save(); x.globalAlpha = 0.18; x.fillStyle = col('c4'); x.fillRect(tx0, Y(r.vih), tx1 - tx0, Y(r.vil) - Y(r.vih)); x.restore();
        x.strokeStyle = col('line'); x.lineWidth = 1; x.strokeRect(tx0 + 0.5, top + 0.5, tx1 - tx0, bot - top);
        txt(x, 'worst-case output + noise', (tx0 + tx1) / 2, bot + 14, { align: 'center', size: 11, color: 'muted' });
        const n = Math.round(tx1 - tx0);
        let bad = 0;
        for (let i = 0; i < n; i++) {
          const t = phase + i * 0.06;
          const bit = Math.floor(t / 6) % 2 === 0;
          const v = (bit ? d.voh : d.vol) + noise * nz(t) * 1.3;
          const read = v >= r.vih ? 1 : v <= r.vil ? 0 : -1;
          const ok = read === (bit ? 1 : 0);
          if (!ok) bad++;
          x.fillStyle = col(ok ? 'c3' : read === -1 ? 'c2' : 'c4');
          x.fillRect(tx0 + i, W.clamp(Y(v), top, bot) - 1.5, 1.6, 3);
        }
        rE.set(Math.round(100 * bad / n) + ' %'); rE.setClass(bad ? 'bad' : 'good');
      }
    }
    upd();
    W.anim((dt) => { phase += dt * 1.5; draw(); }, c.canvas);
  })();

  /* =====================================================================
   * Figure 6.2 — CMOS input with clamp diodes
   * ===================================================================== */
  (function () {
    const sch = W.schematic('#w-cmos', {
      w: 440, h: 250, title: 'CMOS input inverter with ESD clamp diodes',
      items: [
        { t: 'text', at: [22, 130], text: 'PIN', anchor: 'middle' },
        { t: 'wire', pts: [[40, 130], [150, 130]] },
        { t: 'dot', at: [90, 130] },
        { t: 'D', id: 'dup', a: [90, 112], b: [90, 62], label: 'clamp', side: -1 },
        { t: 'wire', pts: [[90, 130], [90, 112]] }, { t: 'wire', pts: [[90, 62], [90, 40]] }, { t: 'vcc', at: [90, 40], label: 'VDD 3.3 V' },
        { t: 'D', id: 'ddn', a: [90, 200], b: [90, 150], label: 'clamp', side: -1 },
        { t: 'wire', pts: [[90, 150], [90, 130]] }, { t: 'wire', pts: [[90, 200], [90, 215]] }, { t: 'gnd', at: [90, 215] },
        { t: 'pmos', id: 'p', at: [200, 85], label: 'P' },
        { t: 'nmos', id: 'n', at: [200, 175], label: 'N' },
        { t: 'wire', pts: [[150, 85], [150, 175]] }, { t: 'dot', at: [150, 130] },
        { t: 'wire', pts: [[150, 85], 'p.G'] }, { t: 'wire', pts: [[150, 175], 'n.G'] },
        { t: 'vcc', at: [215, 55], label: ' ' },
        { t: 'wire', pts: ['p.D', 'n.D'] }, { t: 'gnd', at: [215, 205] },
        { t: 'dot', at: [215, 130] }, { t: 'wire', pts: [[215, 130], [300, 130]] },
        { t: 'text', at: [305, 130], text: '→ to logic', anchor: 'start' },
        { t: 'tag', id: 'out', at: [350, 70], text: 'reads 1' },
        { t: 'tag', id: 'ist', at: [350, 190], text: 'I = 0' },
      ],
    });
    const fShoot = sch.flow([[215, 55], [215, 205]], { speed: 0 });
    const fUp = sch.flow([[40, 130], [90, 130], [90, 40]], { speed: 0, color: 'c4' });
    const fDn = sch.flow([[90, 215], [90, 130], [40, 130]], { speed: 0, color: 'c4' });
    const ctl = W.$('#c-cmos');
    const rS = W.readout(ctl, { label: 'Shoot-through', unit: 'A' });
    const rC = W.readout(ctl, { label: 'Clamp current (1 kΩ source)', unit: 'A' });
    const VDD = 3.3, VT = 0.7, K = 220e-6;
    function upd(v) {
      const iN = v > VT ? K * (v - VT) ** 2 : 0, iP = VDD - v > VT ? K * (VDD - v - VT) ** 2 : 0;
      const ist = Math.min(iN, iP);
      const ic = v > VDD + 0.6 ? (v - VDD - 0.6) / 1000 : v < -0.6 ? (v + 0.6) / 1000 : 0;
      hl(sch, 'p', iP > 1e-6 ? 'c3' : ''); hl(sch, 'n', iN > 1e-6 ? 'c3' : '');
      const reads = v < 0.25 * VDD ? '1' : v > 0.75 * VDD ? '0' : (v < VDD / 2 ? '1?' : '0?');
      sch.set('out', { text: 'output ' + (reads.length > 1 ? 'undefined' : reads) });
      sch.set('ist', { text: 'I(VDD→GND) = ' + W.si(ist, 'A', 2) });
      fShoot.set(ist > 1e-6 ? Math.min(3, 0.3 + ist / 60e-6) : 0);
      fUp.set(ic > 0 ? Math.min(3, 0.4 + ic * 1000) : 0);
      fDn.set(ic < 0 ? Math.min(3, 0.4 - ic * 1000) : 0);
      rS.set(ist); rS.setClass(ist > 20e-6 ? 'bad' : 'good');
      rC.set(Math.abs(ic)); rC.setClass(ic ? 'bad' : 'good');
    }
    W.slider(ctl, { label: 'Pin voltage', min: -1.5, max: 5.5, step: 0.05, value: 0.2, unit: 'V', format: (v) => v.toFixed(2) + ' V', onInput: upd });
    upd(0.2);
  })();

  /* =====================================================================
   * Figure 6.3 — floating input
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-float');
    let pull = 'none', hand = false;
    W.segmented(ctl, { options: [['none', 'Floating'], ['up', 'Pull-up'], ['down', 'Pull-down']], value: pull, onChange: (v) => { pull = v; edges.length = 0; } });
    W.toggle(ctl, { label: 'Hand nearby (mains hum)', value: hand, onChange: (v) => { hand = v; edges.length = 0; } });
    const rE = W.readout(ctl, { label: 'Phantom edges' });
    const DT = 0.0005, N = 400; // 2 kHz sample, 0.2 s window
    const buf = new Float32Array(N), dig = new Uint8Array(N);
    let simT = 0, ou = 0, state = 1, head = 0, acc = 0;
    const edges = [];
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    for (let i = 0; i < N; i++) { buf[i] = 1.6; dig[i] = 1; }
    function step() {
      simT += DT;
      ou += -ou * 5 * DT + 2.5 * Math.sqrt(DT) * gauss();
      const hum = Math.sin(2 * Math.PI * 50 * simT);
      let v;
      if (pull === 'none') v = 1.6 + ou + (hand ? 2.6 : 0.35) * hum + 0.05 * gauss();
      else v = (pull === 'up' ? 3.3 : 0) + (hand ? 0.04 : 0.006) * hum + 0.006 * gauss();
      v = W.clamp(v, -0.4, 3.7); // clamp diodes
      const prev = state;
      if (state && v < 1.3) state = 0; else if (!state && v > 2.0) state = 1;
      if (state !== prev) edges.push(simT);
      buf[head] = v; dig[head] = state; head = (head + 1) % N;
    }
    const c = cv('#w-float', 240, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const l = 44, r = c.w - 10, aTop = 14, aBot = 140, dTop = 168, dBot = 214;
      const X = (i) => l + (r - l) * i / (N - 1), Ya = (v) => aBot - (aBot - aTop) * (v + 0.4) / 4.1;
      x.strokeStyle = col('line'); x.lineWidth = 1;
      x.strokeRect(l + 0.5, aTop + 0.5, r - l, aBot - aTop); x.strokeRect(l + 0.5, dTop - 6.5, r - l, dBot - dTop + 12);
      for (const [v, lab] of [[0, '0 V'], [3.3, '3.3 V']]) txt(x, lab, l - 6, Ya(v), { align: 'right', size: 11, color: 'muted' });
      x.save(); x.setLineDash([5, 4]); x.strokeStyle = col('c4');
      for (const v of [1.3, 2.0]) { x.beginPath(); x.moveTo(l, Ya(v)); x.lineTo(r, Ya(v)); x.stroke(); }
      x.restore();
      txt(x, 'thresholds', r - 4, Ya(2.0) - 8, { align: 'right', size: 10, color: 'c4' });
      x.strokeStyle = col('c1'); x.lineWidth = 1.6; x.beginPath();
      for (let i = 0; i < N; i++) { const v = buf[(head + i) % N]; i ? x.lineTo(X(i), Ya(v)) : x.moveTo(X(i), Ya(v)); }
      x.stroke();
      x.strokeStyle = col('c2'); x.lineWidth = 2; x.beginPath();
      for (let i = 0; i < N; i++) { const y = dig[(head + i) % N] ? dTop : dBot; i ? x.lineTo(X(i), y) : x.moveTo(X(i), y); }
      x.stroke();
      txt(x, 'pin V', 4, (aTop + aBot) / 2, { size: 11, color: 'muted' });
      txt(x, 'read', 4, (dTop + dBot) / 2, { size: 11, color: 'muted' });
      txt(x, '1', l - 6, dTop, { align: 'right', size: 11, color: 'muted' }); txt(x, '0', l - 6, dBot, { align: 'right', size: 11, color: 'muted' });
      txt(x, '0.2 s window', r - 4, c.h - 8, { align: 'right', size: 10, color: 'muted' });
    }
    W.anim((dt) => {
      acc += dt * 0.1; // 10x slow motion
      while (acc > DT) { step(); acc -= DT; }
      while (edges.length && edges[0] < simT - 1) edges.shift();
      rE.set(edges.length + ' per s'); rE.setClass(edges.length ? 'bad' : 'good');
      draw();
    }, c.canvas);
  })();

  /* =====================================================================
   * Figure 6.4 — button with pull-up
   * ===================================================================== */
  (function () {
    const CW = 50e-12;
    const sch = W.schematic('#w-pullup', {
      w: 420, h: 240, title: 'Push button with pull-up resistor to a GPIO',
      items: [
        { t: 'vcc', at: [120, 40], label: '3.3 V' },
        { t: 'R', id: 'r', a: [120, 40], b: [120, 105], label: '10 kΩ' },
        { t: 'wire', id: 'rw', pts: [[120, 105], [120, 125]] },
        { t: 'dot', at: [120, 125] },
        { t: 'wire', pts: [[120, 125], [200, 125], [262, 125]] },
        { t: 'ic', id: 'mcu', at: [320, 125], name: 'MCU', left: ['GPIO4'] },
        { t: 'PB', id: 'pb', a: [120, 150], b: [120, 195], label: 'press & hold', side: -1 },
        { t: 'wire', pts: [[120, 125], [120, 150]] }, { t: 'wire', pts: [[120, 195], [120, 210]] }, { t: 'gnd', at: [120, 210] },
        { t: 'dot', at: [200, 125] },
        { t: 'C', id: 'c', a: [200, 145], b: [200, 185], label: '50 pF (pin + wire)' },
        { t: 'wire', pts: [[200, 125], [200, 145]] }, { t: 'wire', pts: [[200, 185], [200, 200]] }, { t: 'gnd', at: [200, 200] },
        { t: 'tag', id: 'tag', at: [320, 200], text: 'reads 1' },
      ],
    });
    const flow = sch.flow([[120, 40], [120, 210]], { speed: 0 });
    const ctl = W.$('#c-pullup');
    let R = 10000, fitted = true, pressed = false, flick = 0;
    const rI = W.readout(ctl, { label: 'Current when pressed', unit: 'A' });
    const rT = W.readout(ctl, { label: 'Release → reads 1 after', unit: 's' });
    W.slider(ctl, { label: 'Pull-up \\(R\\)', min: 1000, max: 100000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.toggle(ctl, { label: 'Pull-up fitted', value: true, onChange: (v) => { fitted = v; upd(); } });
    sch.parts.pb.it.onToggle = (v) => { pressed = v; upd(); };
    const p = W.plot('#w-pullup', { xmin: 0, xmax: 25e-6, ymin: 0, ymax: 3.6, height: 170, xlabel: 'time after release (s)', ylabel: 'pin (V)', xunit: 's', yunit: 'V', hover: true });
    p.draw((p) => {
      p.hline(0.75 * 3.3, { color: 'c4' }); p.text(24e-6, 0.75 * 3.3 + 0.25, 'VIH (ESP32)', { color: 'c4', align: 'right', size: 11 });
      if (fitted) p.fn((t) => 3.3 * (1 - Math.exp(-t / (R * CW))), { color: 'c1', label: 'R = ' + W.si(R, 'Ω', 2) });
    });
    function upd() {
      sch.set('r', { hidden: !fitted, label: fitted ? W.si(R, 'Ω', 2) : '' }); sch.set('rw', { hidden: !fitted });
      const I = pressed && fitted ? 3.3 / R : 0;
      flow.set(I ? Math.min(3, 0.4 + I / 2e-4) : 0);
      let t;
      if (pressed) t = 'reads 0 (0.00 V)';
      else if (!fitted) t = 'floating: reads ' + (flick ? '1?' : '0?');
      else t = 'reads 1 (3.30 V)';
      sch.set('tag', { text: t });
      rI.set(fitted ? 3.3 / R : 0);
      const tr = R * CW * Math.log(4);
      rT.set(fitted ? W.si(tr, 's', 2) : 'never'); rT.setClass(!fitted || tr > 2e-6 ? 'bad' : 'good');
      p.update();
    }
    setInterval(() => { if (!fitted && !pressed) { flick = Math.random() < 0.5 ? 1 : 0; upd(); } }, 400);
    upd();
  })();

  /* =====================================================================
   * Figure 6.5 — push-pull vs open-drain
   * ===================================================================== */
  (function () {
    const sch = W.schematic('#w-pp', {
      w: 460, h: 280, title: 'Push-pull and open-drain output stages',
      items: [
        { t: 'vcc', id: 'pv', at: [215, 50], label: 'VDD' },
        { t: 'pmos', id: 'p', at: [200, 80], label: 'P' },
        { t: 'nmos', id: 'n', at: [200, 170], label: 'N' },
        { t: 'wire', pts: ['p.D', 'n.D'] }, { t: 'gnd', at: [215, 200] },
        { t: 'dot', at: [215, 125] },
        { t: 'wire', pts: [[215, 125], [405, 125], [405, 140]] },
        { t: 'wire', id: 'pgw', pts: [[140, 80], 'p.G'] }, { t: 'wire', pts: [[140, 170], 'n.G'] },
        { t: 'text', id: 'pg', at: [134, 80], text: 'gate', anchor: 'end' },
        { t: 'text', id: 'ng', at: [134, 170], text: 'gate', anchor: 'end' },
        { t: 'vcc', id: 'puv', at: [300, 45], label: ' ' },
        { t: 'R', id: 'pu', a: [300, 45], b: [300, 105], label: '4.7 kΩ pull-up' },
        { t: 'wire', id: 'puw', pts: [[300, 105], [300, 125]] }, { t: 'dot', id: 'pud', at: [300, 125] },
        { t: 'nmos', id: 'o', at: [390, 170], label: '' },
        { t: 'wire', pts: [[350, 170], 'o.G'] }, { t: 'gnd', at: [405, 200] },
        { t: 'text', at: [405, 236], text: 'other device', anchor: 'middle' },
        { t: 'text', at: [330, 140], text: 'line', anchor: 'middle' },
        { t: 'tag', id: 'tag', at: [120, 232], text: '' },
        { t: 'text', id: 'mode', at: [20, 268], text: '', anchor: 'start' },
      ],
    });
    const fPN = sch.flow([[215, 50], [215, 125], [405, 125], [405, 200]], { speed: 0, color: 'c4' });
    const fRN = sch.flow([[300, 45], [300, 125], [215, 125], [215, 200]], { speed: 0 });
    const fRO = sch.flow([[300, 45], [300, 125], [405, 125], [405, 200]], { speed: 0 });
    const ctl = W.$('#c-pp');
    let mode = 'pp', out = 1, other = false;
    W.segmented(ctl, { options: [['pp', 'Push-pull'], ['od', 'Open-drain']], value: mode, onChange: (v) => { mode = v; upd(); } });
    W.segmented(ctl, { options: [[1, 'Write 1'], [0, 'Write 0']], value: out, onChange: (v) => { out = v; upd(); } });
    W.toggle(ctl, { label: 'Another device pulls low', value: false, onChange: (v) => { other = v; upd(); } });
    const rI = W.readout(ctl, { label: 'Supply current', unit: 'A' });
    function upd() {
      const od = mode === 'od';
      const pOn = !od && out === 1, nOn = out === 0;
      for (const id of ['pu', 'puw', 'puv', 'pud']) sch.set(id, { hidden: !od });
      sch.set('pv', { hidden: od, label: od ? ' ' : 'VDD' });
      sch.set('pu', { label: od ? '4.7 kΩ pull-up' : '' });
      sch.set('p', { hidden: od, label: od ? '' : 'P' }); sch.set('pgw', { hidden: od });
      sch.set('pg', { text: od ? '' : (pOn ? 'gate 0 → on' : 'gate 1 → off') });
      sch.set('ng', { text: nOn ? 'gate 1 → on' : 'gate 0 → off' });
      sch.set('mode', { text: od ? 'Open-drain: only the N transistor exists' : 'Push-pull: P drives high, N drives low' });
      let I = 0, line, bad = false;
      fPN.set(0); fRN.set(0); fRO.set(0);
      if (!od) {
        if (pOn && other) { I = 3.3 / 50; line = '≈ 1.6 V: CONTENTION!'; bad = true; fPN.set(3); }
        else line = pOn ? 'HIGH (driven by P)' : 'LOW (driven by N)';
      } else {
        const n = (nOn ? 1 : 0) + (other ? 1 : 0);
        if (n) { I = 3.3 / 4700; line = 'LOW (pulled down)'; if (nOn) fRN.set(other ? 0.6 : 1); if (other) fRO.set(nOn ? 0.6 : 1); }
        else line = 'HIGH (via pull-up)';
      }
      hl(sch, 'p', pOn ? (bad ? 'c4' : 'c3') : '');
      hl(sch, 'n', nOn ? 'c3' : '');
      hl(sch, 'o', other ? (bad ? 'c4' : 'c3') : '');
      sch.set('tag', { text: 'Line: ' + line });
      rI.set(I); rI.setClass(bad ? 'bad' : 'good');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 6.6 — quantisation
   * ===================================================================== */
  (function () {
    let bits = 3; const VREF = 3.3;
    const sig = (t) => VREF * (0.5 + 0.38 * Math.sin(2 * Math.PI * t) + 0.08 * Math.sin(6 * Math.PI * t + 1));
    const q = (v) => { const L = VREF / 2 ** bits; return Math.min(2 ** bits - 1, Math.floor(v / L)) * L; };
    const p1 = W.plot('#w-quant', { xmin: 0, xmax: 1, ymin: 0, ymax: VREF, height: 230, xlabel: 'time (one period)', ylabel: 'voltage (V)', hover: true, yunit: 'V' });
    p1.draw((p) => { p.fn(sig, { color: 'c1', label: 'analog input', width: 1.5 }); p.fn((t) => q(sig(t)), { color: 'c2', label: 'ADC output', samples: 2400 }); });
    const p2 = W.plot('#w-quant', { xmin: 0, xmax: 1, ymin: 0, ymax: 1, height: 130, xlabel: 'time', ylabel: 'error (mV)', yfmt: (v) => W.fix(v * 1000, 1) });
    p2.draw((p) => { p.fn((t) => sig(t) - q(sig(t)), { color: 'c4', samples: 2400, width: 1.5 }); });
    const ctl = W.$('#c-quant');
    const rL = W.readout(ctl, { label: 'LSB', unit: 'V' }), rN = W.readout(ctl, { label: 'Levels' }), rS = W.readout(ctl, { label: 'Ideal SNR' });
    W.slider(ctl, { label: 'Resolution', min: 1, max: 12, step: 1, value: bits, format: (v) => v + ' bits', onInput: (v) => { bits = v; upd(); } });
    function upd() {
      const L = VREF / 2 ** bits;
      rL.set(L); rN.set(String(2 ** bits)); rS.set(W.fix(6.02 * bits + 1.76, 1) + ' dB');
      p2.set({ ymax: L * 1.05 }); p1.update(); p2.update();
    }
    upd();
  })();

  /* =====================================================================
   * Figure 6.7 — aliasing
   * ===================================================================== */
  (function () {
    let f = 120, fs = 1000; const T = 0.04;
    const p = W.plot('#w-alias', { xmin: 0, xmax: T, ymin: -1.3, ymax: 1.3, height: 250, xlabel: 'time (s)', ylabel: 'signal', xunit: 's' });
    const alias = () => { const k = Math.round(f / fs); return f - k * fs; };
    p.draw((p) => {
      p.fn((t) => Math.sin(2 * Math.PI * f * t), { color: 'c1', width: 1, samples: 3000, label: 'real signal', hover: false });
      const fa = alias();
      p.fn((t) => Math.sin(2 * Math.PI * fa * t), { color: 'c4', width: 3, label: 'what the firmware sees', hover: false });
      for (let n = 0; n / fs <= T + 1e-9; n++) p.point(n / fs, Math.sin(2 * Math.PI * f * n / fs), { color: 'c2', r: 3.5 });
    });
    const ctl = W.$('#c-alias');
    const rN = W.readout(ctl, { label: 'Nyquist \\(f_s/2\\)', unit: 'Hz' }), rA = W.readout(ctl, { label: 'Apparent frequency', unit: 'Hz' });
    W.slider(ctl, { label: 'Signal \\(f\\)', min: 5, max: 2100, step: 5, value: f, unit: 'Hz', format: (v) => v + ' Hz', onInput: (v) => { f = v; upd(); } });
    W.segmented(ctl, { options: [[500, '\\(f_s\\) = 500 Hz'], [1000, '1 kHz'], [2000, '2 kHz']], value: fs, onChange: (v) => { fs = v; upd(); } });
    function upd() {
      const fa = Math.abs(alias());
      rN.set(fs / 2); rA.set(fa); rA.setClass(f > fs / 2 ? 'bad' : 'good');
      p.update();
      if (fs === 1000 && f > 900 && fa < 50) Book.solve('alias-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 6.8 — PWM
   * ===================================================================== */
  (function () {
    let D = 0.3, f = 20000, clk = 80e6;
    const p = W.plot('#w-pwm', { xmin: 0, xmax: 3 / f, ymin: -0.3, ymax: 3.8, height: 220, xlabel: 'time (s)', ylabel: 'pin (V)', xunit: 's', yunit: 'V' });
    const bitsOf = () => Math.floor(Math.log2(clk / f));
    const Dq = () => { const n = 2 ** bitsOf(); return Math.round(D * n) / n; };
    p.draw((p) => {
      const T = 1 / f, d = Dq();
      p.fn((t) => ((t % T) / T < d ? 3.3 : 0), { color: 'c1', samples: 1800, hover: false, label: 'PWM output' });
      p.hline(3.3 * d, { color: 'c2', width: 2, dash: [6, 4] });
      p.text(p.o.xmax * 0.99, 3.3 * d + 0.22, 'average ' + W.fix(3.3 * d, 2) + ' V', { align: 'right', color: 'c2' });
    });
    const ctl = W.$('#c-pwm');
    W.slider(ctl, { label: 'Duty \\(D\\)', min: 0, max: 1, step: 0.005, value: D, format: (v) => (v * 100).toFixed(1) + ' %', onInput: (v) => { D = v; upd(); } });
    W.slider(ctl, { label: 'Frequency', min: 50, max: 200000, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    W.segmented(ctl, { options: [[16e6, '16 MHz (AVR)'], [80e6, '80 MHz (ESP32 APB)']], value: clk, onChange: (v) => { clk = v; upd(); } });
    const rT = W.readout(ctl, { label: 'Ticks / period' }), rB = W.readout(ctl, { label: 'Resolution' }), rD = W.readout(ctl, { label: 'Actual duty' });
    function upd() {
      const b = bitsOf();
      rT.set(String(Math.floor(clk / f))); rB.set(b + ' bits (' + 2 ** b + ' steps)'); rB.setClass(b < 8 ? 'bad' : 'good');
      rD.set((Dq() * 100).toFixed(2) + ' %');
      p.set({ xmax: 3 / f }).update();
    }
    upd();
  })();

  /* =====================================================================
   * Figure 6.9 — UART frame
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-uart');
    let ch = 'U', parity = 'none', stops = 1, baud = 115200, cur = 0;
    const inp = W.h('input', { class: 'ch6-in', type: 'text', value: ch, maxlength: 1, style: 'width:3em;text-align:center' });
    inp.addEventListener('input', () => { ch = inp.value || ' '; cur = 0; info(); });
    ctl.append(W.h('label', { class: 'ch6-lbl' }, W.h('span', {}, 'Character'), inp));
    W.segmented(ctl, { options: [['none', 'No parity'], ['even', 'Even'], ['odd', 'Odd']], value: parity, onChange: (v) => { parity = v; cur = 0; info(); } });
    W.segmented(ctl, { options: [[1, '1 stop'], [2, '2 stop']], value: stops, onChange: (v) => { stops = v; cur = 0; info(); } });
    W.select(ctl, { label: 'Baud', options: [[9600, '9600'], [115200, '115200'], [1000000, '1 M']], value: baud, onChange: (v) => { baud = +v; info(); } });
    const out = W.$('#uart-bits');
    function frame() {
      const code = ch.charCodeAt(0) & 0xFF;
      const bits = [{ v: 0, l: 'S', k: 'start' }];
      let ones = 0;
      for (let i = 0; i < 8; i++) { const b = (code >> i) & 1; ones += b; bits.push({ v: b, l: 'D' + i, k: 'data' }); }
      if (parity !== 'none') bits.push({ v: parity === 'even' ? ones % 2 : 1 - (ones % 2), l: 'P', k: 'par' });
      for (let i = 0; i < stops; i++) bits.push({ v: 1, l: 'Sp', k: 'stop' });
      return { code, bits };
    }
    function info() {
      const { code, bits } = frame();
      const tb = 1 / baud;
      out.innerHTML = `'${ch.replace(/[<&]/g, '')}' = ${hex2(code)} = ${code.toString(2).padStart(8, '0')}b → on the wire (LSB first): <b>${bits.map((b) => b.v).join(' ')}</b> · ${bits.length} bits × ${W.si(tb, 's', 3)} = ${W.si(bits.length * tb, 's', 3)}`;
    }
    const c = cv('#w-uart', 190, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const { bits } = frame();
      const nb = bits.length, l = 14, r = c.w - 14, tot = nb + 2;
      const X = (t) => l + (r - l) * t / tot;
      const yH = 40, yL = 100;
      const colOf = { start: 'c4', data: 'c1', par: 'c5', stop: 'c3' };
      bits.forEach((b, i) => {
        x.save(); x.globalAlpha = 0.13; x.fillStyle = col(colOf[b.k]); x.fillRect(X(i + 1), yH - 12, X(i + 2) - X(i + 1), yL - yH + 24); x.restore();
        txt(x, b.l, (X(i + 1) + X(i + 2)) / 2, yL + 26, { align: 'center', size: 11, color: colOf[b.k], bold: true });
        txt(x, String(b.v), (X(i + 1) + X(i + 2)) / 2, yH - 22, { align: 'center', size: 12, mono: true });
      });
      txt(x, 'idle', (X(0) + X(1)) / 2, yL + 26, { align: 'center', size: 11, color: 'muted' });
      txt(x, 'idle', (X(nb + 1) + X(nb + 2)) / 2, yL + 26, { align: 'center', size: 11, color: 'muted' });
      const lev = (t) => { const i = Math.floor(t) - 1; return i < 0 || i >= nb ? 1 : bits[i].v; };
      wave(x, (t) => 1 - lev(t), 0, tot, X, yH, yL, { color: 'c1', width: 2.5, n: 1200 });
      // sampling cursor
      const k = Math.floor(cur) % (nb + 2);
      if (k >= 1 && k <= nb) {
        const sx = X(k + 0.5);
        x.save(); x.strokeStyle = col('c2'); x.setLineDash([4, 3]); x.beginPath(); x.moveTo(sx, yH - 12); x.lineTo(sx, yL + 12); x.stroke(); x.restore();
        x.fillStyle = col('c2'); x.beginPath(); x.arc(sx, lev(k + 0.5) ? yH : yL, 5, 0, 7); x.fill();
      }
      const got = bits.slice(0, Math.max(0, Math.min(nb, k))).map((b) => b.v).join('');
      txt(x, 'receiver sampled: ' + (got || '…'), l, c.h - 16, { size: 12, mono: true, color: 'muted' });
    }
    info();
    W.anim((dt) => { cur += dt * 1.6; draw(); }, c.canvas);
  })();

  /* =====================================================================
   * Figure 6.10 — baud mismatch
   * ===================================================================== */
  (function () {
    let e = 0, code = 0x55;
    const tx = () => { const b = [0]; for (let i = 0; i < 8; i++) b.push((code >> i) & 1); b.push(1); return b.concat(b); };
    const lev = (t) => { // t in receiver bit times since start edge
      const tb = 1 / (1 + e / 100); if (t < 0) return 1;
      const i = Math.floor(t / tb), b = tx(); return i < b.length ? b[i] : 1;
    };
    const p = W.plot('#w-baud', { xmin: -1, xmax: 21, ymin: -0.4, ymax: 1.5, height: 220, xlabel: 'time (receiver bit periods since the start edge)', ylabel: 'TX line', grid: true });
    let res = null;
    function decode() {
      const s = []; for (let k = 0; k < 10; k++) s.push(lev(k + 0.5));
      let v = 0; for (let i = 0; i < 8; i++) v |= s[i + 1] << i;
      return { s, v, start: s[0] === 0, stop: s[9] === 1 };
    }
    p.draw((p) => {
      p.fn((t) => lev(t), { color: 'c1', samples: 2400, hover: false, width: 2.25, label: 'TX (clock ' + (e >= 0 ? '+' : '') + e + ' %)' });
      for (let k = 0; k <= 10; k++) p.vline(k, { color: 'line', dash: [2, 4], width: 1 });
      const d = decode();
      d.s.forEach((v, k) => {
        const exp = k === 0 ? 0 : k === 9 ? 1 : (code >> (k - 1)) & 1;
        p.point(k + 0.5, v, { color: v === exp ? 'good' : 'bad', r: 4.5 });
      });
      p.text(0.5, 1.32, 'S', { align: 'center', size: 11, color: 'muted' });
      p.text(9.5, 1.32, 'Stop', { align: 'center', size: 11, color: 'muted' });
      p.text(4.5, 1.32, 'D0 … D7', { align: 'center', size: 11, color: 'muted' });
      res = d;
    });
    const ctl = W.$('#c-baud');
    W.slider(ctl, { label: 'TX clock error', min: -8, max: 8, step: 0.5, value: 0, format: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' %', onInput: (v) => { e = v; upd(); } });
    W.select(ctl, { label: 'Byte', options: [[0x55, "'U' 0x55"], [0x41, "'A' 0x41"], [0x00, '0x00'], [0xFF, '0xFF']], value: code, onChange: (v) => { code = +v; upd(); } });
    const rR = W.readout(ctl, { label: 'Receiver got' });
    function upd() {
      p.update();
      const ok = res.v === code && res.stop;
      rR.set(res.stop ? hex2(res.v) + (res.v === code ? ' ✓' : ' ✗ wrong byte') : 'framing error'); rR.setClass(ok ? 'good' : 'bad');
      if (!ok && e > 0 && e <= 6) Book.solve('baud-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 6.11 — wired-AND bus
   * ===================================================================== */
  (function () {
    const xs = [170, 270, 370], names = ['MCU', 'IMU', 'baro'];
    const items = [
      { t: 'vcc', at: [70, 40], label: '3.3 V' },
      { t: 'R', id: 'rp', a: [70, 40], b: [70, 100], label: '4.7 kΩ' },
      { t: 'wire', pts: [[70, 100], [420, 100]] },
      { t: 'text', at: [425, 100], text: 'SDA', anchor: 'start' },
      { t: 'tag', id: 'tag', at: [250, 40], text: 'SDA = 1' },
    ];
    xs.forEach((x, i) => {
      items.push({ t: 'dot', at: [x, 100] }, { t: 'wire', pts: [[x, 100], [x, 125]] },
        { t: 'SW', id: 's' + i, a: [x, 125], b: [x, 175], label: names[i], side: -1 },
        { t: 'wire', pts: [[x, 175], [x, 190]] }, { t: 'gnd', at: [x, 190] });
    });
    const sch = W.schematic('#w-wand', { w: 460, h: 225, title: 'Wired-AND bus: three open-drain devices and one pull-up', items });
    const flows = xs.map((x) => sch.flow([[70, 40], [70, 100], [x, 100], [x, 190]], { speed: 0 }));
    const ctl = W.$('#c-wand');
    const rB = W.readout(ctl, { label: 'Bus level' }), rI = W.readout(ctl, { label: 'Pull-up current', unit: 'A' });
    function upd() {
      const on = xs.map((_, i) => sch.parts['s' + i].it.closed);
      const n = on.filter(Boolean).length;
      flows.forEach((f, i) => f.set(on[i] ? 1.6 / n : 0));
      sch.set('tag', { text: n ? 'SDA = 0 (pulled low by ' + on.map((v, i) => (v ? names[i] : null)).filter(Boolean).join(' + ') + ')' : 'SDA = 1 (all released)' });
      rB.set(n ? 'LOW' : 'HIGH'); rI.set(n ? 3.3 / 4700 : 0);
    }
    xs.forEach((_, i) => { sch.parts['s' + i].it.onToggle = upd; });
    upd();
  })();

  /* =====================================================================
   * Figure 6.12 — I2C rise time
   * ===================================================================== */
  (function () {
    const MODES = { sm: { n: 'Standard 100 kHz', tr: 1000e-9, iol: 3e-3, x: 3e-6 }, fm: { n: 'Fast 400 kHz', tr: 300e-9, iol: 3e-3, x: 1.2e-6 }, fmp: { n: 'Fast+ 1 MHz', tr: 120e-9, iol: 20e-3, x: 0.5e-6 } };
    let mode = 'fm', Rp = 4700, Cb = 100e-12; const VDD = 3.3;
    const p = W.plot('#w-rise', { xmin: 0, xmax: MODES.fm.x, ymin: 0, ymax: 3.6, height: 250, xlabel: 'time after release (s)', ylabel: 'SDA (V)', xunit: 's', yunit: 'V', hover: true });
    p.draw((p) => {
      const m = MODES[mode], RC = Rp * Cb, t30 = -RC * Math.log(0.7);
      p.area(() => 3.6, t30, t30 + m.tr, { color: 'c3', alpha: 0.13 }, () => 0);
      p.hline(0.3 * VDD, { color: 'muted' }); p.hline(0.7 * VDD, { color: 'muted' });
      p.text(p.o.xmax * 0.99, 0.3 * VDD - 0.18, '30 %', { align: 'right', color: 'muted', size: 11 });
      p.text(p.o.xmax * 0.99, 0.7 * VDD + 0.18, '70 %', { align: 'right', color: 'muted', size: 11 });
      p.text(t30 + 4e-9, 3.42, 'allowed tr', { color: 'c3', size: 11 });
      p.fn((t) => VDD * (1 - Math.exp(-t / RC)), { color: 'c1', label: 'SDA, Rp = ' + W.si(Rp, 'Ω', 2) + ', Cb = ' + W.si(Cb, 'F', 2) });
    });
    const ctl = W.$('#c-rise');
    W.segmented(ctl, { options: Object.keys(MODES).map((k) => [k, MODES[k].n]), value: mode, onChange: (v) => { mode = v; upd(); } });
    W.slider(ctl, { label: 'Pull-up \\(R_p\\)', min: 150, max: 47000, log: true, value: Rp, unit: 'Ω', onInput: (v) => { Rp = v; upd(); } });
    W.slider(ctl, { label: 'Bus capacitance \\(C_b\\)', min: 10, max: 550, step: 5, value: Cb * 1e12, format: (v) => v + ' pF', onInput: (v) => { Cb = v * 1e-12; upd(); } });
    const rT = W.readout(ctl, { label: '\\(t_r\\)', unit: 's' }), rMin = W.readout(ctl, { label: '\\(R_{p(\\min)}\\)', unit: 'Ω' }), rMax = W.readout(ctl, { label: '\\(R_{p(\\max)}\\)', unit: 'Ω' }), rOk = W.readout(ctl, { label: 'Verdict' });
    function upd() {
      const m = MODES[mode], tr = 0.8473 * Rp * Cb, rmin = (VDD - 0.4) / m.iol, rmax = m.tr / (0.8473 * Cb);
      rT.set(tr); rT.setClass(tr <= m.tr ? 'good' : 'bad');
      rMin.set(rmin); rMax.set(rmax); rMin.setClass(Rp >= rmin ? 'good' : 'bad'); rMax.setClass(Rp <= rmax ? 'good' : 'bad');
      const ok = tr <= m.tr && Rp >= rmin;
      rOk.set(ok ? 'passes' : Rp < rmin ? 'pull-up too strong' : 'edge too slow'); rOk.setClass(ok ? 'good' : 'bad');
      p.set({ xmax: m.x }).update();
      if (ok && mode === 'fm' && Cb >= 189e-12 && Cb <= 211e-12) Book.solve('rise-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 6.13 — I2C transaction animation & decoder
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-i2c');
    let addr = 0x68, rw = 0, data = 0x3B, present = true, prog = 0, playing = true;
    hexInput(ctl, '7-bit address 0x', '68', (v) => { addr = parseHex(v, 0x7F, addr); restart(); });
    W.segmented(ctl, { options: [[0, 'Write'], [1, 'Read']], value: rw, onChange: (v) => { rw = v; restart(); } });
    hexInput(ctl, 'Data byte 0x', '3B', (v) => { data = parseHex(v, 0xFF, data); restart(); });
    W.toggle(ctl, { label: 'Device present', value: true, onChange: (v) => { present = v; restart(); } });
    W.button(ctl, '▶ Play', () => restart());
    const dec = W.$('#i2c-dec');
    function restart() { prog = 0; playing = true; info(); }
    function build() {
      // slots: {sda, who:'c'|'t', lab, grp}
      const s = [];
      const ab = (addr << 1) | rw;
      for (let i = 7; i >= 0; i--) s.push({ v: (ab >> i) & 1, who: 'c', lab: i ? 'A' + (i - 1) : 'R/W' });
      s.push(present ? { v: 0, who: 't', lab: 'ACK' } : { v: 1, who: 'n', lab: 'NACK' });
      if (present) {
        for (let i = 7; i >= 0; i--) s.push({ v: (data >> i) & 1, who: rw ? 't' : 'c', lab: 'D' + i });
        s.push(rw ? { v: 1, who: 'c', lab: 'NACK' } : { v: 0, who: 't', lab: 'ACK' });
      }
      return s;
    }
    function levels(s) {
      const E = 1 + s.length; // slots occupy [1+k, 2+k]
      const scl = (t) => { if (t < 1) return 1; if (t < E) { const f = t - Math.floor(t); return f < 0.5 ? 0 : 1; } if (t < E + 0.3) return 0; return 1; };
      const sda = (t) => {
        if (t < 0.5) return 1; if (t < 1.15) return 0;
        if (t < E + 0.15) { const k = Math.floor(t - 1.15); return s[Math.min(k, s.length - 1)].v; }
        if (t < E + 0.65) return 0; return 1;
      };
      return { scl, sda, E };
    }
    const c = cv('#w-i2c', 280, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const s = build(), { scl, sda, E } = levels(s), tot = E + 1.6;
      const l = 46, r = c.w - 10, X = (t) => l + (r - l) * t / tot, sw = X(1) - X(0);
      const yS1 = 30, yS0 = 64, yD1 = 112, yD0 = 146, yDec = 186;
      txt(x, 'SCL', 6, (yS1 + yS0) / 2, { bold: true, size: 12 }); txt(x, 'SDA', 6, (yD1 + yD0) / 2, { bold: true, size: 12 });
      // who drives SDA
      s.forEach((b, k) => {
        x.save(); x.globalAlpha = 0.16; x.fillStyle = col(b.who === 'c' ? 'c1' : b.who === 't' ? 'c2' : 'muted');
        x.fillRect(X(1 + k) + 1, yD1 - 8, sw - 2, yD0 - yD1 + 16); x.restore();
        if (sw > 15) txt(x, String(b.v), X(1.5 + k), yD1 - 16, { align: 'center', size: 11, mono: true, color: 'muted' });
      });
      const until = Math.min(prog, tot);
      const ghost = (fn, y1, y0) => { wave(x, (t) => 1 - fn(t), 0, tot, X, y1, y0, { color: 'muted', width: 1, n: 1400 }); wave(x, (t) => 1 - fn(t), 0, until, X, y1, y0, { color: 'c1', width: 2.4, n: Math.max(20, Math.round(1400 * until / tot)) }); };
      ghost(scl, yS1, yS0); ghost(sda, yD1, yD0);
      // decoder row
      const segs = [{ a: 0.2, b: 1.2, t: 'S', c: 'c5' }, { a: 1, b: 9, t: 'Addr ' + hex2(addr).slice(2) + (rw ? ' R' : ' W'), c: 'c1' }, { a: 9, b: 10, t: s[8].lab, c: s[8].v ? 'c4' : 'c3' }];
      if (present) segs.push({ a: 10, b: 18, t: (rw ? 'Read ' : 'Write ') + hex2(data).slice(2), c: rw ? 'c2' : 'c1' }, { a: 18, b: 19, t: s[17].lab, c: s[17].v ? 'c4' : 'c3' });
      segs.push({ a: E, b: E + 1, t: 'P', c: 'c5' });
      for (const g of segs) {
        if (prog < g.a) continue;
        const a = X(g.a) + 1, w = X(g.b) - X(g.a) - 2;
        x.save(); x.globalAlpha = 0.85; x.fillStyle = col(g.c); rrect(x, a, yDec - 11, w, 22, 5); x.fill(); x.restore();
        let t = g.t; x.font = '11px ' + FONT; while (t.length > 1 && x.measureText(t).width > w - 4) t = t.slice(0, -1);
        txt(x, t, a + w / 2, yDec, { align: 'center', size: 11, color: '#fff', bold: true });
      }
      if (c.w > 500) txt(x, 'decoded', 6, yDec, { size: 11, color: 'muted' });
      // legend
      [['c1', 'controller drives SDA'], ['c2', 'target drives SDA'], ['muted', 'nobody (pull-up)']].forEach(([cc, t], i) => {
        const narrow = (r - l) / 3 < 150, lx = narrow ? l : l + i * Math.min(170, (r - l) / 3), ly = narrow ? c.h - 54 + i * 17 : c.h - 18;
        x.save(); x.globalAlpha = 0.35; x.fillStyle = col(cc); x.fillRect(lx, ly - 6, 14, 12); x.restore();
        txt(x, t, lx + 19, ly, { size: 11, color: 'muted' });
      });
      if (sw > 26) s.forEach((b, k) => txt(x, b.lab, X(1.5 + k), yD0 + 18, { align: 'center', size: 9.5, color: 'muted' }));
    }
    function info() {
      const ab = (addr << 1) | rw;
      let t = `S · ${hex2(addr)} + ${rw ? 'R' : 'W'} → wire byte ${hex2(ab)} · `;
      if (!present) t += '<b class="err">NACK</b> · P  → no device at this address (Arduino: endTransmission() returns 2)';
      else t += `<b class="ok">ACK</b> · ${rw ? 'target sends' : 'controller sends'} ${hex2(data)} · ${rw ? '<b>NACK</b> (controller: "last byte")' : '<b class="ok">ACK</b>'} · P`;
      dec.innerHTML = t;
    }
    W.anim((dt) => { if (playing) { prog += dt * 3.2; if (prog > 30) prog = 30; } draw(); }, c.canvas);
    info();
  })();

  /* =====================================================================
   * Figure 6.14 — TCA9548A multiplexer
   * ===================================================================== */
  (function () {
    const sch = W.schematic('#w-mux', {
      w: 480, h: 250, title: 'Two IMUs with the same address behind a TCA9548A multiplexer',
      items: [
        { t: 'ic', id: 'mcu', at: [60, 125], name: 'MCU', right: ['I²C'], w: 60 },
        { t: 'ic', id: 'tca', at: [220, 125], name: 'TCA9548A @0x70', left: ['in'], right: ['CH0', 'CH1', 'CH2'], pitch: 40, w: 90 },
        { t: 'ic', id: 'a', at: [410, 60], name: 'IMU A', left: ['0x68'], w: 70 },
        { t: 'ic', id: 'b', at: [410, 150], name: 'IMU B', left: ['0x68'], w: 70 },
        { t: 'wire', id: 'w0', pts: ['mcu.I²C', 'tca.in'] },
        { t: 'wire', id: 'wa', pts: ['tca.CH0', [320, 85], [320, 60], 'a.0x68'] },
        { t: 'wire', id: 'wb', pts: ['tca.CH1', [320, 125], [320, 150], 'b.0x68'] },
        { t: 'wire', pts: ['tca.CH2', [300, 165]] }, { t: 'text', at: [306, 165], text: '(free)', anchor: 'start' },
        { t: 'tag', id: 'tag', at: [220, 228], text: '' },
      ],
    });
    const ctl = W.$('#c-mux');
    const pa = [sch.pin('mcu.I²C'), sch.pin('tca.in')], pA = [sch.pin('tca.CH0'), [320, 85], [320, 60], sch.pin('a.0x68')], pB = [sch.pin('tca.CH1'), [320, 125], [320, 150], sch.pin('b.0x68')];
    const f0 = sch.flow(pa, { speed: 0, color: 'c3' }), fA = sch.flow(pA, { speed: 0, color: 'c3' }), fB = sch.flow(pB, { speed: 0, color: 'c3' });
    function upd(ch) {
      sch.set('wa', { stroke: ch === 0 ? 'c3' : '' }); sch.set('wb', { stroke: ch === 1 ? 'c3' : '' });
      hl(sch, 'a', ch === 0 ? 'c3' : ''); hl(sch, 'b', ch === 1 ? 'c3' : '');
      f0.set(1); fA.set(ch === 0 ? 1 : 0); fB.set(ch === 1 ? 1 : 0);
      sch.set('tag', { text: 'write ' + hex2(ch < 0 ? 0 : 1 << ch) + ' to 0x70 → ' + (ch < 0 ? 'all channels off' : 'CH' + ch + ' connected') });
    }
    W.segmented(ctl, { options: [[0, 'Select CH0 (IMU A)'], [1, 'Select CH1 (IMU B)'], [-1, 'None']], value: 0, onChange: upd });
    upd(0);
  })();

  /* =====================================================================
   * Figure 6.15 — SPI bus (static schematic)
   * ===================================================================== */
  (function () {
    W.schematic('#w-spibus', {
      w: 480, h: 270, title: 'SPI bus with two devices and separate chip selects',
      items: [
        { t: 'ic', id: 'm', at: [80, 140], name: 'MCU', right: ['SCK', 'MOSI', 'MISO', 'CS1', 'CS2'], pitch: 22 },
        { t: 'ic', id: 'i', at: [400, 75], name: 'IMU', left: ['SCK', 'SDI', 'SDO', 'CS'] },
        { t: 'ic', id: 'd', at: [400, 205], name: 'Display', left: ['SCK', 'SDI', 'SDO', 'CS'] },
        { t: 'wire', pts: ['m.SCK', [200, 96]] }, { t: 'wire', pts: [[200, 45], [200, 175]] }, { t: 'wire', pts: [[200, 45], 'i.SCK'] }, { t: 'wire', pts: [[200, 175], 'd.SCK'] }, { t: 'dot', at: [200, 96] },
        { t: 'wire', pts: ['m.MOSI', [220, 118]] }, { t: 'wire', pts: [[220, 65], [220, 195]] }, { t: 'wire', pts: [[220, 65], 'i.SDI'] }, { t: 'wire', pts: [[220, 195], 'd.SDI'] }, { t: 'dot', at: [220, 118] },
        { t: 'wire', pts: ['m.MISO', [240, 140]] }, { t: 'wire', pts: [[240, 85], [240, 215]] }, { t: 'wire', pts: [[240, 85], 'i.SDO'] }, { t: 'wire', pts: [[240, 215], 'd.SDO'] }, { t: 'dot', at: [240, 140] },
        { t: 'wire', pts: ['m.CS1', [280, 162], [280, 105], 'i.CS'] },
        { t: 'wire', pts: ['m.CS2', [300, 184], [300, 235], 'd.CS'] },
      ],
    });
  })();

  /* =====================================================================
   * Figure 6.16 — SPI modes
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-spi');
    let mode = 0, mo = 0xA5, mi = 0x3C, t = 0;
    W.segmented(ctl, { options: [[0, 'Mode 0'], [1, 'Mode 1'], [2, 'Mode 2'], [3, 'Mode 3']], value: mode, onChange: (v) => { mode = v; t = 0; } });
    hexInput(ctl, 'MOSI byte 0x', 'A5', (v) => { mo = parseHex(v, 0xFF, mo); t = 0; });
    hexInput(ctl, 'MISO byte 0x', '3C', (v) => { mi = parseHex(v, 0xFF, mi); t = 0; });
    const c = cv('#w-spi', 330, () => draw());
    function sigs() {
      const cpol = mode >> 1, cpha = mode & 1;
      const cs = (u) => (u >= 0.5 && u < 9.5 ? 0 : 1);
      const sck = (u) => {
        if (u < 1 || u >= 9) return cpol;
        const f = u - Math.floor(u);
        const active = cpha ? f < 0.5 : f >= 0.5;
        return active ? 1 - cpol : cpol;
      };
      const bitAt = (byte, u) => {
        if (u < 0.5 || u >= 9.5) return null;
        let k = cpha ? Math.floor(u) - 1 : Math.max(0, Math.floor(u) - 1);
        if (cpha && u < 1) return null;
        k = Math.min(7, k);
        return (byte >> (7 - k)) & 1;
      };
      return { cpol, cpha, cs, sck, bitAt };
    }
    function draw() {
      const x = c.ctx; clear(c);
      const { cpol, cpha, cs, sck, bitAt } = sigs();
      const l = 54, r = c.w - 10, tot = 10, X = (u) => l + (r - l) * u / tot;
      const rows = [['CS', 22, cs, 'c5'], ['SCK', 66, sck, 'c1'], ['MOSI', 110, (u) => bitAt(mo, u), 'c3'], ['MISO', 154, (u) => bitAt(mi, u), 'c2']];
      const hh = 26;
      // sample markers
      for (let k = 0; k < 8; k++) {
        const u = 1.5 + k, sx = X(u);
        x.save(); x.strokeStyle = col(u <= t ? 'c4' : 'line'); x.setLineDash([3, 4]); x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(sx, 12); x.lineTo(sx, 172); x.stroke(); x.restore();
      }
      for (const [name, y, fn, cc] of rows) {
        txt(x, name, 6, y + hh / 2, { bold: true, size: 12 });
        const lvl = (u) => { const v = fn(u); return v == null ? 0.5 : v; };
        wave(x, (u) => 1 - lvl(u), 0, tot, X, y, y + hh, { color: 'muted', width: 1, n: 1600 });
        wave(x, (u) => 1 - lvl(u), 0, Math.min(t, tot), X, y, y + hh, { color: cc, width: 2.2, n: Math.max(10, Math.round(1600 * Math.min(t, tot) / tot)) });
      }
      const edge = (cpha ? (cpol ? 'rising' : 'falling') : (cpol ? 'falling' : 'rising'));
      txt(x, `CPOL=${cpol}, CPHA=${cpha}: sample on ${edge} edges`, l, 190, { size: 12, color: 'muted' });
      // shift registers
      const k = Math.max(0, Math.min(8, Math.floor(t - 1.5) + 1));
      const ctrlReg = ((mo << k) | (mi >> (8 - k))) & 0xFF, perReg = ((mi << k) | (mo >> (8 - k))) & 0xFF;
      const cw = Math.min(26, (c.w - l - 80) / 8), y1 = 220, y2 = 280;
      const reg = (val, y, name, mine, other) => {
        txt(x, name, 6, y + cw / 2, { size: 12, bold: true });
        for (let i = 0; i < 8; i++) {
          const bx = l + i * cw, fromOther = i >= 8 - k;
          x.save(); x.globalAlpha = 0.25; x.fillStyle = col(fromOther ? other : mine); x.fillRect(bx, y, cw - 2, cw - 2); x.restore();
          x.strokeStyle = col('muted'); x.strokeRect(bx + 0.5, y + 0.5, cw - 3, cw - 3);
          txt(x, String((val >> (7 - i)) & 1), bx + cw / 2 - 1, y + cw / 2, { align: 'center', mono: true, size: 12 });
        }
        txt(x, '= ' + hex2(val), l + 8 + 8 * cw, y + cw / 2, { mono: true, size: 12 });
      };
      reg(ctrlReg, y1, 'Ctrl', 'c3', 'c2'); reg(perReg, y2, 'Periph', 'c2', 'c3');
      txt(x, 'after ' + k + ' of 8 clocks', l, y2 - 16, { size: 11, color: 'muted' });
    }
    W.anim((dt) => { t += dt * 1.3; if (t > 12.5) t = 0; draw(); }, c.canvas);
  })();

  /* =====================================================================
   * Figure 6.17 — CAN differential
   * ===================================================================== */
  (function () {
    let A = 1, imb = 0;
    const bits = [1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1];
    const dom = (t) => { // ramped level 0..1 (1 = dominant)
      const i = Math.floor(t), f = t - i; const b = (j) => (j < 0 || j >= bits.length ? 0 : bits[j] === 0 ? 1 : 0);
      const cur = b(i), prev = b(i - 1);
      return f < 0.08 ? prev + (cur - prev) * f / 0.08 : cur;
    };
    const n = (t) => A * (0.6 * Math.sin(2 * Math.PI * 0.37 * t) + 0.3 * Math.sin(2 * Math.PI * 1.9 * t + 1) + 0.25 * Math.sin(2 * Math.PI * 4.3 * t + 2) + 0.2 * Math.sin(2 * Math.PI * 9.7 * t));
    const H = (t) => 2.5 + dom(t) + n(t), L = (t) => 2.5 - dom(t) + n(t) * (1 - imb);
    const p1 = W.plot('#w-can', { xmin: 0, xmax: 12, ymin: -1, ymax: 6.5, height: 190, xlabel: '', ylabel: 'line (V)', xfmt: () => '' });
    p1.draw((p) => { p.fn(H, { color: 'c4', label: 'CANH', samples: 1200 }); p.fn(L, { color: 'c1', label: 'CANL', samples: 1200 }); });
    const p2 = W.plot('#w-can', { xmin: 0, xmax: 12, ymin: -1, ymax: 3, height: 170, xlabel: 'time (bit periods)', ylabel: 'H − L (V)' });
    let errs = 0;
    p2.draw((p) => {
      p.hline(0.9, { color: 'c3' }); p.hline(0.5, { color: 'c4' });
      p.text(11.9, 1.25, 'dominant > 0.9 V', { align: 'right', color: 'c3', size: 11 });
      p.text(11.9, 0.15, 'recessive < 0.5 V', { align: 'right', color: 'c4', size: 11 });
      p.fn((t) => H(t) - L(t), { color: 'c3', samples: 1200, width: 2.5 });
      errs = 0;
      bits.forEach((b, i) => { const d = H(i + 0.5) - L(i + 0.5); const read = d > 0.9 ? 0 : d < 0.5 ? 1 : -1; const ok = read === b; if (!ok) errs++; p.point(i + 0.5, d, { color: ok ? 'good' : 'bad', r: 4 }); });
    });
    const ctl = W.$('#c-can');
    const rE = W.readout(ctl, { label: 'Bit errors' });
    const upd = () => { p1.update(); p2.update(); rE.set(errs + ' / ' + bits.length); rE.setClass(errs ? 'bad' : 'good'); };
    W.slider(ctl, { label: 'Common-mode noise', min: 0, max: 3, step: 0.05, value: A, unit: 'V', format: (v) => v.toFixed(2) + ' V', onInput: (v) => { A = v; upd(); } });
    W.slider(ctl, { label: 'Imbalance', min: 0, max: 0.5, step: 0.01, value: imb, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => { imb = v; upd(); } });
    upd();
  })();

  /* =====================================================================
   * Figure 6.18 — servo PWM and PPM
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-servo');
    let mode = 'pwm', stick = 0;
    W.segmented(ctl, { options: [['pwm', 'Servo PWM'], ['ppm', 'PPM (4 ch)']], value: mode, onChange: (v) => { mode = v; draw(); } });
    W.slider(ctl, { label: 'Stick', min: -100, max: 100, step: 1, value: 0, format: (v) => v + ' %', onInput: (v) => { stick = v; draw(); } });
    const rW = W.readout(ctl, { label: 'Pulse / gap' }), rA = W.readout(ctl, { label: 'Servo angle' });
    const c = cv('#w-servo', 210, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const pw = 1.5 + stick / 200; // ms
      const sv = c.w < 460 ? 80 : 120, l = 10, r = c.w - sv - 16, yH = 50, yL = 120;
      if (mode === 'pwm') {
        const tot = 40, X = (t) => l + (r - l) * t / tot;
        wave(x, (t) => ((t % 20) < pw ? 0 : 1), 0, tot, X, yH, yL, { color: 'c1', width: 2.2, n: 3000 });
        for (const t0 of [0, 20]) {
          x.strokeStyle = col('c2'); x.lineWidth = 1; x.beginPath(); x.moveTo(X(t0), yH - 14); x.lineTo(X(t0 + pw), yH - 14); x.stroke();
          txt(x, W.fix(pw, 2) + ' ms', X(t0 + pw) + 4, yH - 14, { size: 11, color: 'c2' });
        }
        x.strokeStyle = col('muted'); x.beginPath(); x.moveTo(X(0), yL + 22); x.lineTo(X(20), yL + 22); x.stroke();
        txt(x, '20 ms frame (50 Hz)', X(10), yL + 34, { align: 'center', size: 11, color: 'muted' });
        rW.set(W.fix(pw, 3) + ' ms');
      } else {
        const ch = [pw, 1.2, 1.8, 1.5], sep = 0.3, tot = 22.5, X = (t) => l + (r - l) * t / tot;
        const edges = []; let t0 = 0; ch.forEach((v) => { edges.push(t0); t0 += v; }); edges.push(t0);
        wave(x, (t) => (edges.some((e) => t >= e && t < e + sep) ? 0 : 1), 0, tot, X, yH, yL, { color: 'c1', width: 2.2, n: 3000 });
        ch.forEach((v, i) => {
          const a = X(edges[i]), b = X(edges[i + 1]);
          x.save(); x.globalAlpha = 0.14; x.fillStyle = col(i ? 'muted' : 'c2'); x.fillRect(a, yH - 8, b - a, yL - yH + 16); x.restore();
          txt(x, 'CH' + (i + 1), (a + b) / 2, yL + 18, { align: 'center', size: 11, color: i ? 'muted' : 'c2', bold: !i });
        });
        txt(x, 'sync gap', (X(edges[4] + sep) + X(tot)) / 2, yL + 18, { align: 'center', size: 11, color: 'muted' });
        txt(x, '22.5 ms frame', X(tot / 2), yL + 40, { align: 'center', size: 11, color: 'muted' });
        rW.set('CH1 ' + W.fix(pw, 3) + ' ms');
      }
      // servo graphic
      const cx = c.w - sv / 2 - 8, cy = 100, R = sv * 0.42, ang = (pw - 1.5) * 180; // degrees from centre
      x.fillStyle = col('surface2'); x.strokeStyle = col('muted'); x.lineWidth = 1.5;
      rrect(x, cx - R * 0.9, cy - R * 0.55, R * 1.8, R * 1.5, 6); x.fill(); x.stroke();
      x.save(); x.translate(cx, cy); x.rotate((ang - 90) * Math.PI / 180);
      x.fillStyle = col('c2'); rrect(x, -5, -5, R, 10, 5); x.fill(); x.restore();
      x.fillStyle = col('ink'); x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill();
      txt(x, Math.round(90 + ang) + '°', cx, cy + R * 0.8 + 6, { align: 'center', size: 12 });
      rA.set(Math.round(90 + ang) + '°');
    }
    draw();
  })();

  /* =====================================================================
   * Figure 6.19 — DShot encoder
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-dshot');
    let thr = 1046, tel = false, rate = 600e3;
    W.slider(ctl, { label: 'Throttle value', min: 0, max: 2047, step: 1, value: thr, format: (v) => String(v), onInput: (v) => { thr = Math.round(v); draw(); } });
    W.toggle(ctl, { label: 'Telemetry request', value: tel, onChange: (v) => { tel = v; draw(); } });
    W.segmented(ctl, { options: [[150e3, '150'], [300e3, '300'], [600e3, '600'], [1200e3, '1200']], value: rate, onChange: (v) => { rate = v; draw(); } });
    const rF = W.readout(ctl, { label: 'Frame time', unit: 's' }), rB = W.readout(ctl, { label: 'Bit time', unit: 's' });
    const out = W.$('#dshot-bits');
    const frame = () => { const v = (thr << 1) | (tel ? 1 : 0); const crc = (v ^ (v >> 4) ^ (v >> 8)) & 0x0F; return { v, crc, f: (v << 4) | crc }; };
    const c = cv('#w-dshot', 150, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const { crc, f } = frame();
      const l = 10, r = c.w - 10, tot = 17, X = (t) => l + (r - l) * t / tot, yH = 30, yL = 90;
      const bit = (i) => (f >> (15 - i)) & 1;
      wave(x, (t) => { if (t < 0.5 || t >= 16.5) return 1; const i = Math.floor(t - 0.5), fr = t - 0.5 - i; return fr < (bit(i) ? 0.75 : 0.375) ? 0 : 1; }, 0, tot, X, yH, yL, { color: 'c1', width: 2, n: 3400 });
      for (let i = 0; i < 16; i++) {
        const cc = i < 11 ? 'c1' : i === 11 ? 'c5' : 'c3';
        x.save(); x.globalAlpha = 0.12; x.fillStyle = col(cc); x.fillRect(X(0.5 + i) + 1, yH - 8, X(1) - X(0) - 2, yL - yH + 16); x.restore();
        txt(x, String(bit(i)), X(1 + i), yL + 18, { align: 'center', size: 12, mono: true, color: cc, bold: true });
      }
      txt(x, 'throttle (11 bits)', X(6), yH - 18, { align: 'center', size: 11, color: 'c1' });
      txt(x, 'T', X(12), yH - 18, { align: 'center', size: 11, color: 'c5' });
      txt(x, 'CRC', X(14.5), yH - 18, { align: 'center', size: 11, color: 'c3' });
      const tb = 1 / rate; rF.set(16 * tb); rB.set(tb);
      const s = f.toString(2).padStart(16, '0');
      const kind = thr === 0 ? 'disarmed / motor stop' : thr < 48 ? 'special command ' + thr : 'throttle ' + Math.round((thr - 48) / 1999 * 1000) / 10 + ' %';
      out.innerHTML = `<span style="color:var(--c1)">${s.slice(0, 11)}</span> <span style="color:var(--c5)">${s[11]}</span> <span style="color:var(--c3)">${s.slice(12)}</span> = 0x${f.toString(16).toUpperCase().padStart(4, '0')} · CRC ${crc.toString(2).padStart(4, '0')} · ${kind}`;
    }
    draw();
  })();

  /* =====================================================================
   * Figure 6.20 — ringing and series termination
   * ===================================================================== */
  (function () {
    const sch = W.schematic('#w-ring-sch', {
      w: 440, h: 160, title: 'Driver, series resistor, wire inductance and receiver capacitance',
      items: [
        { t: 'Vsq', id: 'v', a: [40, 60], b: [40, 120], label: 'driver 0→3.3 V' },
        { t: 'wire', pts: [[40, 60], [40, 40], [70, 40]] },
        { t: 'R', id: 'ro', a: [70, 40], b: [130, 40], label: '25 Ω (driver)' },
        { t: 'R', id: 'rs', a: [150, 40], b: [210, 40], label: 'Rs' },
        { t: 'wire', pts: [[130, 40], [150, 40]] }, { t: 'wire', pts: [[210, 40], [230, 40]] },
        { t: 'L', id: 'l', a: [230, 40], b: [300, 40], label: 'wire L' },
        { t: 'wire', pts: [[300, 40], [350, 40]] }, { t: 'dot', at: [330, 40] },
        { t: 'C', id: 'c', a: [330, 70], b: [330, 110], label: 'C' },
        { t: 'wire', pts: [[330, 40], [330, 70]] }, { t: 'wire', pts: [[330, 110], [330, 135]] }, { t: 'gnd', at: [330, 135] },
        { t: 'wire', pts: [[40, 120], [40, 135]] }, { t: 'gnd', at: [40, 135] },
        { t: 'text', at: [356, 40], text: '→ receiver', anchor: 'start' },
      ],
    });
    let len = 30, Rs = 0; const RD = 25, V = 3.3;
    const params = () => { const L = len * 10e-9, C = 15e-12 + len * 0.5e-12, R = RD + Rs; return { L, C, R, w0: 1 / Math.sqrt(L * C), z: (R / 2) * Math.sqrt(C / L) }; };
    function resp(t) {
      const { w0, z } = params(); if (t <= 0) return 0;
      if (z < 0.999) { const wd = w0 * Math.sqrt(1 - z * z); return V * (1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z / Math.sqrt(1 - z * z) * Math.sin(wd * t))); }
      if (z < 1.001) return V * (1 - (1 + w0 * t) * Math.exp(-w0 * t));
      const s1 = -w0 * (z - Math.sqrt(z * z - 1)), s2 = -w0 * (z + Math.sqrt(z * z - 1));
      return V * (1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2));
    }
    const p = W.plot('#w-ring', { xmin: -5e-9, xmax: 100e-9, ymin: -2, ymax: 6.5, height: 240, xlabel: 'time (s)', ylabel: 'receiver (V)', xunit: 's', yunit: 'V', hover: true });
    p.draw((p) => {
      p.hline(3.6, { color: 'c4' }); p.text(99e-9, 3.85, 'VDD + 0.3 V (clamp)', { align: 'right', color: 'c4', size: 11 });
      p.hline(-0.3, { color: 'c4' });
      p.fn((t) => (t < 0 ? 0 : V), { color: 'muted', dash: [4, 4], width: 1.5, hover: false, label: 'ideal edge' });
      p.fn(resp, { color: 'c1', samples: 1500, label: 'at the receiver' });
    });
    const ctl = W.$('#c-ring');
    W.slider(ctl, { label: 'Wire length', min: 5, max: 100, step: 1, value: len, unit: 'cm', format: (v) => v + ' cm', onInput: (v) => { len = v; upd(); } });
    W.slider(ctl, { label: 'Series \\(R_s\\)', min: 0, max: 300, step: 1, value: Rs, unit: 'Ω', format: (v) => v + ' Ω', onInput: (v) => { Rs = v; upd(); } });
    const rZ = W.readout(ctl, { label: '\\(\\zeta\\)' }), rO = W.readout(ctl, { label: 'Overshoot' }), rT = W.readout(ctl, { label: 'Rise 10–90 %', unit: 's' });
    function upd() {
      const { L, C, z } = params();
      sch.set('rs', { label: 'Rs = ' + Rs + ' Ω' }); sch.set('l', { label: 'wire ' + W.si(L, 'H', 2) }); sch.set('c', { label: W.si(C, 'F', 2) });
      let peak = 0, t10 = null, t90 = null;
      for (let i = 1; i <= 4000; i++) { const t = i * 0.05e-9, v = resp(t); peak = Math.max(peak, v); if (t10 == null && v >= 0.1 * V) t10 = t; if (t90 == null && v >= 0.9 * V) t90 = t; }
      const os = Math.max(0, peak / V - 1), tr = t90 - t10;
      rZ.set(W.fix(z, 2)); rO.set(Math.round(os * 100) + ' %'); rO.setClass(os < 0.05 ? 'good' : os > 0.3 ? 'bad' : '');
      rT.set(tr); rT.setClass(tr < 15e-9 ? 'good' : 'bad');
      p.update();
      if (len >= 30 && os < 0.05 && tr < 15e-9) Book.solve('ring-task');
    }
    upd();
  })();
})();
