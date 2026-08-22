// Content pass: concise highlights, expert picks, compare keywords, 2 roles, clean baseline.
const fs = require('fs'); const path = require('path');
const p = path.join(__dirname, '..', 'src', 'seed.json');
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
const H = {
  hood_fvktb2sd1tw: ['揮手就能開關，不沾油手', '18 m³/min 大風量、3 段風速', '機身薄不碰頭，延遲 3 分鐘關機'],
  ih_kyc1w70: ['光感應火力，9 段＋油煎油炸模式', '兩口各 19cm，大鍋也放得下', '多重安全保護＋兒童鎖'],
  oven_toa110tw: ['26L 大容量，一次烤全家份', '10 合一：氣炸、烘烤、風乾都行', '只能向官網詢價，通路買不到'],
  oven_toa95tw: ['26L 可烤全雞、9 片吐司', '電子探針，肉熟度不用猜', '12 種模式，MOMO／PChome 有現貨'],
  oven_toa60tw: ['17L 小家庭剛好，不佔檯面', '氣炸＋烘烤多功能', '價格最親民'],
  mw_nngf574: ['變頻平面式，免轉盤好清理', '微波／燒烤各 1000W', '23 道自動料理、兒童鎖'],
  freezer_nrfz383avs: ['380L 直立式，分層好拿取', '冷凍／冷藏一鍵切換', '變頻無霜，年耗電 348 度'],
  dw_fp_dd60dtx6hi1: ['雙層抽屜分開洗，免彎腰', '嵌門板，與廚具同色', '43dB 安靜；但放不下大炒鍋'],
  dw_fp_dd60dchx9: ['雙層抽屜分開洗，免彎腰', '不鏽鋼面板，免做門板', '73°C 高溫殺菌、110V 免改電'],
  dw_fp_dd60scthx9: ['單層加高 7 人份，小家庭夠用', '不鏽鋼、43dB 安靜', '抽屜式裡價格最低'],
  dw_bosch_8series_60: ['下籃深，32–36cm 炒鍋可平放', '沸石烘乾，塑膠盒也能乾', '德國製、41dB、110V 免改電'],
  dw_bosch_6series_60: ['一樣放得下大鍋，便宜約 2 萬', '沸石烘乾、德國製', '110V 免改電、44dB'],
  dw_miele_g7000_60: ['AutoDos 自動投放洗劑', '大鍋、中式碗籃都順手', '最耐用；需 220V 專用迴路'],
  dw_electrolux_60: ['60cm 機種裡價格最低', '下籃可放大鍋', '目前缺貨，需等補貨'],
  water_oasis_fizz401: ['冰、溫、熱＋氣泡一台搞定', 'UVC 殺菌、熱水 80/90/100°C', '含免費基本安裝、台灣製'],
  water_modular_3temp_soda: ['真正冰溫熱，內建 RO 淨水', '氣泡另用桌上機，壞了不互相影響', '只需一個龍頭孔，維修單純'],
  water_oasis_3temp: ['冰溫熱三溫＋UVC 殺菌', '含軟水濾芯、免費安裝', '氣泡另配桌上機，最省'],
  soft_bwt_bewamat75a: ['德國製，省鹽 57%、省水 49%', '可調軟硬度、停電記憶', '適合 3 間衛浴以上的大家庭'],
  soft_3m_sft200: ['每小時 2 噸，全屋都夠用', '免濾芯只要加鹽、NSF 認證', '官方旗艦店含前置過濾'],
  soft_3m_sft150: ['2–3 人家庭剛好', '免濾芯，加鹽就好', '含前置反洗，價格最低'],
  toilet_neorest_rs_ces83410gtw: ['自動掀蓋、自動沖水', '電解除菌水，常保清潔', '一體成型最俐落'],
  washlet_s7_tcf47160gtw: ['瞬熱式，隨時有溫水', '便座壞了只換便座，維修便宜', '搭 CW769CTW，管距 305–400mm'],
  washlet_s5_tcf34461gtw: ['S5 無線遙控＋暖風烘乾', 'S2 更省，功能也夠用', '分離式最省錢、最好維修'],
  heater_mitsubishi_v251bztwn: ['日本製，3D 擺葉送風均勻', 'IPX7 防水無線遙控', '暖／涼／乾／換氣四合一'],
  heater_panasonic_fv40buy1w: ['陶瓷加熱，暖得快', '有線線控，濕手也好按', '五重安全保護'],
  heater_delta_vhb30bcmrta: ['DC 馬達省電又安靜', '有線／無線兩種可選', '3 年保固，價格最實惠'],
  tv_lg_86qned86ata: ['86 吋 miniLED，白天客廳也夠亮', '144Hz 畫面順暢', '不會烙印，耐看'],
  tv_lg_oled77g5pta: ['OLED 黑得徹底、對比最好', '2026 新款 G6 抗反光面板', 'OLED 面板 5 年保固'],
  tv_lg_75qned9mata: ['真無線：電視只接一條電源線', 'miniLED 高亮', '牆面不用拉線最乾淨'],
  tv_lg_oled77c5pta: ['OLED 畫質、120Hz', 'PChome 含壁掛架，CP 值高', '適合可控光的客廳'],
  tv_lg_75qned86ata: ['miniLED 高亮、144Hz', '強光客廳首選', '多通路清庫存，要買要快'],
  tv_lg_75qned82ata: ['75 吋最便宜的 LG 選擇', 'MOMO 含標準安裝', '有現貨'],
  sb_lg_s95tr: ['9.1.5 聲道，有實體後環繞', '搭 LG 電視可一起發聲', '挑高客廳也有包圍感'],
  sb_lg_s90tr: ['5.1.3 聲道＋無線後環繞', '比 S95TR 省約 1 萬', '兩平台都剩少量庫存'],
  sb_lg_s70ty: ['5.1.1 入門款', '價格最低', '沒有後環繞'],
  sb_samsung_q990f: ['11.1.4 聲道數最多', '有實體後環繞', '但沒有 LG 電視整合功能'],
  robot_roborock_saros20: ['內建自動上下水，不用換水', '100°C 熱水洗拖布', '7.95cm 超薄、越障 8.8cm'],
  robot_dreame_x50ultra: ['機械輪足，跨門檻能力強', '上下水模組另購', '全通路缺貨，建議改看 X60'],
  robot_roborock_qrevo_water: ['自動上下水裡最省的選擇', '60°C 熱水洗、機械手臂', '官網售完為止'],
  lock_hitachi_hitfy10t: ['3D 人臉＋掌靜脈＋指紋七合一', '300 萬畫素夜視貓眼', 'IP54、3 年保固、含安裝'],
  lock_yale_lunaproplus: ['3D 人臉急速辨識', '防夾手、含原廠安裝', '門厚 35–100mm 都能裝'],
  lock_philips_ddl709fvp: ['人臉＋貓眼＋遠端視訊對講', '4 吋室內螢幕', '含安裝、3 年保固'],
  lock_lockin_v5max: ['人臉＋掌靜脈，雨天不用摸', '2K 貓眼、可串 HomeKit', '官網最便宜，但安裝另洽']
};
const PICK = {
  dishwasher: ['dw_bosch_8series_60', '常煮大鍋菜，60cm 下掀式才放得下炒鍋；Bosch 台灣機種 110V 免改電'],
  water_dispenser: ['water_modular_3temp_soda', '真正冰溫熱＋獨立氣泡機，故障互不影響、維修單純'],
  toilet: ['washlet_s5_tcf34461gtw', '分離式最省、壞了只換便座'],
  bath_heater: ['heater_delta_vhb30bcmrta', '220V＋有線線控，CP 值最高'],
  soundbar: ['sb_lg_s95tr', '有實體後環繞，挑高客廳更有感；搭 LG 電視可整合'],
  robot_vacuum: ['robot_roborock_saros20', '內建自動上下水，三通路都有現貨'],
  oven: ['oven_toa95tw', '有現貨、有電子探針；TOA-110TW 通路買不到'],
  softener: ['soft_3m_sft150', '一般家庭夠用、價格最低、含前置過濾']
};
const CMP = { water_modular_3temp_soda: '賀眾 UR-3902AW-1', washlet_s7_tcf47160gtw: 'TOTO TCF47160GTW', washlet_s5_tcf34461gtw: 'TOTO TCF34461GTW', heater_delta_vhb30bcmrta: '台達 VHB30BCMRT-A', dw_bosch_8series_60: 'Bosch SMV8ZCX00X', dw_bosch_6series_60: 'Bosch SMV6ZAX00X', dw_miele_g7000_60: 'Miele G7114C SCi', dw_electrolux_60: 'Electrolux KEE47200IW', tv_lg_oled77g5pta: 'LG OLED77G6PTA', sb_lg_s90tr: 'LG S80TR', sb_lg_s70ty: 'LG S70TR', robot_roborock_saros20: 'Roborock Saros 20 水立方', robot_roborock_qrevo_water: 'Roborock Qrevo Pro 水立方', lock_hitachi_hitfy10t: 'HITACHI HIT-FY10-T', lock_yale_lunaproplus: 'Yale Luna Pro+', lock_philips_ddl709fvp: 'Philips DDL709-FVP', lock_lockin_v5max: 'Lockin V5 Max', water_oasis_3temp: 'OASIS LUXES-COLD-301', water_oasis_fizz401: 'OASIS LUXES-FIZZ-401', soft_bwt_bewamat75a: 'BWT Bewamat 75A', soft_3m_sft200: '3M SFT-200', soft_3m_sft150: '3M SFT-150', toilet_neorest_rs_ces83410gtw: 'TOTO CES83410GTW', heater_mitsubishi_v251bztwn: '三菱 V-251BZ-TWN', heater_panasonic_fv40buy1w: 'Panasonic FV-40BUY1W' };
let n = 0;
s.items.forEach(it => {
  it.options.forEach(o => { if (H[o.id]) { o.highlights = H[o.id]; n++; } o.cmpKeyword = CMP[o.id] || (o.brand.split(/[ ／]/)[0] + ' ' + o.model.split(/[（(／＋]/)[0]).trim(); });
  if (PICK[it.id]) { it.pickOptionId = PICK[it.id][0]; it.pickReason = PICK[it.id][1]; } else { it.pickOptionId = null; it.pickReason = ''; }
  it.notes = []; it.requests = []; it.todos.forEach(t => { t.done = false; delete t.doneBy; delete t.doneAt; });
});
s.prep.forEach(x => { x.done = false; delete x.doneBy; delete x.doneAt; });
s.profiles = {
  family: { id: 'family', label: '家人', who: '負責選擇與採購', desc: '看得到價格、購買連結與比價，可以選方案、打勾、留言。', show: { price: true, links: true, options: true, install: true, dims: true, notes: true, todos: true, advice: true, prep: true }, edit: true },
  designer: { id: 'designer', label: '設計師', who: '整合設計與水電需求', desc: '尺寸、開孔、電壓迴路、給排水、排風與全屋前置工程；不顯示價格與購買連結。', show: { price: false, links: false, options: true, install: true, dims: true, notes: false, todos: false, advice: true, prep: true }, edit: false }
};
s.history = []; s.todos = [];
s.rev = 10; s.updatedAt = '2026-08-22T21:00:00+08:00';
s.meta.shareUrl = 'https://kenhuangads.github.io/homechecklist/';
s.meta.priceNote = '價格以 MOMO、PChome 24h 現價為準（2026/8/22 逐一實查；PChome 價格每天自動更新），下單前請再點進去確認。';
delete s.historyTrimmedAt;
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log('highlights set', n, '| picks', Object.keys(PICK).length, '| rev', s.rev, '| bytes', JSON.stringify(s).length);
