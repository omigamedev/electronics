/* Chapter 4 widgets: semiconductors, diodes, BJTs, MOSFETs, H-bridges, op-amps */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const kB = 8.617e-5; // eV/K
  const rnd = (a, b) => a + Math.random() * (b - a);
  const font = (px, w) => `${w || ''} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  /* =====================================================================
   * Figure 4.1 — silicon lattice: intrinsic / n-type / p-type
   * ===================================================================== */
  (function lattice() {
    const host = W.$('#w-lattice');
    if (!host) return;
    let mode = 'i', T = 300, field = false;
    let atoms = [], sites = [], elec = [], holes = [], cols = 0, rows = 0, gx = 0, gy = 0, sp = 46;
    let c = null;
    c = W.canvas(host, { height: 300, onResize: () => c && build() });
    const ctl = W.controls(host);
    W.segmented(ctl, { options: [['i', 'Intrinsic Si'], ['n', 'n-type (P)'], ['p', 'p-type (B)']], value: 'i', onChange: (v) => { mode = v; build(); } });
    W.slider(ctl, { label: 'Temperature', min: 200, max: 600, step: 5, value: 300, format: (v) => `${v} K`, onInput: (v) => { T = v; } });
    W.toggle(ctl, { label: 'Apply electric field', value: false, onChange: (v) => { field = v; } });
    const rE = W.readout(ctl, { label: 'free e⁻', fmt: (v) => String(v) });
    const rH = W.readout(ctl, { label: 'holes', fmt: (v) => String(v) });

    function build() {
      if (!c.w) return;
      sp = c.w < 500 ? 40 : 46;
      cols = Math.max(5, Math.floor((c.w - 60) / sp));
      rows = Math.max(4, Math.floor((c.h - 50) / sp));
      gx = (c.w - (cols - 1) * sp) / 2; gy = 30 + (c.h - 30 - (rows - 1) * sp) / 2;
      atoms = []; sites = []; elec = []; holes = [];
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) atoms.push({ x: gx + q * sp, y: gy + r * sp, r, q, kind: 'Si' });
      // bond sites: midpoints between neighbours (with horizontal wrap)
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        if (q < cols - 1) sites.push({ x: gx + (q + 0.5) * sp, y: gy + r * sp, r, q, h: true });
        if (r < rows - 1) sites.push({ x: gx + q * sp, y: gy + (r + 0.5) * sp, r, q, h: false });
      }
      // dopants: a few atoms (exaggerated density!)
      if (mode !== 'i') {
        const n = Math.max(3, Math.round(atoms.length / 9));
        const idx = new Set();
        while (idx.size < n) idx.add(Math.floor(Math.random() * atoms.length));
        for (const i of idx) {
          const a = atoms[i]; a.kind = mode === 'n' ? 'P' : 'B';
          if (mode === 'n') elec.push(newE(a.x + rnd(-10, 10), a.y + rnd(-10, 10), Infinity));
          else holes.push(newH(nearSite(a.x + 1, a.y), Infinity));
        }
      }
    }
    const newE = (x, y, life) => { const a = rnd(0, TAU); return { x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life, age: 0 }; };
    const newH = (s, life) => ({ s, x: s.x, y: s.y, t: rnd(0, 0.3), life, age: 0 });
    function nearSite(x, y) { let b = sites[0], bd = 1e9; for (const s of sites) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; b = s; } } return b; }
    function neighbours(s) {
      // sites sharing an atom with s
      const out = [];
      for (const o of sites) { if (o === s) continue; const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < sp * 0.75) out.push(o); }
      return out;
    }

    W.anim((dt) => {
      if (!atoms.length) build();
      const ctx = c.ctx, w = c.w, h = c.h;
      // --- physics (cartoon) ---
      const genRate = W.clamp(0.8 * Math.exp(2200 * (1 / 300 - 1 / T)), 0, 25); // pairs per second, visually compressed Boltzmann
      const minorityLife = mode === 'i' ? rnd(2.5, 4) : 0.5;
      if (Math.random() < genRate * dt && elec.length + holes.length < 120) {
        const s = sites[Math.floor(Math.random() * sites.length)];
        const lifeE = mode === 'p' ? minorityLife : (mode === 'n' ? rnd(2.5, 4) : minorityLife);
        const lifeH = mode === 'n' ? minorityLife : (mode === 'p' ? rnd(2.5, 4) : minorityLife);
        elec.push(Object.assign(newE(s.x, s.y, lifeE), { born: 0.4 }));
        holes.push(Object.assign(newH(s, lifeH), { born: 0.4 }));
      }
      const drift = field ? 1 : 0;
      for (const e of elec) {
        e.age += dt; if (e.born) e.born = Math.max(0, e.born - dt);
        if (Math.random() < 3 * dt) { const a = rnd(0, TAU); e.vx = Math.cos(a) * 45; e.vy = Math.sin(a) * 45; } // scattering
        e.x += (e.vx - drift * 38) * dt; e.y += e.vy * dt;
        if (e.x < 8) e.x += w - 16; if (e.x > w - 8) e.x -= w - 16;
        if (e.y < gy - 14) { e.y = gy - 14; e.vy = Math.abs(e.vy); } if (e.y > gy + (rows - 1) * sp + 14) { e.y = gy + (rows - 1) * sp + 14; e.vy = -Math.abs(e.vy); }
      }
      for (const ho of holes) {
        ho.age += dt; if (ho.born) ho.born = Math.max(0, ho.born - dt);
        ho.t -= dt;
        if (ho.t <= 0) {
          ho.t = rnd(0.12, 0.32);
          const nb = neighbours(ho.s);
          let pick;
          if (drift && Math.random() < 0.7) { const right = nb.filter((o) => o.x > ho.s.x + 1); pick = right.length ? right[Math.floor(Math.random() * right.length)] : null; if (!pick && ho.s.x > w - sp) pick = nearSite(gx, ho.s.y); }
          if (!pick) pick = nb[Math.floor(Math.random() * nb.length)];
          if (pick) ho.s = pick;
        }
        ho.x += (ho.s.x - ho.x) * Math.min(1, dt * 12); ho.y += (ho.s.y - ho.y) * Math.min(1, dt * 12);
      }
      // recombination: expired carriers annihilate with nearest partner
      for (let i = elec.length - 1; i >= 0; i--) {
        const e = elec[i];
        if (e.age > e.life && holes.length) {
          let bj = -1, bd = 1e9;
          holes.forEach((ho, j) => { const d = (ho.x - e.x) ** 2 + (ho.y - e.y) ** 2; if (ho.life !== Infinity || mode === 'p') if (d < bd) { bd = d; bj = j; } });
          if (bj >= 0 && (holes[bj].life !== Infinity || mode === 'p')) {
            if (holes[bj].life === Infinity) { /* p-type: an acceptor hole is refilled; a new one appears elsewhere */ holes[bj].s = sites[Math.floor(Math.random() * sites.length)]; holes[bj].x = holes[bj].s.x; holes[bj].y = holes[bj].s.y; }
            else holes.splice(bj, 1);
            elec.splice(i, 1);
          }
        }
      }
      for (let j = holes.length - 1; j >= 0; j--) {
        const ho = holes[j];
        if (ho.age > ho.life) {
          let bi = -1, bd = 1e9;
          elec.forEach((e, i) => { const d = (ho.x - e.x) ** 2 + (ho.y - e.y) ** 2; if (d < bd) { bd = d; bi = i; } });
          if (bi >= 0) {
            if (elec[bi].life === Infinity) { const s = sites[Math.floor(Math.random() * sites.length)]; elec[bi].x = s.x; elec[bi].y = s.y; }
            else elec.splice(bi, 1);
            holes.splice(j, 1);
          } else ho.age = 0;
        }
      }
      // --- draw ---
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = W.cssVar('--surface'); ctx.fillRect(0, 0, w, h);
      const ink = W.cssVar('--ink'), muted = W.cssVar('--muted'), line = W.cssVar('--line');
      // bonds
      ctx.strokeStyle = line; ctx.lineWidth = 2;
      for (const s of sites) {
        const o = s.h ? [0, 3] : [3, 0];
        const L = sp / 2 - 13;
        for (const k of [-1, 1]) {
          ctx.beginPath();
          if (s.h) { ctx.moveTo(s.x - L, s.y + k * o[1]); ctx.lineTo(s.x + L, s.y + k * o[1]); }
          else { ctx.moveTo(s.x + k * o[0], s.y - L); ctx.lineTo(s.x + k * o[0], s.y + L); }
          ctx.stroke();
        }
      }
      // atoms
      for (const a of atoms) {
        ctx.beginPath(); ctx.arc(a.x, a.y, 12, 0, TAU);
        ctx.fillStyle = a.kind === 'Si' ? W.cssVar('--surface2') : (a.kind === 'P' ? W.col('c3') : W.col('c5'));
        ctx.fill(); ctx.strokeStyle = a.kind === 'Si' ? muted : ink; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = a.kind === 'Si' ? muted : '#fff'; ctx.font = font(10, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(a.kind === 'Si' ? 'Si' : a.kind + (a.kind === 'P' ? '⁺' : '⁻'), a.x, a.y + 0.5);
      }
      // holes
      for (const ho of holes) {
        ctx.beginPath(); ctx.arc(ho.x, ho.y, 6.5 + (ho.born || 0) * 10, 0, TAU);
        ctx.strokeStyle = W.col('c2'); ctx.lineWidth = 2.4; ctx.stroke();
        ctx.fillStyle = W.col('c2'); ctx.font = font(10, 700); ctx.fillText('+', ho.x, ho.y + 0.5);
      }
      // electrons
      for (const e of elec) {
        ctx.beginPath(); ctx.arc(e.x, e.y, 4.5 + (e.born || 0) * 10, 0, TAU);
        ctx.fillStyle = W.col('c1'); ctx.fill();
      }
      // header
      ctx.font = font(12); ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.textBaseline = 'middle';
      const title = { i: 'Intrinsic silicon: only thermal pairs', n: 'n-type: donor (P⁺) electrons are the majority', p: 'p-type: acceptor (B⁻) holes are the majority' }[mode];
      ctx.fillText(title, 10, 13);
      if (field) {
        ctx.textAlign = 'right'; ctx.fillStyle = W.col('c4');
        ctx.fillText('E field →   (e⁻ drift ←, holes drift →)', w - 10, 13);
      }
      rE.set(elec.length); rH.set(holes.length);
    }, c.canvas);
  })();

  /* =====================================================================
   * Figure 4.2 — PN junction depletion region
   * ===================================================================== */
  (function pn() {
    const host = W.$('#w-pn');
    if (!host) return;
    const Vbi = 0.75;
    let V = 0;
    let carriers = [], crossers = [];
    let c = null;
    c = W.canvas(host, { height: 320, onResize: () => c && init() });
    const ctl = W.controls(host);
    W.slider(ctl, { label: 'Bias \\(V\\) (p relative to n)', min: -5, max: 0.8, step: 0.01, value: 0, unit: 'V', format: (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + ' V', onInput: (v) => { V = v; } });
    const rW = W.readout(ctl, { label: 'depletion width', unit: 'm' });
    const rI = W.readout(ctl, { label: 'current (1N4148-like)', unit: 'A' });
    const geom = () => ({ x0: 30, x1: c.w - 30, y0: 34, y1: 200, xm: c.w / 2 });
    const halfW = () => 0.05 * (c.w - 60) * Math.sqrt(Math.max(0.0004, (Vbi - V) / Vbi));
    function init() {
      if (!c.w) return;
      const g = geom(); carriers = []; crossers = [];
      const n = Math.round((c.w - 60) / 14);
      for (let i = 0; i < n; i++) {
        carriers.push({ side: 'p', x: rnd(g.x0 + 6, g.xm - 6), y: rnd(g.y0 + 8, g.y1 - 8), vx: rnd(-1, 1), vy: rnd(-1, 1) });
        carriers.push({ side: 'n', x: rnd(g.xm + 6, g.x1 - 6), y: rnd(g.y0 + 8, g.y1 - 8), vx: rnd(-1, 1), vy: rnd(-1, 1) });
      }
    }
    W.anim((dt) => {
      if (!carriers.length) init();
      const ctx = c.ctx, g = geom(), hw = halfW();
      const ink = W.cssVar('--ink'), muted = W.cssVar('--muted');
      // move majority carriers, excluded from the depletion region
      for (const k of carriers) {
        if (Math.random() < 2 * dt) { k.vx = rnd(-1, 1); k.vy = rnd(-1, 1); }
        k.x += k.vx * 30 * dt; k.y += k.vy * 30 * dt;
        if (k.y < g.y0 + 6) k.vy = Math.abs(k.vy); if (k.y > g.y1 - 6) k.vy = -Math.abs(k.vy);
        if (k.side === 'p') { if (k.x < g.x0 + 6) k.vx = Math.abs(k.vx); if (k.x > g.xm - hw - 4) { k.x = g.xm - hw - 4; k.vx = -Math.abs(k.vx); } }
        else { if (k.x > g.x1 - 6) k.vx = -Math.abs(k.vx); if (k.x < g.xm + hw + 4) { k.x = g.xm + hw + 4; k.vx = Math.abs(k.vx); } }
      }
      // crossing carriers: rate grows exponentially with forward bias
      const rate = V > 0 ? Math.min(40, 0.02 * Math.exp((V - 0.25) / 0.06)) : 0.25; // reverse: rare minority carriers swept across
      if (Math.random() < rate * dt) {
        const y = rnd(g.y0 + 10, g.y1 - 10);
        if (V > 0) {
          if (Math.random() < 0.5) crossers.push({ t: 'e', x: g.xm + hw + 4, y, dir: -1, life: rnd(0.6, 1.2) });
          else crossers.push({ t: 'h', x: g.xm - hw - 4, y, dir: 1, life: rnd(0.6, 1.2) });
        } else {
          // minority carrier swept by the field: electron from p side to n side, or hole from n to p
          if (Math.random() < 0.5) crossers.push({ t: 'e', x: g.xm - hw - 2, y, dir: 1, life: 0.9, minority: true });
          else crossers.push({ t: 'h', x: g.xm + hw + 2, y, dir: -1, life: 0.9, minority: true });
        }
      }
      for (const k of crossers) { k.x += k.dir * (k.minority ? 90 : 70) * dt; k.life -= dt; k.y += rnd(-20, 20) * dt; }
      crossers = crossers.filter((k) => k.life > 0 && k.x > g.x0 && k.x < g.x1);

      // --- draw ---
      ctx.clearRect(0, 0, c.w, c.h);
      ctx.fillStyle = W.cssVar('--surface'); ctx.fillRect(0, 0, c.w, c.h);
      // regions
      ctx.globalAlpha = 0.10; ctx.fillStyle = W.col('c2'); ctx.fillRect(g.x0, g.y0, g.xm - g.x0, g.y1 - g.y0);
      ctx.fillStyle = W.col('c1'); ctx.fillRect(g.xm, g.y0, g.x1 - g.xm, g.y1 - g.y0); ctx.globalAlpha = 1;
      ctx.fillStyle = W.cssVar('--surface2'); ctx.fillRect(g.xm - hw, g.y0, 2 * hw, g.y1 - g.y0);
      ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.strokeRect(g.x0 + 0.5, g.y0 + 0.5, g.x1 - g.x0, g.y1 - g.y0);
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(g.xm - hw, g.y0); ctx.lineTo(g.xm - hw, g.y1); ctx.moveTo(g.xm + hw, g.y0); ctx.lineTo(g.xm + hw, g.y1); ctx.stroke(); ctx.setLineDash([]);
      // fixed ions in a grid; visible (bold) only inside depletion region
      ctx.font = font(9, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let x = g.x0 + 9; x < g.x1 - 4; x += 13) for (let y = g.y0 + 10; y < g.y1 - 4; y += 15) {
        const p = x < g.xm, inDep = Math.abs(x - g.xm) < hw;
        ctx.globalAlpha = inDep ? 1 : 0.18;
        ctx.strokeStyle = p ? W.col('c5') : W.col('c3'); ctx.lineWidth = 1;
        ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
        ctx.fillStyle = ctx.strokeStyle; ctx.fillText(p ? '−' : '+', x, y + 0.5);
      }
      ctx.globalAlpha = 1;
      // carriers
      for (const k of carriers) {
        ctx.beginPath(); ctx.arc(k.x, k.y, 3.6, 0, TAU);
        if (k.side === 'n') { ctx.fillStyle = W.col('c1'); ctx.fill(); } else { ctx.strokeStyle = W.col('c2'); ctx.lineWidth = 2; ctx.stroke(); }
      }
      for (const k of crossers) {
        ctx.globalAlpha = Math.min(1, k.life * 2);
        ctx.beginPath(); ctx.arc(k.x, k.y, 4.2, 0, TAU);
        if (k.t === 'e') { ctx.fillStyle = W.col('c1'); ctx.fill(); } else { ctx.strokeStyle = W.col('c2'); ctx.lineWidth = 2.4; ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // labels
      ctx.font = font(13, 700); ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('p-type (anode)', g.x0, 16);
      ctx.textAlign = 'right'; ctx.fillText('n-type (cathode)', g.x1, 16);
      ctx.textAlign = 'center'; ctx.font = font(11); ctx.fillStyle = muted;
      ctx.fillText('depletion', g.xm, g.y1 + 12);
      // battery polarity hints
      ctx.font = font(15, 700);
      if (Math.abs(V) > 0.02) {
        ctx.fillStyle = W.col(V > 0 ? 'c4' : 'c1'); ctx.textAlign = 'left'; ctx.fillText(V > 0 ? '+' : '−', 10, (g.y0 + g.y1) / 2);
        ctx.fillStyle = W.col(V > 0 ? 'c1' : 'c4'); ctx.textAlign = 'right'; ctx.fillText(V > 0 ? '−' : '+', c.w - 10, (g.y0 + g.y1) / 2);
      }
      // energy barrier for electrons
      const by0 = 236, bh = 60, Ep = by0, scale = bh / 5.8;
      const barrier = Vbi - V;
      const yN = by0 + bh - 6, yP = yN - Math.max(2, barrier * scale * 2.2);
      ctx.strokeStyle = W.col('c1'); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let x = g.x0; x <= g.x1; x += 2) {
        let y;
        if (x < g.xm - hw) y = yP; else if (x > g.xm + hw) y = yN;
        else { const t = (x - (g.xm - hw)) / (2 * hw); y = t < 0.5 ? yP + (yN - yP) * 2 * t * t : yN - (yN - yP) * 2 * (1 - t) * (1 - t); }
        x === g.x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.font = font(11); ctx.fillStyle = muted; ctx.textAlign = 'left';
      ctx.fillText('electron energy (the hill to climb from n to p)', g.x0, Ep - 4);
      ctx.fillStyle = ink; ctx.textAlign = 'center';
      ctx.fillText(`barrier ≈ ${(Math.max(0, barrier)).toFixed(2)} eV`, g.xm, Math.min(yP, yN) - 10);
      // current arrow
      if (V > 0.45) {
        const th = W.clamp((V - 0.45) / 0.3, 0.1, 1);
        ctx.strokeStyle = W.col('c4'); ctx.fillStyle = W.col('c4'); ctx.lineWidth = 1.5 + 4 * th;
        const ay = g.y1 + 26; ctx.beginPath(); ctx.moveTo(g.xm - 70, ay); ctx.lineTo(g.xm + 60, ay); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g.xm + 72, ay); ctx.lineTo(g.xm + 58, ay - 7); ctx.lineTo(g.xm + 58, ay + 7); ctx.fill();
        ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText('I', g.xm + 78, ay);
      }
      rW.set(0.3e-6 * Math.sqrt(Math.max(0.0004, (Vbi - V) / Vbi)));
      const I = 2.5e-9 * (Math.exp(V / (1.75 * 0.02585)) - 1);
      rI.set(I);
    }, c.canvas);
  })();

  /* =====================================================================
   * Figure 4.3 — diode I–V curve with temperature
   * ===================================================================== */
  (function iv() {
    const host = W.$('#w-iv');
    if (!host) return;
    const T0 = 298.15;
    // n, Is0 at 25 °C, Rs, |dV/dT| (V/K) at the reference current
    const D = {
      si: { name: '1N4148 (Si)', n: 1.75, Is0: 2.5e-9, Rs: 0.6, tc: 1.9e-3, col: 'c6' },
      sch: { name: '1N5819 (Schottky)', n: 1.37, Is0: 3.2e-5, Rs: 0.05, tc: 1.4e-3, col: 'c5' },
      ir: { name: 'IR LED (940 nm)', vf: 1.25, n: 2.0, Rs: 2, tc: 1.6e-3, col: 'muted' },
      red: { name: 'Red LED', vf: 2.0, n: 2.0, Rs: 6, tc: 2e-3, col: 'c4' },
      grn: { name: 'Green LED (InGaN)', vf: 3.0, n: 2.6, Rs: 10, tc: 2.5e-3, col: 'c3' },
      blu: { name: 'Blue LED', vf: 3.2, n: 2.6, Rs: 10, tc: 2.5e-3, col: 'c1' },
    };
    const VT = (T) => kB * T;
    for (const k in D) {
      const d = D[k];
      if (d.vf) d.Is0 = 0.02 / Math.exp((d.vf - 0.02 * d.Rs) / (d.n * VT(T0))); // match Vf at 20 mA
      const Iref = 0.01, V0 = d.n * VT(T0) * Math.log(Iref / d.Is0);
      d.Eg = V0 + T0 * (d.tc - 3 * d.n * kB);
    }
    const Is = (d, T) => d.Is0 * Math.pow(T / T0, 3) * Math.exp((d.Eg / (d.n * kB)) * (1 / T0 - 1 / T));
    function Iof(d, V, T) {
      // solve Vj + Rs*I(Vj) = V by bisection
      const is = Is(d, T), nvt = d.n * VT(T);
      let lo = Math.min(V, 0) - 1, hi = V;
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const f = m + d.Rs * is * (Math.exp(m / nvt) - 1) - V; if (f > 0) hi = m; else lo = m; }
      const vj = (lo + hi) / 2;
      return is * (Math.exp(vj / nvt) - 1);
    }
    const Vat = (d, I, T) => d.n * VT(T) * Math.log(I / Is(d, T) + 1) + I * d.Rs;
    let sel = 'si', Tc = 25, logy = false;
    const p = W.plot(host, { xmin: 0, xmax: 4, ymin: 0, ymax: 0.05, xlabel: 'Forward voltage V (V)', ylabel: 'Current I (A)', hover: true, xunit: 'V', yunit: 'A', height: 300 });
    const ctl = W.controls(host);
    W.select(ctl, { label: 'Diode', value: sel, options: Object.keys(D).map((k) => [k, D[k].name]), onChange: (v) => { sel = v; upd(); } });
    W.segmented(ctl, { options: [['lin', 'Linear I'], ['log', 'Log I']], value: 'lin', onChange: (v) => { logy = v === 'log'; p.set(logy ? { ymin: 1e-12, ymax: 1, logy: true } : { ymin: 0, ymax: 0.05, logy: false }); upd(); } });
    W.slider(ctl, { label: 'Temperature', min: -40, max: 150, step: 1, value: 25, unit: '°C', format: (v) => v + ' °C', onInput: (v) => { Tc = v; upd(); } });
    const rV = W.readout(ctl, { label: '\\(V_F\\) at 10 mA', unit: 'V' });
    const rS = W.readout(ctl, { label: '\\(I_S\\)', unit: 'A' });
    function upd() {
      const T = Tc + 273.15, d = D[sel];
      p.draw((p) => {
        for (const k in D) if (k !== sel) p.fn((v) => Iof(D[k], v, T), { color: D[k].col, width: 1.2, dash: [4, 4], hover: false });
        p.fn((v) => Iof(d, v, T), { color: d.col === 'muted' ? 'c2' : d.col, width: 3, label: d.name, hoverFmt: (x, y) => `${W.si(x, 'V')}, ${W.si(y, 'A')}` });
        if (logy) { p.hline(Is(d, T), { color: 'c2' }); p.text(3.95, Is(d, T) * 2.5, 'I_S (leakage scale)', { align: 'right', color: 'muted', size: 11 }); }
        else p.hline(0.01, { color: 'muted' });
      });
      const vf = Vat(d, 0.01, T);
      rV.set(vf); rS.set(Is(d, T));
      if (sel === 'si' && vf < 0.6) Book.solve('iv-temp');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.4 — reverse-polarity protection (live DC solve)
   * ===================================================================== */
  (function revpol() {
    const host = W.$('#w-revpol');
    if (!host) return;
    const Vb = 7.4, Rint = 0.05;
    let mode = 'pfet', flipped = false, Iload = 2;
    const subs = {};
    const common = (protect) => [
      { t: 'V', id: 'bat', a: [60, 90], b: [60, 170], label: '7.4 V', side: -1 },
      ...protect,
      { t: 'wire', pts: [[60, 170], [60, 200], [400, 200], [400, 160]] },
      { t: 'D', id: 'esd', a: [320, 160], b: [320, 80], label: 'ESD', side: -1 },
      { t: 'wire', pts: [[320, 80], [320, 40]] }, { t: 'wire', pts: [[320, 160], [320, 200]] },
      { t: 'R', id: 'load', a: [400, 80], b: [400, 160], label: 'board' },
      { t: 'wire', pts: [[400, 40], [400, 80]] },
      { t: 'dot', at: [320, 40] }, { t: 'dot', at: [320, 200] },
      { t: 'gnd', at: [230, 200] },
      { t: 'tag', id: 'tv', at: [150, 232], text: 'V_load = –' },
      { t: 'tag', id: 'ti', at: [330, 232], text: 'I = –' },
    ];
    const defs = {
      none: common([{ t: 'wire', pts: [[60, 90], [60, 40], [400, 40]] }, { t: 'text', at: [190, 26], text: 'no protection' }]),
      si: common([{ t: 'wire', pts: [[60, 90], [60, 40], [150, 40]] }, { t: 'D', id: 'pd', a: [150, 40], b: [240, 40], label: '1N5400 (Si)' }, { t: 'wire', pts: [[240, 40], [400, 40]] }]),
      sch: common([{ t: 'wire', pts: [[60, 90], [60, 40], [150, 40]] }, { t: 'S', id: 'pd', a: [150, 40], b: [240, 40], label: 'SS54 (Schottky)' }, { t: 'wire', pts: [[240, 40], [400, 40]] }]),
      pfet: common([
        { t: 'wire', pts: [[60, 90], [60, 40], [100, 40], [100, 165], [215, 165], [215, 150]] },
        { t: 'pmos', id: 'q', at: [200, 120] },
        { t: 'text', at: [228, 128], text: 'P-FET', anchor: 'start' },
        { t: 'text', at: [228, 146], text: '20 mΩ', anchor: 'start' },
        { t: 'wire', pts: [[215, 90], [215, 40], [400, 40]] },
        { t: 'R', id: 'rg', a: [170, 120], b: [124, 120], label: '10 k', side: -1 },
        { t: 'gnd', at: [124, 120] },
      ]),
    };
    const paths = {
      none: [[60, 90], [60, 40], [400, 40], [400, 200], [60, 200], [60, 170]],
      si: [[60, 90], [60, 40], [400, 40], [400, 200], [60, 200], [60, 170]],
      sch: [[60, 90], [60, 40], [400, 40], [400, 200], [60, 200], [60, 170]],
      pfet: [[60, 90], [60, 40], [100, 40], [100, 165], [215, 165], [215, 40], [400, 40], [400, 200], [60, 200], [60, 170]],
    };
    const revPaths = {
      none: [[60, 170], [60, 200], [320, 200], [320, 40], [60, 40], [60, 90]],
      si: [[60, 170], [60, 200], [320, 200], [320, 40], [60, 40], [60, 90]],
      sch: [[60, 170], [60, 200], [320, 200], [320, 40], [60, 40], [60, 90]],
      pfet: [[60, 170], [60, 200], [320, 200], [320, 40], [215, 40], [215, 165], [100, 165], [100, 40], [60, 40], [60, 90]],
    };
    for (const k in defs) {
      const div = W.h('div', { class: 'sub-sch' }); host.append(div);
      const sch = W.schematic(div, { w: 480, h: 250, title: 'Reverse-polarity protection: ' + k, items: defs[k] });
      subs[k] = { div, sch, f: sch.flow(paths[k], { speed: 0 }), fr: sch.flow(revPaths[k], { speed: 0, color: 'c4' }) };
    }
    const ctl = W.$('#w-revpol-ctl');
    W.segmented(ctl, { options: [['none', 'None'], ['si', 'Si diode'], ['sch', 'Schottky'], ['pfet', 'P-MOSFET']], value: mode, onChange: (v) => { mode = v; upd(); } });
    W.slider(ctl, { label: 'Load current', min: 0.1, max: 5, step: 0.1, value: Iload, unit: 'A', onInput: (v) => { Iload = v; upd(); } });
    const flipBtn = W.button(ctl, '🔄 Flip battery', () => { flipped = !flipped; upd(); });
    const rV = W.readout(ctl, { label: 'load gets', unit: 'V' });
    const rP = W.readout(ctl, { label: 'protection loss', unit: 'W' });
    const st = W.h('span', { class: 'w-status' }); ctl.append(st);
    function upd() {
      for (const k in subs) subs[k].div.hidden = k !== mode;
      const S = subs[mode];
      const RL = Vb / Iload;
      const v = flipped ? -Vb : Vb;
      const net = [
        { name: 'B', type: 'V', n: ['bi', '0'], value: v },
        { name: 'Ri', type: 'R', n: ['bi', 'bp'], value: Rint },
        { name: 'RL', type: 'R', n: ['rail', '0'], value: RL },
        { name: 'E', type: 'D', n: ['0', 'rail'], vf: 0.7, rs: 0.05 },
      ];
      if (mode === 'none') net.push({ name: 'P', type: 'R', n: ['bp', 'rail'], value: 1e-3 });
      if (mode === 'si') net.push({ name: 'P', type: 'D', n: ['bp', 'rail'], vf: 0.75, rs: 0.08 });
      if (mode === 'sch') net.push({ name: 'P', type: 'D', n: ['bp', 'rail'], vf: 0.32, rs: 0.06 });
      if (mode === 'pfet') {
        net.push({ name: 'P', type: 'R', n: ['bp', 'rail'], value: flipped ? 1e9 : 0.02 });
        net.push({ name: 'BD', type: 'D', n: ['bp', 'rail'], vf: 0.7, rs: 0.1 });
      }
      const s = W.solveDC(net);
      const Ibat = s.i.B, Vr = s.v.rail;
      const Pprot = Math.abs((s.v.bp - s.v.rail) * (s.i.P + (s.i.BD || 0)));
      rV.set(Vr); rP.set(Pprot);
      rP.setClass(Pprot > 1 ? 'bad' : Pprot < 0.2 ? 'good' : '');
      S.sch.set('tv', { text: 'V_load = ' + W.si(Vr, 'V', 3) });
      S.sch.set('ti', { text: 'I = ' + W.si(Math.abs(Ibat), 'A', 3) });
      S.sch.set('bat', { label: flipped ? 'REV!' : '7.4 V' });
      const sp = Math.min(4, Math.log10(1 + Math.abs(Ibat) / 0.05));
      const big = Math.abs(Ibat) > 10;
      S.f.set(!flipped ? sp : 0);
      S.fr.set(flipped && Math.abs(Ibat) > 0.01 ? sp : 0);
      S.sch.set('esd', { glow: 0 });
      flipBtn.textContent = flipped ? '🔄 Fix battery' : '🔄 Flip battery';
      if (flipped && big) { st.textContent = `💥 ${Math.round(Math.abs(Ibat))} A backwards through the board's internal diodes!`; st.className = 'w-status bad'; }
      else if (flipped) { st.textContent = '✅ Blocked: nothing flows'; st.className = 'w-status good'; }
      else { st.textContent = `Efficiency ${(100 * Vr * (Vr / RL) / (Vb * Ibat)).toFixed(1)} %`; st.className = 'w-status'; }
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.5 — inductive kick with/without flyback clamp
   * ===================================================================== */
  (function flyback() {
    const host = W.$('#w-fly');
    if (!host) return;
    const Vs = 5, R = 70, L = 0.1, Vsat = 0.1, VBR = 60, tOff = 0.3e-3, tEnd = 4e-3;
    let mode = 'diode', Vz = 18, tNow = tEnd, sim = null;
    // schematic
    const sch = W.schematic(host, { w: 420, h: 250, title: 'Relay coil switched by a transistor, with flyback clamp', items: [
      { t: 'vcc', at: [200, 40], label: '+5 V' },
      { t: 'wire', pts: [[200, 40], [200, 60]] }, { t: 'wire', id: 'w1', pts: [[200, 60], [280, 60]] },
      { t: 'L', id: 'coil', a: [200, 60], b: [200, 140], label: 'coil 100 mH, 70 Ω', side: -1 },
      { t: 'wire', id: 'w2', pts: [[200, 140], [280, 140]] },
      { t: 'Z', id: 'z', a: [280, 60], b: [280, 100], label: 'Zener' },
      { t: 'wire', id: 'zw', pts: [[280, 60], [280, 100]] },
      { t: 'D', id: 'd', a: [280, 140], b: [280, 100], label: 'flyback' },
      { t: 'wire', pts: [[200, 140], [200, 160]] },
      { t: 'nmos', id: 'q', at: [185, 190] },
      { t: 'gnd', at: [200, 220] },
      { t: 'dot', at: [200, 140] }, { t: 'dot', at: [200, 60] },
      { t: 'tag', id: 'tag', at: [340, 200], text: 'ON' },
      { t: 'text', at: [150, 190], text: 'gate', anchor: 'end' },
      { t: 'text', at: [210, 156], text: 'V_sw', anchor: 'start' },
    ] });
    // re-anchor NMOS: its drain pin is at (200,160) and source at (200,220)
    const fOn = sch.flow([[200, 40], [200, 60], [200, 140], [200, 220]], { speed: 0 });
    const fFw = sch.flow([[200, 60], [200, 140], [280, 140], [280, 60], [200, 60]], { speed: 0, color: 'c4' });
    const pV = W.plot(host, { xmin: 0, xmax: tEnd * 1000, ymin: 0, ymax: 70, xlabel: 'time (ms)', ylabel: 'switch voltage (V)', height: 200, scope: true, xfmt: (v) => +v.toFixed(2) + '' });
    const pI = W.plot(host, { xmin: 0, xmax: tEnd * 1000, ymin: 0, ymax: 80, xlabel: 'time (ms)', ylabel: 'coil current (mA)', height: 170, scope: true, xfmt: (v) => +v.toFixed(2) + '' });
    const ctl = W.$('#w-fly-ctl');
    W.segmented(ctl, { options: [['none', 'No clamp'], ['diode', 'Diode'], ['zener', 'Diode + Zener']], value: mode, onChange: (v) => { mode = v; run(); } });
    const zs = W.slider(ctl, { label: 'Zener \\(V_Z\\)', min: 3.3, max: 47, step: 0.1, value: Vz, unit: 'V', format: (v) => v.toFixed(1) + ' V', onInput: (v) => { Vz = v; run(); } });
    W.button(ctl, '⚡ Switch off', () => run(true));
    const rPk = W.readout(ctl, { label: 'peak V', unit: 'V' });
    const rT = W.readout(ctl, { label: 'release time', unit: 's' });
    const rE = W.readout(ctl, { label: 'energy in transistor', unit: 'J' });

    function simulate() {
      const dt = 1e-6, out = [];
      let I = (Vs - Vsat) / R, t = 0, tRel = null, pk = 0, Etr = 0;
      while (t <= tEnd + 1e-12) {
        let V;
        if (t < tOff) V = Vsat;
        else if (I > 0) {
          if (mode === 'none') { V = VBR; Etr += V * I * dt; }
          else if (mode === 'diode') V = Vs + 0.7 + 0.5 * I;
          else V = Vs + 0.7 + Vz + 2 * I;
          const dI = (Vs - V - R * I) / L * dt;
          I = Math.max(0, I + dI);
          if (I === 0 && tRel == null) tRel = t - tOff;
        } else {
          const ts = t - tOff - (tRel || 0);
          V = mode === 'none' ? Vs + (VBR - Vs) * Math.exp(-ts / 25e-6) * Math.cos(ts * TAU / 40e-6) : Vs;
        }
        pk = Math.max(pk, V);
        out.push([t * 1000, V, I * 1000]);
        t += dt;
      }
      return { out, tRel, pk, Etr };
    }
    let anim = null;
    function run(animate) {
      zs.el.style.opacity = mode === 'zener' ? 1 : 0.4;
      sch.set('z', { hidden: mode !== 'zener', label: mode === 'zener' ? 'Zener ' + Vz.toFixed(0) + ' V' : '' }); sch.set('zw', { hidden: mode !== 'diode' }); sch.set('d', { hidden: mode === 'none', label: mode === 'none' ? '' : 'flyback' }); sch.set('w1', { hidden: mode === 'none' }); sch.set('w2', { hidden: mode === 'none' });
      sim = simulate();
      rPk.set(sim.pk); rPk.setClass(sim.pk > 40 ? 'bad' : 'good');
      rT.set(sim.tRel == null ? NaN : sim.tRel);
      rE.set(sim.Etr);
      if (mode !== 'none' && sim.pk < 40 && sim.tRel != null && sim.tRel < 0.6e-3) Book.solve('fly-task');
      tNow = animate ? 0 : tEnd;
      if (animate && anim) anim.start();
      draw();
    }
    function draw() {
      const tm = tNow * 1000;
      const pts = sim.out.filter((r) => r[0] <= tm);
      const step = Math.max(1, Math.floor(pts.length / 900));
      const sV = [], sI = [];
      for (let i = 0; i < pts.length; i += step) { sV.push([pts[i][0], pts[i][1]]); sI.push([pts[i][0], pts[i][2]]); }
      if (pts.length) { const l = pts[pts.length - 1]; sV.push([l[0], l[1]]); sI.push([l[0], l[2]]); }
      pV.draw((p) => { p.hline(40, { color: 'c4' }); p.text(tEnd * 1000 - 0.05, 43, '40 V transistor rating', { align: 'right', color: 'c4', size: 11 }); p.vline(tOff * 1000, { color: 'muted' }); p.line(sV, { color: 'c3', width: 2 }); });
      pI.draw((p) => { p.vline(tOff * 1000, { color: 'muted' }); p.line(sI, { color: 'c2', width: 2 }); });
      // schematic state
      const cur = pts.length ? pts[pts.length - 1] : [0, 0, 70];
      const on = tm < tOff * 1000;
      fOn.set(on ? 1.2 : 0);
      fFw.set(!on && mode !== 'none' && cur[2] > 0.5 ? 1.2 * cur[2] / 70 + 0.2 : 0);
      sch.set('tag', { text: on ? 'switch ON' : (cur[2] > 0.5 ? (mode === 'none' ? 'OFF: breakdown!' : 'OFF: freewheeling') : 'OFF') });
      sch.set('coil', { glow: 0 });
    }
    anim = W.anim((dt) => {
      if (tNow >= tEnd) return;
      tNow = Math.min(tEnd, tNow + dt * tEnd / 2.2);
      draw();
    }, pV.canvas);
    run(false);
  })();

  /* =====================================================================
   * Figure 4.6 — Zener shunt regulator
   * ===================================================================== */
  (function zener() {
    const host = W.$('#w-zener');
    if (!host) return;
    let Vin = 9, RL = 470;
    const Rs = 150, Vz = 5.1;
    const sch = W.schematic(host, { w: 420, h: 220, title: 'Zener shunt regulator', items: [
      { t: 'V', id: 'vin', a: [60, 80], b: [60, 150], label: '9 V' },
      { t: 'wire', pts: [[60, 80], [60, 40], [110, 40]] },
      { t: 'R', id: 'rs', a: [110, 40], b: [190, 40], label: 'Rs 150 Ω' },
      { t: 'wire', pts: [[190, 40], [340, 40], [340, 80]] },
      { t: 'Z', id: 'z', a: [250, 150], b: [250, 80], label: '5.1 V', side: -1 },
      { t: 'wire', pts: [[250, 40], [250, 80]] },
      { t: 'R', id: 'rl', a: [340, 80], b: [340, 150], label: 'load' },
      { t: 'wire', pts: [[60, 150], [60, 190], [340, 190], [340, 150]] },
      { t: 'wire', pts: [[250, 150], [250, 190]] },
      { t: 'dot', at: [250, 40] }, { t: 'dot', at: [250, 190] }, { t: 'gnd', at: [150, 190] },
      { t: 'tag', id: 'vo', at: [300, 18], text: 'Vout' },
    ] });
    const fz = sch.flow([[60, 80], [60, 40], [250, 40], [250, 190], [60, 190], [60, 150]], { speed: 0, color: 'c5' });
    const fl = sch.flow([[60, 80], [60, 40], [340, 40], [340, 190], [60, 190], [60, 150]], { speed: 0 });
    const ctl = W.$('#w-zener-ctl');
    W.slider(ctl, { label: '\\(V_{in}\\)', min: 4, max: 15, step: 0.1, value: Vin, unit: 'V', onInput: (v) => { Vin = v; upd(); } });
    W.slider(ctl, { label: 'Load \\(R_L\\)', min: 47, max: 10000, log: true, value: RL, unit: 'Ω', onInput: (v) => { RL = v; upd(); } });
    const rVo = W.readout(ctl, { label: 'Vout', unit: 'V' });
    const rIz = W.readout(ctl, { label: 'Zener current', unit: 'A' });
    const rIl = W.readout(ctl, { label: 'load current', unit: 'A' });
    const rPz = W.readout(ctl, { label: 'Zener power', unit: 'W' });
    function upd() {
      const s = W.solveDC([
        { name: 'V', type: 'V', n: ['in', '0'], value: Vin },
        { name: 'Rs', type: 'R', n: ['in', 'out'], value: Rs },
        { name: 'Z', type: 'D', n: ['out', '0'], vf: Vz, rs: 7 },
        { name: 'Zf', type: 'D', n: ['0', 'out'], vf: 0.7, rs: 1 },
        { name: 'RL', type: 'R', n: ['out', '0'], value: RL },
      ]);
      const Vo = s.v.out, Iz = Math.max(0, s.i.Z), Il = s.i.RL;
      rVo.set(Vo); rIz.set(Iz); rIl.set(Il); rPz.set(Iz * Vo);
      rIz.setClass(Iz < 0.002 ? 'bad' : 'good');
      sch.set('vin', { label: W.si(Vin, 'V', 3) });
      sch.set('rl', { label: 'load ' + W.si(RL, 'Ω', 2) });
      sch.set('vo', { text: 'Vout = ' + W.si(Vo, 'V', 3) });
      fz.set(Iz / 0.01); fl.set(Il / 0.01);
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.7 — NPN low-side switch for a relay
   * ===================================================================== */
  (function bjt() {
    const host = W.$('#w-bjt');
    if (!host) return;
    const Vcc = 5, Rc = 70, Vgpio = 3.3, Vbe = 0.75, Rpd = 10000;
    let Rb = 680, beta = 150, on = true;
    const sch = W.schematic(host, { w: 460, h: 260, title: 'NPN transistor switching a relay coil from a GPIO', items: [
      { t: 'vcc', at: [300, 34], label: '+5 V' },
      { t: 'wire', pts: [[300, 34], [300, 50], [370, 50]] },
      { t: 'L', id: 'coil', a: [300, 50], b: [300, 120], label: 'relay 70 Ω', side: -1 },
      { t: 'D', id: 'fd', a: [370, 120], b: [370, 50], label: '1N4148', side: -1 },
      { t: 'wire', pts: [[300, 120], [370, 120]] }, { t: 'dot', at: [300, 120] }, { t: 'dot', at: [300, 50] },
      { t: 'wire', pts: [[300, 120], [300, 150]] },
      { t: 'npn', id: 'q', at: [285, 180], label: '2N2222' },
      { t: 'wire', pts: [[300, 210], [300, 230]] }, { t: 'gnd', at: [300, 230] },
      { t: 'R', id: 'rb', a: [150, 180], b: [230, 180], label: 'Rb' },
      { t: 'wire', pts: [[230, 180], [255, 180]] }, { t: 'dot', at: [240, 180] },
      { t: 'R', id: 'rpd', a: [240, 180], b: [240, 230], label: '10 k', side: -1 },
      { t: 'gnd', at: [240, 230] },
      { t: 'Vsq', id: 'g', a: [100, 180], b: [100, 230], label: 'GPIO', side: -1 },
      { t: 'wire', pts: [[100, 180], [150, 180]] }, { t: 'gnd', at: [100, 230] },
      { t: 'tag', id: 'st', at: [110, 60], text: 'SATURATED' },
      { t: 'tag', id: 'vce', at: [110, 100], text: 'Vce' },
    ] });
    const fc = sch.flow([[300, 34], [300, 50], [300, 120], [300, 230]], { speed: 0 });
    const fb = sch.flow([[100, 180], [255, 180]], { speed: 0, color: 'c6', spacing: 14 });
    const ctl = W.$('#w-bjt-ctl');
    W.slider(ctl, { label: 'Base resistor \\(R_B\\)', min: 100, max: 47000, log: true, value: Rb, unit: 'Ω', onInput: (v) => { Rb = v; upd(); } });
    W.slider(ctl, { label: 'Transistor β', min: 20, max: 300, step: 1, value: beta, format: (v) => String(Math.round(v)), onInput: (v) => { beta = v; upd(); } });
    W.toggle(ctl, { label: 'GPIO high', value: on, onChange: (v) => { on = v; upd(); } });
    const rIb = W.readout(ctl, { label: 'GPIO current', unit: 'A' });
    const rIc = W.readout(ctl, { label: '\\(I_C\\)', unit: 'A' });
    const rVce = W.readout(ctl, { label: '\\(V_{CE}\\)', unit: 'V' });
    const rP = W.readout(ctl, { label: 'transistor power', unit: 'W' });
    function upd() {
      const Igpio = on ? (Vgpio - Vbe) / Rb : 0;
      const Ib = Math.max(0, Igpio - (on ? Vbe / Rpd : 0));
      const IcSat = (Vcc - 0.2) / Rc;
      const k = beta * Ib / IcSat;
      let Ic, Vce, state;
      if (!on || Ib <= 0) { Ic = 0; Vce = Vcc; state = 'OFF'; }
      else if (k >= 1) { Vce = 0.05 + 0.15 / k; Ic = (Vcc - Vce) / Rc; state = 'SATURATED'; }
      else { Ic = beta * Ib; Vce = Vcc - Ic * Rc; state = 'ACTIVE: hot, relay weak'; }
      const P = Vce * Ic + Vbe * Ib;
      rIb.set(Igpio); rIb.setClass(Igpio > 0.02 ? 'bad' : '');
      rIc.set(Ic); rVce.set(Vce); rP.set(P); rP.setClass(P > 0.1 ? 'bad' : '');
      const coilV = Vcc - Vce;
      sch.set('st', { text: state + (on && coilV < 3.75 ? ' · relay won\'t pull in' : '') });
      sch.set('vce', { text: 'V_CE = ' + W.si(Vce, 'V', 3) });
      sch.set('rb', { label: 'Rb ' + W.si(Rb, 'Ω', 2) });
      sch.set('q', { label: `2N2222 β=${Math.round(beta)}` });
      fc.set(Ic / 0.03); fb.set(Igpio / 0.002);
      if (on && Math.abs(beta - 50) < 0.5 && k >= 1 && Igpio < 0.005) Book.solve('bjt-task');
    }
    upd();
  })();

  /* =====================================================================
   * MOSFET model shared by Figures 4.8 and 4.10
   * ===================================================================== */
  const FETS = {
    irlz: { name: 'IRLZ44N (logic-level, 4–5 V)', Vt: 1.6, R0: 0.016, K: 33, col: 'c3' },
    irfz: { name: 'IRFZ44N (standard, 10 V)', Vt: 3.0, R0: 0.012, K: 26, col: 'c4' },
    ao: { name: 'AO3400A (2.5 V-rated)', Vt: 1.05, R0: 0.020, K: 36, col: 'c1' },
  };
  const rdsOn = (f, vgs) => (vgs <= f.Vt ? Infinity : f.R0 + 1 / (f.K * (vgs - f.Vt)));
  /** Operating point of a MOSFET in series with RL across Vs. Returns {Id, Vds}. */
  function fetOp(f, vgs, Vs, RL) {
    const vov = vgs - f.Vt;
    if (vov <= 0) return { Id: 1e-6 * Math.exp(vov / 0.1), Vds: Vs };
    const ich = (vch) => (vch < vov ? f.K * (vov * vch - vch * vch / 2) : f.K / 2 * vov * vov);
    let lo = 0, hi = Vs / RL;
    for (let i = 0; i < 60; i++) {
      const Id = (lo + hi) / 2, Vds = Vs - Id * RL, vch = Vds - Id * f.R0;
      if (vch < 0 || ich(vch) < Id) hi = Id; else lo = Id;
    }
    const Id = (lo + hi) / 2;
    return { Id, Vds: Vs - Id * RL };
  }

  /* =====================================================================
   * Figure 4.8 — Rds(on) vs Vgs and operating point
   * ===================================================================== */
  (function fet() {
    const host = W.$('#w-fet');
    if (!host) return;
    let sel = 'irfz', vgs = 3.3, Iload = 3;
    const Vs = 12;
    const p = W.plot(host, { xmin: 0, xmax: 10, ymin: 0.01, ymax: 10, logy: true, xlabel: 'Gate–source voltage V_GS (V)', ylabel: 'R_DS(on) (Ω)', hover: true, xunit: 'V', yunit: 'Ω', height: 290 });
    const ctl = W.$('#w-fet-ctl');
    W.select(ctl, { label: 'MOSFET', value: sel, options: Object.keys(FETS).map((k) => [k, FETS[k].name]), onChange: (v) => { sel = v; upd(); } });
    W.slider(ctl, { label: 'Gate drive \\(V_{GS}\\)', min: 0, max: 10, step: 0.1, value: vgs, unit: 'V', format: (v) => v.toFixed(1) + ' V', onInput: (v) => { vgs = v; upd(); } });
    W.slider(ctl, { label: 'Load wants', min: 0.5, max: 10, step: 0.1, value: Iload, unit: 'A', onInput: (v) => { Iload = v; upd(); } });
    const rI = W.readout(ctl, { label: 'actual \\(I_D\\)', unit: 'A' });
    const rV = W.readout(ctl, { label: '\\(V_{DS}\\)', unit: 'V' });
    const rP = W.readout(ctl, { label: 'MOSFET heat', unit: 'W' });
    const st = W.h('span', { class: 'w-status' }); ctl.append(st);
    function upd() {
      const f = FETS[sel];
      p.draw((p) => {
        p.vline(3.3, { color: 'c2' }); p.vline(5, { color: 'c2' });
        p.text(3.35, 6, '3.3 V', { color: 'c2', size: 11 }); p.text(5.05, 6, '5 V', { color: 'c2', size: 11 });
        for (const k in FETS) p.fn((v) => rdsOn(FETS[k], v), { color: FETS[k].col, width: k === sel ? 3 : 1.5, dash: k === sel ? null : [5, 4], label: FETS[k].name, hoverFmt: (x, y) => `${W.si(x, 'V')}: ${W.si(y, 'Ω')}` });
        const r = rdsOn(f, vgs);
        if (isFinite(r) && r < 10) p.point(vgs, r, { color: f.col, r: 6 });
      });
      const RL = Vs / Iload;
      const op = fetOp(f, vgs, Vs, RL);
      const P = op.Id * op.Vds;
      rI.set(op.Id); rV.set(op.Vds); rP.set(P);
      rP.setClass(P > 1 ? 'bad' : P < 0.3 ? 'good' : '');
      if (op.Id < 0.01) { st.textContent = 'OFF (below threshold)'; st.className = 'w-status'; }
      else if (op.Id < 0.97 * Iload) { st.textContent = '🔥 Not fully on: the MOSFET limits the current'; st.className = 'w-status bad'; }
      else { st.textContent = `Fully on: R_DS(on) ≈ ${W.si(op.Vds / op.Id, 'Ω', 2)}`; st.className = 'w-status good'; }
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.9 — gate charge, Miller plateau and switching loss
   * ===================================================================== */
  (function gate() {
    const host = W.$('#w-gate');
    if (!host) return;
    const Vdd = 12, Iload = 5, Cgs = 1.2e-9, CgdOff = 0.15e-9, CgdOn = 1.0e-9, Qgd = 4e-9, Vth = 1.4, gfs = 8;
    const Vpl = Vth + Iload / gfs;
    const drivers = { esp: ['ESP32 GPIO (3.3 V, ≈40 Ω)', 3.3, 40], ard: ['Arduino GPIO (5 V, ≈30 Ω)', 5, 30], drv: ['Gate driver IC (10 V, ≈2 Ω)', 10, 2] };
    let drv = 'esp', Rg = 100, fpwm = 20000;
    const pG = W.plot(host, { xmin: 0, xmax: 1e-6, ymin: 0, ymax: 11, xlabel: 'time', ylabel: 'gate V_GS (V)', xunit: 's', yunit: 'V', hover: true, height: 190 });
    const pD = W.plot(host, { xmin: 0, xmax: 1e-6, ymin: 0, ymax: 17, xlabel: 'time', ylabel: 'drain (V) / I_D (scaled)', xunit: 's', height: 200 });
    const ctl = W.$('#w-gate-ctl');
    W.select(ctl, { label: 'Driver', value: drv, options: Object.keys(drivers).map((k) => [k, drivers[k][0]]), onChange: (v) => { drv = v; upd(); } });
    W.slider(ctl, { label: 'Gate resistor \\(R_G\\)', min: 1, max: 4700, log: true, value: Rg, unit: 'Ω', onInput: (v) => { Rg = v; upd(); } });
    W.slider(ctl, { label: 'PWM frequency', min: 1000, max: 200000, log: true, value: fpwm, unit: 'Hz', onInput: (v) => { fpwm = v; upd(); } });
    const rT = W.readout(ctl, { label: 'switching time', unit: 's' });
    const rE = W.readout(ctl, { label: 'energy per edge', unit: 'J' });
    const rP = W.readout(ctl, { label: 'switching loss', unit: 'W' });
    function model() {
      const [, Vd, Rd] = drivers[drv];
      const R = Rg + Rd, tau1 = R * (Cgs + CgdOff), tau4 = R * (Cgs + CgdOn);
      if (Vd <= Vpl + 0.05) return null;
      const t1 = tau1 * Math.log(Vd / (Vd - Vth));
      const t2 = tau1 * Math.log((Vd - Vth) / (Vd - Vpl));
      const t3 = Qgd / ((Vd - Vpl) / R);
      const tA = t1, tB = t1 + t2, tC = tB + t3;
      const vgs = (t) => {
        if (t < tB) return Vd * (1 - Math.exp(-t / tau1));
        if (t < tC) return Vpl;
        return Vd - (Vd - Vpl) * Math.exp(-(t - tC) / tau4);
      };
      const id = (t) => (t < tA ? 0 : t < tB ? gfs * (vgs(t) - Vth) : Iload);
      const vds = (t) => (t < tB ? Vdd : t < tC ? Vdd * (1 - (t - tB) / t3) + 0.05 : 0.1);
      return { vgs, id, vds, t1, t2, t3, tA, tB, tC, tau4, Vd };
    }
    function upd() {
      const m = model();
      if (!m) {
        pG.draw((p) => p.text(0.5e-6, 6, 'Drive voltage is below the plateau: the MOSFET never fully turns on', { align: 'center', color: 'c4' }));
        pD.draw(() => {}); rT.set('—'); rE.set('—'); rP.set('—'); return;
      }
      const tmax = Math.max(50e-9, (m.tC + 4 * m.tau4) * 1.15);
      pG.set({ xmax: tmax, ymax: Math.max(4, m.Vd * 1.1) });
      pD.set({ xmax: tmax });
      pG.draw((p) => {
        p.area(() => 99, m.tB, m.tC, { color: 'c5', alpha: 0.10 }, () => 0);
        p.hline(Vth, { color: 'muted' }); p.text(tmax * 0.99, Vth - 0.35, 'V_th', { align: 'right', color: 'muted', size: 11 });
        p.fn(m.vgs, { color: 'c1', label: 'V_GS' });
        p.text((m.tB + m.tC) / 2, Vpl + 0.7, 'Miller plateau', { align: 'center', color: 'c5', size: 11 });
      });
      pD.draw((p) => {
        p.area((t) => 12 * m.vds(t) * m.id(t) / (Vdd * Iload / 4) / 4 * 0.98, 0, m.tC + 1e-12, { color: 'c4', alpha: 0.22 });
        p.fn(m.vds, { color: 'c4', label: 'V_DS (V)' });
        p.fn((t) => m.id(t) * 12 / Iload, { color: 'c3', label: 'I_D (top = 5 A)' });
      });
      const tsw = m.t2 + m.t3;
      const E = 0.5 * Vdd * Iload * tsw;
      rT.set(tsw); rE.set(E); rP.set(2 * E * fpwm);
      rP.setClass(2 * E * fpwm > 0.5 ? 'bad' : '');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.10 — low-side N vs high-side P (direct) vs high-side P + NPN
   * ===================================================================== */
  (function sides() {
    const host = W.$('#w-sides');
    if (!host) return;
    let topo = 'low', gpio = false;
    const mk = (items) => { const div = W.h('div', { class: 'sub-sch' }); host.append(div); return { div, sch: W.schematic(div, { w: 460, h: 260, title: 'MOSFET switch topology', items }) }; };
    const T = {
      low: mk([
        { t: 'vcc', at: [300, 30], label: '+12 V' },
        { t: 'wire', pts: [[300, 30], [300, 50], [370, 50]] },
        { t: 'M', id: 'm', a: [300, 50], b: [300, 120], label: 'motor', side: -1 },
        { t: 'D', id: 'fd', a: [370, 120], b: [370, 50], label: 'SS34', side: -1 },
        { t: 'wire', pts: [[300, 120], [370, 120]] },
        { t: 'wire', pts: [[300, 120], [300, 140]] },
        { t: 'nmos', id: 'q', at: [285, 170], label: 'N-FET' },
        { t: 'wire', pts: [[300, 200], [300, 225]] }, { t: 'gnd', at: [300, 225] },
        { t: 'Vsq', id: 'g', a: [120, 170], b: [120, 225], label: 'GPIO', side: -1 }, { t: 'gnd', at: [120, 225] },
        { t: 'wire', pts: [[120, 170], [165, 170]] },
        { t: 'R', a: [165, 170], b: [215, 170], label: '100 Ω' },
        { t: 'wire', pts: [[215, 170], [255, 170]] }, { t: 'dot', at: [232, 170] },
        { t: 'R', a: [232, 170], b: [232, 225], label: '100 k' }, { t: 'gnd', at: [232, 225] },
        { t: 'tag', id: 'vgs', at: [110, 50], text: 'Vgs' }, { t: 'tag', id: 'st', at: [110, 90], text: '' },
      ]),
      pdir: mk([
        { t: 'vcc', at: [300, 30], label: '+12 V' },
        { t: 'pmos', id: 'q', at: [285, 80], label: 'P-FET' },
        { t: 'wire', pts: [[300, 30], [300, 50]] },
        { t: 'wire', pts: [[300, 110], [300, 130], [370, 130]] },
        { t: 'M', id: 'm', a: [300, 130], b: [300, 200], label: 'motor', side: -1 },
        { t: 'D', id: 'fd', a: [370, 200], b: [370, 130], label: 'SS34', side: -1 },
        { t: 'wire', pts: [[300, 200], [370, 200]] }, { t: 'wire', pts: [[300, 200], [300, 225]] }, { t: 'gnd', at: [300, 225] },
        { t: 'Vsq', id: 'g', a: [120, 80], b: [120, 140], label: 'GPIO', side: -1 }, { t: 'gnd', at: [120, 140] },
        { t: 'wire', pts: [[120, 80], [175, 80]] },
        { t: 'R', a: [175, 80], b: [225, 80], label: '100 Ω' },
        { t: 'wire', pts: [[225, 80], [255, 80]] },
        { t: 'tag', id: 'vgs', at: [140, 190], text: 'Vgs' }, { t: 'tag', id: 'st', at: [140, 225], text: '' },
      ]),
      pnpn: mk([
        { t: 'vcc', at: [300, 30], label: '+12 V' },
        { t: 'pmos', id: 'q', at: [285, 80], label: 'P-FET' },
        { t: 'wire', pts: [[235, 30], [300, 30], [300, 50]] },
        { t: 'R', a: [235, 80], b: [235, 30], label: '10 k' },
        { t: 'wire', pts: [[235, 80], [255, 80]] }, { t: 'dot', at: [235, 80] },
        { t: 'R', a: [235, 80], b: [235, 135], label: '1 k' },
        { t: 'npn', id: 'qn', at: [220, 165] },
        { t: 'wire', pts: [[235, 195], [235, 215]] }, { t: 'gnd', at: [235, 215] },
        { t: 'R', a: [140, 165], b: [190, 165], label: '1 k' },
        { t: 'Vsq', id: 'g', a: [90, 165], b: [90, 215], label: 'GPIO', side: -1 }, { t: 'gnd', at: [90, 215] },
        { t: 'wire', pts: [[90, 165], [140, 165]] },
        { t: 'wire', pts: [[300, 110], [300, 130], [370, 130]] },
        { t: 'M', id: 'm', a: [300, 130], b: [300, 200], label: 'motor', side: -1 },
        { t: 'D', id: 'fd', a: [370, 200], b: [370, 130], label: 'SS34', side: -1 },
        { t: 'wire', pts: [[300, 200], [370, 200]] }, { t: 'wire', pts: [[300, 200], [300, 225]] }, { t: 'gnd', at: [300, 225] },
        { t: 'tag', id: 'vgs', at: [90, 50], text: 'Vgs' }, { t: 'tag', id: 'st', at: [90, 90], text: '' },
      ]),
    };
    T.low.f = T.low.sch.flow([[300, 30], [300, 50], [300, 225]], { speed: 0 });
    T.pdir.f = T.pdir.sch.flow([[300, 30], [300, 225]], { speed: 0 });
    T.pnpn.f = T.pnpn.sch.flow([[300, 30], [300, 225]], { speed: 0 });
    const ctl = W.$('#w-sides-ctl');
    W.segmented(ctl, { options: [['low', 'Low-side N'], ['pdir', 'High-side P, direct'], ['pnpn', 'High-side P + NPN']], value: topo, onChange: (v) => { topo = v; upd(); } });
    const gb = W.button(ctl, 'GPIO: LOW', () => { gpio = !gpio; upd(); });
    const rV = W.readout(ctl, { label: '\\(V_{GS}\\)', unit: 'V' });
    const st = W.h('span', { class: 'w-status' }); ctl.append(st);
    function upd() {
      for (const k in T) T[k].div.hidden = k !== topo;
      const S = T[topo], vg = gpio ? 3.3 : 0;
      let vgs, on;
      if (topo === 'low') { vgs = vg; on = vgs > 2.5; }
      else if (topo === 'pdir') { vgs = vg - 12; on = vgs < -2.5; }
      else { vgs = gpio ? 0.2 * 1 - 12 + 12 * (1000 / 11000) : 0; on = gpio; }
      if (topo === 'pnpn' && gpio) vgs = -12 * 10000 / 11000 + 0.18; // divider 10k/1k with NPN saturated
      gb.textContent = 'GPIO: ' + (gpio ? 'HIGH (3.3 V)' : 'LOW (0 V)');
      rV.set(vgs);
      S.sch.set('vgs', { text: 'V_GS = ' + W.si(vgs, 'V', 3) });
      S.sch.set('st', { text: on ? 'motor ON' : 'motor off' });
      S.sch.set('m', { spin: on ? 1.2 : 0 });
      S.sch.set('g', { label: 'GPIO ' + (gpio ? '3.3 V' : '0 V') });
      S.f.set(on ? 1.3 : 0);
      if (topo === 'pdir') { st.textContent = '❌ The P-FET is on whether the GPIO is high or low'; st.className = 'w-status bad'; }
      else if (topo === 'pnpn') { st.textContent = '✅ NPN pulls the gate down; 10 k pulls it back up to 12 V'; st.className = 'w-status good'; }
      else { st.textContent = '✅ Source at ground, so V_GS = GPIO voltage'; st.className = 'w-status good'; }
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.11 — interactive H-bridge
   * ===================================================================== */
  (function hbridge() {
    const host = W.$('#w-hb');
    if (!host) return;
    const st = { q1: false, q2: false, q3: false, q4: false };
    let sch;
    const tog = (id) => (c) => { st[id] = c; upd(); };
    sch = W.schematic(host, { w: 460, h: 300, title: 'H-bridge with four switches', items: [
      { t: 'vcc', at: [230, 36], label: 'V_M = 7.4 V' },
      { t: 'wire', id: 'top', pts: [[120, 50], [120, 36], [340, 36], [340, 50]] },
      { t: 'SW', id: 'q1', a: [120, 50], b: [120, 110], label: 'Q1', side: -1, onToggle: tog('q1') },
      { t: 'SW', id: 'q2', a: [120, 190], b: [120, 250], label: 'Q2', side: -1, onToggle: tog('q2') },
      { t: 'SW', id: 'q3', a: [340, 50], b: [340, 110], label: 'Q3', onToggle: tog('q3') },
      { t: 'SW', id: 'q4', a: [340, 190], b: [340, 250], label: 'Q4', onToggle: tog('q4') },
      { t: 'wire', id: 'wl', pts: [[120, 110], [120, 190]] },
      { t: 'wire', id: 'wr', pts: [[340, 110], [340, 190]] },
      { t: 'wire', pts: [[120, 150], [195, 150]] }, { t: 'wire', pts: [[265, 150], [340, 150]] },
      { t: 'M', id: 'm', a: [195, 150], b: [265, 150] },
      { t: 'dot', at: [120, 150] }, { t: 'dot', at: [340, 150] },
      { t: 'text', at: [140, 138], text: 'A', anchor: 'start' }, { t: 'text', at: [320, 138], text: 'B', anchor: 'end' },
      { t: 'wire', id: 'bot', pts: [[120, 250], [120, 270], [340, 270], [340, 250]] },
      { t: 'gnd', at: [230, 270] },
      { t: 'tag', id: 'tag', at: [230, 210], text: 'COAST (all off)' },
    ] });
    const fwd = sch.flow([[230, 36], [120, 36], [120, 150], [340, 150], [340, 270], [230, 270]], { speed: 0 });
    const rev = sch.flow([[230, 36], [340, 36], [340, 150], [120, 150], [120, 270], [230, 270]], { speed: 0 });
    const stL = sch.flow([[230, 36], [120, 36], [120, 270], [230, 270]], { speed: 0, color: 'c4', spacing: 10, r: 3.4 });
    const stR = sch.flow([[230, 36], [340, 36], [340, 270], [230, 270]], { speed: 0, color: 'c4', spacing: 10, r: 3.4 });
    const ctl = W.$('#w-hb-ctl');
    const status = W.h('span', { class: 'w-status' }); ctl.append(status);
    const set = (a) => { for (const k in st) { st[k] = a.includes(k); sch.set(k, { closed: st[k] }); } upd(); };
    W.button(ctl, 'Forward', () => set(['q1', 'q4']));
    W.button(ctl, 'Reverse', () => set(['q3', 'q2']));
    W.button(ctl, 'Brake', () => set(['q2', 'q4']));
    W.button(ctl, 'All off', () => set([]));
    let warned = false;
    function upd() {
      const { q1, q2, q3, q4 } = st;
      const shootL = q1 && q2, shootR = q3 && q4;
      let text, cls = '', spin = 0;
      const F = q1 && q4 && !shootL && !shootR, R = q3 && q2 && !shootL && !shootR;
      if (shootL || shootR) { text = '💥 SHOOT-THROUGH: supply shorted through ' + (shootL ? 'Q1+Q2' : '') + (shootL && shootR ? ' and ' : '') + (shootR ? 'Q3+Q4' : '') + ' (≈100+ A)'; cls = 'bad'; }
      else if (F) { text = 'FORWARD: current A → B'; cls = 'good'; spin = 1.4; }
      else if (R) { text = 'REVERSE: current B → A'; cls = 'good'; spin = -1.4; }
      else if ((q2 && q4) || (q1 && q3)) { text = 'BRAKE: motor terminals shorted together'; }
      else if (!q1 && !q2 && !q3 && !q4) text = 'COAST (all off)';
      else text = 'One side connected only: no current path through the motor';
      status.textContent = text; status.className = 'w-status ' + cls;
      sch.set('tag', { text: shootL || shootR ? 'SHOOT-THROUGH!' : text.split(':')[0] });
      sch.set('m', { spin });
      fwd.set(F ? 1.4 : 0); rev.set(R ? 1.4 : 0);
      stL.set(shootL ? 4 : 0); stR.set(shootR ? 4 : 0);
      sch.set('wl', { stroke: shootL ? 'c4' : '' }); sch.set('wr', { stroke: shootR ? 'c4' : '' });
      sch.set('top', { stroke: shootL || shootR ? 'c4' : '' }); sch.set('bot', { stroke: shootL || shootR ? 'c4' : '' });
      if ((shootL || shootR) && !warned) { warned = true; Book.toast('💥 Shoot-through! In real hardware that is a dead MOSFET (or a melted wire).'); }
      if (R) Book.solve('hb-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.12 — op-amp workbench
   * ===================================================================== */
  (function opamp() {
    const host = W.$('#w-opamp');
    if (!host) return;
    const AMPS = {
      ideal: { name: 'Ideal rail-to-rail', gbw: 1e9, sr: 1e9, lo: 0, hi: 5, cmLo: -0.1, cmHi: 5.1 },
      mcp: { name: 'MCP6002 (RRIO, 1 MHz)', gbw: 1e6, sr: 0.6e6, lo: 0.025, hi: 4.975, cmLo: -0.3, cmHi: 5.3 },
      lm: { name: 'LM358 (5 V supply)', gbw: 0.7e6, sr: 0.3e6, lo: 0.02, hi: 3.5, cmLo: 0, cmHi: 3.5 },
    };
    let cfg = 'noninv', amp = 'ideal', Rf = 10000, A = 0.4, ofs = 1.0, Vref = 2.5, f = 1000;
    const Rg = 10000;
    const mk = (items) => { const div = W.h('div', { class: 'sub-sch' }); host.append(div); const sch = W.schematic(div, { w: 440, h: 215, title: 'Op-amp circuit', items }); return { div, sch }; };
    const outW = [{ t: 'wire', pts: [[274, 100], [340, 100]] }, { t: 'text', at: [346, 100], text: 'Vout', anchor: 'start' }, { t: 'dot', at: [300, 100] }];
    const S = {
      buf: mk([
        { t: 'opamp', at: [220, 100], plusTop: true },
        { t: 'Vac', a: [60, 85], b: [60, 150], label: 'Vin' }, { t: 'gnd', at: [60, 150] },
        { t: 'wire', pts: [[60, 85], [170, 85]] },
        { t: 'wire', pts: [[170, 115], [150, 115], [150, 165], [300, 165], [300, 100]] },
        ...outW,
      ]),
      noninv: mk([
        { t: 'opamp', at: [220, 100], plusTop: true },
        { t: 'Vac', a: [55, 85], b: [55, 150], label: 'Vin', side: -1 }, { t: 'gnd', at: [55, 150] },
        { t: 'wire', pts: [[55, 85], [170, 85]] },
        { t: 'wire', pts: [[170, 115], [115, 115]] }, { t: 'dot', at: [140, 115] },
        { t: 'R', id: 'rg', a: [115, 115], b: [115, 175], label: 'Rg', side: -1 }, { t: 'gnd', at: [115, 175] },
        { t: 'wire', pts: [[140, 115], [140, 160], [190, 160]] },
        { t: 'R', id: 'rf', a: [190, 160], b: [250, 160], label: 'Rf' },
        { t: 'wire', pts: [[250, 160], [300, 160], [300, 100]] },
        ...outW,
      ]),
      inv: mk([
        { t: 'opamp', at: [220, 100] },
        { t: 'Vac', a: [40, 85], b: [40, 150], label: 'Vin' }, { t: 'gnd', at: [40, 150] },
        { t: 'wire', pts: [[40, 85], [80, 85]] },
        { t: 'R', a: [80, 85], b: [130, 85], label: 'Rin 10 k' },
        { t: 'wire', pts: [[130, 85], [170, 85]] }, { t: 'dot', at: [145, 85] },
        { t: 'wire', pts: [[145, 85], [145, 40], [190, 40]] },
        { t: 'R', id: 'rf', a: [190, 40], b: [250, 40], label: 'Rf' },
        { t: 'wire', pts: [[250, 40], [300, 40], [300, 100]] },
        { t: 'wire', pts: [[170, 115], [150, 115], [150, 140]] },
        { t: 'Vdc', id: 'vr', a: [150, 140], b: [150, 190], label: 'Vref', side: -1 }, { t: 'gnd', at: [150, 190] },
        ...outW,
      ]),
      comp: mk([
        { t: 'opamp', at: [220, 100], plusTop: true },
        { t: 'Vac', a: [60, 85], b: [60, 150], label: 'Vin' }, { t: 'gnd', at: [60, 150] },
        { t: 'wire', pts: [[60, 85], [170, 85]] },
        { t: 'wire', pts: [[170, 115], [130, 115], [130, 140]] },
        { t: 'Vdc', id: 'vr', a: [130, 140], b: [130, 190], label: 'Vref', side: -1 }, { t: 'gnd', at: [130, 190] },
        { t: 'wire', pts: [[274, 100], [340, 100]] }, { t: 'text', at: [346, 100], text: 'Vout', anchor: 'start' },
      ]),
    };
    const p = W.plot(host, { xmin: 0, xmax: 2, ymin: 0, ymax: 5.2, xlabel: 'time (periods)', ylabel: 'volts', height: 240, xfmt: (v) => +v.toFixed(1) + '' });
    const ctl = W.$('#w-opamp-ctl');
    W.segmented(ctl, { options: [['buf', 'Buffer'], ['noninv', 'Non-inverting'], ['inv', 'Inverting'], ['comp', 'Comparator']], value: cfg, onChange: (v) => { cfg = v; upd(); } });
    W.select(ctl, { label: 'Op-amp', value: amp, options: Object.keys(AMPS).map((k) => [k, AMPS[k].name]), onChange: (v) => { amp = v; upd(); } });
    const sRf = W.slider(ctl, { label: '\\(R_f\\)', min: 1000, max: 1e6, log: true, value: Rf, unit: 'Ω', onInput: (v) => { Rf = v; upd(); } });
    W.slider(ctl, { label: 'Input amplitude', min: 0.02, max: 2.5, step: 0.01, value: A, unit: 'V', onInput: (v) => { A = v; upd(); } });
    W.slider(ctl, { label: 'Input offset (DC)', min: 0, max: 5, step: 0.05, value: ofs, unit: 'V', onInput: (v) => { ofs = v; upd(); } });
    const sVr = W.slider(ctl, { label: '\\(V_{ref}\\)', min: 0, max: 5, step: 0.05, value: Vref, unit: 'V', onInput: (v) => { Vref = v; upd(); } });
    W.slider(ctl, { label: 'Frequency', min: 10, max: 200000, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    const rG = W.readout(ctl, { label: 'gain', fmt: (v) => (typeof v === 'number' ? v.toFixed(2) : v) });
    const stat = W.h('span', { class: 'w-status' }); ctl.append(stat);
    function upd() {
      for (const k in S) S[k].div.hidden = k !== cfg;
      sRf.el.style.opacity = cfg === 'noninv' || cfg === 'inv' ? 1 : 0.4;
      sVr.el.style.opacity = cfg === 'inv' || cfg === 'comp' ? 1 : 0.4;
      if (S[cfg].sch.parts.rf) S[cfg].sch.set('rf', { label: 'Rf ' + W.si(Rf, 'Ω', 2) });
      if (S[cfg].sch.parts.vr) S[cfg].sch.set('vr', { label: 'Vref ' + W.si(Vref, 'V', 2) });
      const a = AMPS[amp];
      const G = cfg === 'buf' ? 1 : cfg === 'noninv' ? 1 + Rf / Rg : cfg === 'inv' ? -Rf / Rg : Infinity;
      const NG = cfg === 'buf' ? 1 : cfg === 'noninv' ? 1 + Rf / Rg : cfg === 'inv' ? 1 + Rf / Rg : 1;
      const fc = a.gbw / NG, T = 1 / f, N = 1500, dt = T / N, k = Math.exp(-TAU * fc * dt);
      const cm = (v) => W.clamp(v, a.cmLo, a.cmHi);
      let y = cfg === 'comp' ? a.lo : W.clamp(cfg === 'inv' ? Vref : ofs * (cfg === 'buf' ? 1 : G), a.lo, a.hi);
      const vin = [], vout = [];
      let clipped = false, slew = false, cmBad = false;
      for (let i = 0; i < 5 * N; i++) {
        const t = i * dt, x = ofs + A * Math.sin(TAU * f * t);
        if (x < a.cmLo || x > a.cmHi || ((cfg === 'inv' || cfg === 'comp') && (Vref < a.cmLo || Vref > a.cmHi))) cmBad = true;
        const xi = cm(x);
        let target;
        if (cfg === 'buf') target = xi;
        else if (cfg === 'noninv') target = G * xi;
        else if (cfg === 'inv') target = Vref + G * (xi - cm(Vref));
        else target = xi > cm(Vref) ? 99 : -99;
        if (cfg !== 'comp') target = W.clamp(target, a.lo, a.hi);
        let ynext = cfg === 'comp' ? (target > 0 ? a.hi : a.lo) : target + (y - target) * k;
        let rate = (ynext - y) / dt;
        if (Math.abs(rate) > a.sr) { rate = Math.sign(rate) * a.sr; if (i > 3 * N && cfg !== 'comp') slew = true; }
        y += rate * dt;
        if (y > a.hi) { y = a.hi; if (i > 3 * N && cfg !== 'comp') clipped = true; }
        if (y < a.lo) { y = a.lo; if (i > 3 * N && cfg !== 'comp') clipped = true; }
        if (i >= 3 * N && i % 3 === 0) { vin.push([(i - 3 * N) / N, x]); vout.push([(i - 3 * N) / N, y]); }
      }
      p.draw((p) => {
        p.hline(a.hi, { color: 'c4' }); p.hline(a.lo, { color: 'c4' });
        if (amp === 'lm') p.text(1.98, a.hi + 0.22, 'LM358 output ceiling ≈ Vcc − 1.5 V', { align: 'right', color: 'c4', size: 11 });
        if (cfg === 'inv' || cfg === 'comp') p.hline(Vref, { color: 'c5', dash: [2, 4] });
        p.line(vin, { color: 'c1', label: 'Vin', width: 2 });
        p.line(vout, { color: 'c2', label: 'Vout', width: 2.5 });
      });
      rG.set(cfg === 'comp' ? 'open loop (≈10⁵)' : G);
      const msgs = [];
      if (cmBad) msgs.push('input outside common-mode range');
      if (clipped) msgs.push('clipping at a rail');
      if (slew) msgs.push('slew-rate limited');
      if (!slew && !clipped && cfg !== 'comp' && f > fc / 3) msgs.push('near the bandwidth limit (GBW/G)');
      stat.textContent = msgs.length ? '⚠️ ' + msgs.join(' · ') : '✅ linear: the golden rules hold';
      stat.className = 'w-status ' + (msgs.length ? 'bad' : 'good');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.13 — low-side current sense into an ADC
   * ===================================================================== */
  (function isense() {
    const host = W.$('#w-isense');
    if (!host) return;
    let I = 2, Rs = 0.05, G = 20;
    const sch = W.schematic(host, { w: 470, h: 260, title: 'Shunt resistor and non-inverting amplifier feeding an ADC', items: [
      { t: 'vcc', at: [100, 30], label: '+12 V' },
      { t: 'M', id: 'm', a: [100, 45], b: [100, 110], label: 'motor', side: -1 },
      { t: 'wire', pts: [[100, 30], [100, 45]] }, { t: 'wire', pts: [[100, 110], [100, 130]] }, { t: 'dot', at: [100, 130] },
      { t: 'R', id: 'rs', a: [100, 130], b: [100, 200], label: 'shunt', side: -1 },
      { t: 'wire', pts: [[100, 200], [100, 220]] }, { t: 'gnd', at: [100, 220] },
      { t: 'opamp', at: [250, 110], plusTop: true, label: 'MCP6002 @ 3.3 V' },
      { t: 'wire', pts: [[100, 130], [160, 130], [160, 95], [200, 95]] },
      { t: 'wire', pts: [[200, 125], [180, 125], [180, 175]] }, { t: 'dot', at: [180, 175] },
      { t: 'R', a: [180, 175], b: [180, 230], label: 'Rg', side: -1 }, { t: 'gnd', at: [180, 230] },
      { t: 'wire', pts: [[180, 175], [210, 175]] },
      { t: 'R', id: 'rf', a: [210, 175], b: [280, 175], label: 'Rf', side: -1 },
      { t: 'wire', pts: [[280, 175], [320, 175], [320, 110]] }, { t: 'dot', at: [320, 110] },
      { t: 'ic', id: 'adc', at: [410, 110], name: 'ESP32', left: ['ADC'], w: 70 },
      { t: 'wire', pts: [[304, 110], 'adc.ADC'] },
      { t: 'tag', id: 'tv', at: [410, 60], text: 'V' },
    ] });
    const fl = sch.flow([[100, 30], [100, 220]], { speed: 0 });
    const ctl = W.$('#w-isense-ctl');
    W.slider(ctl, { label: 'Motor current', min: 0, max: 8, step: 0.05, value: I, unit: 'A', onInput: (v) => { I = v; upd(); } });
    W.select(ctl, { label: 'Shunt', value: '0.05', options: [['0.005', '5 mΩ'], ['0.01', '10 mΩ'], ['0.02', '20 mΩ'], ['0.05', '50 mΩ'], ['0.1', '100 mΩ']], onChange: (v) => { Rs = +v; upd(); } });
    W.slider(ctl, { label: 'Gain \\(1 + R_f/R_g\\)', min: 1, max: 200, log: true, value: G, format: (v) => String(Math.round(v)), onInput: (v) => { G = Math.round(v); upd(); } });
    const rVs = W.readout(ctl, { label: 'shunt voltage', unit: 'V' });
    const rPs = W.readout(ctl, { label: 'shunt power', unit: 'W' });
    const rVa = W.readout(ctl, { label: 'ADC voltage', unit: 'V' });
    const rC = W.readout(ctl, { label: 'ADC code', fmt: (v) => String(v) });
    const rRes = W.readout(ctl, { label: 'resolution', fmt: (v) => W.si(v, 'A', 3) + '/step' });
    function upd() {
      const Vs = I * Rs, Ps = I * I * Rs, Vraw = Vs * G, Va = Math.min(3.3 - 0.02, Vraw);
      const code = Math.round(Va / 3.3 * 4095);
      rVs.set(Vs); rPs.set(Ps); rPs.setClass(Ps >= 0.5 ? 'bad' : '');
      rVa.set(Va); rVa.setClass(Vraw > 3.28 ? 'bad' : '');
      rC.set(Vraw > 3.28 ? code + ' (clipped!)' : code);
      rRes.set(3.3 / 4095 / (Rs * G));
      sch.set('rs', { label: 'shunt ' + W.si(Rs, 'Ω', 2) });
      sch.set('rf', { label: `Rf = ${G - 1}·Rg` });
      sch.set('tv', { text: (Vraw > 3.28 ? 'CLIPPED ' : '') + W.si(Va, 'V', 3) });
      fl.set(I / 1.5);
      sch.set('m', { spin: I / 4 });
      if (Math.abs(I - 5) < 0.06 && Vraw >= 2.5 && Vraw <= 3.2 && Ps < 0.5) Book.solve('isense-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 4.14 — annotated datasheet
   * ===================================================================== */
  (function datasheet() {
    const host = W.$('#w-ds');
    if (!host) return;
    const notes = {
      1: '<b>Title line.</b> "Enhancement-mode" means it is off with zero gate voltage (normal for discrete MOSFETs). SOT-23 tells you immediately that it is tiny: a few hundred milliwatts to about 1 W of heat, whatever the current rating says.',
      2: '<b>Absolute maximum ratings</b> are a cliff edge, not a target. Exceeding any of them, even for microseconds, may damage the part, and nothing is guaranteed when you operate near them.',
      3: '<b>\\(V_{GS}\\) ±12 V</b>: many small logic-level MOSFETs have thin gate oxide and a ±8 V or ±12 V limit. Drive this gate from a 12 V or 4S battery rail and you puncture the oxide. Clamp with a Zener if needed.',
      4: '<b>Continuous \\(I_D\\)</b> is computed, not measured in your circuit: it assumes the junction at 150 °C with the ideal copper area of note 5 and a 25 °C ambient. It is a thermal limit, so the real limit is set by your board and your ambient temperature (notice it already drops to 4.6 A at 70 °C).',
      5: '<b>\\(R_{\\theta JA}\\)</b> depends hugely on copper. 90 °C/W assumes a 1 in² pad of 2 oz copper. On a minimal footprint it can be 200–250 °C/W, which more than halves the power the part can handle.',
      6: '<b>\\(V_{GS(th)}\\)</b> is measured at just 250 µA. It tells you when the MOSFET <em>starts</em> to conduct, not when it is fully on. The spread (0.65 to 1.45 V) is also typical: thresholds vary by a factor of two between parts.',
      7: '<b>\\(R_{DS(on)}\\)</b> is the number you design with. Pick the row at or below your gate voltage (3.3 V drive → use the 2.5 V row, 40 mΩ max). Note the condition \\(T_J\\) = 25 °C: a hot part is 1.4–1.6× worse. "Typ" is a nice-to-have; "Max" is the promise.',
      8: '<b>\\(Q_g\\)</b> tells you how much charge the driver must move every switching edge. 6 nC from a GPIO that supplies about 20 mA takes roughly 300 ns, fine for 20 kHz PWM. Missing "max" values are common here.',
      9: '<b>Pulse test.</b> The electrical characteristics were measured with short pulses so the die stayed at 25 °C. Your steady-state circuit heats the die, so expect worse numbers than the table.',
    };
    const box = W.$('#ds-note');
    host.querySelectorAll('.ds-mark').forEach((b) => b.addEventListener('click', () => {
      host.querySelectorAll('.ds-mark').forEach((x) => x.classList.toggle('on', x === b));
      box.innerHTML = notes[b.dataset.n];
      if (window.Book && Book.renderMath) Book.renderMath(box);
    }));
  })();
})();
