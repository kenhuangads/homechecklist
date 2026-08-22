// Extract the live seed (hc-seed JSON) from a saved artifact HTML (e.g. WebFetch output) and make it src/seed.json
// Usage: node tools/pull-live-seed.js <path-to-live-html>   (also accepts a path to a plain JSON state file)
const fs = require('fs');
const path = require('path');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/pull-live-seed.js <live.html|state.json>'); process.exit(1); }
const raw = fs.readFileSync(src, 'utf8');
let live;
if (raw.trimStart().startsWith('{')) live = JSON.parse(raw);
else {
  const m = raw.match(/<script id="hc-seed" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) { console.error('no hc-seed block found'); process.exit(2); }
  live = JSON.parse(m[1]);
}
const localPath = path.join(__dirname, '..', 'src', 'seed.json');
const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
console.log(`live rev ${live.rev} (${live.updatedAt}, history ${live.history.length}) vs local rev ${local.rev} (${local.updatedAt})`);
if ((live.rev || 0) < (local.rev || 0)) { console.error('live is OLDER than local seed — refusing to overwrite; pass --force to override'); if (!process.argv.includes('--force')) process.exit(3); }
fs.writeFileSync(localPath, JSON.stringify(live, null, 2));
console.log('src/seed.json updated from live');
