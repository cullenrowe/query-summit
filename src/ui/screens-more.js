/* ===== ui/screens-more.js =====
 * Daily Drill, Sandbox, Skills (rank, badges, skill tree), and Settings.
 */
(function () {
  'use strict';
  const U = QS.ui;
  const h = U.h;
  const screens = U.screens = U.screens || {};
  const fmt = n => Number(n).toLocaleString('en-US');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // ---------- Daily Drill ----------
  // params: {} for today's drill, { extra: true } for more practice, { skill: id } to practice one skill.
  screens.drill = function (mount, params) {
    params = params || {};
    const game = QS.state.game;
    const root = h('div.drill');
    mount.appendChild(root);
    let runner = null;

    const head = (title, sub) => h('header.page-head', h('h1.page-title', title), sub ? h('p.page-sub', sub) : null);

    function intro() {
      U.clear(root);
      if (!game.drillUnlocked()) {
        root.appendChild(head('Daily Drill', 'A few quick questions a day, picked from the skills you found hardest.'));
        root.appendChild(h('div.card.empty', U.owl('think', 56), h('p', 'The drill opens once you finish Level 2. It needs a few skills to work with.'),
          h('button.btn.btn-primary', { type: 'button', onclick: () => U.app.go('home') }, 'Back to the map')));
        return;
      }
      const d = game.drillToday();
      root.appendChild(head('Daily Drill', 'Quick review, picked for you. Skills you missed come back sooner. Skills you know wait longer.'));
      const streak = h('div.streak', U.icon('flame', 22), h('strong', String(d.streak)), h('span', d.streak === 1 ? 'day streak' : 'day streak'));
      if (d.finished) {
        root.appendChild(h('div.card.drill-card', streak,
          h('h2', 'Done for today'), h('p', 'Come back tomorrow to keep the streak. Want more now? Extra practice still builds your skills.'),
          h('div.btn-row',
            h('button.btn.btn-primary', { type: 'button', onclick: () => start(game.extraSet(), false, 'Extra practice') }, 'Practice 5 more'),
            h('button.btn.btn-ghost', { type: 'button', onclick: () => U.app.go('home') }, 'Back to the map'))));
      } else {
        const left = d.items.length - d.done;
        root.appendChild(h('div.card.drill-card', streak,
          h('h2', d.done ? plural(left, 'question') + ' left today' : plural(d.items.length, 'question') + ' today'),
          d.focus.length ? h('p', 'Today leans on: ', h('strong', d.focus.join(', ')), '.') : null,
          h('p.muted', 'Each one takes about a minute. Finishing the set adds a day to your streak.'),
          h('div.btn-row', h('button.btn.btn-primary.btn-big', { type: 'button', onclick: () => start(d.items, true, 'Daily Drill', d.done) }, U.icon('play', 18), h('span', d.done ? 'Continue' : 'Start drill')))));
      }
    }

    function start(items, daily, title, from) {
      items = items.filter(Boolean);
      if (!items.length) { U.toast('No practice questions for that yet.'); intro(); return; }
      let i = from || 0, xp = 0;
      const marks = [];
      const stepMount = h('div.step-mount');
      const count = h('span.step-count');
      const dots = h('span.step-dots');
      U.clear(root);
      root.appendChild(h('div.lvl-bar',
        h('button.btn-icon', { type: 'button', 'aria-label': 'Leave the drill', onclick: () => { if (params.skill) U.app.go('skills'); else intro(); } }, U.icon('back', 22)),
        h('div.lvl-name', h('span.lvl-crumb', title), h('h1.lvl-title', count)), dots));
      root.appendChild(stepMount);

      function play() {
        const drill = items[i];
        count.textContent = 'Question ' + (i + 1) + ' of ' + items.length;
        U.clear(dots); items.forEach((x, j) => dots.appendChild(h('span.step-dot' + (j < i ? '.is-done' : j === i ? '.is-now' : ''))));
        if (runner) runner.destroy();
        QS.engine.db.useDataset(drill.dataset).then(go, go);
        function go() {
          runner = U.stepRunner(stepMount, {
            step: drill, datasetId: drill.dataset, draftKey: null, mode: 'drill',
            passLabel: i < items.length - 1 ? 'Next question' : 'Finish',
            onPass: perf => {
              const res = game.drillItemDone(drill, perf.outcome, daily);
              xp += res.xp; marks.push(perf.outcome);
              for (const b of res.badges) U.toast('Badge earned: ' + b.name, 'ok');
              if (res.rankUp) U.toast('New rank: ' + res.rankUp, 'ok');
              if (res.lit.length) U.toast((res.lit.length === 1 ? 'Skill mastered: ' : 'Skills mastered: ') + res.lit.map(id => (QS.content.skills.find(s => s.id === id) || {}).name || id).join(', '), 'ok');
              if (i < items.length - 1) { i += 1; play(); window.scrollTo(0, 0); }
              else summary(items, marks, xp, daily, res);
            }
          });
        }
      }
      play();
    }

    function summary(items, marks, xp, daily, last) {
      if (runner) { runner.destroy(); runner = null; }
      U.clear(root);
      const clean = marks.filter(m => m === 'clean').length;
      const word = { clean: 'Clean', shaky: 'Got there', struggled: 'Needs another look' };
      root.appendChild(head(daily ? 'Drill complete' : 'Practice complete', clean === items.length ? 'Every answer clean. Those skills now wait longer before they come back.' : 'Anything that was not clean comes back sooner.'));
      const card = h('div.card.drill-card',
        daily && last.finishedSet ? h('div.streak', U.icon('flame', 22), h('strong', String(last.streak)), h('span', 'day streak')) : null,
        h('div.cele-xp', U.icon('bolt', 18), h('strong', '+' + xp + ' XP')),
        h('ul.drill-list', items.map((d, j) => h('li.is-' + marks[j], h('span.drill-mark', U.icon(marks[j] === 'clean' ? 'check' : marks[j] === 'shaky' ? 'hint' : 'reset', 16)),
          h('span.drill-skill', d.skills.map(id => (QS.content.skills.find(s => s.id === id) || {}).name || id).join(' + ')), h('span.muted', word[marks[j]])))),
        h('div.btn-row',
          h('button.btn.btn-primary', { type: 'button', onclick: () => U.app.go(params.skill ? 'skills' : 'home') }, params.skill ? 'Back to skills' : 'Back to the map'),
          h('button.btn.btn-ghost', { type: 'button', onclick: () => start(params.skill ? game.practiceSet(params.skill) : game.extraSet(), false, 'Extra practice') }, 'Practice more')));
      root.appendChild(card);
      U.sound('win'); U.burst(card);
    }

    if (params.skill) start(game.practiceSet(params.skill), false, 'Practice: ' + ((QS.content.skills.find(s => s.id === params.skill) || {}).name || ''));
    else if (params.extra) start(game.extraSet(), false, 'Extra practice');
    else intro();
    return () => { if (runner) runner.destroy(); };
  };

  // ---------- Sandbox ----------
  const EXAMPLES = [
    ['First five accounts', 'SELECT *\nFROM accounts\nLIMIT 5'],
    ['Biggest by seats', 'SELECT company_name, seats\nFROM accounts\nORDER BY seats DESC\nLIMIT 10'],
    ['Accounts per country', 'SELECT country, COUNT(*) AS accounts\nFROM accounts\nGROUP BY country\nORDER BY accounts DESC'],
    ['Describe a table', 'DESCRIBE accounts']
  ];

  screens.sandbox = function (mount) {
    const game = QS.state.game, db = QS.engine.db;
    const ds = QS.content.datasets[Object.keys(QS.content.datasets)[0]];
    const columns = [];
    for (const t of ds.tables) for (const c of t.columns) if (columns.indexOf(c.name) === -1) columns.push(c.name);
    const banner = h('div.outcome.outcome-idle', { role: 'status', 'aria-live': 'polite' }, h('div.outcome-text', h('strong', 'No goal here. Try anything.')));
    const out = h('div.rt-pair.rt-solo');
    let running = false, gone = false;

    const setBanner = (tone, title, body, extra) => {
      banner.className = 'outcome outcome-' + tone; U.clear(banner);
      banner.appendChild(h('div.outcome-text', h('strong', title), body ? U.richEl('p', body) : null));
      if (extra) banner.appendChild(extra);
    };

    const editor = U.editor({
      id: 'qs-sandbox-sql',
      value: game.draft('sandbox') || EXAMPLES[0][1],
      keys: { words: ['SELECT', '*', 'FROM', 'WHERE', 'ORDER BY', 'DESC', 'LIMIT', 'DISTINCT', 'AS', 'AND', 'OR', 'GROUP BY'], tables: ds.tables.map(t => t.name), columns: columns, values: [] },
      onInput: v => game.draft('sandbox', v),
      onRun: run
    });

    async function run() {
      if (running) return;
      running = true; editor.setBusy(true); setBanner('idle', 'Running...');
      let res;
      try { res = await db.sandboxRun(editor.value, ds.id); }
      catch (e) { res = { status: 'error', error: QS.engine.explainError(e, { sql: editor.value, tables: ds.tables }) }; }
      running = false;
      if (gone) return;
      editor.setBusy(false);
      U.clear(out);
      if (res.status === 'ok') {
        const r = res.result;
        if (res.readOnly) setBanner('pass', 'Query ran', plural(r.rows.length, 'row') + (r.truncated ? ' shown (there are more)' : '') + ' in ' + r.ms + ' ms.');
        else setBanner('pass', 'Statement ran', 'Your changes stay until you reset the data or leave the Sandbox.');
        out.appendChild(U.resultTable(r, { title: 'Result', tone: 'yours' }));
        for (const b of game.noteSandboxRun()) U.toast('Badge earned: ' + b.name, 'ok');
        U.sound('ok');
      } else if (res.status === 'error') {
        const raw = h('pre.raw', { hidden: true }, res.error.raw);
        const toggle = h('button.btn.btn-quiet', { type: 'button', onclick: () => { raw.hidden = !raw.hidden; toggle.textContent = raw.hidden ? 'Details' : 'Hide details'; } }, 'Details');
        setBanner('error', res.error.title, res.error.body, h('div.outcome-extra', toggle, raw));
        U.sound('bad');
      } else setBanner('idle', res.title, res.message);
    }

    const resetBtn = h('button.btn.btn-ghost', { type: 'button', onclick: async () => {
      if (running) return;
      try { await db.useDataset(ds.id, true); U.clear(out); setBanner('idle', 'Data reset', 'Every table is back to its starting rows.'); } catch (e) { U.toast('Could not reset the data.'); }
    } }, U.icon('reset', 18), h('span', 'Reset data'));

    mount.appendChild(h('div.sandbox',
      h('header.page-head', h('h1.page-title', 'Sandbox'), h('p.page-sub', 'Free play on the ' + ds.label + ' data. Nothing here affects your stars. This is DuckDB, so Snowflake-only commands will not run.')),
      h('div.sandbox-grid',
        h('section.card.mission',
          U.tableChips(ds.id),
          h('div.examples', h('span.tables-label', 'Try one'), EXAMPLES.map(ex => h('button.chip', { type: 'button', onclick: () => { editor.value = ex[1]; game.draft('sandbox', ex[1]); } }, ex[0]))),
          h('div.hint-row', resetBtn)),
        h('div.step-main', h('section.card.work', editor.el), h('section.card.results', banner, out)))));

    db.useDataset(ds.id).catch(() => {});
    return () => { gone = true; };
  };

  // ---------- Skills: rank, badges, skill tree ----------
  screens.skills = function (mount) {
    const game = QS.state.game, save = QS.state.save.data, C = QS.content;
    const r = game.rank();
    const all = game.allLevels();
    const starTotal = all.reduce((n, x) => n + game.starsOf(x.level.id), 0);

    const player = h('section.card.player',
      U.owl('happy', 64),
      h('div.player-main',
        h('span.eyebrow', 'Your rank'), h('h2.player-rank', r.title),
        h('div.rankline', h('span.rank-bar', h('span.rank-fill', { style: 'transform:scaleX(' + r.pct + ')' })), h('span.rank-xp', fmt(save.xp) + ' XP')),
        h('p.muted', r.next ? fmt(r.next - save.xp) + ' XP to ' + r.nextTitle + '.' : 'Top rank reached.')),
      h('dl.stats',
        h('div', h('dt', 'Stars'), h('dd', starTotal + ' / ' + all.length * 3)),
        h('div', h('dt', 'Skills mastered'), h('dd', String(game.masteredCount()))),
        h('div', h('dt', 'Drill streak'), h('dd', plural(game.currentStreak(), 'day'))),
        h('div', h('dt', 'Queries run'), h('dd', fmt(save.stats.runs + save.stats.sandboxRuns)))));

    const ladder = h('ol.ranks', C.ranks.map((x, i) => h('li' + (i < r.index ? '.is-past' : i === r.index ? '.is-now' : ''), h('span.rank-step', x.title), h('span.muted', fmt(x.xp) + ' XP'))));

    const badges = h('div.badges', C.badges.map(b => {
      const got = !!save.badges[b.id];
      return h('div.badge' + (got ? '.is-got' : ''), h('span.badge-ico', U.icon(got ? 'flag' : 'lock', 20)), h('span.badge-text', h('strong', b.name), h('span', b.about)));
    }));

    function openSkill(skill, world) {
      const st = game.skillState(skill.id);
      const canPractice = st.seen && C.drills.some(d => d.skills.indexOf(skill.id) !== -1 && d.skills.every(id => game.skillState(id).seen));
      const state = st.pips >= 3 ? 'Mastered. It still comes back in drills now and then.' : st.seen ? st.pips + ' of 3 clean passes. The last one must be clean: no misses, no hints.' : 'Not met yet. It appears in World ' + world.n + '.';
      const sheet = U.sheet({
        title: skill.name,
        body: h('div.skill-sheet', skill.blurb ? h('p', skill.blurb) : null, skill.example ? U.codeBlock(QS.engine.sql.format(skill.example)) : null, h('p.muted', state)),
        actions: canPractice ? [h('button.btn.btn-primary', { type: 'button', onclick: () => { sheet.close(); U.app.go('drill', { skill: skill.id }); } }, U.icon('drill', 18), h('span', 'Practice this skill'))] : []
      });
    }

    const tree = h('div.tree', C.worlds.map(w => {
      const built = game.isBuilt(w);
      const skills = C.skills.filter(s => s.world === w.id);
      return h('div.branch' + (built ? '' : '.is-locked'),
        h('div.branch-head', h('span.branch-n', String(w.n)), h('span.branch-title', w.title), built ? null : U.icon('lock', 14)),
        h('div.branch-nodes', skills.map(s => {
          const st = game.skillState(s.id);
          const cls = !built ? 'is-locked' : st.pips >= 3 ? 'is-lit' : st.seen ? 'is-growing' : 'is-new';
          return h('button.skill.' + cls, { type: 'button', disabled: !built, 'aria-label': s.name + (built ? ', ' + st.pips + ' of 3' : ', locked'), onclick: () => openSkill(s, w) },
            h('span.hex', st.pips >= 3 ? U.icon('check', 18) : null),
            h('span.skill-name', s.name),
            built ? h('span.pips', [0, 1, 2].map(i => h('span.pip' + (i < st.pips ? '.is-on' : '')))) : null);
        })));
    }));

    mount.appendChild(h('div.skills',
      h('header.page-head', h('h1.page-title', 'Skills'), h('p.page-sub', 'Every SQL idea is a node. Pass it cleanly three times and it lights up.')),
      h('div.skills-grid',
        h('div.skills-side', player, h('section.card', h('h2.card-title', 'Ranks'), ladder), h('section.card', h('h2.card-title', 'Badges'), badges)),
        h('section.card.tree-card', h('h2.card-title', 'Skill tree'), tree))));
  };

  // ---------- Settings ----------
  screens.settings = function (mount) {
    const game = QS.state.game, save = QS.state.save;

    const seg = (name, key, options) => h('div.seg', { role: 'radiogroup', 'aria-label': name }, options.map(o => {
      const b = h('button.seg-btn' + (game.setting(key) === o[0] ? '.is-on' : ''), { type: 'button', role: 'radio', 'aria-checked': String(game.setting(key) === o[0]), onclick: () => { game.setting(key, o[0]); redraw(); } }, o[1]);
      return b;
    }));

    function exportSheet() {
      const code = save.exportCode();
      const field = h('textarea.code-field', { id: 'qs-export', readonly: true, rows: '6', 'aria-label': 'Your progress code' });
      field.value = code;
      U.sheet({
        title: 'Export progress',
        body: h('div', h('p', 'Copy this code and paste it into Import on another device. It holds your stars, XP, skills, and badges. No account needed.'), field),
        actions: [h('button.btn.btn-primary', { type: 'button', 'data-autofocus': true, onclick: () => U.copy(code, field) }, U.icon('copy', 18), h('span', 'Copy code'))]
      });
    }

    function importSheet() {
      const field = h('textarea.code-field', { id: 'qs-import', rows: '6', placeholder: 'Paste a progress code that starts with QS1.', 'aria-label': 'Progress code to import', spellcheck: 'false' });
      const msg = h('p.form-msg', { role: 'alert' });
      const sheet = U.sheet({
        title: 'Import progress',
        body: h('div', h('p', 'Paste a code from Export. It replaces the progress on this device.'), field, msg),
        actions: [h('button.btn.btn-primary', { type: 'button', onclick: () => {
          try { save.importCode(field.value); sheet.close(); QS.ui.app.applySettings(); game.emit('progress'); U.toast('Progress imported', 'ok'); redraw(); }
          catch (e) { msg.textContent = e.message; }
        } }, 'Import and replace')]
      });
    }

    function resetSheet() {
      const sheet = U.sheet({
        title: 'Reset progress?',
        body: h('p', 'This clears every star, all XP, badges, skills, and your drill streak on this device. It cannot be undone. Export first if you might want it back.'),
        actions: [
          h('button.btn.btn-danger', { type: 'button', onclick: () => { save.reset(); sheet.close(); game.emit('progress'); U.toast('Progress reset'); U.app.go('home'); } }, 'Reset everything'),
          h('button.btn.btn-ghost', { type: 'button', 'data-autofocus': true, onclick: () => sheet.close() }, 'Keep my progress')
        ]
      });
    }

    const root = h('div.settings');
    mount.appendChild(root);

    function redraw() {
      U.clear(root);
      const soundOn = !!game.setting('sound');
      const row = (label, help, control) => h('div.set-row', h('div.set-label', h('strong', label), help ? h('span', help) : null), h('div.set-control', control));
      root.appendChild(h('header.page-head', h('h1.page-title', 'Settings')));
      if (!save.storageOk) root.appendChild(h('div.outcome.outcome-fail', h('div.outcome-text', h('strong', 'Progress is not being saved'), h('p', 'This browser is blocking storage for the page. You can still play. Use Export to keep your progress.'))));
      root.appendChild(h('section.card',
        row('Sound', 'Short chimes for right answers and stars.', h('button.switch' + (soundOn ? '.is-on' : ''), { type: 'button', role: 'switch', 'aria-checked': String(soundOn), 'aria-label': 'Sound', onclick: () => { game.setting('sound', !soundOn); redraw(); if (!soundOn) U.sound('ok'); } }, h('span.switch-knob'))),
        row('Text size', null, seg('Text size', 'textSize', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']])),
        row('Theme', null, seg('Theme', 'theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]))));
      root.appendChild(h('section.card',
        row('Move to another device', 'Export gives you a code. Import reads one.', h('div.btn-row', h('button.btn.btn-ghost', { type: 'button', onclick: exportSheet }, 'Export progress'), h('button.btn.btn-ghost', { type: 'button', onclick: importSheet }, 'Import progress'))),
        row('Tutorial', 'Play the guided first level again.', h('button.btn.btn-ghost', { type: 'button', onclick: () => { game.setFlag('tutorialDone', null, false); game.draft('w1-l1:0', null); U.app.go('level', { id: 'w1-l1' }); } }, 'Replay tutorial')),
        row('Reset progress', 'Start over from Level 1.', h('button.btn.btn-ghost.btn-danger-quiet', { type: 'button', onclick: resetSheet }, 'Reset progress'))));
      root.appendChild(h('section.card.about',
        h('h2.card-title', 'About'),
        h('p', 'Query Summit runs DuckDB ' + '(duckdb-wasm ' + QS.engine.db.DUCKDB_VERSION + ') in your browser. It is not Snowflake, and it says so wherever the two differ. Snowflake-only features are taught in World 10 with predict and choose questions, not pretend queries.'),
        h('p.muted', 'Frostbyte Cloud and its customers are made up. This game is not affiliated with or endorsed by Snowflake Inc. Version ' + QS.VERSION + '.')));
    }
    redraw();
  };
})();
