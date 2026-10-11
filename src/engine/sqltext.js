/* ===== engine/sqltext.js =====
 * Everything that treats SQL as text: tokenizer, syntax highlighter, formatter,
 * a safety inspector (read-only or not), and a typo finder for friendlier errors.
 * None of this is used to judge answers. Answers are judged by comparing results.
 */
(function () {
  'use strict';

  const KEYWORDS = new Set(('SELECT FROM WHERE AND OR NOT IN BETWEEN LIKE ILIKE IS NULL AS ORDER BY GROUP HAVING LIMIT OFFSET DISTINCT ASC DESC ' +
    'CASE WHEN THEN ELSE END JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL ON USING UNION ALL EXCEPT INTERSECT WITH RECURSIVE OVER PARTITION QUALIFY ' +
    'ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE VIEW DROP ALTER ADD COLUMN MERGE MATCHED ' +
    'EXISTS ANY SOME TRUE FALSE NULLS FIRST LAST EXCLUDE LATERAL INTERVAL IF REPLACE TEMP TEMPORARY PRIMARY KEY DEFAULT TOP FETCH ONLY ' +
    'DESCRIBE SHOW EXPLAIN SUMMARIZE TABLES FILTER WITHIN TRUNCATE RETURNING').split(' '));

  const FUNCTIONS = new Set(('COUNT SUM AVG MIN MAX ROUND FLOOR CEIL CEILING ABS UPPER LOWER LENGTH TRIM LTRIM RTRIM SUBSTRING SUBSTR CONCAT COALESCE NULLIF ' +
    'CAST TRY_CAST ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE DATE_TRUNC DATE_PART DATEDIFF DATE_DIFF DATEADD DATE_ADD EXTRACT ' +
    'YEAR MONTH DAY NOW CURRENT_DATE STRFTIME STRPTIME UNNEST JSON_EXTRACT JSON_EXTRACT_STRING LIST_VALUE ARRAY_AGG STRING_AGG LISTAGG IFNULL IFF GREATEST LEAST ' +
    'SPLIT_PART LEFT RIGHT REPLACE CONTAINS STARTS_WITH MEDIAN STDDEV ANY_VALUE').split(' '));

  // ---------- Tokenizer ----------
  // Token: { t: 'ws' | 'com' | 'str' | 'qid' | 'num' | 'word' | 'op', v: text, u: UPPERCASE (words only), at: start index }
  const OPS3 = ['->>'];
  const OPS2 = ['::', '<>', '!=', '<=', '>=', '||', '->', ':=', '=>', '//'];

  function tokenize(sql) {
    const out = [];
    const n = sql.length;
    let i = 0;
    while (i < n) {
      const c = sql[i];
      const start = i;
      if (/\s/.test(c)) {
        while (i < n && /\s/.test(sql[i])) i++;
        out.push({ t: 'ws', v: sql.slice(start, i), at: start });
      } else if (c === '-' && sql[i + 1] === '-') {
        while (i < n && sql[i] !== '\n') i++;
        out.push({ t: 'com', v: sql.slice(start, i), at: start });
      } else if (c === '/' && sql[i + 1] === '*') {
        const end = sql.indexOf('*/', i + 2);
        i = end === -1 ? n : end + 2;
        out.push({ t: 'com', v: sql.slice(start, i), at: start });
      } else if (c === "'" || c === '"') {
        i++;
        while (i < n) {
          if (sql[i] === c) { if (sql[i + 1] === c) { i += 2; continue; } i++; break; }
          i++;
        }
        out.push({ t: c === "'" ? 'str' : 'qid', v: sql.slice(start, i), at: start });
      } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(sql.slice(i));
        i += m[0].length;
        out.push({ t: 'num', v: m[0], at: start });
      } else if (/[A-Za-z_]/.test(c)) {
        while (i < n && /[A-Za-z0-9_$]/.test(sql[i])) i++;
        const v = sql.slice(start, i);
        out.push({ t: 'word', v: v, u: v.toUpperCase(), at: start });
      } else {
        const three = sql.substr(i, 3), two = sql.substr(i, 2);
        const v = OPS3.indexOf(three) !== -1 ? three : OPS2.indexOf(two) !== -1 ? two : c;
        i += v.length;
        out.push({ t: 'op', v: v, at: start });
      }
    }
    return out;
  }

  const significant = toks => toks.filter(k => k.t !== 'ws' && k.t !== 'com');

  // ---------- Highlighter ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function highlight(sql) {
    const toks = tokenize(sql);
    let html = '';
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i];
      let cls = null;
      if (k.t === 'com') cls = 'c';
      else if (k.t === 'str') cls = 's';
      else if (k.t === 'qid') cls = 'i';
      else if (k.t === 'num') cls = 'n';
      else if (k.t === 'op') cls = 'p';
      else if (k.t === 'word') {
        let j = i + 1;
        while (toks[j] && toks[j].t === 'ws') j++;
        const call = toks[j] && toks[j].v === '(';
        if (call && FUNCTIONS.has(k.u)) cls = 'f';
        else if (KEYWORDS.has(k.u)) cls = 'k';
        else if (call) cls = 'f';
      }
      html += cls ? '<span class="tk-' + cls + '">' + esc(k.v) + '</span>' : esc(k.v);
    }
    return html;
  }

  // ---------- Inspector ----------
  const READ_FIRST = new Set(['SELECT', 'WITH', 'FROM', 'VALUES', 'TABLE', 'DESCRIBE', 'DESC', 'SHOW', 'EXPLAIN', 'SUMMARIZE', 'PIVOT', 'UNPIVOT']);
  const WRITE_WORDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE']);
  const OTHER_CHANGE_FIRST = new Set(['BEGIN', 'START', 'COMMIT', 'ROLLBACK', 'ABORT', 'PREPARE', 'EXECUTE', 'DEALLOCATE', 'COMMENT', 'GRANT', 'REVOKE', 'ANALYZE', 'REPLACE']);
  const BLOCKED_FIRST = new Set(['COPY', 'ATTACH', 'DETACH', 'INSTALL', 'LOAD', 'PRAGMA', 'EXPORT', 'IMPORT', 'CALL', 'SET', 'RESET', 'USE', 'CHECKPOINT', 'VACUUM', 'FORCE']);
  const FILE_FUNCS = /^(READ_|PARQUET_SCAN|GLOB$|SNIFF_CSV|DUCKDB_EXTENSIONS)/;

  // Returns { empty, statements, first, readOnly, changesData, blocked } without running anything.
  // readOnly: every statement starts with a known read command. changesData: a known write command is present.
  // A typo like SELCT is neither, so it still reaches the database and gets a proper error message.
  function inspect(sql) {
    const toks = significant(tokenize(sql || ''));
    const stmts = [[]];
    for (const k of toks) { if (k.t === 'op' && k.v === ';') stmts.push([]); else stmts[stmts.length - 1].push(k); }
    const real = stmts.filter(s => s.length);
    const info = { empty: real.length === 0, statements: real.length, first: null, readOnly: true, changesData: false, blocked: null };
    for (const s of real) {
      const first = s[0].t === 'word' ? s[0].u : s[0].v;
      if (!info.first) info.first = first;
      if (BLOCKED_FIRST.has(first)) info.blocked = info.blocked || first;
      if (!READ_FIRST.has(first)) info.readOnly = false;
      if (WRITE_WORDS.has(first) || OTHER_CHANGE_FIRST.has(first)) info.changesData = true;
      for (let i = 0; i < s.length; i++) {
        const k = s[i];
        if (k.t === 'word' && WRITE_WORDS.has(k.u) && (first === 'WITH' || first === 'EXPLAIN')) { info.readOnly = false; info.changesData = true; }
        if (k.t === 'word' && FILE_FUNCS.test(k.u) && s[i + 1] && s[i + 1].v === '(') info.blocked = info.blocked || k.v;
        if (k.t === 'str' && i > 0 && s[i - 1].t === 'word' && (s[i - 1].u === 'FROM' || s[i - 1].u === 'JOIN')) info.blocked = info.blocked || 'reading files';
      }
    }
    return info;
  }

  // ---------- Formatter ----------
  // Uppercases keywords and puts each clause on its own line. Only whitespace and keyword case change.
  const BREAK_BEFORE = new Set(['FROM', 'WHERE', 'HAVING', 'QUALIFY', 'LIMIT', 'OFFSET', 'VALUES', 'SET', 'UNION', 'EXCEPT', 'INTERSECT', 'RETURNING']);
  const JOIN_LEAD = new Set(['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL']);
  const SELECT_END = new Set(['FROM', 'WHERE', 'GROUP', 'HAVING', 'QUALIFY', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT']);
  const TIGHT_BEFORE = new Set([',', ')', ';', '.', '::']);
  const TIGHT_AFTER = new Set(['(', '.', '::']);

  function format(sql) {
    const toks = tokenize(sql || '').filter(k => k.t !== 'ws');
    if (!toks.length) return '';
    let res = '';
    let depth = 0;            // indent level (subqueries)
    const parens = [];        // 'sub' or 'fn' for each open paren
    const clauseAt = [''];    // current clause per depth
    const wrapAt = [false];   // break the SELECT list of this depth onto separate lines?
    let between = 0;          // BETWEEN ... AND pairs still open
    let tight = false;        // no space before the next token
    let forceBreak = null;    // 'nl' or 'nl+' forced for the next token
    const pad = extra => '  '.repeat(depth + (extra ? 1 : 0));
    const newline = extra => { res = res.replace(/[ \t]+$/, ''); if (res) res += '\n'; res += pad(extra); };
    const atLineStart = () => res === '' || /\n[ \t]*$/.test(res);
    const inSub = () => parens.length === 0 || parens[parens.length - 1] === 'sub';
    const wordU = k => (k && k.t === 'word') ? k.u : null;

    // Decide whether the SELECT list starting at token i is long enough to wrap.
    function shouldWrap(i) {
      let d = 0, commas = 0, len = 0;
      for (let j = i + 1; j < toks.length; j++) {
        const k = toks[j];
        if (k.v === '(') d++;
        else if (k.v === ')') { if (d === 0) break; d--; }
        else if (k.v === ';' ) break;
        else if (d === 0 && k.t === 'word' && SELECT_END.has(k.u)) break;
        else if (d === 0 && k.v === ',') commas++;
        len += k.v.length + 1;
      }
      return commas >= 3 || len > 54;
    }

    for (let i = 0; i < toks.length; i++) {
      const k = toks[i], prev = toks[i - 1], next = toks[i + 1];
      const u = wordU(k);
      let text = k.v;
      let lead = 'space';

      if (k.t === 'com') {
        if (!atLineStart()) res += ' ';
        res += k.v;
        if (k.v.indexOf('--') === 0) forceBreak = forceBreak || 'nl';
        continue;
      }

      if (u) {
        const callNext = next && next.v === '(';
        if (FUNCTIONS.has(u) && callNext) text = u;
        else if (KEYWORDS.has(u) && !(JOIN_LEAD.has(u) && callNext)) text = u;

        if (u === 'BETWEEN') between++;
        if (inSub()) {
          const pu = wordU(prev);
          if (u === 'SELECT') {
            wrapAt[depth] = shouldWrap(i);
            clauseAt[depth] = 'SELECT';
            if (i > 0 && !atLineStart()) lead = 'nl';
          } else if (u === 'FROM') {
            if (pu !== 'DELETE' && pu !== 'DISTINCT') { lead = 'nl'; clauseAt[depth] = 'FROM'; }
          } else if (BREAK_BEFORE.has(u)) {
            lead = 'nl'; clauseAt[depth] = u;
          } else if ((u === 'GROUP' || u === 'ORDER') && wordU(next) === 'BY') {
            lead = 'nl'; clauseAt[depth] = u;
          } else if (u === 'JOIN') {
            if (!(pu && (JOIN_LEAD.has(pu) || pu === 'OUTER'))) lead = 'nl';
            clauseAt[depth] = 'JOIN';
          } else if (JOIN_LEAD.has(u) && !callNext && (wordU(next) === 'JOIN' || wordU(toks[i + 2]) === 'JOIN')) {
            lead = 'nl';
          } else if (u === 'WHEN' && wordU(toks[0]) === 'MERGE') {
            lead = 'nl';
          } else if (u === 'AND' || u === 'OR') {
            if (u === 'AND' && between > 0) between--;
            else if (/^(WHERE|HAVING|QUALIFY|JOIN)$/.test(clauseAt[depth])) lead = 'nl+';
          }
        } else if (u === 'AND' && between > 0) {
          between--;
        }
      }

      if (k.t === 'op') {
        if (TIGHT_BEFORE.has(k.v)) lead = 'none';
        if (k.v === '(') {
          const isCall = prev && ((prev.t === 'word' && (!KEYWORDS.has(prev.u) || FUNCTIONS.has(prev.u))) || prev.t === 'qid');
          if (isCall || (prev && prev.v === '(')) lead = 'none';
          const nu = wordU(next);
          parens.push(nu === 'SELECT' || nu === 'WITH' ? 'sub' : 'fn');
        } else if (k.v === ')') {
          const kind = parens.pop();
          if (kind === 'sub') { depth = Math.max(0, depth - 1); clauseAt.length = depth + 1; wrapAt.length = depth + 1; lead = 'nl'; }
        }
      }

      if (forceBreak) { lead = (lead === 'nl' || lead === 'nl+') ? lead : forceBreak; forceBreak = null; }

      if (lead === 'nl') newline(false);
      else if (lead === 'nl+') newline(true);
      else if (lead === 'space' && !tight && !atLineStart()) res += ' ';
      res += text;
      tight = false;

      // What follows this token?
      if (k.t === 'op') {
        if (TIGHT_AFTER.has(k.v)) tight = true;
        if (k.v === '(' && parens[parens.length - 1] === 'sub') { depth++; clauseAt[depth] = ''; wrapAt[depth] = false; forceBreak = 'nl'; tight = false; }
        if (k.v === ',' && inSub() && clauseAt[depth] === 'SELECT' && wrapAt[depth]) forceBreak = 'nl+';
        if (k.v === ';') { res += '\n'; forceBreak = 'nl'; depth = 0; }
        if ((k.v === '-' || k.v === '+') && (!prev || (prev.t === 'op' && prev.v !== ')') || (prev.t === 'word' && KEYWORDS.has(prev.u)))) tight = true;
      }
      if (u === 'SELECT' && inSub() && wrapAt[depth]) {
        const nu = wordU(next);
        if (nu !== 'DISTINCT' && nu !== 'ALL' && nu !== 'TOP') forceBreak = 'nl+';
      } else if ((u === 'DISTINCT' || u === 'ALL') && wordU(prev) === 'SELECT' && inSub() && wrapAt[depth]) {
        forceBreak = 'nl+';
      }
    }
    return res.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------- Typo finder ----------
  // Optimal string alignment distance (insert, delete, substitute, swap neighbours).
  function distance(a, b) {
    const m = a.length, n = b.length;
    const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }

  // Closest entry of `list` to `word` within `max` edits, or null. Case-insensitive.
  function closest(word, list, max) {
    const w = String(word).toLowerCase();
    let best = null, bestD = (max == null ? 2 : max) + 1;
    for (const cand of list) {
      const dist = distance(w, String(cand).toLowerCase());
      if (dist < bestD) { best = cand; bestD = dist; }
    }
    return best;
  }

  const TYPO_TARGETS = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'GROUP', 'LIMIT', 'DISTINCT', 'HAVING', 'JOIN', 'BETWEEN', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'UNION', 'QUALIFY', 'DESC', 'INNER', 'LEFT', 'LIKE', 'ILIKE', 'COUNT'];

  // Words that are not keywords, functions, or known names, but sit one edit away from a keyword.
  function findTypos(sql, knownNames) {
    const known = new Set((knownNames || []).map(s => String(s).toLowerCase()));
    const found = [];
    for (const k of tokenize(sql || '')) {
      if (k.t !== 'word' || k.v.length < 3) continue;
      if (KEYWORDS.has(k.u) || FUNCTIONS.has(k.u) || known.has(k.v.toLowerCase())) continue;
      const fix = closest(k.u, TYPO_TARGETS, k.u.length >= 7 ? 2 : 1);
      if (fix && fix !== k.u) found.push({ word: k.v, fix: fix });
    }
    return found;
  }

  QS.engine.sql = { KEYWORDS, FUNCTIONS, tokenize, significant, highlight, inspect, format, distance, closest, findTypos, esc };
})();
