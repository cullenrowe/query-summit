/* ===== ui/widgets.js =====
 * Reusable pieces: the SQL editor with its tap-to-insert keys, result tables, and the table peek sheet.
 */
(function () {
  'use strict';
  const U = QS.ui;
  const h = U.h;

  // ---------- SQL editor ----------
  // A plain textarea stacked on top of a highlighted copy of its text. Simple and reliable on phones.
  // U.editor({ value, keys: { words, tables, columns, values }, onInput, onRun, onReset, resetLabel })
  U.editor = function (opts) {
    const sqlx = QS.engine.sql;
    const sel = { start: (opts.value || '').length, end: (opts.value || '').length };
    const paint = h('code');
    const ta = h('textarea.ed-input', {
      id: opts.id || 'qs-sql', rows: '1', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
      'aria-label': 'SQL editor', placeholder: opts.placeholder || 'Type SQL here, or tap the keys above'
    });
    ta.value = opts.value || '';

    const remember = () => { sel.start = ta.selectionStart; sel.end = ta.selectionEnd; };
    const repaint = () => { paint.innerHTML = sqlx.highlight(ta.value) + '​'; };
    const changed = () => { repaint(); if (opts.onInput) opts.onInput(ta.value); };
    ['select', 'keyup', 'click', 'focus', 'input'].forEach(ev => ta.addEventListener(ev, remember));
    ta.addEventListener('input', changed);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (opts.onRun) opts.onRun(); }
    });

    function setValue(text, caret) {
      ta.value = text;
      const pos = caret === undefined ? text.length : caret;
      sel.start = sel.end = pos;
      if (document.activeElement === ta) { try { ta.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
      changed();
    }

    // Insert a token at the cursor with sensible spacing. Does not open the phone keyboard.
    function insert(text) {
      if (ta.readOnly) return;
      const v = ta.value;
      let before = v.slice(0, sel.start), after = v.slice(sel.end);
      // If the cursor sits just inside a closing quote, step over it first.
      if (after.charAt(0) === "'" && (before.split("'").length - 1) % 2 === 1 && text !== "''") { before += "'"; after = after.slice(1); }
      let ins = text, back = 0;
      if (/^[,);.]/.test(text)) before = before.replace(/[ \t]+$/, '');
      else if (before && !/[\s(.]$/.test(before)) ins = ' ' + ins;
      if (text === "''") back = 1;
      else if (text !== '(' && text !== '.' && !/^\s/.test(after)) ins += ' ';
      setValue(before + ins + after, before.length + ins.length - back);
      U.sound('tap');
    }

    // Remove the selection, or the token just before the cursor.
    function erase() {
      if (ta.readOnly) return;
      const v = ta.value;
      if (sel.start !== sel.end) { setValue(v.slice(0, sel.start) + v.slice(sel.end), sel.start); return; }
      const before = v.slice(0, sel.start);
      const m = /(?:'[^']*'|"[^"]*"|[A-Za-z0-9_$.]+|[^\sA-Za-z0-9_])?\s*$/.exec(before);
      const cut = m && m[0].length ? m[0].length : 1;
      const keepTo = Math.max(0, before.length - cut);
      setValue(before.slice(0, keepTo) + v.slice(sel.end), keepTo);
    }

    // Keys. pointerdown + preventDefault keeps focus (and the phone keyboard) exactly as it was.
    const keyEls = {};
    function key(label, cls, value, aria) {
      const b = h('button.key.' + cls, { type: 'button', 'data-key': label, 'aria-label': aria || ('Insert ' + label) }, label);
      b.addEventListener('pointerdown', e => e.preventDefault());
      b.addEventListener('click', () => { if (value === '\b') erase(); else insert(value === undefined ? label : value); });
      keyEls[label] = b;
      return b;
    }
    const k = opts.keys || {};
    const rows = [];
    if (k.words && k.words.length) rows.push(h('div.keyrow', { role: 'group', 'aria-label': 'SQL words' }, k.words.map(w => key(w, sqlx.KEYWORDS.has(w.split(' ')[0]) || w === '*' ? 'key-kw' : 'key-name'))));
    const names = (k.tables || []).map(t => key(t, 'key-table')).concat((k.columns || []).map(c => key(c, 'key-name')));
    if (names.length) rows.push(h('div.keyrow', { role: 'group', 'aria-label': 'Tables and columns' }, names));
    const lastRow = (k.values || []).map(v => key(v, 'key-val')).concat(QS.content.symbols.filter(s => !keyEls[s]).map(s => key(s, 'key-sym', s, s === "''" ? 'Insert quotes' : undefined)));
    const eraseKey = key('⌫', 'key-sym', '\b', 'Delete the last word');
    eraseKey.textContent = ''; eraseKey.appendChild(U.icon('erase', 20));
    lastRow.push(eraseKey);
    rows.push(h('div.keyrow', { role: 'group', 'aria-label': 'Values and symbols' }, lastRow));

    const runBtn = h('button.btn.btn-primary.run', { type: 'button', onclick: () => opts.onRun && opts.onRun() }, U.icon('play', 18), h('span', 'Run'));
    const fmtBtn = h('button.btn.btn-ghost', { type: 'button', title: 'Tidy the layout of your query', 'aria-label': 'Format query', onclick: () => { const f = sqlx.format(ta.value); if (f) setValue(f); } }, U.icon('format', 18), h('span', 'Format'));
    const resetBtn = h('button.btn.btn-quiet', { type: 'button', onclick: () => { if (opts.onReset) setValue(opts.onReset()); else setValue(''); } }, opts.resetLabel || 'Clear');

    const el = h('div.ed',
      h('div.keys', { role: 'toolbar', 'aria-label': 'Tap to insert' }, rows),
      h('div.ed-code', h('pre.ed-paint', { 'aria-hidden': 'true' }, paint), ta),
      h('div.ed-actions', runBtn, fmtBtn, resetBtn, h('span.ed-tip', 'Ctrl + Enter runs')));
    repaint();

    return {
      el: el, textarea: ta, runBtn: runBtn,
      get value() { return ta.value; },
      set value(v) { setValue(v); },
      insert: insert,
      keyEl: label => keyEls[label] || null,
      setBusy(b) { runBtn.disabled = !!b; runBtn.classList.toggle('is-busy', !!b); },
      focus() { ta.focus(); }
    };
  };

  // ---------- Result tables ----------
  const fmtCell = v => {
    if (v === null || v === undefined) return h('span.null', 'NULL');
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  };

  // U.resultTable(result, { title, tone, marks: { rows: { index: 'extra' | 'missing' }, cols: [indexes] }, note })
  U.resultTable = function (result, opts) {
    opts = opts || {};
    const LIMIT = 100;
    const marks = opts.marks || {};
    const rowMarks = marks.rows || {}, colMarks = marks.cols || [];
    const cols = result.columns || [], rows = result.rows || [];
    const meta = rows.length + (result.truncated ? '+' : '') + (rows.length === 1 ? ' row' : ' rows') + ' · ' + cols.length + (cols.length === 1 ? ' column' : ' columns');
    const head = h('div.rt-head', h('span.rt-title', opts.title || 'Result'), h('span.rt-meta', meta));
    let body;
    if (!cols.length) {
      body = h('p.rt-empty', opts.empty || 'Done. This statement returns no table.');
    } else {
      const thead = h('thead', h('tr', h('th.rt-n', { scope: 'col', 'aria-label': 'Row number' }, '#'), cols.map((c, i) => h('th' + (c.kind === 'num' ? '.num' : '') + (colMarks.indexOf(i) !== -1 ? '.is-off' : ''), { scope: 'col' }, c.name))));
      const tbody = h('tbody');
      rows.slice(0, LIMIT).forEach((r, i) => {
        const mark = rowMarks[i];
        tbody.appendChild(h('tr' + (mark ? '.is-' + mark : ''),
          h('td.rt-n', mark === 'extra' ? '+' : mark === 'missing' ? '−' : String(i + 1)),
          r.map((v, c) => h('td' + (cols[c] && cols[c].kind === 'num' ? '.num' : '') + (colMarks.indexOf(c) !== -1 ? '.is-off' : ''), fmtCell(v)))));
      });
      if (!rows.length) tbody.appendChild(h('tr', h('td.rt-none', { colspan: String(cols.length + 1) }, 'No rows')));
      body = h('div.rt-scroll', { tabindex: '0', role: 'region', 'aria-label': (opts.title || 'Result') + ' table' }, h('table.rt-table', thead, tbody));
    }
    const more = rows.length > LIMIT ? h('p.rt-more', 'Showing the first ' + LIMIT + ' of ' + rows.length + (result.truncated ? '+' : '') + ' rows.') : null;
    return h('div.rt' + (opts.tone ? '.rt-' + opts.tone : ''), head, body, more, opts.note ? h('p.rt-more', opts.note) : null);
  };

  // A small static table (used for predict options). table: { columns: [names], rows }
  U.miniTable = function (table) {
    return h('table.mini',
      h('thead', h('tr', table.columns.map(c => h('th', c)))),
      h('tbody', table.rows.map(r => h('tr', r.map(v => h('td' + (typeof v === 'number' ? '.num' : ''), fmtCell(v)))))));
  };

  // ---------- Table peek ----------
  const TYPE_WORDS = { VARCHAR: 'text', INTEGER: 'whole number', BIGINT: 'whole number', DOUBLE: 'decimal number', DATE: 'date', BOOLEAN: 'true / false', TIMESTAMP: 'date and time', JSON: 'JSON' };
  U.typeWord = t => TYPE_WORDS[t] || (/^DECIMAL/.test(t) ? 'decimal number' : t.toLowerCase());

  U.peekTable = function (datasetId, tableName) {
    const ds = QS.content.datasets[datasetId];
    const table = ds && ds.tables.find(t => t.name === tableName);
    if (!table) return;
    const preview = h('div.peek-rows', h('p.muted', 'Loading rows...'));
    const body = h('div.peek',
      h('p.peek-about', table.about + ' ' + table.rows.length + ' rows.'),
      h('table.peek-cols',
        h('thead', h('tr', h('th', 'Column'), h('th', 'Holds'), h('th', 'About'))),
        h('tbody', table.columns.map(c => h('tr', h('td', h('code', c.name)), h('td.muted', U.typeWord(c.type)), h('td', c.about || ''))))),
      preview);
    U.sheet({ title: 'Table: ' + table.name, body: body });
    // The preview comes straight from the content data, so it works even while the engine is busy.
    const res = { columns: table.columns.map(c => ({ name: c.name, kind: /INT|DEC|DOUBLE/.test(c.type) ? 'num' : 'text' })), rows: table.rows.slice(0, 8) };
    U.clear(preview).appendChild(U.resultTable(res, { title: 'First ' + res.rows.length + ' rows', note: table.rows.length > 8 ? 'The table has ' + table.rows.length + ' rows in total.' : null }));
  };

  U.tableChips = function (datasetId, tableNames) {
    const ds = QS.content.datasets[datasetId];
    const list = tableNames && tableNames.length ? tableNames : ds.tables.map(t => t.name);
    return h('div.tables',
      h('span.tables-label', 'Tables'),
      list.map(name => h('button.chip.chip-table', { type: 'button', 'data-table': name, 'aria-label': 'Look inside the ' + name + ' table', onclick: () => U.peekTable(datasetId, name) }, U.icon('table', 16), name)));
  };
})();
