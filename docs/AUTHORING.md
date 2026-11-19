# Authoring guide — Sparks & Circuits

A static site (GitHub Pages serves `docs/`). There's no build step, no frameworks and no CDNs; KaTeX is vendored in `assets/vendor/katex`.

- Adult book: `docs/book/<id>.html` + `docs/book/js/<id>.js`
- Kids' book: `docs/kids/<id>.html` + `docs/kids/js/<id>.js`
- Chapter ids/titles are registered in `assets/js/book.js` (`BOOKS`). Don't rename them.
- **Reference implementation:** `docs/book/ch00-lab.html` + `docs/book/js/ch00-lab.js`. Copy its structure.
- **Check your page:** `node tools/check.js /tmp/out book/ch01-physics.html` reports JS errors, unrendered math and horizontal overflow, and saves screenshots (view them!).

## Page skeleton

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>1 · How Current Really Flows — Sparks & Circuits</title>
<link rel="stylesheet" href="../assets/vendor/katex/katex.min.css">
<link rel="stylesheet" href="../assets/css/book.css">
</head>
<body data-book="adult" data-chapter="ch01-physics">   <!-- kids: data-book="kid" -->
<main class="chapter">                                 <!-- kids: class="chapter cards" -->
  <header class="chapter-head"><p class="kicker">Chapter 1</p><h1>…</h1><p class="lede">…</p></header>
  <section><h2 id="charge">…</h2> … </section>
</main>
<script src="../assets/vendor/katex/katex.min.js"></script>
<script src="../assets/vendor/katex/auto-render.min.js"></script>
<script src="../assets/js/widgets.js"></script>
<script src="../assets/js/book.js"></script>
<script src="js/ch01-physics.js"></script>
</body></html>
```
Kids' pages also add the Fredoka font in `<head>`:
`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap">`

Chapter scripts run synchronously **before** `book.js` initialises, so build widgets directly at top level (wrap in an IIFE). Exercises that a script creates dynamically are picked up automatically, and math in slider labels is rendered.

## Content blocks (CSS classes)
- Math: inline `\( V = IR \)`, display `$$ … $$` or `\[ … \]`. Never use single `$`.
- Key formula: `<div class="formula">$$…$$<p>caption</p></div>`
- Callouts: `<aside class="callout physics|math|dev|warn|tip|lab|ref|myth"><span class="ct">⚛️ Title</span>…</aside>`
- Collapsible deep dive: `<details class="deep"><summary>Derivation: …</summary>…</details>`
- Widget figure: `<figure class="widget [wide]"><div id="w-x"></div><figcaption><b>Figure 1.3</b> …</figcaption></figure>`
- Two columns: `<div class="w-grid2">…</div>`
- Kids: `<section class="card">` children of `main.cards` are revealed one at a time (the Continue button is disabled until the card's exercises are solved). Also `.big-emoji`, `<div class="speech"><span class="who">⚡</span>Sparky says…</div>`. Each card and exercise gets an automatic 🔊 read-aloud button. Use `data-say="…"` on a card to override the spoken text.

## Exercises
All are `<div class="ex" data-id="unique-in-page" data-kind="…">` with `<div class="q">`, an optional `<div class="hint">` (shown after a wrong try) and `<div class="explain">` (shown when solved).

| kind | markup |
|---|---|
| `mc` | `<ol class="opts"><li>…</li><li data-correct>…</li></ol>` (add class `grid2`/`grid3`, kids `emoji`) |
| `multi` | same, several `data-correct` |
| `num` | `data-answer="0.02" data-tol="2%" data-unit="A"`. Accepts `20m`, `20 mA`, `4.7k`, `1e-3`. Tol `5%` or absolute `0.1`. Optional `data-show="20 mA"` |
| `text` | `data-answer="ground|gnd"` (case/space-insensitive alternatives) |
| `order` | `<ol class="items">` in the **correct** order (it gets shuffled) |
| `sort` | `<div class="bins"><div data-bin="a">Label</div>…</div><ul class="items"><li data-bin="a">…</li>…</ul>` |
| `task` | goal completed by your widget code: call `Book.solve('data-id')` |

Optional `data-xp="20"`. Kids get auto-check on tap for `mc`.

## Widget API (`window.W`)
```js
W.h(tag, attrs, ...children)            // create DOM
W.si(0.0123,'A') → "12.3 mA";  W.parseSI('4.7k') → 4700;  W.fix(v, d)
W.col('c1'..'c6' | 'ink'|'muted'|'accent'|'good'|'bad'|'wire')   // theme colours
const ctl = W.controls('#w-x');                       // flex row for controls
const s = W.slider(ctl, {label:'\\(R\\)', min, max, step, value, unit:'Ω', log:true, format:v=>…, onInput:v=>…}); s.get(); s.set(v)
const r = W.readout(ctl, {label:'I', unit:'A'}); r.set(0.01); r.setClass('good'|'bad'|'')
W.button(ctl, 'Reset', fn); W.toggle(ctl,{label, value, onChange}); W.select(ctl,{label, options:[[v,t]], value, onChange}); W.segmented(ctl,{options:[[v,t]], value, onChange})

// Plot: axes, grid, log axes, legend, hover readout; redraws on resize/theme
const p = W.plot('#w-x', {xmin, xmax, ymin, ymax, logx, logy, xlabel, ylabel, height:260, hover:true, xunit:'s', yunit:'V', scope:false});
p.draw(p => { p.fn(x=>…, {color:'c1', label:'V_C', dash:[6,4], width}); p.line([[x,y],…], {color}); p.area(f, x0, x1, {color, alpha}, g);
              p.point(x,y,{color,label}); p.vline(x); p.hline(y); p.text(x,y,'str',{color, align}); });
p.set({ymax: 5}).update();   // call update() after state changes (draw callback reads your variables)
// scope:true gives an oscilloscope look (dark green)

// Free canvas for custom animations (DPR-aware, CSS-pixel coordinates):
const c = W.canvas('#w-x', {height: 260, onResize: st => …}); // c.ctx, c.w, c.h
W.anim((dt, t) => { … }, c.canvas);   // RAF loop, auto-pauses offscreen. returns {start, stop}

// Schematic (SVG). Coordinates in px, viewBox w×h; ~20px grid works well.
const sch = W.schematic('#w-x', {w:420, h:220, items:[
  {t:'V', id:'bat', a:[60,80], b:[60,150], label:'9 V'},     // a = + terminal (V, Vdc, bat2), anode for diodes
  {t:'R', id:'r1', a:[100,40], b:[200,40], label:'R1 1 kΩ'},  // two-terminal parts: a→b, any angle
  {t:'wire', pts:[[60,80],[60,40],[100,40]]},
  {t:'nmos', id:'q1', at:[300,120], label:'Q1'},               // pins: 'q1.G','q1.D','q1.S'
  {t:'wire', pts:['q1.S',[315,170]]}, {t:'gnd', at:[315,170]},
]});
```
Two-terminal types: `R C Cpol L V bat2 Vdc Vac Vsq I D Z S(Schottky) LED SW(clickable toggle) PB(push button) lamp fuse M A Vm spk xtal pot open`.
Options: `label`, `side:-1` (flip label side), `color` (LED/lamp), `closed`, `onToggle(closed)`. Pins `id.a`, `id.b` (pot: `id.w`).
Placed types (`at:[x,y]`): `gnd vcc(label) dot text(text, anchor) tag(text — rounded readout box) nmos pmos npn pnp opamp(pins +,-,out; power:true adds V+,V-; plusTop) ic(name, left:[…], right:[…], top, bottom, w)`.
Pin geometry: MOSFET/BJT G/B at (x−30,y), top pin (x+15,y−30), bottom (x+15,y+30); NMOS D top/S bottom; PMOS S top/D bottom; NPN C top/E bottom; PNP E top/C bottom. Opamp − at (x−50,y−15), + at (x−50,y+15), out (x+54,y).
Annotation arrow: `{t:'arrow', a, b, label:'I', color:'c4'}`.

```js
sch.set(id, {label, text, glow:0..1, closed, hidden, stroke:'c4', spin: revPerSec /* motor M */});
const f = sch.flow([[x,y],…], {speed:1, spacing:18, electrons:false, color}); f.set(speed)  // animated charge dots; repeat first point to close a loop. speed 0 → hidden
sch.pin('q1.D') → [x,y];  sch.parts[id].it  // the item (e.g. .closed)
```

DC solver (MNA, with piecewise-linear diodes):
```js
const s = W.solveDC([
  {name:'V1', type:'V', n:['vin','0'], value:5},            // n[0] is +. s.i.V1 = current delivered
  {name:'R1', type:'R', n:['vin','out'], value:1000},       // s.i.R1 = current n0→n1
  {name:'D1', type:'D', n:['out','0'], vf:0.7, rs:1},       // anode, cathode
  {name:'I1', type:'I', n:['0','x'], value:1e-3},           // 1 mA flows out of n[1]
]);  s.v.out, s.i.R1
```
A switch is just an R of 1e-3 (closed) or 1e12 (open).

`W.bulb(parent,{size,color}) → {set(0..1)}`, a cartoon bulb (good for kids).

`Book.solve(id)`, `Book.speak(text)`, `Book.confetti()`, `Book.toast(html)`, `Book.sfx.good()/bad()/tap()/win()`, `Book.state.name` (the kid's name).

## Style rules
- Original prose. Synthesize from the classics; don't copy text. Cite sources in a final `callout ref` "Go deeper" box with specific chapters/lectures. Only cite what you are confident exists.
- Intuition first, then the math, then a worked example, then an exercise. Expand the math and physics wherever a developer would otherwise get lost.
- Every widget needs a caption that tells the reader what to try.
- Colours: use the `c1..c6` tokens; never hard-code light-only colours. Check both themes.
- Must work at phone width (380 px): no fixed widths over 360 px except schematics (SVG scales) and tables (they scroll).
