// Generates src/content/datasets.js. Run: node tools/gen-data.js
// The output is frozen, plain data. Re-run only when you want to change the practice data.
// Every level depends on properties checked by the asserts at the bottom.
const fs = require('fs');
const path = require('path');

// Small seeded random generator so the data is the same on every run.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = mulberry32(1);
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const PLANS = [
  ['Flurry', 0, 5, 'Community'],
  ['Drift', 12, 50, 'Email'],
  ['Glacier', 25, 500, 'Priority'],
  ['Summit', 40, 5000, 'Dedicated'],
];
const PRICE = Object.fromEntries(PLANS.map(p => [p[0], p[1]]));

// 60 fictional customers, each with a believable industry.
const COMPANIES = {
  Retail: ['Ember Trail Outfitters', 'Cinder & Pine Coffee', 'Maple Hollow Foods', 'Wolf Creek Hardware', 'Tidepool Toys', 'Saffron Lane Market', 'Bluebird Bikes', 'Copper Kettle Bakery'],
  Healthcare: ['Alpenglow Health', 'Blue Spruce Dental', 'Coldwater Clinics', 'Meadowlark Pediatrics', 'Stillwater Physical Therapy', 'Juniper Vision', 'Redwood Family Care', 'Sagebrush Veterinary'],
  Logistics: ['Birchline Logistics', 'Tamarack Freight', 'Kestrel Air Cargo', 'Longhaul Cold Storage', 'Switchback Couriers', 'Harborline Shipping', 'Mule Deer Moving'],
  Education: ['Snowline Schools', 'Pinecrest Academy', 'Larkspur Language Lab', 'Quill & Compass Tutoring', 'Timberline College', 'Bright Fox Preschools', 'Northfield Coding Camp'],
  Finance: ['Coldstream Credit Union', 'Slate Peak Bank', 'Aspen Ledger Accounting', 'Foxglove Insurance', 'Ridgeback Lending', 'Cairn Wealth Advisors', 'Pebble Payments'],
  Media: ['Lantern Hill Media', 'Paper Crane Studios', 'Echo Canyon Podcasts', 'Driftless Films', 'Marmot Press', 'Static Peak Radio', 'Pixel Pines Games'],
  Manufacturing: ['Sawtooth Robotics', 'Anvil & Oak Furniture', 'Ironwood Tools', 'Flint River Ceramics', 'Windbreak Textiles', 'Basalt Batteries', 'Cedar Gear Works', 'Tin Lantern Lighting'],
  Software: ['Nimbus Ridge Software', 'Otter Creek Apps', 'Hollow Log Labs', 'Tern Island Systems', 'Packrat Data', 'Moss & Stone Digital', 'Lichen Labs', 'Quiet Owl Security'],
};

function build(seed) {
  rnd = mulberry32(seed);
  function shuffled(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function spread(counts) { const out = []; for (const [k, n] of Object.entries(counts)) for (let i = 0; i < n; i++) out.push(k); return shuffled(out); }

  const names = shuffled(Object.entries(COMPANIES).flatMap(([ind, list]) => list.map(n => [n, ind])));
  const countries = spread({ 'United States': 26, 'Canada': 8, 'United Kingdom': 8, 'Germany': 7, 'Australia': 6, 'Japan': 5 });
  const plans = spread({ Flurry: 8, Drift: 20, Glacier: 20, Summit: 12 });
  const statuses = spread({ active: 38, trial: 8, churned: 9, past_due: 5 });

  // Unique seat counts per plan so "top N" questions never tie.
  const usedSeats = new Set();
  function seatsFor(plan) {
    const range = { Flurry: [1, 5], Drift: [6, 50], Glacier: [52, 480], Summit: [510, 2400] }[plan];
    for (let tries = 0; tries < 500; tries++) {
      let s = between(range[0], range[1]);
      if (plan === 'Summit') s = Math.round(s / 10) * 10;
      if (plan === 'Flurry' || !usedSeats.has(s)) { usedSeats.add(s); return s; }
    }
    throw new Error('no seats left for ' + plan);
  }

  // Unique signup dates. Trials are recent (the story takes place in October 2026).
  const usedDates = new Set();
  function dateBetween(a, b) {
    const lo = Date.parse(a), hi = Date.parse(b);
    for (;;) { const d = new Date(lo + Math.floor(rnd() * ((hi - lo) / 864e5 + 1)) * 864e5).toISOString().slice(0, 10); if (!usedDates.has(d)) { usedDates.add(d); return d; } }
  }

  const accounts = names.map(([company, industry], i) => {
    const status = statuses[i];
    let plan = plans[i];
    const seats = seatsFor(plan);
    const signup = status === 'trial' ? dateBetween('2026-08-18', '2026-10-02') : status === 'churned' ? dateBetween('2023-02-01', '2025-06-30') : dateBetween('2023-02-01', '2026-07-31');
    const mrr = status === 'trial' ? 0 : seats * PRICE[plan];
    return { company, industry, country: countries[i], plan, seats, mrr, signup, status };
  });

  // One hand-placed row: a Glacier account paying exactly $5,000, so ">" and ">=" give different answers.
  const exact = accounts.find(a => a.plan === 'Glacier' && a.status === 'active');
  usedSeats.delete(exact.seats); exact.seats = 200; exact.mrr = 5000; usedSeats.add(200);

  accounts.sort((a, b) => a.signup < b.signup ? -1 : 1);
  const accountRows = accounts.map((a, i) => [1001 + i, a.company, a.industry, a.country, a.plan, a.seats, a.mrr, a.signup, a.status]);

  // ---- Checks the levels rely on ----
  const assert = (cond, msg) => { if (!cond) throw new Error('DATA CHECK FAILED: ' + msg); };
  const col = { id: 0, company: 1, industry: 2, country: 3, plan: 4, seats: 5, mrr: 6, signup: 7, status: 8 };
  const by = (k, dir) => (a, b) => (a[col[k]] < b[col[k]] ? -1 : a[col[k]] > b[col[k]] ? 1 : 0) * (dir || 1);
  assert(accountRows.length === 60, '60 accounts');
  assert(new Set(accountRows.map(r => r[col.signup])).size === 60, 'unique signup dates');
  const seatSorted = accountRows.slice().sort(by('seats', -1));
  assert(new Set(seatSorted.slice(0, 12).map(r => r[col.seats])).size === 12, 'top seat counts are unique');
  const active = accountRows.filter(r => r[col.status] === 'active').sort(by('mrr', -1));
  assert(new Set(active.slice(0, 8).map(r => r[col.mrr])).size === 8, 'top active MRR values are unique');
  const churned = accountRows.filter(r => r[col.status] === 'churned');
  assert(churned.filter(r => r[col.mrr] > 0).length >= 5, 'enough paying churned accounts');
  assert(new Set(churned.map(r => r[col.mrr])).size >= churned.length - 2, 'churned MRR mostly unique');
  const over5k = accountRows.filter(r => r[col.mrr] > 5000).length, atLeast5k = accountRows.filter(r => r[col.mrr] >= 5000).length;
  assert(atLeast5k === over5k + 1, 'exactly one account at $5,000');
  assert(over5k >= 8 && over5k <= 30, 'a sensible number of big spenders: ' + over5k);
  assert(accountRows.filter(r => r[col.country] === 'Canada').length === 8, '8 Canadian accounts');
  assert(accountRows.filter(r => r[col.status] === 'trial').length === 8, '8 trials');
  const summitIndustries = new Set(accountRows.filter(r => r[col.plan] === 'Summit').map(r => r[col.industry]));
  assert(summitIndustries.size >= 4 && summitIndustries.size <= 6, 'Summit spans several industries, not all: ' + summitIndustries.size);


  return { accountRows, col, by, over5k, summitIndustries, seatSorted, active, churned };
}

let built = null, seedUsed = 0;
for (let seed = 1; seed <= 500 && !built; seed++) { try { built = build(seed); seedUsed = seed; } catch (e) { if (!/DATA CHECK/.test(e.message)) throw e; } }
if (!built) { console.error('No seed passed the data checks.'); process.exit(1); }
const { accountRows, col, by, over5k, summitIndustries, seatSorted, active, churned } = built;
console.log('seed used:', seedUsed);

const dataset = {
  id: 'frostbyte',
  label: 'Frostbyte Cloud',
  about: 'Customer accounts and plans for Frostbyte Cloud, a fictional subscription software company.',
  tables: [
    {
      name: 'plans',
      about: 'The four plans Frostbyte Cloud sells.',
      columns: [
        { name: 'plan_name', type: 'VARCHAR', about: 'Name of the plan' },
        { name: 'price_per_seat', type: 'INTEGER', about: 'Monthly price for one seat, in US dollars' },
        { name: 'max_seats', type: 'INTEGER', about: 'Most seats an account can have on this plan' },
        { name: 'support', type: 'VARCHAR', about: 'Support level included' },
      ],
      rows: PLANS,
    },
    {
      name: 'accounts',
      about: 'One row per customer company.',
      columns: [
        { name: 'account_id', type: 'INTEGER', about: 'Unique ID for the account' },
        { name: 'company_name', type: 'VARCHAR', about: 'Customer company' },
        { name: 'industry', type: 'VARCHAR', about: 'What the customer does' },
        { name: 'country', type: 'VARCHAR', about: 'Where the customer is based' },
        { name: 'plan_name', type: 'VARCHAR', about: 'Which plan they are on' },
        { name: 'seats', type: 'INTEGER', about: 'Number of user seats' },
        { name: 'mrr', type: 'INTEGER', about: 'Monthly recurring revenue in US dollars. Trials pay 0. For churned accounts, what they paid in their last month.' },
        { name: 'signup_date', type: 'DATE', about: 'Day they signed up' },
        { name: 'status', type: 'VARCHAR', about: "One of 'active', 'trial', 'past_due', 'churned'" },
      ],
      rows: accountRows,
    },
  ],
};

const rowsJs = rows => '[\n' + rows.map(r => '        ' + JSON.stringify(r)).join(',\n') + '\n      ]';
let js = `/* ===== content/datasets.js =====
 * Practice data. Generated by tools/gen-data.js, then frozen. Plain data only.
 * Schema: QS.content.datasets[id] = { id, label, about, tables: [ { name, about, columns: [{ name, type, about }], rows: [[...]] } ] }
 * Column types are DuckDB type names (VARCHAR, INTEGER, DATE, ...). Each row is an array in column order.
 */
(function () {
  'use strict';
  QS.content.datasets = QS.content.datasets || {};
  QS.content.datasets.${dataset.id} = {
    id: ${JSON.stringify(dataset.id)},
    label: ${JSON.stringify(dataset.label)},
    about: ${JSON.stringify(dataset.about)},
    tables: [
`;
for (const t of dataset.tables) {
  js += `    {\n      name: ${JSON.stringify(t.name)},\n      about: ${JSON.stringify(t.about)},\n      columns: [\n` +
    t.columns.map(c => '        ' + JSON.stringify(c)).join(',\n') + `\n      ],\n      rows: ${rowsJs(t.rows)}\n    },\n`;
}
js += `    ]\n  };\n})();\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'content', 'datasets.js'), js);

// Print a summary for review.
const count = (k) => accountRows.reduce((m, r) => (m[r[col[k]]] = (m[r[col[k]]] || 0) + 1, m), {});
console.log('accounts:', accountRows.length, '| status', count('status'), '| plan', count('plan'), '| country', count('country'));
console.log('mrr > 5000:', over5k, '| Summit industries:', [...summitIndustries].sort().join(', '));
console.log('top 4 seats:', seatSorted.slice(0, 4).map(r => r[col.company] + ' ' + r[col.seats]).join(' | '));
console.log('top 6 active mrr:', active.slice(0, 6).map(r => r[col.company] + ' ' + r[col.mrr]).join(' | '));
console.log('churned:', churned.sort(by('mrr', -1)).map(r => r[col.company] + ' ' + r[col.mrr]).join(' | '));
console.log('newest 3:', accountRows.slice(-3).map(r => r[col.company] + ' ' + r[col.signup] + ' ' + r[col.status]).join(' | '));
console.log('canada:', accountRows.filter(r => r[col.country] === 'Canada').map(r => r[col.company]).join(', '));
