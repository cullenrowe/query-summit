/* ===== ui/app.js =====
 * The shell around every screen (top bar, navigation) and the tiny router. Starts the game.
 */
(function () {
  'use strict';
  const U = QS.ui;
  const h = U.h;

  const NAV = [['home', 'Map', 'map'], ['drill', 'Drill', 'drill'], ['sandbox', 'Sandbox', 'sandbox'], ['skills', 'Skills', 'skills'], ['settings', 'Settings', 'settings']];
  const NEEDS_ENGINE = { level: true, drill: true, sandbox: true };
  let cleanup = null;
  let current = { name: null, params: null };
  let hostTheme = null;
  let resume = null;
  let navEl = null, rankEl = null;

  function applySettings() {
    const root = document.documentElement, st = QS.state.save.data.settings;
    root.classList.remove('ts-s', 'ts-m', 'ts-l');
    root.classList.add('ts-' + (st.textSize || 'm'));
    if (st.theme === 'light' || st.theme === 'dark') root.setAttribute('data-theme', st.theme);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
  }

  function drawChrome() {
    if (!navEl) return;
    const r = QS.state.game.rank();
    U.clear(rankEl);
    rankEl.appendChild(h('span.chip-rank', r.title));
    rankEl.appendChild(h('span.chip-xp', U.icon('bolt', 14), Number(QS.state.save.data.xp).toLocaleString('en-US') + ' XP'));
    for (const b of navEl.querySelectorAll('.tab')) {
      const on = b.getAttribute('data-screen') === current.name;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
  }

  function go(name, params) {
    if (NEEDS_ENGINE[name] && QS.engine.db.status !== 'ready') { resume = { screen: name, params: params || null }; name = 'boot'; params = null; }
    if (!U.screens[name]) name = 'home';
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    U.clear(document.getElementById('qs-layer'));
    document.documentElement.classList.remove('has-sheet');
    const fx = document.getElementById('qs-fx');
    if (fx) fx.hidden = true;      // a celebration burst should not spill onto the next screen
    const main = U.clear(document.getElementById('qs-main'));
    current = { name: name, params: params || null };
    document.getElementById('qs-app').className = 'qs screen-' + name;
    drawChrome();
    window.scrollTo(0, 0);
    const done = U.screens[name](main, params || {});
    if (current.name === name) cleanup = done || null;
  }

  function start(hotData) {
    QS.state.save.load();
    QS.content.worlds.sort((a, b) => a.n - b.n);
    hostTheme = document.documentElement.getAttribute('data-theme');
    applySettings();
    if (hotData && hotData.screen && hotData.screen !== 'boot') resume = { screen: hotData.screen, params: hotData.params || null };

    rankEl = h('button.bar-rank', { type: 'button', 'aria-label': 'Your rank and XP. Opens Skills.', onclick: () => go('skills') });
    navEl = h('nav.tabs', { 'aria-label': 'Main' }, NAV.map(n => h('button.tab', { type: 'button', 'data-screen': n[0], onclick: () => go(n[0]) }, U.icon(n[2], 22), h('span', n[1]))));
    const app = document.getElementById('qs-app');
    U.clear(app);
    app.appendChild(h('header.bar', h('div.bar-in', h('button.brand', { type: 'button', 'aria-label': 'Query Summit. Go to the map.', onclick: () => go('home') }, h('span.brand-mark', { 'aria-hidden': 'true' }), 'Query Summit'), navEl, rankEl)));
    app.appendChild(h('main#qs-main'));
    app.appendChild(h('div#qs-layer'));
    app.appendChild(h('div#qs-toasts', { 'aria-live': 'polite' }));
    app.appendChild(h('canvas#qs-fx', { hidden: true, 'aria-hidden': 'true' }));

    QS.state.game.on(what => { if (what === 'settings') applySettings(); drawChrome(); });
    go('boot');
  }

  U.app = {
    go: go, applySettings: applySettings,
    get current() { return current; },
    // The loading screen calls this once the engine is ready, to return to where the player was.
    takeResume() { const r = resume; resume = null; return r; }
  };

  // Keep the player's place if the page is republished while it is open (Claude artifacts only).
  const hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ screen: current.name, params: current.params })); } catch (e) { /* optional */ }
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
