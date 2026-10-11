// Tiny static server for tests. Serves ./dist (and ./test/pages) on localhost.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTS = [path.join(__dirname, '..', 'dist'), path.join(__dirname, 'pages'), path.join(__dirname, '..')];
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.wasm':'application/wasm', '.json':'application/json', '.css':'text/css' };
module.exports = function serve(port, extraHeaders) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    for (const root of ROOTS) {
      const f = path.join(root, u === '/' ? 'index.html' : u);
      if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }, extraHeaders || {}));
        fs.createReadStream(f).pipe(res); return;
      }
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise(r => srv.listen(port, () => r(srv)));
};
