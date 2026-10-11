/* ===== engine/compare.js =====
 * Compares the player's result table with the goal table. This is the only judge of correctness.
 *
 * compare(player, goal, check) -> verdict
 *   player, goal: { columns: [{ name }], rows: [[...]] }
 *   check: { ordered, orderKey: [goal column names], matchNames: [goal column names] }
 * verdict: {
 *   pass, kind: 'ok' | 'columns' | 'rows' | 'names' | 'order', message,
 *   extra: [player row indexes not in the goal], missing: [goal row indexes the player lacks],
 *   badColumns: [goal column indexes whose values differ],
 *   columnIssue: true when the rows line up and exactly one column is off (mark the column, not rows)
 * }
 * Rules: row order is ignored unless check.ordered. Column names (aliases) are ignored unless
 * check.matchNames lists them. Column order is ignored. 5, 5.0 and '5' count as equal.
 */
(function () {
  'use strict';

  const NULL = '\u0000null';
  const SEP = '\u0001';

  function canon(v) {
    if (v === null || v === undefined) return NULL;
    if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6 + 0) : String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'string') return /^-?\d+(\.\d+)?$/.test(v) && v.length < 16 ? String(Math.round(Number(v) * 1e6) / 1e6 + 0) : v;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const lower = s => String(s).toLowerCase();

  function signature(table, c) {
    const vals = table.rows.map(r => canon(r[c]));
    vals.sort();
    return vals.join(SEP);
  }

  // For each goal column, pick the player column that holds the same values.
  function mapColumns(player, goal) {
    const n = goal.columns.length;
    const pSig = player.columns.map((_, c) => signature(player, c));
    const gSig = goal.columns.map((_, c) => signature(goal, c));
    const used = new Array(n).fill(false);
    const map = new Array(n).fill(-1);
    const pick = (g, test) => {
      if (map[g] !== -1) return;
      for (let p = 0; p < n; p++) if (!used[p] && test(p)) { map[g] = p; used[p] = true; return; }
    };
    // Exact matches first: same values and same name, then same values and same position, then same values.
    for (let g = 0; g < n; g++) pick(g, p => pSig[p] === gSig[g] && lower(player.columns[p].name) === lower(goal.columns[g].name));
    for (let g = 0; g < n; g++) pick(g, p => pSig[p] === gSig[g] && p === g);
    for (let g = 0; g < n; g++) pick(g, p => pSig[p] === gSig[g]);
    const exact = map.map(p => p !== -1);
    // Whatever is left has different values. Line it up by name, then by position.
    for (let g = 0; g < n; g++) pick(g, p => lower(player.columns[p].name) === lower(goal.columns[g].name));
    for (let g = 0; g < n; g++) pick(g, p => p === g);
    for (let g = 0; g < n; g++) pick(g, () => true);
    return { map: map, exact: exact };
  }

  function compare(player, goal, check) {
    check = check || {};
    const verdict = { pass: false, kind: 'ok', message: '', extra: [], missing: [], badColumns: [], columnIssue: false };
    const np = player.columns.length, ng = goal.columns.length;

    if (np !== ng) {
      verdict.kind = 'columns';
      const gNames = goal.columns.map(c => lower(c.name)), pNames = player.columns.map(c => lower(c.name));
      const extraCols = player.columns.filter(c => gNames.indexOf(lower(c.name)) === -1).map(c => c.name);
      const missingCols = goal.columns.filter(c => pNames.indexOf(lower(c.name)) === -1).map(c => c.name);
      let msg = 'Your result has ' + plural(np, 'column') + '. The goal has ' + ng + '.';
      if (np > ng && extraCols.length && extraCols.length <= 6) msg += ' Not needed: ' + extraCols.map(c => '`' + c + '`').join(', ') + '.';
      if (np < ng && missingCols.length) msg += ' Missing: ' + missingCols.map(c => '`' + c + '`').join(', ') + '.';
      if (np > ng && np - ng >= 2 && player.rows.length === goal.rows.length) msg += ' If you used `*`, name just the columns the task asks for.';
      verdict.message = msg;
      return verdict;
    }

    const cm = mapColumns(player, goal);
    const key = (row, order) => order.map(c => canon(row[c])).join(SEP);
    const gOrder = goal.columns.map((_, c) => c);
    const pKeys = player.rows.map(r => key(r, cm.map));
    const gKeys = goal.rows.map(r => key(r, gOrder));

    // Multiset difference.
    const need = new Map();
    gKeys.forEach((k, i) => { if (!need.has(k)) need.set(k, []); need.get(k).push(i); });
    pKeys.forEach((k, i) => { const left = need.get(k); if (left && left.length) left.shift(); else verdict.extra.push(i); });
    need.forEach(left => { for (const i of left) verdict.missing.push(i); });
    verdict.missing.sort((a, b) => a - b);

    if (verdict.extra.length || verdict.missing.length) {
      verdict.kind = 'rows';
      verdict.badColumns = cm.exact.map((ok, g) => ok ? -1 : g).filter(g => g !== -1);
      const e = verdict.extra.length, mi = verdict.missing.length;
      if (player.rows.length === 0) {
        verdict.message = 'Your query returned no rows. The goal has ' + goal.rows.length + '. Check the value in your filter: spelling, capital letters, and quotes all count.';
      } else if (player.rows.length === goal.rows.length && verdict.badColumns.length === 1 && ng > 1) {
        verdict.columnIssue = true;
        verdict.message = 'Right number of rows, but one column has different values. Compare yours with the goal column `' + goal.columns[verdict.badColumns[0]].name + '`.';
      } else if (e && !mi && verdict.extra.every(i => need.has(pKeys[i]))) {
        verdict.message = 'Every value is right, but ' + plural(e, 'row') + (e === 1 ? ' is a repeat' : ' are repeats') + ' (marked below). The goal lists each one once.';
      } else if (e && !mi) {
        verdict.message = 'You have ' + plural(e, 'row') + ' that should not be there (marked below). Your filter may be too loose, or a LIMIT is missing.';
      } else if (mi && !e) {
        verdict.message = plural(mi, 'row') + ' from the goal ' + (mi === 1 ? 'is' : 'are') + ' missing (marked in the goal). Your filter may be too strict, or a LIMIT is cutting rows off.';
      } else {
        verdict.message = plural(e, 'row') + ' should not be there, and ' + plural(mi, 'goal row') + (mi === 1 ? ' is' : ' are') + ' missing. Both are marked below.';
      }
      return verdict;
    }

    // Same rows. Now names, then order.
    if (check.matchNames && check.matchNames.length) {
      for (const want of check.matchNames) {
        const g = goal.columns.findIndex(c => lower(c.name) === lower(want));
        if (g === -1) continue;
        const got = player.columns[cm.map[g]].name;
        if (lower(got) !== lower(want)) {
          verdict.kind = 'names';
          verdict.columnIssue = true;
          verdict.badColumns = [g];
          verdict.message = 'The values are right. The goal wants that column named `' + want + '`, and yours is named `' + got + '`. Add `AS ' + want + '`.';
          return verdict;
        }
      }
    }

    if (check.ordered) {
      let cols = gOrder;
      if (check.orderKey && check.orderKey.length) {
        const idx = check.orderKey.map(nm => goal.columns.findIndex(c => lower(c.name) === lower(nm))).filter(i => i !== -1);
        if (idx.length) cols = idx;
      }
      const pSeq = player.rows.map(r => cols.map(g => canon(r[cm.map[g]])).join(SEP));
      const gSeq = goal.rows.map(r => cols.map(g => canon(r[g])).join(SEP));
      for (let i = 0; i < gSeq.length; i++) {
        if (pSeq[i] !== gSeq[i]) {
          verdict.kind = 'order';
          const reversed = pSeq.slice().reverse().every((k, j) => k === gSeq[j]);
          verdict.message = reversed
            ? 'Right rows, but upside down. Flip the sort direction (ASC or DESC).'
            : 'Right rows, wrong order. Check ORDER BY: the column, and ASC or DESC.';
          return verdict;
        }
      }
    }

    verdict.pass = true;
    verdict.message = 'Your result matches the goal.';
    return verdict;
  }

  QS.engine.compare = compare;
  QS.engine.canon = canon;
})();
