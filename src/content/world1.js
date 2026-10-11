/* ===== content/world1.js =====
 * World 1: First Queries. Plain data only. No engine or UI code in here.
 *
 * CONTENT SCHEMA (v1). Every world file follows this shape.
 *
 * World = {
 *   id, n, title, camp, altitude (meters, shown on the map), caseName, teaser,
 *   dataset: id of an entry in QS.content.datasets,
 *   intro: [lines Juno says before the first level], outro: [lines after the boss],
 *   levels: [Level]            // leave empty or omit for a world that is not built yet (shows as locked)
 * }
 * Level = {
 *   id, title, trail: 'green' | 'blue' | 'black',   // trail rating shown on the map. The boss is 'black'.
 *   boss: true,                // optional. Boss levels pay more XP and close the case.
 *   story: one or two sentences shown at the top of the level,
 *   after: one line shown on the level-complete card (optional),
 *   corner: { title, body, code }   // optional Snowflake Corner card shown after the level
 *   steps: [Step]              // most levels have 1 or 2 short steps. A boss has 3.
 * }
 * Step = {
 *   type: 'write' | 'fix' | 'blank' | 'choose' | 'predict',
 *   skills: [skill ids from QS.content.skills],
 *   teach, teachCode: short concept intro and one example (optional),
 *   task: what the player must do. Wrap code in `backticks`.
 *   tables: [table names to show]           // default: every table in the dataset
 *   keys: { words: [...], values: [...], columns: true }   // tap-to-insert chips. Table and column names are added for you.
 *   hints: [ { kind: 'nudge' | 'concept' | 'partial', text, code } ]   // the full solution is always added as the last hint
 *   check: { ordered, orderKey: [goal column names], matchNames: [goal column names], mode: 'result' | 'state', probe }
 *       ordered     row order must match. With orderKey, only those columns must be in the same sequence (ties are safe).
 *       matchNames  these goal columns must have the same name in the player's result.
 *       mode 'state' is for data-changing levels: the player's statement and the solution each run on a fresh copy
 *                    of the data, then `probe` (a SELECT) is compared.
 *   Per type:
 *     write:   solution
 *     fix:     broken, solution
 *     blank:   template with {0} {1} ... slots, blanks: [ { options: [...], answer: index } ]
 *     choose:  options: [ { sql, why } ], answer: index
 *     predict: sql, question, options: [ { text } or { table: { columns, rows } }, plus why ], answer: index
 *   coach: [ { say, target, until } ]       // optional guided tutorial for this step
 * }
 * Answers are never checked by comparing text. The engine runs the query and compares result tables.
 */
(function () {
  'use strict';
  QS.content.worlds = QS.content.worlds || [];

  QS.content.worlds.push({
    id: 'w1',
    n: 1,
    title: 'First Queries',
    camp: 'Base Camp',
    altitude: 600,
    caseName: 'Case 01: The Frozen Dashboard',
    teaser: 'The revenue dashboard froze the night before the quarterly review. Ask the data yourself with SELECT, WHERE, ORDER BY, and LIMIT.',
    dataset: 'frostbyte',
    intro: [
      "Welcome to Frostbyte Cloud. I'm Juno. I look after the data warehouse, and today I look after you.",
      'Rough first day. The revenue dashboard froze overnight, and Marta presents the quarterly review at 4 PM.',
      'The data is fine. We just have to ask for it ourselves. That is what SQL is for.'
    ],
    outro: [
      'Marta read your last result twice. The old dashboard only counted active accounts.',
      'Nobody had noticed that Nimbus Ridge Software alone was worth $974,400 a year when it left.',
      'Case closed. Now everyone wants to know why customers disappear. That will take sharper filters.'
    ],
    levels: [
      {
        id: 'w1-l1',
        title: 'First Tracks',
        trail: 'green',
        story: 'Start small. Before anything else, Marta wants to know which plans we sell.',
        after: 'That was a real query on a real database engine. First tracks made.',
        corner: {
          title: 'Real SQL, small engine',
          body: 'This game runs DuckDB, a real database that fits inside your browser. It is not Snowflake. Almost everything you write here works the same way in both. When it does not, a card like this one will say so.'
        },
        steps: [
          {
            type: 'write',
            skills: ['select-star'],
            teach: 'A query is a question you ask a table. `SELECT` says which columns you want. `FROM` says which table. The star `*` means every column.',
            task: 'Show everything in the `plans` table.',
            tables: ['plans'],
            keys: { words: ['SELECT', '*', 'FROM'], columns: false },
            solution: `SELECT * FROM plans`,
            hints: [
              { kind: 'nudge', text: 'Four taps: SELECT, the star, FROM, then the table name.' },
              { kind: 'concept', text: 'Every query has the same skeleton.', code: 'SELECT columns FROM table' }
            ],
            coach: [
              { say: "Let's run your first query together. This card is your mission. Every level has one.", target: 'task' },
              { say: 'You can type, or tap these keys. Queries start with SELECT. Tap it.', target: 'key:SELECT', until: '^SELECT$' },
              { say: 'The star means every column. Tap it.', target: 'key:*', until: '^SELECT \\*$' },
              { say: 'FROM says which table to read.', target: 'key:FROM', until: '^SELECT \\* FROM$' },
              { say: 'Now the table name.', target: 'key:plans', until: '^SELECT \\* FROM PLANS;?$' },
              { say: 'That is a complete query. Run it.', target: 'run', until: 'run' },
              { say: 'Your result is on top. The goal is right under it. When they match, you pass.', target: 'results' }
            ]
          },
          {
            type: 'write',
            skills: ['select-cols'],
            teach: 'You rarely need every column. Name the ones you want, with commas between them.',
            teachCode: `SELECT plan_name, support FROM plans`,
            task: 'Now show only `plan_name` and `price_per_seat` from `plans`.',
            tables: ['plans'],
            keys: { words: ['SELECT', 'FROM'] },
            solution: `SELECT plan_name, price_per_seat FROM plans`,
            hints: [
              { kind: 'nudge', text: 'Swap the star for two column names.' },
              { kind: 'concept', text: 'Columns are separated by commas. No comma after the last one.', code: 'SELECT first_column, second_column FROM table' },
              { kind: 'partial', text: 'Fill in the second column.', code: 'SELECT plan_name, ... FROM plans' }
            ]
          }
        ]
      },

      {
        id: 'w1-l2',
        title: 'Trial Run',
        trail: 'green',
        story: 'Renewals wants to call every trial customer before the trial runs out. They need a list.',
        after: 'Eight trials. Renewals has its call list.',
        steps: [
          {
            type: 'write',
            skills: ['select-cols'],
            teach: 'Meet the main table. `accounts` has one row per customer. Tap its name under Tables to look inside.',
            task: 'Show `company_name`, `plan_name`, and `status` for every account.',
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM'] },
            solution: `SELECT company_name, plan_name, status FROM accounts`,
            hints: [
              { kind: 'nudge', text: 'Same shape as before, with three columns and a different table.' },
              { kind: 'partial', text: 'Finish the list of columns.', code: 'SELECT company_name, ... FROM accounts' }
            ]
          },
          {
            type: 'write',
            skills: ['where-text'],
            teach: '`WHERE` keeps only the rows that pass a test. Text values go inside single quotes and must match exactly.',
            teachCode: `SELECT company_name FROM accounts WHERE country = 'Japan'`,
            task: "Show `company_name` and `seats` for accounts whose `status` is `'trial'`.",
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'WHERE'], values: ["'trial'", "'active'", "'churned'"] },
            solution: `SELECT company_name, seats FROM accounts WHERE status = 'trial'`,
            hints: [
              { kind: 'nudge', text: 'You need one more line after FROM. It starts with WHERE.' },
              { kind: 'concept', text: 'Single quotes around text. Exact spelling, and lowercase here.', code: "WHERE column = 'text'" },
              { kind: 'partial', text: 'Finish the test.', code: 'SELECT company_name, seats FROM accounts WHERE status = ...' }
            ]
          }
        ]
      },

      {
        id: 'w1-l3',
        title: 'Big Spenders',
        trail: 'green',
        story: 'Marta wants to thank our biggest customers in person. Big means more than $5,000 a month.',
        after: 'One account pays exactly $5,000. `>` leaves it out and `>=` keeps it. One character changes the report.',
        steps: [
          {
            type: 'blank',
            skills: ['where-num'],
            teach: 'Numbers do not get quotes. Compare them with `>`, `<`, `>=`, `<=`, `=`, or `<>` (not equal).',
            task: 'Fill the blanks: show `company_name` and `mrr` for accounts paying more than $5,000 a month.',
            tables: ['accounts'],
            template: `SELECT company_name, {0}\nFROM accounts\nWHERE mrr {1} 5000`,
            blanks: [
              { options: ['seats', 'mrr', 'plan_name'], answer: 1 },
              { options: ['>', '>=', '<', '='], answer: 0 }
            ],
            hints: [
              { kind: 'nudge', text: 'One account pays exactly $5,000. Does "more than" include it?' },
              { kind: 'concept', text: '`>` means more than. `>=` means that much or more.' }
            ]
          }
        ]
      },

      {
        id: 'w1-l4',
        title: 'Broken Binding',
        trail: 'blue',
        story: 'Someone left this query in the shared folder. It is supposed to list our Canadian accounts. It does not run.',
        after: 'An error is the database asking a question back. Read it, fix one thing, run again.',
        steps: [
          {
            type: 'fix',
            skills: ['where-text'],
            task: 'Fix the query so it shows `company_name` and `seats` for accounts in Canada. Run it first and read the error.',
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'WHERE'], values: ["'Canada'"] },
            broken: `SELECT company_name, seats\nFROM accounts\nWERE country = "Canada"`,
            solution: `SELECT company_name, seats FROM accounts WHERE country = 'Canada'`,
            hints: [
              { kind: 'nudge', text: 'There are two problems. Fix the first one, run again, and the second one shows up.' },
              { kind: 'concept', text: 'Keywords must be spelled exactly. Text values use single quotes. Double quotes mean a column name.' },
              { kind: 'partial', text: 'The last line should look like this.', code: "WHERE country = '...'" }
            ]
          }
        ]
      },

      {
        id: 'w1-l5',
        title: 'Leaderboard',
        trail: 'blue',
        story: "Marta's first slide is a leaderboard: who pays us the most.",
        after: 'Longhaul Cold Storage tops the board at $86,400 a month.',
        steps: [
          {
            type: 'choose',
            skills: ['order-by'],
            teach: '`ORDER BY` sorts the result. Smallest first is the default (`ASC`). Add `DESC` for largest first.',
            teachCode: `SELECT plan_name, price_per_seat FROM plans ORDER BY price_per_seat DESC`,
            task: "Pick the query that lists every account's `company_name` and `mrr`, highest `mrr` first.",
            tables: ['accounts'],
            options: [
              { sql: `SELECT company_name, mrr\nFROM accounts\nORDER BY mrr`, why: 'Without DESC, the smallest values come first.' },
              { sql: `SELECT company_name, mrr\nFROM accounts\nORDER BY mrr DESC` },
              { sql: `SELECT company_name, mrr\nFROM accounts\nORDER BY company_name DESC`, why: 'This sorts by name, Z to A. The task sorts by mrr.' }
            ],
            answer: 1,
            check: { ordered: true, orderKey: ['mrr'] },
            hints: [
              { kind: 'nudge', text: 'Two things to check in each option: which column it sorts by, and in which direction.' },
              { kind: 'concept', text: 'DESC is short for descending: big to small, Z to A, newest to oldest.' }
            ]
          },
          {
            type: 'write',
            skills: ['order-by'],
            task: 'Your turn. Show `company_name` and `signup_date` for every account, newest signup first.',
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'ORDER BY', 'DESC', 'ASC'] },
            solution: `SELECT company_name, signup_date FROM accounts ORDER BY signup_date DESC`,
            check: { ordered: true, orderKey: ['signup_date'] },
            hints: [
              { kind: 'nudge', text: 'Newest first means the latest dates on top. Is that ASC or DESC?' },
              { kind: 'concept', text: 'Dates sort like numbers. Later is larger.', code: 'ORDER BY column DESC' },
              { kind: 'partial', text: 'Finish the last clause.', code: 'SELECT company_name, signup_date FROM accounts ORDER BY ...' }
            ]
          }
        ]
      },

      {
        id: 'w1-l6',
        title: 'Podium',
        trail: 'blue',
        story: 'Nobody reads sixty rows on a slide. Marta wants podiums: the top two, the top three.',
        after: 'Three rows, in order. That is a slide.',
        corner: {
          title: 'LIMIT or TOP',
          body: 'LIMIT works the same way in Snowflake. Snowflake also accepts TOP right after SELECT, and both give you the same three rows. One warning for both databases: without ORDER BY, there is no promise about which rows you get.',
          code: `SELECT TOP 3 company_name, seats\nFROM accounts\nORDER BY seats DESC;`
        },
        steps: [
          {
            type: 'predict',
            skills: ['limit', 'order-by'],
            teach: '`LIMIT` keeps only the first rows of the result. It goes last, after ORDER BY, so the sort decides which rows are first.',
            task: 'Read the query. Tap `plans` to see the data, then predict the result.',
            question: 'What does this query return?',
            tables: ['plans'],
            sql: `SELECT plan_name, price_per_seat\nFROM plans\nORDER BY price_per_seat DESC\nLIMIT 2`,
            options: [
              { table: { columns: ['plan_name', 'price_per_seat'], rows: [['Flurry', 0], ['Drift', 12]] }, why: 'Those are the two cheapest plans. DESC puts the highest price first.' },
              { table: { columns: ['plan_name', 'price_per_seat'], rows: [['Summit', 40], ['Glacier', 25]] } },
              { table: { columns: ['plan_name', 'price_per_seat'], rows: [['Summit', 40], ['Glacier', 25], ['Drift', 12], ['Flurry', 0]] }, why: 'LIMIT 2 stops after two rows.' }
            ],
            answer: 1,
            hints: [
              { kind: 'nudge', text: 'Work in order: sort first, then cut.' },
              { kind: 'concept', text: 'ORDER BY price_per_seat DESC puts the most expensive plan on top. LIMIT 2 keeps the first two rows.' }
            ]
          },
          {
            type: 'write',
            skills: ['limit', 'order-by'],
            task: 'Show `company_name` and `seats` for the 3 accounts with the most seats, biggest first.',
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'ORDER BY', 'DESC', 'LIMIT'], values: ['3', '5', '10'] },
            solution: `SELECT company_name, seats FROM accounts ORDER BY seats DESC LIMIT 3`,
            check: { ordered: true, orderKey: ['seats'] },
            hints: [
              { kind: 'nudge', text: 'Sort so the biggest is on top, then keep three rows.' },
              { kind: 'concept', text: 'LIMIT is always the last line.', code: 'ORDER BY column DESC\nLIMIT 3' },
              { kind: 'partial', text: 'Add the final line.', code: 'SELECT company_name, seats FROM accounts ORDER BY seats DESC ...' }
            ]
          }
        ]
      },

      {
        id: 'w1-l7',
        title: 'Name Tags',
        trail: 'blue',
        story: 'Finance thinks in years, not months. They want yearly revenue, and they want the column to say so.',
        after: 'ARR is annual recurring revenue. Finance asks for it every week. Now it takes you one line.',
        corner: {
          title: 'Snowflake shouts column names',
          body: 'Snowflake stores names written without quotes in UPPERCASE, so your `arr` column comes back labeled ARR. It is the same column, and `arr`, `Arr`, and `ARR` all find it. Wrap a name in double quotes only when you need to keep its exact case.',
          code: `SELECT mrr * 12 AS arr     -- header shows ARR\nSELECT mrr * 12 AS "arr"   -- header shows arr`
        },
        steps: [
          {
            type: 'write',
            skills: ['alias'],
            teach: 'You can do math inside SELECT. `AS` gives the new column a name. That name is called an alias.',
            teachCode: `SELECT plan_name, price_per_seat * 12 AS yearly_price FROM plans`,
            task: 'Show `company_name` and yearly revenue (`mrr * 12`) for every account. Name the new column `arr`.',
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'AS', 'arr'], values: ['12'] },
            solution: `SELECT company_name, mrr * 12 AS arr FROM accounts`,
            check: { matchNames: ['arr'] },
            hints: [
              { kind: 'nudge', text: 'Do the multiplication right where a column name would go.' },
              { kind: 'concept', text: 'No quotes around the new name.', code: 'SELECT column * 2 AS new_name FROM table' },
              { kind: 'partial', text: 'Add the alias.', code: 'SELECT company_name, mrr * 12 AS ... FROM accounts' }
            ]
          }
        ]
      },

      {
        id: 'w1-l8',
        title: 'One of Each',
        trail: 'blue',
        story: 'Last slide before the big one: a map of where our customers are. Marta needs the list of countries, with no repeats.',
        after: 'Six countries. Sixty accounts folded into six rows.',
        steps: [
          {
            type: 'write',
            skills: ['distinct'],
            teach: '`DISTINCT` removes duplicate rows from the result. It goes right after SELECT.',
            teachCode: `SELECT DISTINCT plan_name FROM accounts`,
            task: 'List each `country` in `accounts` exactly once.',
            tables: ['accounts'],
            keys: { words: ['SELECT', 'DISTINCT', 'FROM'] },
            solution: `SELECT DISTINCT country FROM accounts`,
            hints: [
              { kind: 'nudge', text: 'A plain SELECT gives 60 rows, one per account. One extra word fixes that.' },
              { kind: 'concept', text: 'DISTINCT sits between SELECT and the column.', code: 'SELECT DISTINCT column FROM table' }
            ]
          }
        ]
      },

      {
        id: 'w1-boss',
        title: 'The 4 PM Review',
        trail: 'black',
        boss: true,
        story: 'It is 3:40. Marta is walking to the boardroom and needs three answers. Everything from today, combined.',
        after: 'Three answers, on time. Marta walked in with numbers nobody had seen before.',
        steps: [
          {
            type: 'write',
            skills: ['where-text', 'order-by', 'limit'],
            task: "Top customers: show `company_name`, `plan_name`, and `mrr` for the 5 accounts with status `'active'` that have the highest `mrr`. Highest first.",
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'DESC', 'LIMIT'], values: ["'active'", '5'] },
            solution: `SELECT company_name, plan_name, mrr FROM accounts WHERE status = 'active' ORDER BY mrr DESC LIMIT 5`,
            check: { ordered: true, orderKey: ['mrr'] },
            hints: [
              { kind: 'nudge', text: 'Three clauses after FROM: filter, then sort, then cut.' },
              { kind: 'concept', text: 'SQL insists on this order.', code: 'SELECT ...\nFROM ...\nWHERE ...\nORDER BY ...\nLIMIT ...' },
              { kind: 'partial', text: 'Fill in the sort and the cut.', code: "SELECT company_name, plan_name, mrr FROM accounts WHERE status = 'active' ORDER BY ... LIMIT ..." }
            ]
          },
          {
            type: 'write',
            skills: ['distinct', 'where-text', 'order-by'],
            task: "Reach: which industries have at least one account on the `'Summit'` plan? List each `industry` once, A to Z.",
            tables: ['accounts'],
            keys: { words: ['SELECT', 'DISTINCT', 'FROM', 'WHERE', 'ORDER BY'], values: ["'Summit'"] },
            solution: `SELECT DISTINCT industry FROM accounts WHERE plan_name = 'Summit' ORDER BY industry`,
            check: { ordered: true, orderKey: ['industry'] },
            hints: [
              { kind: 'nudge', text: 'Filter to Summit accounts first. Then remove the repeats.' },
              { kind: 'concept', text: 'A to Z is the default sort, so ORDER BY needs no extra word.', code: 'SELECT DISTINCT column FROM table WHERE ... ORDER BY column' },
              { kind: 'partial', text: 'Add the filter and the sort.', code: 'SELECT DISTINCT industry FROM accounts WHERE ... ORDER BY ...' }
            ]
          },
          {
            type: 'write',
            skills: ['alias', 'where-text', 'order-by'],
            teach: 'One new trick: you can sort by an alias, like `ORDER BY lost_arr DESC`.',
            task: "The hard question: for accounts with status `'churned'`, show `company_name` and the yearly revenue we lost (`mrr * 12`). Name it `lost_arr`. Biggest loss first.",
            tables: ['accounts'],
            keys: { words: ['SELECT', 'FROM', 'WHERE', 'AS', 'lost_arr', 'ORDER BY', 'DESC'], values: ["'churned'", '12'] },
            solution: `SELECT company_name, mrr * 12 AS lost_arr FROM accounts WHERE status = 'churned' ORDER BY lost_arr DESC`,
            check: { ordered: true, orderKey: ['lost_arr'], matchNames: ['lost_arr'] },
            hints: [
              { kind: 'nudge', text: 'Build it in pieces: the two columns, the filter, then the sort.' },
              { kind: 'concept', text: 'The alias goes in SELECT. The filter and the sort come after FROM.', code: 'SELECT name, amount * 12 AS yearly FROM table WHERE ... ORDER BY yearly DESC' },
              { kind: 'partial', text: 'Add the filter and the sort.', code: 'SELECT company_name, mrr * 12 AS lost_arr FROM accounts WHERE ... ORDER BY ...' }
            ]
          }
        ]
      }
    ]
  });
})();
