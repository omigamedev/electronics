/* Level 2 · The Circle Road */
(function () {
  'use strict';

  /* ---- Toy 1: fix the holes in the road ---- */
  (function road() {
    const svg = K.svg('#t-road', 400, 280, { title: 'A battery and a bulb with holes in the wire', max: 440 });
    const bat = K.battery(svg, 70, 150, { rot: -90, w: 90, h: 44, label: '3 V' });
    const lamp = K.lamp(svg, 200, 70, { s: 0.85 });
    const [L, R] = lamp.pins;
    // wires with two holes: right side (y 120..175) and bottom (x 175..235)
    K.wire(svg, [bat.plus, [70, L[1]], L]);
    K.wire(svg, [R, [330, R[1]], [330, 118]]);
    K.wire(svg, [[330, 178], [330, 240], [238, 240]]);
    K.wire(svg, [[172, 240], [70, 240], bat.minus]);
    const holes = [
      { a: [330, 118], b: [330, 178], c: [330, 148] },
      { a: [238, 240], b: [172, 240], c: [205, 240] },
    ].map((h) => {
      const g = K.g(svg, { style: 'cursor:pointer' });
      const dash = K.add(g, 'line', { x1: h.a[0], y1: h.a[1], x2: h.b[0], y2: h.b[1], style: 'stroke:var(--muted);stroke-width:3;stroke-dasharray:6 7' });
      const piece = K.add(g, 'line', { x1: h.a[0], y1: h.a[1], x2: h.b[0], y2: h.b[1], style: 'stroke:var(--c3);stroke-width:7;stroke-linecap:round;opacity:0' });
      const ring = K.add(g, 'circle', { cx: h.c[0], cy: h.c[1], r: 27, style: 'fill:var(--accent2);stroke:var(--accent);stroke-width:3' });
      const q = K.emoji(g, h.c[0], h.c[1] + 1, '❓', 26);
      K.add(g, 'circle', { cx: h.c[0], cy: h.c[1], r: 34, style: 'fill:transparent' });
      const st = { ...h, g, dash, piece, ring, q, on: false };
      g.addEventListener('click', () => { st.on = !st.on; K.tone(st.on ? 660 : 330, 0.1, 'triangle'); update(); });
      return st;
    });
    const loop = [bat.minus, [70, 240], [330, 240], [330, R[1]], R, L, [70, L[1]], bat.plus, bat.minus];
    const flow = K.flow(svg, loop, { spacing: 36, r: 8, hideWhenStopped: true });
    const sad = K.text(svg, 200, 150, '', { size: 18, fill: 'var(--muted)' });
    let t = 0;
    function update() {
      holes.forEach((h) => { h.piece.style.opacity = h.on ? 1 : 0; h.ring.style.opacity = h.on ? 0 : 1; h.q.style.opacity = h.on ? 0 : 1; h.dash.style.opacity = h.on ? 0 : 1; });
      const done = holes.every((h) => h.on);
      flow.set(done ? 70 : 0);
      lamp.set(done ? 1 : 0);
      sad.textContent = done ? '' : (holes.some((h) => h.on) ? 'One more hole!' : '');
      if (done) K.win('road', '🔁 A full circle road! 💡');
    }
    W.anim((dt) => { t += dt; holes.forEach((h) => { if (!h.on) h.ring.setAttribute('r', 25 + Math.sin(t * 4) * 3); }); }, svg);
    update();
  })();

  /* ---- mini circuits for the "which one lights" quiz ---- */
  document.querySelectorAll('.mini[data-mini]').forEach((el) => {
    const kind = el.dataset.mini;
    const svg = K.svg(el, 160, 130, { cls: 'mini', title: 'circuit ' + kind });
    const bat = K.battery(svg, 38, 70, { rot: -90, w: 60, h: 30 });
    const lamp = K.lamp(svg, 100, 52, { s: 0.5 });
    const [L, R] = lamp.pins;
    K.wire(svg, [bat.plus, [38, L[1]], L], { width: 4 });
    if (kind === 'ok') K.wire(svg, [R, [140, R[1]], [140, 115], [38, 115], bat.minus], { width: 4 });
    if (kind === 'gap') { K.wire(svg, [R, [140, R[1]], [140, 115], [100, 115]], { width: 4 }); K.wire(svg, [[74, 115], [38, 115], bat.minus], { width: 4 }); }
    if (kind === 'one') { K.wire(svg, [R, [140, R[1]], [140, 122], [8, 122], [8, 22], [38, 22], bat.plus], { width: 4 }); }
  });

  /* ---- Toy 2: the drawbridge switch ---- */
  (function sw() {
    const svg = K.svg('#t-switch', 400, 280, { title: 'A battery, a bulb and a switch', max: 440 });
    const bat = K.battery(svg, 70, 150, { rot: -90, w: 90, h: 44, label: '3 V' });
    const lamp = K.lamp(svg, 200, 70, { s: 0.85 });
    const [L, R] = lamp.pins;
    const P = [330, 190], Q = [330, 110]; // pivot (bottom) and contact (top)
    K.wire(svg, [bat.plus, [70, L[1]], L]);
    K.wire(svg, [R, [330, R[1]], Q]);
    K.wire(svg, [P, [330, 240], [70, 240], bat.minus]);
    K.add(svg, 'circle', { cx: Q[0], cy: Q[1], r: 7, style: 'fill:var(--wire)' });
    K.add(svg, 'circle', { cx: P[0], cy: P[1], r: 8, style: 'fill:var(--wire)' });
    const lever = K.g(svg);
    K.add(lever, 'line', { x1: 0, y1: 0, x2: 0, y2: -82, style: 'stroke:var(--c2);stroke-width:9;stroke-linecap:round' });
    K.add(lever, 'circle', { cx: 0, cy: -84, r: 11, style: 'fill:var(--c4);stroke:var(--wire);stroke-width:2' });
    const lab = K.text(svg, 330, 262, 'OFF', { size: 18, weight: 700 });
    const hit = K.add(svg, 'rect', { x: 270, y: 70, width: 120, height: 150, rx: 20, style: 'fill:transparent;cursor:pointer' });
    const loop = [bat.minus, [70, 240], P, Q, [330, R[1]], R, L, [70, L[1]], bat.plus, bat.minus];
    const flow = K.flow(svg, loop, { spacing: 36, r: 8, hideWhenStopped: true });
    let closed = false, ang = -55, ons = 0;
    hit.addEventListener('click', () => {
      closed = !closed;
      K.tone(closed ? 880 : 440, 0.08, 'square', 0.05);
      if (closed) { ons++; if (ons >= 3) K.win('switch', '🌉 Drawbridge master!'); }
    });
    W.anim((dt) => {
      const target = closed ? 0 : -55;
      ang += (target - ang) * Math.min(1, dt * 14);
      K.place(lever, P[0], P[1], 1, ang);
      const on = closed && Math.abs(ang) < 3;
      lamp.set(on ? 1 : 0); flow.set(on ? 70 : 0);
      lab.textContent = closed ? 'ON (closed) ' + '✓'.repeat(Math.min(ons, 3)) : 'OFF (open) ' + '✓'.repeat(Math.min(ons, 3));
    }, svg);
    K.place(lever, P[0], P[1], 1, ang);
  })();
})();
