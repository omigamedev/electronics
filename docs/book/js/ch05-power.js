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
    const sch = W.schematic(host, { w: 460, h: 245, title: 'Battery model: ideal source plus internal resistance', items: [
      { t: 'text', at: [118, 232], text: 'inside the pack', cls: 'pin' },
      { t: 'Vdc', id: 'ocv', a: [80, 80], b: [80, 160], label: 'OCV', side: -1 },
      { t: 'wire', pts: [[80, 80], [80, 50], [110, 50]] },
      { t: 'R', id: 'ri', a: [110, 50], b: [170, 50], label: 'R_int' },
      { t: 'wire', pts: [[170, 50], [230, 50]] },
      { t: 'R', id: 'rw', a: [230, 50], b: [290, 50], label: 'wires 10 mΩ' },
      { t: 'wire', pts: [[290, 50], [360, 50], [360, 85]] },
      { t: 'M', id: 'm', a: [360, 85], b: [360, 155], label: 'load' },
      { t: 'wire', pts: [[360, 155], [360, 190], [80, 190], [80, 160]] },
      { t: 'dot', at: [200, 50] }, { t: 'dot', at: [200, 190] },
      { t: 'text', at: [212, 232], text: '← terminals', cls: 'pin', anchor: 'start' },
      { t: 'wire', id: 'box', pts: [[30, 18], [200, 18], [200, 215], [30, 215], [30, 18]], cls: 'gndw' },
      { t: 'tag', id: 'tv', at: [282, 120], text: 'V' },
    ] });
    sch.set('box', { stroke: 'muted' }); sch.parts.box.g.style.strokeDasharray = '5 5';
    const fl = sch.flow([[80, 80], [80, 50], [360, 50], [360, 190], [80, 190], [80, 160]], { speed: 0 });
    const bar = W.h('div', { style: 'position:relative;height:30px;border-radius:8px;background:var(--surface2);margin:8px 0;overflow:hidden' });
    const fill = W.h('div', { style: 'position:absolute;left:0;top:0;bottom:0;background:var(--c3);opacity:.75;transition:width .15s' });
    const mark = W.h('div', { style: 'position:absolute;top:0;bottom:0;width:2px;background:var(--c4)' });
    const blab = W.h('div', { style: 'position:absolute;left:8px;top:5px;font:12px var(--mono);color:var(--ink);white-space:nowrap;overflow:hidden;right:8px;text-overflow:ellipsis' });
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
      blab.textContent = `${Vt.toFixed(2)} V · red line 6.6 V = 3.3 V/cell`;
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
    c = W.canvas(host, { height: 175, onResize: () => c && draw() });
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
      const cw = Math.min(56, (w - 80) / S - 18), ch = 28, gx = (w - S * (cw + 18)) / 2 + 9, top = Math.round((h - 30 - (P - 1) * 44 - ch) / 2) + 14;
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
      { t: 'wire', pts: [[60, 80], [60, 70], 'ldo.IN'] },
      { t: 'ic', id: 'ldo', at: [200, 70], name: 'LDO 3.3 V', left: ['IN'], right: ['OUT'], bottom: ['GND'], w: 90 },
      { t: 'wire', pts: ['ldo.OUT', [330, 70], [330, 90]] },
      { t: 'C', a: [290, 90], b: [290, 150], label: '10 µF', side: -1 }, { t: 'wire', pts: [[290, 70], [290, 90]] },
      { t: 'R', id: 'rl', a: [330, 90], b: [330, 150], label: 'load' },
      { t: 'wire', pts: [[60, 150], [60, 175], [330, 175], [330, 150]] }, { t: 'wire', pts: [[290, 150], [290, 175]] },
      { t: 'wire', pts: ['ldo.GND', [200, 175]] }, { t: 'gnd', at: [200, 175] },
      { t: 'dot', at: [290, 70] }, { t: 'dot', at: [290, 175] }, { t: 'dot', at: [200, 175] },
      { t: 'tag', id: 'tp', at: [200, 22], text: 'P' },
    ] });
    const fl1 = sch.flow([[60, 80], [60, 70], [137, 70]], { speed: 0 }), fl2 = sch.flow([[263, 70], [330, 70], [330, 175], [60, 175], [60, 150]], { speed: 0 });
    const fl = { set: (v) => { fl1.set(v); fl2.set(v); } };
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
      sch.set('tp', { text: `heat = (${Vin.toFixed(1)} − ${Vout.toFixed(2)}) V × ${W.si(I, 'A', 2)} = ${W.si(P, 'W', 3)}` });
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

  /* =====================================================================
   * Figure 5.5 — animated buck / boost converter
   * ===================================================================== */
  (function buck() {
    const host = W.$('#w-buck');
    if (!host) return;
    let mode = 'buck', Vin = 8.4, Vout = 5, f = 500e3, L = 10e-6, Io = 2;
    const Cout = 22e-6;
    let phase = 0, cyc = 0, dotOff = 0, m = null;
    let c = null;
    c = W.canvas(host, { height: 220, onResize: () => {} });
    const pV = W.plot(host, { xmin: 0, xmax: 6e-6, ymin: 0, ymax: 10, xlabel: '', ylabel: 'switch node (V)', xunit: 's', yunit: 'V', height: 150, pad: { b: 22 } });
    const pI = W.plot(host, { xmin: 0, xmax: 6e-6, ymin: 0, ymax: 3, xlabel: 'time', ylabel: 'inductor I (A)', xunit: 's', yunit: 'A', height: 170 });
    const ctl = W.$('#w-buck-ctl');
    W.segmented(ctl, { options: [['buck', 'Buck (step down)'], ['boost', 'Boost (step up)']], value: mode, onChange: (v) => { mode = v; if (v === 'boost') { sVin.set(3.7, false); sVo.set(5, false); Vin = 3.7; Vout = 5; sIo.set(1, false); Io = 1; } else { sVin.set(8.4, false); sVo.set(5, false); Vin = 8.4; Vout = 5; sIo.set(2, false); Io = 2; } upd(); } });
    const sVin = W.slider(ctl, { label: '\\(V_{in}\\)', min: 2, max: 16, step: 0.1, value: Vin, unit: 'V', format: (v) => v.toFixed(1) + ' V', onInput: (v) => { Vin = v; upd(); } });
    const sVo = W.slider(ctl, { label: '\\(V_{out}\\)', min: 1, max: 20, step: 0.1, value: Vout, unit: 'V', format: (v) => v.toFixed(1) + ' V', onInput: (v) => { Vout = v; upd(); } });
    W.slider(ctl, { label: 'Frequency \\(f\\)', min: 100e3, max: 2e6, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    W.slider(ctl, { label: 'Inductor \\(L\\)', min: 1e-6, max: 47e-6, log: true, value: L, unit: 'H', onInput: (v) => { L = v; upd(); } });
    const sIo = W.slider(ctl, { label: 'Load current', min: 0.1, max: 3, step: 0.05, value: Io, unit: 'A', onInput: (v) => { Io = v; upd(); } });
    const rD = W.readout(ctl, { label: 'duty \\(D\\)', fmt: (v) => (typeof v === 'number' ? v.toFixed(3) : v) });
    const rdI = W.readout(ctl, { label: '\\(\\Delta I_L\\)', unit: 'A' });
    const rdV = W.readout(ctl, { label: '\\(\\Delta V_{out}\\)', unit: 'V' });
    const rPk = W.readout(ctl, { label: 'peak \\(I_L\\)', unit: 'A' });
    const st = W.h('span', { class: 'w-status' }); ctl.append(st);
    function model() {
      const ok = mode === 'buck' ? Vout < Vin : Vout > Vin;
      const D = mode === 'buck' ? W.clamp(Vout / Vin, 0, 1) : W.clamp(1 - Vin / Vout, 0, 0.95);
      const dI = mode === 'buck' ? (Vin - Vout) * D / (f * L) : Vin * D / (f * L);
      const Iavg = mode === 'buck' ? Io : Io / (1 - D);
      const dV = mode === 'buck' ? dI / (8 * f * Cout) : Io * D / (f * Cout);
      const dcm = Iavg < dI / 2;
      const T = 1 / f;
      const iL = (t) => { const ph = ((t / T) % 1 + 1) % 1; const lo = Iavg - dI / 2; const v = ph < D ? lo + dI * ph / D : lo + dI - dI * (ph - D) / (1 - D); return Math.max(0, v); };
      const vsw = (t) => { const ph = ((t / T) % 1 + 1) % 1; return mode === 'buck' ? (ph < D ? Vin : 0) : (ph < D ? 0 : Vout); };
      return { ok, D, dI, Iavg, dV, dcm, T, iL, vsw, pk: Iavg + dI / 2 };
    }
    function upd() {
      m = model();
      rD.set(m.ok ? m.D : '—'); rdI.set(m.dI); rdV.set(m.dV); rPk.set(m.pk);
      rdI.setClass(m.dI > 0.4 * (mode === 'buck' ? Io : m.Iavg) ? 'bad' : '');
      if (!m.ok) { st.textContent = mode === 'buck' ? '⚠️ A buck can only step down: set Vout < Vin' : '⚠️ A boost can only step up: set Vout > Vin'; st.className = 'w-status bad'; }
      else if (m.dcm) { st.textContent = 'Light load: the inductor current hits zero (discontinuous mode)'; st.className = 'w-status'; }
      else { st.textContent = `✅ D = ${mode === 'buck' ? 'Vout/Vin' : '1 − Vin/Vout'} = ${m.D.toFixed(3)}`; st.className = 'w-status good'; }
      pV.set({ xmax: 3 * m.T, ymax: Math.max(Vin, Vout) * 1.2 });
      pI.set({ xmax: 3 * m.T, ymax: Math.max(0.5, m.pk * 1.25) });
      if (mode === 'buck' && Math.abs(Vin - 8.4) < 0.06 && Math.abs(Vout - 5) < 0.06 && m.dI < 0.3 && L <= 22.5e-6) Book.solve('buck-task');
    }
    function drawPlots() {
      const tc = (cyc + phase) * m.T;
      pV.draw((p) => { p.fn(m.vsw, { color: 'c5', width: 2, samples: 900 }); p.vline(tc, { color: 'c4', dash: null, width: 2 }); });
      pI.draw((p) => { p.hline(m.Iavg, { color: 'muted' }); p.fn(m.iL, { color: 'c2', width: 2.5, samples: 900, label: mode === 'buck' ? 'I_L (average = load current)' : 'I_L (average = input current)' }); p.vline(tc, { color: 'c4', dash: null, width: 2 }); });
    }
    // --- circuit drawing helpers ---
    function circuit(on) {
      const ctx = c.ctx, w = c.w, h = c.h, ink = W.cssVar('--wire');
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = W.cssVar('--surface'); ctx.fillRect(0, 0, w, h);
      const top = 60, bot = 180, X = (f) => 20 + f * (w - 40);
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      const line = (pts, col, wd) => { ctx.strokeStyle = col || ink; ctx.lineWidth = wd || 2; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      const sw = (x1, y1, x2, y2, closed, label) => {
        const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
        ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang);
        ctx.strokeStyle = ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.3, 0); ctx.moveTo(L * 0.7, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(L * 0.3, 0, 3, 0, TAU); ctx.arc(L * 0.7, 0, 3, 0, TAU); ctx.fill();
        ctx.strokeStyle = closed ? W.col('c3') : W.col('c4'); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(L * 0.3, 0); ctx.lineTo(L * 0.7, closed ? 0 : -L * 0.22); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = W.cssVar('--muted'); ctx.font = font(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (label) ctx.fillText(label, (x1 + x2) / 2 + (y1 === y2 ? 0 : -28), (y1 + y2) / 2 + (y1 === y2 ? -22 : 0));
      };
      const coil = (x1, x2, y) => { ctx.strokeStyle = ink; ctx.lineWidth = 2; const n = 4, r = (x2 - x1) / (2 * n); ctx.beginPath(); ctx.moveTo(x1, y); for (let i = 0; i < n; i++) ctx.arc(x1 + r + 2 * r * i, y, r, Math.PI, 0); ctx.stroke(); };
      const cap = (x, y1, y2) => { const ym = (y1 + y2) / 2; line([[x, y1], [x, ym - 4]]); line([[x, ym + 4], [x, y2]]); line([[x - 13, ym - 4], [x + 13, ym - 4]]); line([[x - 13, ym + 4], [x + 13, ym + 4]]); };
      const res = (x, y1, y2) => { const ym = (y1 + y2) / 2; line([[x, y1], [x, ym - 20]]); const pts = [[x, ym - 20]]; for (let i = 1; i <= 6; i++) pts.push([x + (i % 2 ? 7 : -7), ym - 20 + i * 6.67]); pts.push([x, ym + 20]); line(pts); line([[x, ym + 20], [x, y2]]); };
      const src = (x, y1, y2, lab) => { const ym = (y1 + y2) / 2; line([[x, y1], [x, ym - 17]]); line([[x, ym + 17], [x, y2]]); ctx.beginPath(); ctx.arc(x, ym, 17, 0, TAU); ctx.stroke(); ctx.font = font(13, 700); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', x, ym - 7); ctx.fillText('−', x, ym + 8); ctx.font = font(12); ctx.fillText(lab, x, y1 - 14); };
      const txt = (s, x, y, col, al) => { ctx.font = font(12); ctx.fillStyle = W.col(col || 'ink'); ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
      let paths;
      if (mode === 'buck') {
        const xs = X(0.06), xa = X(0.18), xb = X(0.34), xn = X(0.40), xl1 = X(0.46), xl2 = X(0.64), xo = X(0.72), xc = X(0.80), xr = X(0.92);
        src(xs, top, bot, `V_in ${Vin.toFixed(1)} V`);
        line([[xs, top], [xa, top]]); sw(xa, top, xb, top, on, 'high-side switch'); line([[xb, top], [xl1, top]]);
        coil(xl1, xl2, top); txt('L', (xl1 + xl2) / 2, top - 20, 'muted');
        line([[xl2, top], [xr, top]]);
        sw(xn, bot, xn, top, !on, 'low-side'); // vertical, drawn bottom→top
        cap(xc, top, bot); txt('C', xc + 22, (top + bot) / 2, 'muted');
        res(xr, top, bot); txt(`load ${Vout.toFixed(1)} V`, xr - 10, top - 18, 'ink', 'center');
        line([[xs, bot], [xr, bot]]);
        ctx.fillStyle = ink; for (const x of [xn, xc]) { ctx.beginPath(); ctx.arc(x, top, 3.2, 0, TAU); ctx.arc(x, bot, 3.2, 0, TAU); ctx.fill(); }
        txt('switch node', xn + 40, top + 16, 'c5');
        paths = { on: [[xs, (top + bot) / 2 - 17], [xs, top], [xr, top], [xr, bot], [xs, bot], [xs, (top + bot) / 2 + 17]], off: [[xn, bot], [xn, top], [xr, top], [xr, bot], [xn, bot]] };
      } else {
        const xs = X(0.06), xl1 = X(0.14), xl2 = X(0.32), xn = X(0.40), xa = X(0.46), xb = X(0.62), xo = X(0.66), xc = X(0.78), xr = X(0.92);
        src(xs, top, bot, `V_in ${Vin.toFixed(1)} V`);
        line([[xs, top], [xl1, top]]); coil(xl1, xl2, top); txt('L', (xl1 + xl2) / 2, top - 20, 'muted');
        line([[xl2, top], [xa, top]]); sw(xa, top, xb, top, !on, 'high-side (or diode)'); line([[xb, top], [xr, top]]);
        sw(xn, bot, xn, top, on, 'low-side');
        cap(xc, top, bot); txt('C', xc + 22, (top + bot) / 2, 'muted');
        res(xr, top, bot); txt(`load ${Vout.toFixed(1)} V`, xr - 10, top - 18, 'ink', 'center');
        line([[xs, bot], [xr, bot]]);
        ctx.fillStyle = ink; for (const x of [xn, xc]) { ctx.beginPath(); ctx.arc(x, top, 3.2, 0, TAU); ctx.arc(x, bot, 3.2, 0, TAU); ctx.fill(); }
        txt('switch node', xn + 40, top + 16, 'c5');
        void xo;
        paths = { on: [[xs, (top + bot) / 2 - 17], [xs, top], [xn, top], [xn, bot], [xs, bot], [xs, (top + bot) / 2 + 17]], off: [[xs, (top + bot) / 2 - 17], [xs, top], [xr, top], [xr, bot], [xs, bot], [xs, (top + bot) / 2 + 17]] };
      }
      // highlight path + dots
      const path = on ? paths.on : paths.off, col = W.col(on ? 'c2' : 'c1');
      ctx.globalAlpha = 0.35; line(path, col, 7); ctx.globalAlpha = 1;
      const seg = []; let tot = 0; for (let i = 0; i < path.length - 1; i++) { const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); seg.push(l); tot += l; }
      ctx.fillStyle = col;
      for (let d = dotOff % 22; d < tot; d += 22) {
        let r = d, i = 0; while (i < seg.length - 1 && r > seg[i]) { r -= seg[i]; i++; }
        const t = seg[i] ? r / seg[i] : 0, x = path[i][0] + (path[i + 1][0] - path[i][0]) * t, y = path[i][1] + (path[i + 1][1] - path[i][1]) * t;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
      }
      ctx.font = font(12, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col;
      const msg = mode === 'buck'
        ? (on ? 'ON-time: V_in − V_out across L, current ramps UP' : 'OFF-time: L freewheels through the low-side switch, current ramps DOWN')
        : (on ? 'ON-time: V_in across L, current ramps UP (energy stored)' : 'OFF-time: L adds its voltage to V_in and pushes current to the output');
      ctx.fillText(m.ok ? msg : '(invalid voltages for this topology)', 12, 16);
    }
    upd();
    W.anim((dt) => {
      if (!m) return;
      const speed = 0.35; // periods per second
      phase += dt * speed;
      if (phase >= 1) { phase -= 1; cyc = (cyc + 1) % 3; }
      const on = phase < m.D;
      dotOff += dt * 40 * (0.4 + Math.min(2, m.iL((cyc + phase) * m.T)));
      circuit(m.ok ? on : false);
      drawPlots();
    }, c.canvas);
  })();

  /* =====================================================================
   * Figure 5.6 — LDO vs buck efficiency
   * ===================================================================== */
  (function eff() {
    const host = W.$('#w-eff');
    if (!host) return;
    let Vo = 3.3, I = 0.25, Vx = 7.4;
    const p = W.plot(host, { xmin: 3, xmax: 16, ymin: 0, ymax: 100, xlabel: 'input voltage (V)', ylabel: 'efficiency (%)', hover: true, xunit: 'V', height: 270, yfmt: (v) => v + '%' });
    const ctl = W.$('#w-eff-ctl');
    W.segmented(ctl, { options: [['3.3', '3.3 V out'], ['5', '5 V out']], value: '3.3', onChange: (v) => { Vo = +v; upd(); } });
    W.slider(ctl, { label: 'Load current', min: 1e-5, max: 3, log: true, value: I, unit: 'A', onInput: (v) => { I = v; upd(); } });
    W.slider(ctl, { label: 'Battery voltage', min: 3, max: 16, step: 0.1, value: Vx, unit: 'V', format: (v) => v.toFixed(1) + ' V', onInput: (v) => { Vx = v; upd(); } });
    const rL = W.readout(ctl, { label: 'LDO', fmt: (v) => v });
    const rB = W.readout(ctl, { label: 'buck', fmt: (v) => v });
    const rH = W.readout(ctl, { label: 'LDO heat', unit: 'W' });
    const IqL = 2e-6, IqB = 25e-6;
    const etaL = (Vin) => (Vin < Vo + 0.05 + 0.25 * I ? NaN : 100 * Vo * I / (Vin * (I + IqL)));
    const etaB = (Vin) => {
      if (Vin < Vo + 0.3) return NaN;
      const Po = Vo * I;
      const loss = I * I * 0.15 + Vin * I * 0.015 + Vin * (IqB + 2e-3 * I / (I + 0.05));
      return 100 * Po / (Po + loss);
    };
    function upd() {
      p.draw((p) => {
        p.vline(Vx, { color: 'c4' });
        p.fn(etaL, { color: 'c1', label: 'LDO (I_q = 2 µA)', hoverFmt: (x, y) => `LDO ${y.toFixed(0)}% @ ${x.toFixed(1)} V` });
        p.fn(etaB, { color: 'c3', label: 'synchronous buck (I_q = 25 µA)', hoverFmt: (x, y) => `buck ${y.toFixed(0)}%` });
      });
      const l = etaL(Vx), b = etaB(Vx);
      rL.set(isFinite(l) ? l.toFixed(0) + ' %' : 'dropout'); rB.set(isFinite(b) ? b.toFixed(0) + ' %' : 'dropout');
      rH.set(isFinite(l) ? (Vx - Vo) * I : NaN);
      rL.setClass(isFinite(l) && isFinite(b) && l > b ? 'good' : ''); rB.setClass(isFinite(l) && isFinite(b) && b >= l ? 'good' : '');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 5.7 — power budget calculator
   * ===================================================================== */
  (function budget() {
    const host = W.$('#w-budget');
    if (!host) return;
    const rows = [
      { n: 'ESP32-S3 module, Wi-Fi on', rail: 3.3, avg: 120, pk: 500, q: 1, on: true },
      { n: 'Sensors: IMU + ToF + OLED', rail: 3.3, avg: 30, pk: 50, q: 1, on: true },
      { n: 'SG90 micro servo', rail: 5, avg: 150, pk: 700, q: 2, on: true },
      { n: 'MG996R servo', rail: 5, avg: 400, pk: 2500, q: 2, on: false },
      { n: 'WS2812B LED (full white)', rail: 5, avg: 40, pk: 60, q: 8, on: false },
      { n: 'TT gear motor (via driver)', rail: 0, avg: 250, pk: 1500, q: 2, on: true },
    ];
    const BATS = { s2: ['2S 2200 mAh (7.4 V)', 7.4, 2.2, 40], s1: ['1S 1000 mAh (3.7 V) + boost', 3.7, 1.0, 20], s3: ['3S 2200 mAh (11.1 V)', 11.1, 2.2, 40] };
    let bat = 's2';
    const ctl = W.controls(host);
    W.select(ctl, { label: 'Battery', value: bat, options: Object.keys(BATS).map((k) => [k, BATS[k][0]]), onChange: (v) => { bat = v; upd(); } });
    let etaBuck = 0.9;
    W.slider(ctl, { label: '5 V converter efficiency', min: 0.7, max: 0.97, step: 0.01, value: etaBuck, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => { etaBuck = v; upd(); } });
    const tbl = W.h('table', { class: 'budget' });
    tbl.append(W.h('tr', {}, W.h('th', {}, ''), W.h('th', {}, 'Load'), W.h('th', {}, 'Rail'), W.h('th', {}, 'Qty'), W.h('th', { class: 'num' }, 'Avg (mA)'), W.h('th', { class: 'num' }, 'Peak (mA)')));
    rows.forEach((r) => {
      const cb = W.h('input', { type: 'checkbox' }); cb.checked = r.on;
      const qn = W.h('input', { type: 'number', min: 0, max: 20, value: r.q });
      const an = W.h('input', { type: 'number', min: 0, max: 5000, value: r.avg });
      const pn = W.h('input', { type: 'number', min: 0, max: 10000, value: r.pk });
      const tr = W.h('tr', {}, W.h('td', {}, cb), W.h('td', {}, r.n), W.h('td', {}, r.rail ? r.rail + ' V' : 'battery'), W.h('td', {}, qn), W.h('td', { class: 'num' }, an), W.h('td', { class: 'num' }, pn));
      const sync = () => { r.on = cb.checked; r.q = +qn.value || 0; r.avg = +an.value || 0; r.pk = +pn.value || 0; tr.classList.toggle('off', !r.on); upd(); };
      [cb, qn, an, pn].forEach((e) => e.addEventListener('input', sync));
      cb.addEventListener('change', sync);
      tr.classList.toggle('off', !r.on);
      tbl.append(tr);
    });
    host.append(tbl);
    const out = W.h('div', { class: 'budget-out' }); host.append(out);
    const warn = W.h('div', { class: 'budget-warn' }); host.append(warn);
    const cell = (label, val, bad) => W.h('div', { class: bad ? 'bad' : '' }, label, W.h('b', {}, val));
    function upd() {
      const [, Vb, Ah, Cr] = BATS[bat];
      let a3 = 0, p3 = 0, a5 = 0, p5 = 0, am = 0, pm = 0;
      for (const r of rows) { if (!r.on) continue; const a = r.avg * r.q / 1000, p = r.pk * r.q / 1000; if (r.rail === 3.3) { a3 += a; p3 += p; } else if (r.rail === 5) { a5 += a; p5 += p; } else { am += a; pm += p; } }
      // 3.3 V rail is an LDO fed from 5 V
      const a5t = a5 + a3, p5t = p5 + p3;
      const Pldo = (5 - 3.3) * a3;
      const aBat = (5 * a5t) / (etaBuck * Vb) + am, pBat = (5 * p5t) / (etaBuck * Vb) + pm;
      const runtime = 0.8 * Ah / aBat;
      out.innerHTML = '';
      out.append(
        cell('3.3 V rail avg / peak', `${W.si(a3, 'A', 2)} / ${W.si(p3, 'A', 2)}`, p3 > 0.6),
        cell('5 V rail avg / peak (incl. LDO)', `${W.si(a5t, 'A', 2)} / ${W.si(p5t, 'A', 2)}`, p5t > 3),
        cell('LDO heat (5 → 3.3 V)', W.si(Pldo, 'W', 2), Pldo > 0.6),
        cell('battery avg / peak', `${W.si(aBat, 'A', 2)} / ${W.si(pBat, 'A', 2)}`, pBat > Cr * Ah * 0.5),
        cell('runtime (80 % of pack)', isFinite(runtime) ? (runtime >= 1 ? runtime.toFixed(1) + ' h' : Math.round(runtime * 60) + ' min') : '—'),
      );
      const w = [];
      if (p3 > 0.6) w.push('3.3 V peak exceeds a 600 mA LDO (AP2112K class): use a bigger regulator or a 3.3 V buck.');
      if (p5t > 3) w.push('5 V peak exceeds a 3 A buck module: give the servos their own converter.');
      if (Pldo > 0.6) w.push('The LDO runs hot: consider a 3.3 V buck for the logic rail.');
      if (pBat > Cr * Ah * 0.5) w.push('Peak battery current is above half the pack\'s C-rating: expect heavy sag.');
      if (bat === 's1') w.push('With 1S, the "5 V converter" is a boost: its input current is high, and the 3.3 V LDO sees a sagging cell only through the boost.');
      warn.textContent = w.length ? '⚠️ ' + w.join(' ') : '✅ All parts within typical ratings. Size bulk capacitors for the peaks.';
    }
    upd();
  })();

  /* =====================================================================
   * Figure 5.8 — brown-out simulation
   * ===================================================================== */
  (function brownout() {
    const host = W.$('#w-bo');
    if (!host) return;
    const BATS = { alk: ['4×AA alkaline (6.0 V, ≈0.7 Ω)', 6.0, 0.7], nimh: ['4×AA NiMH (5.2 V, ≈0.15 Ω)', 5.2, 0.15], lipo: ['2S LiPo (7.6 V, ≈0.05 Ω)', 7.6, 0.05] };
    let bat = 'alk', star = false, soft = false, lowdo = false, bulk = false;
    const Rm = 1.5, tau = 0.05, Inl = 0.3, Il = 0.15, Rg = 0.15, BOR = 2.7, Tend = 0.8, dt = 0.0002;
    let sim = null, tNow = Tend;
    const p = W.plot(host, { xmin: 0, xmax: Tend * 1000, ymin: 0, ymax: 8, xlabel: 'time (ms)', ylabel: 'volts / amps', height: 300, xfmt: (v) => String(Math.round(v)) });
    const ctl = W.$('#w-bo-ctl');
    W.select(ctl, { label: 'Battery', value: bat, options: Object.keys(BATS).map((k) => [k, BATS[k][0]]), onChange: (v) => { bat = v; run(); } });
    W.toggle(ctl, { label: 'Star ground', value: false, onChange: (v) => { star = v; run(); } });
    W.toggle(ctl, { label: 'Soft-start PWM (150 ms ramp)', value: false, onChange: (v) => { soft = v; run(); } });
    W.toggle(ctl, { label: 'Low-dropout LDO (0.25 V)', value: false, onChange: (v) => { lowdo = v; run(); } });
    W.toggle(ctl, { label: '1000 µF bulk capacitor', value: false, onChange: (v) => { bulk = v; run(); } });
    W.button(ctl, '▶ Start motor', () => { tNow = 0; });
    const rR = W.readout(ctl, { label: 'resets', fmt: (v) => String(v) });
    const rM = W.readout(ctl, { label: 'lowest 3.3 V rail', unit: 'V' });
    function simulate() {
      const [, Voc, Rb] = BATS[bat];
      const Vdo = lowdo ? 0.25 : 1.1;
      let seed = 12345; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      let Eb = 0, Im = 0, up = true, cmd = 0.05, bootT = 0, resets = 0, minV = 9;
      const out = [], resetT = [];
      for (let t = 0; t <= Tend + 1e-9; t += dt) {
        let d = 0;
        if (up && t >= cmd) d = soft ? Math.min(1, (t - cmd) / 0.15) : 1;
        const ImT = Math.max(0, (d * (Voc - Rb * Il) - Eb) / (Rm + d * Rb));
        Im += (ImT - Im) * Math.min(1, dt / 0.002);
        const Vb = Voc - Rb * (Im + Il);
        Eb = Math.max(0, Eb + (Im - Inl) * (Rm / tau) * dt * (d > 0 ? 1 : 0) - (d > 0 ? 0 : Eb * dt / 0.15));
        const noise = (rand() * 2 - 1) * 0.06 * Im * (bulk ? 0.15 : 1);
        const vin = Vb + noise - (star ? 0 : Im * Rg);
        const Vl = Math.max(0, Math.min(3.3, vin - Vdo));
        if (t > 0.01) minV = Math.min(minV, Vl);
        if (up && Vl < BOR) { up = false; resets++; resetT.push([t, null]); bootT = 0; }
        if (!up) { if (Vl > BOR + 0.1) bootT += dt; else bootT = 0; if (bootT > 0.12) { up = true; cmd = t + 0.02; Eb = Math.max(0, Eb); resetT[resetT.length - 1][1] = t; } }
        out.push([t * 1000, Vb + noise, Vl, Im]);
      }
      return { out, resets, resetT, minV };
    }
    function run() { sim = simulate(); tNow = Tend; draw(); }
    function draw() {
      const tm = tNow * 1000;
      const pts = sim.out.filter((r) => r[0] <= tm);
      const step = 1, a = [], b = [], c2 = [];
      for (let i = 0; i < pts.length; i += step) { a.push([pts[i][0], pts[i][1]]); b.push([pts[i][0], pts[i][2]]); c2.push([pts[i][0], pts[i][3]]); }
      let shown = 0;
      p.draw((p) => {
        for (const [t0, t1] of sim.resetT) {
          if (t0 * 1000 > tm) continue; shown++;
          const e = Math.min(tm, (t1 == null ? Tend : t1) * 1000);
          p.area(() => 8, t0 * 1000, e, { color: 'c4', alpha: 0.13 }, () => 0);
          p.text(t0 * 1000 + 4, 7.6, 'RESET', { color: 'c4', size: 11 });
        }
        p.hline(BOR, { color: 'c1' }); p.text(Tend * 1000 - 4, BOR - 0.3, 'brown-out threshold', { align: 'right', color: 'c1', size: 11 });
        p.line(c2, { color: 'c4', width: 1.8, label: 'motor current (A)' });
        p.line(a, { color: 'c2', width: 1.8, label: 'battery terminal (V)' });
        p.line(b, { color: 'c1', width: 2.6, label: 'ESP32 3.3 V rail (V)' });
      });
      rR.set(shown); rR.setClass(tNow >= Tend ? (sim.resets ? 'bad' : 'good') : '');
      if (tNow >= Tend) rM.set(sim.minV);
      if (tNow >= Tend && sim.resets === 0 && bat === 'alk' && !lowdo) Book.solve('bo-task');
    }
    W.anim((dtt) => { if (tNow >= Tend || !sim) return; tNow = Math.min(Tend, tNow + dtt * Tend / 3); draw(); }, p.canvas);
    run();
  })();

  /* =====================================================================
   * Figure 5.9 — hot-plug ringing (series RLC)
   * ===================================================================== */
  (function hotplug() {
    const host = W.$('#w-hot');
    if (!host) return;
    let V = 12.6, Lw = 1e-6, elec = false;
    const C1 = 20e-6, r1 = 0.003, C2 = 220e-6, r2 = 0.15, Tend = 80e-6;
    const pV = W.plot(host, { xmin: 0, xmax: Tend * 1e6, ymin: 0, ymax: 35, xlabel: 'time (µs)', ylabel: 'board voltage (V)', height: 210, xfmt: (v) => String(v) });
    const pI = W.plot(host, { xmin: 0, xmax: Tend * 1e6, ymin: -40, ymax: 100, xlabel: 'time (µs)', ylabel: 'current (A)', height: 180, xfmt: (v) => String(v) });
    const ctl = W.$('#w-hot-ctl');
    W.segmented(ctl, { options: [['8.4', '2S (8.4 V)'], ['12.6', '3S (12.6 V)'], ['16.8', '4S (16.8 V)']], value: '12.6', onChange: (v) => { V = +v; upd(); } });
    W.slider(ctl, { label: 'Cable inductance', min: 0.2e-6, max: 3e-6, log: true, value: Lw, unit: 'H', onInput: (v) => { Lw = v; upd(); } });
    W.toggle(ctl, { label: 'Add 220 µF electrolytic (ESR 0.15 Ω)', value: false, onChange: (v) => { elec = v; upd(); } });
    const rV = W.readout(ctl, { label: 'peak voltage', unit: 'V' });
    const rO = W.readout(ctl, { label: 'overshoot', fmt: (v) => Math.round(v) + ' %' });
    const rI = W.readout(ctl, { label: 'peak current', unit: 'A' });
    function upd() {
      const R = 0.03 + 0.015 * Lw * 1e6, h = 2e-9;
      let iL = 0, v1 = 0, v2 = 0, pk = 0, ipk = 0;
      const vs = [], is = [];
      const N = Math.round(Tend / h), every = Math.round(N / 600);
      for (let k = 0; k <= N; k++) {
        const vn = elec ? (iL + v1 / r1 + v2 / r2) / (1 / r1 + 1 / r2) : iL * r1 + v1;
        const i1 = (vn - v1) / r1, i2 = elec ? (vn - v2) / r2 : 0;
        v1 += i1 / C1 * h; v2 += i2 / C2 * h;
        iL += (V - R * iL - vn) / Lw * h;
        pk = Math.max(pk, vn); ipk = Math.max(ipk, iL);
        if (k % every === 0) { vs.push([k * h * 1e6, vn]); is.push([k * h * 1e6, iL]); }
      }
      pV.draw((p) => {
        p.hline(V, { color: 'muted' }); p.text(Tend * 1e6 - 1, V - 1.6, 'battery', { align: 'right', color: 'muted', size: 11 });
        p.hline(20, { color: 'c4' }); p.text(Tend * 1e6 - 1, 21.5, 'abs. max of a typical 17 V-input buck (≈20 V)', { align: 'right', color: 'c4', size: 11 });
        p.line(vs, { color: 'c2', width: 2.2 });
      });
      pI.draw((p) => p.line(is, { color: 'c1', width: 2 }));
      rV.set(pk); rV.setClass(pk > 20 ? 'bad' : 'good');
      rO.set(100 * (pk - V) / V); rI.set(ipk);
    }
    upd();
  })();

  /* =====================================================================
   * Figure 5.10 — BSS138 bidirectional level shifter
   * ===================================================================== */
  (function level() {
    const host = W.$('#w-lvl');
    if (!host) return;
    let lv = false, hv = false;
    const sch = W.schematic(host, { w: 480, h: 290, title: 'BSS138 bidirectional level shifter', items: [
      { t: 'vcc', at: [130, 140], label: '3.3 V' },
      { t: 'R', a: [130, 140], b: [130, 200], label: '10 k', side: -1 },
      { t: 'wire', pts: [[60, 200], [255, 200], [255, 180]] },
      { t: 'nmos', id: 'q', at: [240, 150], label: 'BSS138' },
      { t: 'wire', pts: [[210, 150], [190, 150], [190, 120]] }, { t: 'vcc', at: [190, 120], label: '3.3 V' },
      { t: 'wire', pts: [[255, 120], [255, 90], [430, 90]] },
      { t: 'vcc', at: [350, 30], label: '5 V' },
      { t: 'R', a: [350, 30], b: [350, 90], label: '10 k', side: -1 },
      { t: 'SW', id: 'swl', a: [70, 200], b: [70, 255], label: 'ESP32', side: -1, onToggle: (cl) => { lv = cl; upd(); } },
      { t: 'gnd', at: [70, 255] },
      { t: 'SW', id: 'swh', a: [420, 90], b: [420, 145], label: 'sensor', onToggle: (cl) => { hv = cl; upd(); } },
      { t: 'gnd', at: [420, 145] },
      { t: 'dot', at: [130, 200] }, { t: 'dot', at: [70, 200] }, { t: 'dot', at: [350, 90] }, { t: 'dot', at: [420, 90] },
      { t: 'tag', id: 'tl', at: [160, 245], text: 'LV' },
      { t: 'tag', id: 'th', at: [340, 125], text: 'HV' },
      { t: 'text', at: [330, 215], text: 'S = 3.3 V side, D = 5 V side', cls: 'pin' },
      { t: 'tag', id: 'tq', at: [340, 175], text: 'off' },
    ] });
    const fLV = sch.flow([[130, 140], [130, 200], [70, 200], [70, 255]], { speed: 0 });
    const fHVtoL = sch.flow([[350, 30], [350, 90], [255, 90], [255, 200], [70, 200], [70, 255]], { speed: 0 });
    const fLVtoH = sch.flow([[130, 140], [130, 200], [255, 200], [255, 90], [420, 90], [420, 145]], { speed: 0 });
    const fHV = sch.flow([[350, 30], [350, 90], [420, 90], [420, 145]], { speed: 0 });
    const ctl = W.$('#w-lvl-ctl');
    const rL = W.readout(ctl, { label: '3.3 V side', unit: 'V' });
    const rH = W.readout(ctl, { label: '5 V side', unit: 'V' });
    const rG = W.readout(ctl, { label: '\\(V_{GS}\\)', unit: 'V' });
    W.button(ctl, 'Release both', () => { sch.set('swl', { closed: false }); sch.set('swh', { closed: false }); lv = hv = false; upd(); });
    function upd() {
      let VL = 3.3, VH = 5, on = false, how = 'off (V_GS = 0)';
      if (lv) { VL = 0; on = true; VH = 5 * 3 / (10000 + 3); how = 'ON: source pulled low'; }
      else if (hv) { VH = 0; on = true; VL = 3.3 * 3 / (10000 + 3) + 0.0; how = 'ON: body diode, then channel'; }
      if (lv && hv) { VL = 0; VH = 0; }
      rL.set(VL); rH.set(VH); rG.set(3.3 - VL);
      sch.set('tl', { text: 'LV line = ' + W.si(VL, 'V', 2) });
      sch.set('th', { text: 'HV line = ' + W.si(VH, 'V', 2) });
      sch.set('tq', { text: how });
      fLV.set(lv ? 0.8 : 0);
      fHVtoL.set(lv && !hv ? 1.1 : 0);
      fLVtoH.set(hv && !lv ? 0.8 : 0);
      fHV.set(hv ? 1.1 : 0);
      void on;
    }
    upd();
  })();

  /* =====================================================================
   * Figure 5.11 — the lab power board
   * ===================================================================== */
  (function board() {
    const host = W.$('#w-board');
    if (!host) return;
    const sch = W.schematic(host, { w: 770, h: 250, title: 'Robot power board: battery, fuse, reverse protection, TVS, buck, LDO, battery monitor', items: [
      { t: 'bat2', a: [40, 100], b: [40, 180], label: '2S' },
      { t: 'wire', pts: [[40, 100], [70, 100]] },
      { t: 'fuse', a: [70, 100], b: [120, 100], label: '5 A fuse', side: -1 },
      { t: 'wire', pts: [[120, 100], [190, 100]] },
      { t: 'pmos', id: 'q', at: [175, 70] },
      { t: 'text', at: [200, 76], text: 'P-FET', anchor: 'start' },
      { t: 'R', a: [145, 70], b: [100, 70], label: '10 k', side: -1 }, { t: 'gnd', at: [100, 70] },
      { t: 'wire', pts: [[190, 40], [410, 40], [410, 90], 'buck.IN'] },
      { t: 'Z', a: [240, 200], b: [240, 40], label: 'TVS', side: 1 },
      { t: 'Cpol', a: [290, 90], b: [290, 150], label: '470 µF' },
      { t: 'wire', pts: [[290, 40], [290, 90]] }, { t: 'wire', pts: [[290, 150], [290, 200]] },
      { t: 'R', a: [370, 55], b: [370, 105], label: '100 k', side: -1 },
      { t: 'R', a: [370, 135], b: [370, 185], label: '47 k', side: -1 },
      { t: 'wire', pts: [[370, 40], [370, 55]] }, { t: 'wire', pts: [[370, 105], [370, 135]] }, { t: 'wire', pts: [[370, 185], [370, 200]] },
      { t: 'dot', at: [370, 120] }, { t: 'text', at: [380, 120], text: 'ADC', anchor: 'start' },
      { t: 'ic', id: 'buck', at: [480, 100], name: 'buck 5 V', left: ['IN', 'GND'], right: ['OUT', 'GND'], w: 80 },
      { t: 'wire', pts: ['buck.GND', [416, 110], [416, 200]] },
      { t: 'wire', pts: [[538, 110], [546, 110], [546, 200]] },
      { t: 'wire', pts: [[538, 90], [556, 90], [556, 40], [720, 40]] },
      { t: 'text', at: [640, 28], text: '5 V → servos' },
      { t: 'wire', pts: [[556, 90], [556, 110], 'ldo.IN'] },
      { t: 'ic', id: 'ldo', at: [620, 110], name: 'LDO 3.3', left: ['IN'], right: ['OUT'], bottom: ['GND'], w: 70 },
      { t: 'wire', pts: ['ldo.OUT', [760, 110]] }, { t: 'text', at: [664, 96], text: '3.3 V → ESP32', anchor: 'start' },
      { t: 'wire', pts: ['ldo.GND', [620, 200]] },
      { t: 'wire', pts: [[40, 180], [40, 200], [620, 200]] },
      { t: 'gnd', at: [330, 200] },
      { t: 'dot', at: [240, 40] }, { t: 'dot', at: [290, 40] }, { t: 'dot', at: [370, 40] }, { t: 'dot', at: [556, 90] },
      { t: 'dot', at: [240, 200] }, { t: 'dot', at: [290, 200] }, { t: 'dot', at: [370, 200] }, { t: 'dot', at: [416, 200] }, { t: 'dot', at: [546, 200] },
    ] });
    sch.flow([[40, 100], [190, 100], [190, 40], [410, 40], [410, 90], [422, 90]], { speed: 1 });
    sch.flow([[538, 90], [556, 90], [556, 40], [720, 40]], { speed: 0.8 });
    sch.flow([[556, 90], [556, 110], [585, 110]], { speed: 0.5 });
    sch.flow([[673, 110], [760, 110]], { speed: 0.5 });
    sch.flow([[620, 200], [40, 200], [40, 180]], { speed: 1, color: 'c1' });
  })();
})();
