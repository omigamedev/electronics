/* Chapter 9 widgets: designing your own PCB */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const col = (c) => W.col(c);
  const clamp = W.clamp;
  const ctlOf = (id) => { const d = W.h('div', { class: 'w-controls' }); W.$(id).append(d); return d; };
  function text(ctx, s, x, y, o = {}) {
    ctx.save(); ctx.font = (o.bold ? '600 ' : '') + (o.size || 12) + 'px system-ui, sans-serif';
    ctx.fillStyle = o.color || col('ink'); ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
    ctx.fillText(s, x, y); ctx.restore();
  }
  function clear(c) { const x = c.ctx; x.clearRect(0, 0, c.w, c.h); x.fillStyle = col('surface'); x.fillRect(0, 0, c.w, c.h); }
  const onTheme = (fn) => document.addEventListener('themechange', fn);
  const COPPER = '#c8803a', COPPER_D = '#9a5b22', FR4 = '#d8c37c', MASK = 'rgba(28,140,70,0.55)', SILK = '#f4f4f0';

  /* =====================================================================
   * Figure 9.1 — exploded layer stack
   * ===================================================================== */
  (function stackFig() {
    const c = W.canvas('#w-stack', { height: 420 });
    const ctl = ctlOf('#w-stack-ctl');
    const info = W.$('#w-stack-info');
    const L = {
      silkT: { name: 'Top silkscreen', kind: 'silk', vt: 2, d: 'Epoxy ink printed on top of the soldermask: reference designators, outlines, pin-1 marks, polarity, logos. Not conductive. Keep it off pads, and keep text at least about 1 mm tall so it stays legible.' },
      maskT: { name: 'Top soldermask', kind: 'mask', vt: 3, d: 'A 10–30 µm lacquer (LPI) over all copper except the pads. It prevents solder bridges, protects traces from corrosion and scratches, and gives the board its colour. The openings are defined by the mask layer in your Gerbers.' },
      L1: { name: 'Top copper (L1)', kind: 'cu', pat: 'traces', vt: 5, d: '35 µm (1 oz) copper foil etched into traces, pads and pours. Components are soldered here. On a 2-layer board this is where most signals are routed.' },
      core2: { name: 'FR-4 core (≈1.5 mm)', kind: 'core', vt: 28, d: 'Woven fibreglass in flame-retardant epoxy: the mechanical backbone and the dielectric between the copper layers (εr ≈ 4.2–4.7). Its thickness sets how far a trace is from the plane on the other side, and hence loop area and impedance.' },
      L2b: { name: 'Bottom copper (L2): ground pour', kind: 'cu', pat: 'plane', vt: 5, d: 'On a good 2-layer board this is an almost unbroken ground plane: the return path for every signal on top. Each via through it leaves a small clearance hole (anti-pad).' },
      maskB: { name: 'Bottom soldermask', kind: 'mask', vt: 3, d: 'Soldermask on the bottom side, with openings for any bottom-side pads and through-hole pins.' },
      silkB: { name: 'Bottom silkscreen', kind: 'silk', vt: 2, d: 'Bottom-side markings (mirrored as seen from above): board name, revision, date, connector pinouts.' },
      pp1: { name: 'Prepreg (≈0.2 mm)', kind: 'pp', vt: 10, d: 'Pre-impregnated glass cloth that is cured in the lamination press to bond the outer copper foils to the core. Thin prepreg puts the outer signal layers about 0.2 mm above the inner planes.' },
      L2: { name: 'Inner L2: ground plane', kind: 'cu', pat: 'plane', vt: 5, d: 'A solid ground plane 0.2 mm under the top layer. Every top-layer signal has its return right underneath it, so loops are tiny, crosstalk is low and decoupling works well.' },
      core4: { name: 'FR-4 core (≈1.1 mm)', kind: 'core', vt: 20, d: 'The central core of a 4-layer stack, between the two inner planes.' },
      L3: { name: 'Inner L3: power pours', kind: 'cu', pat: 'power', vt: 5, d: 'Power distribution: pours for 3.3 V, 5 V and VBAT (or a second ground plane). The thin dielectric between L2 and L3 adds a little plane capacitance as a bonus.' },
      pp2: { name: 'Prepreg (≈0.2 mm)', kind: 'pp', vt: 10, d: 'Bonds the bottom copper foil to the core.' },
      L4: { name: 'Bottom copper (L4)', kind: 'cu', pat: 'traces2', vt: 5, d: 'Second signal layer, referenced to the L3 plane above it.' },
    };
    const stacks = { 2: ['silkT', 'maskT', 'L1', 'core2', 'L2b', 'maskB', 'silkB'], 4: ['silkT', 'maskT', 'L1', 'pp1', 'L2', 'core4', 'L3', 'pp2', 'L4', 'maskB', 'silkB'] };
    let n = 2, ex = 0.6, sel = 'L1', faces = [];
    const sl = W.slider(ctl, { label: 'Explode', min: 0, max: 1, step: 0.01, value: ex, format: (v) => (v * 100).toFixed(0) + ' %', onInput: (v) => { ex = v; draw(); } });
    void sl;
    W.segmented(ctl, { options: [[2, '2 layers'], [4, '4 layers']], value: 2, onChange: (v) => { n = v; if (!stacks[n].includes(sel)) sel = 'L1'; buildSel(); draw(); } });
    const selWrap = W.h('span'); ctl.append(selWrap);
    let selCtl;
    function buildSel() {
      selWrap.innerHTML = '';
      selCtl = W.select(selWrap, { label: 'Layer', options: stacks[n].map((k) => [k, L[k].name]), value: sel, onChange: (v) => { sel = v; draw(); } });
    }
    buildSel();
    const BW = 10, BD = 6.4;
    function draw() {
      clear(c);
      const x = c.ctx, ids = stacks[n];
      const gap = 6 + ex * (n === 2 ? 30 : 18);
      const totalH = ids.reduce((s, id) => s + L[id].vt, 0) + gap * (ids.length - 1);
      const k = Math.max(6, Math.min((c.w * (c.w < 560 ? 0.9 : 0.62)) / ((BW + BD) * 0.866), 26, (c.h - totalH - 30) / ((BW + BD) * 0.5)));
      const ox = c.w * (c.w < 560 ? 0.42 : 0.36), oy = Math.max(30, (c.h - totalH - (BW + BD) * k * 0.5) / 2 + 6);
      const P = (u, v, z) => [ox + (u - v) * k * 0.866, oy + (u + v) * k * 0.5 + z];
      faces = [];
      // compute z (top of each layer), top layer first
      let z = 0; const zs = {};
      ids.forEach((id) => { zs[id] = z; z += L[id].vt + gap; });
      // draw bottom-up
      [...ids].reverse().forEach((id) => {
        const ly = L[id], z0 = zs[id], t = ly.vt;
        const A = P(0, 0, z0), B = P(BW, 0, z0), C = P(BW, BD, z0), D = P(0, BD, z0);
        const base = ly.kind === 'cu' ? COPPER : ly.kind === 'core' ? FR4 : ly.kind === 'pp' ? '#e6d79c' : ly.kind === 'mask' ? MASK : 'rgba(255,255,255,0.0)';
        // side faces
        if (ly.kind !== 'silk') {
          x.save();
          x.fillStyle = ly.kind === 'cu' ? COPPER_D : ly.kind === 'mask' ? 'rgba(18,100,50,0.7)' : '#b9a35c';
          x.beginPath(); x.moveTo(...D); x.lineTo(...C); x.lineTo(C[0], C[1] + t); x.lineTo(D[0], D[1] + t); x.closePath(); x.fill();
          x.fillStyle = ly.kind === 'cu' ? '#b06c2c' : ly.kind === 'mask' ? 'rgba(18,110,55,0.6)' : '#c8b166';
          x.beginPath(); x.moveTo(...B); x.lineTo(...C); x.lineTo(C[0], C[1] + t); x.lineTo(B[0], B[1] + t); x.closePath(); x.fill();
          x.restore();
        }
        // top face
        const face = [A, B, C, D];
        faces.push({ id, poly: face });
        x.save();
        x.beginPath(); face.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p))); x.closePath();
        if (ly.kind === 'cu' && ly.pat !== 'plane' && ly.pat !== 'power') { x.fillStyle = 'rgba(200,128,58,0.10)'; x.fill(); }
        else if (ly.kind !== 'silk' && ly.kind !== 'mask') { x.fillStyle = base; x.fill(); }
        x.clip();
        const poly = (pts) => { x.beginPath(); pts.forEach(([u, v], i) => { const p = P(u, v, z0); i ? x.lineTo(...p) : x.moveTo(...p); }); };
        const rectUV = (u0, v0, u1, v1) => poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
        const line = (pts, w) => { x.lineWidth = w * k * 0.866; x.lineJoin = 'round'; x.lineCap = 'round'; poly(pts); x.stroke(); };
        const pads = [[1.2, 1.4, 2.0, 2.2], [2.6, 1.4, 3.4, 2.2], [6.2, 3.9, 7.0, 4.7], [6.2, 5.1, 7.0, 5.9], [8.2, 1.0, 9.0, 1.8]];
        if (ly.kind === 'cu') {
          x.fillStyle = COPPER; x.strokeStyle = COPPER;
          if (ly.pat === 'traces' || ly.pat === 'traces2') {
            line(ly.pat === 'traces' ? [[3.0, 1.8], [5.0, 1.8], [6.6, 3.4], [6.6, 4.3]] : [[1.5, 5.2], [4.5, 5.2], [5.5, 4.2], [8.6, 4.2]], 0.35);
            line(ly.pat === 'traces' ? [[1.6, 1.8], [1.6, 4.4], [6.6, 5.5]] : [[2.0, 1.0], [2.0, 3.0], [7.0, 3.0], [7.0, 2.1]], 0.25);
            line([[8.6, 1.4], [7.0, 2.0]], 0.6);
            if (ly.pat === 'traces') pads.forEach((p) => { rectUV(...p); x.fill(); });
          } else if (ly.pat === 'power') {
            x.fillStyle = COPPER; rectUV(0.3, 0.3, 4.8, 6.1); x.fill(); rectUV(5.2, 0.3, 9.7, 6.1); x.fill();
          }
          // via pad / antipad
          if (ly.pat === 'plane' || ly.pat === 'power') { x.fillStyle = base === COPPER ? '#e9dcb0' : '#e9dcb0'; rectUV(6.75, 2.25, 7.25, 2.75); x.fillStyle = FR4; x.fill(); }
          x.fillStyle = COPPER; rectUV(6.85, 2.35, 7.15, 2.65); x.fill();
        } else if (ly.kind === 'mask') {
          x.fillStyle = MASK; x.beginPath();
          [[0, 0], [BW, 0], [BW, BD], [0, BD]].forEach(([u, v], i) => { const p = P(u, v, z0); i ? x.lineTo(...p) : x.moveTo(...p); }); x.closePath();
          if (id === 'maskT') pads.forEach(([u0, v0, u1, v1]) => { [[u0 - 0.1, v0 - 0.1], [u0 - 0.1, v1 + 0.1], [u1 + 0.1, v1 + 0.1], [u1 + 0.1, v0 - 0.1]].forEach(([u, v], i) => { const p = P(u, v, z0); i ? x.lineTo(...p) : x.moveTo(...p); }); x.closePath(); });
          x.fill('evenodd');
        } else if (ly.kind === 'silk') {
          x.strokeStyle = SILK; x.lineWidth = 1.6;
          rectUV(1.0, 1.2, 3.6, 2.4); x.stroke();
          rectUV(6.0, 3.7, 7.2, 6.1); x.stroke();
          const tp = P(1.5, 2.9, z0), tq = P(6.4, 3.2, z0);
          x.restore(); x.save();
          x.font = '600 11px system-ui'; x.fillStyle = SILK; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3;
          x.strokeText('R1', ...tp); x.fillText('R1', ...tp); x.strokeText('C3', ...tq); x.fillText('C3', ...tq);
          if (id === 'silkT') { const tr = P(8.0, 5.4, z0); x.strokeText('rev A', ...tr); x.fillText('rev A', ...tr); }
        } else if (ly.kind === 'core' || ly.kind === 'pp') {
          x.strokeStyle = 'rgba(120,100,40,0.25)'; x.lineWidth = 1;
          for (let u = 0.5; u < BW; u += 0.7) line([[u, 0], [u, BD]], 0.02);
          for (let v = 0.5; v < BD; v += 0.7) line([[0, v], [BW, v]], 0.02);
        }
        x.restore();
        // outline
        x.save(); x.strokeStyle = id === sel ? col('accent') : 'rgba(0,0,0,0.25)'; x.lineWidth = id === sel ? 3 : 1;
        x.beginPath(); face.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p))); x.closePath(); x.stroke(); x.restore();
        // label
        const lp = P(BW, BD * 0.5, z0);
        if (c.w >= 560) {
          x.save(); x.strokeStyle = id === sel ? col('accent') : col('line'); x.lineWidth = 1; x.beginPath(); x.moveTo(lp[0] + 4, lp[1] + t / 2); x.lineTo(c.w * 0.74, lp[1] + t / 2); x.stroke(); x.restore();
          text(x, ly.name, c.w * 0.75, lp[1] + t / 2, { align: 'left', size: 12, color: id === sel ? col('accent') : col('ink'), bold: id === sel });
        }
      });
      // via barrel through all copper
      const cuIds = ids.filter((id) => L[id].kind === 'cu');
      const zt = zs[cuIds[0]], zb = zs[cuIds[cuIds.length - 1]] + L[cuIds[cuIds.length - 1]].vt;
      const vt = P(7, 2.5, zt), vb = P(7, 2.5, zb);
      x.save(); x.strokeStyle = COPPER; x.lineWidth = 5; x.globalAlpha = 0.9; x.beginPath(); x.moveTo(...vt); x.lineTo(...vb); x.stroke(); x.restore();
      x.save(); x.strokeStyle = '#7a4416'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(vt[0], vt[1], 5, 3, 0, 0, TAU); x.stroke(); x.restore();
      if (c.w >= 560) text(x, 'plated via', vb[0], vb[1] + 14, { size: 11, color: col('muted') });
      info.innerHTML = `<b>${L[sel].name}.</b> ${L[sel].d}`;
    }
    c.canvas.addEventListener('click', (e) => {
      const r = c.canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const inside = (poly) => { let inn = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inn = !inn; } return inn; };
      for (let i = faces.length - 1; i >= 0; i--) if (inside(faces[i].poly)) { sel = faces[i].id; selCtl.set(sel); draw(); return; }
    });
    c.canvas.style.cursor = 'pointer';
    onTheme(draw);
    new ResizeObserver(() => draw()).observe(c.wrap);
    draw();
  })();

  /* =====================================================================
   * Figure 9.2 — package sizes to scale
   * ===================================================================== */
  (function pkgFig() {
    const c = W.canvas('#w-pkg', { height: 420 });
    const ctl = ctlOf('#w-pkg-ctl');
    let zoom = 9;
    W.slider(ctl, { label: 'Zoom', min: 3, max: 40, log: true, value: zoom, format: (v) => v.toFixed(1) + ' px/mm', onInput: (v) => { zoom = v; draw(); } });
    const chip = (name, L, Wd, pl, pw, px) => ({ name, body: [L, Wd], pads: [[-px, 0, pl, pw], [px, 0, pl, pw]] });
    const P = [
      { name: 'Axial resistor (THT)', body: [6.3, 2.4], leads: true, circ: [[-5.08, 0, 0.9], [5.08, 0, 0.9]] },
      chip('1206', 3.2, 1.6, 1.15, 1.8, 1.45),
      chip('0805', 2.0, 1.25, 1.0, 1.45, 0.95),
      chip('0603', 1.6, 0.8, 0.8, 0.95, 0.78),
      chip('0402', 1.0, 0.5, 0.55, 0.62, 0.5),
      chip('0201', 0.6, 0.3, 0.3, 0.36, 0.32),
      { name: 'SOT-23', body: [2.9, 1.3], pads: [[-0.95, 1.1, 0.6, 1.0], [0.95, 1.1, 0.6, 1.0], [0, -1.1, 0.6, 1.0]] },
      { name: 'SOIC-8', body: [4.9, 3.9], pads: [-1.905, -0.635, 0.635, 1.905].flatMap((xx) => [[xx, 2.7, 0.6, 1.55], [xx, -2.7, 0.6, 1.55]]), pin1: [-1.905, 1.4] },
      { name: 'QFN-32 (5×5)', body: [5, 5], pads: (() => { const a = []; for (let i = 0; i < 8; i++) { const o = -1.75 + i * 0.5; a.push([o, 2.45, 0.25, 0.8], [o, -2.45, 0.25, 0.8], [2.45, o, 0.8, 0.25], [-2.45, o, 0.8, 0.25]); } a.push([0, 0, 3.3, 3.3]); return a; })(), pin1: [-2.2, 2.2] },
      { name: 'Iron tip (1.6 mm chisel)', tip: true, body: [1.6, 6] },
      { name: 'ESP32-S3-WROOM-1', body: [18, 25.5], module: true, pads: (() => { const a = []; for (let i = 0; i < 14; i++) { const yy = -11.3 + 6.4 + i * 1.27 - 2; a.push([-9, -yy + 3, 1.5, 0.9], [9, -yy + 3, 1.5, 0.9]); } for (let i = 0; i < 11; i++) a.push([-6.35 + i * 1.27, -12.75, 0.9, 1.5]); return a; })() },
    ];
    function draw() {
      clear(c);
      const x = c.ctx, s = zoom, gap = 4 * s + 18;
      // 1 mm grid
      x.save(); x.strokeStyle = col('line'); x.lineWidth = 1; x.globalAlpha = s > 6 ? 0.6 : 0.3;
      for (let gx = 0; gx < c.w; gx += s * (s < 6 ? 5 : 1)) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, c.h); x.stroke(); }
      for (let gy = 0; gy < c.h; gy += s * (s < 6 ? 5 : 1)) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(c.w, gy + 0.5); x.stroke(); }
      x.restore();
      let cx = 14, cy = 14, rowH = 0, hidden = 0;
      for (const p of P) {
        const ext = p.circ ? [10.16 + 2, 2.6] : p.pads ? (() => { let mx = p.body[0] / 2, my = p.body[1] / 2; p.pads.forEach(([px, py, w, h]) => { mx = Math.max(mx, Math.abs(px) + w / 2); my = Math.max(my, Math.abs(py) + h / 2); }); return [mx * 2, my * 2]; })() : p.body;
        const wpx = Math.max(ext[0] * s, 64), hpx = ext[1] * s + 22;
        if (cx + wpx > c.w - 10) { cx = 14; cy += rowH + 14; rowH = 0; }
        if (cy + hpx > c.h) { hidden++; continue; }
        const X = cx + wpx / 2, Y = cy + ext[1] * s / 2;
        x.save(); x.translate(X, Y);
        if (p.tip) {
          x.fillStyle = col('muted'); x.globalAlpha = 0.8; x.beginPath(); x.moveTo(-p.body[0] * s / 2, -p.body[1] * s / 2); x.lineTo(p.body[0] * s / 2, -p.body[1] * s / 2); x.lineTo(p.body[0] * s / 2, p.body[1] * s / 2 - 4); x.lineTo(-p.body[0] * s / 2, p.body[1] * s / 2); x.closePath(); x.fill();
        } else {
          if (p.leads) { x.strokeStyle = '#999'; x.lineWidth = Math.max(1, 0.6 * s); x.beginPath(); x.moveTo(-5.08 * s, 0); x.lineTo(5.08 * s, 0); x.stroke(); }
          x.fillStyle = COPPER;
          (p.pads || []).forEach(([px, py, w, h]) => x.fillRect((px - w / 2) * s, (-py - h / 2) * s, w * s, h * s));
          (p.circ || []).forEach(([px, py, r]) => { x.beginPath(); x.arc(px * s, -py * s, r * s, 0, TAU); x.fill(); x.fillStyle = col('surface'); x.beginPath(); x.arc(px * s, -py * s, 0.4 * s, 0, TAU); x.fill(); x.fillStyle = COPPER; });
          x.fillStyle = p.module ? 'rgba(140,150,160,0.55)' : 'rgba(90,95,105,0.75)';
          x.fillRect(-p.body[0] * s / 2, -p.body[1] * s / 2, p.body[0] * s, p.body[1] * s);
          if (p.module) {
            x.fillStyle = 'rgba(80,90,100,0.45)'; x.fillRect(-p.body[0] * s / 2, -p.body[1] * s / 2, p.body[0] * s, 6.4 * s);
            x.strokeStyle = COPPER; x.lineWidth = Math.max(1, 0.4 * s); x.beginPath();
            for (let i = 0; i < 7; i++) { const xx = (-7 + i * 2) * s, y0 = -p.body[1] * s / 2 + 1.2 * s; x.moveTo(xx, y0); x.lineTo(xx, y0 + 3.5 * s); x.lineTo(xx + s, y0 + 3.5 * s); x.lineTo(xx + s, y0); x.lineTo(xx + 2 * s, y0); }
            x.stroke();
            if (s > 5) text(x, 'antenna', 0, -p.body[1] * s / 2 + 5.5 * s, { size: 11, color: '#fff' });
          }
          if (p.pin1) { x.fillStyle = '#fff'; x.beginPath(); x.arc(p.pin1[0] * s, -p.pin1[1] * s, Math.max(1.5, 0.25 * s), 0, TAU); x.fill(); }
        }
        x.restore();
        text(x, p.name, X, cy + ext[1] * s + 11, { size: 11, color: col('muted') });
        cx += wpx + gap; rowH = Math.max(rowH, hpx);
      }
      if (hidden) text(x, `${hidden} more: zoom out to see them`, c.w - 10, c.h - 10, { align: 'right', size: 11, color: col('c4') });
      // scale bar
      x.save(); x.fillStyle = col('ink'); x.fillRect(c.w - 14 - 10 * s, c.h - 30, 10 * s, 3); x.restore();
      text(x, '10 mm', c.w - 14 - 5 * s, c.h - 40, { size: 11 });
    }
    const fitZoom = () => { zoom = c.w < 560 ? 5 : 9; };
    fitZoom();
    onTheme(draw);
    new ResizeObserver(() => draw()).observe(c.wrap);
    draw();
  })();

  /* =====================================================================
   * Figure 9.3 — return current in a ground plane (live resistor-grid solve)
   * ===================================================================== */
  (function returnFig() {
    const NX = 64, NY = 36, N = NX * NY, H = 1.6, K = 400, FC = 3e4;
    const SRC = [8, 18], LD = [56, 18];
    const S = { f: 1e6, ty: 8, slot: false, slotLen: 24 };
    const c = W.canvas('#w-ret', { aspect: NX / (NY + 4) });
    const ctl = ctlOf('#w-ret-ctl');
    W.slider(ctl, { label: 'Frequency', min: 100, max: 1e8, log: true, value: S.f, unit: 'Hz', onInput: (v) => { S.f = v; queue(); } });
    W.slider(ctl, { label: 'Trace route (y)', min: 3, max: 33, step: 1, value: S.ty, format: (v) => v + ' mm', onInput: (v) => { S.ty = v; queue(); } });
    W.toggle(ctl, { label: 'slot in the plane', value: false, onChange: (v) => { S.slot = v; queue(); } });
    const rA = W.readout(ctl, { label: 'loop area', fmt: (v) => Math.round(v) + ' mm²' });
    const rW = W.readout(ctl, { label: 'regime', fmt: (v) => v });
    const idx = (x, y) => y * NX + x;
    const gx = new Float64Array(N), gy = new Float64Array(N), phi = new Float64Array(N), J = new Float64Array(N);
    let cent = [], area = 0, jmax = 1;
    function solve() {
      const w = S.f * S.f / (S.f * S.f + FC * FC), ty = S.ty;
      const tr = [[SRC[0], SRC[1]], [SRC[0], ty], [LD[0], ty], [LD[0], LD[1]]];
      const dseg = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = clamp(t, 0, 1); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
      const dtr = (px, py) => Math.min(dseg(px, py, tr[0], tr[1]), dseg(px, py, tr[1], tr[2]), dseg(px, py, tr[2], tr[3]));
      const g = (px, py) => { const d = dtr(px, py); return (1 - w) + w * (1 + K / Math.pow(1 + (d / H) * (d / H), 2)); };
      const slot = (x, y) => S.slot && x === 32 && y <= S.slotLen;
      gx.fill(0); gy.fill(0);
      for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
        if (slot(x, y)) continue; const i = idx(x, y);
        if (x < NX - 1 && !slot(x + 1, y)) gx[i] = g(x + 0.5, y);
        if (y < NY - 1 && !slot(x, y + 1)) gy[i] = g(x, y + 0.5);
      }
      const fixed = idx(SRC[0], SRC[1]);
      const diag = new Float64Array(N);
      for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = idx(x, y); const d = gx[i] + (x > 0 ? gx[i - 1] : 0) + gy[i] + (y > 0 ? gy[i - NX] : 0); diag[i] = i === fixed || d === 0 ? 1 : d; }
      const A = (v, out) => {
        for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
          const i = idx(x, y);
          if (i === fixed || diag[i] === 1 && !(gx[i] || gy[i])) { out[i] = v[i]; continue; }
          const vi = v[i]; let s = 0; const V = (j) => (j === fixed ? 0 : v[j]);
          if (gx[i]) s += gx[i] * (vi - V(i + 1)); if (x > 0 && gx[i - 1]) s += gx[i - 1] * (vi - V(i - 1));
          if (gy[i]) s += gy[i] * (vi - V(i + NX)); if (y > 0 && gy[i - NX]) s += gy[i - NX] * (vi - V(i - NX));
          out[i] = s;
        }
      };
      const b = new Float64Array(N); b[idx(LD[0], LD[1])] = 1;
      const x0 = new Float64Array(N), r = b.slice(), z = new Float64Array(N), p = new Float64Array(N), Ap = new Float64Array(N);
      for (let i = 0; i < N; i++) z[i] = r[i] / diag[i];
      p.set(z); let rz = 0; for (let i = 0; i < N; i++) rz += r[i] * z[i];
      for (let it = 0; it < 2000; it++) {
        A(p, Ap); let pAp = 0; for (let i = 0; i < N; i++) pAp += p[i] * Ap[i];
        const a = rz / pAp; let rn = 0;
        for (let i = 0; i < N; i++) { x0[i] += a * p[i]; r[i] -= a * Ap[i]; rn += r[i] * r[i]; }
        if (rn < 1e-14) break;
        let rz2 = 0; for (let i = 0; i < N; i++) { z[i] = r[i] / diag[i]; rz2 += r[i] * z[i]; }
        const be = rz2 / rz; rz = rz2; for (let i = 0; i < N; i++) p[i] = z[i] + be * p[i];
      }
      phi.set(x0); phi[fixed] = 0;
      jmax = 1e-12;
      for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
        const i = idx(x, y);
        const jr = gx[i] ? gx[i] * (phi[i] - phi[i + 1]) : 0, jl = x > 0 && gx[i - 1] ? gx[i - 1] * (phi[i - 1] - phi[i]) : 0;
        const jd = gy[i] ? gy[i] * (phi[i] - phi[i + NX]) : 0, ju = y > 0 && gy[i - NX] ? gy[i - NX] * (phi[i - NX] - phi[i]) : 0;
        J[i] = Math.hypot((jr + jl) / 2, (jd + ju) / 2); if (J[i] > jmax) jmax = J[i];
      }
      cent = []; area = 0;
      for (let cx = SRC[0] + 1; cx < LD[0]; cx++) {
        let Ssum = 0, Sy = 0;
        for (let y = 0; y < NY; y++) { const i = idx(cx, y); if (!gx[i]) continue; const I = gx[i] * (phi[i] - phi[i + 1]); Ssum += I; Sy += I * y; }
        const yc = Sy / Ssum; cent.push([cx + 0.5, yc]); area += Math.abs(yc - ty);
      }
    }
    let pending = false;
    function queue() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; solve(); draw(); report(); }); }
    function report() {
      rA.set(area); rA.setClass(area < 40 ? 'good' : area > 200 ? 'bad' : '');
      const w = S.f * S.f / (S.f * S.f + FC * FC);
      rW.set(w < 0.2 ? 'resistive (DC-like)' : w > 0.8 ? 'inductive (follows trace)' : 'transition');
      if (S.slot && S.f >= 1e6 - 1 && area < 40) Book.solve('ret-task');
    }
    function draw() {
      clear(c);
      const x = c.ctx, s = Math.min(c.w / NX, (c.h - 26) / NY), ox = (c.w - NX * s) / 2, oy = 4;
      const cell = (i, j) => [ox + i * s, oy + j * s];
      // plane
      x.save(); x.fillStyle = COPPER; x.globalAlpha = 0.18; x.fillRect(ox, oy, NX * s, NY * s); x.restore();
      // current density
      const cc = col('c4');
      x.save(); x.fillStyle = cc;
      for (let y = 0; y < NY; y++) for (let xx = 0; xx < NX; xx++) {
        const v = Math.sqrt(J[idx(xx, y)] / jmax);
        if (v < 0.03) continue; x.globalAlpha = Math.min(0.9, v * 0.95); const [X, Y] = cell(xx, y); x.fillRect(X, Y, s + 0.5, s + 0.5);
      }
      x.restore();
      // slot
      if (S.slot) { x.save(); x.fillStyle = col('surface'); const [X, Y] = cell(32, 0); x.fillRect(X, Y, s, (S.slotLen + 1) * s); x.strokeStyle = col('ink'); x.lineWidth = 1.5; x.strokeRect(X, Y, s, (S.slotLen + 1) * s); x.restore(); text(x, 'slot', ox + 32.5 * s, oy + (S.slotLen + 2.4) * s, { size: 11, color: col('muted') }); }
      // centroid path
      x.save(); x.strokeStyle = col('ink'); x.setLineDash([5, 4]); x.lineWidth = 1.6; x.beginPath();
      const [sx, sy] = cell(SRC[0] + 0.5, SRC[1] + 0.5); x.moveTo(sx, sy);
      cent.forEach(([cx0, cy0]) => { const [X, Y] = cell(cx0, cy0 + 0.5); x.lineTo(X, Y); });
      const [lx, ly] = cell(LD[0] + 0.5, LD[1] + 0.5); x.lineTo(lx, ly); x.stroke(); x.restore();
      // trace
      const tpts = [[SRC[0], SRC[1]], [SRC[0], S.ty], [LD[0], S.ty], [LD[0], LD[1]]].map(([a, b]) => cell(a + 0.5, b + 0.5));
      x.save(); x.strokeStyle = col('c2'); x.lineWidth = Math.max(3, s * 0.45); x.lineJoin = 'round'; x.beginPath(); tpts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p))); x.stroke(); x.restore();
      [[sx, sy, 'driver'], [lx, ly, 'load']].forEach(([X, Y, t]) => { x.save(); x.fillStyle = col('ink'); x.beginPath(); x.arc(X, Y, Math.max(4, s * 0.6), 0, TAU); x.fill(); x.fillStyle = col('surface'); x.beginPath(); x.arc(X, Y, Math.max(1.6, s * 0.25), 0, TAU); x.fill(); x.restore(); text(x, t, X, Y + s * 1.6 + 6, { size: 11, bold: true }); });
      x.save(); x.strokeStyle = col('muted'); x.strokeRect(ox + 0.5, oy + 0.5, NX * s, NY * s); x.restore();
      const by = oy + NY * s + 12;
      x.save(); x.fillStyle = col('c2'); x.fillRect(ox, by - 2, 18, 4); x.restore();
      text(x, 'signal trace (top)', ox + 24, by, { align: 'left', size: 11, color: col('muted') });
      x.save(); x.fillStyle = col('c4'); x.globalAlpha = 0.7; x.fillRect(ox + 150, by - 5, 14, 10); x.restore();
      text(x, 'return current in plane', ox + 170, by, { align: 'left', size: 11, color: col('muted') });
      if (c.w > 520) { x.save(); x.strokeStyle = col('ink'); x.setLineDash([5, 4]); x.beginPath(); x.moveTo(ox + 330, by); x.lineTo(ox + 352, by); x.stroke(); x.restore(); text(x, 'average return path', ox + 358, by, { align: 'left', size: 11, color: col('muted') }); }
    }
    onTheme(draw);
    new ResizeObserver(() => draw()).observe(c.wrap);
    solve(); draw(); report();
  })();

  /* =====================================================================
   * Figure 9.4 — star vs daisy-chain ground (live DC solve)
   * ===================================================================== */
  (function starFig() {
    const sch = W.schematic('#w-star', {
      w: 520, h: 310, title: 'Motor driver and ESP32 sharing a ground return: daisy chain versus star',
      items: [
        { t: 'bat2', id: 'bat', a: [40, 110], b: [40, 170], label: '7.4 V' },
        { t: 'wire', pts: [[40, 110], [40, 40], [440, 40]] },
        { t: 'wire', pts: [[200, 40], [200, 75]] },
        { t: 'M', id: 'mot', a: [200, 75], b: [200, 140], label: 'motor + driver' },
        { t: 'wire', pts: [[440, 40], [440, 75]] },
        { t: 'ic', id: 'mcu', at: [440, 110], name: '', left: [], right: [], w: 90, h: 50 },
        { t: 'text', at: [440, 103], text: 'ESP32 +' },
        { t: 'text', at: [440, 120], text: 'sensors' },
        { t: 'wire', pts: [[440, 135], [440, 140]] },
        // daisy chain
        { t: 'wire', id: 'd1', pts: [[40, 170], [40, 250], [60, 250]] },
        { t: 'R', id: 'rsh', a: [60, 250], b: [140, 250], label: 'shared trace 20 mΩ', side: -1 },
        { t: 'wire', id: 'd2', pts: [[140, 250], [440, 250], [440, 140]] },
        { t: 'wire', id: 'd3', pts: [[200, 140], [200, 250]] },
        { t: 'dot', id: 'd4', at: [200, 250] },
        // star
        { t: 'wire', id: 's1', pts: [[40, 170], [40, 285], [440, 285], [440, 140]] },
        { t: 'wire', id: 's2', pts: [[200, 140], [200, 215], [150, 215]] },
        { t: 'R', id: 'rm', a: [150, 215], b: [70, 215], label: 'motor return 20 mΩ' },
        { t: 'wire', id: 's3', pts: [[70, 215], [40, 215]] },
        { t: 'dot', id: 's4', at: [40, 215] },
        { t: 'text', id: 's5', at: [300, 275], text: 'ESP32 return 20 mΩ' },
        { t: 'tag', id: 'toff', at: [330, 180], text: 'ESP32 ground offset: 0 mV' },
        { t: 'tag', id: 'ti', at: [330, 80], text: 'I motor = 0 A' },
      ],
    });
    const daisy = ['d1', 'rsh', 'd2', 'd3', 'd4'], star = ['s1', 's2', 'rm', 's3', 's4', 's5'];
    const flows = {
      daisy: sch.flow([[40, 110], [40, 40], [200, 40], [200, 250], [40, 250], [40, 110]], { speed: 0 }),
      star: sch.flow([[40, 110], [40, 40], [200, 40], [200, 215], [40, 215], [40, 110]], { speed: 0 }),
    };
    const ctl = ctlOf('#w-star-ctl');
    let Im = 1, mode = 'daisy';
    W.slider(ctl, { label: 'Motor current', min: 0, max: 5, step: 0.05, value: Im, unit: 'A', format: (v) => v.toFixed(2) + ' A', onInput: (v) => { Im = v; upd(); } });
    W.segmented(ctl, { options: [['daisy', 'Daisy chain'], ['star', 'Star']], value: 'daisy', onChange: (v) => { mode = v; upd(); } });
    const ro = W.readout(ctl, { label: 'ground offset', unit: 'V' });
    function upd() {
      daisy.forEach((id) => sch.set(id, { hidden: mode !== 'daisy' }));
      star.forEach((id) => sch.set(id, { hidden: mode !== 'star' }));
      let net;
      if (mode === 'daisy') net = [
        { name: 'B', type: 'V', n: ['vb', '0'], value: 7.4 },
        { name: 'Im', type: 'I', n: ['vb', 'j'], value: Im },
        { name: 'Id', type: 'I', n: ['vb', 'j'], value: 0.1 },
        { name: 'Rs', type: 'R', n: ['j', '0'], value: 0.02 },
      ];
      else net = [
        { name: 'B', type: 'V', n: ['vb', '0'], value: 7.4 },
        { name: 'Im', type: 'I', n: ['vb', 'mg'], value: Im },
        { name: 'Rm', type: 'R', n: ['mg', '0'], value: 0.02 },
        { name: 'Id', type: 'I', n: ['vb', 'dg'], value: 0.1 },
        { name: 'Rd', type: 'R', n: ['dg', '0'], value: 0.02 },
      ];
      const s = W.solveDC(net);
      const off = mode === 'daisy' ? s.v.j : s.v.dg;
      sch.set('toff', { text: `ESP32 ground offset: ${(off * 1000).toFixed(1)} mV` });
      sch.set('ti', { text: `I motor = ${Im.toFixed(2)} A` });
      sch.set('mot', { spin: Im / 3 });
      flows.daisy.set(mode === 'daisy' ? Math.min(3, Im) : 0);
      flows.star.set(mode === 'star' ? Math.min(3, Im) : 0);
      ro.set(off); ro.setClass(off < 0.005 ? 'good' : off > 0.03 ? 'bad' : '');
      if (Im >= 3 - 1e-9 && off < 0.005) Book.solve('star-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 9.5 — decoupling equivalent circuit (static)
   * ===================================================================== */
  (function decSch() {
    W.schematic('#w-decsch', {
      w: 640, h: 250, title: 'Equivalent circuit of a decoupling capacitor between a regulator and an IC',
      items: [
        { t: 'Vdc', id: 'reg', a: [40, 95], b: [40, 175], label: 'regulator' },
        { t: 'wire', pts: [[40, 95], [40, 50], [60, 50]] },
        { t: 'L', a: [60, 50], b: [140, 50], label: 'supply trace ~20 nH' },
        { t: 'wire', pts: [[140, 50], [230, 50]] },
        { t: 'dot', at: [200, 50] },
        { t: 'wire', pts: [[200, 50], [200, 70]] },
        { t: 'C', a: [200, 70], b: [200, 100], label: '100 nF' },
        { t: 'R', a: [200, 105], b: [200, 145], label: 'ESR' },
        { t: 'L', a: [200, 150], b: [200, 190], label: 'ESL ~0.5 nH' },
        { t: 'wire', pts: [[200, 100], [200, 105]] }, { t: 'wire', pts: [[200, 145], [200, 150]] },
        { t: 'wire', pts: [[200, 190], [200, 215]] },
        { t: 'L', a: [230, 50], b: [330, 50], label: 'traces + vias (loop L)' },
        { t: 'wire', pts: [[330, 50], [480, 50]] },
        { t: 'dot', at: [400, 50] },
        { t: 'C', a: [400, 90], b: [400, 130], label: 'on-die C', side: -1 },
        { t: 'wire', pts: [[400, 50], [400, 90]] }, { t: 'wire', pts: [[400, 130], [400, 215]] },
        { t: 'I', a: [480, 70], b: [480, 160], label: 'IC current pulses' },
        { t: 'wire', pts: [[480, 50], [480, 70]] }, { t: 'wire', pts: [[480, 160], [480, 215]] },
        { t: 'wire', pts: [[40, 175], [40, 215], [480, 215]] },
        { t: 'gnd', at: [260, 215] },
        { t: 'text', at: [440, 238], text: 'inside the IC package' },
        { t: 'text', at: [200, 238], text: 'decoupling cap' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 9.6 — decoupling placement vs supply droop
   * ===================================================================== */
  (function decFig() {
    const S = { d: 6, via: 'pad', stack: '2', esl: 0.6 };
    const c = W.canvas('#w-dec', { height: 210 });
    const p = W.plot('#w-dec-plot', { xmin: 0, xmax: 60, ymin: -260, ymax: 80, xlabel: 'Time (ns)', ylabel: 'Pin voltage − 3.3 V (mV)', height: 230, hover: true, xunit: '', yunit: '' });
    const ctl = ctlOf('#w-dec-ctl');
    W.slider(ctl, { label: 'Cap distance', min: 0.5, max: 20, step: 0.5, value: S.d, format: (v) => v.toFixed(1) + ' mm', onInput: (v) => { S.d = v; upd(); } });
    W.segmented(ctl, { options: [['pad', 'Vias at pads'], ['far', 'Via 5 mm away']], value: 'pad', onChange: (v) => { S.via = v; upd(); } });
    W.segmented(ctl, { options: [['2', '2-layer (1.6 mm)'], ['4', '4-layer (0.2 mm)']], value: '2', onChange: (v) => { S.stack = v; upd(); } });
    W.select(ctl, { label: 'Cap package', options: [['0.4', '0402 (ESL ≈ 0.4 nH)'], ['0.6', '0603 (≈ 0.6 nH)'], ['0.8', '0805 (≈ 0.8 nH)'], ['1.1', '1206 (≈ 1.1 nH)']], value: '0.6', onChange: (v) => { S.esl = +v; upd(); } });
    const rL = W.readout(ctl, { label: 'loop inductance', fmt: (v) => v.toFixed(2) + ' nH' });
    const rV = W.readout(ctl, { label: 'droop', fmt: (v) => v.toFixed(0) + ' mV' });
    let wave = [], Ltot = 0, droop = 0;
    function simulate() {
      const Lp = S.stack === '4' ? 0.32 : 0.73, Lvia = S.stack === '4' ? 0.25 : 1.2;
      Ltot = S.esl + Lp * S.d + 2 * Lvia + (S.via === 'far' ? Lp * 5 * 2 : 0) + 0.4;
      const L = Ltot * 1e-9, C = 100e-9, ESR = 0.02, Cd = 5e-9, Rd = 0.3, Lb = 30e-9, Rb = 0.05;
      const I0 = 0.1, tr = 1e-9, t0 = 5e-9, tw = 30e-9;
      const il = (t) => (t < t0 ? 0 : t < t0 + tr ? I0 * (t - t0) / tr : t < t0 + tr + tw ? I0 : t < t0 + 2 * tr + tw ? I0 * (1 - (t - t0 - tr - tw) / tr) : 0);
      let vc = 3.3, vcd = 3.3, vp = 3.3, iL = 0, ib = 0; const dt = 2e-12; wave = []; let mn = 0;
      for (let k = 0, t = 0; t < 60e-9; k++, t = k * dt) {
        ib += dt * (3.3 - vc - Rb * ib) / Lb;
        const vcap = vc - ESR * iL;
        const icd = iL - il(t); vp = vcd + Rd * icd;
        iL += dt * (vcap - vp) / L;
        vc += dt * (ib - iL) / C;
        vcd += dt * icd / Cd;
        if (k % 100 === 0) wave.push([t * 1e9, (vp - 3.3) * 1000]);
        mn = Math.min(mn, vp - 3.3);
      }
      droop = -mn * 1000;
    }
    function drawBoard() {
      clear(c);
      const x = c.ctx, sc = Math.min((c.w - 160) / 24, 18), icX = Math.min(c.w - 90, c.w / 2 + 240), py = 100;
      const capX = icX - 40 - S.d * sc;
      // ic
      x.save(); x.fillStyle = 'rgba(90,95,105,0.85)'; x.fillRect(icX - 10, py - 70, 90, 140); x.restore();
      text(x, 'IC', icX + 35, py, { color: '#fff', bold: true, size: 14 });
      // pins
      x.save(); x.fillStyle = COPPER; x.fillRect(icX - 26, py - 22, 16, 10); x.fillRect(icX - 26, py + 12, 16, 10); x.restore();
      text(x, 'VDD', icX + 2, py - 17, { size: 10, color: '#fff', align: 'left' });
      text(x, 'GND', icX + 2, py + 17, { size: 10, color: '#fff', align: 'left' });
      // cap
      const cw = 12 + S.esl * 10, ch = 30;
      x.save(); x.fillStyle = COPPER; x.fillRect(capX - cw / 2, py - 22 - 6, cw, 12); x.fillRect(capX - cw / 2, py + 17 - 6, cw, 12);
      x.fillStyle = '#b8a27a'; x.fillRect(capX - cw / 2 + 2, py - 20, cw - 4, 36); x.restore();
      text(x, 'C', capX - cw / 2 - 12, py, { size: 12, bold: true });
      // traces
      x.save(); x.strokeStyle = COPPER; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(capX, py - 22); x.lineTo(icX - 18, py - 22); x.stroke();
      const gvx = S.via === 'pad' ? capX : capX - 5 * sc;
      if (S.via === 'far') { x.lineWidth = 3; x.beginPath(); x.moveTo(capX, py + 17); x.lineTo(capX, py + 45); x.lineTo(gvx, py + 45); x.stroke(); }
      x.restore();
      // vias
      const via = (vx, vy) => { x.save(); x.fillStyle = COPPER; x.beginPath(); x.arc(vx, vy, 6, 0, TAU); x.fill(); x.fillStyle = col('surface'); x.beginPath(); x.arc(vx, vy, 2.5, 0, TAU); x.fill(); x.restore(); };
      const capVia = S.via === 'pad' ? [capX, py + 32] : [gvx, py + 45];
      via(...capVia); via(icX - 18, py + 32);
      // loop
      x.save(); x.fillStyle = col('c4'); x.globalAlpha = 0.18; x.beginPath();
      x.moveTo(capX, py - 22); x.lineTo(icX - 18, py - 22); x.lineTo(icX - 18, py + 32); x.lineTo(capVia[0], capVia[1]); x.lineTo(capX, py + 17); x.closePath(); x.fill(); x.restore();
      x.save(); x.strokeStyle = col('c4'); x.setLineDash([4, 3]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(icX - 18, py + 32); x.lineTo(capVia[0], capVia[1]); x.stroke(); x.restore();
      text(x, 'return in the plane', (icX - 18 + capVia[0]) / 2, Math.max(py + 32, capVia[1]) + 16, { size: 11, color: col('c4') });
      // ruler
      x.save(); x.strokeStyle = col('muted'); x.lineWidth = 1; x.beginPath(); x.moveTo(capX, py - 52); x.lineTo(icX - 18, py - 52); x.stroke(); x.restore();
      text(x, S.d.toFixed(1) + ' mm', (capX + icX - 18) / 2, py - 62, { size: 11, color: col('muted') });
      text(x, (S.stack === '4' ? 'plane 0.2 mm below' : 'plane 1.5 mm below (bottom layer)'), 12, 16, { align: 'left', size: 11, color: col('muted') });
    }
    function upd() {
      simulate(); drawBoard();
      p.draw((p) => {
        p.area(() => 0, 0, 60, { color: 'c3', alpha: 0.12 }, () => -80);
        p.hline(-80, { color: 'c3' });
        p.text(59, -72, '80 mV budget', { align: 'right', color: 'c3', size: 11 });
        p.line(wave, { color: 'c1', label: 'IC supply pin' });
      });
      rL.set(Ltot); rV.set(droop); rV.setClass(droop < 80 ? 'good' : droop > 150 ? 'bad' : '');
      if (droop < 80) Book.solve('dec-task');
    }
    onTheme(drawBoard);
    new ResizeObserver(() => drawBoard()).observe(c.wrap);
    upd();
  })();

  /* =====================================================================
   * Figure 9.7 — trace width calculator (IPC-2221 fit)
   * ===================================================================== */
  (function traceFig() {
    const S = { I: 3, dT: 20, oz: 1, ext: true, len: 50 };
    const p = W.plot('#w-trace', { xmin: 0, xmax: 10, ymin: 0, ymax: 6, xlabel: 'Current (A)', ylabel: 'Required width (mm)', hover: true, height: 280, xunit: 'A', yunit: '' });
    const ctl = ctlOf('#w-trace-ctl');
    W.slider(ctl, { label: 'Current', min: 0.1, max: 10, step: 0.1, value: S.I, format: (v) => v.toFixed(1) + ' A', onInput: (v) => { S.I = v; upd(); } });
    W.slider(ctl, { label: 'Temp. rise', min: 5, max: 60, step: 1, value: S.dT, format: (v) => v + ' °C', onInput: (v) => { S.dT = v; upd(); } });
    W.slider(ctl, { label: 'Length', min: 5, max: 300, step: 5, value: S.len, format: (v) => v + ' mm', onInput: (v) => { S.len = v; upd(); } });
    W.segmented(ctl, { options: [[0.5, '½ oz'], [1, '1 oz'], [2, '2 oz']], value: 1, onChange: (v) => { S.oz = v; upd(); } });
    W.segmented(ctl, { options: [[true, 'Outer layer'], [false, 'Inner layer']], value: true, onChange: (v) => { S.ext = v; upd(); } });
    const rw = W.readout(ctl, { label: 'width', fmt: (v) => `${v.toFixed(2)} mm (${(v / 0.0254).toFixed(0)} mil)` });
    const rr = W.readout(ctl, { label: 'R', unit: 'Ω' });
    const rd = W.readout(ctl, { label: 'drop', unit: 'V' });
    const rp = W.readout(ctl, { label: 'loss', unit: 'W' });
    const rv = W.readout(ctl, { label: '0.3 mm vias', fmt: (v) => '≥ ' + v });
    const width = (I, dT) => { const k = S.ext ? 0.048 : 0.024; const A = Math.pow(I / (k * Math.pow(dT, 0.44)), 1 / 0.725); return A / (1.378 * S.oz) * 0.0254; };
    function upd() {
      const wmm = width(S.I, S.dT);
      const t = 35e-6 * S.oz, R = 1.72e-8 * (1 + 0.0039 * (S.dT + 5)) * (S.len / 1000) / (wmm / 1000 * t);
      const ymax = Math.max(2, Math.ceil(width(10, 10) * 1.05));
      p.set({ ymax });
      p.draw((p) => {
        [[10, 'c4'], [20, 'c2'], [40, 'c3']].forEach(([dT, cc]) => p.fn((I) => width(I, dT), { color: cc, label: `ΔT = ${dT} °C`, hoverFmt: (I, w) => `${I.toFixed(1)} A → ${w.toFixed(2)} mm` }));
        p.point(S.I, wmm, { color: 'c5', r: 6, label: `${wmm.toFixed(2)} mm` });
      });
      rw.set(wmm); rr.set(R); rd.set(R * S.I); rp.set(R * S.I * S.I); rv.set(Math.max(1, Math.ceil(S.I / 1.0)));
    }
    upd();
  })();

  /* =====================================================================
   * Figure 9.8 — floorplan drag puzzle
   * ===================================================================== */
  (function floorFig() {
    const BW = 90, BH = 64; // mm
    const host = W.$('#w-floor');
    const c = W.canvas(host, { get height() { return Math.min(460, Math.round((host.clientWidth || 600) / 1.35)); } });
    const rulesEl = W.$('#w-floor-rules');
    const ctl = ctlOf('#w-floor-ctl');
    const fixed = [
      { id: 'usb', name: 'USB-C', x: 0, y: 26, w: 7, h: 9, col: 'muted' },
      { id: 'bat', name: 'BATT', x: 82, y: 22, w: 8, h: 10, col: 'c4' },
      { id: 'mot', name: 'MOTORS', x: 58, y: 57, w: 26, h: 7, col: 'c4' },
      { id: 'srv', name: 'SERVOS', x: 6, y: 57, w: 22, h: 7, col: 'muted' },
      { id: 'qw', name: 'Qwiic', x: 0, y: 8, w: 6, h: 7, col: 'muted' },
    ];
    const start = { esp: [36, 22], buck: [14, 40], ldo: [70, 6], drv: [16, 22], imu: [60, 40] };
    const blocks = [
      { id: 'esp', name: 'ESP32-S3 module', w: 18, h: 25.5, col: 'c1' },
      { id: 'buck', name: 'Buck 5 V', w: 12, h: 10, col: 'c2' },
      { id: 'ldo', name: 'LDO', w: 7, h: 6, col: 'c6' },
      { id: 'drv', name: '2× DRV8833', w: 16, h: 9, col: 'c5' },
      { id: 'imu', name: 'IMU', w: 6, h: 6, col: 'c3' },
    ];
    const reset = () => blocks.forEach((b) => { [b.x, b.y] = start[b.id]; });
    reset();
    W.button(ctl, 'Reset positions', () => { reset(); draw(); check(); });
    const B = (id) => blocks.find((b) => b.id === id) || fixed.find((b) => b.id === id);
    const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
    const dist = (a, b) => { // edge-to-edge distance between rectangles
      const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))), dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
      return Math.hypot(dx, dy);
    };
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const keepout = () => { const e = B('esp'); return { x: e.x - 8, y: 0, w: e.w + 16, h: e.y + 6.4 + 2 }; };
    const rules = [
      ['ESP32 antenna at the top board edge', () => B('esp').y <= 0.5],
      ['Nothing else inside the antenna keep-out', () => { const k = keepout(); return [...blocks, ...fixed].every((b) => b.id === 'esp' || !overlap(b, k)); }],
      ['Buck converter within 10 mm of the battery connector', () => dist(B('buck'), B('bat')) <= 10],
      ['Motor drivers within 8 mm of the motor connectors', () => dist(B('drv'), B('mot')) <= 8],
      ['IMU at least 25 mm from the buck and the motor drivers', () => dist(B('imu'), B('buck')) >= 25 && dist(B('imu'), B('drv')) >= 25],
      ['LDO within 8 mm of the ESP32 module', () => dist(B('ldo'), B('esp')) <= 8],
      ['No blocks overlapping each other or a connector', () => { const all = [...blocks, ...fixed]; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (overlap(all[i], all[j])) return false; return true; }],
    ];
    const lis = rules.map(([t]) => { const li = W.h('li', {}, t); rulesEl.append(li); return li; });
    function check() {
      let all = true;
      rules.forEach(([, f], i) => { const ok = f(); all = all && ok; lis[i].className = ok ? 'ok' : 'no'; lis[i].textContent = (ok ? '✓ ' : '✗ ') + rules[i][0]; });
      if (all) Book.solve('floor-task');
    }
    let scale = 1, ox = 0, oy = 0, drag = null;
    function draw() {
      clear(c);
      const x = c.ctx;
      scale = Math.min((c.w - 20) / BW, (c.h - 24) / BH); ox = (c.w - BW * scale) / 2; oy = 14;
      const R = (b) => [ox + b.x * scale, oy + b.y * scale, b.w * scale, b.h * scale];
      // board
      x.save(); x.fillStyle = 'rgba(28,120,60,0.18)'; x.strokeStyle = col('c3'); x.lineWidth = 2; x.fillRect(ox, oy, BW * scale, BH * scale); x.strokeRect(ox, oy, BW * scale, BH * scale); x.restore();
      // keep-out hatch
      const k = keepout();
      x.save(); x.beginPath(); x.rect(ox + k.x * scale, oy + k.y * scale, k.w * scale, k.h * scale); x.clip();
      x.strokeStyle = col('c4'); x.globalAlpha = 0.45; x.lineWidth = 1;
      for (let i = -200; i < 400; i += 8) { x.beginPath(); x.moveTo(ox + k.x * scale + i, oy); x.lineTo(ox + k.x * scale + i + 120, oy + 120); x.stroke(); }
      x.restore();
      // motor current loop
      const bat = B('bat'), drv = B('drv'), mot = B('mot');
      const [bx, by] = center(bat), [dx, dy] = center(drv), [mx, my] = center(mot);
      x.save(); x.strokeStyle = col('c4'); x.lineWidth = 3; x.globalAlpha = 0.55; x.setLineDash([6, 4]);
      x.beginPath(); x.moveTo(ox + bx * scale, oy + by * scale); x.lineTo(ox + dx * scale, oy + dy * scale); x.lineTo(ox + mx * scale, oy + my * scale); x.stroke(); x.restore();
      // fixed connectors
      fixed.forEach((b) => { const [X, Y, Wd, Ht] = R(b); x.save(); x.fillStyle = col(b.col); x.globalAlpha = 0.6; x.fillRect(X, Y, Wd, Ht); x.restore(); text(x, b.name, X + Wd / 2, Y + Ht / 2, { size: scale > 5 ? 10 : 8, bold: true, color: '#fff' }); });
      // blocks
      blocks.forEach((b) => {
        const [X, Y, Wd, Ht] = R(b);
        x.save(); x.fillStyle = col(b.col); x.globalAlpha = drag && drag.b === b ? 0.95 : 0.8; x.fillRect(X, Y, Wd, Ht); x.globalAlpha = 1; x.strokeStyle = col('ink'); x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, Wd, Ht);
        if (b.id === 'esp') { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(X, Y, Wd, 6.4 * scale); }
        x.restore();
        text(x, b.name, X + Wd / 2, Y + Ht / 2 + (b.id === 'esp' ? 6 : 0), { size: scale > 5 ? 11 : 8, bold: true, color: '#fff' });
        if (b.id === 'esp') text(x, 'antenna', X + Wd / 2, Y + 3.2 * scale, { size: 9, color: '#fff' });
      });
    }
    const pt = (e) => { const r = c.canvas.getBoundingClientRect(); return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale]; };
    c.canvas.style.touchAction = 'none'; c.canvas.style.cursor = 'grab';
    c.canvas.addEventListener('pointerdown', (e) => {
      const [px, py] = pt(e);
      for (let i = blocks.length - 1; i >= 0; i--) { const b = blocks[i]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { drag = { b, dx: px - b.x, dy: py - b.y }; c.canvas.setPointerCapture(e.pointerId); blocks.splice(i, 1); blocks.push(b); draw(); return; } }
    });
    c.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return; const [px, py] = pt(e);
      drag.b.x = Math.round(clamp(px - drag.dx, 0, BW - drag.b.w) * 2) / 2; drag.b.y = Math.round(clamp(py - drag.dy, 0, BH - drag.b.h) * 2) / 2;
      draw(); check();
    });
    const end = () => { if (drag) { drag = null; draw(); check(); } };
    c.canvas.addEventListener('pointerup', end); c.canvas.addEventListener('pointercancel', end);
    onTheme(draw);
    new ResizeObserver(() => draw()).observe(c.wrap);
    draw(); check();
  })();

  /* =====================================================================
   * Figure 9.9 — crosstalk vs spacing
   * ===================================================================== */
  (function xtalkFig() {
    const S = { s: 0.5, w: 0.2 };
    const p = W.plot('#w-xtalk', { xmin: 0, xmax: 3, ymin: 0, ymax: 100, xlabel: 'Edge-to-edge spacing s (mm)', ylabel: 'Relative crosstalk (%)', hover: true, height: 260, xunit: 'mm', yunit: '', xfmt: (v) => W.fix(v, 1) });
    const ctl = ctlOf('#w-xtalk-ctl');
    W.slider(ctl, { label: 'Spacing \\(s\\)', min: 0.1, max: 3, step: 0.05, value: S.s, format: (v) => v.toFixed(2) + ' mm', onInput: (v) => { S.s = v; upd(); } });
    W.slider(ctl, { label: 'Trace width', min: 0.1, max: 1, step: 0.05, value: S.w, format: (v) => v.toFixed(2) + ' mm', onInput: (v) => { S.w = v; upd(); } });
    const r2 = W.readout(ctl, { label: '2-layer', fmt: (v) => v.toFixed(1) + ' %' });
    const r4 = W.readout(ctl, { label: '4-layer', fmt: (v) => v.toFixed(1) + ' %' });
    const k = (s, h) => 100 / (1 + (s / h) * (s / h));
    function upd() {
      p.draw((p) => {
        p.fn((s) => k(s, 1.5), { color: 'c4', label: '2-layer: h = 1.5 mm', hoverFmt: (s, y) => `${s.toFixed(2)} mm → ${y.toFixed(1)} %` });
        p.fn((s) => k(s, 0.2), { color: 'c3', label: '4-layer: h = 0.2 mm', hoverFmt: (s, y) => `${s.toFixed(2)} mm → ${y.toFixed(1)} %` });
        p.vline(2 * S.w, { color: 'c5' });
        p.text(2 * S.w + 0.04, 92, '3W', { color: 'c5', size: 12 });
        p.vline(S.s, { color: 'muted', dash: [2, 3] });
        p.point(S.s, k(S.s, 1.5), { color: 'c4', r: 4 }); p.point(S.s, k(S.s, 0.2), { color: 'c3', r: 4 });
      });
      r2.set(k(S.s, 1.5)); r4.set(k(S.s, 0.2));
    }
    upd();
  })();

  /* =====================================================================
   * Figure 9.10 — block diagram
   * ===================================================================== */
  (function blockFig() {
    W.schematic('#w-block', {
      w: 760, h: 370, title: 'Block diagram of the ESP32-S3 robot controller',
      items: [
        { t: 'ic', id: 'usb', at: [75, 70], name: 'USB-C', right: ['VBUS', 'D+/D−'], w: 80 },
        { t: 'bat2', id: 'bat', a: [35, 195], b: [35, 255], label: '2S LiPo' },
        { t: 'gnd', at: [35, 255] },
        { t: 'ic', id: 'prot', at: [150, 175], name: 'Fuse + rev. pol.', left: ['IN'], right: ['OUT'], w: 100 },
        { t: 'wire', pts: [[35, 195], [35, 175], 'prot.IN'] },
        { t: 'ic', id: 'buck', at: [330, 175], name: 'Buck 5 V / 3 A', left: ['VIN'], right: ['5V'], w: 90 },
        { t: 'wire', pts: ['prot.OUT', 'buck.VIN'] },
        { t: 'dot', at: [240, 175] },
        { t: 'text', at: [240, 160], text: 'VBAT' },
        { t: 'ic', id: 'drv', at: [330, 300], name: '2× DRV8833', left: ['VM', 'IN ×8'], right: ['OUT ×4'], w: 100 },
        { t: 'wire', pts: [[240, 175], [240, 290], 'drv.VM'] },
        { t: 'tag', at: [470, 300], text: '4 DC motors' },
        { t: 'wire', pts: ['drv.OUT ×4', [425, 300]] },
        { t: 'ic', id: 'ldo', at: [470, 70], name: 'LDO 3.3 V', left: ['IN'], right: ['3V3'], w: 80 },
        { t: 'S', id: 'd1', a: [160, 60], b: [220, 60], label: 'D1' },
        { t: 'wire', pts: ['usb.VBUS', [160, 60]] },
        { t: 'wire', pts: [[220, 60], [395, 60], [395, 70], 'ldo.IN'] },
        { t: 'dot', at: [395, 70] },
        { t: 'ic', id: 'srv', at: [520, 175], name: 'Servo ×4', left: ['5V'], right: ['SIG'], w: 90 },
        { t: 'wire', pts: ['buck.5V', 'srv.5V'] },
        { t: 'dot', at: [420, 175] },
        { t: 'S', id: 'd2', a: [420, 175], b: [420, 115], label: 'D2' },
        { t: 'wire', pts: [[420, 115], [420, 108], [395, 108], [395, 70]] },
        { t: 'ic', id: 'esp', at: [660, 120], name: 'ESP32-S3', left: ['3V3', 'USB', 'PWM', 'I²C'], w: 100 },
        { t: 'wire', pts: ['ldo.3V3', [560, 70], [560, 90], 'esp.3V3'] },
        { t: 'wire', pts: ['usb.D+/D−', [145, 80], [145, 100], [575, 100], [575, 110], 'esp.USB'] },
        { t: 'wire', pts: ['esp.PWM', [590, 130], [590, 175], 'srv.SIG'] },
        { t: 'wire', pts: [[590, 175], [590, 340], [245, 340], [245, 310], 'drv.IN ×8'] },
        { t: 'dot', at: [590, 175] },
        { t: 'ic', id: 'imu', at: [665, 270], name: 'IMU + Qwiic', left: ['I²C'], w: 90 },
        { t: 'wire', pts: ['esp.I²C', [578, 150], [578, 270], 'imu.I²C'] },
        { t: 'text', at: [130, 305], text: 'VBAT ÷ 3.13 → ESP32 ADC' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 9.11 — power input schematic
   * ===================================================================== */
  (function pwrFig() {
    W.schematic('#w-pwr', {
      w: 830, h: 320, title: 'Power input: fuse, reverse-polarity P-MOSFET, bulk capacitor and 5 V buck converter',
      items: [
        { t: 'bat2', id: 'bat', a: [40, 230], b: [40, 290], label: '2S LiPo' },
        { t: 'gnd', at: [40, 290] },
        { t: 'fuse', id: 'f1', a: [70, 230], b: [130, 230], label: 'F1 5 A' },
        { t: 'wire', pts: [[40, 230], [70, 230]] },
        { t: 'pmos', id: 'q1', at: [190, 130], label: 'Q1' },
        { t: 'wire', pts: [[130, 230], [205, 230], 'q1.D'] },
        { t: 'wire', pts: ['q1.G', [145, 130]] },
        { t: 'R', id: 'rg', a: [145, 130], b: [145, 190], label: 'R1 100k', side: -1 },
        { t: 'gnd', at: [145, 190] },
        { t: 'Z', id: 'zg', a: [145, 130], b: [145, 80], label: 'D1 12 V' },
        { t: 'dot', at: [145, 130] },
        { t: 'wire', pts: [[145, 80], [205, 80]] },
        { t: 'wire', pts: ['q1.S', [205, 80], [375, 80], [375, 95], 'u1.VIN'] },
        { t: 'dot', at: [205, 80] },
        { t: 'Cpol', id: 'cb', a: [255, 80], b: [255, 140] },
        { t: 'gnd', at: [255, 140] },
        { t: 'text', at: [255, 172], text: '220 µF' },
        { t: 'C', id: 'cin', a: [310, 80], b: [310, 140] },
        { t: 'gnd', at: [310, 140] },
        { t: 'text', at: [310, 172], text: '10 µF' },
        { t: 'dot', at: [255, 80] }, { t: 'dot', at: [310, 80] },
        { t: 'text', at: [282, 64], text: 'VBAT' },
        { t: 'ic', id: 'u1', at: [460, 125], name: 'TPS563201 (buck)', left: ['VIN', 'EN', 'GND'], right: ['VBST', 'SW', 'VFB'], w: 110, pitch: 30 },
        { t: 'wire', pts: ['u1.EN', [375, 125], [375, 95]] },
        { t: 'dot', at: [375, 95] },
        { t: 'wire', pts: ['u1.GND', [375, 155], [375, 165]] },
        { t: 'gnd', at: [375, 165] },
        { t: 'C', id: 'cbst', a: [555, 95], b: [555, 125] },
        { t: 'text', at: [555, 80], text: '100 nF' },
        { t: 'wire', pts: ['u1.VBST', [555, 95]] },
        { t: 'wire', pts: ['u1.SW', [555, 125], [580, 125]] },
        { t: 'L', id: 'l1', a: [580, 125], b: [645, 125], label: 'L1 3.3 µH' },
        { t: 'wire', pts: [[645, 125], [820, 125]] },
        { t: 'C', id: 'cout', a: [680, 125], b: [680, 170], label: '2× 22 µF' },
        { t: 'gnd', at: [680, 170] },
        { t: 'dot', at: [680, 125] }, { t: 'dot', at: [770, 125] },
        { t: 'R', id: 'r1', a: [770, 125], b: [770, 190], label: 'R3 56k' },
        { t: 'R', id: 'r2', a: [770, 210], b: [770, 270], label: 'R4 10k' },
        { t: 'wire', pts: [[770, 190], [770, 210]] },
        { t: 'gnd', at: [770, 270] },
        { t: 'dot', at: [770, 200] },
        { t: 'wire', pts: [[770, 200], [600, 200], [600, 155], 'u1.VFB'] },
        { t: 'text', at: [808, 108], text: '5 V' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 9.12 — USB-C, LDO, battery monitor, Qwiic
   * ===================================================================== */
  (function usbFig() {
    W.schematic('#w-usb', {
      w: 720, h: 260, title: 'USB-C sink with CC pull-downs, Schottky OR-ing and 3.3 V LDO',
      items: [
        { t: 'ic', id: 'j', at: [80, 145], name: 'USB-C', right: ['VBUS', 'CC1', 'CC2', 'GND', 'D+', 'D−'], w: 80, pitch: 30 },
        { t: 'R', id: 'rc1', a: [160, 100], b: [220, 100], label: 'R1 5.1k' },
        { t: 'R', id: 'rc2', a: [160, 130], b: [220, 130], label: 'R2 5.1k', side: -1 },
        { t: 'wire', pts: ['j.CC1', [160, 100]] }, { t: 'wire', pts: ['j.CC2', [160, 130]] },
        { t: 'wire', pts: [[220, 100], [250, 100], [250, 160]] }, { t: 'wire', pts: [[220, 130], [250, 130]] },
        { t: 'dot', at: [250, 130] }, { t: 'dot', at: [250, 160] },
        { t: 'wire', pts: ['j.GND', [280, 160]] },
        { t: 'gnd', at: [280, 160] },
        { t: 'wire', pts: ['j.VBUS', [230, 70]] },
        { t: 'S', id: 'd1', a: [230, 70], b: [290, 70], label: 'D1' },
        { t: 'wire', pts: [[290, 70], [395, 70], [395, 80]] },
        { t: 'S', id: 'd2', a: [360, 25], b: [360, 70], label: 'D2', side: -1 },
        { t: 'text', at: [360, 12], text: 'from 5 V buck' },
        { t: 'dot', at: [360, 70] },
        { t: 'C', id: 'ci', a: [325, 70], b: [325, 120], label: '1 µF', side: -1 },
        { t: 'dot', at: [325, 70] },
        { t: 'gnd', at: [325, 120] },
        { t: 'ic', id: 'ldo', at: [470, 90], name: 'AP2112K-3.3', left: ['VIN', 'EN'], right: ['VOUT'], bottom: ['GND'], w: 90 },
        { t: 'wire', pts: [[395, 80], 'ldo.VIN'] },
        { t: 'wire', pts: ['ldo.EN', [395, 100], [395, 80]] },
        { t: 'dot', at: [395, 80] },
        { t: 'gnd', at: [470, 138] },
        { t: 'wire', pts: ['ldo.VOUT', [640, 90]] },
        { t: 'C', id: 'co', a: [600, 90], b: [600, 130], label: '10 µF' },
        { t: 'gnd', at: [600, 130] },
        { t: 'dot', at: [600, 90] },
        { t: 'vcc', at: [640, 90], label: '3V3' },
        { t: 'ic', id: 'esp', at: [650, 215], name: 'ESP32-S3', left: ['GPIO20', 'GPIO19'], w: 90, pitch: 30 },
        { t: 'wire', pts: ['j.D+', [560, 190], [560, 200], 'esp.GPIO20'] },
        { t: 'wire', pts: ['j.D−', [570, 220], [570, 230], 'esp.GPIO19'] },
      ],
    });
    W.schematic('#w-usb', {
      w: 720, h: 290, title: 'Battery voltage divider into an ADC pin and the Qwiic I2C connector with pull-ups',
      items: [
        { t: 'vcc', at: [60, 90], label: 'VBAT' },
        { t: 'R', id: 'r1', a: [60, 90], b: [60, 160], label: '100 kΩ' },
        { t: 'wire', pts: [[60, 160], [60, 180]] },
        { t: 'dot', at: [60, 170] },
        { t: 'R', id: 'r2', a: [60, 180], b: [60, 250], label: '47 kΩ' },
        { t: 'gnd', at: [60, 250] },
        { t: 'wire', pts: [[60, 170], [262, 170]] },
        { t: 'C', id: 'c1', a: [140, 170], b: [140, 230], label: '100 nF' },
        { t: 'gnd', at: [140, 230] },
        { t: 'dot', at: [140, 170] },
        { t: 'ic', id: 'esp', at: [330, 170], name: 'ESP32-S3', left: ['GPIO1'], right: ['SDA', 'SCL', '3V3', 'GND'], w: 100, pitch: 40 },
        { t: 'text', at: [200, 155], text: 'ADC1_CH0' },
        { t: 'ic', id: 'qw', at: [630, 170], name: 'Qwiic (JST-SH)', left: ['SDA', 'SCL', '3V3', 'GND'], w: 80, pitch: 40 },
        { t: 'wire', pts: ['esp.SDA', 'qw.SDA'] },
        { t: 'wire', pts: ['esp.SCL', 'qw.SCL'] },
        { t: 'wire', pts: ['esp.3V3', 'qw.3V3'] },
        { t: 'wire', pts: ['esp.GND', 'qw.GND'] },
        { t: 'R', id: 'rp1', a: [460, 110], b: [460, 60], label: 'R5 4.7k' },
        { t: 'dot', at: [460, 110] },
        { t: 'wire', pts: [[510, 150], [510, 100]] },
        { t: 'dot', at: [510, 150] },
        { t: 'R', id: 'rp2', a: [510, 100], b: [510, 60], label: 'R6 4.7k', side: -1 },
        { t: 'wire', pts: [[460, 60], [460, 45], [510, 45], [510, 60]] },
        { t: 'vcc', at: [485, 45], label: '3V3' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 9.13 — DRV8833 channel pair
   * ===================================================================== */
  (function drvFig() {
    W.schematic('#w-drv', {
      w: 760, h: 330, title: 'DRV8833 dual H-bridge with its decoupling and support capacitors',
      items: [
        { t: 'ic', id: 'esp', at: [90, 150], name: 'ESP32-S3', right: ['GPIO4', 'GPIO5', 'GPIO6', 'GPIO7', 'GPIO10', 'GPIO11'], w: 90, pitch: 30 },
        { t: 'ic', id: 'drv', at: [380, 150], name: 'DRV8833', left: ['AIN1', 'AIN2', 'BIN1', 'BIN2', 'nSLEEP', 'nFAULT'], right: ['VM', 'VCP', 'AOUT1', 'AOUT2', 'BOUT1', 'BOUT2'], bottom: ['VINT', 'GND'], w: 150, pitch: 30 },
        { t: 'wire', pts: ['esp.GPIO4', 'drv.AIN1'] },
        { t: 'wire', pts: ['esp.GPIO5', 'drv.AIN2'] },
        { t: 'wire', pts: ['esp.GPIO6', 'drv.BIN1'] },
        { t: 'wire', pts: ['esp.GPIO7', 'drv.BIN2'] },
        { t: 'wire', pts: ['esp.GPIO10', 'drv.nSLEEP'] },
        { t: 'wire', pts: ['esp.GPIO11', 'drv.nFAULT'] },
        { t: 'wire', pts: ['drv.VM', [505, 75], [505, 30], [700, 30]] },
        { t: 'C', id: 'cvcp', a: [490, 105], b: [490, 75], label: '10 nF', side: -1 },
        { t: 'wire', pts: ['drv.VCP', [490, 105]] },
        { t: 'dot', at: [490, 75] },
        { t: 'C', id: 'cvm', a: [560, 30], b: [560, 70], label: '10 µF' },
        { t: 'gnd', at: [560, 70] },
        { t: 'C', id: 'cvm2', a: [640, 30], b: [640, 70], label: '100 nF' },
        { t: 'gnd', at: [640, 70] },
        { t: 'dot', at: [560, 30] }, { t: 'dot', at: [640, 30] },
        { t: 'vcc', at: [700, 30], label: 'VBAT' },
        { t: 'ic', id: 'jm', at: [660, 180], name: 'Motor conn.', left: ['A+', 'A−', 'B+', 'B−'], w: 80, pitch: 30 },
        { t: 'wire', pts: ['drv.AOUT1', 'jm.A+'] },
        { t: 'wire', pts: ['drv.AOUT2', 'jm.A−'] },
        { t: 'wire', pts: ['drv.BOUT1', 'jm.B+'] },
        { t: 'wire', pts: ['drv.BOUT2', 'jm.B−'] },
        { t: 'C', id: 'cvint', a: [365, 268], b: [365, 300], label: '2.2 µF', side: -1 },
        { t: 'gnd', at: [365, 300] },
        { t: 'gnd', at: [395, 268] },
        { t: 'text', at: [540, 290], text: 'AISEN, BISEN → GND' },
        { t: 'text', at: [215, 268], text: 'nFAULT: 10k pull-up to 3V3' },
      ],
    });
  })();

  /* =====================================================================
   * Figure 9.14 — microstrip impedance
   * ===================================================================== */
  (function z0Fig() {
    const S = { w: 0.35, er: 4.4 };
    const p = W.plot('#w-z0', { xmin: 0.05, xmax: 4, ymin: 20, ymax: 160, logx: true, xlabel: 'Trace width w (mm, log)', ylabel: 'Z₀ (Ω)', hover: true, height: 270, xunit: 'mm', yunit: 'Ω', xfmt: (v) => W.fix(v, 2) });
    const ctl = ctlOf('#w-z0-ctl');
    W.slider(ctl, { label: 'Width \\(w\\)', min: 0.05, max: 4, log: true, value: S.w, format: (v) => v.toFixed(2) + ' mm', onInput: (v) => { S.w = v; upd(); } });
    W.slider(ctl, { label: '\\(\\varepsilon_r\\)', min: 3.5, max: 4.8, step: 0.05, value: S.er, format: (v) => v.toFixed(2), onInput: (v) => { S.er = v; upd(); } });
    const r2 = W.readout(ctl, { label: '2-layer', fmt: (v) => v.toFixed(0) + ' Ω' });
    const r4 = W.readout(ctl, { label: '4-layer', fmt: (v) => v.toFixed(0) + ' Ω' });
    const z = (w, h) => 87 / Math.sqrt(S.er + 1.41) * Math.log(5.98 * h / (0.8 * w + 0.035));
    function upd() {
      p.draw((p) => {
        p.hline(50, { color: 'c5' }); p.text(0.055, 54, '50 Ω', { color: 'c5', size: 11 });
        p.fn((w) => z(w, 1.5), { color: 'c4', label: '2-layer (h ≈ 1.5 mm)', hoverFmt: (w, y) => `${w.toFixed(2)} mm → ${y.toFixed(0)} Ω` });
        p.fn((w) => z(w, 0.21), { color: 'c3', label: '4-layer (h ≈ 0.21 mm)', hoverFmt: (w, y) => `${w.toFixed(2)} mm → ${y.toFixed(0)} Ω` });
        p.vline(S.w, { color: 'muted', dash: [2, 3] });
      });
      r2.set(z(S.w, 1.5)); r4.set(z(S.w, 0.21));
      r2.setClass(Math.abs(z(S.w, 1.5) - 50) < 3 ? 'good' : ''); r4.setClass(Math.abs(z(S.w, 0.21) - 50) < 3 ? 'good' : '');
    }
    upd();
  })();
})();
