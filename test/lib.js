// Shared helpers for the browser tests.
const { chromium } = require('playwright');
const serve = require('./serve'); const routeCdn = require('./cdn-routes');
exports.open = async function (opts = {}) {
  const port = opts.port || 8123;
  const srv = await serve(port, opts.headers);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 375, height: 667 }, deviceScaleFactor: opts.dpr || 2, colorScheme: opts.scheme || 'light', hasTouch: !!opts.touch, reducedMotion: opts.reducedMotion || 'no-preference' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message + (process.env.STACK ? '\n' + e.stack : '')));
  await routeCdn(page, opts.cdn || {});
  const url = 'http://localhost:' + port + '/' + (opts.file || 'query-summit.html');
  await page.goto(url);
  return { page, ctx, browser, srv, problems, url, close: async () => { await browser.close(); srv.close(); } };
};
exports.overflow = page => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
