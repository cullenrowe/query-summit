// Quality check 1 and 2: every solution passes the judge, and wrong answers fail with a useful message.
const { open } = require('./lib');
(async () => {
  const t = await open({ viewport: { width: 1280, height: 800 }, dpr: 1 });
  const { page } = t;
  await page.waitForFunction(() => window.QS && QS.engine.db.status === 'ready', null, { timeout: 60000 });
  const report = await page.evaluate(async () => {
    const db = QS.engine.db, sqlx = QS.engine.sql, out = { pass: 0, fail: [], notes: [] };
    const items = [];
    for (const w of QS.content.worlds) for (const l of (w.levels || [])) l.steps.forEach((s, i) => items.push({ id: l.id + ' step ' + (i + 1), step: s, ds: w.dataset }));
    for (const d of QS.content.drills) items.push({ id: d.id, step: d, ds: d.dataset });
    const ok = (id, what, cond, detail) => { if (cond) out.pass++; else out.fail.push(id + ': ' + what + (detail ? ' -> ' + detail : '')); };
    for (const it of items) {
      const s = it.step, sol = db.solutionSql(s);
      // 1. the solution passes
      let r = await db.judge(s, sol, it.ds);
      ok(it.id, 'solution passes', r.status === 'pass', r.status + ' ' + (r.message || (r.error && r.error.body) || ''));
      // 2. the formatted solution passes too (formatter must not change meaning)
      const f = sqlx.format(sol);
      r = await db.judge(s, f, it.ds);
      ok(it.id, 'formatted solution passes', r.status === 'pass', f.replace(/\n/g, ' / '));
      ok(it.id, 'formatter is stable', sqlx.format(f) === f);
      // 3. lowercase with a trailing semicolon passes (answers are never matched as text)
      if (s.type === 'write' || s.type === 'fix') { r = await db.judge(s, sol.toLowerCase().replace(/'[^']*'/g, m => sol.match(new RegExp(m, 'i'))[0]) + ';', it.ds); ok(it.id, 'lowercase solution passes', r.status === 'pass', r.message); }
      // 4. per-type wrong answers
      if (s.type === 'fix') { r = await db.judge(s, s.broken, it.ds); ok(it.id, 'broken query does not pass', r.status !== 'pass'); out.notes.push(it.id + ' broken -> [' + r.status + '] ' + (r.error ? r.error.title + ': ' + r.error.body : r.message)); }
      if (s.type === 'choose') { for (let i = 0; i < s.options.length; i++) { if (i === s.answer) continue; r = await db.judge(s, s.options[i].sql, it.ds); ok(it.id, 'option ' + i + ' is wrong', r.status !== 'pass'); out.notes.push(it.id + ' option ' + 'ABC'[i] + ' -> [' + r.status + '] ' + (r.error ? r.error.title + ': ' + r.error.body : r.message)); } }
      if (s.type === 'blank') {
        const combos = s.blanks.reduce((acc, b) => acc.flatMap(a => b.options.map(o => a.concat([o]))), [[]]);
        const answer = s.blanks.map(b => b.options[b.answer]).join('|');
        let wrongPass = 0;
        for (const c of combos) { if (c.join('|') === answer) continue; r = await db.judge(s, db.fill(s.template, c), it.ds); if (r.status === 'pass') { wrongPass++; out.fail.push(it.id + ': wrong blanks pass: ' + c.join(' , ')); } }
        ok(it.id, 'only the right blanks pass (' + (combos.length - 1) + ' wrong combos)', wrongPass === 0);
      }
      if (s.type === 'predict') {
        const actual = await db.goalFor(s, it.ds);
        s.options.forEach((o, i) => {
          let match;
          if (o.table) match = QS.engine.compare({ columns: o.table.columns.map(n => ({ name: n })), rows: o.table.rows }, actual, { ordered: true }).pass;
          else match = null;
          if (match !== null) ok(it.id, 'option ' + i + (i === s.answer ? ' matches' : ' differs from') + ' the real result', match === (i === s.answer));
          else out.notes.push(it.id + ' text option ' + 'ABC'[i] + (i === s.answer ? ' (answer)' : '') + ': "' + o.text + '" | real result: ' + actual.rows.length + ' rows x ' + actual.columns.length + ' cols');
        });
      }
      if (s.type === 'write' && s.check && s.check.ordered) {
        // the order check must reject a reversed result
        const rev = 'SELECT * FROM (' + sol + ') ORDER BY ' + s.check.orderKey.map(k => k + ' ' + (/DESC/i.test(sol) ? 'ASC' : 'DESC')).join(', ');
        r = await db.judge(s, rev, it.ds); ok(it.id, 'reversed order is rejected', r.status === 'fail' && r.verdict.kind === 'order', r.status + ' ' + r.message);
      }
    }
    // Wrong answers on specific levels: do they fail, and what does the player read?
    const L = id => { for (const w of QS.content.worlds) for (const l of (w.levels || [])) if (l.id === id) return { l, ds: w.dataset }; };
    const tryIt = async (label, lid, stepIdx, sql) => { const x = L(lid); const r = await db.judge(x.l.steps[stepIdx], sql, x.ds); ok(label, 'wrong answer fails', r.status !== 'pass'); out.notes.push('WRONG ' + label + ' -> [' + r.status + '] ' + (r.error ? r.error.title + ': ' + r.error.body : (r.title ? r.title + ': ' : '') + r.message)); };
    await tryIt('L1 star on step 2', 'w1-l1', 1, 'SELECT * FROM plans');
    await tryIt('L1 wrong table', 'w1-l1', 0, 'SELECT * FROM plan');
    await tryIt('L2 no filter', 'w1-l2', 1, 'SELECT company_name, seats FROM accounts');
    await tryIt('L2 wrong case', 'w1-l2', 1, "SELECT company_name, seats FROM accounts WHERE status = 'Trial'");
    await tryIt('L2 no quotes', 'w1-l2', 1, 'SELECT company_name, seats FROM accounts WHERE status = trial');
    await tryIt('L2 wrong column', 'w1-l2', 1, "SELECT company_name, mrr FROM accounts WHERE status = 'trial'");
    await tryIt('L2 typo', 'w1-l2', 1, "SELCT company_name, seats FROM accounts WHERE status = 'trial'");
    await tryIt('L2 drop table', 'w1-l2', 1, 'DROP TABLE accounts');
    await tryIt('L2 two statements', 'w1-l2', 1, "SELECT 1; SELECT company_name, seats FROM accounts WHERE status = 'trial'");
    await tryIt('L5 ascending', 'w1-l5', 1, 'SELECT company_name, signup_date FROM accounts ORDER BY signup_date');
    await tryIt('L5 no order', 'w1-l5', 1, 'SELECT company_name, signup_date FROM accounts');
    await tryIt('L6 no limit', 'w1-l6', 1, 'SELECT company_name, seats FROM accounts ORDER BY seats DESC');
    await tryIt('L6 limit before order', 'w1-l6', 1, 'SELECT company_name, seats FROM accounts LIMIT 3 ORDER BY seats DESC');
    await tryIt('L7 no alias', 'w1-l7', 0, 'SELECT company_name, mrr * 12 FROM accounts');
    await tryIt('L7 no math', 'w1-l7', 0, 'SELECT company_name, mrr AS arr FROM accounts');
    await tryIt('L8 no distinct', 'w1-l8', 0, 'SELECT country FROM accounts');
    await tryIt('Boss 1 wrong limit', 'w1-boss', 0, "SELECT company_name, plan_name, mrr FROM accounts WHERE status = 'active' ORDER BY mrr DESC LIMIT 3");
    await tryIt('Boss 1 no filter', 'w1-boss', 0, 'SELECT company_name, plan_name, mrr FROM accounts ORDER BY mrr DESC LIMIT 5');
    await tryIt('Boss 3 missing comma', 'w1-boss', 2, "SELECT company_name mrr * 12 AS lost_arr FROM accounts WHERE status = 'churned' ORDER BY lost_arr DESC");
    await tryIt('Boss 3 empty', 'w1-boss', 2, '   ');
    await tryIt('read file', 'w1-l1', 0, "SELECT * FROM read_csv('x.csv')");
    // Alternative correct answers must pass.
    const good = async (label, lid, stepIdx, sql) => { const x = L(lid); const r = await db.judge(x.l.steps[stepIdx], sql, x.ds); ok(label, 'alternative answer passes', r.status === 'pass', r.status + ' ' + (r.message || (r.error && r.error.body))); };
    await good('L1 columns spelled out', 'w1-l1', 0, 'select plan_name, price_per_seat, max_seats, support from plans');
    await good('L2 different column order', 'w1-l2', 1, "SELECT seats, company_name FROM accounts WHERE status = 'trial'");
    await good('L2 with alias and order', 'w1-l2', 1, "SELECT company_name AS company, seats FROM accounts WHERE status = 'trial' ORDER BY seats");
    await good('L3 as write', 'w1-l3', 0, 'SELECT company_name, mrr FROM accounts WHERE mrr >= 5001');
    await good('L6 extra tie-breaker', 'w1-l6', 1, 'SELECT company_name, seats FROM accounts ORDER BY seats DESC, company_name LIMIT 3');
    await good('L7 reversed math', 'w1-l7', 0, 'SELECT company_name, 12 * mrr arr FROM accounts');
    await good('L8 group by instead', 'w1-l8', 0, 'SELECT country FROM accounts GROUP BY country');
    await good('Boss 3 order by expression', 'w1-boss', 2, "SELECT company_name, mrr * 12 AS LOST_ARR FROM accounts WHERE status = 'churned' ORDER BY mrr DESC");
    // State mode (used from World 9 on): the engine path must already work.
    const st = { type: 'write', solution: "UPDATE plans SET price_per_seat = 15 WHERE plan_name = 'Drift'", check: { mode: 'state', probe: 'SELECT plan_name, price_per_seat FROM plans' } };
    let r = await db.judge(st, "update plans set price_per_seat = price_per_seat + 3 where plan_name = 'Drift'", 'frostbyte'); ok('state mode', 'equivalent update passes', r.status === 'pass', r.status);
    r = await db.judge(st, 'UPDATE plans SET price_per_seat = 15', 'frostbyte'); ok('state mode', 'over-broad update fails', r.status === 'fail', r.status + ' ' + r.message);
    r = await db.judge(QS.content.worlds[0].levels[0].steps[0], 'SELECT * FROM plans', 'frostbyte'); ok('state mode', 'data is restored afterwards', r.status === 'pass');
    // Runaway query: stopped, engine restarted, data back.
    const t0 = performance.now();
    r = await db.sandboxRun('SELECT COUNT(*) FROM range(60000) a, range(60000) b WHERE a.range + b.range = 7', 'frostbyte');
    out.notes.push('RUNAWAY -> [' + r.status + '] ' + (r.error ? r.error.title + ': ' + r.error.body : '') + ' after ' + Math.round(performance.now() - t0) + ' ms, engine ' + db.status);
    r = await db.sandboxRun('SELECT COUNT(*) AS n FROM accounts', 'frostbyte'); ok('runaway', 'engine recovers with data', r.status === 'ok' && r.result.rows[0][0] === 60, JSON.stringify(r).slice(0, 200));
    // Huge result is capped.
    r = await db.sandboxRun('SELECT a.account_id FROM accounts a, accounts b, accounts c', 'frostbyte'); ok('cap', 'huge result is capped at 2000 rows', r.status === 'ok' && r.result.rows.length === 2000 && r.result.truncated, r.status);
    r = await db.sandboxRun("SELECT * FROM accounts WHERE country = 'Nowhere'", 'frostbyte'); ok('empty', 'empty result keeps its columns', r.status === 'ok' && r.result.columns.length === 9 && r.result.rows.length === 0, JSON.stringify(r).slice(0, 200));
    r = await db.sandboxRun("SELECT signup_date, signup_date::timestamp AS ts, mrr / 7.0 AS x, NULL AS n, seats > 10 AS big FROM accounts ORDER BY account_id LIMIT 1", 'frostbyte'); out.notes.push('TYPES ' + JSON.stringify(r.result));
    r = await db.sandboxRun("CREATE TABLE t AS SELECT 1 AS a; INSERT INTO t VALUES (2); SELECT * FROM t", 'frostbyte'); out.notes.push('SANDBOX multi -> ' + JSON.stringify(r.result && r.result.rows));
    await db.useDataset('frostbyte'); r = await db.sandboxRun('SELECT * FROM t', 'frostbyte'); ok('sandbox', 'sandbox changes are wiped when data reloads', r.status === 'error', r.status);
    return out;
  });
  console.log('checks passed:', report.pass, '| failed:', report.fail.length);
  for (const f of report.fail) console.log('  FAIL ' + f);
  console.log('--- what players read ---'); for (const n of report.notes) console.log('  ' + n);
  console.log('problems:', JSON.stringify(t.problems));
  await t.close();
  if (report.fail.length) process.exit(2);
})().catch(e => { console.error(e); process.exit(1); });
