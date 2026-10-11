// Plays Level 1 on a phone-sized screen using only taps, following the tutorial.
const { open, overflow } = require('./lib');
(async () => {
  const t = await open({ touch: true });
  const { page } = t;
  const shot = n => page.screenshot({ path: 'shots/' + n + '.png' });
  await page.waitForFunction(() => { const b = document.querySelector('.boot .btn-big'); return b && !b.disabled; }, null, { timeout: 60000 });
  await page.tap('.boot .btn-big');
  await page.waitForSelector('.coach');
  await page.waitForTimeout(700); await shot('10-coach-1');
  await page.tap('.coach .btn-primary');           // Next
  await page.waitForTimeout(600); await shot('11-coach-2');
  for (const k of ['SELECT', '*', 'FROM', 'plans']) { await page.tap('.key[data-key="' + k + '"]'); await page.waitForTimeout(350); }
  await shot('12-coach-run');
  console.log('editor:', JSON.stringify(await page.inputValue('#qs-sql')), '| coach:', await page.textContent('.coach-text'));
  await page.tap('.run');
  await page.waitForSelector('.outcome-pass');
  await page.waitForTimeout(700); await shot('13-pass');
  console.log('coach after run:', await page.textContent('.coach-text').catch(() => '(gone)'));
  console.log('tutorialDone:', await page.evaluate(() => QS.state.save.data.flags.tutorialDone));
  await page.tap('.outcome-pass .btn-primary');     // Next step
  await page.waitForFunction(() => /price_per_seat/.test(document.querySelector('.task').textContent));
  await page.waitForTimeout(300); await shot('14-step2');
  for (const k of ['SELECT', 'plan_name', ',', 'price_per_seat', 'FROM', 'plans']) await page.tap('.key[data-key="' + k + '"]');
  console.log('editor 2:', JSON.stringify(await page.inputValue('#qs-sql')));
  await page.tap('.run');
  await page.waitForSelector('.outcome-pass');
  await page.tap('.outcome-pass .btn-primary');     // Finish
  await page.waitForSelector('.cele');
  await page.waitForTimeout(1800); await shot('15-celebrate');
  console.log('save:', JSON.stringify(await page.evaluate(() => ({ xp: QS.state.save.data.xp, levels: QS.state.save.data.levels, skills: QS.state.save.data.skills, badges: Object.keys(QS.state.save.data.badges) }))));
  await page.evaluate(() => document.querySelector('.sheet').scrollTo(0, 9999)); await shot('16-celebrate-bottom');
  await page.tap('.sheet-actions .btn-quiet');      // Map
  await page.waitForSelector('.home');
  await page.waitForTimeout(400); await shot('17-home'); await page.screenshot({ path: 'shots/18-home-full.png', fullPage: true });
  console.log('home overflow', JSON.stringify(await overflow(page)));
  // reload: progress must survive
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.home', { timeout: 60000 });
  console.log('after reload:', JSON.stringify(await page.evaluate(() => ({ xp: QS.state.save.data.xp, done: Object.keys(QS.state.save.data.levels), stored: !!localStorage.getItem('query-summit-save') }))));
  console.log('problems:', JSON.stringify(t.problems, null, 1));
  await t.close();
})().catch(e => { console.error(e); process.exit(1); });
