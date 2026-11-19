# Sparks & Circuits ⚡

An interactive electronics book for software developers who want to build RC and robotics boards (ESP32, Arduino, BLE, I²C/SPI, motors, PCBs), plus **Sparky's Circuit Adventure**, a playful version for young kids.

- 📖 Read online: **https://omigamedev.github.io/electronics/** (once GitHub Pages is enabled; see below)
- 🗺️ Plain-text learning path: [LEARNING_PATH.md](LEARNING_PATH.md)

## Features
- Live, animated circuits with a built-in DC solver, so you can watch the current flow
- Interactive plots (Bode, transients, motor curves…), sliders, and physics simulations
- Formulas rendered with KaTeX (bundled locally, works offline)
- Brilliant/Duolingo-style exercises: multiple choice, numeric with SI prefixes (`4.7k`, `20m`), ordering, sorting, and interactive goals. Includes XP, daily streaks and per-chapter progress, all saved in your browser.
- Kids' edition: step-by-step cards, read-aloud 🔊, games, and a printable diploma
- Light and dark themes; works on phones

## Enable GitHub Pages
The site is plain static files in `docs/`, with no build step.

1. Go to **Settings → Pages** on GitHub.
2. Under *Build and deployment*, set **Source: Deploy from a branch**.
3. Pick the branch (`main` after merging, or the working branch) and the folder **`/docs`**, then click Save.
4. After a minute the site is live at `https://<owner>.github.io/<repo>/`.

(Pages on a private repository requires a paid GitHub plan; on a free plan, make the repo public.)

## Run locally
```sh
cd docs && python3 -m http.server 8000   # open http://localhost:8000
```

## Writing / editing chapters
See [docs/AUTHORING.md](docs/AUTHORING.md) for the page skeleton, exercise markup and widget API.
Check pages for JS errors, unrendered math and mobile overflow with:
```sh
node tools/check.js /tmp/shots book/ch01-physics.html kids/k01-sparky.html
```
(Needs `playwright` with Chromium.)
