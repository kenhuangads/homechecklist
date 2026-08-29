/* 本機預覽用的靜態伺服器。用 Node 而不是 python3／py，因為這個專案在 Mac 與 Windows 都要開得起來，
   而 Node 本來就是必要相依（build.js 要用）。用法：node tools/serve.js [port] [dir] */
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const port = Number(process.argv[2]) || 8791;
const root = path.resolve(__dirname, '..', process.argv[3] || 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, path.normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + p); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} → http://127.0.0.1:${port}`));
