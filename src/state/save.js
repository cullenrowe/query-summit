/* ===== state/save.js =====
 * Loading and saving progress. The save is one JSON object with a version number (`v`).
 * When the format changes: bump SAVE_VERSION and add a MIGRATIONS entry that upgrades the old shape.
 * Storage can be blocked (private windows, some embeds). Every access is wrapped, and the game
 * keeps working from memory if it is.
 */
(function () {
  'use strict';

  const KEY = 'query-summit-save';
  const SAVE_VERSION = 1;
  const EXPORT_PREFIX = 'QS1.';

  // MIGRATIONS[n] takes a version-n save and returns a version-(n+1) save.
  const MIGRATIONS = {
    // 1: function (s) { s.newField = defaultValue; s.v = 2; return s; }
  };

  function fresh() {
    return {
      v: SAVE_VERSION,
      created: new Date().toISOString(),
      xp: 0,
      levels: {},      // level id -> { stars, plays, done: ISO date }
      skills: {},      // skill id -> { pips: 0..3, box: 1..5, due: 'YYYY-MM-DD', slips, seen: true }
      badges: {},      // badge id -> ISO date earned
      drill: { last: null, streak: 0, best: 0, set: null, setDate: null, done: 0, recent: [] },
      stats: { runs: 0, sandboxRuns: 0, cleanStreak: 0 },
      flags: { tutorialDone: false, introSeen: {}, outroSeen: {} },
      drafts: {},      // step key -> last SQL typed there
      settings: { sound: false, textSize: 'm', theme: 'system' }
    };
  }

  // Fill in anything missing so older or hand-edited saves cannot crash the game.
  function repair(s) {
    const base = fresh();
    if (!s || typeof s !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (s[k] === undefined || s[k] === null || typeof s[k] !== typeof base[k]) s[k] = base[k];
      else if (typeof base[k] === 'object' && !Array.isArray(base[k])) {
        for (const kk of Object.keys(base[k])) if (s[k][kk] === undefined) s[k][kk] = base[k][kk];
      }
    }
    s.xp = Math.max(0, Math.floor(Number(s.xp) || 0));
    return s;
  }

  function migrate(s) {
    if (!s || typeof s.v !== 'number') throw new Error('That does not look like a Query Summit save.');
    if (s.v > SAVE_VERSION) throw new Error('That save comes from a newer version of the game.');
    while (s.v < SAVE_VERSION) {
      const step = MIGRATIONS[s.v];
      if (!step) throw new Error('No upgrade path from save version ' + s.v + '.');
      s = step(s);
    }
    return repair(s);
  }

  const store = {
    ok: true,
    get() { try { return window.localStorage.getItem(KEY); } catch (e) { this.ok = false; return null; } },
    set(text) { try { window.localStorage.setItem(KEY, text); this.ok = true; } catch (e) { this.ok = false; } },
    clear() { try { window.localStorage.removeItem(KEY); } catch (e) { this.ok = false; } }
  };

  let data = fresh();
  let timer = null;

  function load() {
    const text = store.get();
    if (text) {
      try { data = migrate(JSON.parse(text)); } catch (e) { data = fresh(); }
    } else {
      data = fresh();
    }
    return data;
  }

  function persistNow() { clearTimeout(timer); timer = null; store.set(JSON.stringify(data)); }
  // Small delay so a burst of changes becomes one write.
  function persist() { if (!timer) timer = setTimeout(persistNow, 150); }

  function reset() {
    const keep = data.settings;
    data = fresh();
    data.settings = keep;
    persistNow();
    return data;
  }

  // Progress code: the save as base64 text, so players can move between devices without accounts.
  const toB64 = str => btoa(unescape(encodeURIComponent(str)));
  const fromB64 = b64 => decodeURIComponent(escape(atob(b64)));

  function exportCode() {
    const copy = JSON.parse(JSON.stringify(data));
    copy.drafts = {};
    return EXPORT_PREFIX + toB64(JSON.stringify(copy));
  }

  function importCode(code) {
    const text = String(code || '').replace(/\s+/g, '');
    if (text.indexOf(EXPORT_PREFIX) !== 0) throw new Error('Progress codes start with "' + EXPORT_PREFIX + '". Paste the whole code.');
    let parsed;
    try { parsed = JSON.parse(fromB64(text.slice(EXPORT_PREFIX.length))); } catch (e) { throw new Error('That code is damaged or incomplete. Copy it again and paste the whole thing.'); }
    data = migrate(parsed);
    persistNow();
    return data;
  }

  window.addEventListener('pagehide', () => { if (timer) persistNow(); });

  QS.state.save = {
    SAVE_VERSION, load, persist, persistNow, reset, exportCode, importCode,
    get data() { return data; },
    get storageOk() { return store.ok; }
  };
})();
