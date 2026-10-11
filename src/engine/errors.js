/* ===== engine/errors.js =====
 * Turns raw DuckDB error text into a short explanation a beginner can act on.
 * explain(err, { sql, tables }) -> { title, body, raw }
 *   body may contain `backticks` for code. raw is the original message for the "details" toggle.
 */
(function () {
  'use strict';
  const S = () => QS.engine.sql;

  const CLAUSE_ORDER = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'QUALIFY', 'ORDER', 'LIMIT'];

  function cleanRaw(err) {
    let raw = String((err && err.message) || err || 'Unknown error');
    // Newer builds sometimes wrap the message in JSON.
    if (raw.charAt(0) === '{') {
      try { const j = JSON.parse(raw); if (j.exception_message) raw = (j.exception_type ? j.exception_type + ' Error: ' : '') + j.exception_message; } catch (e) { /* keep as is */ }
    }
    // DuckDB often repeats the "LINE 1: ..." pointer twice.
    const parts = raw.split(/\n\n(?=LINE \d+:)/);
    if (parts.length > 2 && parts[1] === parts[2]) parts.splice(2, 1);
    raw = parts.join('\n\n').trim();
    return raw.length > 700 ? raw.slice(0, 700) + ' ...' : raw;
  }

  function names(ctx) {
    const tables = (ctx.tables || []).map(t => t.name);
    const columns = [];
    for (const t of (ctx.tables || [])) for (const c of t.columns) if (columns.indexOf(c.name) === -1) columns.push(c.name);
    return { tables, columns };
  }

  const list = arr => arr.map(x => '`' + x + '`').join(', ');

  // Look for structural slips the parser reports badly.
  function structureHint(sql, known) {
    const sqlx = S();
    const typos = sqlx.findTypos(sql, known);
    if (typos.length) return '`' + typos[0].word + '` looks like a typo. Did you mean `' + typos[0].fix + '`?';
    const toks = sqlx.significant(sqlx.tokenize(sql));
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i], next = toks[i + 1];
      if (k.t === 'word' && (k.u === 'ORDER' || k.u === 'GROUP') && !(next && next.t === 'word' && next.u === 'BY')) {
        return '`' + k.u + '` needs `BY` right after it, like `' + k.u + ' BY ' + (next && next.t === 'word' ? next.v : 'column') + '`.';
      }
      if (k.v === ',' && next && next.t === 'word' && CLAUSE_ORDER.indexOf(next.u) > 0) {
        return 'There is a comma right before `' + next.u + '`. Remove that last comma.';
      }
    }
    // Clauses out of order (top level only).
    let depth = 0, last = -1, lastWord = '';
    for (const k of toks) {
      if (k.v === '(') depth++; else if (k.v === ')') depth--;
      if (depth !== 0 || k.t !== 'word') continue;
      const pos = CLAUSE_ORDER.indexOf(k.u);
      if (pos === -1) continue;
      if (pos < last && k.u !== 'SELECT') return '`' + k.u + '` is in the wrong place. It has to come before `' + lastWord + '`. The order is always: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.';
      if (pos > last) { last = pos; lastWord = k.u === 'ORDER' || k.u === 'GROUP' ? k.u + ' BY' : k.u; }
    }
    return null;
  }

  function explain(err, ctx) {
    ctx = ctx || {};
    const sql = ctx.sql || '';
    const raw = cleanRaw(err);
    const head = raw.split(/\n\nLINE \d+:/)[0];
    const nm = names(ctx);
    const known = nm.tables.concat(nm.columns);
    const sqlx = S();
    let m;

    if (err && err.qs === 'timeout') {
      return { title: 'That one ran too long', body: 'I stopped the query and reset the data. A join without a matching condition, or a missing WHERE, can multiply rows very quickly.', raw: raw };
    }

    // ---- Parser errors ----
    if (/Parser Error/.test(head)) {
      if (/unterminated quoted string/.test(head)) {
        return { title: 'A quote was never closed', body: "Text needs a single quote on both sides, like `'trial'`. One of yours is missing its partner.", raw: raw };
      }
      if (/unterminated quoted identifier/.test(head)) {
        return { title: 'A double quote was never closed', body: 'A `"` was opened and not closed. If you meant a text value, use single quotes instead.', raw: raw };
      }
      if (/SELECT clause without selection list/.test(head)) {
        return { title: 'SELECT is empty', body: 'SELECT needs at least one column name, or `*` for all of them, before FROM.', raw: raw };
      }
      const hint = structureHint(sql, known);
      if (/syntax error at end of input/.test(head)) {
        const toks = sqlx.significant(sqlx.tokenize(sql));
        const lastTok = toks[toks.length - 1];
        const lw = lastTok && lastTok.t === 'word' ? lastTok.u : '';
        let body = hint || 'The query stops too early. Something is missing at the end.';
        if (!hint && lw === 'FROM') body = '`FROM` needs a table name after it. Tables here: ' + list(nm.tables) + '.';
        else if (!hint && lw === 'WHERE') body = '`WHERE` needs a test after it, like `seats > 10`.';
        else if (!hint && lw === 'SELECT') body = '`SELECT` needs column names after it, or `*` for every column.';
        else if (!hint && lw === 'BY') body = '`BY` needs a column name after it.';
        else if (!hint && lw === 'LIMIT') body = '`LIMIT` needs a number after it, like `LIMIT 5`.';
        else if (!hint && lastTok && /^(=|>|<|>=|<=|<>|!=)$/.test(lastTok.v)) body = 'The comparison is missing its right-hand side. Put a value after `' + lastTok.v + '`.';
        return { title: 'The query ends too soon', body: body, raw: raw };
      }
      if ((m = /syntax error at or near "([\s\S]+?)"\s*(\n|$)/.exec(head))) {
        const near = m[1];
        if (hint) return { title: 'Syntax slip', body: hint, raw: raw };
        // Two names in a row inside SELECT usually means a missing comma.
        const toks = sqlx.significant(sqlx.tokenize(sql));
        const idx = toks.findIndex(k => k.v === near);
        const before = idx > 0 ? toks[idx - 1] : null;
        const plain = k => k && k.t === 'word' && !sqlx.KEYWORDS.has(k.u);
        if (plain(before) && plain(toks[idx])) {
          return { title: 'Syntax slip', body: 'SQL got stuck at `' + near + '`. If `' + before.v + '` and `' + near + '` are two separate columns, put a comma between them.', raw: raw };
        }
        // Two names side by side earlier in the SELECT list: the second was read as a nickname for the first.
        const fromAt = toks.findIndex(k => k.t === 'word' && k.u === 'FROM');
        for (let j = 1; j < (fromAt === -1 ? toks.length : fromAt) - 1; j++) {
          if (plain(toks[j]) && plain(toks[j + 1]) && toks[j - 1].v !== '.' && toks[j + 2] && toks[j + 2].v !== ',' && toks[j + 2].v !== '(') {
            return { title: 'Syntax slip', body: 'SQL got stuck at `' + near + '`. Look just before it: if `' + toks[j].v + '` and `' + toks[j + 1].v + '` are two separate columns, put a comma between them.', raw: raw };
          }
        }
        return { title: 'Syntax slip', body: 'SQL got stuck at `' + near + '`. Check the word just before it, and look for a missing comma, quote, or parenthesis.', raw: raw };
      }
      return { title: 'Syntax slip', body: hint || 'SQL could not read the query. Check the order of the clauses and the punctuation.', raw: raw };
    }

    // ---- Unknown table ----
    if ((m = /Table with name (\S+) does not exist/.exec(head))) {
      const t = m[1].replace(/[!"]/g, '');
      const guess = sqlx.closest(t, nm.tables, 3);
      let body;
      if (nm.columns.indexOf(t.toLowerCase()) !== -1) body = '`' + t + '` is a column, not a table. FROM needs a table name. Tables here: ' + list(nm.tables) + '.';
      else if (guess) body = 'There is no table named `' + t + '`. Did you mean `' + guess + '`?';
      else body = 'There is no table named `' + t + '`. Tables here: ' + list(nm.tables) + '.';
      return { title: 'No such table', body: body, raw: raw };
    }

    // ---- Unknown column ----
    if ((m = /Referenced column "([^"]+)" not found/.exec(head)) || (m = /does not have a column named "([^"]+)"/.exec(head))) {
      const c = m[1];
      const guess = sqlx.closest(c, nm.columns, Math.max(1, Math.min(3, Math.floor(c.length / 3))));
      let body;
      if (sql.indexOf('"' + c + '"') !== -1) {
        body = 'Double quotes mean a column name, so SQL went looking for a column called `' + c + '`. For a text value, use single quotes: `\'' + c + '\'`.';
      } else if (nm.tables.indexOf(c.toLowerCase()) !== -1) {
        body = '`' + c + '` is a table. SELECT and WHERE need column names (or `*`).';
      } else if (guess && guess.toLowerCase() !== c.toLowerCase()) {
        body = 'There is no column named `' + c + '`. Did you mean `' + guess + '`?';
      } else {
        body = 'There is no column named `' + c + '`. If it is a text value, wrap it in single quotes: `\'' + c + '\'`. Tap a table name to see its columns.';
      }
      return { title: 'No such column', body: body, raw: raw };
    }

    // ---- Grouping ----
    if ((m = /column "?([\w.]+)"? must appear in the GROUP BY clause/.exec(head))) {
      return { title: 'Grouping mismatch', body: '`' + m[1] + '` is in SELECT next to a COUNT or SUM, but it is not in GROUP BY. Every plain column in SELECT must also be listed in GROUP BY.', raw: raw };
    }
    if (/WHERE clause cannot contain aggregates/.test(head)) {
      return { title: 'Totals cannot go in WHERE', body: 'WHERE filters single rows before anything is counted or summed. To filter on a total, use HAVING after GROUP BY.', raw: raw };
    }

    // ---- Types ----
    if ((m = /Could not convert string '([^']*)' to (\w+)/.exec(head))) {
      return { title: 'Text where a number belongs', body: 'SQL tried to read `\'' + m[1] + '\'` as a number and could not. Numbers do not take quotes, and a number column can only be compared with a number.', raw: raw };
    }
    if ((m = /Cannot compare values of type (\w+) and type (\w+)/.exec(head))) {
      const a = m[1].replace('_LITERAL', ''), b = m[2].replace('_LITERAL', '');
      const dateTip = /DATE|TIMESTAMP/.test(a + b) ? " Dates go in single quotes, like `'2026-01-31'`." : '';
      return { title: 'Two different kinds of data', body: 'One side is ' + a + ' and the other is ' + b + ', so SQL cannot compare them.' + dateTip, raw: raw };
    }
    if ((m = /No function matches the given name and argument types '(.+?)\((.*?)\)'/.exec(head))) {
      const op = m[1], args = m[2].replace(/_LITERAL/g, '');
      const body = /^[+\-*/]$/.test(op)
        ? '`' + op + '` does not work on ' + args + '. Check that you are not doing math on a text column.'
        : '`' + op + '` cannot be used with ' + args + '. Check the kind of value you passed in.';
      return { title: 'Wrong kind of value', body: body, raw: raw };
    }

    // ---- Functions ----
    if ((m = /Function with name "?(\w+)"? does not exist/.exec(head))) {
      const dm = /Did you mean "([^"]+)"/.exec(raw);
      return { title: 'No such function', body: 'There is no function named `' + m[1] + '`.' + (dm ? ' Did you mean `' + dm[1] + '`?' : ' Check the spelling.'), raw: raw };
    }

    // ---- Joins ----
    if ((m = /Ambiguous reference to column name "([^"]+)"(?: \(use: (.+?)\))?/.exec(head))) {
      const opts = m[2] ? m[2].replace(/"/g, '`') : '`table.' + m[1] + '`';
      return { title: 'Which one?', body: 'More than one table has a column named `' + m[1] + '`. Say which you mean: ' + opts + '.', raw: raw };
    }

    // ---- Writes ----
    if ((m = /has (\d+) columns but (\d+) values were supplied/.exec(head))) {
      return { title: 'Wrong number of values', body: 'The table has ' + m[1] + ' columns, but you gave ' + m[2] + ' value' + (m[2] === '1' ? '' : 's') + '. Give one value per column, or list the columns you are filling.', raw: raw };
    }
    if (/already exists/.test(head)) {
      return { title: 'That name is taken', body: 'Something with that name already exists. Pick another name, or drop the old one first.', raw: raw };
    }
    if (/query was canceled|INTERRUPT/i.test(head)) {
      return { title: 'Query stopped', body: 'The query was stopped before it finished.', raw: raw };
    }

    const first = head.replace(/^[A-Za-z ]+Error:\s*/, '').split('\n')[0];
    return { title: 'The database could not run that', body: first.length > 180 ? first.slice(0, 180) + ' ...' : first, raw: raw };
  }

  QS.engine.explainError = explain;
})();
