// Build: inline CSS, seed JSON and JS into docs/index.html (GitHub Pages site).
// The embedded seed is the catalog baseline; private family data (history, notes, requests) is stripped.
const fs = require('fs'); const path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const css = src('styles.css');
const js = ['app.part1.js', 'app.part2.js', 'app.part3.js'].map(src).join('\n');
const seed = JSON.parse(src('seed.json'));
seed.history = []; seed.todos = []; seed.items.forEach(it => { it.notes = []; it.requests = []; });
if (!seed.catalogVersion) seed.catalogVersion = Number(new Date().toISOString().slice(0, 10).replace(/-/g, '') + '01');
if (process.env.SHARE_URL) seed.meta.shareUrl = process.env.SHARE_URL;
const seedStr = JSON.stringify(seed).replace(/<\//g, '<\\/');
let html = src('index.html');
html = html.replace('/*__CSS__*/', () => css).replace('/*__SEED__*/', () => seedStr).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs', 'index.html'), html);
fs.writeFileSync(path.join(__dirname, 'docs', '.nojekyll'), '');
console.log('built docs/index.html', (html.length / 1024).toFixed(1) + ' KB', '| seed rev', seed.rev, '| catalogVersion', seed.catalogVersion, '| shareUrl', seed.meta.shareUrl || '(none)');
