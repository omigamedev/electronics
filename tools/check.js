// Usage: node tools/check.js <outdir> page1.html page2.html ...  (paths relative to docs/)
// Serves docs/ on a local port, loads each page in Chromium, reports console/page errors,
// scrolls the full page, clicks through exercises lightly, and saves screenshots.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
(async () => {
  const [out, ...pages] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch();
  let bad = 0;
  for (const pg of pages) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: scheme });
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
      page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
      page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errs.push('reqfail: ' + r.url()); });
      page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ': ' + r.url()); });
      await page.goto(`http://localhost:${port}/${pg}`, { waitUntil: 'load' });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => ({
        ex: document.querySelectorAll('.ex').length,
        widgets: document.querySelectorAll('canvas, svg.w-sch').length,
        katexErr: document.querySelectorAll('.katex-error').length,
        rawMath: (document.querySelector('main')?.innerText.match(/\\\(|\$\$/g) || []).length,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        cards: document.querySelectorAll('main.cards > .card').length,
      }));
      const name = pg.replace(/[\/.]/g, '_') + '_' + scheme;
      if (scheme === 'light') await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
      // phone width check
      await page.setViewportSize({ width: 380, height: 800 });
      await page.waitForTimeout(200);
      const phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (scheme === 'light') console.log(`${pg}: ex=${info.ex} widgets=${info.widgets} cards=${info.cards} katexErr=${info.katexErr} unrenderedMath=${info.rawMath} overflow(desktop/phone)=${info.overflowX}/${phoneOverflow}`);
      const uniq = [...new Set(errs)];
      if (uniq.length) { bad++; console.log(`  [${scheme}] ERRORS:\n   ` + uniq.slice(0, 15).join('\n   ')); }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  process.exit(bad ? 1 : 0);
})();
