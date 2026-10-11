/* ===== engine/db.js =====
 * DuckDB-WASM setup, the query runner, and the judge that scores a step.
 *
 * Loading: the engine comes from cdn.jsdelivr.net. If that download is blocked, the loader
 * falls back to a self-hosted copy in ./duckdb/ next to the page (same files, see LOCAL below).
 * Every level starts from a fresh copy of its dataset, so nothing a player runs can break the game.
 */
(function () {
  'use strict';

  const DUCKDB_VERSION = '1.32.0';
  const CDN = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@' + DUCKDB_VERSION;
  // Self-hosted fallback. The .wasm may be split into parts (some hosts cap file size); they are joined in order.
  const LOCAL = {
    lib: 'duckdb/duckdb-lib.mjs',
    worker: 'duckdb/duckdb-eh.worker.js',
    wasmParts: ['duckdb/duckdb-eh.part0.wasm', 'duckdb/duckdb-eh.part1.wasm', 'duckdb/duckdb-eh.part2.wasm']
  };
  const OPEN_CONFIG = { path: ':memory:', query: { castBigIntToDouble: true, castDecimalToDouble: true } };
  const QUERY_TIMEOUT_MS = 10000;
  const ENGINE_BYTES = 34000000;     // unpacked size of the engine .wasm, used for the loading bar
  const MAX_ROWS = 2000;

  // Runs inside the worker (local mode only): serves the .wasm bytes we already downloaded.
  const WORKER_HOOK = '(function(){var wasm=null;var real=self.fetch.bind(self);' +
    'self.addEventListener("message",function(e){if(e.data&&e.data.__qsWasm){wasm=e.data.__qsWasm;e.stopImmediatePropagation();}});' +
    'self.fetch=function(input,init){var url=typeof input==="string"?input:(input&&input.url)||"";' +
    'if(wasm&&url.indexOf("qs-local.wasm")!==-1){return Promise.resolve(new Response(wasm,{status:200,headers:{"Content-Type":"application/wasm"}}));}' +
    'return real(input,init);};})();\n';

  let lib = null, worker = null, db = null, conn = null;
  let mode = null;            // 'cdn' or 'local', whichever worked
  let status = 'idle';        // 'idle' | 'loading' | 'ready' | 'failed'
  let loaded = null;          // dataset id currently in the database
  let dirty = false;          // true after a statement that may have changed data
  let busy = false;
  let wasmBlob = null, workerSrc = null;
  let bootPromise = null;
  let attempts = 0;           // browsers remember a failed module download, so each retry asks with a fresh URL
  const retryTag = () => (attempts > 1 ? '?retry=' + attempts : '');
  const goalCache = new Map();

  const abs = rel => new URL(rel, document.baseURI).href;

  // Remember which source worked last time, so the next visit tries it first.
  const MODE_KEY = 'query-summit-engine';
  const recallMode = () => { try { return window.localStorage.getItem(MODE_KEY); } catch (e) { return null; } };
  const storeMode = m => { try { window.localStorage.setItem(MODE_KEY, m); } catch (e) { /* storage is optional */ } };

  function guard(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function teardown() {
    try { if (worker) worker.terminate(); } catch (e) { /* ignore */ }
    worker = null; db = null; conn = null; loaded = null; dirty = false; busy = false;
  }

  // Wait for instantiate, but give up if the worker dies or the download stalls.
  function instantiate(url, pthread, onProgress) {
    return new Promise((resolve, reject) => {
      let stall;
      const arm = () => { clearTimeout(stall); stall = setTimeout(() => reject(new Error('The download stalled.')), 60000); };
      arm();
      worker.addEventListener('error', ev => { clearTimeout(stall); reject(new Error('The engine worker failed to start' + (ev && ev.message ? ': ' + ev.message : '.'))); });
      // The CDN reports the compressed size (about 7 MB) but counts unpacked bytes (about 34 MB) as they arrive,
      // so measure progress against the unpacked size.
      db.instantiate(url, pthread, p => { arm(); if (onProgress && p && p.bytesLoaded) onProgress(Math.min(1, p.bytesLoaded / Math.max(p.bytesTotal || 0, ENGINE_BYTES))); })
        .then(v => { clearTimeout(stall); resolve(v); }, e => { clearTimeout(stall); reject(e); });
    });
  }

  async function startFromCdn(onProgress) {
    if (!lib) lib = await guard(import(CDN + '/+esm' + retryTag()), 40000, 'The engine library did not download.');
    const bundle = await lib.selectBundle(lib.getJsDelivrBundles());
    const url = URL.createObjectURL(new Blob(['importScripts("' + bundle.mainWorker + '");'], { type: 'text/javascript' }));
    worker = new Worker(url);
    db = new lib.AsyncDuckDB(new lib.VoidLogger(), worker);
    try { await instantiate(bundle.mainModule, bundle.pthreadWorker, onProgress); } finally { URL.revokeObjectURL(url); }
  }

  async function startFromLocal(onProgress) {
    if (!lib) lib = await guard(import(abs(LOCAL.lib) + retryTag()), 40000, 'The engine library did not download.');
    if (!wasmBlob) {
      const bufs = [];
      for (let i = 0; i < LOCAL.wasmParts.length; i++) {
        const r = await fetch(abs(LOCAL.wasmParts[i]));
        if (!r.ok) throw new Error('Engine file missing (' + r.status + ').');
        bufs.push(await r.arrayBuffer());
        if (onProgress) onProgress((i + 1) / LOCAL.wasmParts.length, 0);
      }
      wasmBlob = new Blob(bufs, { type: 'application/wasm' });
    }
    if (!workerSrc) {
      const r = await fetch(abs(LOCAL.worker));
      if (!r.ok) throw new Error('Engine worker missing (' + r.status + ').');
      workerSrc = await r.text();
    }
    const url = URL.createObjectURL(new Blob([WORKER_HOOK, workerSrc], { type: 'text/javascript' }));
    worker = new Worker(url);
    const bytes = await wasmBlob.arrayBuffer();
    worker.postMessage({ __qsWasm: bytes }, [bytes]);
    db = new lib.AsyncDuckDB(new lib.VoidLogger(), worker);
    try { await instantiate(abs('qs-local.wasm'), null, null); } finally { URL.revokeObjectURL(url); }
  }

  async function open() {
    await db.open(OPEN_CONFIG);
    conn = await db.connect();
    loaded = null; dirty = false;
  }

  // Load the engine. Safe to call again after a failure (that is what the Retry button does).
  function boot(onProgress) {
    if (status === 'ready') return Promise.resolve();
    if (bootPromise) return bootPromise;
    status = 'loading';
    attempts += 1;
    bootPromise = (async () => {
      const errors = [];
      const order = (mode || recallMode()) === 'local' ? ['local', 'cdn'] : ['cdn', 'local'];
      for (const how of order) {
        try {
          teardown();
          if (how === 'cdn') await startFromCdn(onProgress); else await startFromLocal(onProgress);
          await open();
          await conn.query('SELECT 1');
          mode = how; status = 'ready';
          storeMode(how);
          return;
        } catch (e) {
          errors.push((how === 'cdn' ? 'From cdn.jsdelivr.net: ' : 'From local copy: ') + ((e && e.message) || e));
          teardown();
        }
      }
      status = 'failed';
      const err = new Error('The SQL engine could not load.');
      err.details = errors.join('\n');
      throw err;
    })();
    bootPromise.then(() => { bootPromise = null; }, () => { bootPromise = null; });
    return bootPromise;
  }

  async function restart() {
    const ds = loaded;
    teardown(); status = 'idle';
    await boot();
    if (ds) await useDataset(ds, true);
  }

  // ---------- Datasets ----------
  function literal(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') v = JSON.stringify(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function seedSql(table) {
    const out = ['CREATE TABLE ' + table.name + ' (' + table.columns.map(c => c.name + ' ' + c.type).join(', ') + ')'];
    for (let i = 0; i < table.rows.length; i += 200) {
      out.push('INSERT INTO ' + table.name + ' VALUES ' + table.rows.slice(i, i + 200).map(r => '(' + r.map(literal).join(', ') + ')').join(', '));
    }
    return out;
  }

  // Make sure the database holds a clean copy of this dataset.
  async function useDataset(id, force) {
    if (!force && loaded === id && !dirty) return;
    const ds = QS.content.datasets[id];
    if (!ds) throw new Error('Unknown dataset: ' + id);
    try { if (conn) await conn.close(); } catch (e) { /* ignore */ }
    await open();
    for (const t of ds.tables) for (const stmt of seedSql(t)) await conn.query(stmt);
    loaded = id; dirty = false;
  }

  // ---------- Running queries ----------
  // Arrow type ids: 2 Int, 3 Float, 5 Utf8, 6 Bool, 7 Decimal, 8 Date, 9 Time, 10 Timestamp
  function kindOf(type) {
    const id = type && type.typeId;
    if (id === 2 || id === 3 || id === 7) return 'num';
    if (id === 5) return 'text';
    if (id === 6) return 'bool';
    if (id === 8) return 'date';
    if (id === 9) return 'time';
    if (id === 10) return 'ts';
    return 'other';
  }
  const describe = schema => schema.fields.map(f => ({ name: f.name, type: String(f.type), kind: kindOf(f.type) }));
  const two = n => (n < 10 ? '0' : '') + n;

  function clean(v, kind) {
    if (v === null || v === undefined) return null;
    if (kind === 'date') return new Date(Number(v)).toISOString().slice(0, 10);
    if (kind === 'ts') return new Date(Number(v)).toISOString().slice(0, 19).replace('T', ' ');
    if (kind === 'time') { const s = Math.floor(Number(v) / 1e6); return two(Math.floor(s / 3600)) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60); }
    if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    try { return JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? Number(x) : x)); } catch (e) { return String(v); }
  }

  // run(sql, { readOnly, maxRows }) -> { columns: [{ name, type, kind }], rows: [[...]], truncated, ms }
  async function run(sql, opts) {
    opts = opts || {};
    if (status !== 'ready') throw new Error('The SQL engine is not ready yet.');
    if (busy) throw new Error('Another query is still running.');
    busy = true;
    const cap = opts.maxRows || MAX_ROWS;
    const t0 = performance.now();
    let timer = null, timedOut = false;
    try {
      const work = (async () => {
        const reader = await conn.send(sql, true);
        let columns = null, truncated = false;
        const rows = [];
        for await (const batch of reader) {
          if (!columns) columns = describe(batch.schema);
          const vecs = columns.map((c, i) => batch.getChildAt(i));
          for (let r = 0; r < batch.numRows; r++) {
            if (rows.length >= cap) { truncated = true; break; }
            const row = new Array(vecs.length);
            for (let c = 0; c < vecs.length; c++) row[c] = clean(vecs[c].get(r), columns[c].kind);
            rows.push(row);
          }
          if (truncated) break;
        }
        if (truncated) { try { await conn.cancelSent(); } catch (e) { /* ignore */ } }
        // An empty result can arrive with no batch at all, so ask again for the column names.
        if (!columns) columns = opts.readOnly ? describe((await conn.query(sql)).schema) : [];
        return { columns: columns, rows: rows, truncated: truncated };
      })();
      work.catch(() => { /* reported through the race below */ });
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { timedOut = true; const e = new Error('The query took too long and was stopped.'); e.qs = 'timeout'; reject(e); }, QUERY_TIMEOUT_MS);
      });
      const res = await Promise.race([work, timeout]);
      res.ms = Math.round(performance.now() - t0);
      return res;
    } catch (e) {
      // A runaway query cannot be trusted to stop, so replace the whole engine and reload the data.
      if (timedOut) { try { await restart(); } catch (e2) { /* the next action will show the load error */ } }
      throw e;
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  }

  // ---------- Judging ----------
  const fill = (template, picks) => template.replace(/\{(\d+)\}/g, (m, i) => (picks[+i] == null ? '____' : picks[+i]));

  function solutionSql(step) {
    if (step.type === 'blank') return fill(step.template, step.blanks.map(b => b.options[b.answer]));
    if (step.type === 'choose') return step.options[step.answer].sql;
    if (step.type === 'predict') return step.sql;
    return step.solution;
  }

  function tablesOf(datasetId) { const ds = QS.content.datasets[datasetId]; return ds ? ds.tables : []; }

  // The goal table for a step. Cached as a promise so two callers never run it twice at once.
  function goalFor(step, datasetId) {
    if (goalCache.has(step)) return goalCache.get(step);
    const p = (async () => {
      await useDataset(datasetId);
      return run(solutionSql(step), { readOnly: true });
    })();
    goalCache.set(step, p);
    p.catch(() => goalCache.delete(step));
    return p;
  }

  function blockedMessage(info, allowWrites) {
    if (info.blocked) return { title: 'That command is switched off', message: '`' + info.blocked + '` is turned off in this game. It reaches outside the practice data, and no level needs it.' };
    if (info.statements > 1 && !allowWrites) return { title: 'One statement at a time', message: 'Run a single query. Remove the extra statement after the semicolon.' };
    if (info.changesData && !allowWrites) return { title: 'This level only reads data', message: 'Start with `SELECT`. Commands that change data, like `' + info.first + '`, arrive in World 9. You can try them safely in the Sandbox.' };
    return null;
  }

  // judge(step, sql, datasetId) -> { status: 'pass' | 'fail' | 'error' | 'blocked' | 'empty', title, message, player, goal, verdict, error }
  async function judge(step, sql, datasetId) {
    const info = QS.engine.sql.inspect(sql);
    if (info.empty) return { status: 'empty', title: 'Nothing to run yet', message: 'Write a query first, then run it.' };
    const stateMode = !!(step.check && step.check.mode === 'state');
    const blocked = blockedMessage(info, stateMode);
    if (blocked) return { status: 'blocked', title: blocked.title, message: blocked.message };
    const ctx = { sql: sql, tables: tablesOf(datasetId) };

    if (stateMode) {
      // Run the player's statement and the solution on separate fresh copies, then compare the probe query.
      let player, goal;
      try {
        await useDataset(datasetId, true);
        await run(sql, {});
        player = await run(step.check.probe, { readOnly: true });
      } catch (e) {
        dirty = true;
        return { status: 'error', error: QS.engine.explainError(e, ctx) };
      }
      await useDataset(datasetId, true);
      await run(solutionSql(step), {});
      goal = await run(step.check.probe, { readOnly: true });
      dirty = true;
      const verdict = QS.engine.compare(player, goal, step.check);
      return { status: verdict.pass ? 'pass' : 'fail', message: verdict.message, player: player, goal: goal, verdict: verdict };
    }

    let goal, player;
    goal = await goalFor(step, datasetId);
    try {
      await useDataset(datasetId);
      if (!info.readOnly) dirty = true;      // unrecognised command: reload the data before the next run, to be safe
      player = await run(sql, { readOnly: info.readOnly });
    } catch (e) {
      return { status: 'error', error: QS.engine.explainError(e, ctx), goal: goal };
    }
    const verdict = QS.engine.compare(player, goal, step.check || {});
    if (verdict.kind === 'order' && !QS.engine.sql.tokenize(sql).some(k => k.t === 'word' && k.u === 'ORDER')) {
      verdict.message = 'Right rows, but the task asks for a specific order. Add ORDER BY at the end.';
    }
    return { status: verdict.pass ? 'pass' : 'fail', message: verdict.message, player: player, goal: goal, verdict: verdict };
  }

  // Free play: anything goes except commands that reach outside the practice data.
  async function sandboxRun(sql, datasetId) {
    const info = QS.engine.sql.inspect(sql);
    if (info.empty) return { status: 'empty', title: 'Nothing to run yet', message: 'Write a query first, then run it.' };
    if (info.blocked) { const b = blockedMessage(info, true); return { status: 'blocked', title: b.title, message: b.message }; }
    try {
      if (loaded !== datasetId) await useDataset(datasetId);
      const res = await run(sql, { readOnly: info.readOnly });
      if (!info.readOnly) dirty = true;
      return { status: 'ok', result: res, readOnly: info.readOnly, first: info.first };
    } catch (e) {
      if (!info.readOnly) dirty = true;
      return { status: 'error', error: QS.engine.explainError(e, { sql: sql, tables: tablesOf(datasetId) }) };
    }
  }

  QS.engine.db = {
    DUCKDB_VERSION, LOCAL,
    boot, restart, useDataset, run, judge, sandboxRun, goalFor, solutionSql, fill,
    get status() { return status; },
    get mode() { return mode; },
    get busy() { return busy; },
    markDirty() { dirty = true; }
  };
})();
