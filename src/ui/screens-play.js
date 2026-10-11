/* ===== ui/screens-play.js =====
 * The main path through the game: loading screen, the map, a level, and the level-complete card.
 * Each screen is a function (mount, params) that draws into `mount` and may return a cleanup function.
 */
(function () {
  'use strict';
  const U = QS.ui;
  const h = U.h;
  const screens = U.screens = U.screens || {};
  const fmt = n => Number(n).toLocaleString('en-US');

  // ---------- Mountain art (shared by the loading screen and the map) ----------
  // The dashed route carries one marker per world, so the picture doubles as a progress bar.
  U.mountain = function (campsDone) {
    const wrap = h('div.mountain', { role: 'img', 'aria-label': 'A snowy peak with a route of ten camps. ' + (campsDone || 0) + ' reached.' });
    wrap.innerHTML =
      '<svg viewBox="0 0 400 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<defs><linearGradient id="qs-glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="glow-a"/><stop offset="1" class="glow-b"/></linearGradient></defs>' +
      '<path class="mt-far" d="M0 170V112l48-40 46 34 54-52 58 56 52-30 50 34 52-40 40 26v70z"/>' +
      '<path class="mt-main" d="M58 170L230 22l170 148z"/>' +
      '<path class="mt-shade" d="M230 22l170 148H262l14-44-30-42z"/>' +
      '<path fill="url(#qs-glow)" d="M230 22l40 35-17 6-12-9-12 13-14-10-15 8-9-8z"/>' +
      '<path class="mt-near" d="M0 170v-30l72-22 66 32 52-14 52 34z"/>' +
      '<path class="mt-route" id="qs-route" d="M100 152l72-24-38-16 74-20-30-14 50-20-12-12 14-20" fill="none"/>' +
      '<path class="mt-flag" d="M230 23V7m0 1l13 4-13 4" />' +
      '<g class="mt-camps"></g></svg>';
    // Place ten camp markers along the route.
    try {
      const route = wrap.querySelector('#qs-route'), g = wrap.querySelector('.mt-camps');
      const len = route.getTotalLength();
      for (let i = 0; i < 10; i++) {
        const p = route.getPointAtLength(len * (i / 9.4 + 0.02));
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1)); c.setAttribute('r', i < (campsDone || 0) ? '4.2' : '3.2');
        c.setAttribute('class', i < (campsDone || 0) ? 'camp is-done' : 'camp');
        g.appendChild(c);
      }
    } catch (e) { /* decoration only */ }
    return wrap;
  };

  // ---------- Loading screen ----------
  screens.boot = function (mount) {
    const save = QS.state.save, game = QS.state.game;
    const firstRun = !Object.keys(save.data.levels).length && !save.data.flags.introSeen.w1;
    const fill = h('div.load-fill');
    const status = h('p.load-status', { role: 'status', 'aria-live': 'polite' }, 'Loading the SQL engine...');
    const actions = h('div.load-actions');
    const details = h('pre.raw', { hidden: true });
    const world = QS.content.worlds[0];
    let gone = false;

    const startBtn = h('button.btn.btn-primary.btn-big', { type: 'button', disabled: true, onclick: begin }, h('span', firstRun ? 'Start the climb' : 'Continue'), U.icon('next', 18));
    function begin() {
      const back = U.app.takeResume();
      if (firstRun) { game.setFlag('introSeen', 'w1', true); U.app.go('level', { id: world.levels[0].id }); }
      else if (back) U.app.go(back.screen, back.params);
      else U.app.go('home');
    }

    mount.appendChild(h('div.boot',
      U.mountain(0),
      h('div.boot-body',
        h('h1.title', 'Query Summit'),
        h('p.tagline', 'Learn SQL one camp at a time, from your first SELECT to the top.'),
        firstRun ? h('div.boot-story', U.owl('calm', 52), h('div.bubble', h('span.who', 'Juno'), world.intro.map(line => U.richEl('p', line)))) : null,
        h('div.load', h('div.load-bar', { role: 'progressbar', 'aria-label': 'Engine loading', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill), status),
        actions, details,
        h('p.fineprint', 'Runs a real database (DuckDB) inside your browser. The first visit downloads the engine, about 7 MB. After that your browser keeps a copy.'))));
    actions.appendChild(startBtn);

    const setFill = f => { fill.style.transform = 'scaleX(' + Math.max(0.03, Math.min(1, f)) + ')'; fill.parentNode.setAttribute('aria-valuenow', String(Math.round(f * 100))); };

    async function load() {
      U.clear(actions).appendChild(startBtn);
      details.hidden = true; startBtn.disabled = true;
      status.textContent = 'Loading the SQL engine...';
      setFill(0.03);
      try {
        await QS.engine.db.boot(f => { if (!gone) { f = Math.max(0, Math.min(1, f)); setFill(f * 0.95); status.textContent = 'Loading the SQL engine... ' + Math.round(f * 100) + '%'; } });
        if (gone) return;
        setFill(1);
        status.textContent = 'Engine ready.';
        startBtn.disabled = false;
        if (firstRun) { try { startBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        else begin();
      } catch (e) {
        if (gone) return;
        setFill(0.03);
        status.textContent = 'The SQL engine could not load. Check your connection, then try again. Some embedded previews block the engine. If retrying does not help, open the game in a regular browser tab.';
        details.textContent = (e && e.details) || String((e && e.message) || e);
        const toggle = h('button.btn.btn-quiet', { type: 'button', onclick: () => { details.hidden = !details.hidden; toggle.textContent = details.hidden ? 'Details' : 'Hide details'; } }, 'Details');
        U.clear(actions);
        actions.appendChild(h('button.btn.btn-primary', { type: 'button', onclick: load }, U.icon('reset', 18), h('span', 'Try again')));
        actions.appendChild(toggle);
      }
    }
    load();
    return () => { gone = true; };
  };

  // ---------- Map ----------
  const NODE_X = [54, 266], ROW = 92, TOP = 44, TRAIL_W = 320;

  function trail(world) {
    const game = QS.state.game;
    const n = world.levels.length;
    const height = TOP + (n - 1) * ROW + 52;
    const pts = world.levels.map((lv, i) => ({ x: NODE_X[i % 2], y: TOP + i * ROW }));
    const seg = (a, b) => 'M' + a.x + ' ' + a.y + 'C' + a.x + ' ' + (a.y + ROW * 0.62) + ' ' + b.x + ' ' + (b.y - ROW * 0.62) + ' ' + b.x + ' ' + b.y;
    let all = '', done = '';
    for (let i = 1; i < n; i++) {
      all += seg(pts[i - 1], pts[i]);
      if (game.isDone(world.levels[i - 1].id) && game.isUnlocked(world.levels[i].id)) done += seg(pts[i - 1], pts[i]);
    }
    const box = h('div.trail');
    box.style.height = height + 'px';
    box.innerHTML = '<svg class="trail-svg" viewBox="0 0 ' + TRAIL_W + ' ' + height + '" width="' + TRAIL_W + '" height="' + height + '" aria-hidden="true"><path class="trail-all" d="' + all + '"/><path class="trail-done" d="' + done + '"/></svg>';
    const current = game.currentLevel();
    world.levels.forEach((lv, i) => {
      const doneLv = game.isDone(lv.id), open = game.isUnlocked(lv.id), isCur = current && current.level.id === lv.id;
      const side = i % 2 === 0 ? 'left' : 'right';
      const state = doneLv ? 'done' : open ? 'open' : 'locked';
      const label = (lv.boss ? 'Boss: ' : 'Level ' + (i + 1) + ': ') + lv.title + (doneLv ? ', ' + game.starsOf(lv.id) + ' of 3 stars' : open ? ', ready to play' : ', locked');
      const btn = h('button.node.node-' + side + '.is-' + state + (lv.boss ? '.is-boss' : '') + (isCur ? '.is-current' : ''), {
        type: 'button', 'aria-label': label, disabled: !open, 'data-level': lv.id,
        onclick: () => U.app.go('level', { id: lv.id })
      },
        h('span.node-dot', doneLv ? U.icon('check', 22) : open ? (lv.boss ? U.icon('flag', 22) : h('span.node-num', String(i + 1))) : U.icon('lock', 18)),
        h('span.node-label',
          h('span.node-title', U.trailMark(lv.trail), h('span', lv.title)),
          doneLv ? U.stars(game.starsOf(lv.id)) : h('span.node-sub', isCur ? 'Start here' : open ? 'Open' : (lv.boss ? 'Boss' : 'Locked'))));
      btn.style.top = (pts[i].y - 30) + 'px';
      box.appendChild(btn);
    });
    return box;
  }

  function worldSection(world) {
    const game = QS.state.game;
    const built = game.isBuilt(world);
    const prog = game.worldProgress(world);
    const sign = h('div.sign' + (built ? '' : '.sign-locked'),
      h('div.sign-top', h('span.sign-camp', world.camp + ' · ' + fmt(world.altitude) + ' m'), built ? h('span.sign-stars', U.icon('star', 14), prog.stars + ' / ' + prog.maxStars) : h('span.sign-lock', U.icon('lock', 14), 'Not open yet')),
      h('h2.sign-title', h('span.sign-n', String(world.n)), world.title),
      h('p.sign-case', world.caseName),
      h('p.sign-teaser', world.teaser));
    return h('section.world' + (built ? '' : '.world-locked'), { 'aria-label': 'World ' + world.n + ': ' + world.title }, sign, built ? trail(world) : null);
  }

  screens.home = function (mount) {
    const game = QS.state.game, save = QS.state.save.data;
    const cur = game.currentLevel();
    const r = game.rank();
    const worlds = QS.content.worlds;
    const campsDone = worlds.filter(w => game.isBuilt(w) && w.levels.every(l => game.isDone(l.id))).length;
    const here = cur ? cur.world : worlds.filter(game.isBuilt).slice(-1)[0];

    const cta = cur
      ? h('button.btn.btn-primary.btn-big', { type: 'button', onclick: () => U.app.go('level', { id: cur.level.id }) }, U.icon('play', 18), h('span', (Object.keys(save.levels).length ? 'Continue: ' : 'Start: ') + cur.level.title))
      : h('button.btn.btn-primary.btn-big', { type: 'button', onclick: () => U.app.go('drill') }, U.icon('drill', 18), h('span', 'Stay sharp: Daily Drill'));

    const hero = h('section.hero',
      U.mountain(campsDone),
      h('div.hero-body',
        h('h1.title', 'Query Summit'),
        h('p.hero-where', cur ? here.camp + ' · ' + fmt(here.altitude) + ' m · ' + here.caseName : 'Every open camp is cleared. World ' + (campsDone + 1) + ' opens in a later update.'),
        h('div.rankline',
          h('span.rank-title', r.title),
          h('span.rank-bar', { role: 'img', 'aria-label': fmt(save.xp) + ' XP' + (r.next ? ', ' + fmt(r.next - save.xp) + ' to ' + r.nextTitle : '') }, h('span.rank-fill', { style: 'transform:scaleX(' + r.pct + ')' })),
          h('span.rank-xp', fmt(save.xp) + ' XP')),
        cta));

    // Daily Drill teaser
    let drillCard;
    if (game.drillUnlocked()) {
      const d = game.drillToday();
      drillCard = h('button.rail-card', { type: 'button', onclick: () => U.app.go('drill') },
        h('span.rail-ico', U.icon('drill', 22)),
        h('span.rail-text', h('strong', 'Daily Drill'), h('span', d.finished ? 'Done for today. Streak: ' + d.streak + (d.streak === 1 ? ' day' : ' days') : d.items.length + ' quick questions' + (d.focus.length ? ' on ' + d.focus.slice(0, 2).join(' and ') : ''))),
        U.icon('next', 18));
    } else {
      drillCard = h('div.rail-card.is-off', h('span.rail-ico', U.icon('lock', 20)), h('span.rail-text', h('strong', 'Daily Drill'), h('span', 'Opens after Level 2. It brings back whatever you found hard.')));
    }
    const sandboxCard = h('button.rail-card', { type: 'button', onclick: () => U.app.go('sandbox') },
      h('span.rail-ico', U.icon('sandbox', 22)), h('span.rail-text', h('strong', 'Sandbox'), h('span', 'Free play. Query the data with no goal.')), U.icon('next', 18));

    const summit = h('div.summit', U.icon('flag', 22), h('span', 'The summit · 5,600 m · Data Architect'));

    mount.appendChild(h('div.home',
      hero,
      h('div.home-grid',
        h('div.rail', drillCard, sandboxCard),
        h('div.worlds', worlds.map(worldSection), summit))));

    // Bring the current level into view on phones, where the map is long.
    const curBtn = mount.querySelector('.node.is-current');
    if (curBtn && Object.keys(save.levels).length > 2) setTimeout(() => { try { curBtn.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* ignore */ } }, 0);
  };

  // ---------- Level ----------
  screens.level = function (mount, params) {
    const game = QS.state.game, save = QS.state.save.data;
    const f = game.findLevel(params.id);
    if (!f || !game.isUnlocked(params.id)) { U.app.go('home'); return; }
    const level = f.level, world = f.world;
    const total = { misses: 0, hints: 0, revealed: false };
    const litSkills = [];
    let index = 0, runner = null;

    const dots = h('span.step-dots', { 'aria-hidden': level.steps.length < 2 ? 'true' : null });
    const stepMount = h('div.step-mount');
    const storyEl = h('div.story');
    const bar = h('div.lvl-bar',
      h('button.btn-icon', { type: 'button', 'aria-label': 'Back to the map', onclick: () => U.app.go('home') }, U.icon('back', 22)),
      h('div.lvl-name', h('span.lvl-crumb', 'World ' + world.n + ' · ' + (level.boss ? 'Boss' : 'Level ' + f.n)), h('h1.lvl-title', U.trailMark(level.trail), h('span', level.title))),
      dots);
    mount.appendChild(h('div.level', bar, storyEl, stepMount));

    function drawDots() {
      U.clear(dots);
      if (level.steps.length < 2) return;
      dots.setAttribute('aria-label', 'Step ' + (index + 1) + ' of ' + level.steps.length);
      level.steps.forEach((s, i) => dots.appendChild(h('span.step-dot' + (i < index ? '.is-done' : i === index ? '.is-now' : ''))));
      dots.appendChild(h('span.step-count', (index + 1) + ' / ' + level.steps.length));
    }

    function play() {
      const step = level.steps[index];
      drawDots();
      U.clear(storyEl);
      if (index === 0) storyEl.appendChild(U.says(level.story, 'calm'));
      if (runner) runner.destroy();
      runner = U.stepRunner(stepMount, {
        step: step, datasetId: world.dataset, draftKey: level.id + ':' + index, mode: 'level',
        coach: !save.flags.tutorialDone,
        passLabel: index < level.steps.length - 1 ? 'Next step' : 'Finish',
        onCoachDone: () => game.setFlag('tutorialDone', null, true),
        onPass: perf => {
          total.misses += perf.misses; total.hints += perf.hints; total.revealed = total.revealed || perf.revealed;
          for (const id of game.recordStep(step.skills, perf.outcome)) litSkills.push(id);
          if (index < level.steps.length - 1) { index += 1; play(); window.scrollTo(0, 0); }
          else finish();
        }
      });
    }

    function finish() {
      const rewards = game.finishLevel(level.id, total);
      celebrate({ level: level, world: world, rewards: rewards, lit: litSkills, next: game.nextLevel(level.id) });
    }

    const startPlay = () => { QS.engine.db.useDataset(world.dataset).then(play, play); };
    if (f.n === 1 && !save.flags.introSeen[world.id] && world.intro) {
      U.dialog(world.intro, { title: world.caseName, last: 'Let’s go', done: () => { game.setFlag('introSeen', world.id, true); startPlay(); } });
    } else startPlay();

    return () => { if (runner) runner.destroy(); };
  };

  // ---------- Level complete ----------
  function celebrate(ctx) {
    const game = QS.state.game, save = QS.state.save.data;
    const level = ctx.level, rw = ctx.rewards;
    const r = game.rank();
    const skillName = id => (QS.content.skills.find(s => s.id === id) || {}).name || id;

    const starRow = h('div.cele-stars', { role: 'img', 'aria-label': rw.stars + ' of 3 stars' }, [0, 1, 2].map(i => h('span.cele-star' + (i < rw.stars ? '.is-won' : ''), U.icon('star', 44))));
    const why = rw.stars === 3 ? 'Solved, with at most one miss and no hints.'
      : rw.perf.revealed ? 'Solved with the solution open. Replay it on your own for more stars.'
      : rw.stars === 2 ? (rw.perf.hints > 0 ? 'Solved with at most one miss. Skip the hints for the third star.' : 'Solved without hints. Keep it to one miss for the third star.')
      : 'Solved. Fewer misses and no hints earn more stars.';
    const xpLine = h('div.cele-xp', U.icon('bolt', 18), h('strong', rw.xp ? '+' + rw.xp + ' XP' : 'No new XP'), h('span.muted', rw.xp ? '' : rw.first ? '' : 'You already had ' + rw.prevStars + (rw.prevStars === 1 ? ' star' : ' stars') + ' here.'));
    const rankBox = h('div.cele-rank',
      h('div.rankline', h('span.rank-title', r.title), h('span.rank-bar', h('span.rank-fill', { style: 'transform:scaleX(' + r.pct + ')' })), h('span.rank-xp', r.next ? fmt(r.next - save.xp) + ' XP to ' + r.nextTitle : 'Top rank')),
      rw.rankUp ? h('p.cele-up', 'New rank: ' + rw.rankUp) : null);

    const extras = h('div.cele-extras');
    for (const b of rw.badges) extras.appendChild(h('div.cele-chip.is-badge', U.icon('flag', 16), h('span', h('strong', 'Badge: ' + b.name), h('span', b.about))));
    for (const id of ctx.lit) extras.appendChild(h('div.cele-chip.is-skill', U.icon('skills', 16), h('span', h('strong', 'Skill mastered'), h('span', skillName(id)))));

    const corner = level.corner ? h('aside.corner',
      h('div.corner-head', U.icon('corner', 18), h('span', 'Snowflake Corner')),
      h('h3', level.corner.title), U.richEl('p', level.corner.body),
      level.corner.code ? U.codeBlock(level.corner.code) : null) : null;

    const body = h('div.cele' + (level.boss ? '.cele-boss' : ''),
      h('p.eyebrow', level.boss ? 'Case closed' : 'Level complete'),
      h('h2.cele-title', level.title),
      starRow, h('p.cele-why', why), xpLine, rankBox, extras,
      level.after ? U.says(level.after, 'happy') : null,
      corner);

    const leave = to => { sheet.close(); afterClose(to); };
    function afterClose(to) {
      const world = ctx.world;
      const go = () => { if (to === 'next' && ctx.next) U.app.go('level', { id: ctx.next.level.id }); else if (to === 'replay') U.app.go('level', { id: level.id }); else U.app.go('home'); };
      if (rw.closesWorld && world.outro && !save.flags.outroSeen[world.id]) {
        game.setFlag('outroSeen', world.id, true);
        U.dialog(world.outro, { title: world.caseName, mood: 'happy', last: 'Back to the map', done: () => U.app.go('home') });
      } else go();
    }
    const actions = [];
    if (ctx.next && game.isUnlocked(ctx.next.level.id)) actions.push(h('button.btn.btn-primary', { type: 'button', 'data-autofocus': true, onclick: () => leave('next') }, h('span', 'Next level'), U.icon('next', 18)));
    else actions.push(h('button.btn.btn-primary', { type: 'button', 'data-autofocus': true, onclick: () => leave('map') }, 'Back to the map'));
    if (rw.stars < 3) actions.push(h('button.btn.btn-ghost', { type: 'button', onclick: () => leave('replay') }, 'Replay for more stars'));
    if (ctx.next) actions.push(h('button.btn.btn-quiet', { type: 'button', onclick: () => leave('map') }, 'Map'));

    const sheet = U.sheet({ title: '', body: body, actions: actions, kind: 'center', dismiss: false });
    sheet.panel.classList.add('sheet-cele');

    // Stars land one by one. A tap anywhere skips the wait.
    const wins = Array.prototype.slice.call(starRow.querySelectorAll('.is-won'));
    const timers = [];
    const landAll = () => { timers.forEach(clearTimeout); wins.forEach(s => s.classList.add('is-in')); body.classList.add('is-settled'); };
    if (U.reducedMotion()) landAll();
    else {
      wins.forEach((s, i) => timers.push(setTimeout(() => { s.classList.add('is-in'); U.sound('star'); if (i === wins.length - 1) { U.burst(s); } }, 250 + i * 280)));
      timers.push(setTimeout(() => { body.classList.add('is-settled'); U.sound('win'); }, 250 + wins.length * 280 + 150));
      sheet.panel.addEventListener('pointerdown', landAll, { once: true });
    }
  }
})();
