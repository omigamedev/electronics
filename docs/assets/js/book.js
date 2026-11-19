/* Sparks & Circuits — book engine: navigation, progress, XP/streaks, exercises, cards, read-aloud.
 * Exposes window.Book. Runs its setup on DOMContentLoaded (after all chapter scripts).
 */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => window.W.h(tag, attrs, ...kids);

  /* ---------------- table of contents ---------------- */
  const BOOKS = {
    adult: {
      title: 'Sparks & Circuits',
      tagline: 'Electronics from first principles to your own PCB, for software developers',
      chapters: [
        { id: 'ch00-lab', num: '0', title: 'Your Lab & How to Use This Book', desc: 'Tools, safety, simulators, and a tour of the interactive widgets.' },
        { id: 'ch01-physics', num: '1', title: 'How Current Really Flows', desc: 'Charge, fields, voltage as energy, drift velocity vs. signal speed, where energy travels, capacitance and inductance from physics.' },
        { id: 'ch02-dc', num: '2', title: 'DC Circuit Analysis', desc: 'Kirchhoff, dividers and loading, Thevenin, superposition, nodal analysis, power and ratings, measuring.' },
        { id: 'ch03-ac', num: '3', title: 'Capacitors, Inductors & Frequency', desc: 'RC/RL transients, sinusoids, impedance, filters and Bode plots, decoupling, resonance, PWM.' },
        { id: 'ch04-semis', num: '4', title: 'Diodes, Transistors & Op-Amps', desc: 'Semiconductor physics, diodes, BJTs and MOSFETs as switches, H-bridges, op-amps, datasheets.' },
        { id: 'ch05-power', num: '5', title: 'Power for Robots', desc: 'LiPo and Li-ion, LDOs, buck and boost converters, power budgets, protection, brown-outs, level shifting.' },
        { id: 'ch06-interfaces', num: '6', title: 'Digital Interfaces: GPIO, UART, I²C, SPI', desc: 'Logic levels, push-pull vs open-drain, pull-ups, ADC/PWM, buses, RC protocols, logic analysers.' },
        { id: 'ch07-mcu', num: '7', title: 'Microcontrollers: Arduino, ESP32 & BLE', desc: 'Registers, interrupts and timers, ESP-IDF and FreeRTOS, sleep modes, Bluetooth Low Energy, antennas.' },
        { id: 'ch08-robotics', num: '8', title: 'Motors, Sensors & Control', desc: 'DC, servo, brushless and stepper motors, encoders, IMUs and sensor fusion, PID control.' },
        { id: 'ch09-pcb', num: '9', title: 'Designing Your Own PCB', desc: 'KiCad workflow, ground planes and return paths, decoupling layout, trace widths, DFM, bring-up.' },
        { id: 'appA-math', num: 'A', title: 'Math Toolkit', desc: 'Exponentials, logs and dB, derivatives and integrals by intuition, complex numbers and phasors, vectors.' },
      ],
    },
    kid: {
      title: "Sparky's Circuit Adventure",
      tagline: 'A playful electricity adventure for young explorers (and their grown-ups)',
      chapters: [
        { id: 'k01-sparky', num: '1', emoji: '⚡', title: 'Meet Sparky!', desc: 'What is electricity? Tiny electrons and how to stay safe.' },
        { id: 'k02-circle', num: '2', emoji: '🔁', title: 'The Circle Road', desc: 'Electricity needs a full loop. Switches open and close the road.' },
        { id: 'k03-push', num: '3', emoji: '🔋', title: 'Pushers & Squeezers', desc: 'Batteries push, resistors squeeze. Water-slide electricity!' },
        { id: 'k04-materials', num: '4', emoji: '🥄', title: 'Who Lets Sparky Through?', desc: 'Conductors and insulators sorting game.' },
        { id: 'k05-light', num: '5', emoji: '💡', title: 'Light It Up!', desc: 'Bulbs, colourful LEDs and one-way doors.' },
        { id: 'k06-roads', num: '6', emoji: '🛣️', title: 'One Road or Two?', desc: 'Series and parallel: what happens to the lights?' },
        { id: 'k07-magnets', num: '7', emoji: '🧲', title: 'Magnet Magic & Spinning Motors', desc: 'Magnets, electromagnets and how motors spin wheels.' },
        { id: 'k08-store', num: '8', emoji: '🪣', title: 'Saving Sparks', desc: 'Batteries and capacitors are buckets for energy.' },
        { id: 'k09-robot', num: '9', emoji: '🤖', title: 'The Robot Brain', desc: 'Microcontrollers follow instructions. Program a robot!' },
        { id: 'k10-messages', num: '10', emoji: '📡', title: 'Secret Messages', desc: 'Blinking codes, wires that talk, and invisible Bluetooth whispers.' },
      ],
    },
  };

  const body = document.body;
  const bookKey = body.dataset.book || 'adult';
  const BOOK = BOOKS[bookKey];
  const page = body.dataset.chapter || 'index';
  const isKid = bookKey === 'kid';
  if (isKid) body.classList.add('kid');

  /* ---------------- persistent state ---------------- */
  const KEY = 'sparks-circuits:v1';
  let S = { xp: { adult: 0, kid: 0 }, solved: {}, days: [], sound: true, prog: {}, cards: {}, last: {}, name: '' };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const dstr = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const streak = () => {
    const set = new Set(S.days); const d = new Date();
    if (!set.has(dstr(d))) d.setDate(d.getDate() - 1);
    let n = 0; while (set.has(dstr(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };

  /* ---------------- theme ---------------- */
  try { const t = localStorage.getItem('sc-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  const fireTheme = () => document.dispatchEvent(new Event('themechange'));
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);

  /* ---------------- sound ---------------- */
  let actx = null;
  function tone(freqs, type = 'sine', dur = 0.12, gap = 0.09, vol = 0.12) {
    if (!S.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * gap;
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      });
    } catch (e) { /* ignore */ }
  }
  const sfx = {
    good: () => tone([660, 880, 1320], 'sine', 0.16, 0.08),
    bad: () => tone([180, 140], 'square', 0.14, 0.1, 0.05),
    tap: () => tone([520], 'triangle', 0.05, 0, 0.05),
    win: () => tone([523, 659, 784, 1046, 1318], 'triangle', 0.22, 0.1, 0.1),
  };

  /* ---------------- top bar ---------------- */
  let tbXP, tbStreak, tbBar;
  function topbar() {
    const homeHref = page === 'index' ? '../index.html' : 'index.html';
    const homeLabel = page === 'index' ? '⌂ Home' : (isKid ? '🗺️ Map' : '☰ Contents');
    tbXP = h('b', {}, String(S.xp[bookKey] || 0));
    tbStreak = h('b', {}, String(streak()));
    const soundBtn = h('button', { class: 'tb-btn', type: 'button', title: 'Sound on/off', 'aria-label': 'Toggle sound' }, S.sound ? '🔊' : '🔈');
    soundBtn.addEventListener('click', () => { S.sound = !S.sound; save(); soundBtn.textContent = S.sound ? '🔊' : '🔈'; sfx.tap(); });
    const themeBtn = h('button', { class: 'tb-btn', type: 'button', title: 'Light/dark theme', 'aria-label': 'Toggle theme' }, '◐');
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nxt = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nxt;
      try { localStorage.setItem('sc-theme', nxt); } catch (e) { /* ignore */ }
      fireTheme();
    });
    tbBar = h('i');
    const bar = h('header', { class: 'topbar' },
      h('a', { class: 'tb-home', href: homeHref }, homeLabel),
      h('span', { class: 'tb-title' }, BOOK.title),
      h('div', { class: 'tb-stats' },
        h('span', { class: 'tb-chip', title: 'Day streak: solve at least one exercise every day' }, '🔥 ', tbStreak),
        h('span', { class: 'tb-chip', title: 'Experience points' }, isKid ? '⭐ ' : '⚡ ', tbXP),
        soundBtn, themeBtn),
      h('div', { class: 'tb-progress' }, tbBar));
    body.prepend(bar);
  }

  function toast(msg, cls = '') {
    const t = h('div', { class: 'toast ' + cls, html: msg });
    body.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
  }

  function floatXP(anchor, n) {
    const r = anchor.getBoundingClientRect();
    const f = h('div', { class: 'xp-float', style: `left:${r.left + r.width / 2}px;top:${r.top + window.scrollY}px` }, `+${n} ${isKid ? '⭐' : 'XP'}`);
    body.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  /* ---------------- confetti ---------------- */
  function confetti(n = 140) {
    const cv = h('canvas', { class: 'confetti' });
    body.append(cv);
    const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const cols = ['#f03e3e', '#f59f00', '#37b24d', '#1c7ed6', '#ae3ec9', '#ffd43b'];
    const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0] }));
    const t0 = performance.now();
    (function fr(t) {
      const el = (t - t0) / 1000;
      c.clearRect(0, 0, W, H);
      for (const p of ps) { p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.globalAlpha = Math.max(0, 1 - el / 2.4); c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); }
      if (el < 2.4) requestAnimationFrame(fr); else cv.remove();
    })(t0);
  }

  /* ---------------- speech (kids) ---------------- */
  const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
  function speak(text) {
    if (!('speechSynthesis' in window)) return toast('Read-aloud is not supported in this browser');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(EMOJI, '').replace(/\s+/g, ' ').trim());
    u.rate = isKid ? 0.92 : 1; u.pitch = isKid ? 1.1 : 1;
    const v = speechSynthesis.getVoices().find((v) => /^en(-|_)/i.test(v.lang) && /female|samantha|google us|zira|jenny|aria/i.test(v.name)) || speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  const textOf = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('.katex-mathml, .say-btn, button, .ex-fb, .explain, .hint, script, style').forEach((x) => x.remove());
    return c.textContent;
  };

  /* ---------------- exercises ---------------- */
  const pageXP = () => (isKid ? 5 : 10);
  let exList = [];
  const solvedKey = (ex) => page + ':' + ex.dataset.id;
  function updateProgress() {
    const total = exList.length, done = exList.filter((e) => S.solved[solvedKey(e)]).length;
    if (tbBar) tbBar.style.width = total ? (100 * done / total) + '%' : '0';
    if (total) { S.prog[bookKey + '/' + page] = { s: done, t: total }; save(); }
    return { done, total };
  }
  function award(ex, n) {
    const k = solvedKey(ex);
    const fresh = !S.solved[k];
    S.solved[k] = Date.now();
    const td = dstr(new Date());
    if (!S.days.includes(td)) { S.days.push(td); S.days = S.days.slice(-400); }
    if (fresh && n > 0) { S.xp[bookKey] = (S.xp[bookKey] || 0) + n; floatXP(ex.querySelector('.ex-check') || ex, n); }
    save();
    tbXP.textContent = String(S.xp[bookKey]);
    tbStreak.textContent = String(streak());
    const { done, total } = updateProgress();
    ex.dispatchEvent(new CustomEvent('solved', { bubbles: true }));
    if (fresh && done === total && total > 0) {
      setTimeout(() => { confetti(); sfx.win(); toast(isKid ? '🎉 Level complete! You are a Spark Star! 🌟' : '🎉 Chapter complete! All exercises solved.', 'win'); }, 500);
    }
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const norm = (s) => String(s).toLowerCase().replace(/[\s_,'"²]/g, '').replace(/(?<=[a-z])[-.]|[-.](?=[a-z])/g, '');

  const KINDS = {
    mc(ex, ctx) {
      const opts = Array.from(ex.querySelectorAll(':scope .opts > li'));
      const multi = ex.dataset.kind === 'multi';
      opts.forEach((li) => {
        li.tabIndex = 0; li.setAttribute('role', multi ? 'checkbox' : 'radio');
        const pick = () => {
          if (ex.classList.contains('solved')) return;
          sfx.tap();
          if (!multi) opts.forEach((o) => o.classList.remove('sel'));
          li.classList.toggle('sel', multi ? !li.classList.contains('sel') : true);
          opts.forEach((o) => o.classList.remove('wrong'));
          if (isKid && !multi) ctx.check();
        };
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      });
      return {
        check() {
          const sel = opts.filter((o) => o.classList.contains('sel'));
          if (!sel.length) return null;
          const ok = opts.every((o) => o.hasAttribute('data-correct') === o.classList.contains('sel'));
          if (!ok) sel.filter((o) => !o.hasAttribute('data-correct')).forEach((o) => o.classList.add('wrong'));
          return ok;
        },
        reveal() { opts.forEach((o) => { o.classList.remove('wrong'); o.classList.toggle('sel', o.hasAttribute('data-correct')); if (o.hasAttribute('data-correct')) o.classList.add('right'); }); },
        autoCheck: isKid && !multi,
      };
    },
    num(ex, ctx) {
      const inp = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: ex.dataset.placeholder || (isKid ? 'type a number' : 'e.g. 20m, 4.7k, 0.02') });
      const wrap = h('div', { class: 'ex-input' }, inp, ex.dataset.unit ? h('span', { class: 'unit' }, ex.dataset.unit) : null);
      ex.querySelector('.q').after(wrap);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctx.check(); });
      const ans = parseFloat(ex.dataset.answer);
      const tolS = ex.dataset.tol || '2%';
      return {
        check() {
          if (!inp.value.trim()) return null;
          const v = window.W.parseSI(inp.value);
          if (!isFinite(v)) { ctx.say("I couldn't read that number. Try something like 0.02, 20m or 4.7k."); return null; }
          const tol = tolS.endsWith('%') ? Math.abs(ans) * parseFloat(tolS) / 100 : parseFloat(tolS);
          return Math.abs(v - ans) <= tol + 1e-15;
        },
        reveal() { inp.value = ex.dataset.show || window.W.si(ans, '', 4).trim(); inp.disabled = true; },
      };
    },
    text(ex, ctx) {
      const inp = h('input', { type: 'text', autocomplete: 'off', placeholder: ex.dataset.placeholder || 'your answer' });
      ex.querySelector('.q').after(h('div', { class: 'ex-input' }, inp));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctx.check(); });
      const answers = (ex.dataset.answer || '').split('|').map(norm);
      return {
        check() { if (!inp.value.trim()) return null; return answers.includes(norm(inp.value)); },
        reveal() { inp.value = (ex.dataset.answer || '').split('|')[0]; inp.disabled = true; },
      };
    },
    order(ex) {
      const src = ex.querySelector('.items');
      const items = Array.from(src.children).map((li, i) => { li.dataset.pos = i; li.tabIndex = 0; return li; });
      const bank = h('div', { class: 'ord-bank' }), line = h('div', { class: 'ord-line', 'data-empty': isKid ? 'Tap the pieces in the right order 👇' : 'Tap items in the correct order' });
      src.replaceWith(line, bank);
      shuffle(items.slice()).forEach((li) => bank.append(li));
      if (items.length > 1 && items.every((li, i) => bank.children[i] === li)) bank.append(bank.firstChild);
      items.forEach((li) => {
        const mv = () => { if (ex.classList.contains('solved')) return; sfx.tap(); (li.parentNode === bank ? line : bank).append(li); line.querySelectorAll('li').forEach((x) => x.classList.remove('wrong')); };
        li.addEventListener('click', mv);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mv(); } });
      });
      return {
        check() {
          if (bank.children.length) return null;
          const seq = Array.from(line.children);
          let ok = true;
          seq.forEach((li, i) => { if (+li.dataset.pos !== i) { ok = false; li.classList.add('wrong'); } });
          return ok;
        },
        reveal() { items.forEach((li) => { li.classList.remove('wrong'); line.append(li); }); },
      };
    },
    sort(ex) {
      const pool = ex.querySelector('.items'); pool.classList.add('sort-pool');
      const bins = Array.from(ex.querySelectorAll('.bins > [data-bin]'));
      bins.forEach((b) => { if (!b.querySelector('.bin-drop')) { const lab = h('div', { class: 'bin-label', html: b.innerHTML }); b.innerHTML = ''; b.append(lab, h('ul', { class: 'bin-drop' })); } });
      const items = Array.from(pool.children);
      shuffle(items.slice()).forEach((li) => pool.append(li));
      let picked = null;
      const pick = (li) => { if (ex.classList.contains('solved')) return; sfx.tap(); items.forEach((x) => x.classList.remove('picked')); if (li.parentNode !== pool) { pool.append(li); li.classList.remove('wrong'); picked = null; return; } picked = picked === li ? null : li; if (picked) li.classList.add('picked'); };
      const drop = (b, li) => { li = li || picked; if (!li || ex.classList.contains('solved')) return; sfx.tap(); b.querySelector('.bin-drop').append(li); li.classList.remove('picked', 'wrong'); picked = null; };
      items.forEach((li) => {
        li.tabIndex = 0; li.draggable = true;
        li.addEventListener('click', (e) => { e.stopPropagation(); pick(li); });
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(li); } });
        li.addEventListener('dragstart', (e) => { picked = li; e.dataTransfer.setData('text/plain', ''); });
      });
      bins.forEach((b) => {
        b.tabIndex = 0;
        b.addEventListener('click', () => drop(b));
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter') drop(b); });
        b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('over'); });
        b.addEventListener('dragleave', () => b.classList.remove('over'));
        b.addEventListener('drop', (e) => { e.preventDefault(); b.classList.remove('over'); drop(b); });
      });
      return {
        check() {
          if (pool.children.length) return null;
          let ok = true;
          items.forEach((li) => { const bin = li.closest('[data-bin]'); if (bin.dataset.bin !== li.dataset.bin) { ok = false; li.classList.add('wrong'); } });
          return ok;
        },
        reveal() { items.forEach((li) => { li.classList.remove('wrong', 'picked'); const b = bins.find((b) => b.dataset.bin === li.dataset.bin); if (b) b.querySelector('.bin-drop').append(li); }); },
      };
    },
    task() { return { check: () => null, reveal() {}, noButton: true }; },
  };
  KINDS.multi = KINDS.mc;

  let autoId = 0;
  function setupEx(ex, fresh) {
    if (!ex.dataset.id) ex.dataset.id = 'auto' + (++autoId);
    const kind = ex.dataset.kind || 'mc';
    if (!ex._orig) ex._orig = ex.innerHTML;
    ex.classList.add('ex', 'ex-' + kind);
    if (!ex.querySelector('.q')) { const q = h('div', { class: 'q' }); ex.prepend(q); }
    const badge = h('div', { class: 'ex-badge' }, isKid ? '🎮 Challenge' : ({ mc: 'Quiz', multi: 'Select all that apply', num: 'Calculate', text: 'Answer', order: 'Put in order', sort: 'Sort it', task: 'Interactive goal' }[kind] || 'Exercise'));
    ex.prepend(badge);
    const fb = h('div', { class: 'ex-fb', 'aria-live': 'polite' });
    const foot = h('div', { class: 'ex-foot' });
    const xp = +ex.dataset.xp || pageXP();
    let tries = 0;
    const ctx = {
      say(m, cls = '') { fb.className = 'ex-fb ' + cls; fb.innerHTML = m; },
      check: () => doCheck(),
    };
    const impl = (KINDS[kind] || KINDS.mc)(ex, ctx);
    const btn = h('button', { class: 'btn ex-check', type: 'button' }, isKid ? 'Check! ✔️' : 'Check');
    const showBtn = h('button', { class: 'btn ghost small ex-show', type: 'button', hidden: true }, 'Show answer');
    const retry = h('button', { class: 'btn ghost small ex-retry', type: 'button', title: 'Try this exercise again (no extra XP)' }, '↺ Retry');
    if (!impl.noButton && !impl.autoCheck) foot.append(btn);
    foot.append(showBtn, retry);
    ex.append(fb, foot);
    if (isKid) addSay(ex, () => textOf(ex.querySelector('.q')) + ' ' + Array.from(ex.querySelectorAll('.opts > li')).map((li) => textOf(li)).join('. Or, '));

    const good = isKid ? ['Amazing! 🌟', 'You got it! 🎉', 'Super spark! ⚡', 'Wow, brilliant! 🚀', 'Yes!! 🥳'] : ['Correct!', 'Nice — that\'s right.', 'Exactly.', 'Spot on.', 'Correct ✓'];
    const bad = isKid ? ['Oops! Try again 🙂', 'Almost! Have another go 💪', 'Hmm, not quite. Think again 🤔'] : ['Not quite — try again.', 'Not yet. Look again.', 'Close, but no.'];
    const pickMsg = (a) => a[(Math.random() * a.length) | 0];

    function markSolved(restoring) {
      ex.classList.add('solved'); ex.classList.remove('hinted');
      impl.reveal();
      btn.disabled = true; showBtn.hidden = true;
      if (!restoring) ctx.say('✓ ' + pickMsg(good), 'good');
      else ctx.say('✓ Solved', 'good');
    }
    function doCheck() {
      if (ex.classList.contains('solved')) return;
      const r = impl.check();
      if (r === null) { if (!fb.textContent) ctx.say(kind === 'sort' || kind === 'order' ? 'Place every item first.' : 'Choose or type an answer first.'); return; }
      if (r) { sfx.good(); markSolved(false); ex.classList.add('pop'); setTimeout(() => ex.classList.remove('pop'), 600); award(ex, tries === 0 ? xp : Math.ceil(xp / 2)); }
      else {
        tries++; sfx.bad(); ctx.say('✗ ' + pickMsg(bad), 'bad');
        ex.classList.remove('shake'); void ex.offsetWidth; ex.classList.add('shake');
        if (ex.querySelector('.hint')) ex.classList.add('hinted');
        if (tries >= 2 && kind !== 'task') showBtn.hidden = false;
      }
    }
    btn.addEventListener('click', doCheck);
    showBtn.addEventListener('click', () => { markSolved(false); ctx.say('Here is the answer. Read the explanation, then try the next one!', ''); award(ex, 0); });
    retry.addEventListener('click', () => {
      ex.classList.remove('solved', 'hinted'); ex.innerHTML = ex._orig; ex.className = ex.className.replace(/\bex-\w+\b/g, '');
      setupEx(ex, true); renderMath(ex);
    });
    ex._solve = () => { if (!ex.classList.contains('solved')) { sfx.good(); markSolved(false); award(ex, xp); } };
    if (!fresh && S.solved[solvedKey(ex)]) markSolved(true);
  }

  /** Book.solve(idOrEl) — mark a data-kind="task" exercise as solved (call from widget code) */
  function solve(x) {
    const ex = typeof x === 'string' ? document.querySelector(`.ex[data-id="${x}"]`) : x;
    if (ex && ex._solve) ex._solve();
  }

  /* ---------------- cards mode (Brilliant-style step reveal) ---------------- */
  function setupCards(main) {
    const cards = Array.from(main.querySelectorAll(':scope > .card'));
    if (!cards.length) return;
    const key = bookKey + '/' + page;
    let pos = Math.min(S.cards[key] || 0, cards.length - 1);
    const dots = h('div', { class: 'card-dots' });
    cards.forEach((c, i) => {
      const d = h('button', { type: 'button', class: 'dot', 'aria-label': 'Step ' + (i + 1) });
      d.addEventListener('click', () => { if (i <= pos) cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      dots.append(d);
    });
    main.querySelector('.chapter-head') ? main.querySelector('.chapter-head').after(dots) : main.prepend(dots);
    const paint = () => {
      cards.forEach((c, i) => c.classList.toggle('hidden', i > pos));
      Array.from(dots.children).forEach((d, i) => { d.classList.toggle('on', i <= pos); d.classList.toggle('cur', i === pos); });
      cards.forEach((c, i) => { const b = c.querySelector(':scope > .card-next'); if (b) b.hidden = i !== pos; });
    };
    cards.forEach((c, i) => {
      if (i === cards.length - 1) return;
      const b = h('button', { class: 'btn big card-next', type: 'button' }, isKid ? 'Next ➜' : 'Continue');
      const upd = () => { const pending = Array.from(c.querySelectorAll('.ex')).filter((e) => !e.classList.contains('solved')); b.disabled = pending.length > 0; b.title = b.disabled ? 'Finish the challenge first' : ''; };
      c.addEventListener('solved', upd);
      b.addEventListener('click', () => { sfx.tap(); pos = Math.max(pos, i + 1); S.cards[key] = pos; save(); paint(); setTimeout(() => cards[i + 1].scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); });
      c.append(b);
      setTimeout(upd, 0);
    });
    paint();
  }

  function addSay(el, getText) {
    if (!isKid) return;
    const b = h('button', { class: 'say-btn', type: 'button', title: 'Read it to me', 'aria-label': 'Read aloud' }, '🔊');
    b.addEventListener('click', (e) => { e.stopPropagation(); speak(getText()); });
    el.prepend(b);
  }

  /* ---------------- math ---------------- */
  function renderMath(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false, ignoredClasses: ['nomath'],
      });
    }
  }

  /* ---------------- index pages ---------------- */
  function renderTOC(el) {
    const last = S.last[bookKey];
    if (last && last !== 'index') {
      const c = BOOK.chapters.find((c) => c.id === last);
      if (c) el.before(h('a', { class: 'btn big continue', href: c.id + '.html' }, `Continue: ${c.title} →`));
    }
    const ol = h('ol', { class: 'toc-list' });
    for (const c of BOOK.chapters) {
      const p = S.prog[bookKey + '/' + c.id];
      const pct = p && p.t ? Math.round(100 * p.s / p.t) : 0;
      ol.append(h('li', {}, h('a', { href: c.id + '.html', class: pct === 100 ? 'done' : '' },
        h('span', { class: 'toc-num' }, c.num),
        h('span', { class: 'toc-body' }, h('b', {}, c.title), h('span', { class: 'toc-desc' }, c.desc),
          h('span', { class: 'toc-bar' }, h('i', { style: `width:${pct}%` }))),
        h('span', { class: 'toc-pct' }, pct === 100 ? '✓' : pct ? pct + '%' : ''))));
    }
    el.append(ol);
  }
  function renderLevelMap(el) {
    const wrap = h('div', { class: 'levelmap' });
    let nextFound = false;
    BOOK.chapters.forEach((c, i) => {
      const p = S.prog['kid/' + c.id];
      const done = p && p.t && p.s === p.t;
      const isNext = !done && !nextFound; if (isNext) nextFound = true;
      const stars = p && p.t ? Math.round(3 * p.s / p.t) : 0;
      wrap.append(h('a', { href: c.id + '.html', class: 'lvl' + (done ? ' done' : '') + (isNext ? ' next' : ''), style: `--off:${[0, 1, 2, 1, 0, -1, -2, -1][i % 8]}` },
        h('span', { class: 'lvl-bubble' }, c.emoji),
        h('span', { class: 'lvl-text' }, h('b', {}, `${c.num}. ${c.title}`), h('small', {}, c.desc), h('span', { class: 'lvl-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)))));
    });
    el.append(wrap);
  }

  function chapterNav(main) {
    const i = BOOK.chapters.findIndex((c) => c.id === page);
    if (i < 0) return;
    const prev = BOOK.chapters[i - 1], next = BOOK.chapters[i + 1];
    const nav = h('nav', { class: 'chap-nav' },
      prev ? h('a', { href: prev.id + '.html', class: 'prev' }, h('small', {}, '← Previous'), h('b', {}, (prev.emoji ? prev.emoji + ' ' : '') + prev.title)) : h('span'),
      next ? h('a', { href: next.id + '.html', class: 'next' }, h('small', {}, 'Next →'), h('b', {}, (next.emoji ? next.emoji + ' ' : '') + next.title)) : h('a', { href: 'index.html', class: 'next' }, h('small', {}, 'Finished!'), h('b', {}, isKid ? '🗺️ Back to the map' : 'Back to contents')));
    main.append(nav);
  }

  function inPageToc(main) {
    if (isKid || main.classList.contains('cards')) return;
    const hs = Array.from(main.querySelectorAll(':scope > section > h2, :scope > h2'));
    if (hs.length < 3) return;
    const box = h('nav', { class: 'inpage-toc' }, h('b', {}, 'In this chapter'));
    const ol = h('ol');
    hs.forEach((hh, i) => { if (!hh.id) hh.id = 's' + (i + 1); ol.append(h('li', {}, h('a', { href: '#' + hh.id }, hh.textContent))); });
    box.append(ol);
    const head = main.querySelector('.chapter-head');
    head ? head.after(box) : main.prepend(box);
  }

  /* ---------------- init ---------------- */
  function init() {
    topbar();
    const main = document.querySelector('main') || body;
    renderMath(body);
    if (page !== 'index') { S.last[bookKey] = page; save(); }
    inPageToc(main);
    const toc = document.getElementById('toc'); if (toc) renderTOC(toc);
    const lm = document.getElementById('levelmap'); if (lm) renderLevelMap(lm);
    exList = Array.from(document.querySelectorAll('.ex'));
    exList.forEach((e) => setupEx(e));
    if (isKid) document.querySelectorAll('main .card').forEach((c) => addSay(c, () => c.dataset.say || Array.from(c.querySelectorAll('h1, h2, h3, p, .say, .speech:not(.say)')).filter((x) => !x.closest('.ex')).map(textOf).join('. ')));
    if (main.classList.contains('cards')) setupCards(main);
    chapterNav(main);
    updateProgress();
    window.Book._ready = true;
    // copy buttons on code blocks
    document.querySelectorAll('pre > code').forEach((code) => {
      const b = h('button', { class: 'copy-btn', type: 'button' }, 'Copy');
      b.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(code.textContent); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1200); });
      code.parentNode.append(b);
    });
    // name for kid certificate
    document.querySelectorAll('[data-kid-name]').forEach((el) => { el.textContent = S.name || 'Explorer'; });
  }

  window.Book = {
    books: BOOKS, book: bookKey, page, isKid,
    solve, renderMath, speak, confetti, toast, sfx,
    get state() { return S; },
    setName(n) { S.name = n; save(); document.querySelectorAll('[data-kid-name]').forEach((el) => { el.textContent = n || 'Explorer'; }); },
    reset() { if (confirm('Reset all progress and XP?')) { localStorage.removeItem(KEY); location.reload(); } },
  };
  document.addEventListener('DOMContentLoaded', init);
})();
