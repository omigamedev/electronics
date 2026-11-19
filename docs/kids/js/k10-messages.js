/* Level 10 · Secret Messages */
(function () {
  'use strict';
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  const pretty = (code) => code.replace(/\./g, '·').replace(/-/g, '—');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DOT = 220;

  /* ---- Toy 1: blink SOS, and blink your name ---- */
  const svg = K.svg('#t-blink', 300, 150, { title: 'A signal lamp', max: 300 });
  const lamp = K.lamp(svg, 150, 140, { s: 1.2 });
  let busy = false;
  async function blink(sym) {
    const ms = sym === '.' ? DOT : DOT * 3;
    lamp.set(1); K.tone(660, ms / 1000, 'sine', 0.08);
    await sleep(ms);
    lamp.set(0);
    await sleep(DOT);
  }
  (function sos() {
    const out = W.$('#t-blink-out');
    let seq = '';
    const paint = () => { out.innerHTML = (pretty(seq) || '&nbsp;') + '<span class="goal">SOS = ··· ——— ···</span>'; };
    const press = async (sym) => {
      if (busy) return;
      seq = (seq + sym).slice(-12); paint();
      busy = true; await blink(sym); busy = false;
      if (seq.endsWith('...---...')) { K.win('sos', '🆘 S-O-S! Message sent!'); seq = ''; out.innerHTML = '🆘 ✅<span class="goal">You blinked SOS!</span>'; }
    };
    const ctl = W.$('#t-blink-ctl');
    K.btn(ctl, '<b style="font-size:2rem;line-height:1">·</b><small>short</small>', () => press('.'), { cls: 'go', title: 'Short blink' });
    K.btn(ctl, '<b style="font-size:1.6rem;line-height:1">—</b><small>long</small>', () => press('-'), { cls: 'go', title: 'Long blink' });
    K.btn(ctl, '🔄', () => { seq = ''; paint(); }, { title: 'Start again' });
    paint();
  })();

  (function name() {
    const box = W.$('#t-name');
    const ctl = W.$('#t-name-ctl');
    function letters() {
      const n = (Book.state.name || '').toUpperCase().replace(/[^A-Z]/g, '') || 'SPARKY';
      return n.slice(0, 12).split('');
    }
    function paint() {
      box.innerHTML = '';
      letters().forEach((ch) => box.append(W.h('span', {}, ch, W.h('small', {}, pretty(MORSE[ch])))));
    }
    K.btn(ctl, '▶️ Blink my name', async () => {
      if (busy) return;
      busy = true; paint();
      const spans = Array.from(box.children);
      for (let i = 0; i < spans.length; i++) {
        spans.forEach((s) => s.classList.remove('on')); spans[i].classList.add('on');
        for (const sym of MORSE[letters()[i]]) await blink(sym);
        await sleep(DOT * 2);
      }
      spans.forEach((s) => s.classList.remove('on'));
      busy = false;
    }, { cls: 'go', title: 'Blink my name' });
    document.addEventListener('DOMContentLoaded', paint);
    paint();
    box._repaint = paint;
  })();

  /* ---- Toy 2: counting with on/off bulbs ---- */
  (function bits() {
    const svg2 = K.svg('#t-bits', 400, 230, { title: 'Four bulbs worth 8, 4, 2 and 1 dots', max: 440 });
    const vals = [8, 4, 2, 1], on = [false, false, false, false];
    const total = K.text(svg2, 200, 22, '', { size: 24, weight: 700 });
    const lamps = vals.map((v, i) => {
      const x = 55 + i * 97;
      const L = K.lamp(svg2, x, 150, { s: 0.72 });
      // dots
      const cols = v === 8 ? 4 : v;
      for (let k = 0; k < v; k++) {
        const r = Math.floor(k / cols), c = k % cols;
        K.add(svg2, 'circle', { cx: x - (Math.min(cols, v) - 1) * 7 + c * 14, cy: 178 + r * 14, r: 5, style: 'fill:var(--c5)' });
      }
      const hit = K.add(svg2, 'rect', { x: x - 44, y: 60, width: 88, height: 165, rx: 14, style: 'fill:transparent;cursor:pointer' });
      hit.addEventListener('click', () => { on[i] = !on[i]; K.tone(on[i] ? 700 : 350, 0.08, 'triangle'); update(); });
      return L;
    });
    function update() {
      lamps.forEach((L, i) => L.set(on[i] ? 1 : 0));
      const n = vals.reduce((s, v, i) => s + (on[i] ? v : 0), 0);
      total.textContent = n === 5 ? '= 5 🖐️' : '= ' + n;
      if (n === 5) K.win('five', '🖐️ Five! Binary whiz!');
    }
    update();
  })();

  /* ---- Toy 3: Bluetooth whisper ---- */
  (function bt() {
    const s = K.svg('#t-bt', 400, 200, { title: 'A phone and headphones', max: 440 });
    K.emoji(s, 70, 110, '📱', 76);
    const hp = K.emoji(s, 330, 110, '🎧', 76);
    const waves = K.g(s, { style: 'pointer-events:none' });
    const arcs = Array.from({ length: 4 }, () => K.add(waves, 'path', { style: 'fill:none;stroke:var(--c5);stroke-width:5;stroke-linecap:round' }));
    const notes = Array.from({ length: 4 }, (_, i) => K.emoji(s, 330, 60, ['🎵', '🎶', '🎵', '🎶'][i], 26));
    const label = K.text(s, 200, 185, '', { size: 17 });
    let state = 0, t0 = 0; // 0 off, 1 connecting, 2 connected
    const ctl = W.$('#t-bt-ctl');
    const b = K.btn(ctl, '🔗 Connect', () => {
      if (state === 0) { state = 1; t0 = 0; b.innerHTML = '…'; K.tone(500, 0.1); }
      else if (state === 2) { state = 0; b.innerHTML = '🔗 Connect'; }
    }, { cls: 'go', title: 'Connect' });
    W.anim((dt) => {
      t0 += dt;
      arcs.forEach((a, i) => {
        if (!state) { a.style.opacity = 0; return; }
        const p = ((t0 * 0.9 + i / arcs.length) % 1);
        const x = 110 + p * 180, r = 18 + p * 30;
        a.setAttribute('d', `M ${x} ${110 - r} A ${r} ${r} 0 0 1 ${x} ${110 + r}`);
        a.style.opacity = Math.sin(p * Math.PI) * (state === 2 ? 1 : 0.6);
      });
      if (state === 1 && t0 > 1.4) { state = 2; b.innerHTML = '⏹️ Disconnect'; K.tone(880, 0.12, 'triangle'); K.win('pair', '🎧 Connected! 🎵'); }
      notes.forEach((n, i) => {
        if (state !== 2) { n.style.opacity = 0; return; }
        const p = (t0 * 0.5 + i / 4) % 1;
        n.setAttribute('x', 330 + Math.sin(p * 6 + i) * 30 + (i % 2 ? 20 : -20)); n.setAttribute('y', 60 - p * 50);
        n.style.opacity = Math.sin(p * Math.PI);
      });
      hp.setAttribute('y', 110 + (state === 2 ? Math.sin(t0 * 8) * 2 : 0));
      label.textContent = state === 2 ? '📶 Connected! Playing music' : state === 1 ? '📶 Whispering…' : 'Not connected';
    }, s);
  })();

  /* ---- Diploma ---- */
  (function diploma() {
    const sv = K.svg('#dip-sparky', 140, 120, { title: 'Sparky', max: 140 });
    K.sparky(sv, 70, 70, 38);
    K.emoji(sv, 70, 16, '🎓', 34);
    const d = new Date();
    W.$('#dip-date').textContent = '📅 ' + d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const inp = W.$('#dip-name');
    document.addEventListener('DOMContentLoaded', () => { inp.value = Book.state.name || ''; });
    inp.addEventListener('input', () => { Book.setName(inp.value.trim()); const box = W.$('#t-name'); if (box._repaint) box._repaint(); });
    W.$('#dip-print').addEventListener('click', () => { Book.confetti(); setTimeout(() => window.print(), 300); });
  })();
})();
