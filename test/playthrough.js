// Plays all of World 1 through the real interface, then visits every other screen.
// Usage: node test/playthrough.js [mobile|desktop] [light|dark]
const { open, overflow } = require('./lib');
const mode = process.argv[2] || 'mobile', scheme = process.argv[3] || 'light';
const tag = mode + '-' + scheme;
(async () => {
  const t = await open({ viewport: mode === 'mobile' ? { width: 375, height: 667 } : { width: 1280, height: 800 }, dpr: mode === 'mobile' ? 2 : 1, touch: mode === 'mobile', scheme });
  const { page } = t;
  // With touch emulation, a full-page capture makes Chromium mis-aim the next tap (checked: 0 of 8 taps land
  // after one, 8 of 8 without). So phone runs capture the visible screen only.
  const shot = (n, full) => page.screenshot({ path: 'shots/' + tag + '-' + n + '.png', fullPage: !!full && mode !== 'mobile' });
  const wide = [];
  const checkWidth = async where => { const o = await overflow(page); if (o.doc > o.win) wide.push(where + ' ' + JSON.stringify(o)); };
  const click = sel => mode === 'mobile' ? page.tap(sel) : page.click(sel);
  await page.waitForFunction(() => { const b = document.querySelector('.boot .btn-big'); return b && !b.disabled; }, null, { timeout: 60000 });
  await shot('boot');
  await click('.boot .btn-big');
  await page.waitForSelector('.coach');
  await click('.coach .btn-quiet');   // skip the tutorial in this run
  const levels = await page.evaluate(() => QS.content.worlds[0].levels.map(l => ({ id: l.id, steps: l.steps.map(s => ({ type: s.type, sol: QS.engine.db.solutionSql(s), answer: s.answer, blanks: s.blanks ? s.blanks.map(b => b.options[b.answer]) : null, wrong: s.type === 'blank' ? s.blanks.map(b => b.options[(b.answer + 1) % b.options.length]) : null })) })));
  for (const lv of levels) {
    await page.waitForFunction(id => QS.ui.app.current.name === 'level' && QS.ui.app.current.params.id === id, lv.id);
    for (let i = 0; i < lv.steps.length; i++) {
      const st = lv.steps[i];
      await page.waitForFunction(n => { const c = document.querySelector('.step-count'); return !c || c.textContent.trim().startsWith(String(n)); }, i + 1);
      await page.waitForSelector('.step-' + st.type);
      await page.waitForTimeout(250);
      await checkWidth(lv.id + ':' + i);
      if (st.type === 'write' || st.type === 'fix') {
        if (lv.id === 'w1-l2' && i === 1) {   // show a failed run first
          await page.fill('#qs-sql', 'SELECT company_name, seats FROM accounts');
          await click('.run'); await page.waitForSelector('.outcome-fail'); await page.waitForTimeout(300); await shot('fail-rows', mode === 'desktop'); await checkWidth('fail');
        }
        if (st.type === 'fix') { await shot('fix-start'); await click('.run'); await page.waitForSelector('.outcome-error'); await page.waitForTimeout(300); await shot('fix-error'); await click('.outcome-error .btn-quiet'); await page.waitForTimeout(100); await checkWidth('error details'); }
        if (lv.id === 'w1-l7') { await page.fill('#qs-sql', 'SELECT company_name, mrr * 12 FROM accounts'); await click('.run'); await page.waitForSelector('.outcome-fail'); await page.waitForTimeout(200); await shot('fail-name'); await click('.hint-btn'); await click('.hint-btn'); await page.waitForTimeout(300); await shot('hints', true); }
        await page.fill('#qs-sql', st.sol);
        if (lv.id === 'w1-boss' && i === 0) { await click('.ed-actions .btn-ghost'); await page.waitForTimeout(150); await shot('boss-formatted', true); }
        await click('.run');
      } else if (st.type === 'blank') {
        await shot('blank-start');
        for (const w of st.wrong) await click('.blank-opts .key:text-is("' + w + '")');
        await click('.run'); await page.waitForSelector('.outcome-fail, .outcome-error'); await page.waitForTimeout(250); await shot('blank-fail', true);
        for (let b = 0; b < st.blanks.length; b++) { await click('.slot >> nth=' + b); await click('.blank-opts .key:text-is("' + st.blanks[b] + '")'); }
        await click('.run');
      } else if (st.type === 'choose') {
        await click('.opt >> nth=0'); await click('.run'); await page.waitForSelector('.opt.is-wrong'); await page.waitForTimeout(250); await shot('choose-wrong', true);
        await click('.opt >> nth=' + st.answer); await click('.run');
      } else if (st.type === 'predict') {
        await shot('predict-start', true);
        await click('.opt >> nth=' + st.answer); await click('.run');
      }
      await page.waitForSelector('.outcome-pass', { timeout: 15000 }).catch(async e => { await shot('STUCK', true); console.log('STUCK at', lv.id, 'step', i, st.type, '| banner:', await page.textContent('.outcome'), '| editor:', await page.inputValue('#qs-sql').catch(() => '')); throw e; });
      if (lv.id === 'w1-l6' && i === 0) { await page.waitForTimeout(250); await shot('predict-pass', true); }
      await click('.outcome-pass .btn-primary');
    }
    await page.waitForSelector('.cele');
    await page.waitForTimeout(1500);
    if (lv.id === 'w1-l6' || lv.id === 'w1-boss') await shot('celebrate-' + lv.id);
    await checkWidth('celebrate ' + lv.id);
    await click('.sheet-actions .btn-primary');
    if (lv.id === 'w1-boss') { await page.waitForSelector('.dialog'); await shot('outro'); for (let k = 0; k < 3; k++) { await click('.sheet-actions .btn-primary'); await page.waitForTimeout(120); } }
  }
  await page.waitForSelector('.home'); await page.waitForTimeout(300);
  await shot('home-done', true); await checkWidth('home');
  console.log('after world 1:', JSON.stringify(await page.evaluate(() => { const s = QS.state.save.data; return { xp: s.xp, rank: QS.state.game.rank().title, stars: Object.values(s.levels).map(l => l.stars).join(''), badges: Object.keys(s.badges), mastered: QS.state.game.masteredCount(), skills: Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, v.pips])) }; })));
  // Daily Drill
  await click('.tab[data-screen="drill"]'); await page.waitForSelector('.drill-card'); await shot('drill-intro'); await checkWidth('drill intro');
  await click('.drill-card .btn-primary');
  const n = await page.evaluate(() => QS.state.game.drillToday().items.length);
  for (let q = 0; q < n; q++) {
    await page.waitForFunction(k => /Question (\d+)/.exec(document.querySelector('.step-count').textContent)[1] === String(k), q + 1);
    await page.waitForSelector('.step'); await page.waitForTimeout(200); await checkWidth('drill q' + q);
    const st = await page.evaluate(k => { const d = QS.state.game.drillToday().items[k]; return { type: d.type, sol: QS.engine.db.solutionSql(d), answer: d.answer, blanks: d.blanks ? d.blanks.map(b => b.options[b.answer]) : null }; }, q);
    if (q === 0) await shot('drill-q1', true);
    if (st.type === 'write' || st.type === 'fix') { await page.fill('#qs-sql', st.sol); await click('.run'); }
    else if (st.type === 'blank') { for (let b = 0; b < st.blanks.length; b++) { await click('.slot >> nth=' + b); await click('.blank-opts .key:text-is("' + st.blanks[b] + '")'); } await click('.run'); }
    else { await click('.opt >> nth=' + st.answer); await click('.run'); }
    await page.waitForSelector('.outcome-pass'); await click('.outcome-pass .btn-primary');
  }
  await page.waitForSelector('.drill-list'); await page.waitForTimeout(500); await shot('drill-done', true);
  console.log('drill:', JSON.stringify(await page.evaluate(() => QS.state.save.data.drill)));
  // Sandbox
  await click('.tab[data-screen="sandbox"]'); await page.waitForSelector('.sandbox'); await click('.run'); await page.waitForSelector('.sandbox .rt-table'); await page.waitForTimeout(200); await shot('sandbox', true); await checkWidth('sandbox');
  await page.fill('#qs-sandbox-sql', 'SELEC * FROM accounts'); await click('.run'); await page.waitForSelector('.outcome-error'); await shot('sandbox-error');
  // Skills
  await click('.tab[data-screen="skills"]'); await page.waitForSelector('.tree'); await shot('skills', true); await checkWidth('skills');
  await click('.skill >> nth=2'); await page.waitForSelector('.skill-sheet'); await page.waitForTimeout(300); await shot('skill-sheet'); await click('.sheet-head .btn-icon');
  // Table peek
  await click('.tab[data-screen="sandbox"]'); await click('.chip-table >> nth=1'); await page.waitForSelector('.peek .rt-table'); await page.waitForTimeout(300); await shot('peek'); await checkWidth('peek'); await click('.sheet-head .btn-icon');
  // Settings: theme, text size, export, import, reset
  await click('.tab[data-screen="settings"]'); await page.waitForSelector('.settings'); await shot('settings', true); await checkWidth('settings');
  await click('.seg-btn:text-is("Large")'); await page.waitForTimeout(100); await checkWidth('settings large text');
  await click('.tab[data-screen="home"]'); await page.waitForSelector('.home'); await checkWidth('home large text'); await shot('home-large');
  await click('.tab[data-screen="settings"]'); await click('.seg-btn:text-is("Medium")');
  await click('.seg-btn:text-is("' + (scheme === 'light' ? 'Dark' : 'Light') + '")'); await page.waitForTimeout(150); await shot('settings-flipped');
  await click('.seg-btn:text-is("System")');
  await click('.btn:text-is("Export progress")'); await page.waitForSelector('#qs-export'); const code = await page.inputValue('#qs-export'); await shot('export'); await click('.sheet-head .btn-icon');
  const before = await page.evaluate(() => JSON.stringify([QS.state.save.data.xp, QS.state.save.data.levels]));
  await click('.btn:text-is("Reset progress")'); await page.waitForSelector('.btn-danger'); await shot('reset'); await click('.btn-danger'); await page.waitForSelector('.home');
  console.log('after reset: xp', await page.evaluate(() => QS.state.save.data.xp), 'levels', await page.evaluate(() => Object.keys(QS.state.save.data.levels).length));
  await click('.tab[data-screen="settings"]'); await click('.btn:text-is("Import progress")'); await page.fill('#qs-import', 'garbage'); await click('.sheet-actions .btn-primary'); console.log('bad import says:', await page.textContent('.form-msg'));
  await page.fill('#qs-import', code); await click('.sheet-actions .btn-primary'); await page.waitForTimeout(300);
  console.log('import restored progress:', before === await page.evaluate(() => JSON.stringify([QS.state.save.data.xp, QS.state.save.data.levels])), '| code length', code.length);
  console.log('too wide:', JSON.stringify(wide));
  console.log('problems:', JSON.stringify(t.problems, null, 1));
  await t.close();
})().catch(e => { console.error(e); process.exit(1); });
