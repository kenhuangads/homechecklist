// Merge verified research (research/*.json) into src/seed.json and apply fact corrections.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'src/seed.base.json'), 'utf8'));
const research = {};
for (const f of fs.readdirSync(path.join(root, 'research'))) {
  if (!f.endsWith('.json')) continue;
  for (const r of JSON.parse(fs.readFileSync(path.join(root, 'research', f), 'utf8'))) research[r.key] = r;
}
const dec = s => (s || '').replace(/&amp;/g, '&')
  .replace(/PChome 24h 搜尋 API 回傳 0 筆|PChome 搜尋 API 查無此型號|PChome 搜尋 API 無 [^；]+品項|PChome 24h 搜尋結果僅有[^；]+/g, 'PChome 沒有上架')
  .replace(/頁面無法抓取價格/g, '賣場頁未標價，請點進去看')
  .replace(/API 現價/g, '現價').replace(/API 標價/g, '標價').replace(/API 顯示 ForSale、/g, '').replace(/API 顯示 NotReady、/g, '').replace(/API：/g, '')
  .replace(/NotReady＝缺貨\/貨到通知/g, '缺貨，可登記貨到通知').replace(/NotReady（暫缺貨）/g, '暫時缺貨').replace(/（NotReady）/g, '（缺貨）').replace(/NotReady/g, '缺貨')
  .replace(/ForSale/g, '可下單').replace(/OrderRefill＝補貨中可下單/g, '補貨中，可下單')
  .replace(/momo 商城賣場/g, 'MOMO 商城賣場').replace(/momo店\+/g, 'MOMO 店+');
const isSearch = u => /searchShop\.jsp|\/search\/\?q=/.test(u || '');
const today = '2026-08-22';

function linksFrom(r, labelPrefix) {
  const links = [];
  const add = (type, o, label) => {
    if (!o || !o.url) return;
    const url = dec(o.url);
    if (isSearch(url)) { links.push({ type: 'search-' + type, url, verified: false, label }); return; }
    links.push({ type, url, verified: o.verified === 'fetched', label, note: o.note ? dec(o.note) : '' });
  };
  add('momo', r.momo, labelPrefix ? `${labelPrefix} MOMO` : undefined);
  add('pchome', r.pchome, labelPrefix ? `${labelPrefix} PChome` : undefined);
  if (r.official && r.official.url && r.official.verified !== 'none') links.push({ type: 'official', url: dec(r.official.url), verified: r.official.verified === 'fetched', label: labelPrefix ? `${labelPrefix} 官網` : undefined });
  return links;
}
function priceFrom(r) {
  const p = { amount: null, min: null, max: null, source: 'other', checkedAt: today, note: '' };
  const cands = [];
  if (r.momo && typeof r.momo.price === 'number') cands.push({ s: 'momo', v: r.momo.price });
  if (r.pchome && typeof r.pchome.price === 'number') cands.push({ s: 'pchome', v: r.pchome.price });
  const bp = r.best_price || {};
  if (cands.length) {
    cands.sort((a, b) => a.v - b.v);
    p.amount = cands[0].v; p.source = cands[0].s; p.min = cands[0].v; p.max = cands[cands.length - 1].v;
  } else if (typeof bp.amount === 'number') {
    p.amount = bp.amount; p.min = bp.amount; p.max = bp.amount;
    p.source = /^official/.test(bp.source || '') ? 'official' : 'other';
  }
  const parts = [];
  if (r.momo && typeof r.momo.price === 'number') parts.push(`MOMO ${r.momo.price.toLocaleString('en-US')}${r.momo.note ? '（' + dec(r.momo.note).split('；')[0] + '）' : ''}`);
  else if (r.momo && r.momo.note) parts.push('MOMO：' + dec(r.momo.note).split('；')[0]);
  if (r.pchome && typeof r.pchome.price === 'number') parts.push(`PChome ${r.pchome.price.toLocaleString('en-US')}${r.pchome.note ? '（' + dec(r.pchome.note).split('；')[0] + '）' : ''}`);
  else if (r.pchome && r.pchome.note) parts.push('PChome：' + dec(r.pchome.note).split('；')[0]);
  if (!cands.length && typeof bp.amount === 'number') parts.push(`${bp.source.replace(/^other:/, '')} ${bp.amount.toLocaleString('en-US')}`);
  p.note = parts.join('；');
  p.sourceDetail = (bp.source || '').replace(/^other:/, '');
  return p;
}
function applyResearch(opt, key) {
  const r = research[key]; if (!r) { console.warn('no research for', key); return; }
  opt.links = linksFrom(r);
  opt.price = priceFrom(r);
  if (!opt.dims && r.dimensions) opt.dims = r.dimensions;
  if ((!opt.power || /^110V$|^220V$/.test(opt.power)) && r.power) opt.power = r.power;
  if (!opt.other && r.warranty) opt.other = '保固：' + r.warranty;
  opt.availability = r.availability || 'unclear';
  opt.storeName = dec(r.name_zh || '');
  opt.researchNote = dec(r.notes || '');
  opt.checkedAt = today;
}
const byId = {}; seed.items.forEach(it => it.options.forEach(o => byId[o.id] = o));
const itemById = {}; seed.items.forEach(it => itemById[it.id] = it);

// 1) generic merge for options with keys
seed.items.forEach(it => it.options.forEach(o => { if (o.key) applyResearch(o, o.key); }));

// 2) targeted corrections ---------------------------------------------------
// hood: not on momo/pchome right now
byId.hood_fvktb2sd1tw.price.note = 'MOMO／PChome 目前皆無在售（原頁已下架）；甫佳電器 21,900（原價 22,900，預購、不含安裝）';
byId.hood_fvktb2sd1tw.links.push({ type: 'other', url: 'https://www.fuchia.tw/v2/shop/item/3219', verified: true, label: '甫佳電器 看商品' });
itemById.hood.warnings.push('2026/8/22 實查：MOMO 與 PChome 目前沒有在售，請改向經銷商（甫佳、格蘭登等）或 Panasonic 官方商城購買。');

// ih: price higher than report
itemById.ih.warnings.push('2026/8/22 實查現價：PChome 39,800（庫存 1）／MOMO 42,900；報告寫的 34,800 是經銷價，電商買會貴一些。各賣場皆不含安裝。');

// oven: TOA-110TW official only
byId.oven_toa110tw.price.note = '官網詢價制（未標價）；MOMO／PChome 及其他台灣通路皆未上架';
byId.oven_toa110tw.highlights.push('只能向官網詢價，通路買不到');

// dishwasher: Bosch TW is 110V; add 6-series; Miele model; Electrolux out of stock
const bosch8 = byId.dw_bosch_8series_60;
bosch8.model = 'SMV8ZCX00X'; bosch8.name = '博世 8 系列 60cm 全嵌式沸石洗碗機（14 人份，需自備門板）';
bosch8.highlights = ['上層可移、下籃深，可平放大炒鍋／湯鍋', 'Zeolith 沸石烘乾、德國製、41dB', '台灣機種為 110V（含基本安裝）'];
bosch8.power = '110V／1.1kW（10A）'; bosch8.cutout = '全嵌式開孔約 W600 × H815–875 × D550 mm';
const bosch6 = JSON.parse(JSON.stringify(bosch8));
bosch6.id = 'dw_bosch_6series_60'; bosch6.key = 'dw_bosch_6series_60'; bosch6.model = 'SMV6ZAX00X'; bosch6.name = '博世 6 系列 60cm 全嵌式沸石洗碗機（13 人份，需自備門板）';
bosch6.highlights = ['比 8 系列便宜約 2 萬，一樣能放大鍋', 'Zeolith 沸石烘乾、德國製、44dB', '台灣機種為 110V'];
applyResearch(bosch6, 'dw_bosch_6series_60'); bosch6.power = '110V／1.1kW（10A）';
itemById.dishwasher.options.splice(itemById.dishwasher.options.indexOf(bosch8) + 1, 0, bosch6);
const miele = byId.dw_miele_g7000_60;
miele.model = 'G7114C SCi'; miele.name = 'Miele G7114C SCi 半嵌式洗碗機（16 人份中式碗籃・AutoDos）';
miele.highlights = ['AutoDos 自動投劑、AutoOpen 自動開門烘乾', '大鍋強項、耐用、16 人份、44dBA', '需 220V 專用迴路'];
miele.power = '220V／1.8kW（10A）'; miele.cutout = '安裝尺寸 W600 × H805–870 × D570 mm';
const elux = byId.dw_electrolux_60;
elux.model = 'KEE47200IW'; elux.name = '伊萊克斯 極淨呵護 300 系列半嵌式洗碗機（60cm／13 人份）';
elux.highlights = ['CP 值佳、下籃可放大鍋', '2026/8 實查 MOMO 已下架、PChome 缺貨（價格為最後標價）'];
elux.power = '110V／1000W';
itemById.dishwasher.warnings = [
  '抽屜式放不下大炒鍋／深湯鍋，購買前務必確認內槽可用高度。',
  '電壓實查：F&P 與 Bosch 台灣機種都是 110V；Miele 為 220V 專用迴路——下單前再確認賣場標示。'
];
itemById.dishwasher.install[2].text = 'F&P 抽屜式與 Bosch 台灣機種為 110V（10A）；Miele 為 220V 專用迴路。';

// water dispenser: OASIS prices; modular = 賀眾 UR-3902AW-1 + SodaStream ART; Buder is 冷熱 only
const fizz = byId.water_oasis_fizz401;
fizz.price.note = 'MOMO 54,800（8/21–8/24 限時 95 折 52,060，庫存 <5）；PChome 54,800；燦坤 54,800；含免費基本安裝';
fizz.highlights.push('報告寫「2 萬多起」是錯的，實查 5.2–5.5 萬');
const modular = byId.water_modular_3temp_soda;
modular.brand = '賀眾牌＋SodaStream'; modular.model = 'UR-3902AW-1 ＋ SodaStream ART';
modular.name = '賀眾 PREMIER 廚下冰溫瞬熱旗艦飲水機（600G RO 雙源淨化）＋ SodaStream ART 桌上氣泡水機';
modular.highlights = ['賀眾唯一真正冰／溫／熱三溫櫥下機（內建 600GPD RO）', '氣泡另用桌上型 ART，故障互不影響、維修單純', '普德 BD-3006A 只有冷熱雙溫（非冰溫熱），不符需求'];
modular.dims = '賀眾主機 183 × 467 × 463 mm；前置濾芯 160 × 155 × 380 mm；SodaStream ART 250 × 180 × 440 mm';
modular.power = '110V／加熱 1500W＋製冷 100W（另有 220V 版）；ART 免插電';
modular.cutout = '只需一個龍頭孔（氣泡機放檯面）';
const uw = research.water_uw_3temp, soda = research.sparkling_sodastream_module;
modular.links = [...linksFrom(uw, '賀眾'), ...linksFrom(soda, 'SodaStream')];
modular.price = { amount: 36800 + 4990, min: 36800 + 4990, max: 36800 + 5490, source: 'momo', checkedAt: today, note: '賀眾 UR-3902AW-1 MOMO／PChome 36,800（含 3 米內標準安裝）＋ SodaStream ART PChome 4,990／MOMO 5,490' };
modular.availability = 'in_stock'; modular.storeName = dec(uw.name_zh); modular.researchNote = dec(uw.notes) + '；' + dec(soda.notes); modular.checkedAt = today;
const cold = byId.water_oasis_3temp;
cold.model = 'LUXES-COLD-301'; cold.name = 'OASIS 櫥下輕奢三溫 UVC 飲水機（含三道軟水抑菌淨水）＋桌上型氣泡機';
cold.highlights = ['冰溫熱三合一、UVC 瞬間殺菌、含免費基本安裝', '氣泡另配 SodaStream ART（約 5,000）'];
cold.price.note = 'MOMO 39,800（8/21–8/24 限時 37,810）；PChome 39,800；含免費基本安裝；氣泡機另加約 5,000';
cold.price.min = 39800 + 4990; cold.price.max = 39800 + 5490; cold.price.amount = 39800 + 4990;
cold.links.push(...linksFrom(soda, 'SodaStream'));
itemById.water_dispenser.warnings = ['報告列的 Yaffle YS-1301H、BWT AQA S CT「四合一」無法證實，待確認。', '實查價：OASIS 四合一 5.2–5.5 萬、輕奢三溫 3.8–4 萬，比報告高很多。'];

// softener: BWT price reality
const bwt = byId.soft_bwt_bewamat75a;
bwt.highlights.push('2026/8 實查：總代理拓霖預購 213,000；MOMO 已下架、PChome 缺貨——報告的 8–12 萬是錯的');
bwt.price.note = 'PChome 標價 213,000（缺貨）；總代理拓霖企業商城預購 213,000；MOMO 已下架';
bwt.dims = '390 × 560 × 1090 mm'; bwt.power = '230V 變壓 18V／20W';
const sft200 = byId.soft_3m_sft200;
sft200.price.note = '3M 官方旗艦店 SFT-200＋BFS3-40BK 前置 90,900；MOMO 全戶三件組 120,700（2026/9/11 後排程安裝）；PChome 無';
sft200.price.amount = 90900; sft200.price.min = 90900; sft200.price.max = 120700; sft200.price.source = 'official';
sft200.links.unshift({ type: 'official', url: 'https://shop.3m.com.tw/SalePage/Index/11013225', verified: true, label: '3M 官方旗艦店（90,900）' });
sft200.links = sft200.links.filter((l, i, arr) => arr.findIndex(x => x.url === l.url) === i);
const sft150 = byId.soft_3m_sft150;
sft150.price.note = 'MOMO 74,900（含 BFS3-40BK 前置反洗，預購 2026/9/11 出貨，廠商宅配安裝）；PChome 無';
itemById.softener.warnings.push('實查價比報告高很多：3M SFT-150 約 7.5 萬、SFT-200 約 9.1–12 萬、BWT 75A 約 21.3 萬（皆含前置或安裝）。');

// toilet: composites with CW769CTW
const rs = byId.toilet_neorest_rs_ces83410gtw;
rs.dims = 'W386 × D690 × H515 mm'; rs.cutout = '管距：地排 305–435 mm（-S1）／壁排 120–155 mm（-S2）';
rs.price.note = 'PChome 112,340（市價 137,000，不含安裝，庫存 8）；MOMO 第三方賣場無法取得價格；TOTO 官網定價 137,000';
rs.highlights.push('實查 11.2 萬（不含安裝），比報告 13–17 萬低');
const cw = research.toilet_cw769ctw;
const cwLinks = linksFrom(cw, '馬桶 CW769CTW');
const s7 = byId.washlet_s7_tcf47160gtw, s5 = byId.washlet_s5_tcf34461gtw;
s7.model = 'WASHLET S7 TCF47160GTW ＋ 馬桶 CW769CTW'; s7.name = 'TOTO S7 輕奢款除菌溫水洗淨便座 ＋ 二段上壓分離式馬桶 CW769CTW';
s7.highlights = ['分離式：日後只換便座、維修便宜', 'S7：瞬熱式、電解除菌水、全包覆便蓋', '馬桶 CW769CTW 管距 305–400 mm、4.8L/3.0L'];
s7.dims = '便座 W383 × D530 × H103 mm；馬桶 W395 × D700 × H746 mm'; s7.cutout = '管距 305–400 mm';
s7.links = [...linksFrom(research.washlet_s7_tcf47160gtw, '便座 S7'), ...cwLinks];
s7.price = { amount: 23900 + 14359, min: 23900 + 14359, max: 23900 + 15436, source: 'momo', checkedAt: today, note: '便座 S7 MOMO／PChome 23,900 ＋ 馬桶 CW769CTW MOMO 折後 14,359（限北北基桃配送）／PChome 15,436；皆不含安裝' };
s5.model = 'WASHLET S5 TCF34461GTW（或 S2 TCF33461GTW）＋ 馬桶 CW769CTW'; s5.name = 'TOTO S5（2025 新款、無線遙控）或 S2 進階款便座 ＋ 分離式馬桶 CW769CTW';
s5.highlights = ['S5 17,900／S2 14,900（MOMO、PChome 同價）', '搭 CW769CTW 馬桶約 14,400–15,400', '維修最省、CP 值最高'];
s5.dims = '便座 S5 W382 × D533 × H139 mm；馬桶 W395 × D700 × H746 mm'; s5.cutout = '管距 305–400 mm';
s5.links = [...linksFrom(research.washlet_s5_tcf34461gtw, '便座 S5'), ...linksFrom(research.washlet_s2_tcf33461gtw, '便座 S2'), ...cwLinks];
s5.price = { amount: 17900 + 14359, min: 14900 + 14359, max: 17900 + 15436, source: 'momo', checkedAt: today, note: 'S5 17,900 或 S2 14,900 ＋ 馬桶 CW769CTW 14,359–15,436；皆不含安裝' };
itemById.toilet.install[0].text = '排水管距：CW769CTW 305–400 mm；NEOREST RS 地排 305–435 mm（436–540 或 200 mm 需洽經銷）、壁排 120–155 mm。購買前務必量測。';

// bath heater: Mitsubishi is 220V
const mit = byId.heater_mitsubishi_v251bztwn;
mit.highlights = ['3D 擺葉、IPX7 無線遙控、日本製', '暖／涼／乾／換氣，適用約 2–4 坪', '實查為 220V 機型（110V 款是 V-151BZ-TWN）'];
mit.power = '220V／2250W'; mit.dims = '嵌入尺寸 300 × 275 × 180 mm';
mit.price.note = 'PChome 14,700（市價 24,500）；MOMO 15,000（市價 20,300）；3 年保固；不含安裝';
const pan = byId.heater_panasonic_fv40buy1w;
pan.dims = '本體 394 × 270 × 180 mm；開孔 400 × 280 mm（上方淨高需 200mm）'; pan.cutout = '開孔 400 × 280 mm'; pan.power = '220V／1650W';
pan.price.note = 'MOMO 限時 9,405（市售 22,000）；PChome 9,800；皆為 110V／220V 合併賣場，下單要選 220V FV-40BUY1W；不含安裝';
const delta = byId.heater_delta_vhb30bcmrta;
delta.dims = '安裝尺寸 300 × 300 × 174 mm；出風口 4 吋（100mm）；5.5kg'; delta.cutout = '開孔 300 × 300 mm'; delta.power = '220V／加熱 2000W＋馬達 15W';
delta.price.note = '無線 VHB30BCMRT-A：PChome 7,500／MOMO 8,500；有線 VHB30BCMT-AD：MOMO 7,780／PChome 8,100；合併賣場下單要選 220V；不含安裝';
const dT = research.heater_delta_vhb30bcmtad;
delta.links = [...linksFrom(research.heater_delta_vhb30bcmrta, '無線款'), ...linksFrom(dT, '有線款')];
delta.price.amount = 7500; delta.price.min = 7500; delta.price.max = 8500; delta.price.source = 'pchome';
itemById.bath_heater.advice = '三款實查都是 220V 機型（三菱 V-251BZ-TWN 報告寫 110V 是錯的），正好符合「新裝潢建議 220V」。建議選有線線控：面板耐用、濕手好按。透天多間浴室，數量請自行乘倍。';
itemById.bath_heater.install[2].text = '天花板須留機體高度（台達 174mm、三菱 180mm、Panasonic 180mm＋上方淨高 200mm）＋出風管路徑；開孔三菱 300×275、台達 300×300、Panasonic 400×280。';

// TV: G5 -> G6; stock notes
const g = byId.tv_lg_oled77g5pta;
g.model = 'OLED77G6PTA'; g.name = 'LG 77 吋 OLED evo G6 4K 電視（2026 新款；G5 已下架）';
g.highlights = ['OLED evo、純淨黑抗反光面板', '適合可控光、重畫質對比的客廳', 'OLED 面板 5 年保固'];
g.price.note = 'PChome 164,900（庫存 3）；MOMO 未找到可開啟的商品頁；G5 全通路已下架';
g.other = 'VESA 300×300；重量 33.0 kg（不含腳座）';
byId.tv_lg_86qned86ata.other = 'VESA 600×400；重量 50.0 kg（不含腳座）'; byId.tv_lg_86qned86ata.price.note = 'PChome 99,000（市價 149,000，目前缺貨可貨到通知）；MOMO 自營約 97,000（比價網，未驗證）；小蔡電器 MOMO 店含壁掛安裝約 93,999';
byId.tv_lg_75qned86ata.other = 'VESA 400×300；重量 33.3 kg（不含腳座）'; byId.tv_lg_75qned86ata.price.note = 'PChome 52,155（缺貨）；MOMO 頁面無價；集雅社標「停產」49,410——疑已進入清庫存，要買要快';
byId.tv_lg_75qned86ata.highlights.push('2026/8 實查多通路缺貨／清庫存');
byId.tv_lg_75qned82ata.other = 'VESA 300×200；重量 31.4 kg（不含腳座）'; byId.tv_lg_75qned82ata.price.note = 'MOMO 限時 39,900（含標準安裝，原價 72,900）；PChome 56,618；LG 官網活動送壁掛架＋免費壁掛安裝';
byId.tv_lg_75qned82ata.highlights = ['QNED 4K、75 吋最便宜的選擇', 'MOMO 含標準安裝', '實查有現貨'];
byId.tv_lg_75qned9mata.other = 'VESA 300×200；重量 30.7 kg（不含腳座）'; byId.tv_lg_75qned9mata.price.note = 'PChome 74,900（缺貨）；小蔡電器 MOMO 店含壁掛安裝約 77,900';
byId.tv_lg_oled77c5pta.other = 'VESA 300×200；重量 23.5 kg（不含腳座）'; byId.tv_lg_oled77c5pta.price.note = 'PChome 69,900（含前推壁掛架，補貨中可下單）；MOMO 頁面無價';
byId.tv_lg_oled77c5pta.highlights = ['OLED evo C5、120Hz', 'PChome 69,900 含壁掛架，CP 值很高'];
itemById.tv.warnings = ['實查：OLED77G5 已下架、2026 主力為 G6（16.5 萬）；75QNED86ATA 多通路缺貨／清庫存；86QNED86ATA PChome 缺貨。', '報告的 75MRGB86BTA（Micro RGB）型號尾碼待以 LG 台灣官網實際上架為準。'];

// Soundbar: S90TR / S70TY not sold in TW -> S80TR / S70TR
const s90 = byId.sb_lg_s90tr;
s90.model = 'S80TR'; s90.name = 'LG Soundbar S80TR（5.1.3 聲道，無線後環繞＋重低音）';
s90.highlights = ['無線後環繞＋重低音，挑高客廳實體後環繞更有感', 'S90TR 台灣未上市，台灣同代為 S80TR'];
applyResearch(s90, 'sb_lg_s80tr');
s90.price.note = 'PChome 19,900（僅 1 組）／MOMO 21,900（<2 組）；兩平台都低庫存';
const s70 = byId.sb_lg_s70ty;
s70.model = 'S70TR'; s70.name = 'LG Soundbar S70TR（5.1.1 聲道）';
s70.highlights = ['入門款；S70TY 台灣未上市，台灣對應為 S70TR'];
s70.links = [
  { type: 'pchome', url: 'https://24h.pchome.com.tw/prod/DMAAF8-A900HZQ7K', verified: false, note: 'PChome 15,900' },
  { type: 'official', url: 'https://www.lg.com/tw/speakers/lg-s70tr', verified: false },
  { type: 'search-momo', url: 'https://www.momoshop.com.tw/search/searchShop.jsp?keyword=LG%20S70TR', verified: false }
];
s70.price = { amount: 15900, min: 15900, max: 18900, source: 'pchome', checkedAt: today, note: 'PChome 15,900–18,900（S70TR）' };
s70.availability = 'unclear'; s70.checkedAt = today;
byId.sb_lg_s95tr.price.note = 'MOMO 促銷 28,900（原價 35,900）；PChome 32,900（庫存 2）';
byId.sb_samsung_q990f.price.note = 'PChome 38,888（僅 1 組）；MOMO 44,900（預購 8/24 出貨）；三星官網已售完';
itemById.soundbar.warnings = ['實查：S90TR、S70TY 台灣未上市（LG 台灣官網 404）；台灣可買的是 S95TR（9.1.5）、S80TR（5.1.3）、S70TR（5.1.1）。'];

// Robots
byId.robot_roborock_saros20.price.note = 'MOMO 34,980／PChome 34,980／官網 34,980（市價 69,999）；需自行找水電接水管（官網登錄最高補助安裝費 1,200）';
byId.robot_roborock_saros20.highlights.push('實查三通路同價 34,980，比報告「4 萬級」便宜');
const x50 = byId.robot_dreame_x50ultra;
x50.price.note = '官網 24,988 已售完；PChome 31,980 缺貨；MOMO 已下架——後繼機 X60 Ultra 已上市，建議改看 X60';
x50.highlights.push('上下水模組另購：官網 3,680（缺貨）、主機頁加購 2,980');
x50.highlights.push('實查全通路缺貨／售完，應改看 X60 Ultra');
const qp = byId.robot_roborock_qrevo_water;
qp.model = 'Qrevo Pro 水立方'; qp.name = '石頭 Qrevo Pro 水立方（60°C 熱水洗／機械手臂／自動上下水）';
qp.highlights = ['官網 14,999 售完為止（市價 43,999）', '台灣未販售 Qrevo Curv／Slim 水立方版', 'PChome 缺貨；MOMO 無有效商品頁'];
qp.price.note = '官網 14,999（售完為止）；PChome 14,999 缺貨；另 Qrevo MaxV 水立方 PChome 35,900 缺貨';
qp.price.source = 'official';
itemById.robot_vacuum.warnings = ['實查：Dreame X50 Ultra 全通路缺貨／售完（後繼 X60 Ultra 已上市）；Qrevo Pro 水立方 官網售完為止。Saros 20 水立方有現貨 34,980。'];

// Locks
byId.lock_hitachi_hitfy10t.price.note = 'PChome 34,960（市價 45,000）／MOMO 限時 35,800（<5 組）；皆含基本安裝、3 年保固';
byId.lock_yale_lunaproplus.price.note = 'PChome 25,000（香榭金，僅 1 組）／MOMO 27,999（8/21–8/24 促銷）；含原廠安裝、3 年保固';
byId.lock_yale_lunaproplus.highlights.push('門厚 35–100 mm');
byId.lock_philips_ddl709fvp.price.note = 'MOMO 32,500／PChome 32,500；含基本安裝、3 年保固';
byId.lock_philips_ddl709fvp.highlights.push('門厚 3.8–12 cm；4 吋室內螢幕、貓眼視訊對講');
const lk = byId.lock_lockin_v5max;
lk.price.note = '官網 28,500（現貨、原價 39,990）；PChome 31,000；MOMO 33,000（不含安裝）';
lk.price.amount = 28500; lk.price.min = 28500; lk.price.max = 33000; lk.price.source = 'official';
lk.highlights.push('實查 2.85–3.3 萬，報告的 1.3–1.6 萬是錯的；建議門厚 4–10 cm');
itemById.door_lock.warnings = ['實查價：鹿客 V5 Max 2.85–3.3 萬（報告 1.3–1.6 萬錯誤）、Yale Luna Pro+ 2.5–2.8 萬、Philips 709FVP 3.25 萬、日立 3.5–3.6 萬。', 'Philips 702FVP 型號待以飛利浦官方現售為準；主推 709FVP。'];

// meta
seed.meta.priceNote = '價格以 MOMO、PChome 24h 現價為準（2026/8/22 逐一實查），每日會浮動，下單前請再點進去確認一次。';
seed.meta.researchedAt = today;
delete seed.budget.rows;
seed.budget.note = '預算由各方案的實查價即時計算（指定型號三檔同價；各檔取該等級最便宜的方案）。未含全屋水電改線、廚具木工、壁掛／管線延長等工程費；暖風機以 1 間計，透天常需 2–3 間。';
seed.budget.totals = undefined;

fs.writeFileSync(path.join(root, 'src/seed.json'), JSON.stringify(seed, null, 2));
let nLinks = 0, nDirect = 0; seed.items.forEach(it => it.options.forEach(o => { nLinks += o.links.length; nDirect += o.links.filter(l => !l.type.startsWith('search')).length; }));
console.log('merged: options', seed.items.reduce((n, i) => n + i.options.length, 0), 'links', nLinks, 'direct', nDirect, 'bytes', JSON.stringify(seed).length);
