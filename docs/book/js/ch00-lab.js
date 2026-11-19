/* Chapter 0 widgets */
(function () {
  // ---- Figure 0.1: live LED circuit ----
  const sch = W.schematic('#led-sch', {
    w: 420, h: 220, title: 'Battery, switch, resistor and LED in series',
    items: [
      { t: 'V', id: 'bat', a: [60, 80], b: [60, 150], label: '3.3 V' },
      { t: 'SW', id: 'sw', a: [100, 40], b: [170, 40], label: 'S1 (click me)', closed: false },
      { t: 'R', id: 'r', a: [210, 40], b: [320, 40], label: 'R = 150 Ω' },
      { t: 'LED', id: 'led', a: [360, 70], b: [360, 150], label: 'red LED', color: '#ff4d4d' },
      { t: 'wire', pts: [[60, 80], [60, 40], [100, 40]] },
      { t: 'wire', pts: [[170, 40], [210, 40]] },
      { t: 'wire', pts: [[320, 40], [360, 40], [360, 70]] },
      { t: 'wire', pts: [[360, 150], [360, 190], [60, 190], [60, 150]] },
      { t: 'tag', id: 'itag', at: [210, 120], text: 'I = 0 mA' },
    ],
  });
  const loop = [[60, 80], [60, 40], [360, 40], [360, 190], [60, 190], [60, 80]];
  const flow = sch.flow(loop, { speed: 0 });
  const ctl = W.$('#led-ctl');
  let V = 3.3, R = 150;
  const vs = W.slider(ctl, { label: 'Supply \\(V\\)', min: 1, max: 9, step: 0.1, value: V, unit: 'V', onInput: (v) => { V = v; update(); } });
  const rs = W.slider(ctl, { label: 'Resistor \\(R\\)', min: 22, max: 10000, log: true, value: R, unit: 'Ω', onInput: (v) => { R = v; update(); } });
  const iread = W.readout(ctl, { label: 'LED current', unit: 'A' });
  const pread = W.readout(ctl, { label: 'R power', unit: 'W' });
  sch.parts.sw.it.onToggle = update;
  void vs; void rs;

  function update() {
    const closed = sch.parts.sw.it.closed;
    const net = [
      { name: 'V', type: 'V', n: ['vp', '0'], value: V },
      { name: 'S', type: 'R', n: ['vp', 'a'], value: closed ? 1e-3 : 1e12 },
      { name: 'R', type: 'R', n: ['a', 'k'], value: R },
      { name: 'D', type: 'D', n: ['k', '0'], vf: 1.9, rs: 8 },
    ];
    const s = W.solveDC(net);
    const I = Math.max(0, s.i.D);
    sch.set('bat', { label: W.si(V, 'V', 2) });
    sch.set('r', { label: 'R = ' + W.si(R, 'Ω', 2) });
    sch.set('itag', { text: 'I = ' + W.si(I, 'A', 2) });
    iread.set(I);
    iread.setClass(I > 0.03 ? 'bad' : I > 0.0015 ? 'good' : '');
    pread.set(I * I * R);
    sch.set('led', { glow: Math.min(1, I / 0.02) });
    flow.set(Math.min(3, I / 0.006));
    if (closed && Math.abs(V - 3.3) < 0.051 && I >= 0.009 && I <= 0.011) Book.solve('led-task');
  }
  update();

  // ---- Figure 0.2: I vs R ----
  const p = W.plot('#plot-led', { xmin: 47, xmax: 10000, logx: true, ymin: 0, ymax: 0.06, xlabel: 'Series resistance R (Ω)', ylabel: 'LED current (A)', hover: true, xunit: 'Ω', yunit: 'A', height: 280 });
  p.draw((p) => {
    p.area(() => 0.02, 47, 10000, { color: 'c3', alpha: 0.12 }, () => 0.002);
    for (const [v, c] of [[3.3, 'c1'], [5, 'c2'], [9, 'c4']]) p.fn((r) => Math.max(0, (v - 1.9) / r), { color: c, label: `${v} V supply` });
  });
})();
