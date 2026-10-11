// The no-build page (index.html + src/) must behave like the single-file build.
const { open } = require('./lib');
(async () => {
  const t = await open({ file: 'index.html', port: 8127 });
  await t.page.waitForFunction(() => { const b = document.querySelector('.boot .btn-big'); return b && !b.disabled; }, null, { timeout: 60000 });
  const r = await t.page.evaluate(async () => { const s = QS.content.worlds[0].levels[8].steps[2]; const j = await QS.engine.db.judge(s, QS.engine.db.solutionSql(s), 'frostbyte'); return j.status + ' / scripts: ' + document.scripts.length + ' / worlds: ' + QS.content.worlds.length; });
  console.log('index.html:', r, '| problems:', JSON.stringify(t.problems));
  await t.close();
})().catch(e => { console.error(e); process.exit(1); });
