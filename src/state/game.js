/* ===== state/game.js =====
 * Game rules on top of the save: unlocking, stars, XP and ranks, the skill tree,
 * badges, and the spaced-repetition schedule behind the Daily Drill.
 * No DOM code here. The UI calls these functions and redraws.
 */
(function () {
  'use strict';

  const C = () => QS.content;
  const S = () => QS.state.save.data;
  const keep = () => QS.state.save.persist();

  const listeners = [];
  const on = fn => { listeners.push(fn); };
  const emit = what => { for (const fn of listeners.slice()) fn(what); };

  const two = n => (n < 10 ? '0' : '') + n;
  const dayString = d => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  const today = () => dayString(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayString(d); };

  // ---------- Worlds and levels ----------
  const isBuilt = w => !!(w.levels && w.levels.length);

  function allLevels() {
    const out = [];
    for (const w of C().worlds) if (isBuilt(w)) w.levels.forEach((level, i) => out.push({ level: level, world: w, n: i + 1 }));
    return out;
  }
  function findLevel(id) {
    const all = allLevels();
    const i = all.findIndex(x => x.level.id === id);
    return i === -1 ? null : Object.assign({ index: i }, all[i]);
  }
  const levelSave = id => S().levels[id] || null;
  const isDone = id => !!levelSave(id);
  const starsOf = id => (levelSave(id) ? levelSave(id).stars : 0);

  function isUnlocked(id) {
    const f = findLevel(id);
    if (!f) return false;
    if (f.index === 0) return true;
    return isDone(allLevels()[f.index - 1].level.id);
  }
  function nextLevel(id) {
    const f = findLevel(id);
    const all = allLevels();
    return f && all[f.index + 1] ? all[f.index + 1] : null;
  }
  // The level the player should play next, or null when everything built is finished.
  function currentLevel() {
    return allLevels().find(x => !isDone(x.level.id)) || null;
  }
  function worldProgress(w) {
    if (!isBuilt(w)) return { stars: 0, maxStars: 0, done: 0, total: 0 };
    let stars = 0, done = 0;
    for (const l of w.levels) { stars += starsOf(l.id); if (isDone(l.id)) done++; }
    return { stars: stars, maxStars: w.levels.length * 3, done: done, total: w.levels.length };
  }
  // A world opens when the boss of the world before it is beaten (and the world has levels).
  function worldUnlocked(w) {
    if (!isBuilt(w)) return false;
    return isUnlocked(w.levels[0].id);
  }

  // ---------- Rank ----------
  function rank(xp) {
    if (xp === undefined) xp = S().xp;
    const ranks = C().ranks;
    let i = 0;
    while (i + 1 < ranks.length && xp >= ranks[i + 1].xp) i++;
    const next = ranks[i + 1] || null;
    return {
      index: i, title: ranks[i].title, floor: ranks[i].xp,
      next: next ? next.xp : null, nextTitle: next ? next.title : null,
      pct: next ? Math.min(1, (xp - ranks[i].xp) / (next.xp - ranks[i].xp)) : 1
    };
  }

  // ---------- Stars and finishing ----------
  // 1 star: solved. +1: at most one miss. +1: no hints. Opening the full solution caps the level at 1 star.
  function scoreStars(perf) {
    if (perf.revealed) return 1;
    return 1 + (perf.misses <= 1 ? 1 : 0) + (perf.hints === 0 ? 1 : 0);
  }

  function finishLevel(id, perf) {
    const s = S(), f = findLevel(id), R = C().rewards;
    const stars = scoreStars(perf);
    const prev = s.levels[id];
    const prevStars = prev ? prev.stars : 0;
    let xp = 0;
    if (!prev) xp = (f.level.boss ? R.boss : R.level) + stars * R.perStar;
    else if (stars > prevStars) xp = (stars - prevStars) * R.perStar;
    const before = rank();
    s.xp += xp;
    s.levels[id] = { stars: Math.max(stars, prevStars), plays: (prev ? prev.plays : 0) + 1, done: prev ? prev.done : new Date().toISOString() };
    s.stats.cleanStreak = perf.hints === 0 ? s.stats.cleanStreak + 1 : 0;
    const after = rank();
    const badges = checkBadges({ perf: perf });
    keep(); emit('progress');
    return {
      stars: stars, prevStars: prevStars, first: !prev, xp: xp, perf: perf,
      rankUp: after.index > before.index ? after.title : null,
      badges: badges, closesWorld: !!f.level.boss && !prev
    };
  }

  // ---------- Skills and spaced repetition ----------
  // Each skill sits in a box from 1 to 5. A higher box means a longer wait before it comes back.
  const INTERVALS = [0, 1, 2, 4, 7, 14];

  function skillState(id) {
    return S().skills[id] || { pips: 0, box: 1, due: today(), slips: 0, seen: false };
  }
  const isMastered = id => skillState(id).pips >= 3;
  const masteredCount = () => Object.keys(S().skills).filter(isMastered).length;

  // outcome: 'clean' (no misses, no hints), 'shaky' (got there with help), 'struggled' (saw the solution or missed twice or more)
  function recordStep(skills, outcome) {
    const s = S();
    const lit = [];
    for (const id of skills || []) {
      const st = s.skills[id] || { pips: 0, box: 1, due: today(), slips: 0, seen: true };
      const wasMastered = st.pips >= 3;
      st.seen = true;
      if (outcome === 'clean') {
        st.pips = Math.min(3, st.pips + 1);
        st.box = Math.min(5, st.box + 1);
        st.due = addDays(INTERVALS[st.box]);
      } else if (outcome === 'shaky') {
        if (st.pips < 2) st.pips += 1;        // the last pip needs a clean pass
        st.slips += 1;
        st.due = addDays(1);
      } else {
        st.box = Math.max(1, st.box - 1);
        st.slips += 2;
        st.due = today();
      }
      s.skills[id] = st;
      if (!wasMastered && st.pips >= 3) lit.push(id);
    }
    keep();
    return lit;   // skills that just became mastered
  }

  // ---------- Badges ----------
  function ruleMet(rule, ctx) {
    const s = S();
    switch (rule.type) {
      case 'level': return !!s.levels[rule.id];
      case 'worldStars': {
        const w = C().worlds.find(x => x.id === rule.world);
        return !!w && isBuilt(w) && w.levels.every(l => starsOf(l.id) === 3);
      }
      case 'cleanStreak': return s.stats.cleanStreak >= rule.count;
      case 'comeback': return !!(ctx && ctx.perf && ctx.perf.misses >= rule.misses);
      case 'drillStreak': return s.drill.streak >= rule.days;
      case 'sandboxRuns': return s.stats.sandboxRuns >= rule.count;
      case 'skillsMastered': return masteredCount() >= rule.count;
      default: return false;
    }
  }
  function checkBadges(ctx) {
    const s = S(), earned = [];
    for (const b of C().badges) {
      if (s.badges[b.id]) continue;
      if (ruleMet(b.rule, ctx)) { s.badges[b.id] = new Date().toISOString(); earned.push(b); }
    }
    if (earned.length) keep();
    return earned;
  }

  // ---------- Daily Drill ----------
  function drillPool() {
    const s = S();
    return C().drills.filter(d => d.skills.every(id => s.skills[id] && s.skills[id].seen));
  }
  // Opens once three skills have been met (the end of Level 2), so there is something to mix.
  const drillUnlocked = () => Object.keys(S().skills).filter(id => S().skills[id].seen).length >= 3 && drillPool().length >= 3;

  function skillPriority() {
    const s = S(), t = today();
    return Object.keys(s.skills).filter(id => s.skills[id].seen)
      .map(id => ({ id: id, st: s.skills[id] }))
      .sort((a, b) => ((a.st.due <= t ? 0 : 1) - (b.st.due <= t ? 0 : 1)) || (a.st.box - b.st.box) || (b.st.slips - a.st.slips));
  }

  function buildSet(size, onlySkill) {
    const s = S();
    let pool = drillPool();
    if (onlySkill) pool = pool.filter(d => d.skills.indexOf(onlySkill) !== -1);
    const order = onlySkill ? [{ id: onlySkill }] : skillPriority();
    const recent = new Set(s.drill.recent);
    const used = new Set(), chosen = [];
    for (let round = 0; round < 6 && chosen.length < size && used.size < pool.length; round++) {
      for (const sk of order) {
        if (chosen.length >= size) break;
        const cands = pool.filter(d => !used.has(d.id) && d.skills.indexOf(sk.id) !== -1);
        if (!cands.length) continue;
        const freshOnes = cands.filter(d => !recent.has(d.id));
        const from = freshOnes.length ? freshOnes : cands;
        const pick = from[Math.floor(Math.random() * from.length)];
        used.add(pick.id); chosen.push(pick.id);
      }
    }
    return chosen;
  }

  // Today's set. Built once per day and stored, so a reload continues the same drill.
  function drillToday() {
    const s = S(), t = today();
    if (s.drill.setDate !== t || !s.drill.set) {
      s.drill.set = buildSet(5); s.drill.setDate = t; s.drill.done = 0;
      keep();
    }
    const byId = id => C().drills.find(d => d.id === id);
    const items = s.drill.set.map(byId).filter(Boolean);
    const focusIds = [];
    for (const sk of skillPriority()) if (items.some(d => d.skills.indexOf(sk.id) !== -1) && focusIds.length < 3) focusIds.push(sk.id);
    return {
      items: items, done: Math.min(s.drill.done, items.length), finished: s.drill.last === t,
      focus: focusIds.map(id => (C().skills.find(k => k.id === id) || {}).name).filter(Boolean),
      streak: currentStreak()
    };
  }
  function currentStreak() {
    const s = S();
    if (!s.drill.last) return 0;
    return (s.drill.last === today() || s.drill.last === addDays(-1)) ? s.drill.streak : 0;
  }
  const practiceSet = skillId => buildSet(3, skillId).map(id => C().drills.find(d => d.id === id));
  const extraSet = () => buildSet(5).map(id => C().drills.find(d => d.id === id));

  // Called after each drill question. `daily` is true for today's set, false for extra practice.
  function drillItemDone(drill, outcome, daily) {
    const s = S(), R = C().rewards, t = today();
    const before = rank();
    const lit = recordStep(drill.skills, outcome);
    let xp = daily ? R.drillItem : R.practiceItem;
    let finishedSet = false;
    s.drill.recent = [drill.id].concat(s.drill.recent.filter(id => id !== drill.id)).slice(0, 10);
    if (daily) {
      s.drill.done += 1;
      if (s.drill.done >= (s.drill.set || []).length && s.drill.last !== t) {
        s.drill.streak = s.drill.last === addDays(-1) ? s.drill.streak + 1 : 1;
        s.drill.best = Math.max(s.drill.best, s.drill.streak);
        s.drill.last = t;
        xp += R.drillSetBonus;
        finishedSet = true;
      }
    }
    s.xp += xp;
    const after = rank();
    const badges = checkBadges({});
    keep(); emit('progress');
    return { xp: xp, finishedSet: finishedSet, streak: s.drill.streak, lit: lit, badges: badges, rankUp: after.index > before.index ? after.title : null };
  }

  // ---------- Small counters ----------
  function noteRun() { S().stats.runs += 1; keep(); }
  function noteSandboxRun() { S().stats.sandboxRuns += 1; keep(); return checkBadges({}); }
  function setFlag(group, key, value) { const f = S().flags; if (key === null) f[group] = value; else { f[group] = f[group] || {}; f[group][key] = value; } keep(); }
  function draft(key, value) { const d = S().drafts; if (value === undefined) return d[key]; if (value === null || value === '') delete d[key]; else d[key] = value; keep(); }
  function setting(key, value) { const st = S().settings; if (value === undefined) return st[key]; st[key] = value; keep(); emit('settings'); }

  QS.state.game = {
    on, emit, today,
    isBuilt, allLevels, findLevel, isDone, starsOf, isUnlocked, nextLevel, currentLevel, worldProgress, worldUnlocked,
    rank, scoreStars, finishLevel,
    skillState, isMastered, masteredCount, recordStep,
    checkBadges,
    drillPool, drillUnlocked, drillToday, practiceSet, extraSet, drillItemDone, currentStreak,
    noteRun, noteSandboxRun, setFlag, draft, setting
  };
})();
