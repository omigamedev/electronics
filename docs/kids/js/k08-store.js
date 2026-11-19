/* Level 8 · Saving Sparks */
(function () {
  'use strict';

  /** an energy "bucket" (tank) at x,y (top-left) with width w, height h. Returns {set(level 0..1)} */
  function bucket(parent, x, y, w, h, o = {}) {
    const g = K.g(parent);
    const id = 'clip' + Math.random().toString(36).slice(2, 8);
    const defs = K.add(g, 'defs');
    const cp = K.add(defs, 'clipPath', { id });
    K.add(cp, 'rect', { x, y, width: w, height: h, rx: o.rx ?? 14 });
    const fill = K.add(g, 'rect', { x, y: y + h, width: w, height: 0, 'clip-path': `url(#${id})`, style: 'fill:var(--c3)' });
    const wave = K.add(g, 'path', { 'clip-path': `url(#${id})`, style: 'fill:color-mix(in srgb, var(--c3) 60%, #fff);opacity:.6' });
    K.add(g, 'rect', { x, y, width: w, height: h, rx: o.rx ?? 14, style: 'fill:none;stroke:var(--wire);stroke-width:3' });
    if (o.cap) K.add(g, 'rect', { x: x + w / 2 - 12, y: y - 9, width: 24, height: 9, rx: 3, style: 'fill:#adb5bd;stroke:var(--wire);stroke-width:2' });
    const lab = K.text(g, x + w / 2, y + h + 18, o.label || '', { size: 15, fill: 'var(--muted)' });
    let lv = 0, t = 0;
    return {
      g, lab,
      set(v, dt = 0) {
        lv = W.clamp(v, 0, 1); t += dt;
        const top = y + h * (1 - lv);
        fill.setAttribute('y', top); fill.setAttribute('height', h * lv);
        const col = lv < 0.2 ? 'var(--c4)' : lv < 0.5 ? 'var(--c2)' : 'var(--c3)';
        fill.style.fill = col;
        wave.setAttribute('d', lv > 0.01 ? `M ${x} ${top + 4} Q ${x + w / 4} ${top - 4 + Math.sin(t * 4) * 3} ${x + w / 2} ${top + 2} T ${x + w} ${top} V ${top + 10} H ${x} Z` : '');
      },
    };
  }

  /* ---- Toy 1: battery bucket and a toy car ---- */
  (function car() {
    const svg = K.svg('#t-bucket', 400, 220, { title: 'A battery bucket powering a toy car', max: 440 });
    const b = bucket(svg, 30, 40, 70, 130, { cap: true, label: 'battery' });
    K.add(svg, 'rect', { x: 130, y: 150, width: 260, height: 26, rx: 8, style: 'fill:var(--line)' });
    for (let x = 140; x < 385; x += 34) K.add(svg, 'rect', { x, y: 161, width: 18, height: 4, rx: 2, style: 'fill:var(--surface)' });
    const carG = K.g(svg);
    K.add(carG, 'text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font-size:46px', transform: 'scale(-1 1)' }, '🚗');
    const face = K.text(svg, 260, 40, '', { size: 18 });
    const charger = K.emoji(svg, 65, 205, '', 24);
    const pct = K.text(svg, 65, 105, '', { size: 18, weight: 700 });
    let lv = 1, driving = false, charging = false, x = 160, wasEmpty = false;
    const ctl = W.$('#t-bucket-ctl');
    const play = K.btn(ctl, '▶️ Drive', () => { driving = !driving; charging = false; paint(); K.tone(500, 0.08); }, { cls: 'go', title: 'Drive the car' });
    const chg = K.btn(ctl, '🔌 Charge', () => { charging = !charging; driving = false; paint(); K.tone(700, 0.08); }, { title: 'Charge the battery' });
    function paint() {
      play.innerHTML = driving ? '⏸️ Stop' : '▶️ Drive';
      chg.classList.toggle('on', charging);
      charger.textContent = charging ? '🔌' : '';
    }
    W.anim((dt) => {
      if (driving && lv > 0) { lv = Math.max(0, lv - dt * 0.14); x += dt * 110; if (x > 400) x = 140; }
      if (lv <= 0.001) { if (driving) { driving = false; paint(); K.tone(180, 0.3, 'triangle'); } wasEmpty = true; }
      if (charging) { lv = Math.min(1, lv + dt * 0.3); if (lv >= 1 && wasEmpty) K.win('charge', '🔋 Full again!'); }
      b.set(lv, dt);
      pct.textContent = Math.round(lv * 100) + '%';
      pct.style.fill = lv > 0.35 ? '#fff' : 'var(--ink)';
      K.place(carG, x, 140 + (driving ? Math.sin(x / 6) * 1.5 : 0));
      face.textContent = lv <= 0.001 ? '😢 Out of energy!' : charging ? (lv >= 1 ? '😄 Full!' : '⚡ Filling up…') : driving ? 'Vroom! 🏁' : '';
    }, svg);
  })();

  /* ---- Toy 2: camera flash with a capacitor ---- */
  (function flash() {
    const svg = K.svg('#t-flash', 400, 240, { title: 'A camera flash with a quick-bucket capacitor', max: 440 });
    // dim room with a cat
    K.add(svg, 'rect', { x: 230, y: 20, width: 160, height: 180, rx: 16, style: 'fill:#2b2f36' });
    const cat = K.emoji(svg, 310, 120, '🐱', 70);
    cat.style.opacity = 0.35;
    // camera
    K.add(svg, 'rect', { x: 20, y: 70, width: 130, height: 90, rx: 14, style: 'fill:#343a40;stroke:var(--wire);stroke-width:2' });
    K.add(svg, 'rect', { x: 40, y: 58, width: 40, height: 14, rx: 4, style: 'fill:#495057' });
    K.add(svg, 'circle', { cx: 85, cy: 118, r: 28, style: 'fill:#1d2026;stroke:#adb5bd;stroke-width:5' });
    K.add(svg, 'circle', { cx: 77, cy: 110, r: 7, style: 'fill:#fff;opacity:.5' });
    const lampWin = K.add(svg, 'rect', { x: 106, y: 78, width: 34, height: 16, rx: 3, style: 'fill:#868e96' });
    // capacitor bucket
    const cap = bucket(svg, 168, 90, 40, 70, { rx: 8, label: 'capacitor' });
    const beam = K.add(svg, 'path', { d: 'M 140 80 L 230 30 L 230 190 L 140 92 Z', style: 'fill:#fff;opacity:0' });
    const white = K.add(svg, 'rect', { x: 0, y: 0, width: 400, height: 240, rx: 14, style: 'fill:#fff;opacity:0;pointer-events:none' });
    const photos = K.text(svg, 310, 222, '', { size: 18 });
    const status = K.text(svg, 100, 36, '', { size: 16 });
    let lv = 0, filling = false, flashT = -1, shots = 0;
    const ctl = W.$('#t-flash-ctl');
    const fillBtn = K.btn(ctl, '⚡ Fill', () => { if (lv < 1) { filling = true; K.tone(400, 1.0, 'sine', 0.04); } }, { title: 'Fill the capacitor' });
    const snap = K.btn(ctl, '📸 Snap!', () => {
      if (lv < 0.95) { status.textContent = 'Fill it first! ⚡'; K.tone(200, 0.1, 'square', 0.04); return; }
      lv = 0; flashT = 0; shots++; K.tone(1800, 0.05, 'square', 0.05);
      photos.textContent = '🖼️'.repeat(Math.min(shots, 5));
      if (shots >= 3) K.win('flash3', '📸 Say cheese!');
    }, { cls: 'go', title: 'Take a photo' });
    void fillBtn;
    W.anim((dt) => {
      if (filling) { lv += (1.05 - lv) * Math.min(1, dt * 3.2); if (lv >= 0.995) { lv = 1; filling = false; } }
      cap.set(lv, dt);
      status.textContent = lv >= 1 ? 'Ready! 📸' : filling ? 'Filling… ⚡' : (status.textContent.startsWith('Fill it') ? status.textContent : '');
      snap.disabled = false;
      if (flashT >= 0) {
        flashT += dt;
        const k = Math.max(0, 1 - flashT / 0.45);
        white.style.opacity = k * 0.9; beam.style.opacity = k; lampWin.style.fill = k > 0.1 ? '#fff' : '#868e96';
        cat.style.opacity = 0.35 + 0.65 * Math.min(1, k * 3);
        if (flashT > 0.45) { flashT = -1; cat.textContent = '😺'; }
      }
    }, svg);
  })();
})();
