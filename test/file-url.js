// Opens the single HTML file straight from disk (file://), the way a downloaded copy is used.
const { chromium } = require('playwright'); const path = require('path'); const routeCdn = require('./cdn-routes');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 } })).newPage();
  const problems = []; page.on('pageerror', e => problems.push(e.message)); page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  await routeCdn(page, {});
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'query-summit.html'));
  await page.waitForFunction(() => { const b = document.querySelector('.boot .btn-big'); const s = document.querySelector('.load-status'); return (b && !b.disabled) || (s && /could not/.test(s.textContent)); }, null, { timeout: 90000 });
  console.log('file:// status:', await page.textContent('.load-status'), '| mode:', await page.evaluate(() => QS.engine.db.mode), '| storage ok:', await page.evaluate(() => { QS.state.save.persistNow(); return QS.state.save.storageOk; }));
  console.log('problems:', JSON.stringify(problems));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
