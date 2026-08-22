// Apply research/links-result-*.json to src/seed.json: replace dead links, mark out-of-stock, add notes.
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'src/seed.json'), 'utf8'));
const results = [];
for (const f of fs.readdirSync(path.join(root, 'research'))) if (/^links-result-\d\.json$/.test(f)) results.push(...JSON.parse(fs.readFileSync(path.join(root, 'research', f), 'utf8')));
const dec = s => (s || '').replace(/&amp;/g, '&');
const isSearch = u => /searchShop\.jsp|\/search\/\?q=/.test(u || '');
const byId = {}; seed.items.forEach(it => it.options.forEach(o => byId[o.id] = o));
let replaced = 0, oos = 0, removed = 0;
for (const r of results) {
  const o = byId[r.optionId]; if (!o) continue;
  const l = (o.links || []).find(x => dec(x.url) === dec(r.url)); if (!l) continue;
  l.checkedAt = '2026-08-22'; l.check = r.status;
  if (r.status === 'ok') { l.verified = true; l.stock = 'ok'; }
  if (r.status === 'ok_oos') { l.verified = true; l.stock = 'oos'; l.note = [l.note, '目前缺貨／補貨中'].filter(Boolean).join('；'); oos++; }
  if (r.status === 'blocked') { l.verified = true; l.note = [l.note, '官網對自動程式封鎖，人工開啟正常'].filter(Boolean).join('；'); }
  if (r.status === 'dead' || (r.status === 'mismatch' && r.replacementUrl && !/SodaStream|ART/i.test(r.note))) {
    if (r.replacementUrl && !isSearch(r.replacementUrl)) { l.url = dec(r.replacementUrl); l.verified = true; l.stock = 'ok'; l.note = '原連結已下架，改為替代賣場（2026/8/22）'; if (/kingsware/.test(l.url)) { l.type = 'other'; l.label = '總代理勁威 看商品'; } if (/buy\.yahoo/.test(l.url)) { l.type = 'other'; l.label = 'Yahoo購物 看商品'; } replaced++; }
    else { const t = l.type === 'momo' ? 'search-momo' : l.type === 'pchome' ? 'search-pchome' : null; if (t) { l.type = t; l.url = dec(r.replacementUrl); l.verified = false; l.note = '原商品頁已下架，改為搜尋頁'; delete l.label; replaced++; } else { o.links = o.links.filter(x => x !== l); removed++; } }
  }
  if (r.status === 'ok' && r.replacementUrl && /deltaww/.test(r.replacementUrl)) { l.url = r.replacementUrl; }
}
// extra: Panasonic official shop for freezer
const fz = byId.freezer_nrfz383avs; if (fz && !fz.links.some(l => /pmst\.panasonic/.test(l.url))) fz.links.push({ type: 'other', url: 'https://pmst.panasonic.com.tw/Shop/Product/Detail/Y2ZKLTYGDG00P91I2PZM/NR-FZ383AV-S', verified: true, label: 'Panasonic 官方商城', note: '官方商城 25,900' });
// availability: if every shop link (momo/pchome) is oos → unclear; stock notes into price note
seed.items.forEach(it => it.options.forEach(o => {
  const shop = (o.links || []).filter(l => l.type === 'momo' || l.type === 'pchome');
  if (shop.length && shop.every(l => l.stock === 'oos') && o.availability === 'in_stock') o.availability = 'unclear';
  if (shop.some(l => l.stock === 'oos') && shop.some(l => l.stock === 'ok')) o.price.note = (o.price.note || '') + '；' + shop.filter(l => l.stock === 'oos').map(l => (l.type === 'momo' ? 'MOMO' : 'PChome') + ' 目前缺貨').join('、');
}));
// dedupe links by url
seed.items.forEach(it => it.options.forEach(o => { const seen = new Set(); o.links = o.links.filter(l => { if (seen.has(l.url)) return false; seen.add(l.url); return true; }); }));
// TV C5 momo note
const c5 = byId.tv_lg_oled77c5pta; if (c5) c5.price.note = (c5.price.note || '') + '；MOMO 77 吋 C5 已下架（現售 C6 約 129,900）';
seed.rev = (seed.rev || 0) + 1; seed.updatedAt = new Date().toISOString();
fs.writeFileSync(path.join(root, 'src/seed.json'), JSON.stringify(seed, null, 2));
const stats = { total: results.length, ok: results.filter(r => r.status === 'ok').length, ok_oos: results.filter(r => r.status === 'ok_oos').length, dead: results.filter(r => r.status === 'dead').length, blocked: results.filter(r => r.status === 'blocked').length, mismatch: results.filter(r => r.status === 'mismatch').length, replaced, removed };
console.log(JSON.stringify(stats));
