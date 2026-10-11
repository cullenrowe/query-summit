// Smaller paths: practice one skill, replay the tutorial, settings survive a reload, hints and stars.
const { open, overflow } = require('./lib');
(async () => {
  const t = await open({ touch: true });
  const { page } = t;
  await page.waitForFunction(() => window.QS && QS.engine.db.status === 'ready', null, { timeout: 60000 });
  // Jump ahead: mark levels 1-3 done and skills met.
  await page.evaluate(() => { const s = QS.state.save.data; s.flags.tutorialDone = true; s.flags.introSeen.w1 = true; ['w1-l1', 'w1-l2', 'w1-l3'].forEach(id => s.levels[id] = { stars: 2, plays: 1, done: 'x' }); QS.state.game.recordStep(['select-star', 'select-cols', 'where-text', 'where-num'], 'shaky'); QS.ui.app.go('skills'); });
  await page.tap('.skill >> nth=2'); await page.waitForSelector('.skill-sheet'); await page.tap('.sheet-actions .btn-primary');
  await page.waitForSelector('.step'); console.log('practice header:', await page.textContent('.lvl-crumb'), '|', await page.textContent('.step-count'));
  // Hints: reveal the whole ladder on Level 4, use the solution, expect 1 star.
  await page.evaluate(() => QS.ui.app.go('level', { id: 'w1-l4' })); await page.waitForSelector('.step-fix');
  for (let i = 0; i < 4; i++) { await page.tap('.hint-btn'); await page.waitForTimeout(80); }
  console.log('hint ladder:', JSON.stringify(await page.$$eval('.hint-kind', els => els.map(e => e.textContent))), '| button hidden:', await page.$eval('.hint-btn', b => b.hidden));
  await page.tap('.hint .btn-ghost'); await page.tap('.run'); await page.waitForSelector('.outcome-pass'); await page.tap('.outcome-pass .btn-primary'); await page.waitForSelector('.cele'); await page.waitForTimeout(900);
  console.log('with solution:', await page.textContent('.cele-why'), '| stars', await page.evaluate(() => QS.state.save.data.levels['w1-l4'].stars), '| xp line:', await page.textContent('.cele-xp'));
  await page.screenshot({ path: 'shots/extras-1star.png' });
  await page.tap('.sheet-actions .btn-ghost');   // Replay for more stars
  await page.waitForSelector('.step-fix'); await page.fill('#qs-sql', "select company_name, seats from accounts where country = 'Canada'"); await page.tap('.run'); await page.waitForSelector('.outcome-pass'); await page.tap('.outcome-pass .btn-primary'); await page.waitForSelector('.cele'); await page.waitForTimeout(900);
  console.log('replay:', await page.textContent('.cele-xp'), '| stars now', await page.evaluate(() => QS.state.save.data.levels['w1-l4'].stars));
  await page.tap('.sheet-actions .btn-quiet'); await page.waitForSelector('.home');
  // Draft survives leaving a level.
  await page.evaluate(() => QS.ui.app.go('level', { id: 'w1-l5' })); await page.waitForSelector('.step-choose');
  // Settings: dark theme + large text, then reload.
  await page.evaluate(() => QS.ui.app.go('settings')); await page.tap('.seg-btn:text-is("Dark")'); await page.tap('.seg-btn:text-is("Large")'); await page.tap('.switch'); await page.waitForTimeout(400);
  await page.reload(); await page.waitForSelector('.home', { timeout: 60000 });
  console.log('after reload:', JSON.stringify(await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), cls: document.documentElement.className, settings: QS.state.save.data.settings, bg: getComputedStyle(document.body).backgroundColor }))), '| overflow', JSON.stringify(await overflow(page)));
  // Replay tutorial.
  await page.evaluate(() => QS.ui.app.go('settings')); await page.tap('.btn:text-is("Replay tutorial")'); await page.waitForSelector('.coach'); console.log('tutorial replays:', await page.textContent('.coach-text'));
  await page.screenshot({ path: 'shots/extras-coach-dark-large.png' });
  // Keyboard path: type with a real keyboard and run with Ctrl+Enter.
  await page.tap('.coach .btn-quiet'); await page.click('#qs-sql'); await page.keyboard.type('select * from plans'); await page.keyboard.press('Control+Enter'); await page.waitForSelector('.outcome-pass'); console.log('keyboard run passes');
  console.log('problems:', JSON.stringify(t.problems));
  await t.close();
})().catch(e => { console.error(e); process.exit(1); });
