/* ===== content/meta.js =====
 * Game-wide data: skills (the skill tree), ranks, badges, and Juno's stock lines.
 *
 * Skill = { id, world: world id, name, blurb, example }     // skills in unbuilt worlds only need id, world, name
 * Rank  = { title, xp: XP needed to reach it }
 * Badge = { id, name, about, rule }   rule is plain data that state/game.js knows how to check:
 *   { type: 'level', id }            finish that level
 *   { type: 'worldStars', world }    three stars on every level of that world
 *   { type: 'cleanStreak', count }   that many levels in a row without hints
 *   { type: 'comeback', misses }     pass a level after at least that many misses
 *   { type: 'drillStreak', days }    Daily Drill that many days in a row
 *   { type: 'sandboxRuns', count }   run that many queries in the Sandbox
 *   { type: 'skillsMastered', count }
 */
(function () {
  'use strict';

  QS.content.skills = [
    // World 1
    { id: 'select-star', world: 'w1', name: 'SELECT *', blurb: 'Read every column of a table.', example: 'SELECT * FROM plans' },
    { id: 'select-cols', world: 'w1', name: 'Pick columns', blurb: 'Read only the columns you name, separated by commas.', example: 'SELECT company_name, seats FROM accounts' },
    { id: 'where-text', world: 'w1', name: 'WHERE with text', blurb: 'Keep rows where a text column matches. Text goes in single quotes.', example: "SELECT company_name FROM accounts WHERE country = 'Japan'" },
    { id: 'where-num', world: 'w1', name: 'WHERE with numbers', blurb: 'Keep rows by comparing numbers with >, <, >=, <=, =, or <>.', example: 'SELECT company_name FROM accounts WHERE seats >= 100' },
    { id: 'order-by', world: 'w1', name: 'ORDER BY', blurb: 'Sort the result. ASC is smallest first. DESC is largest first.', example: 'SELECT company_name, mrr FROM accounts ORDER BY mrr DESC' },
    { id: 'limit', world: 'w1', name: 'LIMIT', blurb: 'Keep only the first rows. Pair it with ORDER BY so "first" means something.', example: 'SELECT company_name FROM accounts ORDER BY seats DESC LIMIT 3' },
    { id: 'alias', world: 'w1', name: 'AS aliases', blurb: 'Give a column or a calculation a new name.', example: 'SELECT mrr * 12 AS arr FROM accounts' },
    { id: 'distinct', world: 'w1', name: 'DISTINCT', blurb: 'Remove duplicate rows from the result.', example: 'SELECT DISTINCT country FROM accounts' },
    // Worlds ahead (names only until the world is built)
    { id: 'and-or', world: 'w2', name: 'AND / OR' }, { id: 'in', world: 'w2', name: 'IN' }, { id: 'between', world: 'w2', name: 'BETWEEN' },
    { id: 'like', world: 'w2', name: 'LIKE / ILIKE' }, { id: 'null', world: 'w2', name: 'NULL' }, { id: 'case', world: 'w2', name: 'CASE' },
    { id: 'count', world: 'w3', name: 'COUNT' }, { id: 'sum-avg', world: 'w3', name: 'SUM / AVG' }, { id: 'min-max', world: 'w3', name: 'MIN / MAX' },
    { id: 'group-by', world: 'w3', name: 'GROUP BY' }, { id: 'having', world: 'w3', name: 'HAVING' },
    { id: 'inner-join', world: 'w4', name: 'INNER JOIN' }, { id: 'left-join', world: 'w4', name: 'LEFT JOIN' }, { id: 'full-join', world: 'w4', name: 'FULL JOIN' },
    { id: 'self-join', world: 'w4', name: 'Self join' }, { id: 'anti-join', world: 'w4', name: 'Anti-join' },
    { id: 'subquery', world: 'w5', name: 'Subqueries' }, { id: 'cte', world: 'w5', name: 'CTEs (WITH)' },
    { id: 'row-number', world: 'w6', name: 'ROW_NUMBER' }, { id: 'rank', world: 'w6', name: 'RANK' }, { id: 'lag-lead', world: 'w6', name: 'LAG / LEAD' },
    { id: 'running-total', world: 'w6', name: 'Running totals' }, { id: 'qualify', world: 'w6', name: 'QUALIFY' },
    { id: 'dates', world: 'w7', name: 'Dates' }, { id: 'strings', world: 'w7', name: 'Strings' }, { id: 'casting', world: 'w7', name: 'Casting (::)' },
    { id: 'json', world: 'w8', name: 'JSON fields' }, { id: 'unnest', world: 'w8', name: 'Unnesting arrays' },
    { id: 'create', world: 'w9', name: 'CREATE' }, { id: 'insert', world: 'w9', name: 'INSERT' }, { id: 'update-delete', world: 'w9', name: 'UPDATE / DELETE' }, { id: 'merge', world: 'w9', name: 'MERGE' },
    { id: 'warehouses', world: 'w10', name: 'Warehouses and credits' }, { id: 'micro-partitions', world: 'w10', name: 'Micro-partitions' },
    { id: 'time-travel', world: 'w10', name: 'Time Travel' }, { id: 'cloning', world: 'w10', name: 'Zero-copy cloning' }, { id: 'access', world: 'w10', name: 'Roles and access' }
  ];

  QS.content.ranks = [
    { title: 'Intern', xp: 0 },
    { title: 'Junior Analyst', xp: 250 },
    { title: 'Analyst', xp: 700 },
    { title: 'Senior Analyst', xp: 1400 },
    { title: 'Analytics Lead', xp: 2300 },
    { title: 'Data Engineer', xp: 3400 },
    { title: 'Senior Data Engineer', xp: 4800 },
    { title: 'Data Architect', xp: 6500 }
  ];

  QS.content.badges = [
    { id: 'first-tracks', name: 'First Tracks', about: 'Ran your first query.', rule: { type: 'level', id: 'w1-l1' } },
    { id: 'clean-line', name: 'Clean Line', about: 'Three levels in a row with no hints.', rule: { type: 'cleanStreak', count: 3 } },
    { id: 'back-up', name: 'Back on Your Feet', about: 'Passed a level after three or more misses.', rule: { type: 'comeback', misses: 3 } },
    { id: 'base-camp', name: 'Base Camp Cleared', about: 'Closed Case 01.', rule: { type: 'level', id: 'w1-boss' } },
    { id: 'bluebird', name: 'Bluebird Day', about: 'Three stars on every level in World 1.', rule: { type: 'worldStars', world: 'w1' } },
    { id: 'sharp-edges', name: 'Sharp Edges', about: 'Mastered four skills.', rule: { type: 'skillsMastered', count: 4 } },
    { id: 'early-riser', name: 'Early Riser', about: 'Daily Drill three days in a row.', rule: { type: 'drillStreak', days: 3 } },
    { id: 'off-piste', name: 'Off-Piste', about: 'Ran 10 queries in the Sandbox.', rule: { type: 'sandboxRuns', count: 10 } }
  ];

  // XP rules live here so balance changes are content edits, not code edits.
  QS.content.rewards = { level: 50, boss: 150, perStar: 10, drillItem: 15, drillSetBonus: 25, practiceItem: 5 };

  QS.content.mentor = {
    name: 'Juno',
    pass: ['Clean run.', 'That is the one.', 'Exactly right.', 'Nicely done.', 'Right on the line.'],
    fail: ['Not yet. Compare your result with the goal.', 'Close. The highlighted rows show the gap.', 'Almost. One change should do it.'],
    error: ['The database could not read that. Here is what it tripped on.']
  };

  // Symbols every keyboard row gets. '\'\'' inserts a pair of quotes with the cursor in the middle.
  QS.content.symbols = [',', '*', '=', '>', '<', '>=', "''", '(', ')'];
})();
