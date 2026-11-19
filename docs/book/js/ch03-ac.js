/* Chapter 3 — capacitors, inductors & frequency widgets */
(function () {
  'use strict';
  const TAU = 2 * Math.PI;
  const showPart = (sch, id, on) => {
    const r = sch.parts[id];
    if (!r) return;
    r.g.style.display = on ? '' : 'none';
    if (r.text) r.text.style.display = on ? '' : 'none';
  };
  const fmtT = (s) => W.si(s, 's', 3);
  const deg = (r) => (r * 180) / Math.PI;
  // seeded PRNG (mulberry32) so random patterns are reproducible
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ---------------- Figure 3.1: i = C dv/dt ---------------- */
  (function () {
    const T = 1e-3, C = 1e-6, L = 10e-3;
    let comp = 'C', wave = 'tri', tr = 20e-6;
    const w = (t) => {
      const p = ((t / T) % 1 + 1) % 1, r = tr / T;
      if (wave === 'tri') return p < 0.5 ? -1 + 4 * p : 3 - 4 * p;
      if (wave === 'sine') return Math.sin(TAU * p);
      if (p < r) return -1 + 2 * p / r;
      if (p < 0.5) return 1;
      if (p < 0.5 + r) return 1 - 2 * (p - 0.5) / r;
      return -1;
    };
    const dw = (t) => {
      const p = ((t / T) % 1 + 1) % 1, r = tr / T;
      if (wave === 'tri') return (p < 0.5 ? 4 : -4) / T;
      if (wave === 'sine') return TAU / T * Math.cos(TAU * p);
      if (p < r) return 2 / tr;
      if (p >= 0.5 && p < 0.5 + r) return -2 / tr;
      return 0;
    };
    // capacitor: forced v = 1 V * w, i = C dv/dt. inductor: forced i = 10 mA * w, v = L di/dt
    const top = W.plot('#f-ddt', { xmin: 0, xmax: 2e-3, ymin: -1.3, ymax: 1.3, xlabel: '', ylabel: 'v (V)', hover: true, xunit: 's', yunit: 'V', height: 170 });
    const bot = W.plot('#f-ddt', { xmin: 0, xmax: 2e-3, ymin: -1, ymax: 1, xlabel: 'time', ylabel: 'i (A)', hover: true, xunit: 's', yunit: 'A', height: 190 });
    const peak = () => { let m = 0; for (let i = 0; i <= 4000; i++) m = Math.max(m, Math.abs(dw(i / 4000 * 2e-3))); return m; };
    top.draw((p) => p.fn((t) => (comp === 'C' ? 1 : 0.01) * w(t), { color: comp === 'C' ? 'c1' : 'c2', width: 2.5, samples: 3000 }));
    bot.draw((p) => p.fn((t) => (comp === 'C' ? C * 1 : L * 0.01) * dw(t), { color: comp === 'C' ? 'c2' : 'c1', width: 2.5, samples: 3000 }));
    const ctl = W.controls('#f-ddt');
    W.segmented(ctl, { options: [['C', 'Capacitor 1 µF'], ['L', 'Inductor 10 mH']], value: comp, onChange: (v) => { comp = v; upd(); } });
    W.segmented(ctl, { options: [['tri', 'Triangle'], ['sine', 'Sine'], ['sq', 'Square']], value: wave, onChange: (v) => { wave = v; upd(); } });
    W.slider(ctl, { label: 'edge time (square)', min: 2e-6, max: 200e-6, log: true, value: tr, unit: 's', onInput: (v) => { tr = v; upd(); } });
    const ctl2 = W.controls('#f-ddt');
    const rp = W.readout(ctl2, { label: 'peak' });
    const note = W.h('p', { class: 'ch3-note' });
    W.$('#f-ddt').append(note);
    function upd() {
      const pk = peak() * (comp === 'C' ? C : L * 0.01);
      const unitTop = comp === 'C' ? ['v (V)', 'V'] : ['i (A)', 'A'], unitBot = comp === 'C' ? ['i = C dv/dt (A)', 'A'] : ['v = L di/dt (V)', 'V'];
      top.set({ ylabel: unitTop[0], yunit: unitTop[1], ymin: comp === 'C' ? -1.3 : -0.013, ymax: comp === 'C' ? 1.3 : 0.013 });
      bot.set({ ylabel: unitBot[0], yunit: unitBot[1], ymin: -pk * 1.25, ymax: pk * 1.25 });
      rp.set((comp === 'C' ? 'current ' + W.si(pk, 'A') : 'voltage ' + W.si(pk, 'V')));
      note.textContent = comp === 'C'
        ? 'You force the voltage (top); the capacitor demands the current (bottom). Flat voltage → zero current.'
        : 'You force the current (top); the inductor develops the voltage (bottom). Flat current → zero voltage.';
      top.update(); bot.update();
    }
    upd();
  })();

  /* ---------------- Figure 3.2: RC transient ---------------- */
  (function () {
    const V = 5;
    let R = 4700, C = 100e-6, vc = 0, mode = 'idle', t = 0, rec = [];
    const sch = W.schematic('#f-rc', {
      w: 440, h: 238, title: 'RC circuit with charge and discharge switches',
      items: [
        { t: 'V', a: [50, 90], b: [50, 170], label: '5 V' },
        { t: 'wire', pts: [[50, 90], [50, 50], [90, 50]] },
        { t: 'SW', id: 'sc', a: [90, 50], b: [140, 50], label: 'charge', closed: false },
        { t: 'wire', pts: [[140, 50], [190, 50]] },
        { t: 'dot', at: [165, 50] },
        { t: 'wire', pts: [[165, 50], [165, 100]] },
        { t: 'SW', id: 'sd', a: [165, 100], b: [165, 150], label: 'discharge', closed: false },
        { t: 'wire', pts: [[165, 150], [165, 210]] },
        { t: 'R', id: 'r', a: [190, 50], b: [270, 50], label: 'R' },
        { t: 'wire', pts: [[270, 50], [310, 50], [310, 100]] },
        { t: 'C', id: 'c', a: [310, 100], b: [310, 160], label: 'C' },
        { t: 'wire', pts: [[310, 160], [310, 210], [50, 210], [50, 170]] },
        { t: 'dot', at: [165, 210] }, { t: 'gnd', at: [240, 210] },
        { t: 'tag', id: 'tv', at: [385, 130], text: 'vC' },
      ],
    });
    const fCh = sch.flow([[50, 170], [50, 50], [310, 50], [310, 210], [50, 210], [50, 170]], {});
    const fDis = sch.flow([[310, 100], [310, 50], [165, 50], [165, 210], [310, 210], [310, 160]], {});
    const pv = W.plot('#f-rc', { xmin: 0, xmax: 6, ymin: 0, ymax: 5.5, ylabel: 'vC (V)', hover: true, xunit: 's', yunit: 'V', height: 180 });
    const pi = W.plot('#f-rc', { xmin: 0, xmax: 6, ymin: -1, ymax: 1, xlabel: 'time since switching (s)', ylabel: 'i (mA)', hover: true, xunit: 's', height: 160 });
    const tau = () => R * C;
    const marks = (p) => { for (let k = 1; k <= 5; k++) { p.vline(k * tau(), { color: 'muted', width: 1 }); p.text(k * tau(), p.o.ymax * 0.93, ' ' + k + 'τ', { color: 'muted', size: 11 }); } };
    pv.draw((p) => {
      marks(p);
      if (mode === 'charge' || (rec.length && rec.m === 'charge')) p.hline(V * (1 - Math.exp(-1)), { color: 'c3', width: 1 });
      if (rec.length > 1) p.line(rec.map((r) => [r[0], r[1]]), { color: 'c1', width: 2.5, label: 'vC' });
    });
    pi.draw((p) => {
      marks(p);
      if (rec.length > 1) p.line(rec.map((r) => [r[0], r[2] * 1000]), { color: 'c2', width: 2.5, label: 'current' });
    });
    const ctl = W.controls('#f-rc');
    W.slider(ctl, { label: '\\(R\\)', min: 1000, max: 100000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; reset(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 10e-6, max: 1000e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; reset(); } });
    const ctl2 = W.controls('#f-rc');
    const rt = W.readout(ctl2, { label: '\\(\\tau = RC\\)' });
    const rv = W.readout(ctl2, { label: '\\(v_C\\)', unit: 'V' });
    const rpb = W.readout(ctl2, { label: 'playback' });
    const speed = () => Math.max(0.05, tau()); // sim seconds per wall second → one τ per second
    function reset() {
      rec = []; rec.m = mode; t = 0;
      pv.set({ xmax: 6 * tau() }); pi.set({ xmax: 6 * tau(), ymin: -V / R * 1000 * 1.1, ymax: V / R * 1000 * 1.1 });
      sch.set('r', { label: 'R ' + W.si(R, 'Ω', 3) }); sch.set('c', { label: 'C ' + W.si(C, 'F', 3) });
      rt.set(fmtT(tau()));
      const sp = speed(); rpb.set(Math.abs(sp - 1) < 0.02 ? 'real time' : sp > 1 ? W.fix(sp, 2) + '× faster' : W.fix(1 / sp, 1) + '× slower');
      pv.update(); pi.update();
    }
    const setMode = (m) => {
      mode = m;
      sch.set('sc', { closed: m === 'charge' }); sch.set('sd', { closed: m === 'discharge' });
      reset(); rec.push([0, vc, 0]);
    };
    sch.parts.sc.it.onToggle = (cl) => setMode(cl ? 'charge' : 'idle');
    sch.parts.sd.it.onToggle = (cl) => setMode(cl ? 'discharge' : 'idle');
    let acc = 0;
    W.anim((dt) => {
      if (mode === 'idle') { fCh.set(0); fDis.set(0); return; }
      const h = dt * speed(), target = mode === 'charge' ? V : 0;
      vc = target + (vc - target) * Math.exp(-h / tau());
      t += h;
      const i = (target - vc) / R;
      if (t <= 6 * tau()) rec.push([t, vc, i]);
      const sp = Math.min(3, Math.abs(i) / (V / R) * 3);
      fCh.set(mode === 'charge' ? sp : 0); fDis.set(mode === 'discharge' ? sp : 0);
      sch.set('tv', { text: 'vC = ' + vc.toFixed(2) + ' V' }); rv.set(vc);
      acc += dt; if (acc > 0.05) { acc = 0; pv.update(); pi.update(); }
      if (mode === 'charge' && Math.abs(tau() - 1) <= 0.05 && t >= tau()) Book.solve('rc-task');
    }, sch.svg);
    reset(); rv.set(0); sch.set('tv', { text: 'vC = 0.00 V' });
  })();

  /* ---------------- Figure 3.3: RL transient & flyback ---------------- */
  (function () {
    const V = 12, L = 0.1, R = 100, Roff = 10000, Vf = 0.7, I0 = V / R, tau = L / R, t1 = 5e-3, tEnd = 10e-3;
    let diode = false, cur = tEnd, running = false;
    const i1 = I0 * (1 - Math.exp(-t1 / tau));
    const iOf = (t) => {
      if (t < 0) return 0;
      if (t <= t1) return I0 * (1 - Math.exp(-t / tau));
      const s = t - t1;
      if (diode) { const v = (i1 + Vf / R) * Math.exp(-s / tau) - Vf / R; return Math.max(0, v); }
      const iInf = V / (R + Roff);
      return iInf + (i1 - iInf) * Math.exp(-s * (R + Roff) / L);
    };
    // voltage across the switch: 0 while closed; with the diode, V + Vf while the diode conducts;
    // without it, the switch is modelled as a 10 kΩ arc, so V_sw = i * Roff.
    const vsw = (t) => { if (t <= t1) return 0; const i = iOf(t); return diode ? (i > 0 ? V + Vf : V) : i * Roff; };
    const sch = W.schematic('#f-rl', {
      w: 460, h: 238, title: 'Relay coil switched from 12 V with optional flyback diode',
      items: [
        { t: 'V', a: [50, 90], b: [50, 170], label: '12 V' },
        { t: 'wire', pts: [[50, 90], [50, 50], [100, 50]] },
        { t: 'SW', id: 'sw', a: [100, 50], b: [160, 50], label: 'switch', closed: false },
        { t: 'wire', pts: [[160, 50], [300, 50], [300, 65]] },
        { t: 'L', id: 'l', a: [300, 65], b: [300, 115], label: 'L 0.1 H', side: -1 },
        { t: 'wire', pts: [[300, 115], [300, 125]] },
        { t: 'R', id: 'r', a: [300, 125], b: [300, 175], label: 'R 100 Ω', side: -1 },
        { t: 'wire', pts: [[300, 175], [300, 210], [50, 210], [50, 170]] },
        { t: 'wire', id: 'dw1', pts: [[300, 50], [390, 50], [390, 90]] },
        { t: 'D', id: 'd', a: [390, 150], b: [390, 90], label: 'flyback' },
        { t: 'wire', id: 'dw2', pts: [[390, 150], [390, 210], [300, 210]] },
        { t: 'dot', id: 'dd1', at: [300, 50] }, { t: 'dot', id: 'dd2', at: [300, 210] },
        { t: 'gnd', at: [170, 210] },
        { t: 'tag', id: 'arc', at: [130, 92], text: '⚡ ARC ⚡' },
      ],
    });
    const fMain = sch.flow([[50, 170], [50, 50], [300, 50], [300, 210], [50, 210], [50, 170]], {});
    const fD = sch.flow([[300, 50], [300, 210], [390, 210], [390, 50], [300, 50]], { color: 'c3' });
    const pI = W.plot('#f-rl', { xmin: 0, xmax: tEnd, ymin: 0, ymax: 0.14, ylabel: 'coil current (A)', hover: true, xunit: 's', yunit: 'A', height: 170 });
    const pV = W.plot('#f-rl', { xmin: 0, xmax: tEnd, ymin: 0, ymax: 1400, xlabel: 'time', ylabel: 'V across switch', hover: true, xunit: 's', yunit: 'V', height: 190 });
    const upto = (f) => (t) => (t <= cur ? f(t) : NaN);
    pI.draw((p) => { p.vline(t1, { color: 'muted' }); p.text(t1, 0.13, ' switch opens', { color: 'muted', size: 11 }); p.fn(upto(iOf), { color: 'c2', samples: 2500, width: 2.5 }); });
    pV.draw((p) => { p.vline(t1, { color: 'muted' }); p.fn(upto(vsw), { color: 'c4', samples: 4000, width: 2.5 }); });
    const ctl = W.controls('#f-rl');
    const runBtn = W.button(ctl, '▶ Run', () => { cur = 0; running = true; });
    void runBtn;
    W.toggle(ctl, { label: 'flyback diode', value: diode, onChange: (v) => { diode = v; setD(); } });
    const rpk = W.readout(ctl, { label: 'peak switch voltage', unit: 'V' });
    const setD = () => {
      for (const id of ['d', 'dw1', 'dw2', 'dd1', 'dd2']) showPart(sch, id, diode);
      pV.set({ ymax: diode ? 16 : 1400 });
      let pk = 0; for (let i = 0; i <= 20000; i++) pk = Math.max(pk, vsw(t1 + i * 1e-8)); rpk.set(pk); rpk.setClass(pk > 50 ? 'bad' : 'good');
      pI.update(); pV.update(); paint();
    };
    function paint() {
      sch.set('sw', { closed: running ? cur < t1 : false });
      const i = iOf(cur);
      const sp = Math.min(3, i / I0 * 3);
      fMain.set(running && cur < t1 ? sp : 0);
      fD.set(running && cur >= t1 && diode ? sp : 0);
      const arc = running && !diode && cur >= t1 && cur < t1 + 0.4e-3;
      showPart(sch, 'arc', arc);
    }
    W.anim((dt) => {
      if (!running) return;
      cur += dt * tEnd / 4; // 4 s per run
      if (cur >= tEnd) { cur = tEnd; running = false; }
      pI.update(); pV.update(); paint();
    }, sch.svg);
    setD();
  })();

  /* ---------------- Figure 3.4: debouncing ---------------- */
  (function () {
    const VDD = 3.3, Rpu = 10000, VTp = 1.8, VTm = 1.0, Vth = 1.65, tPress = 2e-3, tEnd = 30e-3, dt = 4e-6;
    let R = 1000, C = 100e-9, seed = 7, data = null;
    const sch = W.schematic('#f-bounce', {
      w: 480, h: 205, title: 'Button with pull-up, RC filter and Schmitt buffer',
      items: [
        { t: 'vcc', at: [60, 35], label: '3.3 V' },
        { t: 'R', a: [60, 35], b: [60, 100], label: '10 kΩ' },
        { t: 'wire', pts: [[60, 100], [60, 120]] },
        { t: 'PB', id: 'pb', a: [60, 120], b: [60, 170], label: 'press me' },
        { t: 'wire', pts: [[60, 170], [60, 182]] }, { t: 'gnd', at: [60, 182] },
        { t: 'wire', pts: [[60, 110], [120, 110]] }, { t: 'dot', at: [60, 110] },
        { t: 'R', id: 'r', a: [120, 110], b: [200, 110], label: 'R' },
        { t: 'wire', pts: [[200, 110], [282, 110]] },
        { t: 'wire', pts: [[240, 110], [240, 135]] }, { t: 'dot', at: [240, 110] },
        { t: 'C', id: 'c', a: [240, 135], b: [240, 172], label: 'C' },
        { t: 'wire', pts: [[240, 172], [240, 182]] }, { t: 'gnd', at: [240, 182] },
        { t: 'ic', at: [340, 110], name: 'Schmitt', left: ['A'], right: ['Y'] },
        { t: 'wire', pts: [[398, 110], [440, 110]] }, { t: 'text', at: [446, 110], text: 'MCU', anchor: 'start' },
        { t: 'text', at: [96, 96], text: 'raw' }, { t: 'text', at: [262, 96], text: 'filtered' },
      ],
    });
    const pa = W.plot('#f-bounce', { xmin: 0, xmax: tEnd, ymin: -0.2, ymax: 3.6, ylabel: 'volts', hover: true, xunit: 's', yunit: 'V', height: 210 });
    const pd = W.plot('#f-bounce', { xmin: 0, xmax: tEnd, ymin: -0.3, ymax: 2.5, xlabel: 'time', ylabel: 'outputs', height: 130, yfmt: () => '' });
    function simulate() {
      const r = rng(seed);
      // bounce pattern: list of [tStart, closed]
      const ev = []; let tt = tPress, closed = true, n = 4 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) {
        ev.push([tt, closed]);
        const dur = closed ? 60e-6 + r() * 500e-6 : 40e-6 + r() * 600e-6 * (1 - k / n);
        tt += dur; closed = !closed;
      }
      ev.push([tt, true]);
      const N = Math.round(tEnd / dt), raw = new Float32Array(N), filt = new Float32Array(N), plain = new Uint8Array(N), sch2 = new Uint8Array(N);
      let v = VDD, j = -1, sw = false, sOut = 1;
      const nz = rng(seed * 7 + 1);
      for (let i = 0; i < N; i++) {
        const t = i * dt;
        while (j + 1 < ev.length && ev[j + 1][0] <= t) { j++; sw = ev[j][1]; }
        raw[i] = sw ? 0 : VDD;
        const tgt = sw ? 0 : VDD, Rs = sw ? R : R + Rpu;
        v = tgt + (v - tgt) * Math.exp(-dt / (Rs * C));
        const vin = v + (nz() - 0.5) * 0.12;
        filt[i] = vin;
        plain[i] = vin > Vth ? 1 : 0;
        if (sOut && vin < VTm) sOut = 0; else if (!sOut && vin > VTp) sOut = 1;
        sch2[i] = sOut;
      }
      const count = (a) => { let c = 0; for (let i = 1; i < a.length; i++) if (a[i] !== a[i - 1]) c++; return c; };
      let first = -1; for (let i = 1; i < N; i++) if (sch2[i] !== sch2[i - 1]) { first = i * dt; break; }
      data = { raw, filt, plain, sch2, N, np: count(plain), ns: count(sch2), delay: first < 0 ? Infinity : first - tPress };
    }
    const series = (a, f, step = 1) => { const out = []; for (let i = 0; i < data.N; i += step) out.push([i * dt, f(a[i])]); return out; };
    const digital = (a, off) => { const out = [[0, off + a[0]]]; for (let i = 1; i < data.N; i++) if (a[i] !== a[i - 1]) { out.push([i * dt, off + a[i - 1]], [i * dt, off + a[i]]); } out.push([tEnd, off + a[data.N - 1]]); return out; };
    pa.draw((p) => {
      if (!data) return;
      p.hline(VTp, { color: 'c3', width: 1 }); p.hline(VTm, { color: 'c3', width: 1 }); p.hline(Vth, { color: 'muted', width: 1, dash: [2, 3] });
      p.text(tEnd * 0.995, VTp + 0.12, 'VT+', { color: 'c3', align: 'right', size: 11 });
      p.text(tEnd * 0.995, VTm - 0.13, 'VT−', { color: 'c3', align: 'right', size: 11 });
      p.line(digital(Array.from(data.raw, (x) => (x > 1 ? 1 : 0)), 0).map(([x, y]) => [x, y * VDD]), { color: 'c4', width: 1.4, label: 'raw switch' });
      p.line(series(data.filt, (x) => x, 3), { color: 'c1', width: 2, label: 'RC filtered (+ noise)' });
    });
    pd.draw((p) => {
      if (!data) return;
      p.line(digital(data.plain, 1.3), { color: 'c2', width: 2 });
      p.line(digital(data.sch2, 0), { color: 'c5', width: 2 });
      p.text(tEnd * 0.995, 1.85, 'plain threshold: ' + data.np + ' edges', { color: 'c2', align: 'right', size: 12 });
      p.text(tEnd * 0.995, 0.55, 'Schmitt: ' + data.ns + ' edge' + (data.ns === 1 ? '' : 's'), { color: 'c5', align: 'right', size: 12 });
    });
    const ctl = W.controls('#f-bounce');
    W.slider(ctl, { label: '\\(R\\)', min: 100, max: 100000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 1e-9, max: 1e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    const ctl2 = W.controls('#f-bounce');
    W.button(ctl2, '🔄 New press', () => { seed++; upd(); });
    const rt = W.readout(ctl2, { label: '\\(\\tau = RC\\)' });
    const rd = W.readout(ctl2, { label: 'Schmitt delay' });
    sch.parts.pb.it.onToggle = (down) => { if (down) { seed++; upd(); } };
    function upd() {
      simulate();
      sch.set('r', { label: 'R ' + W.si(R, 'Ω', 2) }); sch.set('c', { label: 'C ' + W.si(C, 'F', 2) });
      rt.set(fmtT(R * C));
      rd.set(isFinite(data.delay) ? fmtT(data.delay) : 'never'); rd.setClass(data.ns === 1 && data.delay < 0.02 ? 'good' : 'bad');
      pa.update(); pd.update();
      if (data.ns === 1 && data.delay < 0.02) Book.solve('bounce-task');
    }
    upd();
  })();

  /* ---------------- Figure 3.5: power-on reset ---------------- */
  (function () {
    const VDD = 3.3;
    let R = 10000, C = 1e-6, tr = 2e-3, res = null;
    const sch = W.schematic('#f-por', {
      w: 400, h: 190, title: 'RC delay on an enable pin',
      items: [
        { t: 'vcc', at: [80, 40], label: 'VDD' },
        { t: 'R', id: 'r', a: [80, 40], b: [80, 110], label: 'R', side: -1 },
        { t: 'wire', pts: [[80, 40], [140, 40], [140, 55]] },
        { t: 'D', a: [140, 100], b: [140, 55], label: 'D', },
        { t: 'wire', pts: [[140, 100], [140, 120], [80, 120], [80, 110]] },
        { t: 'wire', pts: [[80, 120], [80, 130]] }, { t: 'dot', at: [80, 120] },
        { t: 'C', id: 'c', a: [80, 130], b: [80, 165], label: 'C', side: -1 },
        { t: 'gnd', at: [80, 165] },
        { t: 'wire', pts: [[140, 120], [262, 120]] }, { t: 'dot', at: [140, 120] },
        { t: 'ic', at: [320, 110], name: 'MCU', left: ['VDD', 'EN'] },
        { t: 'wire', pts: [[262, 100], [240, 100], [240, 40], [140, 40]] },
      ],
    });
    const p = W.plot('#f-por', { xmin: 0, xmax: 0.05, ymin: 0, ymax: 3.6, xlabel: 'time', ylabel: 'volts', hover: true, xunit: 's', yunit: 'V', height: 230 });
    function sim() {
      const tmax = Math.max(tr * 1.4, R * C * 3, 1e-3), N = 3000, h = tmax / N;
      const vdd = [], en = []; let v = 0, rel = null;
      for (let i = 0; i <= N; i++) {
        const t = i * h, Vs = Math.min(VDD, VDD * t / tr);
        vdd.push([t, Vs]); en.push([t, v]);
        if (rel == null && Vs > 1.0 && v >= 0.75 * Vs) rel = [t, Vs];
        const sub = 20; for (let k = 0; k < sub; k++) { const tt = t + k * h / sub, Vss = Math.min(VDD, VDD * tt / tr); v += (h / sub) * (Vss - v) / (R * C); }
      }
      res = { tmax, vdd, en, rel };
    }
    p.draw((p) => {
      if (!res) return;
      p.line(res.vdd.map(([t, v]) => [t, 0.75 * v]), { color: 'muted', dash: [5, 4], width: 1.3, label: '75 % of VDD' });
      p.line(res.vdd, { color: 'c2', label: 'VDD' });
      p.line(res.en, { color: 'c1', label: 'EN pin' });
      if (res.rel) { p.vline(res.rel[0], { color: res.rel[1] < 3.0 ? 'c4' : 'c3' }); p.point(res.rel[0], res.rel[1] * 0.75, { color: res.rel[1] < 3.0 ? 'c4' : 'c3', label: 'leaves reset' }); }
    });
    const ctl = W.controls('#f-por');
    W.slider(ctl, { label: '\\(R\\)', min: 1000, max: 100000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 10e-9, max: 10e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    W.slider(ctl, { label: 'supply rise time', min: 0.1e-3, max: 100e-3, log: true, value: tr, unit: 's', onInput: (v) => { tr = v; upd(); } });
    const ctl2 = W.controls('#f-por');
    const rrel = W.readout(ctl2, { label: 'leaves reset at' });
    const rv = W.readout(ctl2, { label: 'VDD at that moment' });
    function upd() {
      sim();
      p.set({ xmax: res.tmax });
      sch.set('r', { label: 'R ' + W.si(R, 'Ω', 2) }); sch.set('c', { label: 'C ' + W.si(C, 'F', 2) });
      if (res.rel) { rrel.set(fmtT(res.rel[0])); rv.set(W.fix(res.rel[1], 2) + ' V' + (res.rel[1] < 3.0 ? ' (too early!)' : ' ✓')); rv.setClass(res.rel[1] < 3.0 ? 'bad' : 'good'); }
      else { rrel.set('—'); rv.set('—'); }
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 3.6: sinusoids & RMS ---------------- */
  (function () {
    let A = 3, f = 100, ph = 45, sq = false;
    const p = W.plot('#f-sine', { xmin: 0, xmax: 0.02, ymin: -5.5, ymax: 5.5, xlabel: 'time', ylabel: 'volts', hover: true, xunit: 's', yunit: 'V', height: 270 });
    p.draw((p) => {
      const w = TAU * f;
      if (sq) {
        p.area((t) => Math.pow(Math.sin(w * t), 2) * A, 0, 2 / f, { color: 'c1', alpha: 0.15 });
        p.hline(A / 2, { color: 'c1', width: 1.2 });
        p.text(2 / f * 0.01, A / 2 + 0.3, 'mean of v² (scaled)', { color: 'c1', size: 11 });
      }
      p.hline(A / Math.SQRT2, { color: 'c3', dash: [6, 4] }); p.hline(-A / Math.SQRT2, { color: 'c3', dash: [6, 4] });
      p.text(2 / f * 0.99, A / Math.SQRT2 + 0.3, 'Vrms', { color: 'c3', align: 'right', size: 11 });
      p.fn((t) => A * Math.sin(w * t), { color: 'c1', label: 'v₁ = A sin ωt', width: 2.5 });
      p.fn((t) => A * Math.sin(w * t + ph * Math.PI / 180), { color: 'c2', label: 'v₂ = A sin(ωt + φ)', width: 2.5 });
    });
    const ctl = W.controls('#f-sine');
    W.slider(ctl, { label: 'amplitude \\(A\\)', min: 0.5, max: 5, step: 0.1, value: A, unit: 'V', onInput: (v) => { A = v; upd(); } });
    W.slider(ctl, { label: 'frequency \\(f\\)', min: 10, max: 10000, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    W.slider(ctl, { label: 'phase \\(\\varphi\\)', min: -180, max: 180, step: 1, value: ph, format: (v) => v.toFixed(0) + '°', onInput: (v) => { ph = v; upd(); } });
    W.toggle(ctl, { label: 'show v²', value: sq, onChange: (v) => { sq = v; upd(); } });
    const ctl2 = W.controls('#f-sine');
    const rT = W.readout(ctl2, { label: 'period' });
    const rw = W.readout(ctl2, { label: '\\(\\omega\\)' });
    const rr = W.readout(ctl2, { label: 'Vrms', unit: 'V' });
    const rpp = W.readout(ctl2, { label: 'Vpp', unit: 'V' });
    const rdt = W.readout(ctl2, { label: 'v₂ shift' });
    function upd() {
      p.set({ xmax: 2 / f });
      rT.set(fmtT(1 / f)); rw.set(W.si(TAU * f, 'rad/s')); rr.set(A / Math.SQRT2); rpp.set(2 * A);
      const dtv = ph / 360 / f;
      rdt.set((ph >= 0 ? 'leads by ' : 'lags by ') + fmtT(Math.abs(dtv)));
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 3.7: |Z| vs f ---------------- */
  (function () {
    let R = 1000, C = 100e-9, L = 1e-3;
    const p = W.plot('#f-zf', { xmin: 10, xmax: 1e8, ymin: 0.01, ymax: 1e7, logx: true, logy: true, xlabel: 'frequency (Hz)', ylabel: '|Z| (Ω)', hover: true, xunit: 'Hz', yunit: 'Ω', height: 300 });
    p.draw((p) => {
      p.fn(() => R, { color: 'c3', label: 'R', width: 2.5 });
      p.fn((f) => 1 / (TAU * f * C), { color: 'c1', label: '|Z_C| = 1/2πfC', width: 2.5 });
      p.fn((f) => TAU * f * L, { color: 'c4', label: '|Z_L| = 2πfL', width: 2.5 });
      const fRC = 1 / (TAU * R * C), fLC = 1 / (TAU * Math.sqrt(L * C));
      if (fRC > 10 && fRC < 1e8) p.point(fRC, R, { color: 'c1', label: 'RC corner ' + W.si(fRC, 'Hz') });
      if (fLC > 10 && fLC < 1e8) p.point(fLC, Math.sqrt(L / C), { color: 'c5', label: 'LC resonance ' + W.si(fLC, 'Hz'), align: 'right' });
    });
    const ctl = W.controls('#f-zf');
    W.slider(ctl, { label: '\\(R\\)', min: 1, max: 1e6, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; p.update(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 10e-12, max: 100e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; p.update(); } });
    W.slider(ctl, { label: '\\(L\\)', min: 100e-9, max: 1, log: true, value: L, unit: 'H', onInput: (v) => { L = v; p.update(); } });
  })();

  /* ---------------- Figure 3.8: phasors ---------------- */
  (function () {
    let comp = 'C', wrc = 1, th = 0;
    const hist = [];
    const cv = W.canvas('#f-phasor', { height: 260 });
    const ctl = W.controls('#f-phasor');
    W.segmented(ctl, { options: [['R', 'Resistor'], ['C', 'Capacitor'], ['L', 'Inductor'], ['RC', 'R + C in series']], value: comp, onChange: (v) => { comp = v; hist.length = 0; info(); } });
    const sl = W.slider(ctl, { label: '\\(\\omega RC\\) (series RC)', min: 0.1, max: 10, log: true, value: wrc, format: (v) => W.fix(v, 2), onInput: (v) => { wrc = v; hist.length = 0; info(); } });
    void sl;
    const ctl2 = W.controls('#f-phasor');
    const rph = W.readout(ctl2, { label: 'current relative to voltage' });
    const params = () => {
      if (comp === 'R') return [0, 0.8];
      if (comp === 'C') return [Math.PI / 2, 0.8];
      if (comp === 'L') return [-Math.PI / 2, 0.8];
      const phi = Math.atan(1 / wrc); return [phi, 0.8 * Math.cos(phi)];
    };
    const info = () => { const [phi] = params(); rph.set(Math.abs(phi) < 1e-6 ? 'in phase (0°)' : (phi > 0 ? 'leads by ' : 'lags by ') + Math.abs(deg(phi)).toFixed(1) + '°'); };
    const arrow = (ctx, x0, y0, x1, y1, col) => {
      const a = Math.atan2(y1 - y0, x1 - x0);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - 8 * Math.cos(a), y1 - 8 * Math.sin(a)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a) + 6 * Math.sin(a), y1 - 12 * Math.sin(a) - 6 * Math.cos(a)); ctx.lineTo(x1 - 12 * Math.cos(a) - 6 * Math.sin(a), y1 - 12 * Math.sin(a) + 6 * Math.cos(a)); ctx.closePath(); ctx.fill();
    };
    function draw() {
      const { ctx, w, h } = cv;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = W.col('surface'); ctx.fillRect(0, 0, w, h);
      const narrow = w < 520, r = Math.min(narrow ? w * 0.22 : h * 0.4, h * 0.4), cx = r + 16, cy = h / 2;
      const [phi, ia] = params();
      const cV = W.col('c1'), cI = W.col('c2'), mut = W.col('muted'), line = W.col('line');
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r - 6, cy); ctx.lineTo(cx + r + 6, cy); ctx.moveTo(cx, cy - r - 6); ctx.lineTo(cx, cy + r + 6); ctx.stroke();
      const vx = cx + r * Math.cos(th), vy = cy - r * Math.sin(th);
      const ix = cx + r * ia * Math.cos(th + phi), iy = cy - r * ia * Math.sin(th + phi);
      // traces area
      const x0 = cx + r + 30, x1 = w - 10, span = x1 - x0;
      ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = mut;
      ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(x0, vy); ctx.moveTo(ix, iy); ctx.lineTo(x0, iy); ctx.stroke(); ctx.setLineDash([]);
      const plot = (k, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((s, i) => { const x = x0 + (hist.length - 1 - i) / 300 * span; const y = s[k]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
      plot(0, cV); plot(1, cI);
      arrow(ctx, cx, cy, vx, vy, cV); arrow(ctx, cx, cy, ix, iy, cI);
      ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = cV; ctx.fillText('V', 8, 16); ctx.fillStyle = cI; ctx.fillText('I', 24, 16);
      ctx.fillStyle = mut; ctx.fillText('time →', x0 + 4, h - 8);
      hist.unshift([vy, iy]); if (hist.length > 301) hist.pop();
    }
    W.anim((dt) => { th = (th + dt * TAU * 0.35) % TAU; draw(); }, cv.canvas);
    info(); draw();
  })();

  /* ---------------- Figure 3.9: Bode plot ---------------- */
  (function () {
    let hp = false, R = 1000, C = 100e-9, fp = 1000;
    const fc = () => 1 / (TAU * R * C);
    const H = (f) => { const x = f / fc(); return hp ? [x / Math.sqrt(1 + x * x), 90 - deg(Math.atan(x))] : [1 / Math.sqrt(1 + x * x), -deg(Math.atan(x))]; };
    const db = (m) => 20 * Math.log10(m);
    const pm = W.plot('#f-bode', { xmin: 1, xmax: 1e6, logx: true, ymin: -60, ymax: 5, ylabel: 'gain (dB)', hover: true, xunit: 'Hz', height: 220, yfmt: (v) => v.toFixed(0) });
    const pp = W.plot('#f-bode', { xmin: 1, xmax: 1e6, logx: true, ymin: -95, ymax: 95, xlabel: 'frequency (Hz)', ylabel: 'phase (°)', hover: true, xunit: 'Hz', height: 190, yfmt: (v) => v.toFixed(0) });
    pm.draw((p) => {
      p.vline(fc(), { color: 'muted' });
      p.fn((f) => (hp ? Math.min(0, db(f / fc())) : Math.min(0, -db(f / fc()))), { color: 'muted', dash: [6, 4], width: 1.5, hover: false });
      p.hline(-3, { color: 'c3', width: 1, dash: [2, 3] });
      p.fn((f) => db(H(f)[0]), { color: 'c1', width: 3, hoverFmt: (x, y) => `${W.si(x, 'Hz')}: ${y.toFixed(1)} dB` });
      p.point(fp, db(H(fp)[0]), { color: 'c4' });
    });
    pp.draw((p) => {
      p.vline(fc(), { color: 'muted' });
      p.fn((f) => H(f)[1], { color: 'c2', width: 3, hoverFmt: (x, y) => `${W.si(x, 'Hz')}: ${y.toFixed(1)}°` });
      p.point(fp, H(fp)[1], { color: 'c4' });
    });
    const ctl = W.controls('#f-bode');
    W.segmented(ctl, { options: [['lp', 'Low-pass'], ['hp', 'High-pass']], value: 'lp', onChange: (v) => { hp = v === 'hp'; upd(); } });
    W.slider(ctl, { label: '\\(R\\)', min: 100, max: 1e6, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 100e-12, max: 100e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    W.slider(ctl, { label: 'probe \\(f\\)', min: 1, max: 1e6, log: true, value: fp, unit: 'Hz', onInput: (v) => { fp = v; upd(); } });
    const ctl2 = W.controls('#f-bode');
    const rfc = W.readout(ctl2, { label: '\\(f_c\\)', unit: 'Hz' });
    const rg = W.readout(ctl2, { label: 'gain at probe' });
    const rph = W.readout(ctl2, { label: 'phase at probe' });
    function upd() {
      const [m, ph] = H(fp);
      rfc.set(fc()); rg.set(`${db(m).toFixed(1)} dB (×${m < 0.01 ? m.toExponential(1) : m.toFixed(3)})`); rph.set(ph.toFixed(1) + '°');
      pm.update(); pp.update();
    }
    upd();
  })();

  /* ---------------- Figure 3.10: RC low-pass on a scope ---------------- */
  (function () {
    const R = 10000, C = 10e-9, fc = 1 / (TAU * R * C), Vp = 2;
    let f = 200, beam = 0;
    W.schematic('#f-scope-rc', {
      w: 420, h: 150, title: 'RC low-pass with scope channels',
      items: [
        { t: 'Vac', a: [60, 60], b: [60, 110], label: 'sine 2 V' },
        { t: 'wire', pts: [[60, 60], [60, 35], [140, 35]] },
        { t: 'R', a: [140, 35], b: [220, 35], label: '10 kΩ' },
        { t: 'wire', pts: [[220, 35], [300, 35], [300, 60]] },
        { t: 'C', a: [300, 60], b: [300, 110], label: '10 nF' },
        { t: 'wire', pts: [[300, 110], [300, 130], [60, 130], [60, 110]] },
        { t: 'gnd', at: [180, 130] },
        { t: 'dot', at: [100, 35] }, { t: 'dot', at: [260, 35] },
        { t: 'text', at: [100, 18], text: 'CH1 (in)' }, { t: 'text', at: [262, 18], text: 'CH2 (out)' },
      ],
    });
    const p = W.plot('#f-scope-rc', { xmin: 0, xmax: 2 / f, ymin: -2.5, ymax: 2.5, xlabel: 'time', ylabel: 'volts', scope: true, hover: true, xunit: 's', yunit: 'V', height: 250 });
    const mag = () => 1 / Math.sqrt(1 + (f / fc) ** 2), lag = () => Math.atan(f / fc);
    const yin = (t) => Vp * Math.sin(TAU * f * t), yout = (t) => Vp * mag() * Math.sin(TAU * f * t - lag());
    p.draw((p) => {
      p.fn(yin, { color: '#ffd43b', width: 2.5, label: 'CH1 input', hoverFmt: (x, y) => `in ${y.toFixed(2)} V` });
      p.fn(yout, { color: '#3bc9db', width: 2.5, label: 'CH2 output', hoverFmt: (x, y) => `out ${y.toFixed(2)} V` });
      const tb = beam * 2 / f;
      p.point(tb, yin(tb), { color: '#fff3bf', r: 4 }); p.point(tb, yout(tb), { color: '#c5f6fa', r: 4 });
    });
    const ctl = W.controls('#f-scope-rc');
    W.slider(ctl, { label: 'frequency', min: 10, max: 100000, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    const ctl2 = W.controls('#f-scope-rc');
    const ra = W.readout(ctl2, { label: 'out/in' });
    const rdb = W.readout(ctl2, { label: 'gain' });
    const rl = W.readout(ctl2, { label: 'phase lag' });
    const rd = W.readout(ctl2, { label: 'time delay' });
    function upd() {
      p.set({ xmax: 2 / f });
      const m = mag();
      ra.set((100 * m).toFixed(1) + ' %'); ra.setClass(Math.abs(f - fc) / fc <= 0.05 ? 'good' : '');
      rdb.set((20 * Math.log10(m)).toFixed(1) + ' dB'); rl.set(deg(lag()).toFixed(1) + '°'); rd.set(fmtT(lag() / (TAU * f)));
      p.update();
      if (Math.abs(f - fc) / fc <= 0.05) Book.solve('bode-task');
    }
    W.anim((dt) => { beam = (beam + dt / 2) % 1; p.update(); }, p.canvas);
    upd();
  })();

  /* ---------------- Figure 3.11: PWM → analog ---------------- */
  (function () {
    const V = 5;
    let D = 0.5, f = 490, R = 10000, C = 1e-6, S = null;
    const pT = W.plot('#f-pwm', { xmin: 0, xmax: 0.06, ymin: -0.2, ymax: 5.4, ylabel: 'volts', hover: true, xunit: 's', yunit: 'V', height: 220 });
    const pZ = W.plot('#f-pwm', { xmin: 0, xmax: 3 / f, ymin: 2, ymax: 3, xlabel: 'time (last 3 PWM periods)', ylabel: 'ripple', hover: true, xunit: 's', yunit: 'V', height: 180 });
    function sim() {
      const T = 1 / f, tau = R * C, tH = D * T, tL = T - tH;
      const tw = Math.max(6 * tau, 10 * T), nP = Math.ceil(tw / T);
      const starts = new Float64Array(nP + 1); let v = 0;
      const a = Math.exp(-tH / tau), b = Math.exp(-tL / tau);
      for (let k = 0; k <= nP; k++) { starts[k] = v; const vh = V + (v - V) * a; v = vh * b; }
      const at = (t) => { const k = Math.min(nP, Math.floor(t / T)), s = t - k * T, v0 = starts[k]; if (s < tH) return V + (v0 - V) * Math.exp(-s / tau); const vh = V + (v0 - V) * a; return vh * Math.exp(-(s - tH) / tau); };
      const vmax = D > 0 && D < 1 ? V * (1 - a) / (1 - a * b) : D >= 1 ? V : 0, vmin = vmax * b;
      S = { T, tau, tH, tw, nP, at, vmax, vmin, ripple: vmax - vmin, approx: V * D * (1 - D) / (f * tau) };
    }
    pT.draw((p) => {
      if (!S) return;
      const px = p.pw / S.nP;
      if (px > 3) {
        const pts = []; for (let k = 0; k < S.nP; k++) { const t0 = k * S.T; pts.push([t0, 0], [t0, V], [t0 + S.tH, V], [t0 + S.tH, 0]); }
        p.line(pts, { color: 'c4', width: 1, label: 'PWM' });
      } else p.area(() => V, 0, S.tw, { color: 'c4', alpha: 0.08 });
      p.hline(D * V, { color: 'c3', width: 1.2 });
      p.fn(S.at, { color: 'c1', width: 2.5, label: 'filter output', samples: 2500 });
    });
    pZ.draw((p) => {
      if (!S) return;
      const off = (S.nP - 3) * S.T;
      p.hline(S.vmax, { color: 'muted', width: 1 }); p.hline(S.vmin, { color: 'muted', width: 1 });
      p.fn((t) => S.at(off + t), { color: 'c1', width: 2.5, samples: 1500, hoverFmt: (x, y) => `${y.toFixed(4)} V` });
    });
    const ctl = W.controls('#f-pwm');
    W.slider(ctl, { label: 'duty \\(D\\)', min: 0, max: 1, step: 0.01, value: D, format: (v) => (100 * v).toFixed(0) + ' %', onInput: (v) => { D = v; upd(); } });
    W.slider(ctl, { label: '\\(f_{PWM}\\)', min: 100, max: 50000, log: true, value: f, unit: 'Hz', onInput: (v) => { f = v; upd(); } });
    W.slider(ctl, { label: '\\(R\\)', min: 100, max: 100000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 10e-9, max: 100e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    const ctl2 = W.controls('#f-pwm');
    const ravg = W.readout(ctl2, { label: 'average', unit: 'V' });
    const rr = W.readout(ctl2, { label: 'ripple (sim)' });
    const ra = W.readout(ctl2, { label: 'formula' });
    const rs = W.readout(ctl2, { label: '1 % settling' });
    const rfc = W.readout(ctl2, { label: '\\(f_c\\)', unit: 'Hz' });
    function upd() {
      sim();
      pT.set({ xmax: S.tw });
      const mid = (S.vmax + S.vmin) / 2, half = Math.max(S.ripple * 0.75, 0.002);
      pZ.set({ xmax: 3 * S.T, ymin: mid - half, ymax: mid + half });
      ravg.set(D * V);
      rr.set(W.si(S.ripple, 'V') + ' p-p'); rr.setClass(S.ripple <= 0.05 ? 'good' : '');
      ra.set(W.si(S.approx, 'V'));
      const ts = Math.log(100) * S.tau; rs.set(fmtT(ts)); rs.setClass(ts <= 0.05 ? 'good' : '');
      rfc.set(1 / (TAU * S.tau));
      pT.update(); pZ.update();
      if (D >= 0.45 && D <= 0.55 && S.ripple <= 0.05 && ts <= 0.05) Book.solve('pwm-task');
    }
    upd();
  })();

  /* ---------------- Figure 3.12: decoupling ---------------- */
  (function () {
    const Vreg = 3.3, Rt = 0.5, Cdie = 1e-9, Cd = 100e-9, ESR = 0.02, ESL0 = 0.7e-9, dt = 0.02e-9, tEnd = 300e-9;
    let Lt = 30e-9, dist = 2, capOn = false, A = null, B = null;
    const iload = (t) => {
      if (t < 20e-9) return 0;
      const s = (t - 20e-9) % 50e-9;
      return s < 5e-9 ? 0.1 * s / 5e-9 : s < 10e-9 ? 0.1 * (10e-9 - s) / 5e-9 : 0;
    };
    function sim(cap) {
      const Lc = ESL0 + dist * 1e-9, N = Math.round(tEnd / dt), out = []; let it = 0, v = Vreg, ic = 0, vc = Vreg;
      for (let i = 0; i <= N; i++) {
        const t = i * dt;
        if (i % 10 === 0) out.push([t, v]);
        it += dt / Lt * (Vreg - Rt * it - v);
        if (cap) ic += dt / Lc * (v - vc - ESR * ic);
        v += dt / Cdie * (it - (cap ? ic : 0) - iload(t));
        if (cap) vc += dt / Cd * ic;
      }
      return out;
    }
    const sch = W.schematic('#f-decouple', {
      w: 470, h: 190, title: 'Regulator, inductive trace, decoupling capacitor and chip',
      items: [
        { t: 'Vdc', a: [50, 75], b: [50, 135], label: '3.3 V reg' },
        { t: 'wire', pts: [[50, 75], [50, 45], [80, 45]] },
        { t: 'R', a: [80, 45], b: [140, 45], label: '0.5 Ω' },
        { t: 'L', id: 'lt', a: [150, 45], b: [230, 45], label: 'trace L' },
        { t: 'wire', pts: [[140, 45], [150, 45]] },
        { t: 'wire', pts: [[230, 45], [362, 45], [362, 72]] },
        { t: 'wire', id: 'cw1', pts: [[300, 45], [300, 80]] }, { t: 'dot', id: 'cd', at: [300, 45] },
        { t: 'C', id: 'c', a: [300, 80], b: [300, 130], label: '100 nF', side: -1 },
        { t: 'wire', id: 'cw2', pts: [[300, 130], [300, 160]] },
        { t: 'ic', at: [380, 105], name: 'chip', top: ['VDD'], bottom: ['GND'], w: 70, h: 30 },
        { t: 'wire', pts: [[50, 135], [50, 160], [380, 160], [380, 138]] },
        { t: 'gnd', at: [180, 160] },
        { t: 'text', at: [380, 180], text: '100 mA spikes', cls: '' },
      ],
    });
    const pv = W.plot('#f-decouple', { xmin: 0, xmax: tEnd * 1e9, ymin: 2.6, ymax: 3.8, ylabel: 'VDD at chip (V)', hover: true, xunit: ' ns', yunit: 'V', height: 230, xfmt: (v) => v.toFixed(0) });
    const pl = W.plot('#f-decouple', { xmin: 0, xmax: tEnd * 1e9, ymin: 0, ymax: 0.12, xlabel: 'time (ns)', ylabel: 'chip current (A)', height: 130, xfmt: (v) => v.toFixed(0), yfmt: (v) => W.tick(v) });
    pv.draw((p) => {
      if (!A) return;
      p.area(() => Vreg * 1.05, 0, tEnd * 1e9, { color: 'c3', alpha: 0.1 }, () => Vreg * 0.95);
      const other = capOn ? B : A, cur = capOn ? A : B;
      p.line(other.map(([t, v]) => [t * 1e9, v]), { color: 'muted', width: 1.2, label: capOn ? 'without cap' : 'with 100 nF' });
      p.line(cur.map(([t, v]) => [t * 1e9, v]), { color: capOn ? 'c1' : 'c4', width: 2.2, label: capOn ? 'with 100 nF' : 'no decoupling' });
    });
    pl.draw((p) => p.fn((t) => iload(t * 1e-9), { color: 'c2', samples: 1500 }));
    const ctl = W.controls('#f-decouple');
    W.toggle(ctl, { label: '100 nF decoupling cap', value: capOn, onChange: (v) => { capOn = v; upd(); } });
    W.slider(ctl, { label: 'trace \\(L\\)', min: 5e-9, max: 100e-9, log: true, value: Lt, unit: 'H', onInput: (v) => { Lt = v; upd(); } });
    W.slider(ctl, { label: 'cap distance', min: 0, max: 30, step: 1, value: dist, format: (v) => v + ' mm', onInput: (v) => { dist = v; upd(); } });
    const ctl2 = W.controls('#f-decouple');
    const rmin = W.readout(ctl2, { label: 'lowest VDD', unit: 'V' });
    const rpp = W.readout(ctl2, { label: 'noise p-p', unit: 'V' });
    function upd() {
      const withC = sim(true), noC = sim(false);
      A = capOn ? withC : noC; B = capOn ? noC : withC;
      const vs = A.filter(([t]) => t > 15e-9).map(([, v]) => v), mn = Math.min(...vs), mx = Math.max(...vs);
      const all = withC.concat(noC).map(([, v]) => v);
      pv.set({ ymin: Math.min(Vreg * 0.93, Math.min(...all) - 0.05), ymax: Math.max(Vreg * 1.07, Math.max(...all) + 0.05) });
      rmin.set(mn); rmin.setClass(mn < Vreg * 0.95 ? 'bad' : 'good'); rpp.set(mx - mn);
      for (const id of ['c', 'cw1', 'cw2', 'cd']) showPart(sch, id, capOn);
      sch.set('lt', { label: 'trace ' + W.si(Lt, 'H', 2) });
      sch.set('c', { label: '100 nF +' + dist + ' mm' });
      pv.update(); pl.update();
    }
    upd();
  })();

  /* ---------------- Figure 3.13: real capacitor impedance ---------------- */
  (function () {
    const PRE = {
      c0402: ['100 nF X7R 0402', 100e-9, 0.02, 0.4e-9],
      c0603: ['100 nF X7R 0603', 100e-9, 0.02, 0.7e-9],
      c10u: ['10 µF X5R 0805', 10e-6, 0.005, 1.0e-9],
      alu: ['100 µF aluminium electrolytic', 100e-6, 0.5, 15e-9],
      tant: ['100 µF tantalum (MnO₂)', 100e-6, 0.3, 3e-9],
    };
    let key = 'c0603', [, C, ESR, ESL] = PRE[key], bulk = false;
    const cz = (re, im) => [re, im];
    const zcap = (f, c, r, l) => { const w = TAU * f; return cz(r, w * l - 1 / (w * c)); };
    const cpar = (a, b) => { const nr = a[0] * b[0] - a[1] * b[1], ni = a[0] * b[1] + a[1] * b[0], dr = a[0] + b[0], di = a[1] + b[1], d = dr * dr + di * di; return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d]; };
    const mag = (z) => Math.hypot(z[0], z[1]);
    const zt = (f) => { const z = zcap(f, C, ESR, ESL); return bulk ? cpar(z, zcap(f, 10e-6, 0.005, 1e-9)) : z; };
    const p = W.plot('#f-realcap', { xmin: 1e3, xmax: 1e9, ymin: 1e-3, ymax: 1e3, logx: true, logy: true, xlabel: 'frequency (Hz)', ylabel: '|Z| (Ω)', hover: true, xunit: 'Hz', yunit: 'Ω', height: 290 });
    p.draw((p) => {
      p.fn((f) => 1 / (TAU * f * C), { color: 'muted', dash: [6, 4], label: 'ideal C', hover: false, width: 1.6 });
      p.fn((f) => mag(zt(f)), { color: 'c1', width: 3, label: bulk ? 'real C ∥ 10 µF' : 'real C (ESR + ESL)' });
      const srf = 1 / (TAU * Math.sqrt(ESL * C));
      if (srf > 1e3 && srf < 1e9) p.point(srf, ESR, { color: 'c4', label: 'SRF ' + W.si(srf, 'Hz') });
    });
    const ctl = W.controls('#f-realcap');
    W.select(ctl, { label: 'Type', options: Object.keys(PRE).map((k) => [k, PRE[k][0]]), value: key, onChange: (v) => { key = v; [, C, ESR, ESL] = PRE[v]; sC.set(C, false); sR.set(ESR, false); sL.set(ESL, false); upd(); } });
    W.toggle(ctl, { label: 'add 10 µF in parallel', value: bulk, onChange: (v) => { bulk = v; upd(); } });
    const sC = W.slider(ctl, { label: '\\(C\\)', min: 1e-9, max: 1e-3, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    const sR = W.slider(ctl, { label: 'ESR', min: 1e-3, max: 3, log: true, value: ESR, unit: 'Ω', onInput: (v) => { ESR = v; upd(); } });
    const sL = W.slider(ctl, { label: 'ESL', min: 0.1e-9, max: 30e-9, log: true, value: ESL, unit: 'H', onInput: (v) => { ESL = v; upd(); } });
    const ctl2 = W.controls('#f-realcap');
    const rs = W.readout(ctl2, { label: 'self-resonance', unit: 'Hz' });
    const r1 = W.readout(ctl2, { label: '|Z| at 1 MHz', unit: 'Ω' });
    const r2 = W.readout(ctl2, { label: '|Z| at 100 MHz', unit: 'Ω' });
    function upd() { rs.set(1 / (TAU * Math.sqrt(ESL * C))); r1.set(mag(zt(1e6))); r2.set(mag(zt(1e8))); p.update(); }
    upd();
  })();

  /* ---------------- Figure 3.14: MLCC DC bias ---------------- */
  (function () {
    const CURVES = [
      ['10 µF 6.3 V X5R 0603', 'c4', 6.3, 3, 1.6],
      ['10 µF 10 V X5R 0805', 'c2', 10, 5, 1.5],
      ['10 µF 25 V X7R 1206', 'c1', 25, 12, 1.6],
      ['C0G/NP0 (class 1, for comparison)', 'c3', 25, Infinity, 1],
    ];
    let Vb = 5;
    const frac = (c, v) => (isFinite(c[3]) ? 1 / (1 + Math.pow(v / c[3], c[4])) : 1);
    const p = W.plot('#f-bias', { xmin: 0, xmax: 25, ymin: 0, ymax: 110, xlabel: 'DC bias (V)', ylabel: 'capacitance (% of nominal)', hover: true, xunit: 'V', height: 250, yfmt: (v) => v.toFixed(0) });
    p.draw((p) => {
      p.vline(Vb, { color: 'muted' });
      for (const c of CURVES) p.fn((v) => (v <= c[2] ? 100 * frac(c, v) : NaN), { color: c[1], label: c[0], width: 2.5, hoverFmt: (x, y) => `${x.toFixed(1)} V: ${y.toFixed(0)} %` });
    });
    const ctl = W.controls('#f-bias');
    W.slider(ctl, { label: 'DC bias', min: 0, max: 25, step: 0.1, value: Vb, unit: 'V', onInput: (v) => { Vb = v; upd(); } });
    const ctl2 = W.controls('#f-bias');
    const ro = CURVES.slice(0, 3).map((c) => W.readout(ctl2, { label: c[0].replace('10 µF ', '') }));
    function upd() {
      CURVES.slice(0, 3).forEach((c, i) => { if (Vb > c[2]) { ro[i].set('over rating!'); ro[i].setClass('bad'); } else { ro[i].set(W.si(10e-6 * frac(c, Vb), 'F', 2)); ro[i].setClass(frac(c, Vb) < 0.5 ? 'bad' : ''); } });
      p.update();
    }
    upd();
  })();

  /* ---------------- Figure 3.15: RLC ringing ---------------- */
  (function () {
    let L = 10e-6, C = 1e-6, R = 0.5;
    const resp = () => {
      const a = R / (2 * L), w0 = 1 / Math.sqrt(L * C), z = a / w0;
      if (z < 0.999) { const wd = w0 * Math.sqrt(1 - z * z); return { z, a, w0, f: (t) => 1 - Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t)), tmax: Math.min(Math.log(50) / a, 15 * TAU / w0) }; }
      if (z <= 1.001) return { z, a, w0, f: (t) => 1 - Math.exp(-a * t) * (1 + a * t), tmax: 8 / a };
      const s = Math.sqrt(a * a - w0 * w0), s1 = -a + s, s2 = -a - s;
      return { z, a, w0, f: (t) => 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1), tmax: 6 / -s1 };
    };
    let rs = resp();
    const p = W.plot('#f-ring', { xmin: 0, xmax: rs.tmax, ymin: 0, ymax: 2, xlabel: 'time', ylabel: 'vC for a 1 V step', hover: true, xunit: 's', yunit: 'V', height: 260 });
    p.draw((p) => {
      p.hline(1, { color: 'muted' });
      if (rs.z < 0.999) { p.fn((t) => 1 + Math.exp(-rs.a * t), { color: 'c5', dash: [5, 4], width: 1.3, hover: false }); p.fn((t) => 1 - Math.exp(-rs.a * t), { color: 'c5', dash: [5, 4], width: 1.3, hover: false }); }
      p.fn(rs.f, { color: 'c1', width: 2.6, samples: 2000 });
    });
    const ctl = W.controls('#f-ring');
    W.slider(ctl, { label: '\\(L\\)', min: 100e-9, max: 10e-3, log: true, value: L, unit: 'H', onInput: (v) => { L = v; upd(); } });
    W.slider(ctl, { label: '\\(C\\)', min: 10e-9, max: 100e-6, log: true, value: C, unit: 'F', onInput: (v) => { C = v; upd(); } });
    W.slider(ctl, { label: '\\(R\\)', min: 0.01, max: 1000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; upd(); } });
    const ctl2 = W.controls('#f-ring');
    const rf = W.readout(ctl2, { label: '\\(f_0\\)', unit: 'Hz' });
    const rz0 = W.readout(ctl2, { label: '\\(Z_0\\)', unit: 'Ω' });
    const rq = W.readout(ctl2, { label: '\\(Q\\)' });
    const rzeta = W.readout(ctl2, { label: '\\(\\zeta\\)' });
    const ro = W.readout(ctl2, { label: 'overshoot' });
    function upd() {
      rs = resp();
      const Z0 = Math.sqrt(L / C), zeta = R / (2 * Z0);
      rf.set(rs.w0 / TAU); rz0.set(Z0); rq.set(W.fix(Z0 / R, 2)); rzeta.set(W.fix(zeta, 3) + (zeta < 0.95 ? ' under' : zeta <= 1.05 ? ' critical' : ' over'));
      rzeta.setClass(zeta >= 0.95 && zeta <= 1.05 ? 'good' : '');
      ro.set(zeta < 1 ? (100 * Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta * zeta))).toFixed(1) + ' %' : '0 %');
      p.set({ xmax: rs.tmax }); p.update();
      if (zeta >= 0.95 && zeta <= 1.05) Book.solve('ring-task');
    }
    upd();
  })();

  /* ---------------- Figure 3.16: oscilloscope simulator ---------------- */
  (function () {
    const SIG = {
      sine: { name: '1 kHz sine, 2 Vpp (function generator)', P: 1e-3, mean: 0 },
      pwm: { name: 'Arduino PWM, 490 Hz, 25 % duty', P: 1 / 490.2, mean: 1.25 },
      rail: { name: '3.3 V rail from a buck converter', P: 2e-6, mean: 3.3 },
      edge: { name: 'Fast edge: 1 MHz clock, 0–3.3 V', P: 1e-6, mean: 1.65 },
    };
    const seq = (lo, hi) => { const out = []; for (let d = lo; d <= hi * 1.001; d *= 10) for (const m of [1, 2, 5]) { const v = +(d * m).toPrecision(3); if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); } return out; };
    const VD = seq(5e-3, 5), TD = seq(2e-9, 10e-3);
    let sig = 'sine', vdiv = 1, tdiv = 200e-6, pos = 0, lvl = 3, mode = 'auto', coup = 'dc', probe = 10, chan = 10, lead = 'long';
    let last = null, status = '', frame = 0, nz = rng(99);
    const ring = (s, A, fr, tr) => (s >= 0 ? A * Math.exp(-s / tr) * Math.sin(TAU * fr * s) : 0);
    const v = (t) => {
      const S = SIG[sig], p = ((t % S.P) + S.P) % S.P;
      if (sig === 'sine') return Math.sin(TAU * t / S.P);
      if (sig === 'pwm') return p < 0.25 * S.P ? 5 : 0;
      if (sig === 'rail') {
        const q = p / S.P, tri = q < 0.5 ? -1 + 4 * q : 3 - 4 * q;
        return 3.3 + 0.01 * tri + ring(p, 0.03, 60e6, 15e-9) + ring(p - S.P / 2, -0.02, 60e6, 15e-9);
      }
      const trr = 2e-9, h = S.P / 2;
      const A = lead === 'long' ? 0.8 : 0.07, fr = lead === 'long' ? 130e6 : 450e6, tr = lead === 'long' ? 8e-9 : 2e-9;
      let base;
      if (p < trr) base = 3.3 * p / trr; else if (p < h) base = 3.3; else if (p < h + trr) base = 3.3 * (1 - (p - h) / trr); else base = 0;
      return base + ring(p - trr, A, fr, tr) - ring(p - h - trr, A, fr, tr);
    };
    const disp = (t) => (v(t) - (coup === 'ac' ? SIG[sig].mean : 0)) * chan / probe;
    const cv = W.canvas('#f-scope', { aspect: 1.6, onResize: () => { if (last) draw(); } });
    function capture() {
      const S = SIG[sig], span = 10 * tdiv;
      let t0 = null;
      const start = nz() * S.P * 4;
      if (mode !== 'auto' || true) {
        const step = Math.min(S.P / 4000, tdiv / 40), lim = start + 2.2 * S.P;
        let prev = disp(start);
        for (let t = start + step; t < lim; t += step) { const cur = disp(t); if (prev < lvl && cur >= lvl) { t0 = t; break; } prev = cur; }
      }
      let ts;
      if (t0 != null) { ts = t0 - span / 2; status = "Trig'd"; }
      else if (mode === 'auto') { ts = start + nz() * span; status = 'Auto (no trigger)'; }
      else { status = 'Wait (no trigger)'; return; }
      const N = Math.max(600, Math.round(cv.w * 1.5)), pts = new Float32Array(N + 1);
      const noise = 0.025 * vdiv;
      for (let i = 0; i <= N; i++) pts[i] = disp(ts + span * i / N) + (nz() - 0.5) * noise;
      last = { pts, trig: t0 != null };
    }
    function draw() {
      const { ctx, w, h } = cv;
      const bg = W.cssVar('--scope-bg'), grid = W.cssVar('--scope-grid'), ink = W.cssVar('--scope-ink');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const padT = 22, padB = 22, gw = w - 16, gh = h - padT - padB, x0 = 8, y0 = padT;
      const X = (d) => x0 + gw * d / 10, Y = (d) => y0 + gh * (4 - d) / 8;
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(X(i) + 0.5, y0); ctx.lineTo(X(i) + 0.5, y0 + gh); ctx.stroke(); }
      for (let j = -4; j <= 4; j++) { ctx.beginPath(); ctx.moveTo(x0, Y(j) + 0.5); ctx.lineTo(x0 + gw, Y(j) + 0.5); ctx.stroke(); }
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.35;
      for (let i = 0; i <= 50; i++) { const x = X(i / 5); ctx.beginPath(); ctx.moveTo(x, Y(0) - 3); ctx.lineTo(x, Y(0) + 3); ctx.stroke(); }
      for (let j = 0; j <= 40; j++) { const y = Y(-4 + j / 5); ctx.beginPath(); ctx.moveTo(X(5) - 3, y); ctx.lineTo(X(5) + 3, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (last) {
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, gw, gh); ctx.clip();
        ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 1.8; ctx.shadowColor = '#ffd43b'; ctx.shadowBlur = 4;
        ctx.beginPath();
        const N = last.pts.length - 1;
        for (let i = 0; i <= N; i++) { const x = X(10 * i / N), y = Y(last.pts[i] / vdiv + pos); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke(); ctx.restore();
      }
      // trigger level marker and position marker
      const ly = W.clamp(Y(lvl / vdiv + pos), y0, y0 + gh);
      ctx.fillStyle = '#ff922b'; ctx.beginPath(); ctx.moveTo(x0 + gw, ly); ctx.lineTo(x0 + gw - 9, ly - 5); ctx.lineTo(x0 + gw - 9, ly + 5); ctx.closePath(); ctx.fill();
      const py = W.clamp(Y(pos), y0, y0 + gh);
      ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + 9, py - 5); ctx.lineTo(x0 + 9, py + 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff922b'; ctx.beginPath(); ctx.moveTo(X(5), y0); ctx.lineTo(X(5) - 5, y0 - 8); ctx.lineTo(X(5) + 5, y0 - 8); ctx.closePath(); ctx.fill();
      ctx.font = '12px ui-monospace, monospace'; ctx.fillStyle = ink; ctx.textBaseline = 'middle';
      ctx.fillText(`CH1 ${W.si(vdiv, 'V', 3)}/div ${coup.toUpperCase()} ×${chan}`, x0 + 2, 10);
      ctx.textAlign = 'right'; ctx.fillStyle = status.startsWith('Trig') ? '#8ce99a' : '#ffa8a8';
      ctx.fillText(status, w - 6, 10);
      ctx.textAlign = 'left'; ctx.fillStyle = ink;
      ctx.fillText(`${W.si(tdiv, 's', 3)}/div   trig ↑ ${W.si(lvl, 'V', 3)}`, x0 + 2, h - 10);
      ctx.textAlign = 'start';
    }
    const ctl = W.controls('#f-scope');
    W.select(ctl, { label: 'Signal', options: Object.keys(SIG).map((k) => [k, SIG[k].name]), value: sig, onChange: (x) => { sig = x; last = null; } });
    W.select(ctl, { label: 'V/div', options: VD.map((x) => [x, W.si(x, 'V', 3)]), value: vdiv, onChange: (x) => { vdiv = +x; } });
    W.select(ctl, { label: 'Time/div', options: TD.map((x) => [x, W.si(x, 's', 3)]), value: tdiv, onChange: (x) => { tdiv = +x; } });
    const ctl2 = W.controls('#f-scope');
    W.slider(ctl2, { label: 'position', min: -4, max: 4, step: 0.1, value: pos, format: (x) => x.toFixed(1) + ' div', onInput: (x) => { pos = x; } });
    W.slider(ctl2, { label: 'trigger level', min: -6, max: 6, step: 0.01, value: lvl, unit: 'V', format: (x) => x.toFixed(2) + ' V', onInput: (x) => { lvl = x; } });
    const ctl3 = W.controls('#f-scope');
    W.segmented(ctl3, { options: [['auto', 'Auto'], ['normal', 'Normal']], value: mode, onChange: (x) => { mode = x; } });
    W.segmented(ctl3, { options: [['dc', 'DC'], ['ac', 'AC']], value: coup, onChange: (x) => { coup = x; } });
    W.select(ctl3, { label: 'Probe', options: [[1, '×1'], [10, '×10']], value: probe, onChange: (x) => { probe = +x; } });
    W.select(ctl3, { label: 'Channel', options: [[1, '×1'], [10, '×10']], value: chan, onChange: (x) => { chan = +x; } });
    W.segmented(ctl3, { options: [['long', '15 cm ground clip'], ['spring', 'spring tip']], value: lead, onChange: (x) => { lead = x; } });
    const ctl4 = W.controls('#f-scope');
    const rvpp = W.readout(ctl4, { label: 'Vpp' });
    const rmean = W.readout(ctl4, { label: 'mean' });
    const rfreq = W.readout(ctl4, { label: 'freq' });
    let acc = 0;
    W.anim((dt) => {
      acc += dt; if (acc < 0.07) return; acc = 0; frame++;
      capture(); draw();
      if (!last) { rvpp.set('—'); rmean.set('—'); rfreq.set('—'); return; }
      let mn = Infinity, mx = -Infinity, s = 0; for (const x of last.pts) { mn = Math.min(mn, x); mx = Math.max(mx, x); s += x; }
      rvpp.set(W.si(mx - mn, 'V', 3)); rmean.set(W.si(s / last.pts.length, 'V', 3));
      const per = 10 * tdiv / SIG[sig].P;
      rfreq.set(per >= 1.2 && last.trig ? W.si(1 / SIG[sig].P, 'Hz', 4) : '—');
      const top = mx / vdiv + pos, bot = mn / vdiv + pos;
      if (sig === 'pwm' && mode === 'normal' && last.trig && status.startsWith('Trig') && probe === chan && per >= 2 && per <= 4 && top <= 4 && bot >= -4 && (mx - mn) / vdiv >= 4) Book.solve('scope-task');
    }, cv.canvas);
    capture(); draw();
  })();
})();
