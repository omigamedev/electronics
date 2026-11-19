/* Chapter 5 widgets: batteries, regulators, budgets, brown-outs, protection, level shifting */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const font = (px, w) => `${w || ''} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  /** piecewise-linear interpolation in a table [[x,y],...] sorted by x */
  const interp = (tab, x) => {
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return tab[tab.length - 1][1];
  };
  // open-circuit voltage vs state of charge (0..1) per cell
  const OCV = {
    li: [[0, 3.0], [0.02, 3.4], [0.05, 3.55], [0.1, 3.68], [0.2, 3.73], [0.3, 3.77], [0.4, 3.80], [0.5, 3.84], [0.6, 3.87], [0.7, 3.95], [0.8, 4.02], [0.9, 4.11], [0.95, 4.15], [1, 4.2]],
    lfp: [[0, 2.5], [0.02, 2.8], [0.05, 3.0], [0.1, 3.15], [0.2, 3.22], [0.3, 3.25], [0.5, 3.28], [0.7, 3.30], [0.9, 3.33], [0.95, 3.35], [1, 3.45]],
    nimh: [[0, 0.9], [0.02, 1.02], [0.05, 1.08], [0.1, 1.15], [0.2, 1.19], [0.3, 1.21], [0.5, 1.24], [0.7, 1.26], [0.9, 1.30], [0.95, 1.35], [1, 1.42]],
    alk: [[0, 0.85], [0.05, 1.0], [0.1, 1.05], [0.2, 1.12], [0.3, 1.17], [0.5, 1.25], [0.7, 1.33], [0.9, 1.45], [1, 1.58]],
  };

  /* =====================================================================
   * Figure 5.1 — discharge curves
   * ===================================================================== */
  (function discharge() {
    const host = W.$('#w-dis');
    if (!host) return;
    const CH = {
      li: { name: 'LiPo / Li-ion', R: 0.025, cut: 3.0, y: [2.6, 4.35], cap: 2.0 },
      lfp: { name: 'LiFePO₄', R: 0.025, cut: 2.5, y: [2.2, 3.7], cap: 2.0 },
      nimh: { name: 'NiMH (AA)', R: 0.03, cut: 1.0, y: [0.7, 1.6], cap: 2.0 },
      alk: { name: 'Alkaline (AA)', R: 0.15, cut: 0.9, y: [0.6, 1.7], cap: 2.0, peukert: true },
    };
    let ch = 'li', C = 1;
    const p = W.plot(host, { xmin: 0, xmax: 100, ymin: 2.6, ymax: 4.35, xlabel: 'capacity delivered (% of rated)', ylabel: 'cell voltage (V)', hover: true, xunit: '%', yunit: 'V', height: 290, xfmt: (v) => v + '%' });
    const ctl = W.controls(host);
    W.select(ctl, { label: 'Chemistry', value: ch, options: Object.keys(CH).map((k) => [k, CH[k].name]), onChange: (v) => { ch = v; upd(); } });
    W.slider(ctl, { label: 'Discharge rate', min: 0.1, max: 10, log: true, value: C, format: (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' C', onInput: (v) => { C = v; upd(); } });
    const rU = W.readout(ctl, { label: 'usable to cut-off', fmt: (v) => v.toFixed(0) + ' %' });
    const rE = W.readout(ctl, { label: 'energy (2 Ah cell)', unit: 'Wh' });
    const rH = W.readout(ctl, { label: 'heat in cell', unit: 'W' });
    function model() {
      const c = CH[ch], I = C * c.cap, k = c.peukert ? 1 / (1 + 0.6 * C) : 1;
      const R = (soc) => c.R * (1 + 2 * Math.pow(1 - soc, 4));
      const V = (x) => { const soc = 1 - x / 100 / k; if (soc < 0) return NaN; return interp(OCV[ch], soc) - I * R(soc); };
      return { c, I, k, V, R };
    }
    function upd() {
      const m = model();
      p.set({ ymin: m.c.y[0], ymax: m.c.y[1] });
      let usable = 0, E = 0;
      for (let x = 0; x <= 100; x += 0.1) { const v = m.V(x); if (!(v >= m.c.cut)) break; usable = x; E += v * m.I * (0.001 * m.c.cap / m.I) * 1; }
      // E: sum of V * dQ with dQ = 0.1% of capacity
      E = 0; for (let x = 0; x < usable; x += 0.1) E += m.V(x) * m.c.cap * 0.001;
      p.draw((p) => {
        p.hline(m.c.cut, { color: 'c4' });
        p.text(99, m.c.cut + (m.c.y[1] - m.c.y[0]) * 0.035, 'cut-off', { align: 'right', color: 'c4', size: 11 });
        p.fn((x) => interp(OCV[ch], 1 - x / 100), { color: 'muted', dash: [5, 4], width: 1.5, label: 'open-circuit voltage', hover: false });
        p.fn((x) => { const v = m.V(x); return v >= m.c.cut - 0.4 ? v : NaN; }, { color: 'c1', width: 3, label: `under load (${C < 1 ? C.toFixed(2) : C.toFixed(1)} C = ${W.si(m.I, 'A', 2)})` });
        if (usable > 0) p.point(usable, m.c.cut, { color: 'c4', r: 5 });
      });
      rU.set(usable); rE.set(E);
      rH.set(m.I * m.I * m.R(0.5));
    }
    upd();
  })();

  /* =====================================================================
   * Figure 5.2 — internal resistance and sag
   * ===================================================================== */
  (function sag() {
    const host = W.$('#w-sag');
    if (!host) return;
    const PACKS = {
      cheap: { name: '2S 1000 mAh "25C" (2 × 50 mΩ)', Rc: 0.05 },
      good: { name: '2S 2200 mAh 40C (2 × 15 mΩ)', Rc: 0.015 },
      aged: { name: '2S, 300 cycles old (2 × 80 mΩ)', Rc: 0.08 },
    };
    const Rw = 0.01;
    let pk = 'cheap', soc = 0.8, I = 5;
    const sch = W.schematic(host, { w: 460, h: 230, title: 'Battery model: ideal source plus internal resistance', items: [
      { t: 'text', at: [105, 22], text: 'inside the pack', cls: 'pin' },
      { t: 'Vdc', id: 'ocv', a: [80, 80], b: [80, 160], label: 'OCV', side: -1 },
      { t: 'wire', pts: [[80, 80], [80, 50], [110, 50]] },
      { t: 'R', id: 'ri', a: [110, 50], b: [170, 50], label: 'R_int' },
      { t: 'wire', pts: [[170, 50], [230, 50]] },
      { t: 'R', id: 'rw', a: [230, 50], b: [290, 50], label: 'wires 10 mΩ' },
      { t: 'wire', pts: [[290, 50], [360, 50], [360, 85]] },
      { t: 'M', id: 'm', a: [360, 85], b: [360, 155], label: 'load' },
      { t: 'wire', pts: [[360, 155], [360, 190], [80, 190], [80, 160]] },
      { t: 'dot', at: [200, 50] }, { t: 'dot', at: [200, 190] },
      { t: 'text', at: [200, 120], text: 'terminals', cls: 'pin' },
      { t: 'wire', id: 'box', pts: [[40, 30], [200, 30], [200, 210], [40, 210], [40, 30]], cls: 'gndw' },
      { t: 'tag', id: 'tv', at: [290, 120], text: 'V' },
    ] });
    sch.set('box', { stroke: 'muted' }); sch.parts.box.g.style.strokeDasharray = '5 5';
    const fl = sch.flow([[80, 80], [80, 50], [360, 50], [360, 190], [80, 190], [80, 160]], { speed: 0 });
    const bar = W.h('div', { style: 'position:relative;height:30px;border-radius:8px;background:var(--surface2);margin:8px 0;overflow:hidden' });
    const fill = W.h('div', { style: 'position:absolute;left:0;top:0;bottom:0;background:var(--c3);opacity:.75;transition:width .15s' });
    const mark = W.h('div', { style: 'position:absolute;top:0;bottom:0;width:2px;background:var(--c4)' });
    const blab = W.h('div', { style: 'position:absolute;left:8px;top:5px;font:12px var(--mono);color:var(--ink)' });
    bar.append(fill, mark, blab); host.append(bar);
    const ctl = W.$('#w-sag-ctl');
    W.select(ctl, { label: 'Pack', value: pk, options: Object.keys(PACKS).map((k) => [k, PACKS[k].name]), onChange: (v) => { pk = v; upd(); } });
    W.slider(ctl, { label: 'State of charge', min: 0, max: 100, step: 1, value: soc * 100, format: (v) => v + ' %', onInput: (v) => { soc = v / 100; upd(); } });
    W.slider(ctl, { label: 'Load current', min: 0, max: 40, step: 0.5, value: I, unit: 'A', onInput: (v) => { I = v; upd(); } });
    const rO = W.readout(ctl, { label: 'OCV', unit: 'V' });
    const rT = W.readout(ctl, { label: 'terminal', unit: 'V' });
    const rH = W.readout(ctl, { label: 'heat in pack', unit: 'W' });
    function upd() {
      const p = PACKS[pk];
      const Rint = 2 * p.Rc * (1 + 0.6 * Math.pow(1 - soc, 3));
      const ocv = 2 * interp(OCV.li, soc);
      const Vt = ocv - I * (Rint + Rw);
      rO.set(ocv); rT.set(Vt); rH.set(I * I * Rint);
      rT.setClass(Vt < 6.6 ? 'bad' : Vt > 7.0 ? 'good' : '');
      sch.set('ocv', { label: 'OCV ' + W.si(ocv, 'V', 3) });
      sch.set('ri', { label: 'R_int ' + W.si(Rint, 'Ω', 2) });
      sch.set('tv', { text: 'V = ' + W.si(Vt, 'V', 3) });
      sch.set('m', { spin: I / 15 });
      fl.set(I / 5);
      const lo = 5, hi = 8.6, pct = (v) => W.clamp((v - lo) / (hi - lo), 0, 1) * 100;
      fill.style.width = pct(Vt) + '%';
      fill.style.background = Vt < 6.6 ? 'var(--c4)' : 'var(--c3)';
      mark.style.left = pct(6.6) + '%';
      blab.textContent = `${Vt.toFixed(2)} V   (red line: 6.6 V = 3.3 V/cell, "empty under load")`;
      if (I >= 20 && Vt > 7.0) Book.solve('sag-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 5.3 — pack builder
   * ===================================================================== */
  (function pack() {
    const host = W.$('#w-pack');
    if (!host) return;
    const CELLS = {
      lipo: { name: 'LiPo pouch 1300 mAh 30C', v: 3.7, vf: 4.2, ah: 1.3, R: 0.012, imax: 39 },
      s18650: { name: '18650 3000 mAh (10 A)', v: 3.6, vf: 4.2, ah: 3.0, R: 0.025, imax: 10 },
      lfp: { name: 'LiFePO₄ 26650 3000 mAh', v: 3.2, vf: 3.6, ah: 3.0, R: 0.015, imax: 9 },
      nimh: { name: 'NiMH AA 2000 mAh', v: 1.2, vf: 1.4, ah: 2.0, R: 0.03, imax: 5 },
    };
    let cell = 'lipo', S = 2, P = 1;
    let c = null;
    c = W.canvas(host, { height: 190, onResize: () => c && draw() });
    const ctl = W.controls(host);
    W.select(ctl, { label: 'Cell', value: cell, options: Object.keys(CELLS).map((k) => [k, CELLS[k].name]), onChange: (v) => { cell = v; draw(); } });
    W.slider(ctl, { label: 'Series (S)', min: 1, max: 6, step: 1, value: S, format: (v) => v + 'S', onInput: (v) => { S = v; draw(); } });
    W.slider(ctl, { label: 'Parallel (P)', min: 1, max: 3, step: 1, value: P, format: (v) => v + 'P', onInput: (v) => { P = v; draw(); } });
    const rV = W.readout(ctl, { label: 'nominal / full', fmt: (v) => v });
    const rA = W.readout(ctl, { label: 'capacity', unit: 'Ah' });
    const rE = W.readout(ctl, { label: 'energy', unit: 'Wh' });
    const rR = W.readout(ctl, { label: 'pack resistance', unit: 'Ω' });
    const rI = W.readout(ctl, { label: 'max current', unit: 'A' });
    function draw() {
      const k = CELLS[cell], ctx = c.ctx, w = c.w, h = c.h;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = W.cssVar('--surface'); ctx.fillRect(0, 0, w, h);
      const cw = Math.min(56, (w - 80) / S - 18), ch = 28, gx = (w - S * (cw + 18)) / 2 + 9, top = 30 + (3 - P) * 20;
      const wire = W.cssVar('--wire'), ink = W.cssVar('--ink');
      ctx.lineWidth = 2;
      for (let s = 0; s < S; s++) {
        const x = gx + s * (cw + 18);
        // parallel bus bars
        ctx.strokeStyle = wire; ctx.beginPath(); ctx.moveTo(x - 6, top + ch / 2); ctx.lineTo(x - 6, top + (P - 1) * 44 + ch / 2); ctx.moveTo(x + cw + 6, top + ch / 2); ctx.lineTo(x + cw + 6, top + (P - 1) * 44 + ch / 2); ctx.stroke();
        for (let q = 0; q < P; q++) {
          const y = top + q * 44;
          ctx.fillStyle = W.col(['c1', 'c3', 'c5', 'c6', 'c2', 'c4'][s % 6]); ctx.globalAlpha = 0.25; ctx.fillRect(x, y, cw, ch); ctx.globalAlpha = 1;
          ctx.strokeStyle = W.col(['c1', 'c3', 'c5', 'c6', 'c2', 'c4'][s % 6]); ctx.strokeRect(x + 0.5, y + 0.5, cw, ch);
          ctx.fillStyle = ink; ctx.font = font(10, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(k.v + ' V', x + cw / 2, y + ch / 2);
          ctx.strokeStyle = wire; ctx.beginPath(); ctx.moveTo(x - 6, y + ch / 2); ctx.lineTo(x, y + ch / 2); ctx.moveTo(x + cw, y + ch / 2); ctx.lineTo(x + cw + 6, y + ch / 2); ctx.stroke();
          ctx.font = font(10); ctx.fillStyle = W.col('c4'); ctx.fillText('+', x + cw - 6, y + 7);
        }
        // series link to next group
        if (s < S - 1) { ctx.strokeStyle = wire; ctx.beginPath(); ctx.moveTo(x + cw + 6, top + ch / 2); ctx.lineTo(x + cw + 12, top + ch / 2); ctx.stroke(); }
        // balance tap
        ctx.fillStyle = W.col('c2'); ctx.beginPath(); ctx.arc(x + cw + 9, top - 10, 3, 0, TAU); ctx.fill();
        ctx.strokeStyle = W.col('c2'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + cw + 9, top - 7); ctx.lineTo(x + cw + 9, top + ch / 2); ctx.stroke(); ctx.lineWidth = 2;
      }
      ctx.fillStyle = W.col('c2'); ctx.beginPath(); ctx.arc(gx - 9, top - 10, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = W.col('c2'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx - 9, top - 7); ctx.lineTo(gx - 9, top + ch / 2); ctx.stroke();
      ctx.font = font(11); ctx.fillStyle = W.col('c2'); ctx.textAlign = 'left'; ctx.fillText(`balance lead: ${S + 1} wires`, 10, 12);
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = font(13, 700);
      ctx.fillText(`${S}S${P}P`, w / 2, h - 14);
      ctx.font = font(12); ctx.fillStyle = W.col('c4'); ctx.textAlign = 'right'; ctx.fillText('+ out', w - 8, top + ch / 2);
      ctx.fillStyle = W.col('c1'); ctx.textAlign = 'left'; ctx.fillText('− out', 8, top + ch / 2);
      rV.set(`${(S * k.v).toFixed(1)} / ${(S * k.vf).toFixed(1)} V`);
      rA.set(P * k.ah); rE.set(S * P * k.v * k.ah); rR.set(S * k.R / P); rI.set(P * k.imax);
    }
    document.addEventListener('themechange', draw);
    draw();
  })();

  /* =====================================================================
   * Figure 5.4 — LDO heat
   * ===================================================================== */
  (function ldo() {
    const host = W.$('#w-ldo');
    if (!host) return;
    const PK = { sot23: ['SOT-23-5 (≈220 °C/W)', 220], s223s: ['SOT-223, small pad (≈90 °C/W)', 90], s223b: ['SOT-223, big copper pour (≈60 °C/W)', 60], to220: ['TO-220, no heatsink (≈50 °C/W)', 50] };
    let Vin = 7.4, I = 0.25, pk = 's223s';
    const Vo = 3.3, Iq = 1e-4, Ta = 25;
    const sch = W.schematic(host, { w: 460, h: 200, title: 'Linear regulator from a battery to a 3.3 V load', items: [
      { t: 'V', id: 'vin', a: [60, 80], b: [60, 150], label: '7.4 V', side: -1 },
      { t: 'wire', pts: [[60, 80], [60, 60], 'ldo.IN'] },
      { t: 'ic', id: 'ldo', at: [200, 70], name: 'LDO 3.3 V', left: ['IN'], right: ['OUT'], bottom: ['GND'], w: 90 },
      { t: 'wire', pts: ['ldo.OUT', [330, 70], [330, 90]] },
      { t: 'C', a: [290, 90], b: [290, 150], label: '10 µF', side: -1 }, { t: 'wire', pts: [[290, 70], [290, 90]] },
      { t: 'R', id: 'rl', a: [330, 90], b: [330, 150], label: 'load' },
      { t: 'wire', pts: [[60, 150], [60, 175], [330, 175], [330, 150]] }, { t: 'wire', pts: [[290, 150], [290, 175]] },
      { t: 'wire', pts: ['ldo.GND', [200, 175]] }, { t: 'gnd', at: [200, 175] },
      { t: 'dot', at: [290, 70] }, { t: 'dot', at: [290, 175] }, { t: 'dot', at: [200, 175] },
      { t: 'tag', id: 'tp', at: [200, 22], text: 'P' },
    ] });
    const fl = sch.flow([[60, 80], [60, 60], [330, 70], [330, 175], [60, 175], [60, 150]], { speed: 0 });
    let c = null;
    c = W.canvas(host, { height: 64, onResize: () => c && drawT() });
    const ctl = W.$('#w-ldo-ctl');
    W.slider(ctl, { label: '\\(V_{in}\\)', min: 3.3, max: 12, step: 0.1, value: Vin, unit: 'V', onInput: (v) => { Vin = v; upd(); } });
    W.slider(ctl, { label: 'Load current', min: 0, max: 1, step: 0.01, value: I, unit: 'A', onInput: (v) => { I = v; upd(); } });
    W.select(ctl, { label: 'Package', value: pk, options: Object.keys(PK).map((k) => [k, PK[k][0]]), onChange: (v) => { pk = v; upd(); } });
    const rP = W.readout(ctl, { label: 'regulator heat', unit: 'W' });
    const rT = W.readout(ctl, { label: '\\(T_J\\)', fmt: (v) => (typeof v === 'number' ? v.toFixed(0) + ' °C' : v) });
    const rE = W.readout(ctl, { label: 'efficiency', fmt: (v) => (v * 100).toFixed(0) + ' %' });
    const st = W.h('span', { class: 'w-status' }); ctl.append(st);
    let Tj = 25;
    function drawT() {
      const ctx = c.ctx, w = c.w, h = c.h, x0 = 16, x1 = w - 16, X = (t) => x0 + (x1 - x0) * W.clamp(t / 200, 0, 1);
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = W.cssVar('--surface'); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = W.cssVar('--surface2'); ctx.fillRect(x0, 18, x1 - x0, 16);
      const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, W.col('c1')); g.addColorStop(0.45, W.col('c3')); g.addColorStop(0.7, W.col('c2')); g.addColorStop(1, W.col('c4'));
      ctx.fillStyle = g; ctx.fillRect(x0, 18, X(Tj) - x0, 16);
      ctx.font = font(11); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const [t, lab] of [[25, '25'], [100, '100 °C'], [150, 'shutdown ≈150']]) {
        ctx.strokeStyle = W.cssVar('--ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(t), 14); ctx.lineTo(X(t), 38); ctx.stroke();
        ctx.fillStyle = W.cssVar('--muted'); ctx.fillText(lab, X(t), 42);
      }
      ctx.fillStyle = W.cssVar('--ink'); ctx.font = font(12, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`junction ${Tj > 200 ? '>200' : Tj.toFixed(0)} °C`, x0, 12);
    }
    function upd() {
      const Vdo = 0.05 + 0.25 * I;
      const reg = Vin - Vdo >= Vo;
      const Vout = reg ? Vo : Math.max(0, Vin - Vdo);
      const P = (Vin - Vout) * I + Vin * Iq;
      Tj = Ta + P * PK[pk][1];
      const eta = Vin > 0 && I > 0 ? Vout * I / (Vin * (I + Iq)) : 0;
      rP.set(P); rT.set(Tj); rE.set(eta);
      rT.setClass(Tj > 150 ? 'bad' : Tj < 100 ? 'good' : '');
      sch.set('vin', { label: W.si(Vin, 'V', 3) });
      sch.set('rl', { label: 'load ' + W.si(I, 'A', 2) });
      sch.set('tp', { text: `heat = (${Vin.toFixed(1)} − ${Vout.toFixed(2)}) V × ${W.si(I, 'A', 2)} = ${W.si(P, 'W', 2)}` });
      fl.set(I / 0.15);
      if (!reg) { st.textContent = `⚠️ Dropout: output only ${Vout.toFixed(2)} V`; st.className = 'w-status bad'; }
      else if (Tj > 150) { st.textContent = '🔥 Thermal shutdown: the regulator turns itself off'; st.className = 'w-status bad'; }
      else if (Tj > 100) { st.textContent = 'Regulating, but hot'; st.className = 'w-status'; }
      else { st.textContent = '✅ Regulating and cool enough'; st.className = 'w-status good'; }
      drawT();
      if (reg && I >= 0.5 && Tj < 100) Book.solve('ldo-task');
    }
    document.addEventListener('themechange', drawT);
    upd();
  })();
