/* ===== core.js =====
 * One global namespace. Every other file hangs its exports off QS, so the files can be
 * loaded with plain <script> tags in this order and no build step:
 *   core -> content/* -> engine/* -> state/* -> ui/* -> ui/app (starts the game)
 */
(function () {
  'use strict';
  window.QS = { VERSION: '1.0.0', content: {}, engine: {}, state: {}, ui: {} };
})();
