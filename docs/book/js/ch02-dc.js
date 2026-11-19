/* Chapter 2 — DC circuit analysis widgets */
(function () {
  'use strict';
  const par = (a, b) => (a === 0 || b === 0 ? 0 : (a * b) / (a + b));
  const pct = (x, d = 1) => (100 * x).toFixed(d) + ' %';
  // Show/hide a schematic part including its label (sch.set hidden only hides the body).
  const showPart = (sch, id, on) => {
    const r = sch.parts[id];
    if (!r) return;
    r.g.style.display = on ? '' : 'none';
    if (r.text) r.text.style.display = on ? '' : 'none';
  };
  const hl = (sch, id, col) => {
    const r = sch.parts[id];
    if (!r) return;
    r.g.style.stroke = col ? W.col(col) : '';
    r.g.style.strokeWidth = col ? '4' : '';
  };

  /* ---------------- Figure 2.1: nodes, branches, meshes ---------------- */
  (function () {
    const sch = W.schematic('#f-nodes', {
      w: 470, h: 240, title: 'Circuit with four nodes and five branches',
      items: [
        { t: 'V', id: 'v1', a: [50, 90], b: [50, 160], label: '9 V' },
        { t: 'R', id: 'r1', a: [110, 40], b: [190, 40], label: 'R1 1 kΩ' },
        { t: 'R', id: 'r2', a: [250, 80], b: [250, 160], label: 'R2 2 kΩ' },
        { t: 'R', id: 'r3', a: [300, 40], b: [380, 40], label: 'R3 1 kΩ' },
        { t: 'R', id: 'r4', a: [420, 80], b: [420, 160], label: 'R4 1 kΩ', side: -1 },
        { t: 'wire', id: 'wA', pts: [[50, 90], [50, 40], [110, 40]] },
        { t: 'wire', id: 'wB1', pts: [[190, 40], [300, 40]] },
        { t: 'wire', id: 'wB2', pts: [[250, 40], [250, 80]] },
        { t: 'wire', id: 'wC', pts: [[380, 40], [420, 40], [420, 80]] },
        { t: 'wire', id: 'wG1', pts: [[50, 160], [50, 200], [420, 200], [420, 160]] },
        { t: 'wire', id: 'wG2', pts: [[250, 160], [250, 200]] },
        { t: 'dot', at: [250, 40] }, { t: 'dot', at: [250, 200] },
        { t: 'gnd', at: [140, 200] },
        { t: 'text', at: [72, 26], text: 'A' }, { t: 'text', at: [250, 24], text: 'B' }, { t: 'text', at: [440, 26], text: 'C' },
        { t: 'tag', id: 'tag', at: [150, 125], text: 'pick a node' },
      ],
    });
    const nodes = { A: ['wA'], B: ['wB1', 'wB2'], C: ['wC'], G: ['wG1', 'wG2'] };
    const m1 = sch.flow([[50, 160], [50, 40], [250, 40], [250, 200], [50, 200], [50, 160]], { speed: 0, color: 'c3' });
    const m2 = sch.flow([[250, 200], [250, 40], [420, 40], [420, 200], [250, 200]], { speed: 0, color: 'c5' });
    const s = W.solveDC([
      { name: 'V', type: 'V', n: ['A', '0'], value: 9 },
      { name: 'R1', type: 'R', n: ['A', 'B'], value: 1000 },
      { name: 'R2', type: 'R', n: ['B', '0'], value: 2000 },
      { name: 'R3', type: 'R', n: ['B', 'C'], value: 1000 },
      { name: 'R4', type: 'R', n: ['C', '0'], value: 1000 },
    ]);
    const ctl = W.controls('#f-nodes');
    const infoEl = W.h('p', { class: 'ch2-note' });
    const info = { set: (t) => { infoEl.textContent = t; }, el: infoEl };
    const desc = {
      A: 'Node A: V = ' + W.si(s.v.A, 'V') + '. Joins the source + terminal and R1.',
      B: 'Node B: V = ' + W.si(s.v.B, 'V') + '. Three branches meet here: R1, R2, R3.',
      C: 'Node C: V = ' + W.si(s.v.C, 'V') + '. Joins R3 and R4.',
      G: 'Ground: 0 V by definition. All of the bottom wire is one node.',
      m1: 'Mesh 1: source → R1 → R2 → back. KVL: 9 − 4.5 − 4.5 = 0',
      m2: 'Mesh 2: R2 ↔ R3 → R4. KVL: 4.5 − 2.25 − 2.25 = 0',
    };
    const pick = (k) => {
      for (const n in nodes) for (const id of nodes[n]) hl(sch, id, n === k ? 'c4' : null);
      m1.set(k === 'm1' ? 1 : 0); m2.set(k === 'm2' ? 1 : 0);
      info.set(desc[k]);
      sch.set('tag', { text: k.length === 1 ? (k === 'G' ? 'V = 0 V' : 'V = ' + W.si(s.v[k], 'V')) : (k === 'm1' ? 'mesh 1' : 'mesh 2') });
    };
    W.segmented(ctl, { options: [['A', 'Node A'], ['B', 'Node B'], ['C', 'Node C'], ['G', 'Ground'], ['m1', 'Mesh 1'], ['m2', 'Mesh 2']], value: 'B', onChange: pick });
    W.$('#f-nodes').append(info.el);
    pick('B');
  })();

  /* ---------------- Two-source circuit (Figures 2.2 and 2.9) ---------------- */
  function twoSource(host, opts) {
    const items = [
      { t: 'V', id: 'v1', a: [50, 100], b: [50, 170], label: 'V1' },
      { t: 'wire', id: 'v1s', pts: [[50, 100], [50, 170]] },
      { t: 'wire', pts: [[50, 100], [50, 50], [90, 50]] },
      { t: 'R', id: 'r1', a: [90, 50], b: [170, 50], label: 'R1 1 kΩ' },
      { t: 'wire', pts: [[170, 50], [270, 50]] },
      { t: 'dot', at: [220, 50] },
      { t: 'R', id: 'r3', a: [270, 50], b: [350, 50], label: 'R3 1 kΩ' },
      { t: 'wire', pts: [[350, 50], [390, 50], [390, 100]] },
      { t: 'V', id: 'v2', a: [390, 100], b: [390, 170], label: 'V2', side: -1 },
      { t: 'wire', id: 'v2s', pts: [[390, 100], [390, 170]] },
      { t: 'wire', pts: [[220, 50], [220, 100]] },
      { t: 'R', id: 'r2', a: [220, 100], b: [220, 170], label: 'R2' },
      { t: 'wire', pts: [[50, 170], [50, 210], [390, 210], [390, 170]] },
      { t: 'wire', pts: [[220, 170], [220, 210]] },
      { t: 'dot', at: [220, 210] }, { t: 'gnd', at: [300, 210] },
      { t: 'tag', id: 'tx', at: [220, 22], text: 'X' },
      { t: 'tag', id: 't1', at: [130, 88], text: 'I1' },
      { t: 'tag', id: 't3', at: [310, 88], text: 'I3' },
      { t: 'tag', id: 't2', at: [292, 182], text: 'I2' },
    ];
    const sch = W.schematic(host, { w: 440, h: 245, title: 'Two sources feeding node X', items });
    const f1 = sch.flow([[220, 210], [50, 210], [50, 50], [220, 50]], {});
    const f2 = sch.flow([[220, 50], [220, 210]], {});
    const f3 = sch.flow([[220, 210], [390, 210], [390, 50], [220, 50]], {});
    showPart(sch, 'v1s', false); showPart(sch, 'v2s', false);
    return {
      sch,
      show(V1, V2, R2, on1, on2) {
        showPart(sch, 'v1', on1); showPart(sch, 'v1s', !on1);
        showPart(sch, 'v2', on2); showPart(sch, 'v2s', !on2);
        const s = W.solveDC([
          { name: 'V1', type: 'V', n: ['a', '0'], value: on1 ? V1 : 0 },
          { name: 'R1', type: 'R', n: ['a', 'x'], value: 1000 },
          { name: 'R2', type: 'R', n: ['x', '0'], value: R2 },
          { name: 'R3', type: 'R', n: ['b', 'x'], value: 1000 },
          { name: 'V2', type: 'V', n: ['b', '0'], value: on2 ? V2 : 0 },
        ]);
        const I1 = s.i.R1, I2 = s.i.R2, I3 = s.i.R3;
        sch.set('v1', { label: 'V1 ' + W.fix(V1, 1) + ' V' });
        sch.set('v2', { label: 'V2 ' + W.fix(V2, 1) + ' V' });
        sch.set('r2', { label: 'R2 ' + W.si(R2, 'Ω', 2) });
        sch.set('tx', { text: 'VX = ' + W.fix(s.v.x, 2) + ' V' });
        sch.set('t1', { text: 'I1 = ' + W.fix(I1 * 1000, 2) + ' mA' });
        sch.set('t2', { text: 'I2 = ' + W.fix(I2 * 1000, 2) + ' mA' });
        sch.set('t3', { text: 'I3 = ' + W.fix(I3 * 1000, 2) + ' mA' });
        const sc = (i) => W.clamp(i / 0.0015, -3, 3);
        f1.set(sc(I1)); f2.set(sc(I2)); f3.set(sc(I3));
        return { Vx: s.v.x, I1, I2, I3 };
      },
    };
  }

  /* ---------------- Figure 2.2: KCL / KVL ---------------- */
  (function () {
    const ts = twoSource('#f-kcl');
    let V1 = 9, V2 = 5, R2 = 2000;
    const ctl = W.controls('#f-kcl');
    W.slider(ctl, { label: '\\(V_1\\)', min: 0, max: 12, step: 0.1, value: V1, unit: 'V', onInput: (v) => { V1 = v; upd(); } });
    W.slider(ctl, { label: '\\(V_2\\)', min: 0, max: 12, step: 0.1, value: V2, unit: 'V', onInput: (v) => { V2 = v; upd(); } });
    W.slider(ctl, { label: '\\(R_2\\)', min: 100, max: 10000, log: true, value: R2, unit: 'Ω', onInput: (v) => { R2 = v; upd(); } });
    const ctl2 = W.controls('#f-kcl');
    const rk = W.readout(ctl2, { label: 'KCL at X: \\(I_1 + I_3 - I_2\\) =' });
    const rl1 = W.readout(ctl2, { label: 'KVL left loop:' });
    const rl2 = W.readout(ctl2, { label: 'KVL right loop:' });
    const rp = W.readout(ctl2, { label: 'V2:' });
    function upd() {
      const r = ts.show(V1, V2, R2, true, true);
      const z = (x) => (Math.abs(x) < 5e-7 ? 0 : x);
      rk.set(W.fix(z(r.I1 + r.I3 - r.I2) * 1000, 3) + ' mA');
      const t = (x) => (x < -5e-4 ? '+ ' : '− ') + W.fix(Math.abs(x), 2);
      rl1.set(`${W.fix(V1, 1)} ${t(r.I1 * 1000)} ${t(r.Vx)} = ${W.fix(Math.abs(z(V1 - r.I1 * 1000 - r.Vx)), 2)} V`);
      rl2.set(`${W.fix(V2, 1)} ${t(r.I3 * 1000)} ${t(r.Vx)} = ${W.fix(Math.abs(z(V2 - r.I3 * 1000 - r.Vx)), 2)} V`);
      const P = V2 * r.I3; // power delivered by V2 (current out of + is I3)
      rp.set(Math.abs(r.I3) < 5e-6 ? 'idle (no current)' : (P > 0 ? 'supplies ' : 'absorbs ') + W.si(Math.abs(P), 'W'));
      rp.setClass(P < -1e-6 ? 'bad' : '');
      if (Math.abs(V1 - 9) < 0.051 && Math.abs(r.I3) < 5e-5) Book.solve('kvl-task');
    }
    upd();
  })();

  /* ---------------- Figure 2.3: parallel resistance ---------------- */
  (function () {
    let R1 = 1000;
    const p = W.plot('#f-par', { xmin: 10, xmax: 1e5, ymin: 5, ymax: 2e5, logx: true, logy: true, xlabel: 'R2 (Ω)', ylabel: 'resistance (Ω)', hover: true, xunit: 'Ω', yunit: 'Ω', height: 290 });
    p.draw((p) => {
      p.fn(() => R1, { color: 'c2', dash: [6, 4], label: 'R1', hover: false, width: 1.8 });
      p.fn((x) => x, { color: 'c3', dash: [6, 4], label: 'R2', hover: false, width: 1.8 });
      p.fn((x) => par(R1, x), { color: 'c1', label: 'R1 ∥ R2', width: 3 });
      p.point(R1, R1 / 2, { color: 'c1', label: 'equal: R/2' });
    });
    const ctl = W.controls('#f-par');
    W.slider(ctl, { label: '\\(R_1\\)', min: 10, max: 1e5, log: true, value: R1, unit: 'Ω', onInput: (v) => { R1 = v; p.update(); } });
  })();

  /* ---------------- Figure 2.4: divider loading ---------------- */
  (function () {
    const Vin = 9;
    let R1 = 10000, R2 = 10000, RL = 10000;
    const sch = W.schematic('#f-load', {
      w: 440, h: 262, title: 'Voltage divider with switchable load',
      items: [
        { t: 'V', a: [50, 100], b: [50, 180], label: '9 V' },
        { t: 'wire', pts: [[50, 100], [50, 30], [180, 30]] },
        { t: 'R', id: 'r1', a: [180, 30], b: [180, 110], label: 'R1' },
        { t: 'wire', pts: [[180, 110], [180, 130]] },
        { t: 'R', id: 'r2', a: [180, 130], b: [180, 210], label: 'R2' },
        { t: 'wire', pts: [[180, 120], [300, 120]] },
        { t: 'dot', at: [180, 120] },
        { t: 'SW', id: 'sw', a: [300, 120], b: [350, 120], label: 'load', closed: false },
        { t: 'wire', pts: [[350, 120], [380, 120], [380, 140]] },
        { t: 'R', id: 'rl', a: [380, 140], b: [380, 210], label: 'RL', side: -1 },
        { t: 'wire', pts: [[50, 180], [50, 230], [380, 230], [380, 210]] },
        { t: 'wire', pts: [[180, 210], [180, 230]] },
        { t: 'dot', at: [180, 230] }, { t: 'gnd', at: [110, 230] },
        { t: 'tag', id: 'tv', at: [250, 98], text: 'Vout' },
      ],
    });
    const fA = sch.flow([[50, 180], [50, 30], [180, 30], [180, 120]], {});
    const fB = sch.flow([[180, 120], [180, 230]], {});
    const fC = sch.flow([[180, 120], [380, 120], [380, 230], [180, 230]], {});
    const fD = sch.flow([[180, 230], [50, 230], [50, 180]], {});
    const p = W.plot('#f-load', { xmin: 10, xmax: 1e7, logx: true, ymin: 0, ymax: 9, xlabel: 'load resistance RL (Ω)', ylabel: 'Vout (V)', hover: true, xunit: 'Ω', yunit: 'V', height: 240 });
    const ctl = W.controls('#f-load');
    W.slider(ctl, { label: '\\(R_1\\)', min: 100, max: 1e6, log: true, value: R1, unit: 'Ω', onInput: (v) => { R1 = v; upd(); } });
    W.slider(ctl, { label: '\\(R_2\\)', min: 100, max: 1e6, log: true, value: R2, unit: 'Ω', onInput: (v) => { R2 = v; upd(); } });
    W.slider(ctl, { label: '\\(R_L\\)', min: 10, max: 1e7, log: true, value: RL, unit: 'Ω', onInput: (v) => { RL = v; upd(); } });
    const ctl2 = W.controls('#f-load');
    const rv = W.readout(ctl2, { label: '\\(V_{out}\\)', unit: 'V' });
    const ru = W.readout(ctl2, { label: 'unloaded', unit: 'V' });
    const rr = W.readout(ctl2, { label: '\\(R_1 \\parallel R_2\\)', unit: 'Ω' });
    const ri = W.readout(ctl2, { label: 'from 9 V', unit: 'A' });
    sch.parts.sw.it.onToggle = () => upd();
    const vOf = (rl) => Vin * par(R2, rl) / (R1 + par(R2, rl));
    p.draw((p) => {
      const vu = Vin * R2 / (R1 + R2);
      p.area(() => vu, 10, 1e7, { color: 'c3', alpha: 0.13 }, () => 0.9 * vu);
      p.hline(vu, { color: 'c3' });
      p.vline(par(R1, R2), { color: 'muted' });
      p.text(par(R1, R2) * 1.15, 8.4, 'R1∥R2', { color: 'muted' });
      p.fn(vOf, { color: 'c1', label: 'Vout with load RL', width: 3 });
      if (sch.parts.sw.it.closed) p.point(RL, vOf(RL), { color: 'c4' });
    });
    function upd() {
      const closed = sch.parts.sw.it.closed;
      const s = W.solveDC([
        { name: 'V', type: 'V', n: ['in', '0'], value: Vin },
        { name: 'R1', type: 'R', n: ['in', 'o'], value: R1 },
        { name: 'R2', type: 'R', n: ['o', '0'], value: R2 },
        { name: 'RL', type: 'R', n: ['o', '0'], value: closed ? RL : 1e15 },
      ]);
      const vu = Vin * R2 / (R1 + R2);
      sch.set('r1', { label: 'R1 ' + W.si(R1, 'Ω', 3) });
      sch.set('r2', { label: 'R2 ' + W.si(R2, 'Ω', 3) });
      sch.set('rl', { label: 'RL ' + W.si(RL, 'Ω', 3) });
      sch.set('tv', { text: 'Vout = ' + W.fix(s.v.o, 2) + ' V' });
      rv.set(s.v.o); ru.set(vu); rr.set(par(R1, R2)); ri.set(s.i.V);
      rv.setClass(closed ? (s.v.o >= 0.9 * vu ? 'good' : 'bad') : '');
      const sc = (i) => W.clamp(i / 0.0004, 0, 4) * (i > 1e-9 ? 1 : 0);
      fA.set(sc(s.i.R1)); fB.set(sc(s.i.R2)); fC.set(closed ? sc(s.i.RL) : 0); fD.set(sc(s.i.R1));
      p.update();
      if (closed && RL >= 950 && RL <= 1050 && s.v.o >= 4 && s.v.o <= 5) Book.solve('load-task');
    }
    upd();
  })();

  /* ---------------- Figure 2.5: battery monitor designer ---------------- */
  (function () {
    const BAT = { '1s': [4.2, '1S LiPo'], '2s': [8.4, '2S LiPo'], '3s': [12.6, '3S LiPo'], '9v': [9.6, '9 V alkaline'] };
    const MCU = { uno: [5.0, 10, 'Uno'], s3: [3.1, 12, 'ESP32-S3'], m33: [3.3, 12, '3.3 V MCU'] };
    let bat = '2s', mcu = 's3', R1 = 10000, R2 = 10000, cap = false;
    const sch = W.schematic('#f-batt', {
      w: 470, h: 272, title: 'Battery voltage divider into an ADC pin',
      items: [
        { t: 'bat2', id: 'bat', a: [70, 85], b: [70, 165], label: 'Vbat' },
        { t: 'wire', pts: [[70, 85], [70, 40], [160, 40]] },
        { t: 'R', id: 'r1', a: [160, 40], b: [160, 120], label: 'R1' },
        { t: 'wire', pts: [[160, 120], [160, 140]] },
        { t: 'R', id: 'r2', a: [160, 140], b: [160, 220], label: 'R2' },
        { t: 'wire', pts: [[160, 130], [342, 130]] },
        { t: 'dot', at: [160, 130] },
        { t: 'wire', id: 'cw1', pts: [[280, 130], [280, 160]] },
        { t: 'dot', id: 'cdot', at: [280, 130] },
        { t: 'C', id: 'c', a: [280, 160], b: [280, 220], label: '100 nF' },
        { t: 'wire', id: 'cw2', pts: [[280, 220], [280, 240]] },
        { t: 'ic', at: [400, 130], name: 'MCU', left: ['A0'], bottom: ['GND'] },
        { t: 'wire', pts: [[70, 165], [70, 240], [400, 240], [400, 168]] },
        { t: 'wire', pts: [[160, 220], [160, 240]] },
        { t: 'dot', at: [160, 240] }, { t: 'gnd', at: [110, 240] },
        { t: 'tag', id: 'tv', at: [240, 106], text: 'V_A0' },
      ],
    });
    const ctl = W.controls('#f-batt');
    W.select(ctl, { label: 'Battery', options: Object.keys(BAT).map((k) => [k, `${BAT[k][1]} (${BAT[k][0]} V max)`]), value: bat, onChange: (v) => { bat = v; upd(); } });
    W.select(ctl, { label: 'MCU', options: [['uno', 'Arduino Uno (5.0 V ref, 10-bit)'], ['s3', 'ESP32-S3 (≈3.1 V full scale, 12-bit)'], ['m33', '3.3 V MCU (3.3 V ref, 12-bit)']], value: mcu, onChange: (v) => { mcu = v; upd(); } });
    W.toggle(ctl, { label: '100 nF at ADC pin', value: cap, onChange: (v) => { cap = v; upd(); } });
    const ctl2 = W.controls('#f-batt');
    W.slider(ctl2, { label: '\\(R_1\\) (top)', min: 1000, max: 1e6, log: true, value: R1, unit: 'Ω', onInput: (v) => { R1 = v; upd(); } });
    W.slider(ctl2, { label: '\\(R_2\\) (bottom)', min: 1000, max: 1e6, log: true, value: R2, unit: 'Ω', onInput: (v) => { R2 = v; upd(); } });
    const ctl3 = W.controls('#f-batt');
    const rv = W.readout(ctl3, { label: 'ADC pin at full charge' });
    const ri = W.readout(ctl3, { label: 'divider current', unit: 'A' });
    const rm = W.readout(ctl3, { label: 'drain / month' });
    const rs = W.readout(ctl3, { label: 'source impedance' });
    const rres = W.readout(ctl3, { label: 'battery mV per count' });
    function upd() {
      const [Vb] = BAT[bat], [FS, bits] = MCU[mcu];
      const k = R2 / (R1 + R2), Va = Vb * k, I = Vb / (R1 + R2), Rs = par(R1, R2);
      sch.set('bat', { label: W.fix(Vb, 1) + ' V' });
      sch.set('r1', { label: 'R1 ' + W.si(R1, 'Ω', 3) });
      sch.set('r2', { label: 'R2 ' + W.si(R2, 'Ω', 3) });
      sch.set('tv', { text: 'A0 = ' + W.fix(Va, 2) + ' V' });
      for (const id of ['c', 'cw1', 'cw2', 'cdot']) showPart(sch, id, cap);
      rv.set(W.fix(Va, 2) + ' V of ' + W.fix(FS, 1) + ' V');
      rv.setClass(Va > FS ? 'bad' : Va > 0.6 * FS ? 'good' : '');
      ri.set(I); ri.setClass(I < 30e-6 ? 'good' : I < 200e-6 ? '' : 'bad');
      rm.set(W.fix(I * 720 * 1000, I * 720 * 1000 < 10 ? 2 : 0) + ' mAh');
      rs.set(W.si(Rs, 'Ω') + (cap ? ' (+100 nF ✓)' : Rs > 10000 ? ' (too high)' : ''));
      rs.setClass(cap || Rs <= 10000 ? 'good' : 'bad');
      rres.set(W.fix(FS / Math.pow(2, bits) / k * 1000, 2) + ' mV');
      if (bat === '2s' && mcu === 's3' && Va >= 2.5 && Va <= 3.1 && I < 30e-6 && (cap || Rs <= 10000)) Book.solve('batt-task');
    }
    upd();
  })();

  /* ---------------- Figure 2.6: loaded potentiometer ---------------- */
  (function () {
    const V = 5, Rp = 10000;
    let x = 0.5, ratio = 1;
    const sch = W.schematic('#f-pot', {
      w: 380, h: 232, title: 'Potentiometer driving a load',
      items: [
        { t: 'vcc', at: [120, 40], label: '5 V' },
        { t: 'pot', id: 'pot', a: [120, 170], b: [120, 50], label: '10 kΩ' },
        { t: 'wire', pts: [[120, 170], [120, 200]] }, { t: 'gnd', at: [120, 200] },
        { t: 'wire', id: 'ww', pts: [[144, 110], [240, 110], [240, 130]] },
        { t: 'R', id: 'rl', a: [240, 130], b: [240, 190], label: 'RL' },
        { t: 'wire', pts: [[240, 190], [240, 200]] }, { t: 'gnd', at: [240, 200] },
        { t: 'dot', at: [200, 110] },
        { t: 'tag', id: 'tv', at: [200, 80], text: 'Vout' },
      ],
    });
    const vl = (xx) => { const Rb = xx * Rp, Rt = (1 - xx) * Rp, RL = ratio * Rp; const b = par(Rb, RL); return V * b / (Rt + b || 1e-12); };
    const p = W.plot('#f-pot', { xmin: 0, xmax: 1, ymin: 0, ymax: 5, xlabel: 'wiper position x', ylabel: 'Vout (V)', hover: true, yunit: 'V', height: 240, xfmt: (v) => v.toFixed(1) });
    p.draw((p) => {
      p.fn((xx) => V * xx, { color: 'c3', dash: [6, 4], label: 'unloaded (ideal)', hover: false });
      p.fn(vl, { color: 'c1', label: 'loaded', width: 3 });
      p.point(x, vl(x), { color: 'c4' });
    });
    const ctl = W.controls('#f-pot');
    W.slider(ctl, { label: 'wiper \\(x\\)', min: 0, max: 1, step: 0.01, value: x, format: (v) => W.fix(v, 2), onInput: (v) => { x = v; upd(); } });
    W.slider(ctl, { label: '\\(R_L / R_{pot}\\)', min: 0.1, max: 100, log: true, value: ratio, format: (v) => W.fix(v, v < 1 ? 2 : 1) + '×', onInput: (v) => { ratio = v; upd(); } });
    const ctl2 = W.controls('#f-pot');
    const rv = W.readout(ctl2, { label: '\\(V_{out}\\)', unit: 'V' });
    const re = W.readout(ctl2, { label: 'error here' });
    const rw = W.readout(ctl2, { label: 'worst error (full travel)' });
    function upd() {
      const v = vl(x);
      sch.set('rl', { label: 'RL ' + W.si(ratio * Rp, 'Ω', 2) });
      sch.set('tv', { text: 'Vout = ' + W.fix(v, 2) + ' V' });
      rv.set(v); re.set(pct((V * x - v) / V) + ' of FS');
      let worst = 0; for (let i = 0; i <= 200; i++) { const xx = i / 200; worst = Math.max(worst, V * xx - vl(xx)); }
      rw.set(pct(worst / V)); rw.setClass(worst / V < 0.025 ? 'good' : worst / V > 0.1 ? 'bad' : '');
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 2.7: Thevenin & Norton ---------------- */
  (function () {
    const Vth = 9, Rth = 5000, IN = Vth / Rth;
    let RL = 10000, view = 'o';
    const sch = W.schematic('#f-thev', {
      w: 480, h: 232, title: 'Network, Thevenin and Norton equivalents with a load',
      items: [
        // original
        { t: 'V', id: 'o1', a: [50, 90], b: [50, 150], label: '12 V' },
        { t: 'wire', id: 'o2', pts: [[50, 90], [50, 60], [80, 60]] },
        { t: 'R', id: 'o3', a: [80, 60], b: [160, 60], label: 'R1 4 kΩ' },
        { t: 'wire', id: 'o4', pts: [[160, 60], [200, 60]] },
        { t: 'R', id: 'o5', a: [200, 60], b: [280, 60], label: 'R3 2 kΩ' },
        { t: 'wire', id: 'o6', pts: [[280, 60], [300, 60]] },
        { t: 'wire', id: 'o7', pts: [[180, 60], [180, 90]] },
        { t: 'R', id: 'o8', a: [180, 90], b: [180, 150], label: 'R2 12 kΩ' },
        { t: 'wire', id: 'o9', pts: [[180, 150], [180, 180]] },
        { t: 'wire', id: 'o10', pts: [[50, 150], [50, 180], [300, 180]] },
        { t: 'dot', id: 'o11', at: [180, 60] }, { t: 'dot', id: 'o12', at: [180, 180] },
        // Thevenin
        { t: 'V', id: 't1', a: [80, 90], b: [80, 150], label: 'Vth 9 V' },
        { t: 'wire', id: 't2', pts: [[80, 90], [80, 60], [150, 60]] },
        { t: 'R', id: 't3', a: [150, 60], b: [230, 60], label: 'Rth 5 kΩ' },
        { t: 'wire', id: 't4', pts: [[230, 60], [300, 60]] },
        { t: 'wire', id: 't5', pts: [[80, 150], [80, 180], [300, 180]] },
        // Norton
        { t: 'I', id: 'n1', a: [100, 150], b: [100, 90], label: 'IN 1.8 mA', side: -1 },
        { t: 'wire', id: 'n2', pts: [[100, 90], [100, 60], [300, 60]] },
        { t: 'wire', id: 'n3', pts: [[100, 150], [100, 180], [300, 180]] },
        { t: 'wire', id: 'n4', pts: [[230, 60], [230, 90]] },
        { t: 'R', id: 'n5', a: [230, 90], b: [230, 150], label: 'RN 5 kΩ' },
        { t: 'wire', id: 'n6', pts: [[230, 150], [230, 180]] },
        { t: 'dot', id: 'n7', at: [230, 60] }, { t: 'dot', id: 'n8', at: [230, 180] },
        // terminals + load
        { t: 'dot', at: [300, 60] }, { t: 'dot', at: [300, 180] },
        { t: 'text', at: [300, 42], text: 'A' }, { t: 'text', at: [300, 202], text: 'B' },
        { t: 'wire', pts: [[300, 60], [390, 60], [390, 90]] },
        { t: 'R', id: 'rl', a: [390, 90], b: [390, 150], label: 'RL', side: -1 },
        { t: 'wire', pts: [[390, 150], [390, 180], [300, 180]] },
        { t: 'tag', id: 'tl', at: [430, 210], text: 'VL' },
      ],
    });
    const fl = sch.flow([[300, 60], [390, 60], [390, 180], [300, 180]], {});
    const groups = { o: 12, t: 5, n: 8 };
    const p = W.plot('#f-thev', { xmin: 100, xmax: 1e6, logx: true, ymin: 0, ymax: 1.05, xlabel: 'load RL (Ω)', ylabel: 'fraction of max', hover: true, xunit: 'Ω', height: 250, yfmt: (v) => v.toFixed(1) });
    p.draw((p) => {
      p.vline(Rth, { color: 'muted' });
      p.text(Rth * 1.12, 0.06, 'RL = Rth', { color: 'muted' });
      p.fn((r) => r / (r + Rth), { color: 'c1', label: 'VL / Vth', hoverFmt: (x, y) => `${W.si(x, 'Ω')}: VL = ${W.fix(y * Vth, 2)} V` });
      p.fn((r) => Rth / (r + Rth), { color: 'c2', label: 'IL / IN', hoverFmt: (x, y) => `IL = ${W.si(y * IN, 'A')}` });
      p.fn((r) => 4 * r * Rth / ((r + Rth) * (r + Rth)), { color: 'c4', label: 'PL / Pmax', width: 3, hoverFmt: (x, y) => `PL = ${W.si(y * Vth * Vth / (4 * Rth), 'W')}` });
      p.point(RL, 4 * RL * Rth / ((RL + Rth) ** 2), { color: 'c4' });
    });
    const ctl = W.controls('#f-thev');
    W.segmented(ctl, { options: [['o', 'Original network'], ['t', 'Thevenin'], ['n', 'Norton']], value: view, onChange: (v) => { view = v; upd(); } });
    W.slider(ctl, { label: '\\(R_L\\)', min: 100, max: 1e6, log: true, value: RL, unit: 'Ω', onInput: (v) => { RL = v; upd(); } });
    const ctl2 = W.controls('#f-thev');
    const rv = W.readout(ctl2, { label: '\\(V_L\\)', unit: 'V' });
    const ri = W.readout(ctl2, { label: '\\(I_L\\)', unit: 'A' });
    const rp = W.readout(ctl2, { label: '\\(P_L\\)', unit: 'W' });
    function upd() {
      for (const g in groups) for (let i = 1; i <= groups[g]; i++) showPart(sch, g + i, g === view);
      let net;
      if (view === 'o') net = [{ type: 'V', n: ['s', '0'], value: 12 }, { type: 'R', n: ['s', 'm'], value: 4000 }, { type: 'R', n: ['m', '0'], value: 12000 }, { type: 'R', n: ['m', 'a'], value: 2000 }];
      else if (view === 't') net = [{ type: 'V', n: ['s', '0'], value: Vth }, { type: 'R', n: ['s', 'a'], value: Rth }];
      else net = [{ type: 'I', n: ['0', 'a'], value: IN }, { type: 'R', n: ['a', '0'], value: Rth }];
      net.push({ name: 'RL', type: 'R', n: ['a', '0'], value: RL });
      const s = W.solveDC(net);
      const VL = s.v.a, IL = s.i.RL, PL = VL * IL;
      rv.set(VL); ri.set(IL); rp.set(PL);
      rp.setClass(Math.abs(RL - Rth) / Rth < 0.05 ? 'good' : '');
      sch.set('rl', { label: 'RL ' + W.si(RL, 'Ω', 3) });
      sch.set('tl', { text: 'VL = ' + W.fix(VL, 2) + ' V' });
      fl.set(W.clamp(IL / 0.0005, 0, 3.5));
      p.update();
      if (Math.abs(RL - Rth) / Rth < 0.05) Book.solve('thev-task');
    }
    upd();
  })();

  /* ---------------- Figure 2.8: interfaces ---------------- */
  (function () {
    const PRE = {
      reg: ['Regulator (50 mΩ) → ESP32 board (≈33 Ω)', 3.3, 0.05, 33],
      pull: ['Internal pull-up (40 kΩ) → 1 kΩ load', 3.3, 40000, 1000],
      pullc: ['Internal pull-up (40 kΩ) → CMOS input (100 MΩ)', 3.3, 40000, 1e8],
      dmm1: ['Divider, Rth 5 kΩ → DMM (10 MΩ)', 5, 5000, 1e7],
      dmm2: ['Divider, Rth 5 MΩ → DMM (10 MΩ)', 5, 5e6, 1e7],
      gen: ['Function generator (50 Ω) → scope (1 MΩ)', 1, 50, 1e6],
      hp: ['Weak DAC output (1 kΩ) → 32 Ω headphones', 1, 1000, 32],
      bat: ['9 V battery (≈1.5 Ω) → small motor (≈5 Ω)', 9, 1.5, 5],
    };
    let key = 'pull', Vs = 3.3, Zo = 40000, Zi = 1000;
    const sch = W.schematic('#f-iface', {
      w: 480, h: 206, title: 'Source with output impedance driving an input impedance',
      items: [
        { t: 'V', id: 'vs', a: [70, 85], b: [70, 145], label: 'Vs' },
        { t: 'wire', pts: [[70, 85], [70, 60], [100, 60]] },
        { t: 'R', id: 'ro', a: [100, 60], b: [180, 60], label: 'Zout' },
        { t: 'wire', pts: [[180, 60], [360, 60], [360, 85]] },
        { t: 'R', id: 'ri', a: [360, 85], b: [360, 145], label: 'Zin' },
        { t: 'wire', pts: [[360, 145], [360, 170], [70, 170], [70, 145]] },
        { t: 'text', at: [115, 192], text: 'source (Thevenin)' }, { t: 'text', at: [385, 192], text: 'next stage input' },
        { t: 'tag', id: 'tv', at: [262, 115], text: 'Vin' },
      ],
    });
    const box = (x, y, w, h) => sch.svg.insertBefore(W.svg('rect', { x, y, width: w, height: h, rx: 10, style: 'stroke: var(--muted); stroke-dasharray: 6 5; stroke-width: 1.4' }), sch.svg.firstChild.nextSibling);
    box(30, 36, 170, 142); box(322, 36, 140, 142);
    const p = W.plot('#f-iface', { xmin: 0.01, xmax: 1e5, logx: true, ymin: 0, ymax: 1.05, xlabel: 'Zin / Zout', ylabel: 'fraction of Vs arriving', hover: true, height: 230, yfmt: (v) => v.toFixed(1) });
    p.draw((p) => {
      p.area(() => 1.05, 10, 1e5, { color: 'c3', alpha: 0.12 });
      p.fn((r) => r / (1 + r), { color: 'c1', width: 3, hoverFmt: (x, y) => `Zin/Zout = ${W.tick(x)}: ${pct(y)}` });
      p.text(14, 0.12, '10× or better', { color: 'c3' });
      p.point(Zi / Zo, Zi / (Zi + Zo), { color: 'c4' });
    });
    const ctl = W.controls('#f-iface');
    const sel = W.select(ctl, { label: 'Pairing', options: [...Object.keys(PRE).map((k) => [k, PRE[k][0]]), ['custom', 'Custom']], value: key, onChange: (v) => { key = v; if (PRE[v]) { [, Vs, Zo, Zi] = PRE[v]; so.set(Zo, false); si.set(Zi, false); } upd(); } });
    void sel;
    const so = W.slider(ctl, { label: '\\(Z_{out}\\)', min: 0.01, max: 1e7, log: true, value: Zo, unit: 'Ω', onInput: (v) => { Zo = v; custom(); } });
    const si = W.slider(ctl, { label: '\\(Z_{in}\\)', min: 1, max: 1e8, log: true, value: Zi, unit: 'Ω', onInput: (v) => { Zi = v; custom(); } });
    const custom = () => { key = 'custom'; sel.el.querySelector('select').value = 'custom'; upd(); };
    const ctl2 = W.controls('#f-iface');
    const rf = W.readout(ctl2, { label: 'arrives' });
    const rv = W.readout(ctl2, { label: '\\(V_{in}\\)', unit: 'V' });
    const ri = W.readout(ctl2, { label: 'current', unit: 'A' });
    function upd() {
      const f = Zi / (Zi + Zo);
      sch.set('vs', { label: W.fix(Vs, 1) + ' V' });
      sch.set('ro', { label: 'Zout ' + W.si(Zo, 'Ω', 2) });
      sch.set('ri', { label: 'Zin ' + W.si(Zi, 'Ω', 2) });
      sch.set('tv', { text: 'Vin = ' + W.si(Vs * f, 'V', 3) });
      rf.set(pct(f)); rf.setClass(f >= 10 / 11 ? 'good' : f < 0.5 ? 'bad' : '');
      rv.set(Vs * f); ri.set(Vs / (Zi + Zo));
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 2.9: superposition ---------------- */
  (function () {
    const ts = twoSource('#f-super');
    let V1 = 9, V2 = 5, mode = 'both';
    const R2 = 2000;
    const ctl = W.controls('#f-super');
    W.segmented(ctl, { options: [['both', 'Both sources'], ['v1', 'V1 only'], ['v2', 'V2 only']], value: mode, onChange: (v) => { mode = v; upd(); } });
    W.slider(ctl, { label: '\\(V_1\\)', min: 0, max: 12, step: 0.1, value: V1, unit: 'V', onInput: (v) => { V1 = v; upd(); } });
    W.slider(ctl, { label: '\\(V_2\\)', min: 0, max: 12, step: 0.1, value: V2, unit: 'V', onInput: (v) => { V2 = v; upd(); } });
    const cells = {};
    const rows = [['Vx', 'VX (V)'], ['I1', 'I1 (mA)'], ['I2', 'I2 (mA)'], ['I3', 'I3 (mA)']];
    const cols = [['a', 'V1 only'], ['b', 'V2 only'], ['s', 'sum'], ['f', 'both active']];
    const tbl = W.h('table', { class: 'ch2-table' }, W.h('tr', {}, W.h('th', {}, ''), ...cols.map(([, t]) => W.h('th', { class: 'num' }, t))));
    for (const [k, t] of rows) {
      const tr = W.h('tr', {}, W.h('td', {}, t));
      for (const [c] of cols) { const td = W.h('td', { class: 'num' }, '—'); cells[k + c] = td; tr.append(td); }
      tbl.append(tr);
    }
    W.$('#f-super').append(tbl);
    function solve(on1, on2) {
      const s = W.solveDC([
        { name: 'V1', type: 'V', n: ['a', '0'], value: on1 ? V1 : 0 }, { name: 'R1', type: 'R', n: ['a', 'x'], value: 1000 },
        { name: 'R2', type: 'R', n: ['x', '0'], value: R2 }, { name: 'R3', type: 'R', n: ['b', 'x'], value: 1000 },
        { name: 'V2', type: 'V', n: ['b', '0'], value: on2 ? V2 : 0 }]);
      return { Vx: s.v.x, I1: s.i.R1 * 1000, I2: s.i.R2 * 1000, I3: s.i.R3 * 1000 };
    }
    function upd() {
      ts.show(V1, V2, R2, mode !== 'v2', mode !== 'v1');
      const a = solve(true, false), b = solve(false, true), f = solve(true, true);
      for (const [k] of rows) {
        const f2 = (x) => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2);
        cells[k + 'a'].textContent = f2(a[k]); cells[k + 'b'].textContent = f2(b[k]);
        cells[k + 's'].textContent = f2(a[k] + b[k]); cells[k + 'f'].textContent = f2(f[k]);
        const hi = mode === 'v1' ? 'a' : mode === 'v2' ? 'b' : 'f';
        for (const c of 'absf') cells[k + c].style.fontWeight = c === hi ? '700' : '';
      }
    }
    upd();
  })();

  /* ---------------- Figure 2.10: nodal matrix ---------------- */
  (function () {
    let V1 = 5, Is = 0.001, R = [1000, 2000, 1000, 2000];
    let prev = null;
    const sch = W.schematic('#f-nodal', {
      w: 540, h: 232, title: 'Circuit for nodal analysis',
      items: [
        { t: 'V', id: 'v1', a: [50, 90], b: [50, 160], label: '5 V' },
        { t: 'wire', pts: [[50, 90], [50, 50], [80, 50]] },
        { t: 'R', id: 'r1', a: [80, 50], b: [160, 50], label: 'R1' },
        { t: 'wire', pts: [[160, 50], [240, 50]] },
        { t: 'wire', pts: [[200, 50], [200, 90]] },
        { t: 'R', id: 'r2', a: [200, 90], b: [200, 160], label: 'R2' },
        { t: 'R', id: 'r3', a: [240, 50], b: [320, 50], label: 'R3' },
        { t: 'wire', pts: [[320, 50], [440, 50], [440, 90]] },
        { t: 'wire', pts: [[360, 50], [360, 90]] },
        { t: 'R', id: 'r4', a: [360, 90], b: [360, 160], label: 'R4', side: -1 },
        { t: 'I', id: 'is', a: [440, 160], b: [440, 90], label: 'Is', side: -1 },
        { t: 'wire', pts: [[50, 160], [50, 195], [440, 195], [440, 160]] },
        { t: 'wire', pts: [[200, 160], [200, 195]] }, { t: 'wire', pts: [[360, 160], [360, 195]] },
        { t: 'dot', at: [200, 50] }, { t: 'dot', at: [360, 50] }, { t: 'dot', at: [200, 195] }, { t: 'dot', at: [360, 195] },
        { t: 'gnd', at: [120, 195] },
        { t: 'tag', id: 'n1', at: [200, 22], text: 'v1' }, { t: 'tag', id: 'n2', at: [360, 22], text: 'v2' },
      ],
    });
    const mat = W.h('div', { class: 'ch2-mat' });
    W.$('#f-nodal').append(mat);
    const ctl = W.controls('#f-nodal');
    W.slider(ctl, { label: '\\(V_1\\)', min: 0, max: 12, step: 0.1, value: V1, unit: 'V', onInput: (v) => { V1 = v; upd(); } });
    W.slider(ctl, { label: '\\(I_s\\)', min: -2e-3, max: 2e-3, step: 1e-5, value: Is, unit: 'A', onInput: (v) => { Is = v; upd(); } });
    for (let k = 0; k < 4; k++) W.slider(ctl, { label: `\\(R_${k + 1}\\)`, min: 100, max: 100000, log: true, value: R[k], unit: 'Ω', onInput: (v) => { R[k] = v; upd(); } });
    const ctl2 = W.controls('#f-nodal');
    const rchk = W.readout(ctl2, { label: 'W.solveDC says' });
    const f2 = (x) => { const a = Math.abs(x); return a >= 100 ? x.toFixed(0) : a >= 10 ? x.toFixed(1) : a >= 1 ? x.toFixed(2) : x.toFixed(3); };
    function upd() {
      const G = R.map((r) => 1000 / r); // mS
      const a = G[0] + G[1] + G[2], b = -G[2], d = G[2] + G[3];
      const e = V1 * G[0], f = Is * 1000; // mA
      const det = a * d - b * b;
      const v1 = (e * d - b * f) / det, v2 = (a * f - b * e) / det;
      const vals = [a, b, d, e, f].map(f2);
      const box = (i) => (prev && prev[i] !== vals[i] ? `\\boxed{${vals[i]}}` : vals[i]);
      W.tex(mat, `\\underbrace{\\begin{pmatrix} ${box(0)} & ${box(1)} \\\\ ${box(1)} & ${box(2)} \\end{pmatrix}}_{\\mathbf{G}\\ (\\text{mS})}` +
        `\\begin{pmatrix} v_1 \\\\ v_2 \\end{pmatrix} = \\underbrace{\\begin{pmatrix} ${box(3)} \\\\ ${box(4)} \\end{pmatrix}}_{\\mathbf{i}\\ (\\text{mA})}` +
        `\\;\\Rightarrow\\; \\begin{pmatrix} v_1 \\\\ v_2 \\end{pmatrix} = \\begin{pmatrix} ${v1.toFixed(3)} \\\\ ${v2.toFixed(3)} \\end{pmatrix}\\text{ V}`, true);
      prev = vals;
      const s = W.solveDC([
        { type: 'V', n: ['s', '0'], value: V1 }, { type: 'R', n: ['s', 'n1'], value: R[0] }, { type: 'R', n: ['n1', '0'], value: R[1] },
        { type: 'R', n: ['n1', 'n2'], value: R[2] }, { type: 'R', n: ['n2', '0'], value: R[3] }, { type: 'I', n: ['0', 'n2'], value: Is }]);
      rchk.set(`v1 = ${s.v.n1.toFixed(3)} V, v2 = ${s.v.n2.toFixed(3)} V`);
      sch.set('v1', { label: W.fix(V1, 1) + ' V' });
      sch.set('is', { label: 'Is ' + W.si(Is, 'A', 2) });
      R.forEach((r, k) => sch.set('r' + (k + 1), { label: `R${k + 1} ` + W.si(r, 'Ω', 2) }));
      sch.set('n1', { text: 'v1 = ' + W.fix(v1, 2) + ' V' }); sch.set('n2', { text: 'v2 = ' + W.fix(v2, 2) + ' V' });
    }
    upd();
  })();

  /* ---------------- Figure 2.11: power & derating ---------------- */
  (function () {
    const PK = { '0402': [0.063, 50], '0603': [0.1, 75], '0805': [0.125, 150], '1206': [0.25, 200], '2512': [1, 200], tht: [0.25, 250] };
    let V = 5, R = 1000, pk = '0603', T = 25;
    const der = (Pr, t) => (t <= 70 ? Pr : t >= 155 ? 0 : Pr * (155 - t) / 85);
    const p = W.plot('#f-power', { xmin: 0, xmax: 160, ymin: 0, ymax: 0.12, xlabel: 'ambient temperature (°C)', ylabel: 'power', hover: true, xunit: '°C', yunit: 'W', height: 250, yfmt: (v) => W.si(v, 'W') });
    p.draw((p) => {
      const Pr = PK[pk][0];
      p.area((t) => der(Pr, t) * 0.5, 0, 155, { color: 'c3', alpha: 0.16 });
      p.fn((t) => der(Pr, t), { color: 'c1', width: 3, label: 'max allowed (derated)' });
      p.fn((t) => der(Pr, t) * 0.5, { color: 'c3', dash: [5, 4], label: '50 % design margin', hover: false });
      const P = V * V / R;
      p.point(T, P, { color: P > der(Pr, T) ? 'c4' : 'c2', label: W.si(P, 'W') });
    });
    const ctl = W.controls('#f-power');
    W.select(ctl, { label: 'Package', options: [['0402', '0402 (1/16 W)'], ['0603', '0603 (1/10 W)'], ['0805', '0805 (1/8 W)'], ['1206', '1206 (1/4 W)'], ['2512', '2512 (1 W)'], ['tht', 'THT 1/4 W']], value: pk, onChange: (v) => { pk = v; upd(); } });
    W.slider(ctl, { label: 'Voltage \\(V\\)', min: 0.1, max: 60, log: true, value: V, unit: 'V', onInput: (v) => { V = v; upd(); } });
    W.slider(ctl, { label: 'Resistance \\(R\\)', min: 1, max: 1e7, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.slider(ctl, { label: 'Ambient', min: 0, max: 150, step: 1, value: T, format: (v) => v.toFixed(0) + ' °C', onInput: (v) => { T = v; upd(); } });
    const ctl2 = W.controls('#f-power');
    const rP = W.readout(ctl2, { label: '\\(P = V^2/R\\)', unit: 'W' });
    const rA = W.readout(ctl2, { label: 'allowed here', unit: 'W' });
    const rU = W.readout(ctl2, { label: 'utilisation' });
    const rV = W.readout(ctl2, { label: 'voltage' });
    function upd() {
      const [Pr, Vmax] = PK[pk], P = V * V / R, A = der(Pr, T), u = A > 0 ? P / A : Infinity;
      p.set({ ymax: Math.max(Pr, Math.min(P, 4 * Pr)) * 1.15 });
      rP.set(P); rA.set(A);
      rU.set(isFinite(u) ? W.fix(100 * u, 0) + ' %' : '∞'); rU.setClass(u <= 0.5 ? 'good' : u <= 1 ? '' : 'bad');
      rV.set(W.fix(V, 1) + ' / ' + Vmax + ' V max'); rV.setClass(V > Vmax ? 'bad' : '');
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 2.12: E-series picker ---------------- */
  (function () {
    const E6 = [10, 15, 22, 33, 47, 68];
    const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
    const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
    const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976].map((x) => x / 10);
    const SER = { E6, E12, E24, E96 };
    const all = (ser, lo, hi) => { const out = []; for (let d = 1e-1; d <= 1e7; d *= 10) for (const m of ser) { const v = +(m * d).toPrecision(4); if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); } return out; };
    const host = W.$('#f-eseries');
    const wrap = W.h('div', { class: 'ch2-es' });
    host.append(wrap);
    let series = 'E24', target = 5300;
    const inT = W.h('input', { type: 'text', value: '5.3k', 'aria-label': 'target resistance' });
    const near = W.h('div', { class: 'ch2-chips' });
    wrap.append(W.h('div', { class: 'row' }, W.h('b', {}, 'Nearest value to'), inT, W.h('span', {}, 'Ω')), near);
    let cv = null;
    cv = W.canvas(wrap, { height: 74, onResize: () => { if (cv) drawRuler(); } });
    const segRow = W.h('div', { class: 'row' });
    wrap.append(segRow);
    W.segmented(segRow, { options: [['E6', 'E6'], ['E12', 'E12'], ['E24', 'E24'], ['E96', 'E96']], value: series, onChange: (v) => { series = v; calc(); } });
    segRow.append(W.h('span', { class: 'ch2-note' }, 'series used for the ruler and the ratio finder'));
    const inR = W.h('input', { type: 'text', value: '0.3333', 'aria-label': 'target ratio' });
    const inVi = W.h('input', { type: 'text', value: '', placeholder: 'Vin', 'aria-label': 'Vin' });
    const inVo = W.h('input', { type: 'text', value: '', placeholder: 'Vout', 'aria-label': 'Vout' });
    const pairs = W.h('div', { class: 'ch2-chips' });
    wrap.append(W.h('div', { class: 'row' }, W.h('b', {}, 'Divider ratio'), inR, W.h('span', {}, 'or'), inVi, W.h('span', {}, '→'), inVo), pairs);
    const nearest = (ser, x) => { const c = all(ser, x / 1.5, x * 1.5); let lo = null, hi = null; for (const v of c) { if (v <= x * 1.0000001) lo = v; if (v >= x * 0.9999999 && hi == null) hi = v; } return [lo, hi]; };
    function drawRuler() {
      if (!cv) return;
      const { ctx, w, h } = cv; if (!w) return;
      ctx.clearRect(0, 0, w, h);
      const L = 14, Rr = w - 14, X = (m) => L + (Rr - L) * Math.log10(m / 10);
      ctx.strokeStyle = W.col('muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, 40); ctx.lineTo(Rr, 40); ctx.stroke();
      ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = W.col('ink');
      const ser = SER[series];
      ser.forEach((m, i) => {
        const x = X(m); ctx.strokeStyle = W.col('c1'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 50); ctx.stroke();
        if (series !== 'E96' || i % 4 === 0) ctx.fillText(series === 'E96' ? m.toFixed(2) : (m / 10).toFixed(1), x, 64);
      });
      const tm = target / Math.pow(10, Math.floor(Math.log10(target))) * 10;
      const xt = X(tm);
      ctx.fillStyle = W.col('c4'); ctx.beginPath(); ctx.moveTo(xt, 28); ctx.lineTo(xt - 6, 16); ctx.lineTo(xt + 6, 16); ctx.closePath(); ctx.fill();
      ctx.fillText('target', W.clamp(xt, 24, w - 24), 10);
    }
    function calc() {
      const t = W.parseSI(inT.value);
      near.innerHTML = '';
      if (isFinite(t) && t > 0) {
        target = t;
        for (const k of ['E6', 'E12', 'E24', 'E96']) {
          const [lo, hi] = nearest(SER[k], t);
          const opts = [lo, hi].filter((v) => v != null);
          const best = opts.reduce((a, b) => (Math.abs(Math.log(b / t)) < Math.abs(Math.log(a / t)) ? b : a));
          const txt = `${k}: ` + [...new Set(opts)].map((v) => `${W.si(v, 'Ω', 3)} (${(100 * (v - t) / t >= 0 ? '+' : '') + (100 * (v - t) / t).toFixed(1)} %)`).join(' · ');
          near.append(W.h('span', { class: k === series ? 'best' : '' }, txt + (opts.length > 1 ? '  ✓ ' + W.si(best, 'Ω', 3) : '')));
        }
      }
      drawRuler();
      // ratio finder
      let r = W.parseSI(inR.value);
      const vi = W.parseSI(inVi.value), vo = W.parseSI(inVo.value);
      if (isFinite(vi) && isFinite(vo) && vi > 0 && vo > 0 && vo < vi) { r = vo / vi; inR.value = r.toFixed(4); }
      pairs.innerHTML = '';
      if (!(r > 0 && r < 1)) { pairs.append(W.h('span', {}, 'enter a ratio between 0 and 1')); return; }
      const R2s = all(SER[series], 10000, 99999), R1s = all(SER[series], 100, 1e7);
      const res = [];
      for (const b of R2s) for (const a of R1s) { const k = b / (a + b); res.push([Math.abs(k - r) / r, a, b, k]); }
      res.sort((x, y) => x[0] - y[0]);
      res.slice(0, 5).forEach(([e, a, b, k], i) => pairs.append(W.h('span', { class: i === 0 ? 'best' : '' }, `R1 ${W.si(a, 'Ω', 3)} / R2 ${W.si(b, 'Ω', 3)} → ${k.toFixed(4)} (${(100 * (k - r) / r).toFixed(2)} %)`)));
    }
    for (const el of [inT, inR]) el.addEventListener('input', calc);
    for (const el of [inVi, inVo]) el.addEventListener('input', calc);
    inR.addEventListener('input', () => { inVi.value = ''; inVo.value = ''; });
    document.addEventListener('themechange', drawRuler);
    calc();
  })();

  /* ---------------- Figure 2.13: Monte Carlo tolerance ---------------- */
  (function () {
    const R1 = 220000, R2 = 100000, k0 = R2 / (R1 + R2), N = 5000, NB = 41;
    let tol = 0.05, hist = [], stats = {};
    const wc = (t) => [R2 * (1 - t) / (R1 * (1 + t) + R2 * (1 - t)), R2 * (1 + t) / (R1 * (1 - t) + R2 * (1 + t))];
    const p = W.plot('#f-mc', { xmin: 0.27, xmax: 0.355, ymin: 0, ymax: 400, xlabel: 'divider ratio R2/(R1+R2)', ylabel: 'boards', height: 250, xfmt: (v) => v.toFixed(3), yfmt: (v) => v.toFixed(0) });
    function roll() {
      const [lo, hi] = wc(tol), span = (hi - lo) * 1.15, x0 = k0 - span / 2, bw = span / NB;
      hist = new Array(NB).fill(0);
      let s = 0, s2 = 0, mn = 1, mx = 0, out = 0;
      for (let i = 0; i < N; i++) {
        const a = R1 * (1 + tol * (2 * Math.random() - 1)), b = R2 * (1 + tol * (2 * Math.random() - 1)), k = b / (a + b);
        s += k; s2 += k * k; mn = Math.min(mn, k); mx = Math.max(mx, k);
        if (Math.abs(k - k0) / k0 > 0.02) out++;
        const j = Math.floor((k - x0) / bw); if (j >= 0 && j < NB) hist[j]++;
      }
      const m = s / N;
      stats = { m, sd: Math.sqrt(s2 / N - m * m), mn, mx, out, x0, bw, lo, hi };
      p.set({ xmin: x0, xmax: x0 + span, ymax: Math.max(...hist) * 1.15 });
      p.update();
      rm.set(m.toFixed(4)); rs.set(pct(stats.sd / k0, 2)); rr.set(`${mn.toFixed(4)} … ${mx.toFixed(4)}`);
      ro.set(pct(out / N, 1));
    }
    p.draw((p) => {
      if (!hist.length) return;
      const { x0, bw, lo, hi } = stats;
      hist.forEach((c, j) => { if (c) p.line([[x0 + j * bw, 0], [x0 + j * bw, c], [x0 + (j + 1) * bw, c], [x0 + (j + 1) * bw, 0]], { color: 'c1', fill: true, alpha: 0.55 }); });
      p.vline(lo, { color: 'c4', label: 'worst case' }); p.vline(hi, { color: 'c4' });
      p.vline(k0, { color: 'c3', label: 'nominal 0.3125' });
    });
    const ctl = W.controls('#f-mc');
    W.segmented(ctl, { options: [[0.01, '±1 %'], [0.05, '±5 %'], [0.1, '±10 %']], value: tol, onChange: (v) => { tol = v; roll(); } });
    W.button(ctl, '🎲 Roll 5000 boards', roll);
    const ctl2 = W.controls('#f-mc');
    const rm = W.readout(ctl2, { label: 'mean' });
    const rs = W.readout(ctl2, { label: 'std. dev.' });
    const rr = W.readout(ctl2, { label: 'range' });
    const ro = W.readout(ctl2, { label: 'boards off by > 2 %' });
    roll();
  })();

  /* ---------------- Figure 2.14: Wheatstone bridge ---------------- */
  (function () {
    const R = 350, Vx = 5;
    let d = 0.002, half = false;
    const sch = W.schematic('#f-bridge', {
      w: 460, h: 262, title: 'Wheatstone bridge with a strain gauge',
      items: [
        { t: 'V', a: [50, 100], b: [50, 170], label: '5 V' },
        { t: 'wire', pts: [[50, 100], [50, 40], [200, 40]] },
        { t: 'R', id: 'r1', a: [200, 40], b: [120, 130], label: 'R1 350 Ω', side: -1 },
        { t: 'R', id: 'r2', a: [120, 130], b: [200, 220], label: 'R2 350 Ω', side: -1 },
        { t: 'R', id: 'r3', a: [200, 40], b: [280, 130], label: 'R3 350 Ω' },
        { t: 'R', id: 'rx', a: [280, 130], b: [200, 220], label: 'gauge' },
        { t: 'wire', pts: [[200, 220], [200, 240], [50, 240], [50, 170]] },
        { t: 'wire', pts: [[120, 130], [175, 130]] }, { t: 'wire', pts: [[225, 130], [280, 130]] },
        { t: 'Vm', a: [175, 130], b: [225, 130] },
        { t: 'dot', at: [200, 40] }, { t: 'dot', at: [120, 130] }, { t: 'dot', at: [280, 130] }, { t: 'dot', at: [200, 220] },
        { t: 'tag', id: 'tv', at: [200, 160], text: 'Vout' },
        { t: 'gnd', at: [120, 240] },
      ],
    });
    const out = (dd) => (half ? Vx * ((1 + dd) / 2 - 0.5) : Vx * ((1 + dd) / (2 + dd) - 0.5));
    const p = W.plot('#f-bridge', { xmin: -1, xmax: 1, ymin: -25, ymax: 25, xlabel: 'ΔR/R (%)', ylabel: 'Vout (mV)', hover: true, height: 240, xfmt: (v) => W.fix(v, 2) });
    p.draw((p) => {
      p.fn((x) => (half ? 2 : 1) * Vx * (x / 100) / 4 * 1000, { color: 'c3', dash: [6, 4], label: half ? 'Vexc·δ/2' : 'Vexc·δ/4 (linear)', hover: false });
      p.fn((x) => out(x / 100) * 1000, { color: 'c1', width: 3, label: 'exact bridge output', hoverFmt: (x, y) => `${W.fix(x, 2)} %: ${W.fix(y, 3)} mV` });
      p.point(d * 100, out(d) * 1000, { color: 'c4' });
    });
    const ctl = W.controls('#f-bridge');
    W.slider(ctl, { label: 'strain \\(\\Delta R/R\\)', min: -0.01, max: 0.01, step: 0.0001, value: d, format: (v) => (v >= 0 ? '+' : '') + (100 * v).toFixed(2) + ' %', onInput: (v) => { d = v; upd(); } });
    W.toggle(ctl, { label: 'half bridge (R3 is an opposite gauge)', value: half, onChange: (v) => { half = v; p.set({ ymin: v ? -50 : -25, ymax: v ? 50 : 25 }); upd(); } });
    const ctl2 = W.controls('#f-bridge');
    const rb = W.readout(ctl2, { label: 'bridge output' });
    const rd = W.readout(ctl2, { label: 'plain divider output' });
    const rg = W.readout(ctl2, { label: 'gauge' });
    function upd() {
      const Rx = R * (1 + d), R3 = half ? R * (1 - d) : R;
      const s = W.solveDC([
        { type: 'V', n: ['t', '0'], value: Vx }, { type: 'R', n: ['t', 'l'], value: R }, { type: 'R', n: ['l', '0'], value: R },
        { type: 'R', n: ['t', 'r'], value: R3 }, { type: 'R', n: ['r', '0'], value: Rx }]);
      const vo = s.v.r - s.v.l;
      rb.set(W.fix(vo * 1000, 3) + ' mV'); rd.set(W.fix(s.v.r, 4) + ' V'); rg.set(W.fix(Rx, 2) + ' Ω');
      sch.set('rx', { label: 'gauge ' + W.fix(Rx, 1) + ' Ω' });
      sch.set('r3', { label: half ? 'gauge ' + W.fix(R3, 1) + ' Ω' : 'R3 350 Ω' });
      sch.set('tv', { text: W.fix(vo * 1000, 2) + ' mV' });
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 2.15: meter loading & burden ---------------- */
  (function () {
    const host = W.$('#f-meter');
    const ctl0 = W.controls(host);
    const dv = W.h('div'), da = W.h('div', { class: 'ch2-hidden' });
    host.append(dv, da);
    W.segmented(ctl0, { options: [['v', 'Voltmeter loading'], ['a', 'Ammeter burden']], value: 'v', onChange: (m) => { dv.classList.toggle('ch2-hidden', m !== 'v'); da.classList.toggle('ch2-hidden', m !== 'a'); } });
    // voltmeter
    let R = 1e6, Rm = 1e7;
    const sv = W.schematic(dv, {
      w: 420, h: 236, title: 'Voltmeter measuring a divider midpoint',
      items: [
        { t: 'V', a: [50, 90], b: [50, 170], label: '10 V' },
        { t: 'wire', pts: [[50, 90], [50, 40], [160, 40]] },
        { t: 'R', id: 'r1', a: [160, 40], b: [160, 100], label: 'R' },
        { t: 'wire', pts: [[160, 100], [160, 120]] },
        { t: 'R', id: 'r2', a: [160, 120], b: [160, 180], label: 'R' },
        { t: 'wire', pts: [[160, 180], [160, 210], [50, 210], [50, 170]] },
        { t: 'wire', pts: [[160, 110], [280, 110], [280, 130]] }, { t: 'dot', at: [160, 110] },
        { t: 'Vm', id: 'm', a: [280, 130], b: [280, 180], label: 'meter' },
        { t: 'wire', pts: [[280, 180], [280, 210], [160, 210]] }, { t: 'dot', at: [160, 210] },
        { t: 'tag', id: 'tm', at: [355, 110], text: 'reads' },
        { t: 'gnd', at: [100, 210] },
      ],
    });
    const cv1 = W.controls(dv);
    W.select(cv1, { label: 'Meter', options: [['1e7', 'DMM, 10 MΩ'], ['1e6', 'Scope, 1 MΩ (×1 probe)'], ['2e5', 'Analog 20 kΩ/V, 10 V range'], ['1e9', 'Electrometer, 1 GΩ']], value: '1e7', onChange: (v) => { Rm = +v; updV(); } });
    W.slider(cv1, { label: 'each \\(R\\)', min: 1000, max: 1e8, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; updV(); } });
    const cv2 = W.controls(dv);
    const rt = W.readout(cv2, { label: 'true', unit: 'V' });
    const rr = W.readout(cv2, { label: 'meter reads', unit: 'V' });
    const re = W.readout(cv2, { label: 'error' });
    function updV() {
      const vr = 10 * par(R, Rm) / (R + par(R, Rm));
      sv.set('r1', { label: 'R ' + W.si(R, 'Ω', 3) }); sv.set('r2', { label: 'R ' + W.si(R, 'Ω', 3) });
      sv.set('m', { label: W.si(Rm, 'Ω', 2) });
      sv.set('tm', { text: 'reads ' + W.fix(vr, 3) + ' V' });
      rt.set(5); rr.set(vr); const e = (vr - 5) / 5; re.set(pct(e)); re.setClass(Math.abs(e) < 0.01 ? 'good' : Math.abs(e) > 0.1 ? 'bad' : '');
      if (Rm === 1e7 && e < -0.1) Book.solve('meter-task');
    }
    updV();
    // ammeter
    const RNG = { ua: [100, 0.006, 'µA'], ma: [2, 0.6, 'mA'], a: [0.01, 10, '10 A'] };
    let rng = 'ma', RL = 330;
    const sa = W.schematic(da, {
      w: 420, h: 236, title: 'Ammeter in series with a load',
      items: [
        { t: 'V', a: [50, 90], b: [50, 170], label: '3.3 V' },
        { t: 'wire', pts: [[50, 90], [50, 40], [120, 40]] },
        { t: 'A', id: 'm', a: [120, 40], b: [190, 40], label: 'meter' },
        { t: 'wire', pts: [[190, 40], [280, 40], [280, 90]] },
        { t: 'R', id: 'rl', a: [280, 90], b: [280, 170], label: 'load' },
        { t: 'wire', pts: [[280, 170], [280, 210], [50, 210], [50, 170]] },
        { t: 'tag', id: 'tb', at: [155, 90], text: 'burden' },
        { t: 'tag', id: 'tl', at: [355, 130], text: 'V load' },
        { t: 'gnd', at: [160, 210] },
      ],
    });
    const fa = sa.flow([[50, 170], [50, 40], [280, 40], [280, 210], [50, 210], [50, 170]], {});
    const ca1 = W.controls(da);
    W.segmented(ca1, { options: [['ua', 'µA range (≈100 Ω)'], ['ma', 'mA range (≈2 Ω)'], ['a', '10 A range (0.01 Ω)']], value: rng, onChange: (v) => { rng = v; updA(); } });
    W.slider(ca1, { label: 'load \\(R\\)', min: 3.3, max: 1e6, log: true, value: RL, unit: 'Ω', onInput: (v) => { RL = v; updA(); } });
    const ca2 = W.controls(da);
    const rtrue = W.readout(ca2, { label: 'without meter', unit: 'A' });
    const rread = W.readout(ca2, { label: 'meter shows' });
    const rbur = W.readout(ca2, { label: 'burden', unit: 'V' });
    const rvl = W.readout(ca2, { label: 'load gets', unit: 'V' });
    function updA() {
      const [Rs, Imax, nm] = RNG[rng];
      const I0 = 3.3 / RL, I = 3.3 / (RL + Rs), Vb = I * Rs;
      sa.set('rl', { label: 'load ' + W.si(RL, 'Ω', 3) });
      sa.set('m', { label: nm + ' range' });
      sa.set('tb', { text: 'burden ' + W.si(Vb, 'V', 3) });
      sa.set('tl', { text: W.fix(3.3 - Vb, 3) + ' V' });
      rtrue.set(I0);
      const ol = I > Imax;
      rread.set(ol ? 'OL (over range)' : W.si(I, 'A', 4)); rread.setClass(ol ? 'bad' : '');
      rbur.set(Vb); rbur.setClass(Vb > 0.1 ? 'bad' : Vb < 0.01 ? 'good' : '');
      rvl.set(3.3 - Vb);
      fa.set(W.clamp(Math.log10(I / 1e-6) / 2, 0.2, 3));
    }
    updA();
  })();
})();
