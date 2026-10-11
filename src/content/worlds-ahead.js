/* ===== content/worlds-ahead.js =====
 * Worlds 2 to 10. Not built yet, so they have no `levels` and show on the map as locked camps.
 * To build one: move it into its own file shaped like world1.js, give it a dataset and levels,
 * and delete the entry here. No engine or UI change is needed.
 */
(function () {
  'use strict';
  QS.content.worlds = QS.content.worlds || [];
  QS.content.worlds.push(
    { id: 'w2', n: 2, title: 'Sharper Filters', camp: 'Camp 2', altitude: 1100, caseName: 'Case 02: The Vanishing Trials',
      teaser: 'Trial accounts keep slipping away before they pay. Corner the pattern with AND, OR, IN, BETWEEN, LIKE, NULL checks, and CASE.' },
    { id: 'w3', n: 3, title: 'Summing It Up', camp: 'Camp 3', altitude: 1700, caseName: 'Case 03: The Number That Will Not Tie Out',
      teaser: 'Finance and Sales report different revenue for the same month. Count it yourself with COUNT, SUM, AVG, GROUP BY, and HAVING.' },
    { id: 'w4', n: 4, title: 'Joining Forces', camp: 'Camp 4', altitude: 2300, caseName: 'Case 04: The Orphan Invoices',
      teaser: 'Some invoices point to accounts that do not exist. Connect the tables with INNER, LEFT, FULL, and self joins.' },
    { id: 'w5', n: 5, title: 'Queries in Queries', camp: 'Camp 5', altitude: 2900, caseName: 'Case 05: The Discount Trail',
      teaser: 'Someone has been handing out discounts that nobody approved. Follow the trail with subqueries and CTEs.' },
    { id: 'w6', n: 6, title: 'Window Watch', camp: 'Camp 6', altitude: 3500, caseName: 'Case 06: The Downgrade Wave',
      teaser: 'Customers are quietly moving to cheaper plans. Rank, compare, and total with ROW_NUMBER, LAG, running sums, and QUALIFY.' },
    { id: 'w7', n: 7, title: 'Shape Shifting', camp: 'Camp 7', altitude: 4100, caseName: 'Case 07: The Midnight Renewals',
      teaser: 'Renewals keep landing on the wrong day. Untangle dates, strings, and type casting.' },
    { id: 'w8', n: 8, title: 'Semi-Structured', camp: 'Camp 8', altitude: 4600, caseName: 'Case 08: The Event Log',
      teaser: 'The answer is buried in usage events stored as JSON. Dig into nested fields and unnest arrays.' },
    { id: 'w9', n: 9, title: 'Building the Warehouse', camp: 'Camp 9', altitude: 5100, caseName: 'Case 09: The Clean Rebuild',
      teaser: 'Stop reading tables and start making them. CREATE, INSERT, UPDATE, DELETE, and MERGE.' },
    { id: 'w10', n: 10, title: 'Snowflake Lab', camp: 'The Summit', altitude: 5600, caseName: 'Case 10: The Summit',
      teaser: 'How Snowflake itself works: warehouses and credits, micro-partitions, Time Travel, cloning, and roles. Predict and choose. No pretend queries.' }
  );
})();
