/* Level 7 · Magnet Magic & Spinning Motors */
(function () {
  'use strict';
  const RED = '#e03131', BLUE = '#1c7ed6';

  /** a bar magnet <g> centred on (0,0), length L; leftPole 'N' or 'S' */
  function magnet(parent, L = 130, H = 46, leftPole = 'S') {
    const g = K.g(parent);
    const lc = leftPole === 'N' ? RED : BLUE, rc = leftPole === 'N' ? BLUE : RED;
    K.add(g, 'rect', { x: -L / 2, y: -H / 2, width: L / 2, height: H, rx: 8, style: `fill:${lc}` });
    K.add(g, 'rect', { x: 0, y: -H / 2, width: L / 2, height: H, rx: 8, style: `fill:${rc}` });
    K.add(g, 'rect', { x: -L / 2, y: -H / 2, width: L, height: H, rx: 8, style: 'fill:none;stroke:var(--wire);stroke-width:2.5' });
    const t = (x, s) => K.add(g, 'text', { x, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'fill:#fff;font:700 24px system-ui, sans-serif' }, s);
    g.tl = t(-L / 4, leftPole); g.tr = t(L / 4, leftPole === 'N' ? 'S' : 'N');
    return g;
  }

  /* ---- Toy 1: pull or push ---- */
  (function mags() {
    const svg = K.svg('#t-mag', 400, 170, { title: 'Two bar magnets', max: 440 });
    const A = magnet(svg, 140, 50, 'S'); K.place(A, 90, 80); // right end of A is N
    const holder = K.g(svg);
    let flipped = false; // B's left end: N (same as A's right end) → push
    let B = magnet(holder, 140, 50, 'N');
    const msg = K.text(svg, 200, 150, '', { size: 18 });
    const STUCK = 160 + 70, FAR = 318;
    let x = FAR, v = 0, mode = 'idle', t = 0, flipAnim = 1;
    const ctl = W.$('#t-mag-ctl');
    const flipBtn = K.btn(ctl, '🔄 Flip', () => {
      if (mode === 'stuck') return;
      flipped = !flipped; holder.innerHTML = ''; B = magnet(holder, 140, 50, flipped ? 'S' : 'N'); flipAnim = 0; K.tone(500, 0.08, 'triangle'); msg.textContent = '';
    }, { title: 'Flip the magnet' });
    const pushBtn = K.btn(ctl, '🤏 Push together', () => {
      if (mode === 'stuck') { mode = 'apart'; t = 0; pushBtn.innerHTML = '🤏 Push together'; msg.textContent = ''; return; }
      mode = 'push'; t = 0; msg.textContent = '';
    }, { cls: 'go', title: 'Push them together' });
    void flipBtn;
    W.anim((dt) => {
      t += dt; flipAnim = Math.min(1, flipAnim + dt * 4);
      const attract = flipped;
      if (mode === 'push') {
        if (attract) {
          x -= (40 + (FAR - x) * 6) * dt; // speeds up as it gets close: the pull grows
          if (x <= STUCK) { x = STUCK; mode = 'stuck'; msg.textContent = '🤗 Click! N and S stick together!'; K.tone(1200, 0.06, 'square', 0.06); pushBtn.innerHTML = '↔️ Pull apart'; K.win('stick', '🧲 Click! They stick!'); }
        } else {
          x -= 120 * dt;
          if (x < STUCK + 40) { mode = 'bounce'; v = 420; msg.textContent = '🙅 Boing! The same ends push apart!'; K.tone(260, 0.15, 'triangle'); }
        }
      } else if (mode === 'bounce') {
        x += v * dt; v *= Math.pow(0.02, dt);
        if (x >= FAR) { x = FAR; mode = 'idle'; }
      } else if (mode === 'apart') {
        x += (FAR - x) * Math.min(1, dt * 6); if (FAR - x < 1) { x = FAR; mode = 'idle'; }
      }
      const wob = mode === 'bounce' ? Math.sin(t * 40) * 3 : 0;
      holder.setAttribute('transform', `translate(${x + wob} 80) scale(${Math.max(0.05, Math.abs(flipAnim * 2 - 1)).toFixed(2)} 1)`);
    }, svg);
  })();

  /* ---- Toy 2: iron filings ---- */
  (function field() {
    const host = W.$('#t-field');
    const c = W.canvas(host, { height: 260 });
    let bits = [], age = 0, shown = false;
    const mag = () => ({ cx: c.w / 2, cy: c.h / 2, L: Math.min(150, c.w * 0.38), H: 38 });
    function B(x, y) {
      const m = mag();
      const N = [m.cx + m.L / 2 - 10, m.cy], S = [m.cx - m.L / 2 + 10, m.cy];
      let bx = 0, by = 0;
      for (const [p, q] of [[N, 1], [S, -1]]) { const dx = x - p[0], dy = y - p[1], r2 = dx * dx + dy * dy + 30, r3 = r2 * Math.sqrt(r2); bx += q * dx / r3; by += q * dy / r3; }
      return [bx, by];
    }
    function sprinkle() {
      const m = mag();
      bits = [];
      let tries = 0;
      while (bits.length < 900 && tries++ < 5000) {
        const x = Math.random() * c.w, y = Math.random() * c.h;
        if (Math.abs(x - m.cx) < m.L / 2 + 6 && Math.abs(y - m.cy) < m.H / 2 + 6) continue;
        const [bx, by] = B(x, y);
        const s = Math.hypot(bx, by);
        if (Math.random() > Math.min(1, s * 9000 + 0.12)) continue; // denser where the field is strong
        bits.push({ x, y, a: Math.random() * Math.PI, t: Math.atan2(by, bx), d: Math.random() * 0.6 });
      }
      age = 0; shown = true;
      K.tone(900, 0.3, 'triangle', 0.03);
    }
    const ctl = W.$('#t-field-ctl');
    K.btn(ctl, '✨ Sprinkle!', sprinkle, { cls: 'go', title: 'Sprinkle iron bits' });
    K.btn(ctl, '🧹', () => { bits = []; shown = false; }, { title: 'Sweep them away' });
    W.anim((dt) => {
      const { ctx, w, h } = c;
      age += dt;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = W.col('ink'); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const b of bits) {
        if (age < b.d) continue;
        let d = b.t - b.a; d = ((d + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
        b.a += d * Math.min(1, dt * 3);
        const ca = Math.cos(b.a) * 4.5, sa = Math.sin(b.a) * 4.5;
        ctx.globalAlpha = Math.min(1, (age - b.d) * 3);
        ctx.beginPath(); ctx.moveTo(b.x - ca, b.y - sa); ctx.lineTo(b.x + ca, b.y + sa); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const m = mag();
      ctx.fillStyle = BLUE; ctx.beginPath(); ctx.roundRect(m.cx - m.L / 2, m.cy - m.H / 2, m.L / 2, m.H, [8, 0, 0, 8]); ctx.fill();
      ctx.fillStyle = RED; ctx.beginPath(); ctx.roundRect(m.cx, m.cy - m.H / 2, m.L / 2, m.H, [0, 8, 8, 0]); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('S', m.cx - m.L / 4, m.cy + 1); ctx.fillText('N', m.cx + m.L / 4, m.cy + 1);
      if (shown && age > 2) K.win('sprinkle', '✨ You can see the field!');
    }, c.canvas);
  })();

  /* ---- Toy 3: electromagnet ---- */
  (function emag() {
    const svg = K.svg('#t-emag', 400, 290, { title: 'A nail electromagnet picking up paper clips', max: 440 });
    const NX = 220, TOP = 30, TIP = 170;
    const bat = K.battery(svg, 70, 150, { rot: -90, w: 90, h: 44, label: '1.5 V' });
    K.add(svg, 'rect', { x: 0, y: 268, width: 400, height: 22, style: 'fill:color-mix(in srgb, var(--c2) 25%, var(--surface2))' });
    // nail
    K.add(svg, 'rect', { x: NX - 28, y: TOP, width: 56, height: 10, rx: 3, style: 'fill:#adb5bd;stroke:var(--wire);stroke-width:2' });
    K.add(svg, 'path', { d: `M ${NX - 9} ${TOP + 10} L ${NX + 9} ${TOP + 10} L ${NX + 9} ${TIP - 14} L ${NX} ${TIP} L ${NX - 9} ${TIP - 14} Z`, style: 'fill:#ced4da;stroke:var(--wire);stroke-width:2' });
    const coil = K.g(svg);
    const wA = K.wire(svg, [], { width: 4, color: 'var(--c2)' }), wB = K.wire(svg, [], { width: 4, color: 'var(--c2)' });
    const glow = K.add(svg, 'ellipse', { cx: NX, cy: (TOP + TIP) / 2, rx: 46, ry: 90, style: 'fill:var(--c5);opacity:0', filter: K.blur(svg, 14) });
    svg.insertBefore(glow, svg.children[1]);
    const clipG = K.g(svg);
    const NCLIP = 7;
    const clips = Array.from({ length: NCLIP }, (_, i) => {
      const g = K.g(clipG);
      K.add(g, 'rect', { x: -6, y: -10, width: 12, height: 20, rx: 6, style: 'fill:none;stroke:var(--c1);stroke-width:2.5' });
      K.add(g, 'rect', { x: -3, y: -6, width: 6, height: 13, rx: 3, style: 'fill:none;stroke:var(--c1);stroke-width:2' });
      return { g, x: 0, y: 0, rest: [NX - 66 + i * 22, 256], rot: (i % 2 ? 70 : 110) + (i % 3) * 8 };
    });
    let turns = 10, on = false;
    function drawCoil() {
      coil.innerHTML = '';
      const n = turns / 5 * 2, y0 = TOP + 22, y1 = TIP - 24;
      for (let i = 0; i < n; i++) {
        const y = y0 + (y1 - y0) * (n === 1 ? 0.5 : i / (n - 1));
        K.add(coil, 'ellipse', { cx: NX, cy: y, rx: 16, ry: 4.5, style: 'fill:none;stroke:var(--c2);stroke-width:3.5' });
      }
      wA.setAttribute('points', `${NX - 16},${y0} ${NX - 60},${y0} ${NX - 60},14 70,14 ${bat.plus[0]},${bat.plus[1]}`);
      wB.setAttribute('points', `${NX + 16},${y1} ${NX + 60},${y1} ${NX + 60},236 70,236 ${bat.minus[0]},${bat.minus[1]}`);
    }
    const ctl = W.controls('#t-emag-ctl');
    W.slider(ctl, { label: '🌀', min: 5, max: 30, step: 5, value: turns, format: (v) => v + ' turns', onInput: (v) => { turns = v; drawCoil(); } });
    const btn = K.btn(ctl, '⚡ ON', () => { on = !on; btn.innerHTML = on ? '⏹️ OFF' : '⚡ ON'; btn.classList.toggle('on', on); K.tone(on ? 700 : 300, 0.12); }, { cls: 'go', title: 'Switch on' });
    const count = K.text(svg, 330, 120, '', { size: 22 });
    drawCoil();
    W.anim((dt) => {
      const lift = on ? Math.round(turns / 5) : 0;
      glow.style.opacity = on ? 0.15 + turns / 60 : 0;
      clips.forEach((c, i) => {
        const tx = i < lift ? NX : c.rest[0], ty = i < lift ? TIP + 10 + i * 17 : c.rest[1];
        if (!c.init) { c.x = tx; c.y = ty; c.init = true; }
        c.x += (tx - c.x) * Math.min(1, dt * (i < lift ? 8 : 5)); c.y += (ty - c.y) * Math.min(1, dt * (i < lift ? 8 : 4));
        K.place(c.g, c.x, c.y, 1, i < lift ? (i % 2 ? 8 : -8) : c.rot);
      });
      count.textContent = lift ? '📎 × ' + lift : '';
      if (lift >= 5) K.win('clips', '📎 Super strong electromagnet!');
    }, svg);
  })();

  /* ---- Toy 4: motor and generator ---- */
  (function crank() {
    const svg = K.svg('#t-crank', 400, 250, { title: 'A motor that can also be a generator', max: 440 });
    const C = [200, 120];
    // body
    K.add(svg, 'line', { x1: 110, y1: C[1], x2: 300, y2: C[1], style: 'stroke:#adb5bd;stroke-width:7;stroke-linecap:round' });
    K.add(svg, 'rect', { x: 150, y: 70, width: 100, height: 100, rx: 18, style: 'fill:var(--surface);stroke:var(--wire);stroke-width:3' });
    K.add(svg, 'path', { d: `M ${C[0] - 40} ${C[1] - 22} A 46 46 0 0 1 ${C[0] - 40} ${C[1] + 22}`, style: `fill:none;stroke:${RED};stroke-width:10` });
    K.add(svg, 'path', { d: `M ${C[0] + 40} ${C[1] - 22} A 46 46 0 0 0 ${C[0] + 40} ${C[1] + 22}`, style: `fill:none;stroke:${BLUE};stroke-width:10` });
    const rotor = K.g(svg);
    K.add(rotor, 'rect', { x: -30, y: -7, width: 60, height: 14, rx: 4, style: 'fill:var(--c2)' });
    for (let i = -3; i <= 3; i++) K.add(rotor, 'line', { x1: i * 7, y1: -9, x2: i * 7, y2: 9, style: 'stroke:#e8590c;stroke-width:3' });
    // motor-mode parts
    const motorG = K.g(svg);
    const bat = K.battery(motorG, 60, 200, { w: 80, h: 36, label: '' });
    K.wire(motorG, [bat.plus, [165, 200], [165, 170]], { width: 4 });
    K.wire(motorG, [bat.minus, [10, 200], [10, 60], [235, 60], [235, 70]], { width: 4 });
    const fan = K.g(motorG);
    for (let i = 0; i < 3; i++) K.add(fan, 'ellipse', { cx: 0, cy: -26, rx: 10, ry: 26, transform: `rotate(${i * 120})`, style: 'fill:var(--c6);stroke:var(--wire);stroke-width:2' });
    K.add(fan, 'circle', { r: 7, style: 'fill:var(--wire)' });
    // generator-mode parts
    const genG = K.g(svg);
    const lamp = K.lamp(genG, 340, 226, { s: 0.7 });
    K.wire(genG, [[235, 170], [235, 244], [lamp.pins[0][0], 244], lamp.pins[0]], { width: 4 });
    K.wire(genG, [[250, 90], [385, 90], [385, lamp.pins[1][1]], lamp.pins[1]], { width: 4 });
    const handle = K.g(genG);
    K.add(handle, 'line', { x1: 0, y1: 0, x2: 0, y2: -52, style: 'stroke:var(--c5);stroke-width:9;stroke-linecap:round' });
    K.add(handle, 'circle', { cx: 0, cy: -56, r: 14, style: 'fill:var(--c4);stroke:var(--wire);stroke-width:2' });
    K.add(handle, 'circle', { r: 8, style: 'fill:var(--c5)' });
    const hint = K.emoji(genG, 60, 40, '👆', 26);
    const zone = K.add(genG, 'circle', { cx: 110, cy: C[1], r: 80, style: 'fill:transparent;cursor:grab' });
    const meter = K.text(genG, 200, 20, '', { size: 18 });
    let mode = 'gen', ang = 0, speed = 0, push = 1, dragA = null;
    const ctl = W.$('#t-crank-ctl');
    const bm = K.btn(ctl, '🔋 Motor', () => setMode('motor'), { title: 'Motor mode' });
    const bg = K.btn(ctl, '✋ Generator', () => setMode('gen'), { title: 'Generator mode' });
    const ctl2 = W.$('#t-crank-ctl2');
    const crankBtn = K.btn(ctl2, '🔁 Crank!', () => { speed = Math.min(4, speed + 0.9); K.tone(300 + speed * 80, 0.06, 'triangle', 0.05); }, { cls: 'go', title: 'Crank the handle' });
    const pushRow = W.h('div', { class: 'w-controls', style: 'margin:0' });
    ctl2.append(pushRow);
    W.slider(pushRow, { label: '🔋', min: 0, max: 3, step: 1, value: 1, format: (v) => v ? '🔋'.repeat(v) : 'off', onInput: (v) => { push = v; } });
    function setMode(m) {
      mode = m; speed = 0;
      bm.classList.toggle('on', m === 'motor'); bg.classList.toggle('on', m === 'gen');
      motorG.style.display = m === 'motor' ? '' : 'none'; genG.style.display = m === 'gen' ? '' : 'none';
      crankBtn.style.display = m === 'gen' ? '' : 'none'; pushRow.style.display = m === 'motor' ? '' : 'none';
    }
    // drag the handle round in circles
    const toLocal = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * 400 / r.width, (e.clientY - r.top) * 250 / r.height]; };
    zone.addEventListener('pointerdown', (e) => { zone.setPointerCapture(e.pointerId); const [x, y] = toLocal(e); dragA = Math.atan2(y - C[1], x - 110); hint.style.display = 'none'; });
    zone.addEventListener('pointermove', (e) => {
      if (dragA == null) return;
      const [x, y] = toLocal(e); const a = Math.atan2(y - C[1], x - 110);
      let d = a - dragA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      dragA = a; speed = Math.min(4, speed + Math.abs(d) * 0.55); ang += d * 180 / Math.PI;
    });
    const up = () => { dragA = null; };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    W.anim((dt) => {
      if (mode === 'motor') speed += (push * 1.1 - speed) * Math.min(1, dt * 2);
      else speed = Math.max(0, speed - dt * 0.9);
      ang += speed * 360 * dt * 0.5;
      K.place(rotor, C[0], C[1], 1, ang);
      K.place(fan, 300, C[1], 1, ang * 1);
      K.place(handle, 110, C[1], 1, ang);
      const b = Math.min(1, speed / 2.6);
      lamp.set(mode === 'gen' ? b : 0);
      meter.textContent = mode === 'gen' ? (b > 0.85 ? '💡 Bright! You made electricity!' : speed > 0.1 ? 'Faster! ⚡' : '') : (push ? '🌀 Spin!' : '');
      if (mode === 'gen' && b > 0.85) K.win('crank', '💡 You are a power station!');
    }, svg);
    setMode('gen');
  })();
})();
