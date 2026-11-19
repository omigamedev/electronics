/* Level 4 · Who Lets Sparky Through? */
(function () {
  'use strict';

  /* ---- Toy 1: the Sparky tester ---- */
  (function tester() {
    const ITEMS = [
      ['🥄', 'spoon', true], ['📎', 'paper clip', true], ['🔑', 'key', true], ['💍', 'ring', true],
      ['🧸', 'teddy', false], ['🪵', 'wood', false], ['🖍️', 'crayon', false], ['🧦', 'sock', false], ['🥤', 'plastic cup', false],
    ];
    const svg = K.svg('#t-tester', 400, 290, { title: 'A tester: battery, bulb and a gap', max: 440 });
    const bat = K.battery(svg, 62, 150, { rot: -90, w: 90, h: 44, label: '3 V' });
    const lamp = K.lamp(svg, 200, 76, { s: 0.85 });
    const [L, R] = lamp.pins;
    const Y = 236, GA = 160, GB = 240; // gap between x=GA and x=GB on the bottom wire
    K.wire(svg, [bat.plus, [62, L[1]], L]);
    K.wire(svg, [R, [338, R[1]], [338, Y], [GB, Y]]);
    K.wire(svg, [[GA, Y], [62, Y], bat.minus]);
    // clips
    [GA, GB].forEach((x) => K.add(svg, 'circle', { cx: x, cy: Y, r: 9, style: 'fill:var(--c4);stroke:var(--wire);stroke-width:2' }));
    const zone = K.add(svg, 'rect', { x: GA + 8, y: Y - 36, width: GB - GA - 16, height: 72, rx: 14, style: 'fill:var(--accent2);stroke:var(--accent);stroke-width:2.5;stroke-dasharray:7 6' });
    const hint = K.emoji(svg, (GA + GB) / 2, Y, '❓', 30);
    const item = K.emoji(svg, (GA + GB) / 2, Y, '', 50);
    const verdict = K.text(svg, 214, 156, '', { size: 16 });
    const loop = [bat.minus, [62, Y], [338, Y], [338, R[1]], R, L, [62, L[1]], bat.plus, bat.minus];
    const flow = K.flow(svg, loop, { spacing: 34, r: 7, hideWhenStopped: true });
    const tested = new Set();
    let drop = 0;
    function place(i) {
      const [emo, name, ok] = ITEMS[i];
      item.textContent = emo; hint.textContent = ''; drop = 1;
      zone.style.stroke = ok ? 'var(--good)' : 'var(--bad)';
      lamp.set(ok ? 1 : 0); flow.set(ok ? 70 : 0);
      verdict.textContent = ok ? `✅ The ${name} lets Sparky through!` : `🛑 The ${name} blocks Sparky.`;
      verdict.style.fill = ok ? 'var(--good)' : 'var(--bad)';
      if (ok) K.tone(880, 0.15, 'triangle'); else K.tone(200, 0.2, 'square', 0.04);
      Book.speak(ok ? `Yes! The ${name} lets Sparky through!` : `The ${name} blocks Sparky.`);
      tested.add(i);
      btns[i].querySelector('.badge').textContent = ok ? '💡' : '🛑';
      if (tested.size >= 5) K.win('test5', '🧪 Great science!');
    }
    W.anim((dt) => { if (drop > 0) { drop = Math.max(0, drop - dt * 4); item.setAttribute('y', Y - 40 * drop * drop); } }, svg);
    // tray (tap or drag)
    const tray = W.$('#t-tray');
    const btns = ITEMS.map(([emo, name], i) => {
      const b = K.btn(tray, emo + '<span class="badge"></span>', null, { title: name });
      let ghost = null, sx = 0, sy = 0, dragging = false;
      b.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; dragging = false; b.setPointerCapture(e.pointerId); });
      b.addEventListener('pointermove', (e) => {
        if (!b.hasPointerCapture(e.pointerId)) return;
        if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { dragging = true; ghost = W.h('div', { class: 'drag-ghost' }, emo); document.body.append(ghost); }
        if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
      });
      const end = (e) => {
        if (ghost) { ghost.remove(); ghost = null; }
        if (dragging) {
          const r = svg.getBoundingClientRect();
          if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) place(i);
        } else if (e.type === 'pointerup') place(i);
        dragging = false;
      };
      b.addEventListener('pointerup', end);
      b.addEventListener('pointercancel', end);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(i); } });
      return b;
    });
  })();

  /* ---- Toy 2: peel the wire ---- */
  (function peel() {
    const svg = K.svg('#t-peel', 400, 150, { title: 'A wire with a plastic coat', max: 440 });
    const Y = 70;
    // copper strands
    const cu = K.g(svg);
    for (let i = -2; i <= 2; i++) K.add(cu, 'line', { x1: 20, y1: Y + i * 4, x2: 380, y2: Y + i * 4, style: 'stroke:#e8590c;stroke-width:4;stroke-linecap:round' });
    K.add(cu, 'line', { x1: 20, y1: Y - 6, x2: 380, y2: Y - 6, style: 'stroke:#ffc078;stroke-width:2;stroke-linecap:round;opacity:.8' });
    const flow = K.flow(svg, [[16, Y], [384, Y]], { spacing: 40, r: 7, speed: 40 });
    // coat: left part stays, right part slides off
    const coatL = K.add(svg, 'rect', { x: 50, y: Y - 22, width: 160, height: 44, rx: 12, style: 'fill:var(--c4);stroke:var(--wire);stroke-width:2' });
    const coatR = K.add(svg, 'rect', { x: 206, y: Y - 22, width: 150, height: 44, rx: 12, style: 'fill:var(--c4);stroke:var(--wire);stroke-width:2' });
    const shine = K.add(svg, 'rect', { x: 60, y: Y - 15, width: 280, height: 6, rx: 3, style: 'fill:#fff;opacity:.35' });
    const labCu = K.text(svg, 300, 122, '', { size: 17 });
    K.text(svg, 130, 122, 'plastic coat 🧥', { size: 17 });
    void coatL; void flow;
    let peeled = false, x = 0;
    const ctl = W.$('#t-peel-ctl');
    K.btn(ctl, '✂️ Peel!', () => { peeled = true; K.tone(500, 0.3, 'sawtooth', 0.03); }, { cls: 'go', title: 'Peel the coat' });
    K.btn(ctl, '🔄', () => { peeled = false; }, { title: 'Put the coat back' });
    W.anim((dt) => {
      const target = peeled ? 1 : 0;
      x += (target - x) * Math.min(1, dt * 5);
      coatR.setAttribute('x', 206 + x * 150);
      coatR.style.opacity = 1 - x * 0.85;
      shine.setAttribute('width', 280 - x * 130);
      labCu.textContent = x > 0.5 ? 'copper metal ✨' : '';
      if (peeled && x > 0.9) K.win('peel', '✂️ Shiny copper inside!');
    }, svg);
  })();
})();
