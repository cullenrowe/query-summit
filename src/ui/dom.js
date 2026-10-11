/* ===== ui/dom.js =====
 * Small building blocks used by every screen: element helper, icons, Juno the owl,
 * toasts, sheets (dialogs), sound, and the snow burst effect.
 */
(function () {
  'use strict';
  const U = QS.ui;

  U.reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // h('button.btn.btn-primary', { onclick: fn, 'aria-label': 'Run' }, 'Run')
  U.h = function (spec, attrs) {
    const parts = spec.split('.');
    const tagId = parts[0].split('#');
    const el = document.createElement(tagId[0] || 'div');
    if (tagId[1]) el.id = tagId[1];
    if (parts.length > 1) el.className = parts.slice(1).join(' ');
    let kids = Array.prototype.slice.call(arguments, 1);
    if (attrs && typeof attrs === 'object' && !attrs.nodeType && !Array.isArray(attrs)) {
      kids = kids.slice(1);
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'value' || k === 'disabled' || k === 'checked' || k === 'hidden') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, kids);
    return el;
  };
  function append(el, kids) {
    for (const k of kids) {
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    }
  }
  U.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  U.esc = esc;
  // Prose with `inline code`. Returns safe HTML.
  U.rich = text => esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
  U.richEl = (spec, text) => U.h(spec, { html: U.rich(text) });
  // A read-only, highlighted SQL block.
  U.codeBlock = (sql, cls) => U.h('pre.sql' + (cls ? '.' + cls : ''), { html: QS.engine.sql.highlight(sql) });

  // ---------- Icons (24px, drawn with the current text color) ----------
  const ICONS = {
    map: '<path d="M3 19l6-11 4 7 2-3 6 7z"/><path d="M9 8l1.6 2.9"/>',
    drill: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    sandbox: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 10l3 2.5L7 15"/><path d="M12.5 15H17"/>',
    skills: '<path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z"/><path d="M12 8v8M8.5 10l7 4M15.5 10l-7 4"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.1 6.6 20l1.1-6.1-4.5-4.3 6.1-.8z" fill="currentColor"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0012 3z"/>',
    table: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M9.5 5v14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 15.5v-9a2 2 0 012-2h9"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 102.3-5.4"/><path d="M4.5 4.5v4h4"/>',
    format: '<path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h7"/>',
    erase: '<path d="M9 6h10a2 2 0 012 2v8a2 2 0 01-2 2H9l-6-6z"/><path d="M12 10l4 4M16 10l-4 4"/>',
    flag: '<path d="M6 21V4"/><path d="M6 5h11l-2.5 3.5L17 12H6" fill="currentColor"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" fill="currentColor"/>',
    corner: '<path d="M6 3.5h12a1 1 0 011 1v16l-7-4-7 4v-16a1 1 0 011-1z"/>',
    flame: '<path d="M12 21a6 6 0 006-6c0-3-2-5-3-7-.5 2-1.5 3-3 3 .5-3-1-6-3-8 0 4-3 6-3 12a6 6 0 006 6z"/>',
    sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'
  };
  U.icon = function (name, size) {
    const s = size || 20;
    const span = document.createElement('span');
    span.className = 'ico';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    return span;
  };

  // Trail ratings, the way ski maps mark runs: green circle, blue square, black diamond.
  const TRAILS = { green: ['Easy', '<circle cx="8" cy="8" r="6"/>'], blue: ['Steady', '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/>'], black: ['Steep', '<path d="M8 1l7 7-7 7-7-7z"/>'] };
  U.trailMark = function (trail, withLabel) {
    const t = TRAILS[trail] || TRAILS.green;
    const el = U.h('span.trailmark.trail-' + trail, { title: t[0] + ' trail' });
    el.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' + t[1] + '</svg>' + (withLabel ? '<span>' + t[0] + '</span>' : '<span class="vh">' + t[0] + ' trail</span>');
    return el;
  };

  // ---------- Juno, the snowy owl ----------
  // mood: 'calm' | 'happy' | 'think'
  U.owl = function (mood, size) {
    const s = size || 56;
    const eyes = mood === 'happy'
      ? '<path d="M19.5 25.5q4.5-5 9 0M35.5 25.5q4.5-5 9 0" fill="none" stroke="#1B2B3C" stroke-width="2.4" stroke-linecap="round"/>'
      : '<circle cx="24" cy="25" r="6.2" fill="#F6C544"/><circle cx="40" cy="25" r="6.2" fill="#F6C544"/><circle cx="' + (mood === 'think' ? 25.5 : 24) + '" cy="' + (mood === 'think' ? 23.5 : 25) + '" r="2.9" fill="#1B2B3C"/><circle cx="' + (mood === 'think' ? 41.5 : 40) + '" cy="' + (mood === 'think' ? 23.5 : 25) + '" r="2.9" fill="#1B2B3C"/>';
    const wrap = U.h('span.owl.owl-' + (mood || 'calm'), { 'aria-hidden': 'true' });
    wrap.style.width = wrap.style.height = s + 'px';
    wrap.innerHTML = '<svg viewBox="0 0 64 64" width="' + s + '" height="' + s + '">' +
      '<circle cx="32" cy="32" r="32" class="owl-bg"/>' +
      '<path d="M14 26l-3-12 10 6M50 26l3-12-10 6" fill="#FFFFFF"/>' +
      '<ellipse cx="32" cy="40" rx="18" ry="19" fill="#FFFFFF"/>' +
      '<circle cx="32" cy="26" r="17" fill="#FFFFFF"/>' +
      '<path d="M24 46l2 2M31 49l2 2M38 46l2 2M27.5 52l2 2M35 53l2 2M22 40l1.5 1.5M41 40l1.5 1.5" stroke="#5B7088" stroke-width="1.7" stroke-linecap="round"/>' +
      '<circle cx="24" cy="25" r="8.4" fill="#E3ECF4"/><circle cx="40" cy="25" r="8.4" fill="#E3ECF4"/>' + eyes +
      '<path d="M29.5 30h5l-2.5 5z" fill="#3A4A5C"/>' +
      '<path d="M16.5 37.5q15.5 8 31 0l1 4.5q-16.5 8-33 0z" class="owl-scarf"/>' +
      '</svg>';
    return wrap;
  };

  // A line from Juno: avatar plus speech bubble.
  U.says = function (text, mood) {
    return U.h('div.says', U.owl(mood || 'calm', 44), U.h('div.bubble', U.h('span.who', QS.content.mentor.name), U.richEl('p', text)));
  };

  // ---------- Toasts ----------
  U.toast = function (text, kind) {
    const host = document.getElementById('qs-toasts');
    if (!host) return;
    const t = U.h('div.toast' + (kind ? '.toast-' + kind : ''), { role: 'status' }, text);
    host.appendChild(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 320); }, 2800);
  };

  // ---------- Sheets (dialogs) ----------
  // U.sheet({ title, body: element, actions: [buttons], onClose, kind: 'sheet' | 'center', dismiss: true })
  U.sheet = function (opts) {
    const host = document.getElementById('qs-layer');
    const previous = document.activeElement;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      layer.remove();
      if (!host.children.length) document.documentElement.classList.remove('has-sheet');
      if (previous && previous.focus) { try { previous.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      if (opts.onClose) opts.onClose();
    };
    const onKey = e => {
      if (e.key === 'Escape' && opts.dismiss !== false) { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const f = panel.querySelectorAll('button:not([disabled]), [href], textarea, input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const panel = U.h('div.sheet' + (opts.kind === 'center' ? '.sheet-center' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog', tabindex: '-1' },
      (opts.title || opts.dismiss !== false) && U.h('div.sheet-head',
        opts.title ? U.h('h2.sheet-title', opts.title) : U.h('span'),
        opts.dismiss !== false && U.h('button.btn-icon', { type: 'button', 'aria-label': 'Close', onclick: close }, U.icon('close'))),
      U.h('div.sheet-body', opts.body),
      opts.actions && opts.actions.length ? U.h('div.sheet-actions', opts.actions) : null);
    const layer = U.h('div.layer', { onclick: e => { if (e.target === layer && opts.dismiss !== false) close(); } }, panel);
    host.appendChild(layer);
    document.documentElement.classList.add('has-sheet');
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { const auto = panel.querySelector('[data-autofocus]') || panel; try { auto.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    return { close: close, panel: panel };
  };

  // A short run of Juno lines, one at a time, then `done`.
  U.dialog = function (lines, opts) {
    opts = opts || {};
    let i = 0;
    const body = U.h('div.dialog');
    const nextBtn = U.h('button.btn.btn-primary', { type: 'button', 'data-autofocus': true, onclick: () => step() }, 'Next');
    const sheet = U.sheet({ title: opts.title || '', body: body, actions: [nextBtn], kind: 'center', dismiss: false });
    function draw() {
      U.clear(body).appendChild(U.says(lines[i], opts.mood || 'calm'));
      nextBtn.textContent = i === lines.length - 1 ? (opts.last || 'Got it') : 'Next';
    }
    function step() { if (i < lines.length - 1) { i++; draw(); } else { sheet.close(); if (opts.done) opts.done(); } }
    draw();
    return sheet;
  };

  // ---------- Sound (off by default; tiny synth, no audio files) ----------
  let audio = null;
  const TUNES = {
    tap: [[520, 0, 0.04, 0.035]],
    ok: [[660, 0, 0.1, 0.07], [880, 0.09, 0.16, 0.07]],
    bad: [[220, 0, 0.16, 0.06]],
    star: [[1175, 0, 0.12, 0.06]],
    win: [[523, 0, 0.12, 0.07], [659, 0.11, 0.12, 0.07], [784, 0.22, 0.12, 0.07], [1047, 0.33, 0.28, 0.07]]
  };
  U.sound = function (name) {
    if (!QS.state.game.setting('sound')) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      for (const n of TUNES[name] || []) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = name === 'bad' ? 'triangle' : 'sine';
        osc.frequency.value = n[0];
        gain.gain.setValueAtTime(0.0001, now + n[1]);
        gain.gain.exponentialRampToValueAtTime(n[3], now + n[1] + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n[1] + n[2]);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(now + n[1]); osc.stop(now + n[1] + n[2] + 0.03);
      }
    } catch (e) { /* sound is optional */ }
  };

  // ---------- Snow burst ----------
  U.burst = function (originEl) {
    if (U.reducedMotion()) return;
    const canvas = document.getElementById('qs-fx');
    if (!canvas || !canvas.getContext) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, hgt = window.innerHeight;
    canvas.width = w * dpr; canvas.height = hgt * dpr; canvas.hidden = false;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = originEl ? originEl.getBoundingClientRect() : { left: w / 2, top: hgt / 3, width: 0, height: 0 };
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const colors = ['#FFFFFF', '#BFE0FA', '#F6C544', '#F27C9B', '#8CC8F5'];
    const flakes = [];
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
      flakes.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5, r: 2 + Math.random() * 3.5, c: colors[i % colors.length], spin: Math.random() * 6 });
    }
    const start = performance.now();
    (function frame(now) {
      const t = (now - start) / 1300;
      ctx.clearRect(0, 0, w, hgt);
      if (t >= 1 || canvas.hidden) { canvas.hidden = true; return; }
      for (const f of flakes) {
        f.x += f.vx; f.y += f.vy; f.vy += 0.16; f.vx *= 0.985;
        ctx.globalAlpha = Math.max(0, 1 - t * t);
        ctx.strokeStyle = f.c; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const ang = f.spin + t * 3 + k * Math.PI / 3; ctx.moveTo(f.x - Math.cos(ang) * f.r, f.y - Math.sin(ang) * f.r); ctx.lineTo(f.x + Math.cos(ang) * f.r, f.y + Math.sin(ang) * f.r); }
        ctx.stroke();
      }
      requestAnimationFrame(frame);
    })(start);
  };

  // Copy text, with a fallback for places where the clipboard API is refused.
  U.copy = function (text, fallbackField) {
    const done = () => U.toast('Copied', 'ok');
    const manual = () => { if (fallbackField) { fallbackField.focus(); fallbackField.select(); U.toast('Press Ctrl+C (or Cmd+C) to copy'); } };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, manual);
      else manual();
    } catch (e) { manual(); }
  };

  U.stars = function (n, max, cls) {
    const wrap = U.h('span.stars' + (cls ? '.' + cls : ''), { role: 'img', 'aria-label': n + ' of ' + (max || 3) + ' stars' });
    for (let i = 0; i < (max || 3); i++) wrap.appendChild(U.h('span.star' + (i < n ? '.is-on' : ''), U.icon('star', 16)));
    return wrap;
  };
})();
