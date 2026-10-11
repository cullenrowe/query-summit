// The self-hosted engine path: block the CDN .wasm (as a strict host would) and serve the page under a
// tight Content-Security-Policy. The game must fall back to ./duckdb/ and still run queries.
const { open } = require('./lib');
(async () => {
  const csp = "default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; worker-src blob: 'self'; img-src data: blob:";
  const t = await open({ port: 8124, headers: { 'Content-Security-Policy': csp }, cdn: { blockWasm: true }, file: 'query-summit.html' });
  const { page } = t;
  await page.waitForFunction(() => { const b = document.querySelector('.boot .btn-big'); const s = document.querySelector('.load-status'); return (b && !b.disabled) || (s && /could not load/.test(s.textContent)); }, null, { timeout: 90000 });
  console.log('status:', await page.textContent('.load-status'), '| mode:', await page.evaluate(() => QS.engine.db.mode));
  const r = await page.evaluate(async () => { const r = await QS.engine.db.sandboxRun('SELECT COUNT(*) AS n FROM accounts', 'frostbyte'); return r.status + ' ' + JSON.stringify(r.result && r.result.rows); });
  console.log('query:', r);
  console.log('problems:', JSON.stringify(t.problems.filter(p => !/Content Security Policy|Failed to load resource|net::ERR/.test(p))), '| expected CSP/network notices:', t.problems.length);
  await t.close();
  // And with everything blocked: a clear error and a working Retry button.
  const v = await open({ port: 8126, cdn: { blockAll: true } });
  await v.page.route('**/duckdb/**', r => r.abort());
  await v.page.reload();
  await v.page.waitForFunction(() => /could not/.test((document.querySelector('.load-status') || {}).textContent || ''), null, { timeout: 90000 });
  console.log('offline status:', await v.page.textContent('.load-status'));
  await v.page.click('.load-actions .btn-quiet');
  console.log('offline details:', (await v.page.textContent('.boot .raw')).replace(/\n/g, ' | ').slice(0, 300));
  await v.page.screenshot({ path: 'shots/boot-failed.png' });
  await v.page.unroute('**/duckdb/**'); await v.page.unroute('https://cdn.jsdelivr.net/**'); await require('./cdn-routes')(v.page, {});
  await v.page.click('.load-actions .btn-primary');
  await v.page.waitForFunction(() => { const b = document.querySelector('.boot .btn-big'); return b && !b.disabled; }, null, { timeout: 60000 });
  console.log('after retry:', await v.page.textContent('.load-status'), '| mode', await v.page.evaluate(() => QS.engine.db.mode));
  await v.close();
})().catch(e => { console.error(e); process.exit(1); });
