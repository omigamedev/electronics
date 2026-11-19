/* Level 3 · Pushers & Squeezers */
(function () {
  'use strict';

  function sparkDot(ctx, x, y, r) {
    ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = '#f08c00'; ctx.lineWidth = r * 0.15;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1d2026';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.12, r * 0.17, 0, 7); ctx.arc(x + r * 0.35, y - r * 0.12, r * 0.17, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1d2026'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.4, 0.3, Math.PI - 0.3); ctx.stroke();
  }

  /* ---- Toy 1: the battery water slide ---- */
  (function slide() {
    const host = W.$('#t-slide');
    let n = 1, path = null, slideLen = 0;
    const c = W.canvas(host, { height: 300, onResize: (st) => build(st) });
    const ctl = W.$('#t-slide-ctl');
    const minus = K.btn(ctl, '➖🔋', () => setN(n - 1), { title: 'Take away a battery' });
    const lab = W.h('span', { style: 'font-size:1.4rem;min-width:4.4em;display:inline-block' });
    ctl.append(lab);
    const plus = K.btn(ctl, '➕🔋', () => setN(n + 1), { title: 'Add a battery', cls: 'go' });
    const riders = Array.from({ length: 7 }, (_, i) => ({ f: i / 7 }));
    function build(st) {
      const { w, h } = st || c;
      const G = h - 36, H = n * 52, tx = 46, top = G - H;
      const pts = [];
      // slide: a wavy curve from the top of the tower down to the right
      const x0 = tx + 44, x1 = w - 30;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = x0 + (x1 - x0) * t;
        const y = top - 8 + (G - 8 - (top - 8)) * (t * t * (3 - 2 * t)) + Math.sin(t * Math.PI * 3) * 10 * (1 - t) * (n / 4);
        pts.push([x, y]);
      }
      const P1 = K.pathOf(pts).total;
      pts.push([x1, G + 14], [tx + 34, G + 14], [tx + 34, top - 8], [x0, top - 8]);
      path = K.pathOf(pts); slideLen = P1;
      path.pts = pts; path.G = G; path.top = top; path.tx = tx;
    }
    function setN(v) {
      v = W.clamp(v, 1, 4);
      if (v === n) return;
      n = v; build(); K.tone(300 + n * 120, 0.12, 'triangle');
      lab.textContent = '🔋'.repeat(n);
      minus.disabled = n === 1; plus.disabled = n === 4;
      if (n === 4) K.win('tower', '🛝 Wheee! The biggest push!');
    }
    lab.textContent = '🔋'; minus.disabled = true;
    build();
    W.anim((dt, t) => {
      const { ctx, w, h } = c;
      if (!path) return;
      ctx.clearRect(0, 0, w, h);
      const { G, top, tx, pts } = path;
      // ground
      ctx.fillStyle = W.col('c3'); ctx.globalAlpha = 0.25; ctx.fillRect(0, G + 4, w, h - G); ctx.globalAlpha = 1;
      // slide
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = W.col('c1'); ctx.lineWidth = 16;
      ctx.beginPath(); pts.slice(0, 41).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 10) : ctx.moveTo(x, y + 10))); ctx.stroke();
      ctx.strokeStyle = W.col('c6'); ctx.lineWidth = 4; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 60 * n;
      ctx.beginPath(); pts.slice(0, 41).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 6) : ctx.moveTo(x, y + 6))); ctx.stroke();
      ctx.setLineDash([]);
      // battery tower
      for (let i = 0; i < n; i++) {
        const y = G - (i + 1) * 52 + 2;
        ctx.fillStyle = '#343a40'; ctx.strokeStyle = W.col('wire'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(tx, y, 36, 48, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f08c00'; ctx.beginPath(); ctx.roundRect(tx, y, 36, 16, [7, 7, 0, 0]); ctx.fill();
        ctx.fillStyle = '#adb5bd'; ctx.fillRect(tx + 12, y - 4, 12, 4);
        ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', tx + 18, y + 9); ctx.fillText('−', tx + 18, y + 38);
      }
      // platform
      ctx.fillStyle = W.col('c2'); ctx.fillRect(tx - 4, top - 6, 52, 6);
      // label
      ctx.fillStyle = W.col('ink'); ctx.font = '600 20px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`push: ${W.fix(1.5 * n, 1)} volts`, w - 12, 10);
      // riders
      const vSlide = 70 + 55 * n, vWalk = 45 + 20 * n;
      riders.forEach((r) => {
        let d = r.f * path.total;
        d += (d < slideLen ? vSlide : vWalk) * dt;
        if (d >= path.total) d -= path.total;
        r.f = d / path.total;
        const [x, y] = path.at(d);
        sparkDot(ctx, x, y - (d < slideLen ? 4 : 0), 11);
      });
    }, c.canvas);
  })();

  /* ---- Toy 2: bright or dim ---- */
  (function bright() {
    const svg = K.svg('#t-bright', 400, 280, { title: 'Battery, bulb and a squeezy road', max: 440 });
    const bat = K.battery(svg, 70, 150, { rot: -90, w: 92, h: 44, label: '3 V' });
    const lamp = K.lamp(svg, 200, 76, { s: 0.9 });
    const [L, R] = lamp.pins;
    const Y = 236, X0 = 150, X1 = 260;
    K.wire(svg, [bat.plus, [70, L[1]], L]);
    K.wire(svg, [R, [330, R[1]], [330, Y], [X1, Y]]);
    K.wire(svg, [[X0, Y], [70, Y], bat.minus]);
    const tube = K.add(svg, 'path', { style: 'fill:color-mix(in srgb, var(--c2) 30%, var(--surface));stroke:var(--c2);stroke-width:3' });
    const squeezeLab = K.emoji(svg, (X0 + X1) / 2, Y + 32, '🤏', 22);
    const loop = [bat.minus, [70, Y], [330, Y], [330, R[1]], R, L, [70, L[1]], bat.plus, bat.minus];
    const flow = K.flow(svg, loop, { spacing: 34, r: 7, hideWhenStopped: true });
    const ctl = W.controls('#t-bright-ctl');
    let V = 3, sq = 1, touched = false;
    const RS = [0, 8, 20, 40, 80], RB = 10;
    W.segmented(ctl, { options: [[1, '🔋'], [2, '🔋🔋'], [3, '🔋🔋🔋']], value: 2, onChange: (v) => { V = 1.5 * v; touched = true; update(); } });
    W.slider(ctl, { label: '🤏', min: 0, max: 4, step: 1, value: 1, format: (v) => ['none', 'a bit', 'some', 'lots', 'LOTS!'][v], onInput: (v) => { sq = v; touched = true; update(); } });
    function update() {
      const I = V / (RB + RS[sq]);
      const P = I * I * RB, b = Math.sqrt(P / ((4.5 / RB) ** 2 * RB));
      lamp.set(b);
      flow.set(Math.max(8, 260 * I));
      bat.g.label.textContent = W.fix(V, 1) + ' V';
      const half = 13 - sq * 2.6;
      const xm = (X0 + X1) / 2;
      tube.setAttribute('d', `M ${X0} ${Y - 13} Q ${xm} ${Y - 13 + (13 - half) * 2} ${X1} ${Y - 13} L ${X1} ${Y + 13} Q ${xm} ${Y + 13 - (13 - half) * 2} ${X0} ${Y + 13} Z`);
      squeezeLab.style.opacity = sq ? 1 : 0.3;
      if (touched && b > 0.98) K.win('bright', '🌟 Super bright!');
      if (touched && b > 0.01 && b < 0.2) K.win('dim', '🌙 A cosy night light!');
    }
    update();
  })();
})();
