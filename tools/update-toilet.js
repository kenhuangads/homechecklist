// Rewrite the TOTO toilet item: every option must have auto lid + auto flush (research/toto_official.json + toto_shops.json, 2026-08-22)
const fs = require('fs'); const path = require('path');
const p = path.join(__dirname, '..', 'src', 'seed.json'); const s = JSON.parse(fs.readFileSync(p, 'utf8'));
const it = s.items.find(i => i.id === 'toilet');
const today = '2026-08-22';
const OFFICIAL = id => `https://www.twtoto.com.tw/product-detail.aspx?mid=1&id=${id}`;
const searchMomo = kw => ({ type: 'search-momo', url: `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(kw)}`, verified: false });
const searchPchome = kw => ({ type: 'search-pchome', url: `https://24h.pchome.com.tw/search/?q=${encodeURIComponent(kw)}`, verified: false });
it.short = '自動掀蓋＋自動沖水';
it.hardReq = '必須同時有自動掀蓋與自動沖水。';
it.advice = '要同時有自動掀蓋＋自動沖水只有兩條路：一體型的 NEOREST（RS／AS／LS）或 G5，或是 TOTO 原廠套組「S7 旗艦款便座＋馬桶洗淨裝置 TCA541＋對應單體馬桶」（CCW288S7AA 等）。套組是分離式，便座壞了只換便座、價格也最低；NEOREST 一體成型最俐落，有電解除菌水（G5 沒有）。';
it.warnings = [
  'S7 輕奢款（TCF47160GTW）與 S5、S2 便座都沒有自動掀蓋，不符需求，已不列入。',
  '便座式的自動沖水必須搭配 TOTO 原廠洗淨裝置（TCA541／TCA540）與對應單體馬桶（CW288／CW923／CW887／CW889）；便座單買裝在舊馬桶上不會有自動沖水。',
  'NX2（CES903KVG，建議售價 507,200）與 NX1（302,500）價格過高，不列入。'
];
it.install = [
  { tag: '電', text: '馬桶側預留 110V 防水接地插座（分離式套組含洗淨裝置，建議預留 2 組較保險）。' },
  { tag: '尺寸', text: '管距購買前務必量測：NEOREST RS／AS 地排 305–435 mm（-S1）或壁排 120–155 mm（-S2）；LS 地排 305–435；G5 地排 305 或 400；套組 CW288 地排 305–400 mm。' },
  { tag: '尺寸', text: '一體型尺寸：RS W386×D690×H515、AS W386×D690×H512、LS W411×D725×H497、G5 W386×D721×H518 mm；套組 CW288 含便座 W452×D732×H625 mm。' },
  { tag: '水', text: '給水壓力約 0.05–0.75MPa；透天高樓層水壓不足需加壓馬達，過高則加減壓閥。' },
  { tag: '其他', text: '自動掀蓋需要便蓋上方淨空，馬桶上方不要做置物層板；S7 旗艦便座搭對應馬桶可藏線。水錘吸收器非必裝，有水錘聲再加。' }
];
it.costNotes = [
  'NEOREST 實查 PChome：RS 112,340（建議售價 137,000）、AS 129,560（158,000）、LS 172,200（210,000），皆不含安裝。',
  'S7 旗艦款便座單買 34,900（建議售價 57,000）；套組 CCW288S7AA MOMO 71,920（建議售價 89,900）；G5 建議售價 98,000（經銷商詢價）。'
];
const common = { brand: 'TOTO', weight: '', note: '', checkedAt: today, storeName: '', researchNote: '' };
it.options = [
  Object.assign({}, common, { id: 'toilet_neorest_ls_ces87120gtw', key: 'toilet_neorest_ls_ces87120gtw', tier: '頂級', model: 'NEOREST LS CES87120GTW', name: 'TOTO NEOREST LS 除菌全自動馬桶（一體型）',
    highlights: ['自動掀蓋＋自動沖水，一體成型', 'AIR-IN WONDER WAVE 律動水波、電解除菌水', '最新外型，洗淨只用 3.8L／3.0L'],
    dims: 'W411 × D725 × H497 mm', cutout: '管距：地排 305–435 mm（436–540 mm 洽經銷商）', power: '110V 防水接地插座；洗淨水量 3.8L／3.0L', other: '暖風烘乾、除臭、前噴霧、遙控器',
    price: { amount: 172200, min: 172200, max: 210000, source: 'pchome', checkedAt: today, note: 'PChome 172,200（建議售價 210,000，不含安裝，庫存 10）；MOMO 未上架' },
    links: [{ type: 'pchome', url: 'https://24h.pchome.com.tw/prod/DEDW02-A900K5B4X', verified: true, note: '不含安裝，庫存 10' }, { type: 'official', url: OFFICIAL(2810), verified: true }, searchMomo('CES87120GTW')],
    availability: 'in_stock', cmpKeyword: 'TOTO CES87120GTW' }),
  Object.assign({}, common, { id: 'toilet_neorest_as_ces85510gtw', key: 'toilet_neorest_as_ces85510gtw', tier: '高級', model: 'NEOREST AS CES85510GTW', name: 'TOTO NEOREST AS 除菌全自動馬桶（一體型）',
    highlights: ['自動掀蓋＋自動沖水，一體成型', 'RS 外型＋AIR-IN WONDER WAVE 律動水波', '電解除菌水、暖風烘乾；地排／壁排都有'],
    dims: 'W386 × D690 × H512 mm', cutout: '管距：地排 305–435 mm（-S1）／壁排 120–155 mm（-S2）', power: '110V 防水接地插座；洗淨水量 地排 3.8L／3.0L', other: '暖風烘乾、除臭、前噴霧、遙控器',
    price: { amount: 129560, min: 129560, max: 158000, source: 'pchome', checkedAt: today, note: 'PChome 129,560（建議售價 158,000，不含安裝，庫存 10）；MOMO 未上架' },
    links: [{ type: 'pchome', url: 'https://24h.pchome.com.tw/prod/DEDW02-A900K5B9K', verified: true, note: '不含安裝，庫存 10' }, { type: 'official', url: OFFICIAL(2811), verified: true }, searchMomo('CES85510GTW')],
    availability: 'in_stock', cmpKeyword: 'TOTO CES85510GTW' }),
  Object.assign({}, common, { id: 'toilet_neorest_rs_ces83410gtw', key: 'toilet_neorest_rs_ces83410gtw', tier: '高級', model: 'NEOREST RS CES83410GTW', name: 'TOTO NEOREST RS 除菌全自動馬桶（一體型）',
    highlights: ['自動掀蓋＋自動沖水，一體成型', '電解除菌水、前噴霧、暖風烘乾', 'NEOREST 入門款，金級省水標章'],
    dims: 'W386 × D690 × H515 mm', cutout: '管距：地排 305–435 mm（-S1）／壁排 120–155 mm（-S2）', power: '110V 防水接地插座；洗淨水量 地排 3.8L／3.0L', other: '暖風烘乾、除臭、遙控器',
    price: { amount: 112340, min: 112340, max: 137000, source: 'pchome', checkedAt: today, note: 'PChome 112,340（建議售價 137,000，不含安裝，庫存 8）；MOMO 未上架' },
    links: [{ type: 'pchome', url: 'https://24h.pchome.com.tw/prod/DEDW02-A900K5BBS', verified: true, note: '不含安裝，庫存 8' }, { type: 'official', url: OFFICIAL(2812), verified: true }, searchMomo('CES83410GTW')],
    availability: 'in_stock', cmpKeyword: 'TOTO CES83410GTW' }),
  Object.assign({}, common, { id: 'toilet_g5_ces75110atw', key: 'toilet_g5_ces75110atw', tier: '高CP值', model: 'G5 全自動馬桶 CES75110ATW', name: 'TOTO G5 全自動馬桶（一體型）',
    highlights: ['自動掀蓋＋自動沖水，一體型裡最便宜', '前噴霧、暖風烘乾、除臭（沒有電解除菌水）', '地排 305 或 400 mm 兩種管距'],
    dims: 'W386 × D721 × H518 mm', cutout: '管距：地排 305 mm 或 400 mm', power: '110V 防水接地插座；洗淨水量 4.8L／3.0L', other: '龍捲上旋式',
    price: { amount: null, min: 98000, max: 98000, source: 'official', checkedAt: today, note: '建議售價 98,000；MOMO／PChome 未上架，需向 TOTO 經銷商詢價' },
    links: [{ type: 'official', url: OFFICIAL(2536), verified: true }, searchMomo('CES75110ATW'), searchPchome('CES75110ATW')],
    availability: 'unclear', cmpKeyword: 'TOTO CES75110ATW' }),
  Object.assign({}, common, { id: 'toilet_set_ccw288s7aa', key: 'toilet_set_ccw288s7aa', tier: '高CP值', model: 'CCW288S7AA 套組（CW288 馬桶＋S7 旗艦便座＋洗淨裝置）', name: 'TOTO 除菌全自動馬桶套組：CW288SGUR 單體馬桶＋WASHLET S7 旗艦款 TCF47360GTW＋馬桶洗淨裝置 TCA541',
    highlights: ['原廠套組：便座電動掀蓋＋洗淨裝置自動沖水', '分離式，便座壞了只換便座', '全部方案裡最便宜，MOMO 有現貨'],
    dims: '含便座 W452 × D732 × H625 mm；便座 W383 × D530 × H103 mm', cutout: '管距：地排 305–400 mm', power: '110V 防水接地插座；沖水量 4.8L', other: '同系列其他馬桶套組（經銷商）：CCW887S7AA 建議售價 88,800、CCW923S7AA 95,400、CCW889S7AA 87,600',
    price: { amount: 71920, min: 71920, max: 89900, source: 'momo', checkedAt: today, note: 'MOMO 71,920（建議售價 89,900）；PChome 未上架；S7 旗艦便座單買 34,900，但要另配 TCA541 與對應馬桶才有自動沖水' },
    links: [{ type: 'momo', url: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=15239925', verified: true, note: 'MOMO 71,920' }, { type: 'official', url: OFFICIAL(2926), verified: true, label: '官網套組頁' }, searchPchome('CCW288S7AA'),
      { type: 'momo', url: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=12288626', verified: true, label: '便座單品 MOMO（34,900）', note: 'TCF47360GTW 單品' }, { type: 'pchome', url: 'https://24h.pchome.com.tw/prod/DMAL6I-A900JEKAD', verified: true, label: '便座單品 PChome（34,900）', note: 'TCF47360GTW 單品' }, { type: 'official', url: 'https://www.twtoto.com.tw/product-detail.aspx?mid=2&id=2930', verified: true, label: '便座官網頁' }],
    availability: 'in_stock', cmpKeyword: 'TOTO TCF47360GTW' })
];
it.pickOptionId = 'toilet_set_ccw288s7aa';
it.pickReason = '同樣有自動掀蓋＋自動沖水，便座壞了只換便座，7.2 萬比 NEOREST RS 省約 4 萬；想要一體成型、電解除菌水就選 NEOREST RS／AS。';
if (it.chosenOptionId && !it.options.some(o => o.id === it.chosenOptionId)) it.chosenOptionId = null;
it.todos = [
  { id: 'toilet_t1', text: '量每間廁所的排水管距（305 或 400mm；NEOREST 可到 435）', done: false },
  { id: 'toilet_t2', text: '馬桶旁預留 110V 防水接地插座（建議 2 組）', done: false },
  { id: 'toilet_t3', text: '確認各樓層水壓（不足加壓、過高減壓）', done: false },
  { id: 'toilet_t4', text: '決定一體型（NEOREST／G5）或原廠套組（S7 旗艦便座＋TCA541）', done: false }
];
s.catalogVersion = 2026082202; s.rev = (s.rev || 0) + 1; s.updatedAt = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log('toilet rewritten:', it.options.map(o => o.tier + ' ' + o.model.split('（')[0]).join(' | '), '| catalogVersion', s.catalogVersion);
