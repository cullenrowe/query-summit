/* ===== content/drills.js =====
 * Short review questions for the Daily Drill and for "Practice this skill".
 * Drill = a Step (see the schema in world1.js) plus { id, world, dataset }.
 * A drill only shows up once the player has met every skill it lists.
 */
(function () {
  'use strict';
  const D = 'frostbyte';
  QS.content.drills = [
    {
      id: 'd-w1-01', world: 'w1', dataset: D, type: 'write', skills: ['select-star'],
      task: 'Show everything in the `accounts` table.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM'] },
      solution: `SELECT * FROM accounts`,
      hints: [{ kind: 'nudge', text: 'The star stands for every column.' }]
    },
    {
      id: 'd-w1-02', world: 'w1', dataset: D, type: 'write', skills: ['select-cols'],
      task: 'Show `company_name`, `industry`, and `country` for every account.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM'] },
      solution: `SELECT company_name, industry, country FROM accounts`,
      hints: [{ kind: 'nudge', text: 'Three column names with commas between them.' }]
    },
    {
      id: 'd-w1-03', world: 'w1', dataset: D, type: 'write', skills: ['where-text'],
      task: 'Show `company_name` and `industry` for accounts in Germany.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM', 'WHERE'], values: ["'Germany'"] },
      solution: `SELECT company_name, industry FROM accounts WHERE country = 'Germany'`,
      hints: [{ kind: 'nudge', text: 'Filter on the country column. The text needs single quotes.' }]
    },
    {
      id: 'd-w1-04', world: 'w1', dataset: D, type: 'choose', skills: ['where-text'],
      task: 'Pick the query that finds accounts in Canada.', tables: ['accounts'],
      options: [
        { sql: `SELECT company_name\nFROM accounts\nWHERE country = Canada`, why: 'Without quotes, SQL looks for a column named Canada.' },
        { sql: `SELECT company_name\nFROM accounts\nWHERE country = "Canada"`, why: 'Double quotes also mean a column name. Text uses single quotes.' },
        { sql: `SELECT company_name\nFROM accounts\nWHERE country = 'Canada'` }
      ],
      answer: 2,
      hints: [{ kind: 'nudge', text: 'Look only at the quotes.' }]
    },
    {
      id: 'd-w1-05', world: 'w1', dataset: D, type: 'blank', skills: ['where-num'],
      task: 'Fill the blank: show accounts with fewer than 10 seats.', tables: ['accounts'],
      template: `SELECT company_name, seats\nFROM accounts\nWHERE seats {0} 10`,
      blanks: [{ options: ['>', '<', '=', '>='], answer: 1 }],
      hints: [{ kind: 'nudge', text: 'Fewer than. The small end of the symbol points at the small side.' }]
    },
    {
      id: 'd-w1-06', world: 'w1', dataset: D, type: 'write', skills: ['where-num', 'order-by'],
      task: 'Show `company_name` and `seats` for accounts with at least 500 seats, biggest first.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'DESC'], values: ['500'] },
      solution: `SELECT company_name, seats FROM accounts WHERE seats >= 500 ORDER BY seats DESC`,
      check: { ordered: true, orderKey: ['seats'] },
      hints: [{ kind: 'nudge', text: '"At least" includes 500 itself.' }]
    },
    {
      id: 'd-w1-07', world: 'w1', dataset: D, type: 'predict', skills: ['where-num'],
      task: 'Read the query. Tap `plans` to see the data, then predict the result.', question: 'Which plans come back?', tables: ['plans'],
      sql: `SELECT plan_name\nFROM plans\nWHERE price_per_seat > 12`,
      options: [
        { table: { columns: ['plan_name'], rows: [['Drift'], ['Glacier'], ['Summit']] }, why: 'Drift costs exactly 12, and 12 is not more than 12.' },
        { table: { columns: ['plan_name'], rows: [['Glacier'], ['Summit']] } },
        { table: { columns: ['plan_name'], rows: [['Flurry']] }, why: 'Flurry costs 0. The query keeps prices above 12.' }
      ],
      answer: 1,
      hints: [{ kind: 'nudge', text: 'One plan costs exactly 12.' }]
    },
    {
      id: 'd-w1-08', world: 'w1', dataset: D, type: 'fix', skills: ['order-by'],
      task: 'Fix the query so it lists `company_name` and `mrr`, highest `mrr` first.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM', 'ORDER BY', 'DESC'] },
      broken: `SELECT company_name, mrr\nFROM accounts\nORDER mrr DESC`,
      solution: `SELECT company_name, mrr FROM accounts ORDER BY mrr DESC`,
      check: { ordered: true, orderKey: ['mrr'] },
      hints: [{ kind: 'nudge', text: 'ORDER never travels alone.' }]
    },
    {
      id: 'd-w1-09', world: 'w1', dataset: D, type: 'write', skills: ['order-by', 'limit'],
      task: 'Show `company_name` and `signup_date` for our 5 oldest accounts, oldest first.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM', 'ORDER BY', 'ASC', 'DESC', 'LIMIT'], values: ['5'] },
      solution: `SELECT company_name, signup_date FROM accounts ORDER BY signup_date LIMIT 5`,
      check: { ordered: true, orderKey: ['signup_date'] },
      hints: [{ kind: 'nudge', text: 'Oldest means the earliest date. That is the default sort direction.' }]
    },
    {
      id: 'd-w1-10', world: 'w1', dataset: D, type: 'blank', skills: ['order-by', 'limit'],
      task: 'Fill the blanks: show the 2 plans with the fewest `max_seats`, smallest first.', tables: ['plans'],
      template: `SELECT plan_name, max_seats\nFROM plans\nORDER BY max_seats {0}\nLIMIT {1}`,
      blanks: [{ options: ['ASC', 'DESC'], answer: 0 }, { options: ['1', '2', '4'], answer: 1 }],
      hints: [{ kind: 'nudge', text: 'Smallest first is ascending.' }]
    },
    {
      id: 'd-w1-11', world: 'w1', dataset: D, type: 'fix', skills: ['select-cols'],
      task: 'This runs, but it returns one column instead of two. Fix it so it shows `company_name` and `seats`.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM'] },
      broken: `SELECT company_name seats\nFROM accounts`,
      solution: `SELECT company_name, seats FROM accounts`,
      hints: [{ kind: 'nudge', text: 'Something tiny is missing between the two column names.' }]
    },
    {
      id: 'd-w1-12', world: 'w1', dataset: D, type: 'write', skills: ['alias'],
      task: 'Show `plan_name` and the yearly price of one seat (`price_per_seat * 12`) from `plans`. Name the new column `yearly_price`.', tables: ['plans'],
      keys: { words: ['SELECT', 'FROM', 'AS', 'yearly_price'], values: ['12'] },
      solution: `SELECT plan_name, price_per_seat * 12 AS yearly_price FROM plans`,
      check: { matchNames: ['yearly_price'] },
      hints: [{ kind: 'nudge', text: 'Do the math in SELECT, then name it with AS.' }]
    },
    {
      id: 'd-w1-13', world: 'w1', dataset: D, type: 'choose', skills: ['alias'],
      task: 'Pick the query that returns a column named `seat_cost`.', tables: ['plans'],
      options: [
        { sql: `SELECT plan_name, price_per_seat AS seat_cost\nFROM plans` },
        { sql: `SELECT plan_name, price_per_seat\nFROM plans AS seat_cost`, why: 'This renames the table, not the column.' },
        { sql: `SELECT plan_name, seat_cost\nFROM plans`, why: 'There is no seat_cost column to read. AS creates the name.' }
      ],
      answer: 0,
      check: { matchNames: ['seat_cost'] },
      hints: [{ kind: 'nudge', text: 'AS belongs right after the thing it renames.' }]
    },
    {
      id: 'd-w1-14', world: 'w1', dataset: D, type: 'write', skills: ['distinct'],
      task: 'List each `industry` in `accounts` exactly once.', tables: ['accounts'],
      keys: { words: ['SELECT', 'DISTINCT', 'FROM'] },
      solution: `SELECT DISTINCT industry FROM accounts`,
      hints: [{ kind: 'nudge', text: 'One word after SELECT removes the repeats.' }]
    },
    {
      id: 'd-w1-15', world: 'w1', dataset: D, type: 'predict', skills: ['distinct'],
      task: 'Read the query. `accounts` has 60 rows. Tap it to look at the `status` column.', question: 'How many rows come back?', tables: ['accounts'],
      sql: `SELECT DISTINCT status\nFROM accounts`,
      options: [
        { text: '60 rows, one per account', why: 'DISTINCT folds identical values together.' },
        { text: '4 rows, one per status' },
        { text: '1 row' , why: 'There is more than one status in the table.' }
      ],
      answer: 1,
      hints: [{ kind: 'nudge', text: 'Count the different values: active, trial, past_due, churned.' }]
    },
    {
      id: 'd-w1-16', world: 'w1', dataset: D, type: 'write', skills: ['distinct', 'where-text'],
      task: "Which plans do our accounts in Japan use? List each `plan_name` once.", tables: ['accounts'],
      keys: { words: ['SELECT', 'DISTINCT', 'FROM', 'WHERE'], values: ["'Japan'"] },
      solution: `SELECT DISTINCT plan_name FROM accounts WHERE country = 'Japan'`,
      hints: [{ kind: 'nudge', text: 'Filter to Japan, and remove the repeats.' }]
    },
    {
      id: 'd-w1-17', world: 'w1', dataset: D, type: 'write', skills: ['limit'],
      task: 'Show `company_name` and `mrr` for the account with the single highest `mrr`.', tables: ['accounts'],
      keys: { words: ['SELECT', 'FROM', 'ORDER BY', 'DESC', 'LIMIT'], values: ['1'] },
      solution: `SELECT company_name, mrr FROM accounts ORDER BY mrr DESC LIMIT 1`,
      hints: [{ kind: 'nudge', text: 'Sort so the biggest is on top, then keep one row.' }]
    },
    {
      id: 'd-w1-18', world: 'w1', dataset: D, type: 'predict', skills: ['select-star'],
      task: 'Read the query. Tap `plans` to see the table.', question: 'How many columns come back?', tables: ['plans'],
      sql: `SELECT *\nFROM plans`,
      options: [
        { text: '1 column', why: 'The star is not one column. It stands for all of them.' },
        { text: '4 columns, every one in the table' },
        { text: 'It fails, because no columns are named', why: 'The star is the way to name them all at once.' }
      ],
      answer: 1,
      hints: [{ kind: 'nudge', text: 'The star is shorthand.' }]
    }
  ];
})();
