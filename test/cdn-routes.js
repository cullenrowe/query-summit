// Maps the jsDelivr URLs the game uses onto local copies, so tests run the real engine offline.
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
module.exports = async function routeCdn(page, opts = {}) {
  await page.route('https://cdn.jsdelivr.net/**', async route => {
    const url = route.request().url();
    if (opts.blockAll) return route.abort();
    if (/\/\+esm(\?.*)?$/.test(url)) return route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(__dirname, 'cdn', 'duckdb-esm.js')) });
    const m = url.match(/duckdb-wasm@[^/]+\/dist\/(.+)$/);
    if (m && fs.existsSync(path.join(DIST, m[1]))) {
      if (opts.blockWasm && m[1].endsWith('.wasm')) return route.abort();
      const type = m[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
      return route.fulfill({ contentType: type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(DIST, m[1])) });
    }
    return route.abort();
  });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
};
