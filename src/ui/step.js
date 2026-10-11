/* ===== ui/step.js =====
 * Plays one Step (see the content schema): mission, hints, the work area for each of the five
 * challenge types, and the results. Used by levels, boss fights, and drills alike.
 *
 * U.stepRunner(mount, { step, datasetId, draftKey, mode: 'level' | 'drill', onPass(perf), onCoachDone })
 *   perf = { misses, hints, revealed, outcome: 'clean' | 'shaky' | 'struggled' }
 */
(function () {
  'use strict';
  const U = QS.ui;
  const h = U.h;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const HINT_LABEL = { nudge: 'Nudge', concept: 'Concept reminder', partial: 'Partial query', solution: 'Full solution' };
  const TYPE_LABEL = { write: 'Write a query', fix: 'Fix the query', blank: 'Fill the blanks', choose: 'Pick the right query', predict: 'Predict the output' };
  U.typeLabel = t => TYPE_LABEL[t] || t;

  // ---------- Coach (first-run tutorial) ----------
  // script: [{ say, target, until }]. `until` is a regular expression tested against the editor text
  // (trimmed, single-spaced, uppercased), or 'run'. Steps without `until` wait for the Next button.
  U.coach = function (script, api) {
    let i = 0, ended = false, marked = null;
    const text = h('p.coach-text');
    const nextBtn = h('button.btn.btn-primary', { type: 'button', onclick: () => advance(i + 1) }, 'Next');
    const skipBtn = h('button.btn.btn-quiet', { type: 'button', onclick: () => finish(true) }, 'Skip tutorial');
    const count = h('span.coach-count');
    const box = h('div.coach', { role: 'status', 'aria-live': 'polite' }, U.owl('calm', 44), h('div.coach-main', text, h('div.coach-row', nextBtn, skipBtn, count)));
    document.getElementById('qs-layer').parentNode.appendChild(box);
    document.documentElement.classList.add('has-coach');

    function unmark() { if (marked) { marked.classList.remove('coach-target'); marked = null; } }
    function show() {
      const st = script[i];
      text.innerHTML = U.rich(st.say);
      nextBtn.hidden = !!st.until;
      nextBtn.textContent = i === script.length - 1 ? 'Got it' : 'Next';
      count.textContent = (i + 1) + ' / ' + script.length;
      unmark();
      const el = st.target ? api.resolve(st.target) : null;
      if (el) {
        marked = el; el.classList.add('coach-target');
        try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
      }
    }
    function advance(to) {
      if (ended) return;
      if (to >= script.length) { finish(false); return; }
      i = to; show();
    }
    function finish(skipped, silent) {
      if (ended) return;
      ended = true; unmark(); box.remove();
      document.documentElement.classList.remove('has-coach');
      if (!silent && api.onDone) api.onDone(skipped);
    }
    const norm = s => String(s).trim().replace(/\s+/g, ' ').toUpperCase();
    show();
    return {
      // Called whenever the editor text changes. Jumps ahead if the player is already further along.
      onText(value) {
        if (ended) return;
        const t = norm(value);
        let reached = -1;
        for (let j = i; j < script.length; j++) { const u = script[j].until; if (u && u !== 'run' && new RegExp(u).test(t)) reached = j; }
        if (reached !== -1) advance(reached + 1);
      },
      onRun() {
        if (ended) return;
        const j = script.findIndex(s => s.until === 'run');
        if (j !== -1 && i <= j) advance(j + 1);
      },
      end() { finish(false); },
      remove() { finish(true, true); },      // leave without marking the tutorial as seen
      get active() { return !ended; }
    };
  };

  // ---------- The runner ----------
  U.stepRunner = function (mount, cfg) {
    const step = cfg.step, datasetId = cfg.datasetId;
    const db = QS.engine.db, game = QS.state.game, sqlx = QS.engine.sql;
    const perf = { misses: 0, hints: 0, revealed: false };
    let passed = false, destroyed = false, running = false, coach = null, editor = null;

    const ds = QS.content.datasets[datasetId];
    const tableNames = step.tables && step.tables.length ? step.tables : ds.tables.map(t => t.name);
    const columnNames = [];
    for (const t of ds.tables) if (tableNames.indexOf(t.name) !== -1) for (const c of t.columns) if (columnNames.indexOf(c.name) === -1) columnNames.push(c.name);

    // ----- Hint ladder -----
    const ladder = (step.hints || []).slice();
    ladder.push(solutionHint());
    function solutionHint() {
      if (step.type === 'blank') return { kind: 'solution', text: 'The blanks, in order: ' + step.blanks.map(b => '`' + b.options[b.answer] + '`').join(' and ') + '.' };
      if (step.type === 'choose') return { kind: 'solution', text: 'Option ' + 'ABCDEF'[step.answer] + ' is the one.' };
      if (step.type === 'predict') return { kind: 'solution', text: 'Option ' + 'ABCDEF'[step.answer] + ' is what the query returns.' };
      return { kind: 'solution', text: 'Here is one query that works. Read it before you run it.', code: sqlx.format(step.solution), usable: true };
    }

    const hintList = h('div.hint-list');
    const hintBtn = h('button.btn.btn-ghost.hint-btn', { type: 'button', onclick: revealHint });
    const hintCost = h('span.hint-cost');
    function drawHintBtn() {
      const n = perf.hints;
      if (n >= ladder.length) { hintBtn.hidden = true; hintCost.textContent = ''; return; }
      const nextKind = ladder[n].kind;
      U.clear(hintBtn); hintBtn.appendChild(U.icon('hint', 18));
      hintBtn.appendChild(h('span', n === 0 ? 'Need a hint?' : 'Next hint: ' + HINT_LABEL[nextKind].toLowerCase()));
      hintCost.textContent = cfg.mode === 'drill' ? '' : nextKind === 'solution' ? 'Seeing the solution leaves this level at 1 star.' : n === 0 ? 'Hints cost the no-hints star. They never block you.' : '';
    }
    function revealHint() {
      if (perf.hints >= ladder.length) return;
      const hint = ladder[perf.hints];
      perf.hints += 1;
      if (hint.kind === 'solution') perf.revealed = true;
      const card = h('div.hint.hint-' + hint.kind,
        h('span.hint-kind', 'Hint ' + perf.hints + ' · ' + HINT_LABEL[hint.kind]),
        U.richEl('p', hint.text),
        hint.code ? U.codeBlock(hint.code) : null,
        hint.usable && editor ? h('button.btn.btn-ghost', { type: 'button', onclick: () => { editor.value = hint.code; saveDraft(hint.code); U.toast('Solution placed in the editor'); } }, 'Put it in the editor') : null);
      hintList.appendChild(card);
      drawHintBtn();
      try { card.scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
    }

    // ----- Mission card -----
    const taskEl = U.richEl('p.task', step.task);
    const mission = h('section.card.mission', { 'aria-label': 'Mission' },
      step.teach ? h('div.teach', h('span.eyebrow', 'New move'), U.richEl('p', step.teach), step.teachCode ? U.codeBlock(sqlx.format(step.teachCode)) : null) : null,
      h('div.task-wrap', h('span.eyebrow', TYPE_LABEL[step.type]), taskEl),
      U.tableChips(datasetId, tableNames),
      h('div.hints', hintList, h('div.hint-row', hintBtn, hintCost)));
    drawHintBtn();

    // ----- Results card -----
    const banner = h('div.outcome.outcome-idle', { role: 'status', 'aria-live': 'polite' });
    const tablesEl = h('div.rt-pair');
    const results = h('section.card.results', { 'aria-label': 'Results' }, banner, tablesEl);

    function setBanner(tone, title, bodyText, extra) {
      banner.className = 'outcome outcome-' + tone;
      U.clear(banner);
      banner.appendChild(h('div.outcome-text', h('strong', title), bodyText ? U.richEl('p', bodyText) : null));
      if (extra) banner.appendChild(extra);
    }
    function idle(text) { setBanner('idle', text || 'Run your query to see how it compares with the goal.'); }

    function showTables(player, goal, verdict, playerTitle) {
      U.clear(tablesEl);
      const pMarks = { rows: {}, cols: [] }, gMarks = { rows: {}, cols: [] };
      if (verdict && !verdict.pass) {
        if (verdict.columnIssue) gMarks.cols = verdict.badColumns;
        else { for (const i of verdict.extra) pMarks.rows[i] = 'extra'; for (const i of verdict.missing) gMarks.rows[i] = 'missing'; }
      }
      if (player) tablesEl.appendChild(U.resultTable(player, { title: playerTitle || 'Your result', marks: pMarks, tone: verdict ? (verdict.pass ? 'good' : 'yours') : 'yours' }));
      if (goal) tablesEl.appendChild(U.resultTable(goal, { title: 'Goal', marks: gMarks, tone: 'goal' }));
    }

    function errorCard(err) {
      const raw = h('pre.raw', { hidden: true }, err.raw);
      const toggle = h('button.btn.btn-quiet', { type: 'button', 'aria-expanded': 'false', onclick: () => { raw.hidden = !raw.hidden; toggle.setAttribute('aria-expanded', String(!raw.hidden)); toggle.textContent = raw.hidden ? 'Details' : 'Hide details'; } }, 'Details');
      return h('div.outcome-extra', toggle, raw);
    }

    function outcomeOf() {
      if (perf.revealed || perf.misses >= 2) return 'struggled';
      return perf.misses === 0 && perf.hints === 0 ? 'clean' : 'shaky';
    }

    function pass(note) {
      if (passed) return;
      passed = true;
      game.draft(cfg.draftKey, null);
      U.sound('ok');
      const go = h('button.btn.btn-primary', { type: 'button', onclick: () => { go.disabled = true; if (coach && coach.active) coach.end(); cfg.onPass(Object.assign({ outcome: outcomeOf() }, perf)); } }, h('span', cfg.passLabel || 'Continue'), U.icon('next', 18));
      setBanner('pass', pick(QS.content.mentor.pass), note || 'Your result matches the goal.', h('div.outcome-extra', go));
      lockWork();
      setTimeout(() => {
        if (destroyed) return;
        try {
          if (!(coach && coach.active)) banner.scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
          go.focus({ preventScroll: true });
        } catch (e) { /* ignore */ }
      }, 60);
    }
    function miss() { perf.misses += 1; U.sound('bad'); }
    let lockWork = () => {};

    const saveDraft = v => { if (cfg.draftKey) game.draft(cfg.draftKey, v); };

    // Run player SQL through the judge and show what happened. Returns the judge result.
    async function check(sql, onBusy) {
      if (passed || running) return null;
      running = true;
      onBusy(true);
      setBanner('idle', 'Running...');
      let res;
      try { res = await db.judge(step, sql, datasetId); }
      catch (e) { res = { status: 'error', error: QS.engine.explainError(e, { sql: sql, tables: ds.tables }) }; }
      running = false;
      if (destroyed) return null;
      onBusy(false);
      game.noteRun();
      if (coach) coach.onRun();
      if (res.status === 'pass') {
        showTables(res.player, res.goal, res.verdict);
        pass();
      } else if (res.status === 'fail') {
        miss();
        showTables(res.player, res.goal, res.verdict);
        setBanner('fail', pick(QS.content.mentor.fail), res.message);
      } else if (res.status === 'error') {
        U.sound('bad');
        showTables(null, res.goal || null, null);
        setBanner('error', res.error.title, res.error.body, errorCard(res.error));
      } else {
        setBanner('idle', res.title, res.message);
      }
      return res;
    }

    // Show the goal before the first run so the target is always visible.
    async function previewGoal() {
      try {
        const goal = await db.goalFor(step, datasetId);
        if (!destroyed && !tablesEl.firstChild) tablesEl.appendChild(U.resultTable(goal, { title: 'Goal', tone: 'goal' }));
      } catch (e) { /* the first run will report any problem */ }
    }

    // ----- Work area per challenge type -----
    let work;

    if (step.type === 'write' || step.type === 'fix') {
      const startText = step.type === 'fix' ? step.broken : '';
      const saved = cfg.draftKey ? game.draft(cfg.draftKey) : null;
      const keys = step.keys || {};
      editor = U.editor({
        value: saved || startText,
        keys: { words: keys.words || ['SELECT', 'FROM', 'WHERE'], tables: tableNames, columns: keys.columns === false ? [] : columnNames, values: keys.values || [] },
        onInput: v => { saveDraft(v); if (coach) coach.onText(v); },
        onRun: () => check(editor.value, b => editor.setBusy(b)),
        onReset: step.type === 'fix' ? () => step.broken : null,
        resetLabel: step.type === 'fix' ? 'Start over' : 'Clear'
      });
      lockWork = () => { editor.textarea.readOnly = true; editor.runBtn.disabled = true; editor.el.classList.add('is-locked'); };
      work = h('section.card.work', { 'aria-label': 'Your query' }, editor.el);
      idle(step.type === 'fix' ? 'Run the broken query first and read what the database says.' : null);
      previewGoal();
    }

    else if (step.type === 'blank') {
      const picks = step.blanks.map(() => null);
      let active = 0;
      const codeEl = h('pre.sql.blank-code');
      const optsEl = h('div.blank-opts', { role: 'group', 'aria-label': 'Choices for the selected blank' });
      const runBtn = h('button.btn.btn-primary.run', { type: 'button', disabled: true, onclick: () => check(db.fill(step.template, picks), b => { runBtn.disabled = b; }) }, U.icon('play', 18), h('span', 'Run'));
      let locked = false;
      function draw() {
        U.clear(codeEl);
        const parts = step.template.split(/(\{\d+\})/);
        for (const part of parts) {
          const m = /^\{(\d+)\}$/.exec(part);
          if (!m) { const span = document.createElement('span'); span.innerHTML = sqlx.highlight(part); codeEl.appendChild(span); continue; }
          const i = +m[1];
          codeEl.appendChild(h('button.slot' + (i === active && !locked ? '.is-active' : '') + (picks[i] !== null ? '.is-filled' : ''), {
            type: 'button', disabled: locked, 'aria-label': 'Blank ' + (i + 1) + (picks[i] !== null ? ', filled with ' + picks[i] : ', empty'),
            onclick: () => { active = i; draw(); }
          }, picks[i] !== null ? picks[i] : ' ? '));
        }
        U.clear(optsEl);
        if (!locked) {
          optsEl.appendChild(h('span.blank-label', 'Blank ' + (active + 1) + ' of ' + step.blanks.length));
          step.blanks[active].options.forEach(o => optsEl.appendChild(h('button.key.key-val' + (picks[active] === o ? '.is-picked' : ''), {
            type: 'button', 'aria-pressed': String(picks[active] === o),
            onclick: () => {
              picks[active] = o; U.sound('tap');
              const nextEmpty = picks.findIndex(p => p === null);
              if (nextEmpty !== -1) active = nextEmpty;
              draw();
            }
          }, o)));
        }
        runBtn.disabled = locked || picks.some(p => p === null);
      }
      lockWork = () => { locked = true; draw(); };
      draw();
      work = h('section.card.work', { 'aria-label': 'Fill the blanks' }, codeEl, optsEl, h('div.ed-actions', runBtn));
      idle('Fill every blank, then run it.');
      previewGoal();
    }

    else if (step.type === 'choose') {
      let chosen = -1, locked = false;
      const wrong = new Set();
      const list = h('div.opts', { role: 'radiogroup', 'aria-label': 'Queries to choose from' });
      const runBtn = h('button.btn.btn-primary.run', { type: 'button', disabled: true, onclick: run }, U.icon('play', 18), h('span', 'Run this one'));
      function draw() {
        U.clear(list);
        step.options.forEach((o, i) => {
          list.appendChild(h('button.opt' + (i === chosen ? '.is-chosen' : '') + (wrong.has(i) ? '.is-wrong' : '') + (locked && i === chosen ? '.is-right' : ''), {
            type: 'button', role: 'radio', 'aria-checked': String(i === chosen), disabled: locked || wrong.has(i),
            onclick: () => { chosen = i; U.sound('tap'); draw(); }
          }, h('span.opt-letter', 'ABCDEF'[i]), U.codeBlock(o.sql), wrong.has(i) && o.why ? h('span.opt-why', o.why) : null));
        });
        runBtn.disabled = locked || chosen === -1 || wrong.has(chosen);
      }
      async function run() {
        const i = chosen;
        const res = await check(step.options[i].sql, b => { runBtn.disabled = b; });
        if (!res) return;
        if (res.status !== 'pass') {
          if (res.status === 'error') miss();
          wrong.add(i); chosen = -1;
          const why = step.options[i].why;
          if (why && res.status === 'fail') setBanner('fail', 'Not option ' + 'ABCDEF'[i] + '.', why + ' ' + res.message);
          draw();
        }
      }
      lockWork = () => { locked = true; draw(); };
      draw();
      work = h('section.card.work', { 'aria-label': 'Pick a query' }, list, h('div.ed-actions', runBtn));
      idle('Pick a query and run it. You see its real result either way.');
      previewGoal();
    }

    else if (step.type === 'predict') {
      let chosen = -1, locked = false, shown = false;
      const list = h('div.opts.opts-predict', { role: 'radiogroup', 'aria-label': 'Possible results' });
      const lockBtn = h('button.btn.btn-primary.run', { type: 'button', disabled: true, onclick: lockIn }, h('span', 'Lock it in'));
      function draw() {
        U.clear(list);
        step.options.forEach((o, i) => {
          const right = shown && i === step.answer, bad = shown && i === chosen && i !== step.answer;
          list.appendChild(h('button.opt' + (i === chosen ? '.is-chosen' : '') + (right ? '.is-right' : '') + (bad ? '.is-wrong' : ''), {
            type: 'button', role: 'radio', 'aria-checked': String(i === chosen), disabled: locked,
            onclick: () => { chosen = i; U.sound('tap'); draw(); }
          }, h('span.opt-letter', 'ABCDEF'[i]), o.table ? h('div.opt-table', U.miniTable(o.table)) : h('span.opt-text', o.text), bad && o.why ? h('span.opt-why', o.why) : null));
        });
        lockBtn.disabled = locked || chosen === -1;
      }
      async function lockIn() {
        if (locked) return;
        locked = true; draw();
        let actual = null;
        try { actual = await db.goalFor(step, datasetId); } catch (e) { /* show the verdict anyway */ }
        if (destroyed) return;
        game.noteRun();
        shown = true; draw();
        U.clear(tablesEl);
        if (actual) tablesEl.appendChild(U.resultTable(actual, { title: 'What the query really returns', tone: 'goal' }));
        if (chosen === step.answer) {
          pass('You read that query exactly the way the database does.');
        } else {
          miss();
          passed = true;
          const why = step.options[chosen].why || '';
          const go = h('button.btn.btn-primary', { type: 'button', onclick: () => { go.disabled = true; cfg.onPass(Object.assign({ outcome: outcomeOf() }, perf)); } }, h('span', 'Continue'), U.icon('next', 18));
          setBanner('fail', 'Not this time.', (why ? why + ' ' : '') + 'The real result is below. Option ' + 'ABCDEF'[step.answer] + ' matched it.', h('div.outcome-extra', go));
          game.draft(cfg.draftKey, null);
        }
      }
      draw();
      work = h('section.card.work', { 'aria-label': 'Predict the result' },
        U.codeBlock(step.sql, 'predict-sql'), h('p.question', step.question || 'What does this query return?'), list, h('div.ed-actions', lockBtn));
      idle('Pick the result you expect, then lock it in. The query runs for real after you answer.');
    }

    const root = h('div.step.step-' + step.type, mission, h('div.step-main', work, results));
    U.clear(mount).appendChild(root);

    // ----- Guided tutorial -----
    if (step.coach && cfg.coach && editor) {
      coach = U.coach(step.coach, {
        resolve(target) {
          if (target === 'task') return taskEl;
          if (target === 'run') return editor.runBtn;
          if (target === 'results') return results;
          if (target.indexOf('key:') === 0) return editor.keyEl(target.slice(4));
          return null;
        },
        onDone: skipped => { if (cfg.onCoachDone) cfg.onCoachDone(skipped); }
      });
      coach.onText(editor.value);
    }

    return {
      perf: perf,
      destroy() { destroyed = true; if (coach && coach.active) coach.remove(); }
    };
  };
})();
