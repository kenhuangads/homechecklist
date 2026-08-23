// Merge research/cat-*.json (2026-08-23 brief format) into src/seed.json.
// - existing item: replace catalog fields + options (keeps family-added options & todos)
// - new item: append (room "hvac" auto-created), generate starter todos from install notes
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'src', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const files = fs.readdirSync(path.join(root, 'research')).filter(f => /^cat-.*\.json$/.test(f));
const today = '2026-08-23';
const ROOMS = { kitchen: '廚房', water: '飲水與水質', bath: '衛浴', living: '客廳', entry: '玄關與全屋', hvac: '空調與除濕' };
const TIERS = ['指定', '頂級', '高級', '高CP值', '替代方案'];
const isSearch = u => /searchShop\.jsp|\/search\/\?q=/.test(u || '');
let stats = { files: 0, items: 0, newItems: 0, options: 0, dropped: 0 };
const report = [];
function normOption(o, itemId) {
  const id = (o.id || (itemId + '_' + (o.model || '').toLowerCase().replace(/[^a-z0-9]+/g, '_'))).replace(/[^a-z0-9_]/g, '');
  const links = (o.links || []).filter(l => l && l.url).map(l => {
    const t = l.type || 'other';
    if (isSearch(l.url)) return { type: t === 'pchome' ? 'search-pchome' : 'search-momo', url: l.url, verified: false };
    return { type: t, url: l.url, verified: !!l.verified, label: l.label || undefined, note: l.note || '' };
  });
  const price = Object.assign({ amount: null, min: null, max: null, source: 'other', checkedAt: today, note: '' }, o.price || {});
  if (typeof price.amount === 'number' && price.min == null) price.min = price.amount;
  if (typeof price.amount === 'number' && price.max == null) price.max = price.amount;
  return { id, key: o.key || id, tier: TIERS.includes(o.tier) ? o.tier : '替代方案', brand: o.brand || '', model: o.model || '', name: o.name || '',
    highlights: (o.highlights || []).slice(0, 3), dims: o.dims || '', cutout: o.cutout || '', power: o.power || '', weight: o.weight || '', other: o.other || '',
    price, links, availability: o.availability || 'unclear', reviews: o.reviews ? { praise: o.reviews.praise || [], complaints: o.reviews.complaints || [], sources: o.reviews.sources || [], confidence: o.reviews.confidence || 'low' } : null,
    cmpKeyword: o.cmpKeyword || (o.brand + ' ' + o.model).trim(), note: '', checkedAt: today };
}
function starterTodos(itemId, install) {
  const seen = new Set(); const out = [];
  (install || []).forEach(n => { if (seen.has(n.tag) || out.length >= 3) return; seen.add(n.tag); const first = (n.text || '').split(/[；。]/)[0].trim(); if (first) out.push({ id: `${itemId}_t${out.length + 1}`, text: `${n.tag}：${first.slice(0, 40)}`, done: false, for: 'designer' }); });
  return out;
}
for (const f of files) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(root, 'research', f), 'utf8')); } catch (e) { report.push(`SKIP ${f}: ${e.message}`); continue; }
  if (!Array.isArray(arr)) arr = [arr];
  stats.files++;
  for (const cat of arr) {
    if (!cat || !cat.itemId) continue;
    const roomId = ROOMS[cat.roomId] ? cat.roomId : 'entry';
    if (!seed.rooms.some(r => r.id === roomId)) seed.rooms.push({ id: roomId, name: ROOMS[roomId] });
    const opts = (cat.options || []).map(o => normOption(o, cat.itemId)).filter(o => o.model);
    if (!opts.length) { report.push(`SKIP ${cat.itemId}: no options`); continue; }
    let it = seed.items.find(i => i.id === cat.itemId);
    const ic = cat.installCost && (typeof cat.installCost.min === 'number' || typeof cat.installCost.max === 'number') ? { min: cat.installCost.min ?? null, max: cat.installCost.max ?? null, note: cat.installCost.note || '' } : null;
    const fields = { name: cat.name, short: cat.short, hardReq: cat.hardReq || '', advice: cat.advice || '', warnings: cat.warnings || [], install: cat.install || [], costNotes: cat.costNotes || [], defaultQty: Number(cat.defaultQty) || 1, roomId, pickOptionId: opts.some(o => o.id === cat.pickOptionId) ? cat.pickOptionId : (opts[0] && opts[0].id), pickReason: cat.pickReason || '' };
    if (ic) fields.installCost = ic;
    const resTodos = (cat.todos || []).filter(t => t && t.text).map((t, i) => ({ id: `${cat.itemId}_r${i + 1}`, text: String(t.text).slice(0, 60), done: false, for: t.for === 'family' ? 'family' : 'designer' }));
    if (!it) {
      it = Object.assign({ id: cat.itemId, status: 'choosing', chosenOptionId: null, picks: [], options: opts, notes: [], todos: resTodos.length ? resTodos : starterTodos(cat.itemId, cat.install), requests: [] }, fields);
      seed.items.push(it); stats.newItems++;
    } else {
      const fam = it.options.filter(o => o.tier === '家人推薦');
      // keep richer existing fields when research omitted them
      opts.forEach(o => { const prev = it.options.find(p => p.id === o.id); if (prev) { ['dims', 'cutout', 'power', 'weight', 'other', 'storeName', 'researchNote'].forEach(k => { if (!o[k] && prev[k]) o[k] = prev[k]; }); if (!o.links.some(l => !l.type.startsWith('search')) && prev.links) o.links = prev.links; } });
      Object.assign(it, fields); it.options = [...opts, ...fam];
      if (resTodos.length) { const keep = (it.todos || []).filter(t => t.by || t.done); const kept = new Set(keep.map(t => t.text)); it.todos = [...keep, ...resTodos.filter(t => !kept.has(t.text))]; }
      it.picks = (it.picks || []).filter(p => it.options.some(o => o.id === p.optionId)); it.chosenOptionId = it.picks[0] ? it.picks[0].optionId : null;
    }
    stats.items++; stats.options += opts.length;
    report.push(`${it.id}: ${opts.length} options [${opts.map(o => o.tier + ':' + o.model.split(/[（(]/)[0]).join(' | ')}] pick=${it.pickOptionId}`);
  }
}
// extra prep items for new categories (idempotent)
const extraPrep = [
  { id: 'prep_ac1', group: '空調與除濕', trade: '木作', text: '吊隱式主機旁開維修孔 ≥600×600，正對風鼓與主機板，下方留架梯空間' },
  { id: 'prep_ac2', group: '空調與除濕', trade: '水', text: '冷凝水排水坡度 ≥1/100，建議加滴水盤溢流偵測；天花板淨高需 25–30 cm（原樓高 ≥2.7 m）' },
  { id: 'prep_ac3', group: '空調與除濕', trade: '電', text: '空調與除濕機各自獨立迴路（空調 220V）' },
  { id: 'prep_wh1', group: '熱水系統', trade: '水', text: '24L 燃氣機種向瓦斯公司申請換 5 燈表；屋外型／FE／FF 式排氣管確實排出室外' },
  { id: 'prep_wh2', group: '熱水系統', trade: '電', text: '熱泵熱水器需 220V 與通風放置空間；硬水地區前端接軟水' },
  { id: 'prep_tr1', group: '電熱毛巾架', trade: '電', text: '每間衛浴乾區預留 110V 插座（距出水口 ≥60 cm、離地 ≥60 cm），迴路加漏電保護（RCBO／GFCI）並接地' }
];
extraPrep.forEach(p => { if (!seed.prep.some(x => x.id === p.id) && seed.items.some(i => ['ac_living', 'dehumidifier_living', 'water_heater', 'towel_rack'].includes(i.id))) seed.prep.push(Object.assign({ done: false }, p)); });
seed.catalogVersion = Math.max(Number(seed.catalogVersion) || 0, Number(today.replace(/-/g, '')) * 100) + 1; seed.rev = (seed.rev || 0) + 1; seed.updatedAt = new Date().toISOString();
seed.meta.priceNote = '價格以 MOMO、PChome 24h 現價為準（2026/8/23 逐一實查；PChome 價格每天自動更新），下單前請再點進去確認。';
seed.meta.researchedAt = today;
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
console.log(JSON.stringify(stats)); report.forEach(r => console.log(' -', r));
