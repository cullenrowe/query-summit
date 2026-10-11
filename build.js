// Stitches src/ into single-file builds. Run: node build.js
//   dist/query-summit.html           one self-contained page (open it in any browser, or host it anywhere)
//   dist/query-summit.artifact.html  the same page without <html>/<head>/<body>, for Claude artifacts
//   dist/duckdb/                     optional self-hosted copy of the SQL engine (fallback when the CDN is blocked)
// Phase 2 does not need this script: index.html can load the files in ORDER with plain <script> tags.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'src'), DIST = path.join(__dirname, 'dist');
const ORDER = [
  'core.js',
  'content/datasets.js', 'content/world1.js', 'content/worlds-ahead.js', 'content/meta.js', 'content/drills.js',
  'engine/sqltext.js', 'engine/errors.js', 'engine/compare.js', 'engine/db.js',
  'state/save.js', 'state/game.js',
  'ui/dom.js', 'ui/widgets.js', 'ui/step.js', 'ui/screens-play.js', 'ui/screens-more.js', 'ui/app.js'
];
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const TITLE = 'Query Summit';
// One request per family, so a problem with one family cannot stop the others from loading.
const FONTS = ['Barlow:wght@400;500;600;700', 'Big+Shoulders+Display:wght@700;800', 'Barlow+Condensed:wght@700;800', 'JetBrains+Mono:wght@400;600']
  .map(f => '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + f + '&display=swap">').join('\n');
const MAP = `<!--
  QUERY SUMMIT. A game that teaches SQL with a Snowflake flavor. One file, no build step needed to run it.
  Sections in this file (each maps to a file in the GitHub version):
    styles      CSS variables for every color and size, light and dark themes
    core        the QS namespace
    content/    datasets, worlds, levels, hints, story, drills, skills, ranks, badges (plain data, one schema)
    engine/     DuckDB setup, query runner, result comparison, error translation, SQL text tools
    state/      save and load, XP, stars, skill tree, spaced repetition
    ui/         screens and components (map, level, results, skill tree, settings)
  To add a world: add one content file shaped like content/world1.js. No engine or UI change.
-->`;
const css = read('styles.css');
let js = '';
for (const f of ORDER) js += '\n/* ' + '='.repeat(70) + '\n * FILE: ' + f + '\n * ' + '='.repeat(70) + ' */\n' + read(f);
if (/<\/script/i.test(js)) throw new Error('A source file contains </script, which would end the inline script early.');
const body = `<div id="qs-app" class="qs"><noscript>Query Summit needs JavaScript turned on.</noscript></div>\n<script>${js}\n</script>\n`;
const head = `<title>${TITLE}</title>\n${MAP}\n${FONTS}\n<style>\n${css}</style>\n`;
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'query-summit.artifact.html'), head + body);
fs.writeFileSync(path.join(DIST, 'query-summit.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
  `<meta name="description" content="Learn SQL by playing. Real queries, a Snowflake flavor, and a mountain to climb.">\n` +
  head +
  `<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}</style>\n</head>\n<body>\n${body}</body>\n</html>\n`);

// index.html: the no-build version. It loads the same files with plain tags, straight from src/.
// This is the page to publish on GitHub Pages in Phase 2.
fs.writeFileSync(path.join(__dirname, 'index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
  `<meta name="description" content="Learn SQL by playing. Real queries, a Snowflake flavor, and a mountain to climb.">\n<title>${TITLE}</title>\n${FONTS}\n` +
  `<link rel="stylesheet" href="src/styles.css">\n<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}</style>\n</head>\n<body>\n` +
  `<div id="qs-app" class="qs"><noscript>Query Summit needs JavaScript turned on.</noscript></div>\n` +
  ORDER.map(f => `<script src="src/${f}"></script>`).join('\n') + `\n</body>\n</html>\n`);

// Self-hosted engine copy (only rebuilt when missing, since the files are large).
const ENGINE = path.join(__dirname, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
const OUT = path.join(DIST, 'duckdb');
if (fs.existsSync(ENGINE) && !fs.existsSync(path.join(OUT, 'duckdb-eh.part0.wasm'))) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(path.join(ENGINE, 'duckdb-browser-eh.worker.js'), path.join(OUT, 'duckdb-eh.worker.js'));
  const wasm = fs.readFileSync(path.join(ENGINE, 'duckdb-eh.wasm'));
  const PART = 14 * 1000 * 1000;
  for (let i = 0, n = 0; i < wasm.length; i += PART, n++) fs.writeFileSync(path.join(OUT, 'duckdb-eh.part' + n + '.wasm'), wasm.subarray(i, i + PART));
  require('child_process').execSync('npx esbuild node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser.mjs --bundle --format=esm --minify --outfile=dist/duckdb/duckdb-lib.mjs --log-level=warning', { cwd: __dirname, stdio: 'inherit' });
}
const kb = f => Math.round(fs.statSync(path.join(DIST, f)).size / 1024) + ' KB';
console.log('built query-summit.html', kb('query-summit.html'), '| artifact', kb('query-summit.artifact.html'));
