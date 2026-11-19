/* Chapter 7 widgets: microcontrollers, ESP32, FreeRTOS, BLE */
(function () {
  'use strict';
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';
  const col = (c) => W.col(c);
  const onTheme = (fn) => document.addEventListener('themechange', fn);
  function cv(sel, height, draw) {
    const o = { height };
    const c = W.canvas(sel, o);
    o.onResize = () => draw(c);
    onTheme(() => draw(c));
    return c;
  }
  function clear(c) { const x = c.ctx; x.setLineDash([]); x.globalAlpha = 1; x.fillStyle = col('surface'); x.fillRect(0, 0, c.w, c.h); }
  function txt(x, s, px, py, o = {}) {
    x.save(); x.font = (o.bold ? '600 ' : '') + (o.size || 12) + 'px ' + (o.mono ? MONO : FONT);
    x.fillStyle = col(o.color || 'ink'); x.textAlign = o.align || 'left'; x.textBaseline = o.base || 'middle';
    x.fillText(s, px, py); x.restore();
  }
  function rrect(x, a, b, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function hl(sch, id, c) {
    const r = sch.parts[id]; if (!r) return;
    const v = c ? 'var(--' + c + ')' : '';
    r.g.querySelectorAll('line, polyline, path, circle, polygon, rect').forEach((e) => {
      if (e.classList.contains('hit') || e.classList.contains('icbox') || e.classList.contains('glow')) return;
      e.style.stroke = v; if (e.classList.contains('fill')) e.style.fill = v;
    });
  }
  const hex2 = (v) => '0x' + v.toString(16).toUpperCase().padStart(2, '0');
  const bin8 = (v) => v.toString(2).padStart(8, '0');

  /* =====================================================================
   * Figure 7.1 — MCU block diagram
   * ===================================================================== */
  (function () {
    const VW = 640, VH = 350;
    const CHIPS = {
      esp: {
        blocks: {
          xtal: ['40 MHz crystal', 'clk', 'The reference oscillator. Everything else is derived from it, so its accuracy (typically ±10 ppm) sets the accuracy of baud rates, PWM frequencies and the radio carrier.'],
          pll: ['PLL ×12 / ×8', 'clk', 'A phase-locked loop multiplies the crystal up to 480 or 320 MHz internally. Dividers produce the CPU clock (80/160/240 MHz) and the 80 MHz APB clock.'],
          div: ['CPU 240 · APB 80 MHz', 'clk', 'Clock dividers and gates. Lowering the CPU frequency (power management, DFS) saves power; peripherals fed from APB keep their timing.'],
          rtc: ['RTC + ULP', 'clk', 'The always-on domain: a slow RC oscillator (or 32 kHz crystal), the RTC timer, 8 KB of RTC memory and the ULP coprocessor. This is all that runs in deep sleep (~10 µA).'],
          cpu: ['2× Xtensa LX6', 'core', 'Two 32-bit cores up to 240 MHz. By convention core 0 runs the Wi-Fi/BT stacks and core 1 your Arduino loop(). Each has its own interrupt controller inputs and caches.'],
          flash: ['Cache → SPI flash', 'mem', 'Code runs from an external SPI flash chip (typically 4–16 MB, inside the module) through a cache. A cache miss costs many cycles, which is why ISRs must live in IRAM (IRAM_ATTR).'],
          sram: ['SRAM 520 KB', 'mem', 'On-chip RAM: data, stacks, heap, plus IRAM for time-critical code. WROVER modules add external PSRAM over SPI.'],
          ahb: ['AHB: high-speed bus', 'bus', 'Connects the CPUs, memories, DMA and fast peripherals. The bus matrix lets several masters (CPU, DMA) use different slaves at the same time.'],
          dma: ['DMA', 'core', 'Direct memory access: moves data between memory and peripherals (SPI, I2S, UART) without the CPU. Your code sets up a transfer and gets an interrupt when it is done.'],
          intc: ['Interrupt matrix', 'core', 'Routes ~70 peripheral interrupt sources to the CPU interrupt inputs of either core, with priority levels. ESP-IDF allocates these for you (esp_intr_alloc).'],
          radio: ['Wi-Fi + BLE radio', 'per', '2.4 GHz transceiver, baseband and MAC for 802.11 b/g/n and Bluetooth. Shares one antenna and coexists by time-slicing; its drivers use ADC2 (hence the ADC2/Wi-Fi conflict).'],
          apb: ['APB: peripheral bus (80 MHz)', 'bus', 'The slower bus for register access to most peripherals. Its 80 MHz clock is the "APB clock" that LEDC, UART and timer prescalers divide.'],
          gpio: ['GPIO matrix', 'per', 'A crossbar that routes almost any peripheral signal to almost any pin, plus IO_MUX for the fastest signals. 34 GPIOs; 34–39 are input-only.'],
          tim: ['Timers ×4', 'per', 'Four 64-bit general-purpose timers with 16-bit prescalers, plus the esp_timer service built on them. Alarms raise interrupts.'],
          uart: ['UART ×3', 'per', 'Three UARTs with hardware FIFOs and RS-485 support. UART0 carries the boot log and flashing.'],
          spi: ['SPI ×4', 'per', 'Four SPI controllers; two are used for flash/PSRAM, two (HSPI, VSPI) are yours, with DMA, up to 80 MHz on IO_MUX pins.'],
          i2c: ['I²C ×2', 'per', 'Two I²C controllers (standard and fast mode; up to 1 MHz with care), routable to any pins.'],
          adc: ['ADC1 + ADC2', 'per', 'Two 12-bit SAR ADCs, 18 channels. ADC2 is unavailable while Wi-Fi is running; calibration is needed for accuracy.'],
          pwm: ['LEDC + MCPWM', 'per', 'LEDC: 16 PWM channels for LEDs and servos. MCPWM: motor-control PWM with dead time and fault inputs for H-bridges.'],
          rmt: ['RMT · PCNT · TWAI', 'per', 'RMT generates and receives precise pulse trains (IR, WS2812, DShot). PCNT counts encoder pulses. TWAI is the CAN controller.'],
        },
      },
      avr: {
        blocks: {
          xtal: ['16 MHz crystal', 'clk', 'The Uno uses an external 16 MHz crystal (or resonator). The ATmega328P can instead run from its internal 8 MHz RC oscillator (about ±10% before calibration).'],
          pll: ['Clock prescaler', 'clk', 'No PLL: the system clock can only be divided (CLKPR) to save power. The CPU and the I/O clock run at the crystal frequency.'],
          div: ['CPU + I/O 16 MHz', 'clk', 'One clock domain for the core and peripherals. Each timer, the ADC and the USART have their own prescalers.'],
          rtc: ['WDT osc 128 kHz', 'clk', 'An independent 128 kHz oscillator clocks the watchdog, so it keeps counting even if the main clock fails.'],
          cpu: ['AVR 8-bit core', 'core', 'An 8-bit RISC core: most instructions in 1 clock, 32 general-purpose registers, a hardware 8×8 multiplier, no FPU, no cache.'],
          flash: ['Flash 32 KB', 'mem', 'Program memory (Harvard architecture: separate from data space). The bootloader occupies 0.5–2 KB at the top. Constant data must be placed here with PROGMEM to save RAM.'],
          sram: ['SRAM 2 KB · EEPROM 1 KB', 'mem', '2 KB for all variables, the stack and the heap: a String concatenation in a loop can exhaust it. 1 KB of EEPROM keeps settings across power cycles.'],
          ahb: ['8-bit data bus', 'bus', 'The core accesses registers, I/O and SRAM in one data address space. The first 64 I/O registers can be reached by the single-cycle IN/OUT/SBI/CBI instructions.'],
          dma: ['(no DMA)', 'na', 'The ATmega328P has no DMA: every byte a peripheral sends or receives passes through the CPU, usually in an ISR.'],
          intc: ['Interrupt unit', 'core', '26 interrupt vectors with fixed priority (lower address = higher priority). Interrupts are disabled inside an ISR unless you re-enable them.'],
          radio: ['(no radio)', 'na', 'No radio on chip. Add a module: an HC-05 (Bluetooth serial), an nRF24L01 (SPI) or an ESP-01.'],
          apb: ['I/O registers', 'bus', 'Peripherals are just registers in the I/O space, all clocked from clkI/O.'],
          gpio: ['GPIO ports B, C, D', 'per', '23 I/O pins in three ports, each controlled by DDRx, PORTx and PINx. Pin functions are fixed: no remapping.'],
          tim: ['Timer0 · Timer1 · Timer2', 'per', 'Two 8-bit timers and one 16-bit timer, each with two compare units and PWM outputs. Timer0 drives millis().'],
          uart: ['USART0', 'per', 'One hardware serial port on PD0/PD1, shared with the USB-serial chip on an Uno.'],
          spi: ['SPI', 'per', 'One SPI controller (PB3 MOSI, PB4 MISO, PB5 SCK, PB2 SS). Also used for ISP programming.'],
          i2c: ['TWI (I²C)', 'per', 'One I²C controller on PC4 (SDA) and PC5 (SCL), up to 400 kHz.'],
          adc: ['ADC 10-bit', 'per', 'One 10-bit SAR ADC with a multiplexer for 6 channels (8 on the TQFP package), ~13 ADC clocks per conversion.'],
          pwm: ['PWM (via timers)', 'per', 'Six PWM outputs, two per timer. analogWrite() uses them at ~490 Hz or ~980 Hz.'],
          rmt: ['Analog comparator', 'per', 'A comparator that can trigger interrupts or capture Timer1, useful for zero-crossing detection.'],
        },
      },
    };
    const L = {
      xtal: [8, 18, 118, 40], pll: [8, 76, 118, 40], div: [8, 134, 118, 50], rtc: [8, 268, 118, 62],
      cpu: [150, 18, 150, 54], flash: [312, 18, 150, 54], sram: [474, 18, 158, 54],
      ahb: [150, 92, 482, 18],
      dma: [150, 128, 100, 44], intc: [262, 128, 200, 44], radio: [474, 128, 158, 44],
      apb: [150, 190, 482, 18],
      gpio: [150, 226, 113, 42], tim: [273, 226, 113, 42], uart: [396, 226, 113, 42], spi: [519, 226, 113, 42],
      i2c: [150, 280, 113, 42], adc: [273, 280, 113, 42], pwm: [396, 280, 113, 42], rmt: [519, 280, 113, 42],
    };
    let chip = 'esp', sel = 'cpu', phase = 0;
    const ctl = W.$('#c-block'), info = W.$('#block-info');
    W.segmented(ctl, { options: [['esp', 'ESP32'], ['avr', 'ATmega328P']], value: chip, onChange: (v) => { chip = v; showInfo(); } });
    const c = cv('#w-block', 300, () => draw());
    function scale() { return c.w / VW; }
    function fitH() { const h = Math.round(VH * scale()); if (Math.abs(c.h - h) > 1) { c.h = h; const dpr = window.devicePixelRatio || 1; c.canvas.height = Math.round(h * dpr); c.canvas.style.height = h + 'px'; c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } }
    function pathTo(id) {
      const [bx, by, bw, bh] = L[id], cx = bx + bw / 2, cy = by + bh / 2;
      const cpu = [225, 72];
      const kind = CHIPS[chip].blocks[id][1];
      if (id === 'cpu') return null;
      if (kind === 'clk' || kind === 'na') return null;
      if (by < 90) return [cpu, [225, 101], [cx, 101], [cx, by + bh]];
      if (by < 180) return [cpu, [225, 101], [cx, 101], [cx, by]];
      if (id === 'ahb' || id === 'apb') return [cpu, [225, 101], [cx, 101], [cx, by + bh / 2]];
      return [cpu, [225, 101], [630, 101], [630, 199], [cx, 199], [cx, by]];
    }
    function draw() {
      fitH();
      const x = c.ctx, s = scale(); clear(c);
      x.save(); x.scale(s, s);
      const B = CHIPS[chip].blocks;
      // clock arrows
      x.strokeStyle = col('c2'); x.lineWidth = 2;
      for (const [a, b] of [['xtal', 'pll'], ['pll', 'div']]) { const A = L[a], Bb = L[b]; x.beginPath(); x.moveTo(A[0] + A[2] / 2, A[1] + A[3]); x.lineTo(Bb[0] + Bb[2] / 2, Bb[1]); x.stroke(); }
      x.setLineDash([4, 4]); x.beginPath(); x.moveTo(126, 159); x.lineTo(150, 159); x.moveTo(126, 159); x.lineTo(138, 159); x.lineTo(138, 45); x.lineTo(150, 45); x.stroke(); x.setLineDash([]);
      txt(x, 'clock tree', 67, 204, { align: 'center', size: 12, color: 'c2', bold: true });
      for (const id in L) {
        const [bx, by, bw, bh] = L[id], [name, kind, ] = B[id];
        const isSel = id === sel;
        const fill = { clk: 'c2', core: 'c1', mem: 'c5', bus: 'muted', per: 'c3', na: 'muted' }[kind];
        x.save(); x.globalAlpha = kind === 'na' ? 0.08 : isSel ? 0.35 : 0.16; x.fillStyle = col(fill); rrect(x, bx, by, bw, bh, 6); x.fill(); x.restore();
        x.strokeStyle = col(isSel ? 'accent' : kind === 'na' ? 'line' : 'muted'); x.lineWidth = isSel ? 2.5 : 1; rrect(x, bx, by, bw, bh, 6); x.stroke();
        let fs = 13; x.font = '600 ' + fs + 'px ' + FONT;
        while (fs > 6 && x.measureText(name).width > bw - 8) { fs -= 0.5; x.font = '600 ' + fs + 'px ' + FONT; }
        txt(x, name, bx + bw / 2, by + bh / 2, { align: 'center', size: fs, bold: true, color: kind === 'na' ? 'muted' : 'ink' });
      }
      const p = pathTo(sel);
      if (p) {
        let tot = 0; const seg = []; for (let i = 0; i < p.length - 1; i++) { const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); seg.push(l); tot += l; }
        x.save(); x.strokeStyle = col('accent'); x.globalAlpha = 0.5; x.lineWidth = 3; x.beginPath(); p.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.stroke(); x.restore();
        x.fillStyle = col('accent');
        for (let k = 0; k < tot / 30; k++) {
          let d = (phase * 60 + k * 30) % tot, i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
          const t = seg[i] ? d / seg[i] : 0, px = p[i][0] + (p[i + 1][0] - p[i][0]) * t, py = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
          x.beginPath(); x.arc(px, py, 3.5, 0, 7); x.fill();
        }
      }
      x.restore();
    }
    function showInfo() { const b = CHIPS[chip].blocks[sel]; info.innerHTML = '<b>' + b[0] + '.</b> ' + b[2]; }
    c.canvas.addEventListener('click', (e) => {
      const r = c.canvas.getBoundingClientRect(), s = scale(), px = (e.clientX - r.left) / s, py = (e.clientY - r.top) / s;
      for (const id in L) { const [bx, by, bw, bh] = L[id]; if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) { sel = id; showInfo(); draw(); return; } }
    });
    c.canvas.style.cursor = 'pointer';
    showInfo();
    W.anim((dt) => { phase += dt; draw(); }, c.canvas);
  })();

  /* =====================================================================
   * Figure 7.2 — DDRB / PORTB / PINB bit widget
   * ===================================================================== */
  (function () {
    const root = W.$('#w-regs');
    let ddr = 0, port = 0, flick = 0;
    const NA = 0xC0; // PB6, PB7 = crystal
    const pinLabel = ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'XTAL', 'XTAL'];
    const log = [];
    const wrap = W.h('div', { class: 'ch7-regs' });
    const hdr = W.h('div', { class: 'ch7-hdr' }); for (let b = 7; b >= 0; b--) hdr.append(W.h('span', {}, 'PB' + b));
    const hdr2 = W.h('div', { class: 'ch7-hdr' }); for (let b = 7; b >= 0; b--) hdr2.append(W.h('span', {}, pinLabel[b]));
    const rows = {};
    function row(name, onClick) {
      const r = W.h('div', { class: 'ch7-row' }, W.h('span', { class: 'nm' }, name));
      const btns = [];
      for (let b = 7; b >= 0; b--) {
        const bt = W.h('button', { class: 'ch7-bit', type: 'button', title: name + ' bit ' + b }, '0');
        bt.addEventListener('click', () => { if (NA & (1 << b)) return; onClick(b); upd(); });
        r.append(bt); btns[b] = bt;
      }
      const val = W.h('span', { class: 'val' }); r.append(val);
      rows[name] = { btns, val }; return r;
    }
    const ledRow = W.h('div', { class: 'ch7-row' }, W.h('span', { class: 'nm' }, 'pins'));
    const leds = []; for (let b = 7; b >= 0; b--) { const l = W.h('span', { class: 'ch7-led', title: 'PB' + b }); ledRow.append(l); leds[b] = l; }
    const code = W.h('div', { class: 'ch7-code' });
    const say = (s) => { log.push(s); while (log.length > 4) log.shift(); code.textContent = log.join('\n'); };
    wrap.append(hdr,
      row('DDRB', (b) => { const on = !(ddr & (1 << b)); ddr ^= 1 << b; say(on ? `DDRB  |=  (1 << ${b});   // PB${b} output` : `DDRB  &= ~(1 << ${b});   // PB${b} input`); }),
      row('PORTB', (b) => { const on = !(port & (1 << b)); port ^= 1 << b; say(on ? `PORTB |=  (1 << ${b});   // ${ddr & (1 << b) ? 'drive high' : 'pull-up on'}` : `PORTB &= ~(1 << ${b});   // ${ddr & (1 << b) ? 'drive low' : 'pull-up off'}`); }),
      row('PINB', (b) => { port ^= 1 << b; say(`PINB   =  (1 << ${b});   // toggles PORTB bit ${b}`); }),
      ledRow, hdr2);
    // statement builder
    const ctl = W.h('div', { class: 'w-controls' });
    let reg = 'PORTB', op = '|=', bit = 5;
    W.select(ctl, { label: '', options: [['DDRB', 'DDRB'], ['PORTB', 'PORTB'], ['PINB', 'PINB']], value: reg, onChange: (v) => { reg = v; } });
    W.select(ctl, { label: '', options: [['|=', '|= (1 << n)'], ['&=', '&= ~(1 << n)'], ['^=', '^= (1 << n)'], ['=', '= (1 << n)']], value: op, onChange: (v) => { op = v; } });
    W.select(ctl, { label: 'n =', options: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)]), value: bit, onChange: (v) => { bit = +v; } });
    W.button(ctl, 'Apply', () => {
      const m = 1 << bit;
      const rhs = op === '&=' ? `~(1 << ${bit})` : `(1 << ${bit})`;
      if (reg === 'PINB') {
        if (op === '=') port ^= m;
        else { const pins = pinVal(true); const v = op === '|=' ? pins | m : op === '&=' ? pins & ~m : pins ^ m; port ^= v & ~NA; }
        say(`PINB ${op} ${rhs};` + (op === '=' ? `   // toggles PORTB bit ${bit}` : '   // ⚠ toggles every bit written as 1!'));
      } else {
        let v = reg === 'DDRB' ? ddr : port;
        v = op === '|=' ? v | m : op === '&=' ? v & ~m : op === '^=' ? v ^ m : m;
        v &= ~NA; if (reg === 'DDRB') ddr = v; else port = v;
        say(`${reg} ${op} ${rhs};`);
      }
      upd();
    });
    W.button(ctl, 'Reset', () => { ddr = 0; port = 0; log.length = 0; say('// reset: all pins are inputs, pull-ups off'); upd(); });
    root.append(wrap, ctl, code);
    function pinVal(numeric) {
      let v = 0, s = '';
      for (let b = 7; b >= 0; b--) {
        let p;
        if (NA & (1 << b)) p = 'x';
        else if (ddr & (1 << b)) p = port & (1 << b) ? 1 : 0;
        else if (port & (1 << b)) p = 1;
        else p = '?';
        const n = p === 1 ? 1 : p === '?' ? ((flick >> b) & 1) : 0;
        v |= n << b; s += p;
      }
      return numeric ? v : s;
    }
    function upd() {
      const pins = pinVal(false);
      for (let b = 7; b >= 0; b--) {
        const na = NA & (1 << b);
        const set = (r, on, t) => { const bt = rows[r].btns[b]; bt.textContent = t; bt.classList.toggle('on', on); bt.classList.toggle('na', !!na); };
        set('DDRB', !!(ddr & (1 << b)), na ? '–' : String((ddr >> b) & 1));
        set('PORTB', !!(port & (1 << b)), na ? '–' : String((port >> b) & 1));
        const p = pins[7 - b];
        set('PINB', p === '1', na ? '–' : p);
        rows.PINB.btns[b].title = 'PINB bit ' + b + ' (click = write 1 = toggle PORTB bit)';
        leds[b].classList.toggle('lit', !na && !!(ddr & port & (1 << b)));
      }
      rows.DDRB.val.textContent = hex2(ddr) + ' ' + bin8(ddr);
      rows.PORTB.val.textContent = hex2(port) + ' ' + bin8(port);
      rows.PINB.val.textContent = pins.includes('?') ? 'floating bits!' : hex2(parseInt(pins.replace(/x/g, '0'), 2));
      if (ddr === 0x20 && (port & 0x21) === 0x21) Book.solve('reg-task');
    }
    say('// reset: all pins are inputs, pull-ups off');
    upd();
    setInterval(() => { flick = Math.floor(Math.random() * 256); if (pinVal(false).includes('?')) upd(); }, 700);
  })();

  /* =====================================================================
   * Figure 7.3 — minimal ATmega328P with INT0 button and LED
   * ===================================================================== */
  (function () {
    const sch = W.schematic('#w-avr', {
      w: 480, h: 260, title: 'ATmega328P with crystal, reset pull-up, LED on PB5 and button on PD2',
      items: [
        { t: 'ic', id: 'u', at: [230, 140], name: 'ATmega328P', left: ['RESET', 'XTAL1', 'XTAL2', 'VCC', 'GND'], right: ['PB5', 'PD2'], pitch: 24, w: 120 },
        { t: 'vcc', at: [120, 40], label: '5 V' },
        { t: 'R', id: 'rr', a: [120, 40], b: [120, 80], label: '10 kΩ', side: -1 },
        { t: 'wire', pts: [[120, 80], [120, 92], 'u.RESET'] }, { t: 'dot', at: [120, 92] },
        { t: 'wire', pts: ['u.XTAL1', [110, 116]] }, { t: 'wire', pts: ['u.XTAL2', [110, 140]] },
        { t: 'xtal', id: 'x', a: [110, 116], b: [110, 140], label: '16 MHz', side: -1 },
        { t: 'wire', pts: ['u.VCC', [80, 164]] }, { t: 'dot', at: [80, 164] }, { t: 'vcc', at: [60, 164], label: '5 V' }, { t: 'wire', pts: [[60, 164], [80, 164]] },
        { t: 'C', id: 'cd', a: [80, 178], b: [80, 206], label: '100 nF', side: -1 },
        { t: 'wire', pts: [[80, 164], [80, 178]] }, { t: 'wire', pts: [[80, 206], [80, 222]] }, { t: 'gnd', at: [80, 222] },
        { t: 'wire', pts: ['u.GND', [130, 188], [130, 222]] }, { t: 'gnd', at: [130, 222] },
        { t: 'wire', pts: ['u.PB5', [330, 128]] },
        { t: 'R', id: 'rl', a: [330, 128], b: [390, 128], label: '220 Ω' },
        { t: 'wire', pts: [[390, 128], [430, 128], [430, 145]] },
        { t: 'LED', id: 'led', a: [430, 145], b: [430, 195], label: 'D13', color: '#ff4d4d' },
        { t: 'wire', pts: [[430, 195], [430, 215]] }, { t: 'gnd', at: [430, 215] },
        { t: 'wire', pts: ['u.PD2', [345, 152], [345, 168]] },
        { t: 'PB', id: 'pb', a: [345, 168], b: [345, 205], label: 'press' },
        { t: 'wire', pts: [[345, 205], [345, 215]] }, { t: 'gnd', at: [345, 215] },
        { t: 'tag', id: 'tag', at: [230, 246], text: 'INT0 ISR ran 0 times' },
      ],
    });
    const fLed = sch.flow(['u.PB5', [430, 128], [430, 215]], { speed: 0 });
    const fBtn = sch.flow(['u.PD2', [345, 152], [345, 215]], { speed: 0 });
    const ctl = W.$('#c-avr');
    let led = false, n = 0, bouncy = false;
    W.toggle(ctl, { label: 'Bouncy contacts', value: false, onChange: (v) => { bouncy = v; } });
    const rP = W.readout(ctl, { label: 'PORTB' });
    function upd() {
      sch.set('led', { glow: led ? 1 : 0 }); fLed.set(led ? 1.2 : 0);
      sch.set('tag', { text: 'INT0 ISR ran ' + n + ' time' + (n === 1 ? '' : 's') });
      rP.set(hex2(led ? 0x20 : 0) + ' (PB5 ' + (led ? 'high' : 'low') + ')');
    }
    sch.parts.pb.it.onToggle = (down) => {
      fBtn.set(down ? 0.6 : 0);
      if (!down) return;
      const k = bouncy ? 1 + Math.floor(Math.random() * 5) : 1;
      let i = 0;
      const fire = () => { n++; led = !led; upd(); if (++i < k) setTimeout(fire, 60); };
      fire();
    };
    upd();
  })();

  /* =====================================================================
   * Figure 7.4 — ISR timing
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-isr');
    let rate = 0.4, L = 0.6; // events per ms, ISR ms
    W.slider(ctl, { label: 'Event rate', min: 0.05, max: 2, step: 0.05, value: rate, format: (v) => Math.round(v * 1000) + ' /s', onInput: (v) => { rate = v; } });
    W.slider(ctl, { label: 'ISR length', min: 0.02, max: 2.5, step: 0.02, value: L, format: (v) => W.fix(v * 1000, 0) + ' µs', onInput: (v) => { L = v; } });
    const rLoad = W.readout(ctl, { label: 'CPU in ISRs' }), rMiss = W.readout(ctl, { label: 'Events lost' });
    const WIN = 20;
    let t = 0, next = 0, busyUntil = -1, pending = false, pendStart = 0;
    const isr = [], pend = [], arr = [], lost = [];
    let total = 0, missed = 0;
    const exp = () => -Math.log(1 - Math.random()) / rate;
    function step(T) {
      while (true) {
        const tEnd = busyUntil;
        const nextEv = next;
        if (pending && tEnd <= nextEv && tEnd <= T) { // ISR ends, pending runs
          pend.push([pendStart, tEnd]); pending = false;
          isr.push([tEnd, tEnd + L]); busyUntil = tEnd + L; continue;
        }
        if (nextEv > T) break;
        total++; arr.push(nextEv);
        if (nextEv >= busyUntil) { isr.push([nextEv, nextEv + L]); busyUntil = nextEv + L; }
        else if (!pending) { pending = true; pendStart = nextEv; }
        else { lost.push(nextEv); missed++; }
        next = nextEv + exp();
      }
      const cut = T - WIN - 3;
      for (const a of [isr, pend]) while (a.length && a[0][1] < cut) a.shift();
      for (const a of [arr, lost]) while (a.length && a[0] < cut) a.shift();
      if (total > 400) { total = Math.round(total / 2); missed = Math.round(missed / 2); }
    }
    const c = cv('#w-isr', 210, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const l = 86, r = c.w - 10, X = (tt) => l + (r - l) * (tt - (t - WIN)) / WIN;
      const rows = [['events', 26], ['ISR', 70], ['pending', 112], ['main loop', 154]];
      for (const [n, y] of rows) { txt(x, n, 8, y, { size: 12, color: 'muted' }); x.strokeStyle = col('line'); x.beginPath(); x.moveTo(l, y + 14); x.lineTo(r, y + 14); x.stroke(); }
      x.save(); x.beginPath(); x.rect(l, 0, r - l, c.h); x.clip();
      // main loop: blue where not in ISR
      x.fillStyle = col('c1'); x.globalAlpha = 0.7; x.fillRect(l, 144, r - l, 20); x.globalAlpha = 1;
      for (const [a, b] of isr) { x.fillStyle = col('surface'); x.fillRect(X(a), 143, X(Math.min(b, t)) - X(a), 22); x.fillStyle = col('c2'); x.fillRect(X(a), 58, Math.max(1.5, X(Math.min(b, t)) - X(a)), 24); }
      if (pending) pend.push([pendStart, t]);
      x.fillStyle = col('c2'); x.globalAlpha = 0.45;
      for (const [a, b] of pend) { x.save(); x.fillStyle = '#f5c518'; x.globalAlpha = 0.85; x.fillRect(X(a), 102, Math.max(1.5, X(Math.min(b, t)) - X(a)), 20); x.restore(); }
      if (pending) pend.pop();
      x.globalAlpha = 1;
      x.strokeStyle = col('ink'); x.lineWidth = 2;
      for (const a of arr) { x.beginPath(); x.moveTo(X(a), 16); x.lineTo(X(a), 36); x.stroke(); }
      x.strokeStyle = col('bad'); x.lineWidth = 2.5;
      for (const a of lost) { const px = X(a); x.beginPath(); x.moveTo(px - 6, 18); x.lineTo(px + 6, 34); x.moveTo(px + 6, 18); x.lineTo(px - 6, 34); x.stroke(); }
      x.restore();
      txt(x, '← 20 ms of history (slowed down 250×)', r, c.h - 12, { align: 'right', size: 11, color: 'muted' });
    }
    W.anim((dt) => {
      t += dt * 4; step(t); draw();
      const load = Math.min(1, rate * L);
      rLoad.set(Math.round(load * 100) + ' %'); rLoad.setClass(load > 0.5 ? 'bad' : 'good');
      const m = total ? missed / total : 0;
      rMiss.set(W.fix(m * 100, 1) + ' %'); rMiss.setClass(m > 0 ? 'bad' : 'good');
    }, c.canvas);
  })();

  /* =====================================================================
   * Figure 7.5 — debounce
   * ===================================================================== */
  (function () {
    let tau = 0.05;
    const flips = [6.0, 6.12, 6.35, 6.47, 6.8, 6.95, 7.4, 7.5, 8.1, 16.0, 16.15, 16.4, 16.5, 16.9];
    const raw = (t) => { let s = 1; for (const f of flips) if (t >= f) s = 1 - s; return s * 3.3; };
    const DT = 0.002, N = Math.round(24 / DT);
    let filt = new Float32Array(N + 1), sch = new Uint8Array(N + 1), res = {};
    function sim() {
      let v = 3.3, st = 1, fRaw = 0, fS = 0, prevRaw = 1, firstS = null;
      for (let i = 0; i <= N; i++) {
        const t = i * DT, r = raw(t);
        v += (r - v) * (1 - Math.exp(-DT / tau));
        filt[i] = v;
        if (st && v < 1.0) { st = 0; fS++; if (firstS == null) firstS = t; } else if (!st && v > 2.0) st = 1;
        sch[i] = st;
        const rb = r > 1.65 ? 1 : 0; if (prevRaw && !rb) fRaw++; prevRaw = rb;
      }
      res = { fRaw, fS, delay: firstS == null ? null : firstS - 6.0 };
    }
    const p = W.plot('#w-bounce', { xmin: 0, xmax: 22, ymin: -0.3, ymax: 4.2, height: 240, xlabel: 'time (ms)', ylabel: 'volts', xfmt: (v) => String(v) });
    p.draw((p) => {
      p.hline(2.0, { color: 'c4', width: 1 }); p.hline(1.0, { color: 'c4', width: 1 });
      p.text(21.9, 2.18, 'VT+', { align: 'right', size: 10, color: 'c4' }); p.text(21.9, 0.82, 'VT−', { align: 'right', size: 10, color: 'c4' });
      p.fn(raw, { color: 'c1', width: 1.2, samples: 3000, label: 'raw contact', hover: false });
      p.fn((t) => filt[Math.min(N, Math.max(0, Math.round(t / DT)))], { color: 'c2', width: 2.5, samples: 1600, label: 'after RC', hover: false });
      p.fn((t) => 0.25 + 3.6 * sch[Math.min(N, Math.max(0, Math.round(t / DT)))], { color: 'c3', width: 2, dash: [5, 3], samples: 1600, label: 'Schmitt output', hover: false });
    });
    const ctl = W.$('#c-bounce');
    W.slider(ctl, { label: 'RC time constant \\(\\tau\\)', min: 0.01, max: 5, log: true, value: tau, format: (v) => W.si(v / 1000, 's', 2), onInput: (v) => { tau = v; upd(); } });
    const rR = W.readout(ctl, { label: 'Presses seen (plain input on raw)' }), rS = W.readout(ctl, { label: 'Presses seen (RC + Schmitt)' }), rD = W.readout(ctl, { label: 'Added delay' });
    function upd() {
      sim(); p.update();
      rR.set(String(res.fRaw)); rR.setClass(res.fRaw === 1 ? 'good' : 'bad');
      rS.set(String(res.fS)); rS.setClass(res.fS === 1 ? 'good' : 'bad');
      rD.set(res.delay == null ? 'never' : W.si(res.delay / 1000, 's', 2));
    }
    upd();
  })();

  /* =====================================================================
   * Figure 7.6 — timer CTC calculator
   * ===================================================================== */
  (function () {
    const F = 16e6;
    let bits = 8, N = 64, ocr = 124;
    const fInt = () => F / (N * (1 + ocr));
    const p1 = W.plot('#w-timer', { xmin: 0, xmax: 3 / fInt(), ymin: 0, ymax: 300, height: 190, xlabel: '', ylabel: 'TCNT', xunit: 's', xfmt: (v) => W.tick(v) + 's' });
    p1.draw((p) => {
      const tick = N / F;
      p.fn((t) => Math.floor(t / tick) % (ocr + 1), { color: 'c1', samples: 1500, hover: false });
      p.hline(ocr, { color: 'c4' }); p.text(p.o.xmax * 0.99, ocr + p.o.ymax * 0.05, 'OCR = ' + ocr, { align: 'right', color: 'c4', size: 11 });
    });
    const p2 = W.plot('#w-timer', { xmin: 0, xmax: 3 / fInt(), ymin: -0.3, ymax: 1.4, height: 110, xlabel: 'time', ylabel: 'OC pin', xunit: 's', yfmt: (v) => (v === 0 || v === 1 ? String(v) : '') });
    p2.draw((p) => { const T = 1 / fInt(); p.fn((t) => (Math.floor(t / T) % 2 ? 1 : 0), { color: 'c3', samples: 1500, hover: false }); });
    const ctl = W.$('#c-timer');
    let sl;
    W.segmented(ctl, { options: [[8, '8-bit timer'], [16, '16-bit timer']], value: bits, onChange: (v) => { bits = v; ocr = Math.min(ocr, 2 ** bits - 1); sl.input.max = 2 ** bits - 1; sl.set(ocr, false); upd(); } });
    W.segmented(ctl, { options: [1, 8, 64, 256, 1024].map((n) => [n, '/' + n]), value: N, onChange: (v) => { N = v; upd(); } });
    sl = W.slider(ctl, { label: 'OCR', min: 0, max: 255, step: 1, value: ocr, format: (v) => String(Math.round(v)), onInput: (v) => { ocr = Math.round(v); upd(); } });
    W.button(ctl, '−1', () => { ocr = Math.max(0, ocr - 1); sl.set(ocr, false); upd(); });
    W.button(ctl, '+1', () => { ocr = Math.min(2 ** bits - 1, ocr + 1); sl.set(ocr, false); upd(); });
    const rT = W.readout(ctl, { label: 'Tick', unit: 's' }), rF = W.readout(ctl, { label: 'Interrupt rate', unit: 'Hz' }), rO = W.readout(ctl, { label: 'Pin frequency', unit: 'Hz' }), rE = W.readout(ctl, { label: 'Error vs 1 kHz' });
    function upd() {
      const f = fInt();
      rT.set(N / F); rF.set(f); rO.set(f / 2);
      const e = (f - 1000) / 1000; rE.set((e >= 0 ? '+' : '') + W.fix(e * 100, 3) + ' %'); rE.setClass(Math.abs(e) < 1e-6 ? 'good' : '');
      p1.set({ xmax: 3 / f, ymax: Math.max(4, ocr * 1.18) }).update(); p2.set({ xmax: 3 / f }).update();
      if (bits === 8 && Math.abs(f - 1000) < 0.01) Book.solve('timer-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 7.7 — ESP32 strapping / boot circuit
   * ===================================================================== */
  (function () {
    const sch = W.schematic('#w-strap', {
      w: 500, h: 270, title: 'ESP32 EN reset network, BOOT button on GPIO0 and the GPIO12 strapping trap',
      items: [
        { t: 'ic', id: 'u', at: [290, 130], name: 'ESP32 module', left: ['EN', 'IO0'], right: ['IO2', 'IO12', 'TX0'], pitch: 40, w: 110 },
        { t: 'wire', pts: ['u.EN', [110, 110]] }, { t: 'dot', at: [110, 110] },
        { t: 'vcc', at: [110, 40], label: '3.3 V' },
        { t: 'R', id: 'ren', a: [110, 40], b: [110, 95], label: '10 kΩ', side: -1 },
        { t: 'wire', pts: [[110, 95], [110, 110]] },
        { t: 'C', id: 'cen', a: [110, 160], b: [110, 200], label: '1 µF', side: -1 },
        { t: 'wire', pts: [[110, 110], [110, 160]] }, { t: 'wire', pts: [[110, 200], [110, 215]] }, { t: 'gnd', at: [110, 215] },
        { t: 'wire', pts: ['u.IO0', [165, 150], [165, 165]] },
        { t: 'SW', id: 'boot', a: [165, 165], b: [165, 205], label: 'BOOT' },
        { t: 'wire', pts: [[165, 205], [165, 215]] }, { t: 'gnd', at: [165, 215] },
        { t: 'wire', pts: ['u.IO2', [390, 90]] }, { t: 'text', at: [394, 90], text: 'LED', anchor: 'start' },
        { t: 'wire', pts: ['u.IO12', [430, 130]] },
        { t: 'vcc', id: 'v12', at: [430, 60], label: '3.3 V' },
        { t: 'R', id: 'r12', a: [430, 60], b: [430, 115], label: '10 kΩ' },
        { t: 'wire', id: 'w12', pts: [[430, 115], [430, 130]] }, { t: 'dot', id: 'd12', at: [430, 130] },
        { t: 'wire', pts: ['u.TX0', [390, 170]] }, { t: 'text', at: [394, 170], text: 'boot log', anchor: 'start' },
        { t: 'tag', id: 'tag', at: [270, 250], text: '' },
      ],
    });
    const fEn = sch.flow([[110, 40], [110, 200]], { speed: 0 });
    const ctl = W.$('#c-strap');
    let pull12 = false, busy = false;
    W.toggle(ctl, { label: 'Sensor with pull-up on GPIO12', value: false, onChange: (v) => { pull12 = v; show(); } });
    W.button(ctl, '⟲ Press RESET (EN)', () => reset());
    function show() {
      for (const id of ['v12', 'r12', 'w12', 'd12']) sch.set(id, { hidden: !pull12 });
      sch.set('r12', { label: pull12 ? '10 kΩ' : '' }); sch.set('v12', { label: pull12 ? '3.3 V' : ' ' });
    }
    function verdict() {
      const boot = sch.parts.boot.it.closed;
      if (pull12) return 'GPIO12 high → flash at 1.8 V → "flash read err", boot loop';
      if (boot) return 'GPIO0 low → ROM bootloader: waiting for download';
      return 'GPIO0 high → boot from flash: your firmware runs';
    }
    function reset() {
      if (busy) return; busy = true;
      sch.set('tag', { text: 'EN held low… capacitor charging (RC ≈ 10 ms)' });
      fEn.set(1.5);
      setTimeout(() => { fEn.set(0); busy = false; sch.set('tag', { text: verdict() }); }, 1100);
    }
    sch.parts.boot.it.onToggle = () => { if (!busy) sch.set('tag', { text: 'BOOT ' + (sch.parts.boot.it.closed ? 'held' : 'released') + ': press RESET to apply' }); };
    show(); sch.set('tag', { text: verdict() });
  })();

  /* =====================================================================
   * Figure 7.8 — ESP32 ADC transfer curve (illustrative)
   * ===================================================================== */
  (function () {
    const ATT = { 0: { fs: 1.1, nom: 1.1, lo: 0.1, hi: 0.95 }, 2.5: { fs: 1.5, nom: 1.5, lo: 0.1, hi: 1.25 }, 6: { fs: 2.2, nom: 2.2, lo: 0.15, hi: 1.75 }, 11: { fs: 3.0, nom: 3.3, lo: 0.15, hi: 2.45 } };
    let att = 11, vref = 1.1;
    const v0 = 0.07;
    const code = (V) => {
      const a = ATT[att], fs = a.fs * vref / 1.1, u = Math.max(0, (V - v0) / (fs - v0)), k = 0.78;
      const g = u < k ? u : k + (1 - k) * Math.tanh((u - k) / (1 - k));
      return Math.min(4095, Math.round(4095 * g));
    };
    const naive = (V) => code(V) / 4095 * ATT[att].nom;
    const calib = (V) => { const c0 = code(V); if (c0 <= 0) return v0; if (c0 >= 4095) return NaN; return V + 0.006 * Math.sin(V * 9); };
    const p = W.plot('#w-adc', { xmin: 0, xmax: 3.3, ymin: 0, ymax: 3.5, height: 260, xlabel: 'input voltage (V)', ylabel: 'reported (V)', hover: true, xunit: 'V', yunit: 'V' });
    p.draw((p) => {
      const a = ATT[att];
      p.area(() => 3.5, a.lo, a.hi, { color: 'c3', alpha: 0.1 });
      p.fn((v) => v, { color: 'muted', dash: [5, 4], width: 1.5, label: 'ideal', hover: false });
      p.fn(naive, { color: 'c4', label: 'raw (code × FS / 4095)' });
      p.fn(calib, { color: 'c1', label: 'calibrated' });
      p.text((a.lo + a.hi) / 2, 3.35, 'recommended range', { align: 'center', color: 'c3', size: 11 });
    });
    const ctl = W.$('#c-adc');
    W.segmented(ctl, { options: [[0, '0 dB'], [2.5, '2.5 dB'], [6, '6 dB'], [11, '11/12 dB']], value: att, onChange: (v) => { att = v; upd(); } });
    W.slider(ctl, { label: 'This chip\'s reference', min: 1.0, max: 1.2, step: 0.005, value: vref, format: (v) => W.fix(v * 1000, 0) + ' mV', onInput: (v) => { vref = v; upd(); } });
    const rE = W.readout(ctl, { label: 'Worst raw error in range' });
    function upd() {
      const a = ATT[att]; let e = 0;
      for (let v = a.lo; v <= a.hi; v += 0.01) e = Math.max(e, Math.abs(naive(v) - v));
      rE.set(Math.round(e * 1000) + ' mV'); rE.setClass(e > 0.05 ? 'bad' : 'good');
      p.update();
    }
    upd();
  })();

  /* =====================================================================
   * Figure 7.9 — FreeRTOS scheduler
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-rtos');
    let logPrio = 1, busy = false, play = 0;
    W.segmented(ctl, { options: [[1, 'Logger priority 1'], [6, 'Logger priority 6']], value: logPrio, onChange: (v) => { logPrio = v; compute(); } });
    W.segmented(ctl, { options: [[0, 'Logger blocks (vTaskDelay)'], [1, 'Logger busy-waits']], value: 0, onChange: (v) => { busy = !!v; compute(); } });
    const rM = W.readout(ctl, { label: 'Motor deadlines missed' }), rJ = W.readout(ctl, { label: 'Worst motor start delay' }), rI = W.readout(ctl, { label: 'Idle time' });
    const ROWS = [['isr', 'ISR', 'c4'], ['motor', 'Motor (5)', 'c1'], ['comms', 'Comms (3)', 'c3'], ['log', 'Logger', 'c5'], ['idle', 'Idle (0)', 'muted']];
    const DT = 0.1, TEND = 100;
    let timeline = [], misses = [], maxDelay = 0, idleT = 0;
    function compute() {
      const jobs = [];
      for (let r = 0; r < TEND; r += 10) jobs.push({ task: 'motor', prio: 5, rel: r, rem: 2, dl: r + 10 });
      for (let r = 1; r < TEND; r += 20) jobs.push({ task: 'comms', prio: 3, rel: r, rem: 4, dl: r + 20 });
      jobs.push({ task: 'comms', prio: 3, rel: 37.2, rem: 1.5, dl: 57 });
      if (busy) jobs.push({ task: 'log', prio: logPrio, rel: 3, rem: 1e9, dl: 1e9 });
      else for (let r = 3; r < TEND; r += 25) jobs.push({ task: 'log', prio: logPrio, rel: r, rem: 6, dl: r + 25 });
      timeline = []; misses = []; maxDelay = 0; idleT = 0;
      const started = new Set();
      for (let i = 0; i < TEND / DT; i++) {
        const t = i * DT + 1e-9;
        if (t >= 37 && t < 37.3) { timeline.push('isr'); continue; }
        for (const j of jobs) if (j.rem > 0 && j.dl <= t && !j.missed && j.task === 'motor') { j.missed = true; j.rem = 0; misses.push(j.dl); }
        const ready = jobs.filter((j) => j.rel <= t && j.rem > 0);
        if (!ready.length) { timeline.push('idle'); idleT += DT; continue; }
        ready.sort((a, b) => b.prio - a.prio || a.rel - b.rel);
        const j = ready[0];
        if (!started.has(j)) { started.add(j); if (j.task === 'motor') maxDelay = Math.max(maxDelay, t - j.rel); }
        j.rem -= DT; timeline.push(j.task);
      }
      for (const j of jobs) if (j.task === 'motor' && j.rem > 1e-6 && !j.missed && j.dl <= TEND) misses.push(j.dl);
      const unstarted = jobs.filter((j) => j.task === 'motor' && !started.has(j));
      if (unstarted.length) maxDelay = Infinity;
      rM.set(String(misses.length)); rM.setClass(misses.length ? 'bad' : 'good');
      rJ.set(isFinite(maxDelay) ? W.fix(maxDelay, 1) + ' ms' : 'never ran'); rJ.setClass(maxDelay > 1 ? 'bad' : 'good');
      rI.set(Math.round(idleT) + ' %'); rI.setClass(idleT < 1 ? 'bad' : '');
      play = 0;
    }
    const c = cv('#w-rtos', 250, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const l = 84, r = c.w - 10, X = (t) => l + (r - l) * t / TEND, rh = 30, top = 12;
      ROWS.forEach(([id, name], k) => { const y = top + k * (rh + 6); txt(x, name, 6, y + rh / 2, { size: 12, color: 'muted' }); x.strokeStyle = col('line'); x.strokeRect(l + 0.5, y + 0.5, r - l, rh); });
      const upto = Math.min(timeline.length, Math.round(play / DT));
      for (let i = 0; i < upto; i++) {
        const k = ROWS.findIndex((rr) => rr[0] === timeline[i]); const y = top + k * (rh + 6);
        x.fillStyle = col(ROWS[k][2]); x.globalAlpha = timeline[i] === 'idle' ? 0.35 : 0.85;
        x.fillRect(X(i * DT), y + 3, X(DT) - X(0) + 0.6, rh - 6);
      }
      x.globalAlpha = 1;
      const ym = top + 1 * (rh + 6);
      for (let r0 = 0; r0 < TEND; r0 += 10) { x.strokeStyle = col('c1'); x.lineWidth = 1; x.beginPath(); x.moveTo(X(r0), ym - 3); x.lineTo(X(r0), ym + rh + 3); x.stroke(); }
      for (const m of misses) if (m <= play) { x.fillStyle = col('bad'); x.beginPath(); x.moveTo(X(m), ym - 4); x.lineTo(X(m) - 6, ym - 12); x.lineTo(X(m) + 6, ym - 12); x.fill(); txt(x, 'miss', X(m), ym + rh + 9, { align: 'center', size: 10, color: 'bad', bold: true }); }
      const ax = top + ROWS.length * (rh + 6) + 6;
      for (let t = 0; t <= TEND; t += 10) txt(x, t + '', X(t), ax + 6, { align: 'center', size: 10, color: 'muted' });
      txt(x, 'ms', r, ax + 20, { align: 'right', size: 10, color: 'muted' });
      x.strokeStyle = col('accent'); x.lineWidth = 2; x.beginPath(); x.moveTo(X(Math.min(play, TEND)), 4); x.lineTo(X(Math.min(play, TEND)), ax - 4); x.stroke();
      txt(x, '↯ button ISR', X(37) + 4, top + 2 + rh / 2, { size: 10, color: 'c4' });
    }
    compute();
    W.anim((dt) => { play += dt * 22; if (play > TEND + 30) play = 0; draw(); }, c.canvas);
  })();

  /* =====================================================================
   * Figure 7.10 — battery life calculator
   * ===================================================================== */
  (function () {
    let cap = 1000, Is = 0.01, Ia = 80, ta = 2, T = 600; // mAh, mA, mA, s, s
    const avg = (TT) => { TT = Math.max(TT, ta); return (Ia * ta + Is * (TT - ta)) / TT; };
    const days = (TT) => cap / avg(TT) / 24;
    const p = W.plot('#w-batt', { xmin: 1, xmax: 86400, logx: true, ymin: 0.1, ymax: 20000, logy: true, height: 260, xlabel: 'wake-up interval (s)', ylabel: 'battery life (days)', hover: true, xunit: 's', xfmt: (v) => (v >= 3600 ? W.fix(v / 3600, 1) + ' h' : v >= 60 ? W.fix(v / 60, 1) + ' min' : v + ' s'), yfmt: (v) => W.tick(v) });
    p.draw((p) => {
      p.hline(365, { color: 'c3' }); p.text(1.3, 365 * 1.45, '1 year', { color: 'c3', size: 11 });
      p.hline(cap / Is / 24, { color: 'muted', dash: [2, 4] }); p.text(1.3, cap / Is / 24 * 0.62, 'sleep-current limit', { color: 'muted', size: 11 });
      p.fn(days, { color: 'c1', label: 'life', hoverFmt: (x, y) => `every ${W.si(x, 's', 3)}: ${W.si(y, '', 3)} days` });
      p.point(T, days(T), { color: 'c2', r: 6 });
    });
    const ctl = W.$('#c-batt');
    W.slider(ctl, { label: 'Capacity', min: 100, max: 5000, step: 50, value: cap, format: (v) => v + ' mAh', onInput: (v) => { cap = v; upd(); } });
    const sIs = W.slider(ctl, { label: 'Sleep current', min: 0.001, max: 20, log: true, value: Is, format: (v) => W.si(v / 1000, 'A', 2), onInput: (v) => { Is = v; upd(); } });
    W.segmented(ctl, { options: [['mod', 'Bare module (10 µA)'], ['dev', 'Dev board (5 mA)']], value: 'mod', onChange: (v) => { sIs.set(v === 'mod' ? 0.01 : 5); } });
    W.slider(ctl, { label: 'Active current', min: 5, max: 300, step: 1, value: Ia, format: (v) => v + ' mA', onInput: (v) => { Ia = v; upd(); } });
    W.slider(ctl, { label: 'Active time', min: 0.01, max: 10, log: true, value: ta, format: (v) => W.si(v, 's', 2), onInput: (v) => { ta = v; upd(); } });
    W.slider(ctl, { label: 'Wake every', min: 1, max: 86400, log: true, value: T, format: (v) => (v >= 3600 ? W.fix(v / 3600, 1) + ' h' : v >= 60 ? W.fix(v / 60, 1) + ' min' : W.fix(v, 1) + ' s'), onInput: (v) => { T = v; upd(); } });
    const rA = W.readout(ctl, { label: 'Average current', unit: 'A' }), rL = W.readout(ctl, { label: 'Battery life' });
    function upd() {
      rA.set(avg(T) / 1000); const d = days(T);
      rL.set(d >= 365 ? W.fix(d / 365, 2) + ' years' : W.fix(d, 1) + ' days'); rL.setClass(d >= 365 ? 'good' : '');
      p.update();
      if (d >= 365 && cap <= 1000 && Ia >= 79.5 && ta >= 1.95) Book.solve('batt-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 7.11 — BLE advertising and scanning
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-adv');
    let advInt = 100, duty = 0.3; const SI = 100;
    W.slider(ctl, { label: 'Advertising interval', min: 20, max: 1000, log: true, value: advInt, format: (v) => Math.round(v) + ' ms', onInput: (v) => { advInt = v; } });
    W.slider(ctl, { label: 'Scan duty', min: 0.05, max: 1, step: 0.05, value: duty, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => { duty = v; } });
    const rD = W.readout(ctl, { label: 'Avg time to discover' }), rA = W.readout(ctl, { label: 'Advertiser current*' }), rS = W.readout(ctl, { label: 'Scanner current*' });
    const WIN = 1000;
    let t = 0, nextAdv = 0, searchStart = 0, found = [];
    const pk = [], hits = [];
    const chOf = (tt) => [37, 38, 39][Math.floor(tt / SI) % 3];
    const scanning = (tt, ch) => chOf(tt) === ch && (tt % SI) < duty * SI;
    function step(T) {
      while (nextAdv <= T) {
        for (let k = 0; k < 3; k++) {
          const tp = nextAdv + k * 0.6, ch = 37 + k, ok = scanning(tp, ch);
          pk.push([tp, ch, ok]);
          if (ok && tp >= searchStart) { hits.push(tp); found.push(tp - searchStart); if (found.length > 30) found.shift(); searchStart = tp + 150; }
        }
        nextAdv += advInt + Math.random() * 10;
      }
      while (pk.length && pk[0][0] < T - WIN - 20) pk.shift();
      while (hits.length && hits[0] < T - WIN - 20) hits.shift();
    }
    const c = cv('#w-adv', 200, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const l = 70, r = c.w - 10, X = (tt) => l + (r - l) * (tt - (t - WIN)) / WIN;
      const Y = { 37: 22, 38: 74, 39: 126 }, rh = 40;
      for (const ch of [37, 38, 39]) {
        txt(x, 'ch ' + ch, 8, Y[ch] + rh / 2, { size: 12, bold: true, color: 'muted' });
        txt(x, ch === 37 ? '2402 MHz' : ch === 38 ? '2426 MHz' : '2480 MHz', 8, Y[ch] + rh / 2 + 14, { size: 9.5, color: 'muted' });
        x.strokeStyle = col('line'); x.strokeRect(l + 0.5, Y[ch] + 0.5, r - l, rh);
      }
      x.save(); x.beginPath(); x.rect(l, 0, r - l, c.h); x.clip();
      const s0 = Math.floor((t - WIN) / SI) * SI;
      for (let s = s0; s < t; s += SI) {
        const ch = chOf(s); x.fillStyle = col('c1'); x.globalAlpha = 0.2;
        x.fillRect(X(s), Y[ch] + 2, X(Math.min(s + duty * SI, t)) - X(s), rh - 4);
      }
      x.globalAlpha = 1;
      for (const [tp, ch, ok] of pk) {
        x.fillStyle = col(ok ? 'good' : 'c2'); x.fillRect(X(tp) - 1.5, Y[ch] + 6, 3, rh - 12);
        if (ok && t - tp < 250) { x.save(); x.globalAlpha = 1 - (t - tp) / 250; x.strokeStyle = col('good'); x.lineWidth = 2; x.beginPath(); x.arc(X(tp), Y[ch] + rh / 2, 8 + (t - tp) / 12, 0, 7); x.stroke(); x.restore(); }
      }
      x.restore();
      txt(x, 'shaded = scanner listening · ticks = advertising packets · 1 s of history, half speed', l, c.h - 12, { size: 10.5, color: 'muted' });
    }
    W.anim((dt) => {
      t += dt * 500; step(t); draw();
      const m = found.length ? found.reduce((a, b) => a + b, 0) / found.length : null;
      rD.set(m == null ? '…' : Math.round(Math.max(0, m)) + ' ms');
      rA.set(W.si((15e-6 / (advInt / 1000)) + 2e-6, 'A', 2)); rS.set(W.si(duty * 6e-3, 'A', 2));
    }, c.canvas);
  })();

  /* =====================================================================
   * Figure 7.12 — connection parameters
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-conn');
    let ci = 30, lat = 0, sto = 500, mtu = 23, kp = 2, phy = 1;
    W.slider(ctl, { label: 'Interval', min: 7.5, max: 400, step: 1.25, value: ci, format: (v) => W.fix(v, 2) + ' ms', onInput: (v) => { ci = v; upd(); } });
    W.slider(ctl, { label: 'Peripheral latency', min: 0, max: 20, step: 1, value: lat, format: (v) => String(v), onInput: (v) => { lat = v; upd(); } });
    W.slider(ctl, { label: 'Supervision timeout', min: 100, max: 4000, step: 10, value: sto, format: (v) => v + ' ms', onInput: (v) => { sto = v; upd(); } });
    W.slider(ctl, { label: 'ATT MTU', min: 23, max: 247, step: 1, value: mtu, format: (v) => v + ' B', onInput: (v) => { mtu = v; upd(); } });
    W.slider(ctl, { label: 'Packets / event', min: 1, max: 6, step: 1, value: kp, format: (v) => String(v), onInput: (v) => { kp = v; upd(); } });
    W.segmented(ctl, { options: [[1, '1M PHY'], [2, '2M PHY']], value: phy, onChange: (v) => { phy = v; upd(); } });
    const rT = W.readout(ctl, { label: 'Throughput (notify)' }), rL = W.readout(ctl, { label: 'Worst command latency' }), rI = W.readout(ctl, { label: 'Idle current*' }), rS = W.readout(ctl, { label: 'Streaming current*' }), rV = W.readout(ctl, { label: 'Timeout rule' });
    let kEff = 1;
    function model() {
      const ll = Math.min(251, mtu + 4), tp = ((ll + 10) * 8) / (phy * 1e3) + 0.15 + (80 / phy) / 1000 + 0.15; // ms per data+ack exchange
      kEff = Math.max(1, Math.min(kp, Math.floor((ci - 0.5) / tp)));
      const thr = kEff * (mtu - 3) * 8 / (ci / 1000);
      const q0 = 5e-6, irad = 6e-3, isl = 2e-6;
      const idle = isl + q0 / ((1 + lat) * ci / 1000);
      const stream = isl + (q0 + kEff * tp / 1000 * irad) / (ci / 1000);
      return { thr, idle, stream, latency: (1 + lat) * ci, minTo: 2 * (1 + lat) * ci };
    }
    const c = cv('#w-conn', 150, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const l = 86, r = c.w - 10, win = Math.max(150, ci * (1 + lat) * 3.2), X = (t) => l + (r - l) * t / win;
      const yc = 20, yp = 82, h = 34;
      txt(x, 'central', 8, yc + h / 2, { size: 12, color: 'muted' }); txt(x, 'peripheral', 8, yp + h / 2, { size: 12, color: 'muted' });
      x.strokeStyle = col('line'); x.beginPath(); x.moveTo(l, yc + h); x.lineTo(r, yc + h); x.moveTo(l, yp + h); x.lineTo(r, yp + h); x.stroke();
      const pw = Math.max(2, X(0.4 * kEff + 0.4) - X(0));
      for (let k = 0, t = 0; t < win; k++, t = k * ci) {
        x.fillStyle = col('c1'); x.fillRect(X(t), yc + 6, pw, h - 6);
        const listens = k % (1 + lat) === 0;
        if (listens) { x.fillStyle = col('c3'); x.fillRect(X(t), yp + 6, pw, h - 6); }
        else { x.strokeStyle = col('muted'); x.setLineDash([2, 3]); x.strokeRect(X(t) + 0.5, yp + 6.5, pw, h - 7); x.setLineDash([]); }
      }
      txt(x, 'solid = awake at that connection event · dashed = skipped (latency) · window ' + Math.round(win) + ' ms', l, c.h - 12, { size: 10.5, color: 'muted' });
    }
    function upd() {
      const m = model();
      rT.set(m.thr >= 1e3 ? W.fix(m.thr / 1e3, 1) + ' kbit/s' : Math.round(m.thr) + ' bit/s');
      rL.set(W.fix(m.latency, 1) + ' ms'); rL.setClass(m.latency <= 20 ? 'good' : m.latency > 100 ? 'bad' : '');
      rI.set(W.si(m.idle, 'A', 2)); rS.set(W.si(m.stream, 'A', 2));
      const ok = sto > m.minTo;
      rV.set(ok ? 'valid (> ' + Math.round(m.minTo) + ' ms)' : 'invalid: needs > ' + Math.round(m.minTo) + ' ms'); rV.setClass(ok ? 'good' : 'bad');
      draw();
      if (ok && m.latency <= 20 && sto <= 250) Book.solve('conn-task');
    }
    upd();
  })();

  /* =====================================================================
   * Figure 7.13 — GATT tree with simulated client
   * ===================================================================== */
  (function () {
    const root = W.$('#w-gatt');
    const S = 'c0de0001-7a1e-4d1b-9b6b-5c0ffee00001', U = (n) => 'c0de000' + n + '-7a1e-4d1b-9b6b-5c0ffee00001';
    let battery = 87, telemOn = false, battOn = false, timer = null, thr = 0;
    const tree = { k: 'prf', name: 'RC car (GATT server)', info: 'A profile is a specification of services, not something on the wire. This "profile" is just the server\'s whole attribute table.', kids: [
      { k: 'svc', name: 'Generic Access', uuid: '0x1800', h: '0x0001', info: 'Mandatory service with the device name and appearance.', kids: [
        { k: 'chr', name: 'Device Name', uuid: '0x2A00', h: '0x0003', props: ['read'], val: () => 'RC-Car', info: 'Readable name, also used in advertising.' }] },
      { k: 'svc', name: 'Battery Service', uuid: '0x180F', h: '0x0010', info: 'A standard SIG service: any BLE app knows how to display it.', kids: [
        { k: 'chr', name: 'Battery Level', uuid: '0x2A19', h: '0x0012', props: ['read', 'notify'], val: () => battery + ' %', raw: () => hex2(battery).slice(2), info: 'One byte, 0–100 %. Readable and notifiable.', kids: [
          { k: 'dsc', name: 'CCCD', uuid: '0x2902', h: '0x0013', cccd: 'batt', info: 'Client Characteristic Configuration Descriptor. Write 01 00 to enable notifications.' }] }] },
      { k: 'svc', name: 'RC Control', uuid: S, h: '0x0020', info: 'Our custom service, with a random 128-bit UUID.', kids: [
        { k: 'chr', name: 'Drive command', uuid: U(2), h: '0x0022', props: ['write without response'], drive: true, info: '4 bytes, little-endian: int16 throttle, int16 steering, each −1000…1000. Write-without-response: the newest command matters, so no ACK and no retries.', kids: [
          { k: 'dsc', name: 'User Description', uuid: '0x2901', h: '0x0023', val: () => '"Drive (thr, steer)"', info: 'Optional human-readable label shown by nRF Connect.' }] },
        { k: 'chr', name: 'Telemetry', uuid: U(3), h: '0x0025', props: ['read', 'notify'], info: 'Battery mV (uint16), speed (int16), RSSI (int8), flags (uint8). Notified once a second when subscribed.', kids: [
          { k: 'dsc', name: 'CCCD', uuid: '0x2902', h: '0x0026', cccd: 'telem', info: 'Write 01 00 here to subscribe to telemetry notifications.' }] },
        { k: 'chr', name: 'Failsafe timeout', uuid: U(4), h: '0x0028', props: ['read', 'write'], val: () => '200 ms', raw: () => 'C8 00', info: 'uint16 milliseconds. Acknowledged write: configuration must not be lost.' }] }] };
    const treeEl = W.h('div', { class: 'ch7-tree' });
    const detail = W.h('div', { class: 'ch7-info' });
    const bar = W.h('div', { class: 'w-controls' });
    const logEl = W.h('div', { class: 'ch7-log' });
    root.append(W.h('div', { class: 'w-grid2', style: 'align-items:start' }, treeEl, W.h('div', {}, detail, bar)), logEl);
    let selEl = null;
    const lines = [];
    function log(cls, s) { lines.push([cls, s]); while (lines.length > 40) lines.shift(); logEl.innerHTML = lines.map(([c, t]) => `<span class="${c}">${t}</span>`).join('\n'); logEl.scrollTop = logEl.scrollHeight; }
    function build(n) {
      const lbl = { prf: 'profile', svc: 'service', chr: 'char', dsc: 'desc' }[n.k];
      const b = W.h('button', { class: 'ch7-node', type: 'button' }, W.h('span', { class: 'k ' + n.k }, lbl), n.name);
      b.addEventListener('click', () => { if (selEl) selEl.classList.remove('sel'); selEl = b; b.classList.add('sel'); show(n); });
      const li = W.h('li', {}, b);
      if (n.kids) { const ul = W.h('ul'); n.kids.forEach((k) => ul.append(build(k))); li.append(ul); }
      return li;
    }
    treeEl.append(W.h('ul', {}, build(tree)));
    function show(n) {
      detail.innerHTML = `<b>${n.name}</b>` + (n.uuid ? `<br>UUID <code>${n.uuid}</code>` : '') + (n.h ? ` · handle <code>${n.h}</code>` : '') + (n.props ? `<br>Properties: ${n.props.join(', ')}` : '') + `<br>${n.info}`;
      bar.innerHTML = '';
      if (n.props && n.props.includes('read')) W.button(bar, 'Read', () => { log('tx', `→ ATT Read Request, handle ${n.h}`); log('rx', `← ATT Read Response: ${n.raw ? n.raw() + ' ' : ''}(${n.val ? n.val() : 'telemetry bytes'})`); });
      if (n.drive) {
        W.button(bar, 'Write: full ahead', () => { thr = 1000; log('tx', `→ ATT Write Command (no response), handle ${n.h}: E8 03 00 00  (thr 1000, steer 0)`); });
        W.button(bar, 'Write: stop', () => { thr = 0; log('tx', `→ ATT Write Command (no response), handle ${n.h}: 00 00 00 00`); });
      }
      if (n.props && n.props.includes('write') && !n.drive) W.button(bar, 'Write 250 ms', () => { log('tx', `→ ATT Write Request, handle ${n.h}: FA 00`); log('rx', '← ATT Write Response'); });
      if (n.cccd) {
        const on = n.cccd === 'telem' ? telemOn : battOn;
        W.button(bar, on ? 'Disable notifications' : 'Enable notifications', () => {
          const v = !on; if (n.cccd === 'telem') telemOn = v; else battOn = v;
          log('tx', `→ ATT Write Request, handle ${n.h} (CCCD): ${v ? '01 00' : '00 00'}`); log('rx', '← ATT Write Response');
          if (v && n.cccd === 'telem') Book.solve('gatt-task');
          ensureTimer(); show(n);
        });
      }
      if (n.props && n.props.includes('notify') && !n.cccd) detail.innerHTML += '<br><i>To subscribe, select its CCCD descriptor.</i>';
    }
    function ensureTimer() {
      if ((telemOn || battOn) && !timer) timer = setInterval(tick, 1000);
      if (!telemOn && !battOn && timer) { clearInterval(timer); timer = null; }
    }
    function tick() {
      if (thr) battery = Math.max(5, battery - 1);
      const mv = 7000 + battery * 14, spd = Math.round(thr * 1.8), rssi = -55 - Math.round(Math.random() * 8);
      const b = (v, n) => { const out = []; for (let i = 0; i < n; i++) out.push(((v >> (8 * i)) & 0xFF).toString(16).toUpperCase().padStart(2, '0')); return out.join(' '); };
      if (telemOn) log('rx', `← Handle Value Notification 0x0025: ${b(mv, 2)} ${b(spd & 0xFFFF, 2)} ${b(rssi & 0xFF, 1)} 00  (${mv} mV, speed ${spd}, ${rssi} dBm)`);
      if (battOn) log('rx', `← Handle Value Notification 0x0012: ${hex2(battery).slice(2)}  (${battery} %)`);
    }
    detail.innerHTML = 'Click a node in the tree.';
    log('rx', '// connected: MTU 23 (20-byte payloads), interval 15 ms');
  })();

  /* =====================================================================
   * Figure 7.14 — RSSI vs distance
   * ===================================================================== */
  (function () {
    const RADIOS = { ble: ['BLE 1M, −97 dBm', -97], coded: ['BLE Coded, −105 dBm', -105], wifi: ['ESP-NOW 1M, −98 dBm', -98], wifiFast: ['Wi-Fi 65M, −72 dBm', -72] };
    const LOSS = { hand: ['Hand on antenna', 8], body: ['Body in the path', 15], keep: ['Copper under antenna', 8], metal: ['Metal enclosure', 30] };
    let ptx = 3, n = 2, radio = 'ble';
    const on = {};
    const extra = () => Object.keys(LOSS).reduce((a, k) => a + (on[k] ? LOSS[k][1] : 0), 0);
    const rssi = (d, e = extra()) => ptx - (40 + 10 * n * Math.log10(d)) - e;
    const range = () => Math.pow(10, (ptx - extra() - 40 - (RADIOS[radio][1] + 10)) / (10 * n));
    const p = W.plot('#w-rssi', { xmin: 0.5, xmax: 2000, logx: true, ymin: -120, ymax: 0, height: 260, xlabel: 'distance (m)', ylabel: 'RSSI (dBm)', hover: true, xunit: 'm', yunit: 'dBm', yfmt: (v) => String(Math.round(v)) });
    p.draw((p) => {
      const s = RADIOS[radio][1];
      p.area(() => s, 0.5, 2000, { color: 'c4', alpha: 0.08 }, () => -120);
      p.hline(s, { color: 'c4' }); p.hline(s + 10, { color: 'c2' });
      p.text(1800, s - 4, 'sensitivity', { align: 'right', color: 'c4', size: 11 });
      p.text(1800, s + 14, '+10 dB fade margin', { align: 'right', color: 'c2', size: 11 });
      if (extra()) p.fn((d) => rssi(d, 0), { color: 'muted', dash: [5, 4], width: 1.5, label: 'no extra losses', hover: false });
      p.fn((d) => rssi(d), { color: 'c1', label: 'with selected losses', hoverFmt: (x, y) => `${W.si(x, 'm', 3)}: ${Math.round(y)} dBm` });
      const R = range(); if (R > 0.5 && R < 2000) p.point(R, RADIOS[radio][1] + 10, { color: 'c2', r: 5 });
    });
    const ctl = W.$('#c-rssi');
    W.select(ctl, { label: 'Receiver', options: Object.keys(RADIOS).map((k) => [k, RADIOS[k][0]]), value: radio, onChange: (v) => { radio = v; upd(); } });
    W.slider(ctl, { label: 'TX power', min: -12, max: 20, step: 1, value: ptx, format: (v) => (v > 0 ? '+' : '') + v + ' dBm', onInput: (v) => { ptx = v; upd(); } });
    W.slider(ctl, { label: 'Path-loss exponent \\(n\\)', min: 2, max: 4, step: 0.1, value: n, format: (v) => W.fix(v, 1), onInput: (v) => { n = v; upd(); } });
    for (const k in LOSS) W.toggle(ctl, { label: LOSS[k][0] + ' (−' + LOSS[k][1] + ' dB)', value: false, onChange: (v) => { on[k] = v; upd(); } });
    const rR = W.readout(ctl, { label: 'Usable range' });
    function upd() { const R = range(); rR.set(R >= 1000 ? W.fix(R / 1000, 2) + ' km' : W.fix(R, R < 10 ? 1 : 0) + ' m'); rR.setClass(R < 10 ? 'bad' : 'good'); p.update(); }
    upd();
  })();

  /* =====================================================================
   * Figure 7.15 — failsafe simulator
   * ===================================================================== */
  (function () {
    const ctl = W.$('#c-fs');
    let loss = 0.2, tout = 100, alive = true; const PI = 20, V = 2; // ms, m/s
    W.slider(ctl, { label: 'Packet loss', min: 0, max: 0.6, step: 0.01, value: loss, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => { loss = v; upd(); } });
    W.slider(ctl, { label: 'Failsafe timeout', min: 20, max: 1000, step: 10, value: tout, format: (v) => v + ' ms', onInput: (v) => { tout = v; upd(); } });
    const kill = W.button(ctl, '✂ Kill link', () => { alive = !alive; kill.innerHTML = alive ? '✂ Kill link' : '↺ Restore link'; if (!alive) { lostAt = t; travelled = 0; } });
    const rF = W.readout(ctl, { label: 'False trips / hour' }), rD = W.readout(ctl, { label: 'Stopping distance' }), rS = W.readout(ctl, { label: 'State' });
    const WIN = 2000;
    let t = 0, nextPk = 0, lastGood = 0, lostAt = 0, travelled = 0, trips = 0;
    const pk = [], age = [], mot = [];
    function falseRate() { const m = Math.floor(tout / PI); return 3600e3 / PI * (1 - loss) * Math.pow(loss, m); }
    function upd() {
      const f = falseRate();
      rF.set(f >= 100 ? Math.round(f).toLocaleString() : f >= 0.01 ? W.fix(f, 2) : f.toExponential(1)); rF.setClass(f < 0.1 ? 'good' : 'bad');
      const d = V * tout / 1000; rD.set(W.fix(d, 2) + ' m'); rD.setClass(d <= 0.5 ? 'good' : 'bad');
      if (Math.abs(loss - 0.2) < 0.011 && f < 0.1 && d <= 0.5) Book.solve('fs-task');
    }
    function step(T) {
      while (nextPk <= T) {
        const ok = alive && Math.random() >= loss;
        pk.push([nextPk, ok]); if (ok) lastGood = nextPk;
        nextPk += PI;
      }
      const a = T - lastGood, fs = a > tout;
      age.push([T, a]); mot.push([T, fs ? 0 : 1]);
      if (fs && mot.length > 1 && mot[mot.length - 2][1] === 1 && alive) trips++;
      if (!alive && !fs) travelled = V * (T - lostAt) / 1000;
      while (pk.length && pk[0][0] < T - WIN - PI) pk.shift();
      while (age.length && age[0][0] < T - WIN) age.shift();
      while (mot.length && mot[0][0] < T - WIN) mot.shift();
      rS.set(fs ? (alive ? 'FAILSAFE (false trip)' : 'FAILSAFE: motors off') : 'driving'); rS.setClass(fs ? 'bad' : 'good');
    }
    const c = cv('#w-fs', 250, () => draw());
    function draw() {
      const x = c.ctx; clear(c);
      const l = 96, r = c.w - 10, X = (tt) => l + (r - l) * (tt - (t - WIN)) / WIN;
      txt(x, 'packets', 8, 24, { size: 12, color: 'muted' }); txt(x, 'command age', 8, 100, { size: 12, color: 'muted' }); txt(x, 'motors', 8, 196, { size: 12, color: 'muted' });
      x.save(); x.beginPath(); x.rect(l, 0, r - l, c.h); x.clip();
      for (const [tp, ok] of pk) { x.fillStyle = col(ok ? 'good' : 'bad'); x.fillRect(X(tp) - 1.5, ok ? 14 : 20, 3, ok ? 20 : 8); }
      const ymax = Math.max(tout * 1.6, 120), Ya = (v) => 150 - 95 * Math.min(1, v / ymax);
      x.strokeStyle = col('line'); x.strokeRect(l + 0.5, 55.5, r - l, 95);
      x.save(); x.setLineDash([5, 4]); x.strokeStyle = col('c4'); x.beginPath(); x.moveTo(l, Ya(tout)); x.lineTo(r, Ya(tout)); x.stroke(); x.restore();
      x.strokeStyle = col('c1'); x.lineWidth = 2; x.beginPath(); age.forEach(([tt, a], i) => (i ? x.lineTo(X(tt), Ya(a)) : x.moveTo(X(tt), Ya(a)))); x.stroke();
      x.strokeStyle = col('c3'); x.lineWidth = 2.5; x.beginPath(); mot.forEach(([tt, m], i) => { const y = m ? 180 : 212; i ? x.lineTo(X(tt), y) : x.moveTo(X(tt), y); }); x.stroke();
      x.restore();
      txt(x, 'timeout ' + tout + ' ms', r - 4, Ya(tout) - 9, { align: 'right', size: 11, color: 'c4' });
      txt(x, 'on', l - 6, 180, { align: 'right', size: 10, color: 'muted' }); txt(x, 'off', l - 6, 212, { align: 'right', size: 10, color: 'muted' });
      if (!alive) txt(x, 'link dead · travelled ' + W.fix(travelled, 2) + ' m at 2 m/s', l + 6, 236, { size: 12, bold: true, color: 'bad' });
      else txt(x, '2 s of history', r, 236, { align: 'right', size: 11, color: 'muted' });
    }
    upd();
    W.anim((dt) => { t += dt * 1000; step(t); draw(); }, c.canvas);
  })();

  /* =====================================================================
   * Figure 7.16 — lab wiring
   * ===================================================================== */
  (function () {
    W.schematic('#w-lab', {
      w: 620, h: 320, title: 'ESP32 BLE RC car: battery, buck, ESP32, DRV8833, motor, servo and battery divider',
      items: [
        { t: 'bat2', id: 'bat', a: [40, 70], b: [40, 120] }, { t: 'text', at: [40, 166], text: '2S LiPo' },
        { t: 'wire', pts: [[40, 70], [40, 50], [85, 50], [85, 78], 'buck.VIN'] }, { t: 'text', at: [62, 38], text: 'VBAT' },
        { t: 'wire', pts: [[40, 120], [40, 135]] }, { t: 'gnd', at: [40, 135] },
        { t: 'ic', id: 'buck', at: [150, 90], left: ['VIN', 'GND'], right: ['5V'], w: 70, pitch: 24 },
        { t: 'text', at: [150, 46], text: 'Buck 5 V' },
        
        { t: 'wire', pts: ['buck.GND', [85, 102], [85, 115]] }, { t: 'gnd', at: [85, 115] },
        { t: 'wire', pts: ['buck.5V', [228, 90], [228, 78]] }, { t: 'vcc', at: [228, 78], label: '5V' },
        { t: 'ic', id: 'esp', at: [300, 190], left: ['5V', 'GPIO34'], right: ['GPIO25', 'GPIO26', 'GPIO27'], bottom: ['GND'], w: 100, pitch: 24 },
        { t: 'text', at: [300, 134], text: 'ESP32' },
        { t: 'wire', pts: ['esp.5V', [220, 178], [220, 162]] }, { t: 'vcc', at: [220, 162], label: '5V' },
        { t: 'gnd', at: [300, 254] },
        { t: 'wire', pts: ['esp.GPIO34', [160, 202]] }, { t: 'dot', at: [160, 202] },
        { t: 'vcc', at: [160, 158], label: 'VBAT' },
        { t: 'R', id: 'r1', a: [160, 158], b: [160, 198], label: '100k' },
        { t: 'wire', pts: [[160, 198], [160, 210]] },
        { t: 'R', id: 'r2', a: [160, 210], b: [160, 255], label: '100k' },
        { t: 'wire', pts: [[160, 255], [160, 265]] }, { t: 'gnd', at: [160, 265] },
        { t: 'wire', pts: [[160, 202], [120, 202], [120, 215]] },
        { t: 'C', id: 'c1', a: [120, 215], b: [120, 250], label: '100 nF', side: -1 },
        { t: 'wire', pts: [[120, 250], [120, 265]] }, { t: 'gnd', at: [120, 265] },
        { t: 'ic', id: 'drv', at: [470, 150], left: ['AIN1', 'AIN2'], right: ['AOUT1', 'AOUT2'], top: ['VM'], bottom: ['GND'], w: 90, pitch: 30 },
        { t: 'text', at: [484, 205], text: 'DRV8833', anchor: 'start' },
        { t: 'vcc', at: [470, 92], label: 'VBAT' },
        { t: 'gnd', at: [470, 208] },
        { t: 'wire', pts: ['esp.GPIO25', [385, 166], [385, 135], 'drv.AIN1'] },
        { t: 'wire', pts: ['esp.GPIO26', [395, 190], [395, 165], 'drv.AIN2'] },
        { t: 'wire', pts: ['drv.AOUT1', [548, 135]] }, { t: 'wire', pts: ['drv.AOUT2', [548, 165]] },
        { t: 'M', id: 'm', a: [548, 135], b: [548, 165], label: 'motor' },
        { t: 'ic', id: 'servo', at: [520, 270], left: ['SIG', '+5V', 'GND'], w: 60, pitch: 18 },
        { t: 'text', at: [520, 226], text: 'servo' },
        { t: 'wire', pts: ['esp.GPIO27', [420, 214], [420, 252], 'servo.SIG'] },
        { t: 'wire', pts: ['servo.+5V', [455, 270]] }, { t: 'text', at: [451, 270], text: '5V', anchor: 'end' },
        { t: 'wire', pts: ['servo.GND', [460, 288], [460, 298]] }, { t: 'gnd', at: [460, 298] },
      ],
    });
  })();
})();
