/* ===================== Part 3: sheets, tutorial, boot ===================== */
let currentSheet = null;
function openSheet({ title, body, actions = [], name, onClose, cls }) {
  closeSheet();
  const dlg = h('dialog', { class: 'sheet' + (cls ? ' ' + cls : '') });
  const panel = h('div', { class: 'panel' }, h('h2', {}, title));
  const content = body(panel); if (content) panel.append(content);
  const row = h('div', { class: 'btn-row' });
  actions.forEach(a => row.append(h('button', { class: 'btn ' + (a.class || ''), type: 'button', onclick: async () => { if (a.onClick) { const r = await a.onClick(panel); if (r === false) return; } closeSheet(); } }, a.label)));
  if (!actions.length) row.append(h('button', { class: 'btn', type: 'button', onclick: closeSheet }, '關閉'));
  panel.append(row); dlg.append(panel);
  dlg.addEventListener('click', e => { if (e.target === dlg) closeSheet(); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  document.body.append(dlg);
  currentSheet = { dlg, name, onClose };
  try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
  if (name) sstore.set(KEYS.sheet, { name, at: Date.now() });
  return panel;
}
function closeSheet() {
  if (!currentSheet) return;
  const { dlg, onClose } = currentSheet;
  try { dlg.close(); } catch {}
  dlg.remove(); currentSheet = null; sstore.del(KEYS.sheet);
  if (onClose) onClose();
}
function draftInput(el, key) { const saved = sstore.get('draft:' + key); if (saved != null && !el.value) el.value = saved; el.addEventListener('input', () => sstore.set('draft:' + key, el.value)); return el; }
function clearDraft(key) { sstore.del('draft:' + key); }
function confirmDialog({ title, text, ok = '確定', cancel = '取消', danger }) {
  return new Promise(resolve => { openSheet({ title, body: () => text ? h('p', { class: 'muted', style: 'white-space:pre-wrap' }, text) : null, actions: [{ label: cancel, onClick: () => { resolve(false); } }, { label: ok, class: danger ? 'danger' : 'primary', onClick: () => { resolve(true); } }], onClose: () => resolve(false) }); });
}

/* ---------- identity / code ---------- */
function openNameSheet() {
  const input = h('input', { class: 'input', value: (me && me.name) || '', maxlength: '20', placeholder: '例如：爸爸、媽媽' });
  const devInput = h('input', { class: 'input', value: (me && me.deviceName) || '', maxlength: '24', placeholder: '例如：媽媽的 iPhone（選填）' });
  openSheet({ title: '我是誰、這是哪台裝置', body: () => h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', {}, '稱呼'), input), h('div', { class: 'field' }, h('label', {}, '裝置名字'), devInput, h('p', { class: 'help' }, '偵測到：' + deviceLabel() + '。取名字後紀錄會顯示「名字・#識別碼」。'))),
    actions: [{ label: '取消' }, { label: '儲存', class: 'primary', onClick: () => { const v = input.value.trim(); if (!v) { input.focus(); return false; } me = { name: v, deviceName: devInput.value.trim() }; store.set(KEYS.me, me); render(); toast('已更新'); } }] });
  setTimeout(() => input.focus(), 50);
}
let codeSheetOpen = false;
function askFamilyCode() {
  if (codeSheetOpen) return; codeSheetOpen = true;
  const input = h('input', { class: 'input code-input', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '12', placeholder: '••••', value: API.code || '' });
  openSheet({ title: '輸入家庭代碼', body: () => h('div', { class: 'stack' }, h('p', { class: 'muted' }, '為了避免陌生人亂改，第一次修改時要輸入一次家庭代碼（請問 Ken）。這台裝置會記住，之後不用再輸入。'), h('div', { class: 'field' }, h('label', {}, '家庭代碼'), input)),
    actions: [{ label: '稍後再說', onClick: () => { codeSheetOpen = false; } }, { label: '確定', class: 'primary', onClick: () => { const v = input.value.trim(); if (!v) { input.focus(); return false; } API.code = v; store.set(KEYS.code, v); codeSheetOpen = false; toast('已記住家庭代碼'); if (pending.length) { saveDelay = 300; scheduleSave(); saveDelay = 1500; } } }], onClose: () => { codeSheetOpen = false; } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = [...document.querySelectorAll('dialog .btn.primary')].pop(); if (b) b.click(); } });
  setTimeout(() => input.focus(), 50);
}
function openDesignerMoreSheet() {
  const curFont = store.get(KEYS.font, 'std');
  openSheet({ title: '更多', body: () => h('div', { class: 'stack' },
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { closeSheet(); shareLink('designer'); } }, icon('share'), '轉傳這份需求'), h('button', { class: 'btn', type: 'button', onclick: () => { closeSheet(); showTutorial('designer'); } }, icon('book'), '說明')),
    h('div', { class: 'field' }, h('label', {}, '文字大小'), h('div', { class: 'seg' }, [['std', '標準'], ['lg', '大'], ['xl', '特大']].map(([v, l]) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(curFont === v), onclick: () => { store.set(KEYS.font, v); render(); closeSheet(); openDesignerMoreSheet(); } }, l)))),
    h('p', { class: 'tiny' }, '內容由屋主隨時更新；重新整理即可看到最新版。')),
    actions: [{ label: '關閉' }] });
}

/* ---------- todo / note / price / add product ---------- */
function openAddTodoSheet(itemId) {
  const key = 'todo:' + (itemId || 'general');
  const input = draftInput(h('input', { class: 'input', placeholder: '例如：決定要不要抽屜式', maxlength: '120' }), key);
  const sel = h('select', { class: 'input' }, h('option', { value: '' }, '不屬於特定品項'), state.items.map(i => h('option', { value: i.id, selected: i.id === itemId ? true : null }, i.name)));
  let who = 'family';
  const seg = h('div', { class: 'seg' });
  const draw = () => seg.replaceChildren(...[['family', '我們要決定'], ['designer', '給設計師／水電']].map(([v, l]) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(who === v), onclick: () => { who = v; draw(); } }, l)));
  draw();
  const submit = () => { const text = input.value.trim(); if (!text) { input.focus(); return false; } const e = dispatch({ type: 'addTodo', itemId: sel.value || null, todo: { id: uid(), text, done: false, for: who, by: me.name, ts: nowIso() } }); clearDraft(key); if (e) toast('已新增'); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { if (submit() !== false) closeSheet(); } });
  openSheet({ title: '新增待辦', name: key, body: () => h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', {}, '要做什麼？'), input), h('div', { class: 'field' }, h('label', {}, '這是誰要做的？'), seg), h('div', { class: 'field' }, h('label', {}, '屬於哪個品項'), sel)), actions: [{ label: '取消' }, { label: '新增', class: 'primary', onClick: submit }] });
  setTimeout(() => input.focus(), 50);
}
function openNoteSheet(itemId) {
  const it = item(itemId); const key = 'note:' + itemId;
  const ta = draftInput(h('textarea', { class: 'input', placeholder: '想法、問題、看到的資訊都可以寫', maxlength: '1000' }), key);
  openSheet({ title: `在「${it.name}」留言`, name: key, body: () => h('div', { class: 'field' }, h('label', {}, `${me.name} 說：`), ta),
    actions: [{ label: '取消' }, { label: '送出', class: 'primary', onClick: () => { const text = ta.value.trim(); if (!text) { ta.focus(); return false; } dispatch({ type: 'addNote', itemId, note: { id: uid(), who: me.name, ts: nowIso(), text } }); clearDraft(key); toast('已留言'); } }] });
  setTimeout(() => ta.focus(), 50);
}
function openPriceSheet(it, o) {
  const key = 'price:' + o.id;
  const price = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: '例如 21500', value: o.price && o.price.amount != null ? o.price.amount : '' });
  const link = draftInput(h('input', { class: 'input', type: 'url', inputmode: 'url', placeholder: '貼上 MOMO／PChome 商品網址（選填）' }), key + ':url');
  const hint = h('p', { class: 'help' }, '');
  link.addEventListener('input', () => { const p = parseProductUrl(link.value); hint.textContent = p ? `辨識為：${SOURCE_LABEL[p.type] || p.label || '其他'}${p.id ? '（' + p.id + '）' : ''}` : (link.value ? '看不懂這個網址，請確認' : ''); });
  const note = h('input', { class: 'input', placeholder: '備註，例如：含安裝／限時特價到 8/31（選填）', maxlength: '120' });
  openSheet({ title: `回報 ${o.model} 的價格`, name: key, body: () => h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', {}, '看到的價格（元）'), price), h('div', { class: 'field' }, h('label', {}, '商品網址'), link, hint), h('div', { class: 'field' }, h('label', {}, '備註'), note), h('p', { class: 'small muted' }, '回報後會記錄是誰、什麼時候回報的，舊價格可以在紀錄裡找到。')),
    actions: [{ label: '取消' }, { label: '更新', class: 'primary', onClick: () => {
      const v = Number(price.value); const p = parseProductUrl(link.value);
      if (!price.value && !p) { price.focus(); return false; }
      const patch = {};
      if (price.value) { if (!(v > 0)) { price.focus(); return false; } patch.price = { amount: v, min: v, max: v, source: p ? p.type : 'family', checkedAt: todayIso(), note: [note.value.trim(), `${me.name} 回報`].filter(Boolean).join('・') }; }
      if (p) { const links = (o.links || []).filter(l => l.type !== p.type && l.type !== 'search-' + p.type); links.unshift({ type: p.type, url: p.url, verified: false, label: p.type === 'other' ? (p.label + ' 商品頁') : undefined, note: `${me.name} 於 ${fmtDate(nowIso())} 提供` }); patch.links = links; }
      dispatch({ type: 'updateOption', itemId: it.id, optionId: o.id, patch, summary: `回報「${it.name}」${o.model} 的${price.value ? '價格 ' + fmtMoney(v) : '連結'}` });
      clearDraft(key + ':url'); toast('已更新');
    } }] });
  setTimeout(() => price.focus(), 50);
}
function openAddProductSheet(it) {
  const key = 'add:' + it.id;
  const link = draftInput(h('input', { class: 'input', type: 'url', inputmode: 'url', placeholder: '貼上 MOMO／PChome／官網的商品網址' }), key + ':url');
  const kw = draftInput(h('input', { class: 'input', placeholder: '例如：Panasonic 洗碗機 NP-TH4', maxlength: '80' }), key + ':kw');
  const name = draftInput(h('input', { class: 'input', placeholder: '例如：Bosch SMV6ZCX00X', maxlength: '80' }), key + ':name');
  const price = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: '看到的價格（選填）' });
  const note = h('input', { class: 'input', placeholder: '為什麼推薦？（選填）', maxlength: '200' });
  const ask = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'false', onclick: () => ask.setAttribute('aria-checked', ask.getAttribute('aria-checked') === 'true' ? 'false' : 'true') });
  const hint = h('p', { class: 'help' }, ''); const searchRow = h('div', { class: 'link-row' });
  const refreshSearch = () => { const k = kw.value.trim(); searchRow.replaceChildren(); if (!k) return; const su = searchUrls(k), cu = compareUrls(k); searchRow.append(linkBtn({ type: 'search-momo', url: su.momo, label: '到 MOMO 找' }, true), linkBtn({ type: 'search-pchome', url: su.pchome, label: '到 PChome 找' }, true), h('a', { class: 'btn sm lnk-cmp', href: cu.feebee, target: '_blank', rel: 'noopener noreferrer' }, '飛比價格 比價', icon('ext'))); };
  kw.addEventListener('input', refreshSearch); refreshSearch();
  link.addEventListener('input', () => { const p = parseProductUrl(link.value); hint.textContent = p ? `辨識為：${SOURCE_LABEL[p.type] || p.label || '其他'}${p.id ? '（商品編號 ' + p.id + '）' : ''}` : (link.value ? '看不懂這個網址，請確認有複製完整' : ''); if (p && !name.value && kw.value) name.value = kw.value; });
  openSheet({ title: `在「${it.name}」新增商品`, name: key, body: () => h('div', { class: 'stack' },
      h('div', { class: 'banner info' }, icon('info'), h('div', { class: 'small' }, '① 用關鍵字到賣場或比價網找到商品 → ② 把商品網址貼回來 → ③ 加入方案。勾選「請 Claude 幫忙查」，之後會補上完整規格與最新價格。')),
      h('div', { class: 'field' }, h('label', {}, '① 關鍵字／型號'), kw, searchRow),
      h('div', { class: 'field' }, h('label', {}, '② 商品網址'), link, hint),
      h('div', { class: 'field' }, h('label', {}, '③ 商品名稱／型號（必填）'), name),
      h('div', { class: 'grid-2' }, h('div', { class: 'field' }, h('label', {}, '價格'), price), h('div', { class: 'field' }, h('label', {}, '備註'), note)),
      h('div', { class: 'toggle-row' }, h('span', {}, '請 Claude 幫忙查最新價格與規格'), ask)),
    actions: [{ label: '取消' }, { label: '加入方案', class: 'primary', onClick: () => {
      const nm = name.value.trim() || kw.value.trim(); if (!nm) { name.focus(); return false; }
      const p = parseProductUrl(link.value); if (link.value.trim() && !p) { link.focus(); return false; }
      const v = Number(price.value); const links = [];
      if (p) links.push({ type: p.type, url: p.url, verified: false, label: p.type === 'other' ? (p.label + ' 商品頁') : undefined, note: `${me.name} 提供` });
      const opt = { id: 'fam_' + uid(), key: '', tier: '家人推薦', brand: '', model: nm, name: '', highlights: [], dims: '', cutout: '', power: '', weight: '', other: '', cmpKeyword: nm,
        price: v > 0 ? { amount: v, min: v, max: v, source: p ? p.type : 'family', checkedAt: todayIso(), note: `${me.name} 回報` } : { amount: null, min: null, max: null, source: 'family', checkedAt: todayIso(), note: '價格待查' },
        links, note: note.value.trim(), addedBy: me.name, addedAt: nowIso(), keyword: kw.value.trim(), availability: '' };
      const e = dispatch({ type: 'addOption', itemId: it.id, option: opt });
      if (ask.getAttribute('aria-checked') === 'true') dispatch({ type: 'addRequest', itemId: it.id, request: { id: uid(), who: me.name, ts: nowIso(), query: nm + (kw.value.trim() && kw.value.trim() !== nm ? '（' + kw.value.trim() + '）' : ''), url: p ? p.url : '', optionId: opt.id, status: 'pending' } });
      [':url', ':kw', ':name'].forEach(s => clearDraft(key + s)); if (e) toast('已加入方案', { undoEntryId: e.id });
    } }] });
  setTimeout(() => (kw.value ? link : kw).focus(), 50);
}

/* ---------- cloud snapshots ---------- */
async function openSnapshotsSheet() {
  const list = h('div', { class: 'stack-sm' }, h('p', { class: 'muted' }, '載入中…'));
  openSheet({ title: '雲端快照', body: () => h('div', { class: 'stack' }, h('p', { class: 'small muted' }, '每次儲存都會在 Google 雲端硬碟留一份完整快照（最近 200 份）。選一份可以整份回復；回復本身也會留下紀錄。'), list), actions: [{ label: '關閉' }] });
  try {
    const res = await apiCall({ action: 'snapshots' });
    list.replaceChildren();
    if (!res || !res.ok || !res.snapshots || !res.snapshots.length) { list.append(h('p', { class: 'muted' }, '目前沒有快照。')); return; }
    res.snapshots.slice(0, 40).forEach(s => list.append(h('div', { class: 'row between', style: 'border-top:1px solid var(--line);padding:.4rem 0' }, h('div', {}, h('div', { style: 'font-weight:700' }, `第 ${s.rev} 版`), h('div', { class: 'tiny' }, fmtTime(s.at, true))),
      h('button', { class: 'btn sm', type: 'button', disabled: !canEdit() || s.rev === state.rev, onclick: async () => {
        if (!await confirmDialog({ title: `回復到第 ${s.rev} 版？`, text: '會以那一份快照覆蓋目前所有內容（之後的修改都會被取代，但會留下紀錄）。', ok: '回復', danger: true })) return;
        try { const r = await apiCall({ action: 'snapshot', rev: s.rev }); if (!r || !r.ok) throw new Error('not ok'); const snap = normalize(clone(r.state)); const keepHistory = state.history; state = snap; state.history = keepHistory; dispatch({ type: 'replaceState', summary: `以雲端快照第 ${s.rev} 版覆蓋全部內容` }, { force: true }); closeSheet(); toast(`已回復到第 ${s.rev} 版`); } catch (e) { toast('讀取快照失敗'); }
      } }, '回復'))));
  } catch (e) { list.replaceChildren(h('p', { class: 'muted' }, '連不上雲端。')); }
}

/* ---------- tutorial ---------- */
const TUT_PICS = {
  house: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 58 60 24l42 34"/><path d="M30 52v46h60V52"/><rect x="50" y="66" width="20" height="32" rx="2"/><path d="M40 30v-10h10"/><path d="M76 70h10M76 80h10"/></svg>',
  tap: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="30" width="88" height="36" rx="10"/><path d="M32 48h40"/><path d="M78 70c0-6 10-6 10 0v18c0 10-8 16-16 16H64l-12-14c-3-4 2-9 6-6l6 5V58c0-6 10-6 10 0v12"/></svg>',
  check: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="22" width="28" height="28" rx="6"/><path d="m25 36 7 7 12-14"/><path d="M56 36h46"/><rect x="18" y="70" width="28" height="28" rx="6"/><path d="M56 84h46"/></svg>',
  undo: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="62" r="36"/><path d="M60 40v22l14 10"/><path d="M24 40l-8-12M24 40l12-6"/></svg>',
  share: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="60" r="11"/><circle cx="86" cy="30" r="11"/><circle cx="86" cy="90" r="11"/><path d="m40 54 36-19M40 66l36 19"/></svg>',
  doc: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="14" width="68" height="92" rx="6"/><path d="M40 36h40M40 52h40M40 68h24"/><path d="M40 88h16"/></svg>'
};
function showTutorial(kind) {
  const steps = kind === 'designer' ? [
    { pic: 'doc', t: '這是一份需求總表', d: '屋主選好的家電，自動整理成尺寸、開孔、電壓迴路、給排水與排風需求。' },
    { pic: 'check', t: '顏色標籤＝工種', d: '黃色「電」、藍色「水」、綠色「排風」、紫色「尺寸」。最下面是全屋前置工程與自來水硬度。' },
    { pic: 'share', t: '可以列印、也可以轉傳', d: '右上角「列印」印成 A4；內容隨時更新，打開就是最新版。' }
  ] : [
    { pic: 'house', t: '全家一起用的清單', d: '每個家電都整理好幾個方案。網址固定、不用登入。' },
    { pic: 'tap', t: '按「我要這個」', d: '喜歡哪個方案就按下去，再用 ＋／− 決定要幾台。' },
    { pic: 'check', t: '可以混搭', d: '同一個品項能選好幾款：例如掃地機一樓買旗艦、二樓買便宜的，三間浴室的暖風機也能各選各的。' },
    { pic: 'check', t: '待辦做完打勾', d: '量尺寸、拉電線都在「待辦」，打勾會記下是誰完成的。' },
    { pic: 'undo', t: '改錯了不用怕', d: '每一筆修改都有紀錄，按「還原」就回到之前。' },
    { pic: 'share', t: '分享', d: '「更多」可以分享給家人，或產生設計師專用連結。' }
  ];
  let i = 0;
  const dlg = h('dialog', { class: 'tut' });
  const wrap = h('div', { class: 'wrap' });
  const done = () => { try { dlg.close(); } catch {} dlg.remove(); store.set(kind === 'designer' ? KEYS.tut + '_designer' : KEYS.tut, 1); };
  const draw = () => {
    const s = steps[i];
    const pic = h('div', { class: 'pic', style: 'color:var(--accent)' }); pic.innerHTML = TUT_PICS[s.pic];
    wrap.replaceChildren(
      h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, `操作教學 ${i + 1}／${steps.length}`), h('button', { class: 'linkbtn', type: 'button', onclick: done }, '跳過')),
      pic, h('h2', {}, s.t), h('p', {}, s.d), h('div', { class: 'spacer' }),
      h('div', { class: 'dots' }, steps.map((_, k) => h('span', { class: k === i ? 'on' : '' }))),
      h('div', { class: 'btn-row' }, i > 0 ? h('button', { class: 'btn lg', type: 'button', onclick: () => { i--; draw(); } }, '上一步') : null, h('button', { class: 'btn primary lg', type: 'button', onclick: () => { if (i < steps.length - 1) { i++; draw(); } else done(); } }, i < steps.length - 1 ? '下一步' : '開始使用')));
  };
  draw(); dlg.append(wrap); document.body.append(dlg);
  try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
}

/* ---------- boot ---------- */
async function boot() {
  refineDeviceModel();
  const app = $('#app');
  app.replaceChildren(h('main', { class: 'content' }, h('div', { class: 'card' }, h('p', { class: 'muted' }, '載入清單中…'))));
  const seed = readSeed();
  state = normalize(clone(seed || { schema: 1, rev: 0, meta: {}, profiles: {}, rooms: [], items: [], prep: [], history: [] }));
  const backup = store.get(KEYS.backup);
  if (backup && backup.state && (backup.state.rev || 0) > (state.rev || 0) && (backup.state.catalogVersion || 0) >= (seed.catalogVersion || 0)) state = normalize(backup.state);
  const savedRoute = sstore.get(KEYS.route); if (savedRoute && savedRoute.screen) route = savedRoute;
  render();
  await Promise.all([loadConfig(), loadPrices()]);
  if (pending.length && canEdit()) { const existing = new Set(state.history.map(e => e.id)); const todo = pending.filter(a => a._ctx && !existing.has(a._ctx.id)); pending = []; todo.forEach(a => dispatch(a, { replay: true, silent: true, force: true })); pending = todo; store.set(KEYS.pending, pending); }
  render();
  await syncFromRemote(true);
  render();
  startPolling();
  const sh = sstore.get(KEYS.sheet);
  if (sh && Date.now() - sh.at < 120000 && role === 'family' && me) { const [kind, arg] = sh.name.split(':'); try { if (kind === 'note' && item(arg)) openNoteSheet(arg); else if (kind === 'add' && item(arg)) openAddProductSheet(item(arg)); else if (kind === 'todo') openAddTodoSheet(arg === 'general' ? null : arg); } catch {} }
  if (role === 'family' && me && !store.get(KEYS.tut)) showTutorial('family');
  if (pending.length && canEdit()) scheduleSave();
}
/* 列印時把所有摺疊補開，印完再收回原狀——設計師直接列印時不能因為收起來就少印內容 */
addEventListener('beforeprint', () => document.querySelectorAll('details:not([open])').forEach(d => { d.dataset.wasClosed = '1'; d.open = true; }));
addEventListener('afterprint', () => document.querySelectorAll('details[data-was-closed]').forEach(d => { d.open = false; delete d.dataset.wasClosed; }));
document.addEventListener('DOMContentLoaded', boot);
