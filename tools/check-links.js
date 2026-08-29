// Quick automated link check for every direct link in src/seed.json (PChome via API, others via HTTP status + model match)
const fs = require('fs'); const path = require('path');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const only = process.argv[2]; // optional itemId filter
(async () => {
  const rows = [];
  for (const it of seed.items) { if (only && it.id !== only) continue; for (const o of it.options) for (const l of (o.links || [])) { if (l.type.startsWith('search')) continue; rows.push({ it: it.id, opt: o.id, model: o.model, type: l.type, url: l.url, modelCheck: l.modelCheck !== false }); } }
  const pchomeIds = rows.filter(r => r.type === 'pchome').map(r => (r.url.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i) || [])[1]).filter(Boolean);
  const api = {};
  for (let i = 0; i < pchomeIds.length; i += 10) { const b = pchomeIds.slice(i, i + 10); try { const r = await fetch(`https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${b.join(',')}&fields=Id,Price,Qty,ButtonType`, { headers: { 'User-Agent': UA } }); const arr = await r.json(); arr.forEach(p => { api[String(p.Id).replace(/-\d{3}$/, '')] = p; }); } catch (e) {} }
  const out = [];
  for (const r of rows) {
    let status = 'ok', note = '';
    if (r.type === 'pchome') { const id = (r.url.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i) || [])[1]; const p = api[id]; if (!p) { status = 'dead'; note = 'API 無資料'; } else { note = `${p.ButtonType} qty ${p.Qty} low ${p.Price && p.Price.Low}`; if (p.ButtonType === 'NotReady' || p.Qty === 0) status = 'oos'; } }
    else {
      try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000); const res = await fetch(r.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW' }, redirect: 'follow', signal: ctrl.signal }); clearTimeout(t); const html = await res.text(); note = 'http ' + res.status;
        // 403 只代表 curl 被擋，不代表頁面還在——林內那條就是 403 蓋住 404，必須用瀏覽器人工開一次
        if (res.status === 403 || res.status === 429) { status = 'blocked'; note += '（反爬蟲擋住，請用瀏覽器人工開一次確認不是 404）'; }
        else if (res.status >= 400) status = 'dead';
        else if (/查無商品資料|商品目前無展售|找不到頁面|page not found/i.test(html)) status = 'dead';
        else {
          // 型號比對只有在「商品頁」上才有意義，而且只有電商頁值得當成錯誤：
          // 品牌官網的據點頁／保固條款／新聞稿、PDF、App Store 本來就不會出現型號，
          // 全部判成 mismatch? 只會製造噪音，把真正壞掉的連結蓋掉。
          const ct = res.headers.get('content-type') || '';
          const norm = t => String(t).replace(/[-\s\/／＋+、·．.]/g, '').toLowerCase();
          // 型號可能是 "RAD-110NJP1/RAC-110NP" 或 "Lina 1200"，任何一段對上就算數
          const raw = String(r.model || '');
          const parts = [...raw.split(/[（(／\/＋+、,\s]/), raw].map(norm).filter(x => x.length >= 4 && /[a-z0-9]{4}/.test(x));
          const page = norm(html);
          const shop = (r.type === 'momo' || r.type === 'pchome') && r.modelCheck;
          if (!/text\/html/i.test(ct)) note += ' (非 HTML，略過型號比對)';
          else if (!parts.length) note += ' (型號無可比對字串)';
          else if (parts.some(k => page.includes(k))) { /* 對上了 */ }
          else if (!r.modelCheck) note += ' (已人工確認過商品正確，略過型號比對)';
          else if (shop) { status = 'mismatch?'; note += ' 電商頁找不到型號，請人工確認'; }
          else note += ' (官網／其他頁未出現型號，正常)';
        }
      } catch (e) { status = 'error'; note = String(e.message || e).slice(0, 60); }
    }
    out.push(Object.assign(r, { status, note }));
    if (status !== 'ok') console.log(`${status.padEnd(9)} ${r.it}/${r.opt} ${r.type} ${r.url} — ${note}`);
  }
  const counts = out.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
  console.log('summary', JSON.stringify(counts), 'total', out.length);
  fs.writeFileSync(path.join(__dirname, '..', 'research', 'linkcheck-latest.json'), JSON.stringify(out, null, 2));
})();
