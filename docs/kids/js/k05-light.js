/* Level 5 · Light It Up! */
(function () {
  'use strict';

  /** Cartoon LED: dome centred at (x,y); legs hang down (long leg on the left, short on the right). */
  function ledArt(parent, x, y, o = {}) {
    const svg = parent.ownerSVGElement || parent;
    const col = o.color || '#ff3b3b';
    const g = K.g(parent);
    const halo = K.add(g, 'circle', { cx: x, cy: y - 6, r: 46, style: `fill:${col};opacity:0`, filter: K.blur(svg, 12) });
    const longY = o.longY || y + 80, shortY = o.shortY || y + 56;
    K.add(g, 'line', { x1: x - 10, y1: y + 22, x2: x - 10, y2: longY, style: 'stroke:#adb5bd;stroke-width:4;stroke-linecap:round' });
    K.add(g, 'line', { x1: x + 10, y1: y + 22, x2: x + 10, y2: shortY, style: 'stroke:#adb5bd;stroke-width:4;stroke-linecap:round' });
    const dome = K.add(g, 'path', { d: `M ${x - 22} ${y + 18} L ${x - 22} ${y - 8} A 22 22 0 0 1 ${x + 22} ${y - 8} L ${x + 22} ${y + 18} Z`, style: `fill:color-mix(in srgb, ${col} 35%, var(--surface));stroke:color-mix(in srgb, ${col} 70%, var(--wire));stroke-width:2.5` });
    K.add(g, 'rect', { x: x - 26, y: y + 16, width: 52, height: 8, rx: 3, style: `fill:color-mix(in srgb, ${col} 50%, var(--surface));stroke:color-mix(in srgb, ${col} 70%, var(--wire));stroke-width:2` });
    K.add(g, 'path', { d: `M ${x - 12} ${y - 10} A 12 12 0 0 1 ${x - 2} ${y - 20}`, style: 'fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;opacity:.7' });
    return {
      g, dome, halo,
      set(b, c) {
        const cc = c || col;
        halo.style.fill = cc; halo.style.opacity = W.clamp(b, 0, 1);
        dome.style.fill = b > 0.02 ? `color-mix(in srgb, ${cc} ${Math.round(40 + 60 * b)}%, #fff)` : `color-mix(in srgb, ${col} 35%, var(--surface))`;
      },
    };
  }

  /* ---- Toy 1: hot bulb vs cool LED ---- */
  (function heat() {
    const svg = K.svg('#t-heat', 400, 250, { title: 'An old bulb and an LED with thermometers', max: 440 });
    const lamp = K.lamp(svg, 100, 190, { s: 1 });
    const led = ledArt(svg, 280, 110, { longY: 196, shortY: 196 });
    K.add(svg, 'rect', { x: 230, y: 192, width: 100, height: 10, rx: 4, style: 'fill:var(--muted);stroke:var(--wire);stroke-width:2' });
    const therm = (x) => {
      K.add(svg, 'rect', { x: x - 9, y: 50, width: 18, height: 140, rx: 9, style: 'fill:var(--surface);stroke:var(--wire);stroke-width:2.5' });
      K.add(svg, 'circle', { cx: x, cy: 196, r: 15, style: 'fill:var(--c4);stroke:var(--wire);stroke-width:2.5' });
      const fill = K.add(svg, 'rect', { x: x - 4.5, y: 180, width: 9, height: 10, rx: 4, style: 'fill:var(--c4)' });
      const fire = K.emoji(svg, x, 32, '', 26);
      return { fill, fire, v: 0.05 };
    };
    const tb = therm(175), tl = therm(360);
    K.text(svg, 100, 236, 'old bulb', { size: 15, fill: 'var(--muted)' });
    K.text(svg, 280, 236, 'LED', { size: 15, fill: 'var(--muted)' });
    let on = false;
    const ctl = W.$('#t-heat-ctl');
    const b = K.btn(ctl, '⚡ ON', () => { on = !on; b.innerHTML = on ? '⏹️ OFF' : '⚡ ON'; b.classList.toggle('on', on); K.tone(on ? 700 : 350, 0.1); }, { cls: 'go', title: 'Switch on' });
    W.anim((dt) => {
      lamp.set(on ? 1 : 0); led.set(on ? 1 : 0);
      [[tb, on ? 0.95 : 0.05], [tl, on ? 0.25 : 0.05]].forEach(([t, target]) => {
        t.v += (target - t.v) * Math.min(1, dt * 0.9);
        const hgt = 10 + t.v * 125;
        t.fill.setAttribute('y', 190 - hgt); t.fill.setAttribute('height', hgt);
        t.fire.textContent = t.v > 0.8 ? '🔥' : (t.v < 0.3 && on ? '😎' : '');
      });
    }, svg);
  })();

  /* ---- Toy 2: flip the LED ---- */
  (function flip() {
    const svg = K.svg('#t-led', 400, 260, { title: 'An LED connected to a battery', max: 440 });
    const bat = K.battery(svg, 200, 228, { w: 96, h: 42, label: '3 V' });
    const PL = [158, 150], PR = [242, 150];
    K.wire(svg, [bat.minus, [100, 228], [100, 176], [PL[0], 176]]);
    K.wire(svg, [bat.plus, [300, 228], [300, 176], [PR[0], 176]]);
    K.add(svg, 'rect', { x: PL[0] - 14, y: 140, width: 28, height: 40, rx: 6, style: 'fill:var(--muted);stroke:var(--wire);stroke-width:2' });
    K.add(svg, 'rect', { x: PR[0] - 14, y: 140, width: 28, height: 40, rx: 6, style: 'fill:var(--muted);stroke:var(--wire);stroke-width:2' });
    K.text(svg, 300, 160, '+', { size: 26, fill: 'var(--c4)', weight: 800 });
    K.text(svg, 100, 160, '−', { size: 26, fill: 'var(--c1)', weight: 800 });
    const holder = K.g(svg);
    // LED with legs reaching the pads: legs spread out from the dome
    const ledG = K.g(holder);
    const led = ledArt(ledG, 200, 60, { longY: 60, shortY: 60 });
    // replace straight legs with spread legs (long goes to the left pad, short to the right)
    ledG.querySelectorAll('line').forEach((l) => l.remove());
    const legL = K.add(ledG, 'polyline', { points: `190,82 190,100 ${PL[0]},128 ${PL[0]},174`, style: 'fill:none;stroke:#adb5bd;stroke-width:4;stroke-linecap:round;stroke-linejoin:round' });
    const legS = K.add(ledG, 'polyline', { points: `210,82 210,100 ${PR[0]},128 ${PR[0]},148`, style: 'fill:none;stroke:#adb5bd;stroke-width:4;stroke-linecap:round;stroke-linejoin:round' });
    ledG.insertBefore(legL, ledG.children[1]); ledG.insertBefore(legS, ledG.children[1]);
    const tagLong = K.text(holder, PL[0] - 34, 112, 'long', { size: 14, fill: 'var(--muted)' });
    const tagShort = K.text(holder, PR[0] + 36, 112, 'short', { size: 14, fill: 'var(--muted)' });
    const loop = [bat.minus, [100, 228], [100, 176], PL, [200, 70], PR, [300, 176], [300, 228], bat.plus, bat.minus];
    const flow = K.flow(svg, loop, { spacing: 36, r: 7, hideWhenStopped: true });
    const face = K.text(svg, 200, 20, '', { size: 18 });
    let side = 1, sx = -1; // side 1: long leg on the left (minus) = wrong way; start flipped wrong
    const ctl = W.$('#t-led-ctl');
    K.btn(ctl, '🔄 Flip!', () => { side = -side; K.tone(520, 0.1, 'triangle'); }, { cls: 'go', title: 'Flip the LED' });
    sx = side;
    W.anim((dt) => {
      sx += (side - sx) * Math.min(1, dt * 9);
      holder.setAttribute('transform', `translate(200 0) scale(${sx.toFixed(3)} 1) translate(-200 0)`);
      [tagLong, tagShort].forEach((t) => t.setAttribute('transform', `translate(${t.getAttribute('x')} 0) scale(${sx >= 0 ? 1 : -1} 1) translate(${-t.getAttribute('x')} 0)`));
      const lit = side === -1 && sx < -0.95;
      led.set(lit ? 1 : 0); flow.set(lit ? 60 : 0);
      face.textContent = lit ? '✅ Long leg on plus: it glows!' : (Math.abs(sx) > 0.95 ? '🚪 The door is shut. Flip it!' : '');
      if (lit) K.win('flip', '🚪 The one-way door is open!');
    }, svg);
  })();

  /* ---- Toy 3: RGB mixer ---- */
  (function rgb() {
    const svg = K.svg('#t-rgb', 300, 210, { title: 'A colour-mixing LED', max: 340 });
    K.add(svg, 'rect', { x: 0, y: 0, width: 300, height: 210, rx: 18, style: 'fill:#1d2026' });
    const halo = K.add(svg, 'circle', { cx: 150, cy: 92, r: 70, style: 'fill:#000;opacity:0', filter: K.blur(svg, 18) });
    const dome = K.add(svg, 'path', { d: 'M 112 150 L 112 92 A 38 38 0 0 1 188 92 L 188 150 Z', style: 'fill:#495057;stroke:#adb5bd;stroke-width:3' });
    K.add(svg, 'rect', { x: 104, y: 148, width: 92, height: 12, rx: 4, style: 'fill:#868e96' });
    const chips = [['#ff2020', 132], ['#20e020', 150], ['#3060ff', 168]].map(([c, x]) => K.add(svg, 'circle', { cx: x, cy: 120, r: 6, style: `fill:${c};opacity:.25` }));
    for (const x of [130, 143, 157, 170]) K.add(svg, 'line', { x1: x, y1: 160, x2: x, y2: 200, style: 'stroke:#adb5bd;stroke-width:3' });
    const name = K.text(svg, 150, 22, '', { size: 18, fill: '#fff' });
    const lv = [0, 0, 0];
    const ctl = W.controls('#t-rgb-ctl');
    const fmt = (v) => ['off', '▮', '▮▮', '▮▮▮', '▮▮▮▮'][v];
    ['🔴', '🟢', '🔵'].forEach((e, i) => W.slider(ctl, { label: e, min: 0, max: 4, step: 1, value: 0, format: fmt, onInput: (v) => { lv[i] = v; update(); } }));
    function update() {
      const [r, g, b] = lv.map((v) => v / 4);
      const m = Math.max(r, g, b);
      const css = m ? `rgb(${Math.round(255 * r / m)},${Math.round(255 * g / m)},${Math.round(255 * b / m)})` : '#495057';
      halo.style.fill = css; halo.style.opacity = m * 0.95;
      dome.style.fill = m ? `color-mix(in srgb, ${css} ${Math.round(50 + 50 * m)}%, #fff)` : '#495057';
      chips.forEach((c, i) => { c.style.opacity = 0.25 + 0.75 * [r, g, b][i]; });
      const hi = (x) => x >= 0.75, lo = (x) => x <= 0.25;
      let n = '';
      if (!m) n = 'off';
      else if (hi(r) && hi(g) && hi(b)) n = '⚪ white!';
      else if (hi(r) && hi(g) && lo(b)) n = '🟡 yellow!';
      else if (r && g && b) n = 'a mix';
      else if (r && g) n = g > r ? 'yellowy green' : 'orange';
      else if (r && b) n = 'pink-purple';
      else if (g && b) n = 'sky blue';
      else n = r ? 'red' : g ? 'green' : 'blue';
      name.textContent = n;
      if (hi(r) && hi(g) && lo(b)) K.win('yellow', '🟡 Yellow light!');
      if (hi(r) && hi(g) && hi(b)) K.win('white', '⚪ White light!');
    }
    update();
  })();

  /* ---- Toy 4: the resistor helmet ---- */
  (function helmet() {
    const svg = K.svg('#t-helmet', 400, 250, { title: 'An LED with or without a resistor', max: 440 });
    const bat = K.battery(svg, 70, 150, { rot: -90, w: 92, h: 44, label: '9 V' });
    const led = ledArt(svg, 230, 70, {});
    // legs end at y≈150/126; wire them
    K.wire(svg, [bat.plus, [70, 40], [150, 40], [150, 175], [220, 175], [220, 150]], { width: 5 });
    K.wire(svg, [[240, 126], [240, 175], [300, 175], [300, 220], [70, 220], bat.minus], { width: 5 });
    const res = K.g(svg);
    K.add(res, 'rect', { x: 100, y: 28, width: 40, height: 24, rx: 4, style: 'fill:var(--surface)' });
    K.add(res, 'polyline', { points: '98,40 104,30 112,50 120,30 128,50 136,30 142,40', style: 'fill:none;stroke:var(--c2);stroke-width:4;stroke-linejoin:round' });
    const hat = K.emoji(svg, 230, 34, '🪖', 34);
    const smoke = K.emoji(svg, 230, 60, '', 40);
    const msg = K.text(svg, 250, 236, '', { size: 17 });
    const loop = [bat.minus, [70, 220], [300, 220], [300, 175], [240, 175], [230, 90], [220, 175], [150, 175], [150, 40], [70, 40], bat.plus, bat.minus];
    const flow = K.flow(svg, loop, { spacing: 34, r: 7, hideWhenStopped: true });
    let hasHelmet = false, broken = false, on = false, poofT = -1;
    const ctl = W.$('#t-helmet-ctl');
    const hb = K.btn(ctl, '🪖 helmet: off', () => { hasHelmet = !hasHelmet; on = false; paint(); K.tone(600, 0.08); }, { title: 'Helmet on or off' });
    const go = K.btn(ctl, '⚡ ON', () => {
      if (broken) { broken = false; on = false; poofT = -1; paint(); return; }
      on = !on;
      if (on && !hasHelmet) { poofT = 0; K.tone(1400, 0.08, 'square', 0.05); }
      paint();
    }, { cls: 'go', title: 'Switch on' });
    function paint() {
      hb.innerHTML = hasHelmet ? '🪖 helmet: ON' : '🪖 helmet: off';
      hb.classList.toggle('on', hasHelmet);
      res.style.opacity = hasHelmet ? 1 : 0;
      hat.style.opacity = hasHelmet ? 1 : 0;
      go.innerHTML = broken ? '🔄 New LED' : on ? '⏹️ OFF' : '⚡ ON';
      if (!broken) smoke.textContent = '';
      const ok = on && hasHelmet && !broken;
      if (poofT < 0) { led.set(ok ? 0.85 : 0); flow.set(ok ? 45 : 0); }
      msg.textContent = broken ? '💥 Poof! Too many Sparkies!' : ok ? '😊 A happy, safe glow!' : '';
      if (ok) K.win('helmet', '🪖 Safe and glowing!');
    }
    W.anim((dt) => {
      if (poofT >= 0) {
        poofT += dt;
        led.set(poofT < 0.35 ? 1 : 0); flow.set(poofT < 0.35 ? 260 : 0);
        if (poofT > 0.35 && !broken) { broken = true; on = false; smoke.textContent = '💨'; K.tone(120, 0.3, 'sawtooth', 0.06); paint(); }
        if (poofT > 0.35) { smoke.setAttribute('y', 60 - (poofT - 0.35) * 30); smoke.style.opacity = Math.max(0.3, 1 - (poofT - 0.35)); }
        if (poofT > 1.6) poofT = -1;
      }
    }, svg);
    paint();
  })();
})();
