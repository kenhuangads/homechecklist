// Daily price refresh: query PChome's public product API for every PChome link in the catalog → docs/prices.json
const fs = require('fs'); const path = require('path');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.json'), 'utf8'));
const ids = new Set();
seed.items.forEach(it => it.options.forEach(o => (o.links || []).forEach(l => { if (l.type !== 'pchome') return; const m = l.url.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i); if (m) ids.add(m[1].toUpperCase()); })));
const list = [...ids];
const outPath = path.join(__dirname, '..', 'docs', 'prices.json');
let prev = {}; try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch {}
(async () => {
  const result = { checkedAt: new Date().toISOString(), source: 'PChome 24h prodapi (每日自動更新)', pchome: {} };
  for (let i = 0; i < list.length; i += 10) {
    const batch = list.slice(i, i + 10);
    const url = `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${batch.join(',')}&fields=Id,Price,Qty,ButtonType`;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (homechecklist price refresh)' } });
      if (!r.ok) throw new Error('http ' + r.status);
      const arr = await r.json();
      for (const p of arr) {
        const id = String(p.Id || '').replace(/-000$/, '').toUpperCase();
        const low = p.Price && (p.Price.Low || p.Price.P || p.Price.M);
        result.pchome[id] = { low: typeof low === 'number' ? low : null, list: p.Price ? (p.Price.P || p.Price.M || null) : null, qty: typeof p.Qty === 'number' ? p.Qty : null, button: p.ButtonType || '' };
      }
    } catch (e) { console.warn('batch failed', batch.join(','), e.message); batch.forEach(id => { if (prev.pchome && prev.pchome[id]) result.pchome[id] = prev.pchome[id]; }); }
    await new Promise(res => setTimeout(res, 400));
  }
  const got = Object.keys(result.pchome).length;
  if (!got) { console.error('no prices fetched; keeping previous file'); process.exit(0); }
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`prices.json updated: ${got}/${list.length} products`);
})();
