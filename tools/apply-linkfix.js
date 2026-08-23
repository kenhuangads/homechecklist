// Apply research/linkcheck-latest.json to src/seed.json:
//  dead/error  -> drop the link (or convert shop links to a search page if it was the only one)
//  oos         -> annotate the link note
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'src/seed.json'), 'utf8'));
const res = JSON.parse(fs.readFileSync(path.join(root, 'research/linkcheck-latest.json'), 'utf8'));
const byOpt = {}; seed.items.forEach(it => it.options.forEach(o => byOpt[o.id] = { it, o }));
let dropped = 0, oos = 0, converted = 0;
for (const r of res) {
  const e = byOpt[r.opt]; if (!e) continue;
  const { it, o } = e;
  const link = (o.links || []).find(l => l.url === r.url); if (!link) continue;
  link.checkedAt = '2026-08-23';
  if (r.status === 'oos') { link.stock = 'oos'; link.note = [link.note, '目前缺貨／補貨中'].filter(Boolean).join('；'); oos++; }
  else if (r.status === 'dead' || r.status === 'error') {
    const sameType = (o.links || []).filter(l => l.type === link.type && l !== link);
    if ((link.type === 'momo' || link.type === 'pchome') && !sameType.length) {
      const kw = o.cmpKeyword || `${o.brand} ${o.model}`;
      link.type = link.type === 'momo' ? 'search-momo' : 'search-pchome';
      link.url = link.type === 'search-momo' ? `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(kw)}` : `https://24h.pchome.com.tw/search/?q=${encodeURIComponent(kw)}`;
      link.verified = false; link.note = '原商品頁已失效，改為搜尋頁'; delete link.label; converted++;
    } else { o.links = o.links.filter(l => l !== link); dropped++; }
  }
  else if (r.status === 'ok') { link.stock = 'ok'; }
}
// availability follows shop links
seed.items.forEach(it => it.options.forEach(o => {
  const shop = (o.links || []).filter(l => l.type === 'momo' || l.type === 'pchome');
  if (shop.length && shop.every(l => l.stock === 'oos') && o.availability === 'in_stock') o.availability = 'unclear';
}));
seed.rev = (seed.rev || 0) + 1; seed.updatedAt = new Date().toISOString();
fs.writeFileSync(path.join(root, 'src/seed.json'), JSON.stringify(seed, null, 2));
console.log(JSON.stringify({ dropped, converted, oos, checked: res.length }));
