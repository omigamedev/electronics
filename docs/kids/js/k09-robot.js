/* Level 9 · The Robot Brain */
(function () {
  'use strict';

  /* ---- Toy 1: program Robo to reach the charger ---- */
  (function code() {
    const PUZ = [
      { id: 'robot1', mode: 'arrows', start: [0, 2], dir: 1, goal: [3, 2], rocks: [] },
      { id: 'robot2', mode: 'arrows', start: [0, 4], dir: 1, goal: [4, 4], rocks: [[2, 4], [2, 3]] },
      { id: 'robot3', mode: 'turn', start: [0, 4], dir: 0, goal: [2, 2], rocks: [[1, 4], [1, 3], [3, 3]] },
    ];
    const N = 5, CS = 64, OFF = 10;
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
    const CMD = {
      up: { icon: '⬆️', say: 'up' }, down: { icon: '⬇️', say: 'down' }, left: { icon: '⬅️', say: 'left' }, right: { icon: '➡️', say: 'right' },
      fwd: { icon: '⏫', say: 'forward' }, tl: { icon: '↩️', say: 'turn left' }, tr: { icon: '↪️', say: 'turn right' },
    };
    const svg = K.svg('#t-code', N * CS + 2 * OFF, N * CS + 2 * OFF, { title: 'A grid with a robot, rocks and a charger', max: 380 });
    const board = K.g(svg), things = K.g(svg);
    const robo = K.g(svg);
    const pointer = K.add(robo, 'path', { d: 'M -9 -38 L 0 -50 L 9 -38 Z', style: 'fill:var(--accent);stroke:var(--wire);stroke-width:1.5' });
    K.emoji(robo, 0, 2, '🤖', 44);
    const msg = W.$('#t-code-ctl');
    let P = 0, prog = [], pos, dir, x, y, ang, running = false, bump = 0, solvedHere = new Set();
    const cell = (c) => [OFF + c[0] * CS + CS / 2, OFF + c[1] * CS + CS / 2];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) K.add(board, 'rect', { x: OFF + c * CS + 2, y: OFF + r * CS + 2, width: CS - 4, height: CS - 4, rx: 10, style: `fill:${(r + c) % 2 ? 'var(--surface)' : 'color-mix(in srgb, var(--c3) 12%, var(--surface))'};stroke:var(--line);stroke-width:1.5` });
    // level picker
    const lv = W.$('#t-code-lv');
    const lvBtns = PUZ.map((p, i) => K.btn(lv, `${i + 1}`, () => load(i), { title: 'Puzzle ' + (i + 1) }));
    // palette
    const pal = W.$('#t-code-pal');
    const progEl = W.$('#t-code-prog');
    const ctl = W.$('#t-code-ctl');
    const runBtn = K.btn(ctl, '▶️ Go!', run, { cls: 'go', title: 'Run the program' });
    K.btn(ctl, '⌫', () => { if (!running) { prog.pop(); drawProg(); reset(); } }, { title: 'Remove the last step' });
    K.btn(ctl, '🗑️', () => { if (!running) { prog = []; drawProg(); reset(); } }, { title: 'Clear the program' });
    const nextBtn = K.btn(ctl, 'Next puzzle ➡️', () => load(Math.min(P + 1, PUZ.length - 1)), { title: 'Next puzzle' });
    const say = W.h('div', { style: 'flex-basis:100%;font-weight:600;min-height:1.5em', 'aria-live': 'polite' });
    ctl.append(say);
    void msg;
    function load(i) {
      P = i; prog = [];
      lvBtns.forEach((b, k) => { b.classList.toggle('on', k === i); b.innerHTML = `${k + 1}${solvedHere.has(k) || document.querySelector(`.ex[data-id="${PUZ[k].id}"].solved`) ? '⭐' : ''}`; });
      pal.innerHTML = '';
      const cmds = PUZ[i].mode === 'arrows' ? ['up', 'down', 'left', 'right'] : ['fwd', 'tl', 'tr'];
      cmds.forEach((c) => K.btn(pal, CMD[c].icon + (PUZ[i].mode === 'turn' ? `<small>${CMD[c].say}</small>` : ''), () => add(c), { title: CMD[c].say }));
      things.innerHTML = '';
      const p = PUZ[i];
      p.rocks.forEach((r) => { const [cx, cy] = cell(r); K.emoji(things, cx, cy + 2, '🪨', 42); });
      const [gx, gy] = cell(p.goal);
      K.add(things, 'rect', { x: gx - 26, y: gy - 26, width: 52, height: 52, rx: 12, style: 'fill:color-mix(in srgb, var(--c3) 35%, var(--surface));stroke:var(--c3);stroke-width:3' });
      K.emoji(things, gx, gy + 2, '🔋', 34);
      pointer.style.display = p.mode === 'turn' ? '' : 'none';
      nextBtn.style.display = 'none';
      drawProg(); reset(true);
    }
    function reset(snap) {
      const p = PUZ[P];
      pos = p.start.slice(); dir = p.dir;
      if (snap || x == null) { [x, y] = cell(pos); ang = dir * 90; }
      say.textContent = '';
      progEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('cur', 'bad'));
    }
    function add(c) {
      if (running) return;
      if (prog.length >= 12) { say.textContent = 'That\'s a long program! Try ▶️'; return; }
      prog.push(c); K.tone(500 + prog.length * 30, 0.06, 'triangle'); drawProg();
    }
    function drawProg() {
      progEl.innerHTML = '';
      prog.forEach((c, i) => {
        const b = W.h('button', { class: 'chip', type: 'button', title: 'Remove ' + CMD[c].say, 'aria-label': 'Step ' + (i + 1) + ': ' + CMD[c].say }, CMD[c].icon);
        b.addEventListener('click', () => { if (running) return; prog.splice(i, 1); drawProg(); });
        progEl.append(b);
      });
    }
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    async function run() {
      if (running || !prog.length) { if (!prog.length) say.textContent = '👆 Add some steps first!'; return; }
      running = true; runBtn.disabled = true;
      reset();
      const p = PUZ[P];
      const chips = Array.from(progEl.children);
      let ok = true;
      await sleep(250);
      for (let i = 0; i < prog.length; i++) {
        const c = prog[i];
        chips.forEach((ch) => ch.classList.remove('cur')); chips[i].classList.add('cur');
        if (c === 'tl' || c === 'tr') { dir = (dir + (c === 'tr' ? 1 : 3)) % 4; ang += c === 'tr' ? 90 : -90; K.tone(620, 0.08, 'triangle'); await sleep(500); continue; }
        const d = c === 'fwd' ? dir : { up: 0, right: 1, down: 2, left: 3 }[c];
        const nx = pos[0] + DIRS[d][0], ny = pos[1] + DIRS[d][1];
        const blocked = nx < 0 || ny < 0 || nx >= N || ny >= N || p.rocks.some((r) => r[0] === nx && r[1] === ny);
        if (blocked) {
          bump = 1; bumpDir = DIRS[d]; chips[i].classList.add('bad'); K.tone(150, 0.25, 'square', 0.06);
          say.textContent = nx < 0 || ny < 0 || nx >= N || ny >= N ? '🐞 Oops! Robo hit the edge. Find the bug!' : '🐞 Bonk! Robo hit a rock. Find the bug!';
          ok = false; break;
        }
        pos = [nx, ny]; K.tone(440 + i * 25, 0.07, 'sine');
        await sleep(500);
        if (pos[0] === p.goal[0] && pos[1] === p.goal[1]) break;
      }
      await sleep(250);
      chips.forEach((ch) => ch.classList.remove('cur'));
      if (ok && pos[0] === p.goal[0] && pos[1] === p.goal[1]) {
        say.textContent = '🔋 Yum! Robo is charging! You did it!';
        solvedHere.add(P);
        K.win(p.id, '🤖 Robo reached the charger!');
        lvBtns[P].innerHTML = `${P + 1}⭐`;
        if (P < PUZ.length - 1) nextBtn.style.display = '';
      } else if (ok) say.textContent = '🤔 Robo stopped before the charger. Add more steps!';
      running = false; runBtn.disabled = false;
    }
    let bumpDir = [0, 0];
    W.anim((dt) => {
      const [tx, ty] = cell(pos);
      x += (tx - x) * Math.min(1, dt * 9); y += (ty - y) * Math.min(1, dt * 9);
      const ta = dir * 90; // keep ang continuous
      ang += (Math.round((ang - ta) / 360) * 360 + ta - ang) * Math.min(1, dt * 10);
      bump = Math.max(0, bump - dt * 2.5);
      const b = Math.sin(bump * Math.PI) * 16;
      robo.setAttribute('transform', `translate(${x + bumpDir[0] * b} ${y + bumpDir[1] * b})`);
      pointer.setAttribute('transform', `rotate(${ang})`);
    }, svg);
    load(0);
  })();

  /* ---- Toy 2: IF dark THEN light ON ---- */
  (function night() {
    const svg = K.svg('#t-night', 400, 230, { title: 'Robo with a light sensor', max: 440 });
    const sky = K.add(svg, 'rect', { x: 0, y: 0, width: 400, height: 230, rx: 16, style: 'fill:#a5d8ff' });
    const sun = K.emoji(svg, 330, 60, '🌞', 50);
    const moon = K.emoji(svg, 330, 60, '🌙', 46);
    const stars = K.g(svg);
    [[60, 40], [120, 25], [240, 50], [370, 120], [30, 120], [190, 20]].forEach(([sx, sy]) => K.emoji(stars, sx, sy, '✨', 16));
    K.add(svg, 'rect', { x: 0, y: 196, width: 400, height: 34, style: 'fill:#69db7c' });
    const lampGlow = K.add(svg, 'circle', { cx: 170, cy: 62, r: 60, style: 'fill:#ffe066;opacity:0', filter: K.blur(svg, 16) });
    const r = K.g(svg);
    K.add(r, 'line', { x1: 170, y1: 70, x2: 170, y2: 88, style: 'stroke:#495057;stroke-width:4' });
    const lamp = K.add(r, 'circle', { cx: 170, cy: 62, r: 11, style: 'fill:#868e96;stroke:#343a40;stroke-width:2' });
    K.add(r, 'rect', { x: 130, y: 88, width: 80, height: 56, rx: 14, style: 'fill:#ced4da;stroke:#343a40;stroke-width:3' });
    K.add(r, 'circle', { cx: 152, cy: 114, r: 9, style: 'fill:#1d2026' });
    K.add(r, 'circle', { cx: 188, cy: 114, r: 9, style: 'fill:#1d2026' });
    K.add(r, 'rect', { x: 140, y: 146, width: 60, height: 40, rx: 8, style: 'fill:#adb5bd;stroke:#343a40;stroke-width:3' });
    K.add(r, 'circle', { cx: 150, cy: 192, r: 9, style: 'fill:#343a40' });
    K.add(r, 'circle', { cx: 190, cy: 192, r: 9, style: 'fill:#343a40' });
    // the sensor "eye" on the chest
    const sensor = K.add(r, 'circle', { cx: 170, cy: 164, r: 8, style: 'fill:#fab005;stroke:#343a40;stroke-width:2' });
    const bubble = K.g(svg);
    K.add(bubble, 'rect', { x: 216, y: 112, width: 178, height: 74, rx: 14, style: 'fill:#fff;stroke:#343a40;stroke-width:2' });
    const t1 = K.text(bubble, 305, 134, '', { size: 18, fill: '#1d2026' });
    const t2 = K.text(bubble, 305, 162, '', { size: 18, fill: '#1d2026', weight: 700 });
    let light = 4;
    const ctl = W.controls('#t-night-ctl');
    W.slider(ctl, { label: '🌞', min: 0, max: 4, step: 1, value: 4, format: (v) => ['🌙 night', '🌆 dusk', '⛅ cloudy', '🌤️ day', '☀️ sunny'][v], onInput: (v) => { light = v; update(); } });
    function update() {
      const k = light / 4;
      sky.style.fill = `color-mix(in srgb, #a5d8ff ${Math.round(k * 100)}%, #1b2440)`;
      sun.style.opacity = k > 0.5 ? (k - 0.5) * 2 : 0; moon.style.opacity = k < 0.5 ? 1 - k * 2 : 0;
      stars.style.opacity = k <= 0.25 ? 1 : 0;
      const dark = light <= 1;
      lamp.style.fill = dark ? '#ffe066' : '#868e96';
      lampGlow.style.opacity = dark ? 0.9 : 0;
      sensor.style.fill = `color-mix(in srgb, #fab005 ${Math.round(30 + 70 * k)}%, #343a40)`;
      t1.textContent = dark ? 'IF dark? YES!' : 'IF dark? no…';
      t2.textContent = dark ? 'THEN light ON 💡' : 'light stays OFF';
      if (dark) { K.tone(880, 0.1, 'triangle'); K.win('night', '🌙 Robo switched on his light!'); }
    }
    update();
  })();
})();
