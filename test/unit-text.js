// Node-only checks for the text tools (no database needed).
global.window = global; global.document = { baseURI: 'http://x/' };
require('../src/core.js'); require('../src/engine/sqltext.js'); require('../src/engine/errors.js'); require('../src/engine/compare.js');
const { format, inspect, findTypos, highlight } = QS.engine.sql;
const samples = [
  "select * from plans",
  "select company_name,seats from accounts where status='trial'",
  "SELECT company_name, plan_name, mrr FROM accounts WHERE status = 'active' ORDER BY mrr DESC LIMIT 5",
  "select distinct industry from accounts where plan_name='Summit' order by industry",
  "select company_name, mrr*12 as lost_arr from accounts where status='churned' and mrr between 100 and 5000 or seats>3 order by lost_arr desc",
  "select a.company_name, p.price_per_seat from accounts a left join plans p on a.plan_name=p.plan_name and p.price_per_seat>0 where a.seats in (select max(seats) from accounts where country='Japan')",
  "with big as (select * from accounts where mrr>5000) select country, count(*) as n, sum(mrr)::int total from big group by country having count(*)>1 order by n desc;",
  "select company_name, row_number() over (partition by country order by mrr desc) rn from accounts qualify rn=1",
  "select -1, a.*, left(company_name,3), count(distinct country) from accounts a -- note\nwhere seats >= -5",
  "insert into t (a,b) values (1,'x'),(2,'y'); update t set a=3 where b='x'; delete from t where a=3",
  "select case when mrr>5000 then 'big' else 'small' end as size, extract(year from signup_date) y from accounts",
];
for (const s of samples) { const f = format(s); const again = format(f); console.log(f + '\n' + (again === f ? '' : '!!! NOT IDEMPOTENT\n' + again + '\n') + '---'); }
console.log(JSON.stringify(['select 1', 'drop table x', 'select 1; select 2', 'with a as (select 1) delete from t', "copy t to 'x.csv'", "select * from read_csv('a.csv')", "select * from 'http://x/y.parquet'", '', '-- hi', 'SET threads=1', 'describe accounts'].map(q => [q, inspect(q)])));
console.log(JSON.stringify(findTypos('SELECT company_name, seats FROM accounts WERE country = "Canada"', ['accounts', 'company_name', 'seats', 'country'])));
console.log(JSON.stringify(findTypos('selct * form plans', ['plans'])));
console.log(highlight("SELECT count(*) AS n FROM t WHERE a = 'x' -- c"));
const ex = (msg, sql) => { const r = QS.engine.explainError(new Error(msg), { sql, tables: [{ name: 'accounts', columns: [{ name: 'company_name' }, { name: 'seats' }, { name: 'country' }, { name: 'mrr' }] }, { name: 'plans', columns: [{ name: 'plan_name' }] }] }); console.log('[' + r.title + '] ' + r.body); };
ex('Parser Error: syntax error at or near "country"\n\nLINE 3: WERE country = "Canada"\n             ^\n\nLINE 3: WERE country = "Canada"\n             ^', 'SELECT company_name, seats\nFROM accounts\nWERE country = "Canada"');
ex('Binder Error: Referenced column "Canada" not found in FROM clause!\nCandidate bindings: "country"\n\nLINE 3: ...', 'SELECT company_name, seats\nFROM accounts\nWHERE country = "Canada"');
ex('Binder Error: Referenced column "Canada" not found in FROM clause!', 'SELECT company_name FROM accounts WHERE country = Canada');
ex('Binder Error: Referenced column "compny_name" not found in FROM clause!', 'SELECT compny_name FROM accounts');
ex('Parser Error: syntax error at or near "mrr"', 'SELECT company_name, mrr FROM accounts ORDER mrr DESC');
ex('Parser Error: syntax error at or near "seats"', 'SELECT company_name mrr seats FROM accounts');
ex('Parser Error: syntax error at or near "FROM"', 'SELECT company_name, FROM accounts');
ex('Parser Error: syntax error at or near "WHERE"', "SELECT * FROM accounts ORDER BY mrr WHERE status = 'x'");
ex('Parser Error: syntax error at end of input', 'SELECT * FROM');
ex('Catalog Error: Table with name account does not exist!\nDid you mean "accounts"?', 'SELECT * FROM account');
ex('Catalog Error: Table with name customers does not exist!', 'SELECT * FROM customers');
ex("Conversion Error: Could not convert string 'abc' to INT32", '');
ex('Binder Error: Cannot compare values of type DATE and type INTEGER_LITERAL - an explicit cast is required', '');
ex("Binder Error: No function matches the given name and argument types '+(VARCHAR, INTEGER_LITERAL)'. You might need", '');
ex('Catalog Error: Scalar Function with name lenght does not exist!\nDid you mean "length"?', '');
ex('Something odd happened', '');
// compare
const T = (cols, rows) => ({ columns: cols.map(n => ({ name: n })), rows });
const c = (a, b, k) => { const v = QS.engine.compare(a, b, k); console.log((v.pass ? 'PASS' : 'FAIL:' + v.kind) + ' ' + v.message + ' extra=' + v.extra + ' missing=' + v.missing); };
const goal = T(['name', 'mrr'], [['a', 30], ['b', 20], ['c', 10]]);
c(T(['mrr', 'company'], [[10, 'c'], [30, 'a'], [20, 'b']]), goal, {});
c(T(['name', 'mrr'], [['c', 10], ['b', 20], ['a', 30]]), goal, { ordered: true, orderKey: ['mrr'] });
c(T(['name', 'mrr'], [['a', 30], ['c', 10], ['b', 20]]), goal, { ordered: true });
c(T(['name', 'mrr'], [['a', 30], ['b', 20]]), goal, {});
c(T(['name', 'mrr'], [['a', 30], ['b', 20], ['c', 10], ['d', 5]]), goal, {});
c(T(['name', 'mrr', 'x'], [['a', 30, 1], ['b', 20, 1], ['c', 10, 1]]), goal, {});
c(T(['name'], [['a'], ['b'], ['c']]), goal, {});
c(T(['name', 'seats'], [['a', 3], ['b', 2], ['c', 1]]), goal, {});
c(T(['name', '(mrr * 1)'], [['a', 30], ['b', 20], ['c', 10]]), goal, { matchNames: ['mrr'] });
c(T(['name', 'mrr'], []), goal, {});
c(T(['name', 'mrr'], [['a', '30.0'], ['b', 20.0000001], ['c', 10]]), goal, {});
