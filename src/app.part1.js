/* ===================== Part 1: core, reducer, history, cloud sync (Google Sheets) ===================== */
'use strict';
const APP_VERSION = '2.0.0';
const KEYS = { me: 'hc_me', role: 'hc_role', font: 'hc_font', backup: 'hc_backup', pending: 'hc_pending', route: 'hc_route', sheet: 'hc_sheet', api: 'hc_api', code: 'hc_code', tut: 'hc_tut_done' };
const STATUS = {
  choosing:  { label: '考慮中', hint: '還在比較' },
  decided:   { label: '已決定', hint: '型號選好了' },
  bought:    { label: '已購買', hint: '已經下單' },
  installed: { label: '已安裝', hint: '裝好了' },
  skipped:   { label: '不需要', hint: '' }
};
const SOURCE_LABEL = { momo: 'MOMO', pchome: 'PChome', official: '官網', other: '經銷商', family: '家人回報', search: '搜尋' };
const TAG_ORDER = ['電', '水', '排水', '排風', '尺寸', '搬運', '木作', '其他'];
const ROOM_TILE = { kitchen: 'r-kitchen', water: 'r-water', bath: 'r-bath', living: 'r-living', entry: 'r-entry' };

/* ---------- DOM builder ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
const ICON_PATHS = {
  list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  todo: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3.5 3.5L17 8"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="15.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  check: '<path d="m5 12 5 5L20 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  print: '<path d="M7 8V3h10v5M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3"/><rect x="7" y="14" width="10" height="7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  warn: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 0 2 2h13"/><path d="M9 7h6"/>',
  // item icons
  hood: '<path d="M4 13h16l-3-6H7l-3 6z"/><path d="M4 13v3h16v-3"/><path d="M9 20h6"/>',
  ih: '<rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="9" cy="13" r="2.5"/><circle cx="15" cy="13" r="2.5"/>',
  oven: '<rect x="3" y="5" width="18" height="15" rx="2"/><rect x="6" y="10" width="12" height="7" rx="1"/><path d="M7 7.5h.01M10 7.5h.01"/>',
  microwave: '<rect x="3" y="6" width="18" height="13" rx="2"/><rect x="6" y="9" width="9" height="7" rx="1"/><path d="M18 9v1M18 12v1"/>',
  freezer: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12"/><path d="M15 6v2M15 13v3"/>',
  dishwasher: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><circle cx="12" cy="15" r="3"/><path d="M6 6.5h.01M9 6.5h.01"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>',
  softener: '<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M7 9h10M7 15h10"/><path d="M4 21h16"/>',
  toilet: '<path d="M7 3h8v7H7z"/><path d="M5 10h14a7 7 0 0 1-7 7H9l-1 4H7l-1-4A7 7 0 0 1 5 10z"/>',
  heater: '<circle cx="12" cy="12" r="8"/><path d="M12 12 9 7M12 12l5 2M12 12l-3 5"/>',
  tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  soundbar: '<rect x="2" y="10" width="20" height="5" rx="2.5"/><path d="M6 5c1.5 1.5 1.5 3.5 0 5M18 5c-1.5 1.5-1.5 3.5 0 5"/><path d="M6 19h12"/>',
  robot: '<circle cx="12" cy="11" r="8"/><circle cx="12" cy="11" r="2.5"/><path d="M4 21h16"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.5"/>'
};
const ITEM_ICON = { hood: 'hood', ih: 'ih', oven: 'oven', microwave: 'microwave', freezer: 'freezer', dishwasher: 'dishwasher', water_dispenser: 'water', softener: 'softener', toilet: 'toilet', bath_heater: 'heater', tv: 'tv', soundbar: 'soundbar', robot_vacuum: 'robot', door_lock: 'lock' };
function icon(name, cls) {
  const span = h('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', style: 'display:inline-flex' });
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="1.25em" height="1.25em">${ICON_PATHS[name] || ''}</svg>`;
  return span;
}
function tile(itemOrId) { const it = typeof itemOrId === 'string' ? item(itemOrId) : itemOrId; return h('span', { class: 'tile ' + (ROOM_TILE[it.roomId] || 'r-entry') }, icon(ITEM_ICON[it.id] || 'list')); }

/* ---------- utils ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const nowIso = () => new Date().toISOString();
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const sstore = {
  get(k, d = null) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} }
};
function fmtMoney(n) { return 'NT$' + Math.round(n).toLocaleString('en-US'); }
function priceText(p) {
  if (!p) return '價格待查';
  if (typeof p.amount === 'number') return fmtMoney(p.amount);
  if (typeof p.min === 'number' && typeof p.max === 'number') return p.min === p.max ? fmtMoney(p.min) : `約 ${fmtMoney(p.min)}–${Math.round(p.max).toLocaleString('en-US')}`;
  if (typeof p.min === 'number') return `約 ${fmtMoney(p.min)} 起`;
  return '價格待查';
}
function priceValue(p) { if (!p) return null; if (typeof p.amount === 'number') return p.amount; if (typeof p.min === 'number') return p.min; return null; }
const TZ = 'Asia/Taipei';
function fmtTime(iso, withYear) {
  try { const opt = { timeZone: TZ, month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }; if (withYear) opt.year = 'numeric'; return new Intl.DateTimeFormat('zh-TW', opt).format(new Date(iso)); } catch { return iso; }
}
function fmtDate(iso) { try { return new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(iso)); } catch { return iso; } }
function fmtDateShort(iso) { try { return new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, month: 'numeric', day: 'numeric' }).format(new Date(iso)); } catch { return iso; } }
function todayIso() { return new Date().toISOString().slice(0, 10); }
let DEVICE_MODEL = '';
function deviceId() {
  let id = store.get('hc_dev');
  if (!id) { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; id = ''; for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)]; store.set('hc_dev', id); }
  return id;
}
function iphoneSizeClass() {
  const w = Math.min(screen.width, screen.height), hgt = Math.max(screen.width, screen.height);
  const map = { '375x667': '4.7 吋', '414x736': '5.5 吋', '375x812': '5.4／5.8 吋', '390x844': '6.1 吋', '393x852': '6.1 吋', '402x874': '6.3 吋', '414x896': '6.1／6.5 吋', '428x926': '6.7 吋', '430x932': '6.7 吋', '440x956': '6.9 吋' };
  return map[w + 'x' + hgt] || '';
}
function refineDeviceModel() {
  try { if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']).then(v => { if (v && v.model) DEVICE_MODEL = v.model; }).catch(() => {}); } catch {}
}
function deviceLabel() {
  const ua = navigator.userAgent || '';
  let dev = '電腦', os = '', model = DEVICE_MODEL;
  const iosV = ua.match(/OS (\d+)[_.](\d+)/);
  if (/iPhone/.test(ua)) { dev = 'iPhone'; os = iosV ? `iOS ${iosV[1]}.${iosV[2]}` : ''; model = model || iphoneSizeClass(); }
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) { dev = 'iPad'; os = iosV ? `iPadOS ${iosV[1]}.${iosV[2]}` : ''; }
  else if (/Android/.test(ua)) { dev = /Mobile/.test(ua) ? 'Android 手機' : 'Android 平板'; const m = ua.match(/Android ([\d.]+)(?:; ([^;)]+))?/); if (m) { os = 'Android ' + m[1].split('.')[0]; const raw = (m[2] || '').replace(/ Build.*/, '').trim(); if (!model && raw && !/^[a-z]{2}(-[a-z]{2})?$/i.test(raw) && !/^wv$/i.test(raw)) model = raw; } }
  else if (/Macintosh/.test(ua)) { dev = 'Mac 電腦'; const m = ua.match(/Mac OS X (\d+)[_.](\d+)/); if (m) os = `macOS ${m[1]}.${m[2]}`; }
  else if (/Windows/.test(ua)) { dev = 'Windows 電腦'; const m = ua.match(/Windows NT ([\d.]+)/); if (m) os = 'Windows ' + (m[1] === '10.0' ? '10／11' : m[1]); }
  let br = '';
  if (/Line\//i.test(ua)) br = 'LINE'; else if (/FBAN|FBAV/.test(ua)) br = 'Facebook'; else if (/Edg\//.test(ua)) br = 'Edge'; else if (/CriOS/.test(ua)) br = 'Chrome'; else if (/Chrome\//.test(ua)) br = 'Chrome'; else if (/Safari\//.test(ua)) br = 'Safari'; else if (/Firefox\//.test(ua)) br = 'Firefox';
  return [dev + (model ? `（${model}）` : ''), os, br, '#' + deviceId()].filter(Boolean).join('・');
}
function deviceName() { return (me && me.deviceName) ? `${me.deviceName}・#${deviceId()}` : deviceLabel(); }
function parseProductUrl(raw) {
  const s = (raw || '').trim(); if (!s) return null;
  let url; try { url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (/(^|\.)momoshop\.com\.tw$/.test(host) || /(^|\.)momo\.dm$/.test(host)) {
    const code = url.searchParams.get('i_code');
    if (code) return { type: 'momo', url: `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${encodeURIComponent(code)}`, id: code };
    const m = url.pathname.match(/goodsDetail\/(TP\w+)/i); return { type: 'momo', url: url.href, id: m ? m[1] : '' };
  }
  if (/(^|\.)pchome\.com\.tw$/.test(host)) {
    const m = url.pathname.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i);
    if (m) return { type: 'pchome', url: `https://24h.pchome.com.tw/prod/${m[1].toUpperCase()}`, id: m[1].toUpperCase() };
    return { type: 'pchome', url: url.href, id: '' };
  }
  return { type: 'other', url: url.href, id: '', label: host.replace(/^www\./, '') };
}
const searchUrls = kw => ({ momo: `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(kw)}`, pchome: `https://24h.pchome.com.tw/search/?q=${encodeURIComponent(kw)}` });
const compareUrls = kw => ({ feebee: `https://feebee.com.tw/s/?q=${encodeURIComponent(kw)}`, biggo: `https://biggo.com.tw/s/${encodeURIComponent(kw)}/` });
const PRICE_RE = /NT\$|\d\s*萬|[\d,]{3,}\s*元|\d{1,3}(,\d{3})+/;
const PURCHASE_RE = /價|便宜|省|現貨|缺貨|下架|售完|詢價|買|CP|MOMO|PChome|通路|賣場|官網|經銷|保固|免費|安裝費|報告|實查|下單|庫存|促銷|限時/;
function stripPriceSentences(text) { if (!text) return ''; return text.split(/(?<=[。；;])|(?=——)/).filter(seg => !PRICE_RE.test(seg) && !PURCHASE_RE.test(seg)).map((seg, i) => i === 0 ? seg.replace(/^——/, '') : seg).join('').trim(); }

/* ---------- app state ---------- */
let state = null;
let me = store.get(KEYS.me);
const DESIGNER_PARAM = (() => { try { return new URLSearchParams(location.search).get('d'); } catch { return null; } })();
let role = DESIGNER_PARAM ? 'designer' : 'family';
let route = { screen: 'tab', tab: 'list', itemId: null, preview: false };
let saveState = { s: 'idle', msg: '' };
let pending = store.get(KEYS.pending, []);
let saveTimer = null, saving = false, dirtyAgain = false, saveDelay = 1500, toastTimer = null;
let prices = null;
const API = { url: '', code: store.get(KEYS.code, ''), configured: false };
let syncedRev = 0, remoteStatus = 'unknown', lastSyncAt = null, lastPollAt = 0;

const item = id => state.items.find(i => i.id === id);
const room = id => state.rooms.find(r => r.id === id);
const chosenOption = it => it.chosenOptionId ? it.options.find(o => o.id === it.chosenOptionId) : null;
const profileOf = id => state.profiles[id] || state.profiles.family;
function canEdit() { return role === 'family'; }
function knownNames() { const names = new Set(); (state.history || []).forEach(e => e.who && names.add(e.who)); state.items.forEach(it => (it.notes || []).forEach(n => n.who && names.add(n.who))); return [...names]; }

/* live (daily) prices overlay from prices.json */
function livePrice(o) {
  if (!prices || !prices.pchome) return null;
  const l = (o.links || []).find(x => x.type === 'pchome'); if (!l) return null;
  const m = l.url.match(/\/prod\/([A-Z0-9]+-[A-Z0-9]+)/i); if (!m) return null;
  const p = prices.pchome[m[1].toUpperCase()]; if (!p || typeof p.low !== 'number') return null;
  return { amount: p.low, list: p.list, qty: p.qty, button: p.button, checkedAt: prices.checkedAt };
}
function effectivePrice(o) {
  const lp = livePrice(o);
  if (lp && lp.qty > 0 && lp.amount > 0) return { amount: lp.amount, min: lp.amount, max: lp.amount, source: 'pchome', checkedAt: lp.checkedAt, live: true, note: o.price && o.price.note };
  return o.price;
}

/* ---------- entity paths ---------- */
function listFor(path) {
  if (path.kind === 'todo' && !path.itemId) { state.todos = state.todos || []; return state.todos; }
  const it = item(path.itemId); if (!it) return null;
  const key = { option: 'options', note: 'notes', todo: 'todos', request: 'requests' }[path.kind];
  it[key] = it[key] || []; return it[key];
}
const ITEM_SCALARS = ['status', 'chosenOptionId', 'name', 'short', 'hardReq', 'advice'];
function getEntity(path) {
  switch (path.kind) {
    case 'item': { const it = item(path.id); if (!it) return null; const o = {}; ITEM_SCALARS.forEach(k => o[k] = it[k] === undefined ? null : it[k]); return o; }
    case 'option': case 'note': case 'todo': case 'request': { const l = listFor(path); const e = l && l.find(x => x.id === path.id); return e ? clone(e) : null; }
    case 'prep': { const p = state.prep.find(x => x.id === path.id); return p ? clone(p) : null; }
    case 'profile': return state.profiles[path.id] ? clone(state.profiles[path.id]) : null;
    case 'meta': return clone(state.meta);
  }
  return null;
}
function setEntity(path, value) {
  switch (path.kind) {
    case 'item': { const it = item(path.id); if (!it || !value) return; ITEM_SCALARS.forEach(k => { if (k in value) it[k] = value[k]; }); return; }
    case 'option': case 'note': case 'todo': case 'request': {
      const l = listFor(path); if (!l) return; const idx = l.findIndex(x => x.id === path.id);
      if (value == null) { if (idx >= 0) l.splice(idx, 1); } else if (idx >= 0) l[idx] = clone(value); else l.push(clone(value)); return;
    }
    case 'prep': { const idx = state.prep.findIndex(x => x.id === path.id); if (value == null) { if (idx >= 0) state.prep.splice(idx, 1); } else if (idx >= 0) state.prep[idx] = clone(value); else state.prep.push(clone(value)); return; }
    case 'profile': if (value) state.profiles[path.id] = clone(value); return;
    case 'meta': if (value) state.meta = clone(value); return;
  }
}

/* ---------- reducer ---------- */
function reduce(action) {
  const a = action;
  const ch = (path, fn) => { const before = getEntity(path); fn(); const after = getEntity(path); return { path, before, after }; };
  switch (a.type) {
    case 'setStatus': { const it = item(a.itemId); if (!it) return null; const c = ch({ kind: 'item', id: it.id }, () => { it.status = a.status; }); return { changes: [c], summary: `把「${it.name}」改為「${STATUS[a.status].label}」` }; }
    case 'choose': {
      const it = item(a.itemId); if (!it) return null; const opt = a.optionId ? it.options.find(o => o.id === a.optionId) : null;
      const c = ch({ kind: 'item', id: it.id }, () => { it.chosenOptionId = opt ? opt.id : null; if (opt && it.status === 'choosing') it.status = 'decided'; if (!opt && it.status === 'decided') it.status = 'choosing'; });
      return { changes: [c], summary: opt ? `「${it.name}」選了 ${opt.brand} ${opt.model}` : `取消「${it.name}」的選擇` };
    }
    case 'addOption': { const it = item(a.itemId); if (!it || it.options.some(o => o.id === a.option.id)) return null; const c = ch({ kind: 'option', itemId: it.id, id: a.option.id }, () => { it.options.push(clone(a.option)); }); return { changes: [c], summary: `在「${it.name}」新增商品 ${a.option.model}` }; }
    case 'updateOption': { const it = item(a.itemId); if (!it) return null; const opt = it.options.find(o => o.id === a.optionId); if (!opt) return null; const c = ch({ kind: 'option', itemId: it.id, id: opt.id }, () => { Object.assign(opt, clone(a.patch)); }); return { changes: [c], summary: a.summary || `更新「${it.name}」${opt.model} 的資料` }; }
    case 'removeOption': { const it = item(a.itemId); if (!it) return null; const opt = it.options.find(o => o.id === a.optionId); if (!opt) return null; const c = ch({ kind: 'option', itemId: it.id, id: opt.id }, () => { it.options = it.options.filter(o => o.id !== opt.id); if (it.chosenOptionId === opt.id) it.chosenOptionId = null; }); return { changes: [c], summary: `從「${it.name}」移除商品 ${opt.model}` }; }
    case 'addNote': { const it = item(a.itemId); if (!it) return null; it.notes = it.notes || []; if (it.notes.some(n => n.id === a.note.id)) return null; const c = ch({ kind: 'note', itemId: it.id, id: a.note.id }, () => { it.notes.push(clone(a.note)); }); return { changes: [c], summary: `在「${it.name}」留言：${a.note.text.slice(0, 30)}${a.note.text.length > 30 ? '…' : ''}` }; }
    case 'removeNote': { const it = item(a.itemId); if (!it) return null; const c = ch({ kind: 'note', itemId: it.id, id: a.noteId }, () => { it.notes = (it.notes || []).filter(n => n.id !== a.noteId); }); if (!c.before) return null; return { changes: [c], summary: `刪除「${it.name}」的一則留言` }; }
    case 'addTodo': { const path = { kind: 'todo', itemId: a.itemId || null, id: a.todo.id }; const l = listFor(path); if (!l || l.some(t => t.id === a.todo.id)) return null; const c = ch(path, () => { l.push(clone(a.todo)); }); return { changes: [c], summary: `新增待辦：${a.todo.text}` }; }
    case 'toggleTodo': { const path = { kind: 'todo', itemId: a.itemId || null, id: a.todoId }; const l = listFor(path); const t = l && l.find(x => x.id === a.todoId); if (!t) return null; const c = ch(path, () => { t.done = !!a.done; if (a.done) { t.doneBy = a._ctx.who; t.doneAt = a._ctx.ts; } else { delete t.doneBy; delete t.doneAt; } }); return { changes: [c], summary: `${a.done ? '完成' : '取消完成'}待辦：${t.text}` }; }
    case 'removeTodo': { const path = { kind: 'todo', itemId: a.itemId || null, id: a.todoId }; const l = listFor(path); const t = l && l.find(x => x.id === a.todoId); if (!t) return null; const c = ch(path, () => { l.splice(l.indexOf(t), 1); }); return { changes: [c], summary: `刪除待辦：${t.text}` }; }
    case 'addRequest': { const it = item(a.itemId); if (!it) return null; it.requests = it.requests || []; if (it.requests.some(r => r.id === a.request.id)) return null; const c = ch({ kind: 'request', itemId: it.id, id: a.request.id }, () => { it.requests.push(clone(a.request)); }); return { changes: [c], summary: `請 Claude 查「${it.name}」：${a.request.query || a.request.url}` }; }
    case 'updateRequest': { const it = item(a.itemId); if (!it) return null; const r = (it.requests || []).find(x => x.id === a.requestId); if (!r) return null; const c = ch({ kind: 'request', itemId: it.id, id: r.id }, () => { Object.assign(r, clone(a.patch)); }); return { changes: [c], summary: a.patch.status === 'done' ? `標記查詢已處理：${r.query || r.url}` : `更新查詢：${r.query || r.url}` }; }
    case 'togglePrep': { const p = state.prep.find(x => x.id === a.prepId); if (!p) return null; const c = ch({ kind: 'prep', id: p.id }, () => { p.done = !!a.done; if (a.done) { p.doneBy = a._ctx.who; p.doneAt = a._ctx.ts; } else { delete p.doneBy; delete p.doneAt; } }); return { changes: [c], summary: `${a.done ? '完成' : '取消完成'}前置工程：${p.text.slice(0, 24)}…` }; }
    case 'setProfile': { const p = state.profiles[a.profileId]; if (!p) return null; const c = ch({ kind: 'profile', id: p.id }, () => { if (a.patch.show) Object.assign(p.show, a.patch.show); if ('desc' in a.patch) p.desc = a.patch.desc; }); return { changes: [c], summary: `調整「${p.label}」看到的內容` }; }
    case 'setMeta': { const c = ch({ kind: 'meta' }, () => { Object.assign(state.meta, clone(a.patch)); }); return { changes: [c], summary: a.summary || '更新基本設定' }; }
    case 'restore': { const src = state.history.find(e => e.id === a.entryId); if (!src) return null; const changes = []; [...src.changes].reverse().forEach(cg => { changes.push(ch(cg.path, () => setEntity(cg.path, cg.before))); }); return { changes, summary: `還原了「${src.summary}」`, restore: true }; }
    case 'restoreTo': {
      const idx = state.history.findIndex(e => e.id === a.entryId); if (idx < 0) return null;
      const targets = state.history.slice(idx); const changes = [];
      for (let i = targets.length - 1; i >= 0; i--) [...targets[i].changes].reverse().forEach(cg => { changes.push(ch(cg.path, () => setEntity(cg.path, cg.before))); });
      return { changes, summary: `回到 ${fmtTime(state.history[idx].ts, true)} 之前的狀態（復原 ${targets.length} 筆修改）`, restore: true };
    }
    case 'replaceState': {
      // whole-state replacement from a cloud snapshot: record as one entry (before = previous state summary)
      return { changes: [], summary: a.summary || '以雲端快照覆蓋', restore: true };
    }
  }
  return null;
}

function dispatch(action, opts = {}) {
  if (!state) return null;
  if (!canEdit() && !opts.force) { toast('目前是檢視模式，無法修改'); return null; }
  action._ctx = action._ctx || { id: uid(), ts: nowIso(), who: (me && me.name) || '未具名', device: deviceName() };
  const res = reduce(action); if (!res) return null;
  const entry = { id: action._ctx.id, ts: action._ctx.ts, who: action._ctx.who, device: action._ctx.device, type: action.type, summary: res.summary, changes: res.changes, restore: !!res.restore };
  state.history.push(entry);
  if (state.history.length > 800) { state.history.splice(0, state.history.length - 600); state.historyTrimmedAt = nowIso(); }
  state.rev = (state.rev || 0) + 1; state.updatedAt = entry.ts;
  if (!opts.replay) { pending.push(action); store.set(KEYS.pending, pending); }
  store.set(KEYS.backup, { savedAt: nowIso(), state });
  if (!opts.replay) scheduleSave();
  if (!opts.silent) render();
  return entry;
}

/* ---------- seed / normalize ---------- */
function readSeed() { try { const el = document.getElementById('hc-seed'); return el ? JSON.parse(el.textContent) : null; } catch (e) { console.error('seed parse', e); return null; } }
function normalize(s) {
  s.history = s.history || []; s.todos = s.todos || []; s.prep = s.prep || []; s.meta = s.meta || {}; s.profiles = s.profiles || {};
  s.items.forEach(it => { it.options = it.options || []; it.notes = it.notes || []; it.todos = it.todos || []; it.requests = it.requests || []; it.install = it.install || []; it.warnings = it.warnings || []; it.costNotes = it.costNotes || []; });
  return s;
}
const CATALOG_ITEM_FIELDS = ['name', 'short', 'hardReq', 'advice', 'warnings', 'install', 'costNotes', 'pickOptionId', 'pickReason', 'roomId'];
const CATALOG_OPTION_FIELDS = ['key', 'tier', 'brand', 'model', 'name', 'highlights', 'dims', 'cutout', 'power', 'weight', 'other', 'price', 'links', 'availability', 'storeName', 'researchNote', 'checkedAt', 'cmpKeyword'];
function mergeCatalog(remote, seed) {
  remote.meta = Object.assign({}, remote.meta, seed.meta); remote.profiles = clone(seed.profiles); remote.rooms = clone(seed.rooms); remote.budget = clone(seed.budget);
  seed.items.forEach(si => {
    let ri = remote.items.find(i => i.id === si.id);
    if (!ri) { remote.items.push(clone(si)); return; }
    CATALOG_ITEM_FIELDS.forEach(k => { if (si[k] !== undefined) ri[k] = clone(si[k]); });
    si.options.forEach(so => { const ro = ri.options.find(o => o.id === so.id); if (ro) CATALOG_OPTION_FIELDS.forEach(k => { if (so[k] !== undefined) ro[k] = clone(so[k]); }); else ri.options.push(clone(so)); });
    ri.options = ri.options.filter(o => o.tier === '家人推薦' || si.options.some(so => so.id === o.id));
    if (ri.chosenOptionId && !ri.options.some(o => o.id === ri.chosenOptionId)) ri.chosenOptionId = null;
    si.todos.forEach(st => { if (!ri.todos.some(t => t.id === st.id)) ri.todos.push(clone(st)); });
  });
  seed.prep.forEach(sp => { const rp = remote.prep.find(p => p.id === sp.id); if (rp) { rp.text = sp.text; rp.group = sp.group; rp.trade = sp.trade; } else remote.prep.push(clone(sp)); });
  remote.catalogVersion = seed.catalogVersion;
}

/* ---------- cloud sync (Google Apps Script) ---------- */
async function loadConfig() {
  const override = (store.get(KEYS.api, '') || '').trim();
  let cfg = {};
  try { const r = await fetch('config.json?ts=' + Date.now(), { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch {}
  API.url = (override || cfg.apiUrl || '').trim(); API.configured = !!API.url;
}
function mockApi(p) {
  const db = store.get('hc_mock_db', { state: null });
  if (p.action === 'ping') return { ok: true };
  if (p.action === 'load') return { ok: true, state: db.state, rev: db.state ? db.state.rev : 0 };
  if (p.action === 'save') {
    const cur = db.state ? db.state.rev : 0;
    if (db.state && Number(p.baseRev) !== cur) return { ok: false, conflict: true, rev: cur, state: db.state };
    const need = localStorage.getItem('hc_mock_code'); if (need && String(p.code || '') !== need) return { ok: false, error: 'code_required' };
    db.state = p.state; store.set('hc_mock_db', db); return { ok: true, rev: p.state.rev };
  }
  if (p.action === 'snapshots') return { ok: true, snapshots: db.state ? [{ rev: db.state.rev, at: db.state.updatedAt, size: 1 }] : [] };
  if (p.action === 'snapshot') return db.state ? { ok: true, state: db.state } : { ok: false, error: 'not_found' };
  return { ok: false, error: 'unknown_action' };
}
async function apiCall(params, body) {
  if (API.url === 'mock') { await new Promise(r => setTimeout(r, 150)); return mockApi(Object.assign({}, params, body || {})); }
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    let r;
    if (body) r = await fetch(API.url, { method: 'POST', body: JSON.stringify(Object.assign({}, params, body)), redirect: 'follow', signal: ctrl.signal });
    else { const u = new URL(API.url); Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v)); u.searchParams.set('ts', Date.now()); r = await fetch(u.toString(), { method: 'GET', redirect: 'follow', cache: 'no-store', signal: ctrl.signal }); }
    return await r.json();
  } finally { clearTimeout(t); }
}
function setSave(s, msg) {
  saveState = { s, msg: msg || '' };
  const el = $('#saveState'); if (el) renderSaveState(el);
  if (s === 'saved' || s === 'saving') document.querySelectorAll('.pending-banner').forEach(b => b.remove());
  if (s === 'error' || s === 'local') { const host = $('main.content'); if (host && !$('.pending-banner') && pending.length) host.prepend(pendingBanner()); }
}
function scheduleSave() { if (!canEdit()) return; clearTimeout(saveTimer); setSave('saving', '儲存中…'); saveTimer = setTimeout(saveNow, saveDelay); }
function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; saveNow(); } }
function retrySoon(ms) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, ms + Math.random() * 1500); }
async function saveNow() {
  if (!state || !canEdit()) return;
  if (!API.configured) { setSave('local', '尚未連線雲端，修改先留在這台裝置'); return; }
  if (saving) { dirtyAgain = true; return; }
  saving = true; setSave('saving', '儲存中…');
  try {
    const entries = state.history.filter(e => pending.some(a => a._ctx && a._ctx.id === e.id));
    const res = await apiCall({ action: 'save' }, { state, baseRev: syncedRev, code: API.code, entries, who: me && me.name, device: deviceName() });
    if (res && res.ok) { syncedRev = res.rev; state.rev = res.rev; pending = []; store.set(KEYS.pending, pending); lastSyncAt = nowIso(); remoteStatus = 'ok'; setSave('saved', '已儲存到雲端 ' + fmtTime(lastSyncAt)); }
    else if (res && res.conflict) { adoptRemote(res.state, { initial: false, quiet: true }); dirtyAgain = pending.length > 0; if (!dirtyAgain) setSave('saved', '已同步'); }
    else if (res && res.error === 'code_required') { setSave('error', '需要家庭代碼才能存到雲端'); askFamilyCode(); }
    else if (res && res.error === 'busy') { setSave('saving', '雲端忙碌中，稍後再試'); retrySoon(3000); }
    else { setSave('error', '雲端回應錯誤：' + ((res && (res.error || res.message)) || '未知')); retrySoon(8000); }
  } catch (e) { remoteStatus = 'offline'; setSave('error', '連不上雲端，稍後會自動再試'); retrySoon(6000); }
  finally { saving = false; if (dirtyAgain) { dirtyAgain = false; scheduleSave(); } }
}
function adoptRemote(remote, { initial, quiet } = {}) {
  remote = normalize(clone(remote));
  const seed = readSeed();
  let upgraded = false;
  if (seed && (seed.catalogVersion || 0) > (remote.catalogVersion || 0)) { mergeCatalog(remote, seed); upgraded = true; }
  const newEntries = state ? remote.history.filter(e => !state.history.some(x => x.id === e.id)) : [];
  const todo = pending.filter(a => a._ctx && !remote.history.some(e => e.id === a._ctx.id));
  state = remote; syncedRev = remote.rev; pending = [];
  todo.forEach(a => dispatch(a, { replay: true, silent: true, force: true }));
  pending = todo; store.set(KEYS.pending, pending);
  if (upgraded) { state.rev++; state.updatedAt = nowIso(); }
  store.set(KEYS.backup, { savedAt: nowIso(), state });
  render();
  if (!initial && !quiet && newEntries.length) { const last = newEntries[newEntries.length - 1]; toast(`${last.who}：${last.summary}`.slice(0, 48)); }
  if ((pending.length || upgraded) && canEdit()) scheduleSave();
}
async function syncFromRemote(initial) {
  if (!API.configured) { remoteStatus = 'noapi'; return; }
  try {
    const res = await apiCall({ action: 'load' });
    if (!res || !res.ok) throw new Error(res && res.error);
    lastSyncAt = nowIso();
    if (!res.state) { remoteStatus = 'none'; syncedRev = 0; if (canEdit()) scheduleSave(); return; }
    remoteStatus = 'ok';
    if (!state || res.state.rev !== state.rev || initial) adoptRemote(res.state, { initial: !!initial, quiet: !!initial });
  } catch (e) { remoteStatus = 'offline'; }
  const el = $('#saveState'); if (el) renderSaveState(el);
}
async function pollRemote() {
  if (!API.configured || saving || pending.length || !state) return;
  if (Date.now() - lastPollAt < 8000) return; lastPollAt = Date.now();
  try { const res = await apiCall({ action: 'load' }); if (res && res.ok) { lastSyncAt = nowIso(); remoteStatus = res.state ? 'ok' : 'none'; if (res.state && res.state.rev > state.rev) adoptRemote(res.state, { initial: false }); } } catch { remoteStatus = 'offline'; }
}
function startPolling() {
  setInterval(() => { if (document.visibilityState === 'visible') pollRemote(); }, 45000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollRemote(); else flushSave(); });
  window.addEventListener('focus', () => pollRemote());
  window.addEventListener('pagehide', () => { sstore.set(KEYS.route, route); flushSave(); });
}
async function loadPrices() { try { const r = await fetch('prices.json?ts=' + Date.now(), { cache: 'no-store' }); if (r.ok) prices = await r.json(); } catch {} }
