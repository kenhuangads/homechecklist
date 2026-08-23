// Quick automated link check for every direct link in src/seed.json (PChome via API, others via HTTP status + model match)
const fs = require('fs'); const path = require('path');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const only = process.argv[2]; // optional itemId filter
(async () => {
  const rows = [];
  for (const it of seed.items) { if (only && it.id !== only) continue; for (const o of it.options) for (const l of (o.links || [])) { if (l.type.startsWith('search')) continue; rows.push({ it: it.id, opt: o.id, model: o.model, type: l.type, url: l.url }); } }
  const pchomeIds = rows.filter(r => r.type === 'pchome').map(r => (r.url.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i) || [])[1]).filter(Boolean);
  const api = {};
  for (let i = 0; i < pchomeIds.length; i += 10) { const b = pchomeIds.slice(i, i + 10); try { const r = await fetch(`https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${b.join(',')}&fields=Id,Price,Qty,ButtonType`, { headers: { 'User-Agent': UA } }); const arr = await r.json(); arr.forEach(p => { api[String(p.Id).replace(/-\d{3}$/, '')] = p; }); } catch (e) {} }
  const out = [];
  for (const r of rows) {
    let status = 'ok', note = '';
    if (r.type === 'pchome') { const id = (r.url.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i) || [])[1]; const p = api[id]; if (!p) { status = 'dead'; note = 'API 無資料'; } else { note = `${p.ButtonType} qty ${p.Qty} low ${p.Price && p.Price.Low}`; if (p.ButtonType === 'NotReady' || p.Qty === 0) status = 'oos'; } }
    else {
      try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000); const res = await fetch(r.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW' }, redirect: 'follow', signal: ctrl.signal }); clearTimeout(t); const html = await res.text(); note = 'http ' + res.status;
        if (res.status === 403 || res.status === 429) status = 'blocked';
        else if (res.status >= 400) status = 'dead';
        else if (/查無商品資料|商品目前無展售|找不到頁面|page not found/i.test(html)) status = 'dead';
        else { const key = (r.model || '').split(/[（(／＋ ]/)[0].replace(/[-\s]/g, '').toLowerCase(); if (key.length >= 4 && !html.replace(/[-\s]/g, '').toLowerCase().includes(key)) { status = 'mismatch?'; note += ' model not found in page'; } }
      } catch (e) { status = 'error'; note = String(e.message || e).slice(0, 60); }
    }
    out.push(Object.assign(r, { status, note }));
    if (status !== 'ok') console.log(`${status.padEnd(9)} ${r.it}/${r.opt} ${r.type} ${r.url} — ${note}`);
  }
  const counts = out.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
  console.log('summary', JSON.stringify(counts), 'total', out.length);
  fs.writeFileSync(path.join(__dirname, '..', 'research', 'linkcheck-latest.json'), JSON.stringify(out, null, 2));
})();
