/* Level 1 · Meet Sparky! */
(function () {
  'use strict';

  /* ---- Toy 1: tap Sparky to say hi ---- */
  (function hello() {
    const svg = K.svg('#t-hello', 300, 190, { title: 'Sparky the electron', max: 320 });
    const shadow = K.add(svg, 'ellipse', { cx: 150, cy: 172, rx: 46, ry: 8, style: 'fill:var(--line)' });
    const sp = K.sparky(svg, 150, 105, 50);
    const bubble = K.text(svg, 150, 22, '', { size: 18 });
    const hit = K.add(svg, 'circle', { cx: 150, cy: 100, r: 75, style: 'fill:transparent;cursor:pointer' });
    const lines = ['Hi! I am Sparky!', 'Wheee!', 'Let\'s explore!', 'Zoom zoom!', 'You are awesome!'];
    let jump = 0, k = 0, spin = 0;
    hit.addEventListener('click', () => {
      jump = 1; spin = (k % 2) ? 360 : 0;
      const l = lines[k++ % lines.length];
      bubble.textContent = l;
      K.tone(520 + (k % 4) * 120, 0.12, 'triangle');
      Book.speak(l);
    });
    W.anim((dt, t) => {
      jump = Math.max(0, jump - dt * 1.6);
      const hop = Math.sin(jump * Math.PI) * 45;
      const bob = Math.sin(t * 2.2) * 4;
      sp.move(150, 105 - hop + bob, 1, spin * (1 - jump) * (jump > 0 ? 1 : 0));
      shadow.setAttribute('rx', 46 - hop * 0.4);
    }, svg);
  })();

  /* ---- Toy 2: zoom into a spoon ---- */
  (function zoom() {
    const host = W.$('#t-zoom');
    let level = 0, fade = 1;
    const c = W.canvas(host, { height: 260 });
    const ctl = K.row(host);
    const out = K.btn(ctl, '🔍➖', () => go(-1), { title: 'Zoom out' });
    const inn = K.btn(ctl, '🔍➕', () => go(1), { title: 'Zoom in', cls: 'go' });
    const names = ['🥄 a spoon', '⚪ atoms', '⚡ Sparkies!'];
    const lab = W.h('span', { style: 'font-size:1.2rem;font-weight:600;min-width:7em' }, names[0]);
    ctl.insertBefore(lab, inn);
    function go(d) {
      const n = W.clamp(level + d, 0, 2);
      if (n === level) return;
      level = n; fade = 0; lab.textContent = names[level];
      K.tone(400 + level * 200, 0.15, 'sine');
      out.disabled = level === 0; inn.disabled = level === 2;
      if (level === 2) K.win('zoom', '🔍 You found the Sparkies!');
    }
    out.disabled = true;
    const sparkDot = (ctx, x, y, r) => {
      ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = '#f08c00'; ctx.lineWidth = r * 0.15;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1d2026';
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.1, r * 0.17, 0, 7); ctx.arc(x + r * 0.35, y - r * 0.1, r * 0.17, 0, 7); ctx.fill();
    };
    W.anim((dt, t) => {
      fade = Math.min(1, fade + dt * 2.5);
      const { ctx, w, h } = c;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      const s = 0.7 + 0.3 * fade;
      ctx.globalAlpha = fade;
      ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
      if (level === 0) {
        ctx.font = '150px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🥄', w / 2, h / 2 + 10);
        ctx.strokeStyle = W.col('accent'); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(w / 2 + 10, h / 2 - 30, 40, 0, 7); ctx.stroke();
      } else if (level === 1) {
        const R = 22, gap = 50;
        for (let y = R + 8; y < h; y += gap) {
          for (let x = R + 8 + ((y / gap) % 2) * 25; x < w; x += gap) {
            const jx = Math.sin(t * 3 + x * 0.3 + y) * 1.5, jy = Math.cos(t * 2.6 + y * 0.2 + x) * 1.5;
            ctx.fillStyle = W.col('surface'); ctx.strokeStyle = W.col('muted'); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x + jx, y + jy, R, 0, 7); ctx.fill(); ctx.stroke();
            ctx.fillStyle = W.col('c4'); ctx.beginPath(); ctx.arc(x + jx, y + jy, 5, 0, 7); ctx.fill();
            const a = t * 4 + x + y;
            ctx.fillStyle = '#fab005'; ctx.beginPath(); ctx.arc(x + jx + Math.cos(a) * 15, y + jy + Math.sin(a) * 15, 3.5, 0, 7); ctx.fill();
          }
        }
      } else {
        const cx = w / 2, cy = h / 2;
        ctx.strokeStyle = W.col('line'); ctx.lineWidth = 2;
        const orbits = [[110, 40, 0], [110, 40, Math.PI / 3], [110, 40, -Math.PI / 3]];
        orbits.forEach(([a, b, rot]) => { ctx.beginPath(); ctx.ellipse(cx, cy, a, b, rot, 0, 7); ctx.stroke(); });
        // the middle (nucleus): a cluster of balls
        const ball = [[0, 0, 'c4'], [9, -6, 'c1'], [-9, -5, 'c4'], [-6, 8, 'c1'], [7, 8, 'c4'], [0, -12, 'c1']];
        ball.forEach(([x, y, col]) => { ctx.fillStyle = W.col(col); ctx.beginPath(); ctx.arc(cx + x, cy + y, 9, 0, 7); ctx.fill(); });
        orbits.forEach(([a, b, rot], i) => {
          const th = t * (1.6 + i * 0.3) + i * 2;
          const ex = a * Math.cos(th), ey = b * Math.sin(th);
          sparkDot(ctx, cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot), 13);
        });
      }
      ctx.restore();
    }, c.canvas);
  })();

  /* ---- Toy 3: rub the balloon ---- */
  (function balloon() {
    const svg = K.svg('#t-balloon', 400, 300, { title: 'A balloon and a head of hair', max: 420 });
    const HX = 130, HY = 190, HR = 62;
    // body + face
    K.add(svg, 'path', { d: `M ${HX - 70} 300 Q ${HX} 230 ${HX + 70} 300 Z`, style: 'fill:var(--c5)' });
    K.add(svg, 'circle', { cx: HX, cy: HY, r: HR, style: 'fill:#ffd8a8;stroke:#e8590c;stroke-width:2' });
    K.add(svg, 'circle', { cx: HX - 20, cy: HY + 2, r: 6, style: 'fill:#1d2026' });
    K.add(svg, 'circle', { cx: HX + 20, cy: HY + 2, r: 6, style: 'fill:#1d2026' });
    const mouth = K.add(svg, 'path', { d: `M ${HX - 16} ${HY + 26} Q ${HX} ${HY + 36} ${HX + 16} ${HY + 26}`, style: 'fill:none;stroke:#1d2026;stroke-width:3;stroke-linecap:round' });
    const hairG = K.g(svg);
    const plusG = K.g(svg);
    const strands = [];
    for (let i = 0; i < 15; i++) {
      const a = -Math.PI * (0.92 - i * 0.06);
      const root = [HX + Math.cos(a) * (HR - 4), HY + Math.sin(a) * (HR - 4)];
      const p = K.add(hairG, 'path', { style: 'fill:none;stroke:#a0522d;stroke-width:5;stroke-linecap:round' });
      strands.push({ a, root, p });
    }
    // balloon
    const bal = K.g(svg);
    const minusG = K.g(bal);
    K.add(bal, 'path', { d: 'M 0 52 Q -6 80 6 110 Q 14 130 4 150', style: 'fill:none;stroke:var(--muted);stroke-width:2' }, null);
    bal.insertBefore(K.add(bal, 'ellipse', { cx: 0, cy: 0, rx: 42, ry: 52, style: 'fill:#f03e3e;stroke:#c92a2a;stroke-width:2' }), minusG);
    bal.insertBefore(K.add(bal, 'path', { d: 'M -6 50 L 6 50 L 3 58 L -3 58 Z', style: 'fill:#c92a2a' }), minusG);
    bal.insertBefore(K.add(bal, 'ellipse', { cx: -16, cy: -20, rx: 8, ry: 14, style: 'fill:#fff;opacity:.45' }), minusG);
    const spots = [[-14, 4], [12, -8], [16, 18], [-20, -30], [0, 30], [22, -30], [-24, 24], [4, -36], [-6, 14], [26, 4], [-28, -6], [10, 40]];
    const REST = [320, 110];
    let bx = REST[0], by = REST[1], charge = 0, rubT = -1, won = false;
    function paint() {
      const k = Math.min(1, charge / 10);
      strands.forEach((s, i) => {
        const [rx, ry] = s.root;
        // resting: hair lies down along the head; charged: points toward the balloon
        const tang = s.a + (s.a < -Math.PI / 2 ? -1.25 : 1.25);
        const rest = [Math.cos(tang), Math.sin(tang)];
        let to = [bx - rx, by - ry]; const L = Math.hypot(to[0], to[1]); to = [Math.cos(s.a) + 0.8 * to[0] / L, Math.sin(s.a) + 0.8 * to[1] / L];
        let d = [W.lerp(rest[0], to[0], k), W.lerp(rest[1], to[1], k)]; const dl = Math.hypot(d[0], d[1]) || 1; d = [d[0] / dl, d[1] / dl];
        const len = 34 + (i % 3) * 5;
        const out = [Math.cos(s.a), Math.sin(s.a)];
        const c1 = [rx + out[0] * 14, ry + out[1] * 14];
        s.p.setAttribute('d', `M ${rx} ${ry} Q ${c1[0]} ${c1[1]} ${rx + d[0] * len} ${ry + d[1] * len}`);
      });
      K.place(bal, bx, by);
      mouth.setAttribute('d', k > 0.6 ? `M ${HX - 16} ${HY + 22} Q ${HX} ${HY + 44} ${HX + 16} ${HY + 22}` : `M ${HX - 16} ${HY + 26} Q ${HX} ${HY + 36} ${HX + 16} ${HY + 26}`);
    }
    function marks() {
      minusG.innerHTML = ''; plusG.innerHTML = '';
      for (let i = 0; i < Math.min(charge, spots.length); i++) K.sparky(minusG, spots[i][0], spots[i][1], 7, { tiny: true });
      for (let i = 0; i < Math.min(charge, 10); i++) {
        const a = -Math.PI * (0.85 - i * 0.075);
        K.text(plusG, HX + Math.cos(a) * (HR - 18), HY + Math.sin(a) * (HR - 18), '+', { size: 18, fill: 'var(--c4)', weight: 800 });
      }
    }
    const ctl = W.$('#t-balloon-ctl');
    const rubBtn = K.btn(ctl, '🎈↔️ Rub!', () => { if (rubT < 0) { rubT = 0; K.tone(300, 0.25, 'sawtooth', 0.04); } }, { cls: 'go', title: 'Rub the balloon on the hair' });
    K.btn(ctl, '🔄', () => { charge = 0; won = false; marks(); paint(); }, { title: 'Start again' });
    void rubBtn;
    W.anim((dt) => {
      if (rubT >= 0) {
        rubT += dt;
        const T = 0.9;
        if (rubT < T) {
          const near = Math.sin(Math.min(1, rubT / T) * Math.PI);
          bx = W.lerp(REST[0], HX + 40, near) + Math.sin(rubT * 40) * 12 * near;
          by = W.lerp(REST[1], HY - HR - 30, near);
        } else {
          rubT = -1; bx = REST[0]; by = REST[1];
          charge = Math.min(12, charge + 2);
          marks();
          K.tone(700 + charge * 40, 0.1, 'triangle');
          if (charge >= 10 && !won) { won = true; K.win('balloon', '🎈 Hair-raising! Static electricity!'); }
        }
      }
      paint();
    }, svg);
    marks(); paint();
  })();
})();
