/* Level 6 · One Road or Two? */
(function () {
  'use strict';

  /* ---- Toy 1: series vs parallel ---- */
  (function roads() {
    const svg = K.svg('#t-roads', 400, 280, { title: 'Two bulbs joined in a line or side by side', max: 440 });
    const S = 0.75;
    function build(kind) {
      const g = K.g(svg);
      const bat = K.battery(g, 60, 175, { rot: -90, w: 90, h: 44, label: '3 V' });
      const lamps = [];
      let loops;
      if (kind === 's') {
        const A = K.lamp(g, 170, 100, { s: S }), B = K.lamp(g, 290, 100, { s: S });
        K.wire(g, [bat.plus, [60, A.pins[0][1]], A.pins[0]]);
        K.wire(g, [A.pins[1], B.pins[0]]);
        K.wire(g, [B.pins[1], [350, B.pins[1][1]], [350, 250], [60, 250], bat.minus]);
        lamps.push(A, B);
        loops = [[bat.minus, [60, 250], [350, 250], [350, 102], B.pins[1], B.pins[0], A.pins[1], A.pins[0], [60, 102], bat.plus, bat.minus]];
      } else {
        const A = K.lamp(g, 220, 100, { s: S }), B = K.lamp(g, 220, 196, { s: S });
        const y1 = A.pins[0][1], y2 = B.pins[0][1];
        K.wire(g, [bat.plus, [60, y1], A.pins[0]]);
        K.wire(g, [A.pins[1], [350, y1], [350, 250], [60, 250], bat.minus]);
        K.wire(g, [[110, y1], [110, y2], B.pins[0]]);
        K.wire(g, [B.pins[1], [310, y2], [310, y1]]);
        [[110, y1], [310, y1]].forEach(([x, y]) => K.add(g, 'circle', { cx: x, cy: y, r: 6, style: 'fill:var(--wire)' }));
        lamps.push(A, B);
        loops = [
          [bat.minus, [60, 250], [350, 250], [350, y1], A.pins[1], A.pins[0], [60, y1], bat.plus, bat.minus],
          [bat.minus, [60, 250], [350, 250], [350, y1], [310, y1], [310, y2], B.pins[1], B.pins[0], [110, y2], [110, y1], [60, y1], bat.plus, bat.minus],
        ];
      }
      const flows = loops.map((l) => K.flow(svg, l, { spacing: 40, r: 7, hideWhenStopped: true, parent: g }));
      const st = { g, lamps, flows, out: [false, false] };
      lamps.forEach((L, i) => {
        const hit = K.add(g, 'circle', { cx: L.pins[0][0] + 30 * S, cy: L.pins[0][1] - 52 * S, r: 46, style: 'fill:transparent;cursor:pointer' });
        const x = K.emoji(g, L.pins[0][0] + 30 * S, L.pins[0][1] - 40 * S, '', 30);
        L.x = x;
        hit.addEventListener('click', () => { st.out[i] = !st.out[i]; K.tone(st.out[i] ? 300 : 600, 0.1, 'triangle'); update(); });
      });
      return st;
    }
    const roads = { s: build('s'), p: build('p') };
    let mode = 's';
    const ctl = W.$('#t-roads-ctl');
    const bs = K.btn(ctl, '🚂 Line', () => setMode('s'), { title: 'Line road' });
    const bp = K.btn(ctl, '🛣️ Side by side', () => setMode('p'), { title: 'Side-by-side roads' });
    const msg = K.text(svg, 200, 272, '', { size: 16 });
    function setMode(m) { mode = m; K.tone(500, 0.08); update(); }
    function update() {
      bs.classList.toggle('on', mode === 's'); bp.classList.toggle('on', mode === 'p');
      for (const k of ['s', 'p']) {
        const r = roads[k];
        r.g.style.display = k === mode ? '' : 'none';
        let b;
        if (k === 's') { const ok = !r.out[0] && !r.out[1]; b = [ok ? 0.42 : 0, ok ? 0.42 : 0]; r.flows[0].set(ok ? 35 : 0); }
        else { b = r.out.map((o) => (o ? 0 : 1)); r.flows.forEach((f, i) => f.set(r.out[i] ? 0 : 70)); }
        r.lamps.forEach((L, i) => { L.set(r.out[i] ? 0 : b[i]); L.g.style.opacity = r.out[i] ? 0.15 : 1; L.x.textContent = r.out[i] ? '❌' : ''; });
      }
      const r = roads[mode], n = r.out.filter(Boolean).length;
      if (mode === 's') msg.textContent = n ? '🌑 One gap, and everything goes dark!' : '🔅 Both a bit dim: they share the push.';
      else msg.textContent = n === 2 ? 'No bulbs left!' : n ? '💡 The other bulb keeps shining!' : '💡💡 Both bright!';
      if (mode === 's' && n === 1) K.win('series-out', '🚂 One out, all out!');
      if (mode === 'p' && n === 1) K.win('parallel-out', '🛣️ Still shining!');
    }
    update();
  })();

  /* ---- Toy 2: Christmas lights ---- */
  (function xmas() {
    const svg = K.svg('#t-xmas', 400, 230, { title: 'A string of Christmas lights', max: 440 });
    const cols = ['#ff4040', '#40c057', '#4dabf7', '#ffd43b'];
    const N = 8, bad = 2 + Math.floor(Math.random() * 5);
    const bat = K.battery(svg, 52, 60, { rot: -90, w: 70, h: 36, label: '' });
    const pts = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push([60 + t * 310, 140 + Math.sin(t * Math.PI * 2) * 30]); }
    K.wire(svg, [bat.plus, [52, 14], [380, 14], [380, 140], ...pts.slice().reverse()], { width: 4, color: 'var(--c3)' });
    K.wire(svg, [pts[0], [52, 140], bat.minus], { width: 4, color: 'var(--c3)' });
    const blur = K.blur(svg, 7);
    let fixed = false, wob = new Array(N).fill(0);
    const bulbs = Array.from({ length: N }, (_, i) => {
      const t = (i + 0.5) / N, x = 60 + t * 310, y = 140 + Math.sin(t * Math.PI * 2) * 30;
      const g = K.g(svg, { style: 'cursor:pointer' });
      const halo = K.add(g, 'circle', { cx: 0, cy: 22, r: 18, style: `fill:${cols[i % 4]};opacity:0`, filter: blur });
      K.add(g, 'rect', { x: -6, y: 0, width: 12, height: 10, rx: 2, style: 'fill:var(--c3)' });
      const glass = K.add(g, 'ellipse', { cx: 0, cy: 24, rx: 10, ry: 15, style: `fill:color-mix(in srgb, ${cols[i % 4]} 30%, var(--surface));stroke:var(--wire);stroke-width:2` });
      const crack = K.add(g, 'path', { d: 'M -5 16 L 1 22 L -3 27 L 4 33', style: 'fill:none;stroke:var(--wire);stroke-width:1.5;opacity:0' });
      K.add(g, 'circle', { cx: 0, cy: 20, r: 26, style: 'fill:transparent' });
      K.place(g, x, y);
      g.addEventListener('click', () => {
        if (fixed) return;
        if (i === bad) { fixed = true; K.tone(990, 0.2, 'triangle'); paint(); K.win('xmas', '🎄 You fixed the lights!'); }
        else { wob[i] = 1; K.tone(330, 0.08, 'triangle'); glass.style.stroke = 'var(--c3)'; }
      });
      return { g, halo, glass, crack, x, y, col: cols[i % 4] };
    });
    function paint() {
      bulbs.forEach((b, i) => {
        b.halo.style.opacity = fixed ? 0.9 : 0;
        b.glass.style.fill = fixed ? b.col : `color-mix(in srgb, ${b.col} 30%, var(--surface))`;
        b.crack.style.opacity = !fixed && i === bad ? 0.45 : 0;
      });
    }
    W.anim((dt, t) => {
      bulbs.forEach((b, i) => {
        wob[i] = Math.max(0, wob[i] - dt * 2.5);
        const rot = Math.sin(wob[i] * 18) * 14 * wob[i] + (fixed ? Math.sin(t * 2 + i) * 4 : 0);
        K.place(b.g, b.x, b.y, 1, rot);
        if (fixed) b.halo.style.opacity = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.3);
      });
    }, svg);
    paint();
  })();
})();
