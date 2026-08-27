/* ===================== Part 2: rendering (v3 warm UI, quantities) ===================== */
const scrollMemo = {};
function routeKey() { return [route.screen, route.tab, route.itemId].join('|'); }
function go(next, opts = {}) {
  scrollMemo[routeKey()] = window.scrollY;
  route = Object.assign({ screen: 'tab', tab: 'list', itemId: null, preview: false }, next);
  sstore.set(KEYS.route, route);
  render();
  const y = opts.keepScroll ? (scrollMemo[routeKey()] || 0) : 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}
function chip(text, cls) { return h('span', { class: 'chip ' + (cls || '') }, text); }
function statusChip(st) { const s = STATUS[st] || STATUS.choosing; return chip(s.label, 's-' + (STATUS[st] ? st : 'choosing')); }
function tierChip(tier) { return chip(tier, 'tier t-' + ({ '指定': 'fixed', '頂級': 'top', '高級': 'mid', '高CP值': 'cp', '替代方案': 'alt', '家人推薦': 'fam' }[tier] || 'alt')); }
function availChip(a) { if (a === 'in_stock') return chip('有現貨', 's-bought'); if (a === 'discontinued') return chip('已下架', 'warn'); if (a === 'unclear') return chip('庫存待確認', 's-choosing'); return null; }
function tagChip(tag) { return chip(tag, 'tag tag-' + tag); }
function fold(title, body, opts = {}) { return h('details', { class: 'fold' + (opts.cls ? ' ' + opts.cls : ''), open: opts.open ? true : null }, h('summary', {}, h('span', {}, title), icon('next', 'chev')), h('div', { class: 'fold-body' }, body)); }
function roomHeader(r, n) { return h('h2', { class: 'h-room' }, r.name, h('span', { class: 'count' }, `${n} 項`)); }
function qtyHint(it) { return it.defaultQty > 1 ? `建議 ${it.defaultQty} 台` : ''; }

function render() {
  const app = $('#app'); if (!app) return;
  document.documentElement.dataset.font = store.get(KEYS.font, 'std');
  if (!state) { app.replaceChildren(h('main', { class: 'content' }, h('div', { class: 'card' }, h('p', { class: 'muted' }, '載入中…')))); return; }
  const y = window.scrollY;
  let screen;
  if (role === 'designer') screen = renderDocScreen(false);
  else if (!(me && me.name)) screen = renderNameEntry();
  else if (route.screen === 'item') screen = renderItemScreen(route.itemId);
  else if (route.screen === 'doc') screen = renderDocScreen(true);
  else screen = renderTabScreen();
  app.replaceChildren(...screen);
  document.body.classList.toggle('doc-mode', role !== 'family' || route.screen === 'doc');
  window.scrollTo(0, y);
}

/* ---------- chrome ---------- */
function topbar({ back, title, right }) {
  return h('header', { class: 'topbar' },
    h('div', { class: 'back' }, back ? h('button', { class: 'btn ghost sm', onclick: back.onClick, 'aria-label': back.label }, icon('back'), back.label) : null),
    h('h1', {}, title), h('div', { class: 'right' }, right || null));
}
function renderSaveState(el) {
  let s = saveState.s, msg = saveState.msg;
  if (s === 'idle') { if (!API.configured) { s = 'local'; msg = '尚未連線雲端：修改只留在這台裝置'; } else if (remoteStatus === 'offline') { s = 'error'; msg = '目前連不上雲端，修改會先留在手機，連上後自動同步'; } }
  el.dataset.s = s;
  const map = { idle: '', saving: '儲存中', saved: '已儲存', error: '未同步', local: '未連線', readonly: '檢視' };
  el.replaceChildren(...[s === 'saved' ? icon('check') : (s === 'idle' ? null : icon('cloud')), map[s] || ''].filter(Boolean));
  el.hidden = s === 'idle'; el.title = msg || '';
  el.onclick = () => { if (msg) toast(msg); };
}
function saveStateEl() { const el = h('button', { id: 'saveState', class: 'save-state', type: 'button' }); renderSaveState(el); return el; }
function openTodoCount() { return state.items.reduce((n, i) => n + liveTodos(i).filter(t => !t.done).length, 0) + (state.todos || []).filter(t => !t.done).length + state.prep.filter(p => !p.done).length; }
function openFamilyCount() { return state.items.reduce((n, i) => n + familyTodos(i).filter(t => !t.done).length, 0) + (state.todos || []).filter(t => !t.done && t.for === 'family').length; }
function openDesignerCount() { return state.items.reduce((n, i) => n + designerTodos(i).filter(t => !t.done).length, 0) + (state.todos || []).filter(t => !t.done && t.for !== 'family').length + state.prep.filter(p => !p.done).length; }
function tabbar(active) {
  const tabs = [['list', '清單', 'list'], ['todos', '待辦', 'todo'], ['history', '紀錄', 'history'], ['more', '更多', 'more']];
  const open = openFamilyCount();
  return h('nav', { class: 'tabbar', 'aria-label': '主選單' }, h('div', { class: 'inner' }, tabs.map(([id, label, ic]) =>
    h('button', { type: 'button', 'aria-current': active === id ? 'page' : null, onclick: () => go({ screen: 'tab', tab: id }, { keepScroll: true }) }, icon(ic), label, id === 'todos' && open ? h('span', { class: 'badge' }, open > 99 ? '99+' : open) : null))));
}
function toastHost() { return h('div', { class: 'toast-host', id: 'toastHost' }); }
function toast(msg, opts = {}) {
  let host = $('#toastHost'); if (!host) { host = toastHost(); document.body.append(host); }
  clearTimeout(toastTimer);
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  if (opts.undoEntryId) t.append(h('button', { type: 'button', onclick: () => { dispatch({ type: 'restore', entryId: opts.undoEntryId }); host.replaceChildren(); toast('已還原'); } }, '還原'));
  host.replaceChildren(t);
  toastTimer = setTimeout(() => host.replaceChildren(), opts.undoEntryId ? 6000 : 2800);
}

/* ---------- identity ---------- */
function renderNameEntry() {
  const names = knownNames();
  const input = h('input', { class: 'input', type: 'text', placeholder: '例如：爸爸、媽媽、阿華', autocomplete: 'off', maxlength: '20', style: 'font-size:1.25rem', id: 'nameInput' });
  const start = () => { const name = input.value.trim(); if (!name) { input.focus(); toast('請先輸入稱呼'); return; } me = { name, deviceName: (me && me.deviceName) || '' }; store.set(KEYS.me, me); route = { screen: 'tab', tab: 'list' }; render(); window.scrollTo(0, 0); if (!store.get(KEYS.tut)) showTutorial('family'); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
  const main = h('main', { class: 'content welcome' },
    h('div', { class: 'welcome-art' }, icon('house')),
    h('h1', { class: 'big' }, state.meta.title),
    h('p', { class: 'muted' }, '全家一起用的家電清單。請問怎麼稱呼您？'),
    h('div', { class: 'field' }, input),
    names.length ? h('div', { class: 'row wrap' }, names.map(n => h('button', { class: 'btn sm', type: 'button', onclick: () => { input.value = n; } }, n))) : null,
    h('button', { class: 'btn primary lg block', type: 'button', onclick: start }, '開始使用'));
  setTimeout(() => input.focus(), 50);
  return [main];
}

/* ---------- tab screens ---------- */
function renderTabScreen() {
  const tab = route.tab || 'list';
  const titles = { list: state.meta.title, todos: '待辦', history: '修改紀錄', more: '更多' };
  const body = { list: renderList, todos: renderTodos, history: renderHistory, more: renderMore }[tab]();
  return [topbar({ title: titles[tab], right: [saveStateEl()] }), h('main', { class: 'content' }, ...body), tabbar(tab), toastHost()];
}
function pendingBanner() {
  if (!pending.length) return null;
  if (saveState.s === 'saving' || saveState.s === 'saved') return null;
  const msg = !API.configured ? '雲端還沒設定好，修改先留在這台裝置。' : (saveState.msg || '稍後會自動再試');
  return h('div', { class: 'banner warn pending-banner' }, icon('warn'), h('div', { class: 'grow' }, `${pending.length} 筆修改還沒存到雲端。`, h('div', { class: 'small', style: 'margin-top:.2rem' }, msg),
    API.configured ? h('div', { class: 'btn-row', style: 'margin-top:.4rem' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { saveDelay = 300; scheduleSave(); saveDelay = 1500; } }, '再試一次')) : null));
}
function tierEstimate(it, tier) {
  const map = { cp: ['高CP值', '替代方案', '家人推薦'], mid: ['高級'], top: ['頂級'] };
  const fixed = it.options.filter(o => o.tier === '指定'); if (fixed.length) return priceValue(effectivePrice(fixed[0]));
  let pool = it.options.filter(o => map[tier].includes(o.tier)); const inStock = pool.filter(o => o.availability === 'in_stock'); if (inStock.length) pool = inStock;
  let vals = pool.map(o => priceValue(effectivePrice(o))).filter(v => v != null);
  if (!vals.length) vals = it.options.map(o => priceValue(effectivePrice(o))).filter(v => v != null);
  return vals.length ? Math.min(...vals) : null;
}
function nextStep() {
  const items = state.items.filter(i => i.status !== 'skipped');
  const choosing = items.filter(i => i.status === 'choosing');
  if (choosing.length) { const nx = choosing[0]; return { t: `先決定「${nx.name}」`, d: `還有 ${choosing.length} 項沒決定`, go: () => go({ screen: 'item', itemId: nx.id }) }; }
  const open = openFamilyCount();
  if (open) return { t: `有 ${open} 件要我們決定`, d: '在「待辦」裡打勾', go: () => go({ screen: 'tab', tab: 'todos' }) };
  const notBought = items.filter(i => i.status === 'decided');
  if (notBought.length) return { t: `${notBought.length} 項已決定、還沒買`, d: '下單後改成「已購買」', go: () => go({ screen: 'item', itemId: notBought[0].id }) };
  return { t: '全部完成！', d: '', go: null };
}
function renderList() {
  const items = state.items, active = items.filter(i => i.status !== 'skipped');
  const decided = active.filter(i => picksOf(i).length || ['bought', 'installed'].includes(i.status)).length;
  const bought = active.filter(i => ['bought', 'installed'].includes(i.status)).length;
  const pct = active.length ? Math.round(decided / active.length * 100) : 0;
  let decidedSum = 0, decidedN = 0; active.forEach(i => { const t = itemTotal(i); if (t.n) { decidedSum += t.sum; decidedN++; } });
  const est = { cp: 0, mid: 0, top: 0 }; active.forEach(i => ['cp', 'mid', 'top'].forEach(k => { const v = tierEstimate(i, k); if (v != null) est[k] += v * (i.defaultQty || 1); }));
  const out = [pendingBanner()];
  out.push(h('div', { class: 'hero' },
    h('div', {}, h('h2', { class: 'h-hero' }, state.meta.title), h('p', { class: 'sub' }, `已決定 ${decided}／${active.length}・已購買 ${bought}${decidedN ? `・設備 ${fmtWan(decidedSum)}` : ''}`)),
    h('div', { class: 'ring', style: `--p:${pct}` }, h('span', {}, `${pct}%`, h('small', {}, '已決定'))),
    h('div', { class: 'hero-actions' }, h('button', { class: 'btn sm', type: 'button', onclick: () => shareLink('family') }, icon('share'), '分享給家人'), h('button', { class: 'btn sm', type: 'button', onclick: () => go({ screen: 'tab', tab: 'more' }) }, icon('book'), '設計師連結'))));
  const ns = nextStep();
  out.push(h(ns.go ? 'button' : 'div', { class: 'next' + (ns.go ? ' item-row' : ' card'), type: ns.go ? 'button' : null, onclick: ns.go || null },
    h('span', { class: 'tile r-next' }, icon('pin')), h('div', {}, h('div', { class: 'eyebrow' }, '下一步'), h('div', { class: 't' }, ns.t), ns.d ? h('div', { class: 'small muted' }, ns.d) : null), ns.go ? icon('next', 'arrow') : null));
  const pickedItems = active.filter(i => picksOf(i).length);
  const inst = installRange(pickedItems), instAll = installRange(active);
  const unpriced = pickedItems.reduce((n, i) => n + picksOf(i).filter(p => priceValue(effectivePrice(p.option)) == null).length, 0);
  const totalUnits = pickedItems.reduce((n, i) => n + pickCount(i), 0);
  // --- 已選金額：永遠看得到 ---
  out.push(h('div', { class: 'card budget-now' },
    h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, '目前已選'), h('span', { class: 'tiny' }, `${pickedItems.length}／${active.length} 項・${totalUnits} 台`)),
    decidedN ? h('div', { class: 'stack-sm' },
      h('div', { class: 'big-total' }, inst.n ? fmtWanRange(decidedSum + inst.min, decidedSum + inst.max) : fmtWan(decidedSum)),
      h('div', { class: 'cost-rows' },
        h('div', { class: 'row between' }, h('span', {}, '設備'), h('b', {}, fmtMoney(decidedSum))),
        inst.n ? h('div', { class: 'row between' }, h('span', {}, '安裝工程'), h('b', {}, installText({ min: inst.min, max: inst.max }))) : null,
        inst.n ? h('div', { class: 'row between total' }, h('span', {}, '總計'), h('b', {}, installText({ min: decidedSum + inst.min, max: decidedSum + inst.max }))) : null),
      h('p', { class: 'tiny' }, [unpriced ? `其中 ${unpriced} 款價格待查` : '', active.length - pickedItems.length > 0 ? `還有 ${active.length - pickedItems.length} 項沒選，選完金額才完整` : '18 項都選好了'].filter(Boolean).join('・')))
      : h('p', { class: 'muted' }, '還沒選任何商品。到下面的品項按「我要這個」，這裡就會顯示金額。')));
  // --- 三種等級的估算：次要資訊 ---
  out.push(h('details', { class: 'card flat fold' },
    h('summary', {}, h('span', {}, '如果全部都買，三種等級各要多少？'), icon('next', 'chev')),
    h('div', { class: 'fold-body stack' },
      h('div', { class: 'summary' }, [['cp', '全選高CP值'], ['mid', '全選高級'], ['top', '全選頂級']].map(([k, l]) => h('div', { class: 'cell' }, h('div', { class: 'v' }, fmtWan(est[k])), h('div', { class: 'k' }, l)))),
      instAll.n ? h('p', { class: 'tiny' }, `以上只算設備；全部品項的安裝工程另估約 ${installText({ min: instAll.min, max: instAll.max })}。`) : null,
      h('div', { class: 'only-narrow' }, active.map(i => { const qy = i.defaultQty || 1; return h('div', { class: 'budget-item' },
        h('div', { class: 'nm' }, i.name, qy > 1 ? h('small', {}, ` ×${qy}`) : null),
        h('div', { class: 'vals' }, [['cp', 'CP'], ['mid', '高級'], ['top', '頂級']].map(([k, l]) => { const v = tierEstimate(i, k); return h('span', { class: 'v' }, h('small', {}, l), v == null ? '—' : fmtWan(v * qy)); }))); })),
      h('div', { class: 'table-wrap only-wide' }, h('table', { class: 'ctable', style: 'min-width:420px' }, h('thead', {}, h('tr', {}, h('th', {}, '品項'), h('th', {}, '數量'), h('th', {}, '高CP值'), h('th', {}, '高級'), h('th', {}, '頂級'))),
        h('tbody', {}, active.map(i => h('tr', {}, h('td', {}, i.name), h('td', {}, i.defaultQty || 1), ['cp', 'mid', 'top'].map(k => { const v = tierEstimate(i, k); return h('td', {}, v == null ? '—' : (v * (i.defaultQty || 1)).toLocaleString('en-US')); })))))),
      h('p', { class: 'tiny' }, state.budget.note))));
  state.rooms.forEach(r => { const its = items.filter(i => i.roomId === r.id); if (its.length) out.push(h('section', { class: 'stack rooms' }, roomHeader(r, its.length), its.map(itemRow))); });
  out.push(h('p', { class: 'tiny', style: 'text-align:center' }, state.meta.priceNote, prices && prices.checkedAt ? `（PChome 價格更新：${fmtDateShort(prices.checkedAt)}）` : ''));
  return out;
}
function picksText(it, withPrice) {
  const ps = picksOf(it); if (!ps.length) return '';
  const s = ps.map(p => `${p.option.model.split(/[（(]/)[0].trim()}${p.backup ? '（備案）' : (p.qty > 1 ? ' ×' + p.qty : '')}`).join('、');
  const t = itemTotal(it); return withPrice && t.n ? `${s}　${fmtMoney(t.sum)}` : s;
}
function itemRow(it) {
  const ps = picksOf(it); const openTodos = liveTodos(it).filter(t => !t.done).length;
  const sub = ps.length ? picksText(it, profileOf(role).show.price) : (it.status === 'skipped' ? '這次不買' : `${it.options.length} 個方案${qtyHint(it) ? '・' + qtyHint(it) : ''}`);
  return h('button', { class: 'item-row', type: 'button', onclick: () => go({ screen: 'item', itemId: it.id }) }, tile(it),
    h('div', {}, h('div', { class: 'title' }, it.name), h('div', { class: 'sub' }, sub), h('div', { class: 'meta' }, statusChip(it.status), hasAlerts(it) ? chip('需確認', 'tag tag-alert') : null, openTodos ? chip(`待辦 ${openTodos}`, 'tag') : null, it.notes.length ? chip(`留言 ${it.notes.length}`, 'tag') : null)),
    icon('next', 'arrow'));
}

/* ---------- item detail ---------- */
function renderItemScreen(id) {
  const it = item(id); if (!it) { route = { screen: 'tab', tab: 'list' }; return renderTabScreen(); }
  return [topbar({ back: { label: '返回', onClick: () => go({ screen: 'tab', tab: 'list' }, { keepScroll: true }) }, title: it.name, right: [saveStateEl()] }), h('main', { class: 'content' }, ...renderItemBody(it)), tabbar('list'), toastHost()];
}
function sortedOptions(it) {
  const order = ['指定', '頂級', '高級', '高CP值', '替代方案', '家人推薦'];
  return [...it.options].sort((a, b) => (a.id === it.pickOptionId ? -1 : 0) - (b.id === it.pickOptionId ? -1 : 0) || order.indexOf(a.tier) - order.indexOf(b.tier));
}
function setPickQty(it, o, n, msg) { const e = dispatch({ type: 'setPick', itemId: it.id, optionId: o.id, qty: n }); if (e) toast(msg, { undoEntryId: e.id }); }
function stepper(it, o, small) {
  const qty = pickQty(it, o.id);
  return h('div', { class: 'stepper' + (small ? ' sm' : '') },
    h('button', { class: 'btn', type: 'button', 'aria-label': '少一台', onclick: () => setPickQty(it, o, qty - 1, qty - 1 ? `改成 ${qty - 1} 台` : '已移除') }, '−'),
    h('span', { class: 'qty' }, qty, h('small', {}, '台')),
    h('button', { class: 'btn', type: 'button', 'aria-label': '多一台', onclick: () => setPickQty(it, o, qty + 1, `改成 ${qty + 1} 台`) }, '＋'));
}
function pickControls(it, o, editable) {
  if (!editable) return null;
  const qty = pickQty(it, o.id);
  if (!qty) return h('button', { class: 'btn primary block lg', type: 'button', onclick: () => setPickQty(it, o, 1, `已加入「${it.name}」`) }, icon('plus'), '我要這個');
  return h('div', { class: 'qty-bar' }, h('span', { class: 'lbl' }, icon('check'), '已加入・要幾台'), stepper(it, o));
}
function renderItemBody(it) {
  const prof = profileOf(role), editable = canEdit(), out = [pendingBanner()];
  out.push(h('div', { class: 'row' }, tile(it), h('div', {}, h('div', { class: 'small muted' }, room(it.roomId).name), h('div', { style: 'font-weight:700' }, it.short))));
  const grid = h('div', { class: 'status-grid' }, ['choosing', 'decided', 'bought', 'installed'].map(st => h('button', { class: 'btn s-' + st, type: 'button', 'aria-pressed': String(it.status === st), disabled: !editable, onclick: () => { if (it.status === st) return; const e = dispatch({ type: 'setStatus', itemId: it.id, status: st }); if (e) toast(`已改為「${STATUS[st].label}」`, { undoEntryId: e.id }); } }, STATUS[st].label, h('span', { class: 'hint' }, STATUS[st].hint))));
  out.push(h('div', { class: 'card' }, grid,
    editable ? h('button', { class: 'linkbtn', type: 'button', onclick: async () => { if (it.status === 'skipped') { dispatch({ type: 'setStatus', itemId: it.id, status: 'choosing' }); return; } if (await confirmDialog({ title: `「${it.name}」這次不買？`, text: '會標示為「不需要」，之後隨時可以改回來。', ok: '標示為不需要' })) { const e = dispatch({ type: 'setStatus', itemId: it.id, status: 'skipped' }); if (e) toast('已標示為不需要', { undoEntryId: e.id }); } } }, it.status === 'skipped' ? '改回「考慮中」' : '這次不買') : null));
  if (it.hardReq) out.push(h('div', { class: 'banner info' }, icon('pin'), h('div', {}, h('b', {}, '硬需求：'), it.hardReq)));
  // picks summary
  const ps = picksOf(it), total = itemTotal(it);
  const need = (it.defaultQty || 1) - pickCount(it);
  if (ps.length) out.push(h('div', { class: 'card tone-accent' }, h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, '我要買的'), h('span', { class: 'tiny' }, `共 ${pickCount(it)} 台`)),
    h('div', { class: 'stack-sm' }, ps.map(p => h('div', { class: 'pick-line' },
      h('div', { class: 'grow' }, h('b', {}, `${p.option.brand} ${p.option.model}`.trim()), p.backup ? [' ', chip('備案', 'tag tag-backup')] : null, prof.show.price ? h('div', { class: 'small muted' }, priceValue(effectivePrice(p.option)) == null ? '價格待查' : p.backup ? `${fmtMoney(priceValue(effectivePrice(p.option)))}（備案，不計入預算）` : `${fmtMoney(priceValue(effectivePrice(p.option)))} × ${p.qty} ＝ ${fmtMoney(priceValue(effectivePrice(p.option)) * p.qty)}`) : null),
      editable ? h('div', { class: 'pick-actions' }, stepper(it, p.option, true),
        h('button', { class: 'linkbtn tiny', type: 'button', onclick: () => dispatch({ type: 'setPickBackup', itemId: it.id, optionId: p.option.id, backup: !p.backup }) }, p.backup ? '改回要買' : '設為備案'))
        : h('span', { class: 'chip s-decided' }, p.backup ? '備案' : `${p.qty} 台`)))),
    prof.show.price && total.n && ps.length > 1 ? h('div', { class: 'row between', style: 'border-top:1px solid var(--line);padding-top:.4rem' }, h('b', {}, '合計'), h('span', { class: 'price' }, fmtMoney(total.sum))) : null,
    prof.show.price && it.installCost ? h('div', { class: 'row between', style: 'border-top:1px dashed var(--line);padding-top:.4rem' }, h('span', { class: 'small' }, '另加安裝工程'), h('b', { class: 'small' }, installText(it.installCost))) : null,
    need > 0 ? h('div', { class: 'banner warn small', style: 'margin-top:.2rem' }, icon('info'), h('div', {}, `建議 ${it.defaultQty} 台，還差 ${need} 台。可以按同一款的「＋」，或到下面選別款混搭。`)) : null));
  else if (it.status !== 'skipped') out.push(h('div', { class: 'card tone-attn' }, h('div', { class: 'row' }, icon('pin'), h('div', {}, h('b', {}, '怎麼選？'), h('div', { class: 'small' }, `看下面的方案，喜歡哪個就按「我要這個」${(it.defaultQty || 1) > 1 ? `。這裡建議 ${it.defaultQty} 台，可以同一款按「＋」加數量，也可以不同款各選一台` : ''}。`)))));
  alertBlocks(it, prof).forEach(b => out.push(b));
  if (prof.show.options) out.push(h('section', { class: 'stack' }, h('h2', { class: 'h-sec' }, '方案', h('span', { class: 'count' }, `${it.options.length} 個`)), sortedOptions(it).map(o => optionCard(it, o, { prof, editable }))));
  if (editable) out.push(h('button', { class: 'btn outline block', type: 'button', onclick: () => openAddProductSheet(it) }, icon('plus'), '新增其他商品'));
  if (prof.show.advice && it.advice) out.push(h('div', { class: 'card tone-soft' }, h('div', { class: 'eyebrow' }, '達人建議'), h('p', {}, it.advice)));
  if (it.warnings.length) out.push(fold(`注意事項（${it.warnings.length}）`, h('ul', { class: 'small' }, it.warnings.map(w => h('li', {}, w)))));
  if (prof.show.install && it.install.length) out.push(fold('安裝須知（給設計師／水電）', h('div', {}, installList(it.install))));
  if (prof.show.price && (it.costNotes.length || it.installCost)) out.push(fold('費用參考' + (it.installCost ? `（安裝 ${installText(it.installCost)}）` : ''), h('div', { class: 'stack-sm small' },
    it.installCost ? h('div', {}, h('b', {}, '安裝工程估算 ' + installText(it.installCost)), it.installCost.note ? h('div', { class: 'muted' }, it.installCost.note) : null) : null,
    it.costNotes.length ? h('ul', {}, it.costNotes.map(c => h('li', {}, c))) : null)));
  const reqs = it.requests.filter(r => r.status === 'pending');
  if (reqs.length && prof.show.notes) out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '等 Claude 幫忙查'), reqs.map(r => h('div', { class: 'row between' }, h('div', { class: 'grow' }, h('div', {}, r.query || r.url), h('div', { class: 'tiny' }, `${r.who}・${fmtTime(r.ts)}`)), editable ? h('button', { class: 'btn sm', type: 'button', onclick: () => dispatch({ type: 'updateRequest', itemId: it.id, requestId: r.id, patch: { status: 'done' } }) }, '已處理') : null))));
  if (prof.show.todos) {
    const fam = familyTodos(it), des = designerTodos(it);
    const famOpen = fam.filter(t => !t.done), famDone = fam.filter(t => t.done);
    out.push(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, `要我們決定（${famOpen.length}）`), editable ? h('button', { class: 'btn sm', type: 'button', onclick: () => openAddTodoSheet(it.id) }, icon('plus'), '新增') : null),
      fam.length ? h('div', { class: 'stack-sm' }, famOpen.map(t => todoRow(t, it.id, editable)), famDone.map(t => todoRow(t, it.id, editable))) : h('p', { class: 'small muted' }, '沒有要決定的事')));
    if (des.length) out.push(fold(`給設計師／水電（${des.filter(t => !t.done).length}）`, h('div', { class: 'stack-sm' }, des.map(t => todoRow(t, it.id, editable)))));
  }
  if (prof.show.notes) out.push(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, `留言（${it.notes.length}）`), editable ? h('button', { class: 'btn sm', type: 'button', onclick: () => openNoteSheet(it.id) }, icon('plus'), '留言') : null),
    it.notes.length ? h('div', { class: 'stack-sm' }, [...it.notes].reverse().map(n => h('div', { class: 'note' }, h('div', { class: 'row between' }, h('span', { class: 'who' }, n.who), h('span', { class: 'when' }, fmtTime(n.ts, true))), h('div', { class: 'txt' }, n.text), editable && me && n.who === me.name ? h('button', { class: 'linkbtn small', type: 'button', onclick: async () => { if (await confirmDialog({ title: '刪除這則留言？', ok: '刪除', danger: true })) dispatch({ type: 'removeNote', itemId: it.id, noteId: n.id }); } }, '刪除') : null))) : h('p', { class: 'small muted' }, '有想法就寫下來，全家都看得到。')));
  return out;
}
function installList(list, noPrice) {
  const sorted = [...list].sort((a, b) => TAG_ORDER.indexOf(a.tag) - TAG_ORDER.indexOf(b.tag));
  return sorted.map(n => { const t = noPrice ? stripPriceSentences(n.text) : n.text; return t ? h('div', { class: 'inst' }, tagChip(n.tag), h('div', { class: 't' }, t)) : null; });
}
function linkLabel(l) { if (l.label) return l.label; return { momo: 'MOMO 看商品', pchome: 'PChome 看商品', official: '品牌官網', other: '商品頁', 'search-momo': '在 MOMO 搜尋', 'search-pchome': '在 PChome 搜尋' }[l.type] || '連結'; }
function linkBtn(l, small) {
  const cls = { momo: 'lnk-momo', pchome: 'lnk-pchome', official: 'lnk-official', other: 'lnk-other', 'search-momo': 'lnk-search', 'search-pchome': 'lnk-search' }[l.type] || 'lnk-official';
  return h('a', { class: 'btn ' + cls + (small ? ' sm' : ''), href: l.url, target: '_blank', rel: 'noopener noreferrer', title: l.note || '' }, linkLabel(l), icon('ext'));
}
function linkButtons(opt) {
  const links = opt.links || []; const has = t => links.some(l => l.type === t);
  const kw = opt.cmpKeyword || (opt.brand.split(/[ ／]/)[0] + ' ' + opt.model.split(/[（(／＋]/)[0]).trim();
  const su = searchUrls(kw), cu = compareUrls(kw);
  const direct = links.filter(l => !l.type.startsWith('search')); const search = links.filter(l => l.type.startsWith('search'));
  if (!has('momo') && !has('search-momo')) search.push({ type: 'search-momo', url: su.momo });
  if (!has('pchome') && !has('search-pchome')) search.push({ type: 'search-pchome', url: su.pchome });
  return h('div', { class: 'stack-sm' },
    direct.length ? h('div', { class: 'link-row' }, direct.map(l => linkBtn(l))) : null,
    h('div', { class: 'link-row' }, search.map(l => linkBtn(l, true)), h('a', { class: 'btn sm lnk-cmp', href: cu.feebee, target: '_blank', rel: 'noopener noreferrer' }, '飛比價格', icon('ext')), h('a', { class: 'btn sm lnk-cmp', href: cu.biggo, target: '_blank', rel: 'noopener noreferrer' }, 'BigGo 比價', icon('ext'))));
}
function priceBlock(o) {
  const p = effectivePrice(o), lp = livePrice(o);
  const note = o.price && o.price.note ? o.price.note.split(/[；;]/)[0] : '';
  return h('div', {},
    h('div', { class: 'row wrap' }, h('span', { class: 'price' }, priceText(p)), p && p.source ? chip(SOURCE_LABEL[p.source] || p.source, 'src') : null, p && p.live ? chip(`今日價 ${fmtDateShort(p.checkedAt)}`, 'live') : (p && p.checkedAt ? h('span', { class: 'tiny' }, fmtDateShort(p.checkedAt) + ' 查') : null)),
    lp && lp.qty === 0 ? h('div', { class: 'tiny', style: 'color:var(--attn)' }, `PChome 今日顯示缺貨`) : null,
    note ? h('div', { class: 'tiny' }, note) : null);
}
function reviewsBlock(o) {
  const r = o.reviews; if (!r || (!(r.praise || []).length && !(r.complaints || []).length)) return null;
  const conf = { high: '多個來源一致', medium: '來源較少', low: '資料不多' }[r.confidence] || '';
  return fold('大家怎麼說' + (conf ? `（${conf}）` : ''), h('div', { class: 'stack-sm small' },
    (r.praise || []).length ? h('div', {}, h('div', { class: 'eyebrow', style: 'color:var(--ok)' }, '好評'), h('ul', {}, r.praise.map(x => h('li', {}, x)))) : null,
    (r.complaints || []).length ? h('div', {}, h('div', { class: 'eyebrow', style: 'color:var(--attn)' }, '抱怨／災情'), h('ul', {}, r.complaints.map(x => h('li', {}, x)))) : null,
    (r.sources || []).length ? h('div', { class: 'tiny' }, '來源：', r.sources.slice(0, 4).map((u, i) => [i ? '、' : '', h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, (() => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return '連結'; } })())])) : null));
}
function optionCard(it, o, { prof, editable }) {
  const qty = pickQty(it, o.id), picked = it.pickOptionId === o.id;
  const kv = [];
  if (prof.show.dims) { if (o.dims) kv.push(['尺寸', o.dims]); if (o.cutout) kv.push(['開孔／預留', o.cutout]); if (o.power) kv.push(['電源', o.power]); if (o.weight) kv.push(['重量', o.weight]); if (o.other) kv.push(['其他', o.other]); }
  return h('div', { class: 'opt' + (qty ? ' chosen' : '') + (picked ? ' picked' : '') },
    h('div', { class: 'row wrap' }, picked ? chip('達人推薦', 'pick') : null, tierChip(o.tier), availChip(o.availability), qty ? chip(`已選${qty > 1 ? ' ×' + qty : ''}`, 's-decided') : null),
    h('div', { class: 'model' }, `${o.brand} ${o.model}`),
    o.name ? h('div', { class: 'name' }, o.name) : null,
    o.highlights && o.highlights.length ? h('ul', { class: 'hl' }, o.highlights.slice(0, 3).map(x => h('li', {}, x))) : null,
    picked && it.pickReason ? h('div', { class: 'pick-reason' }, it.pickReason) : null,
    prof.show.price ? priceBlock(o) : null,
    editable ? pickControls(it, o, editable) : null,
    prof.show.links ? linkButtons(o) : null,
    kv.length ? fold('規格', h('dl', { class: 'kv' }, kv.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))) : null,
    prof.show.advice ? reviewsBlock(o) : null,
    o.note ? h('div', { class: 'small muted' }, '備註：', o.note) : null,
    editable ? h('div', { class: 'row wrap', style: 'gap:.8rem' }, h('button', { class: 'linkbtn small', type: 'button', onclick: () => openPriceSheet(it, o) }, '回報價格／連結'),
      o.tier === '家人推薦' ? h('button', { class: 'linkbtn small', type: 'button', onclick: async () => { if (await confirmDialog({ title: `移除 ${o.model}？`, text: '紀錄裡還找得到、也可以還原。', ok: '移除', danger: true })) { const e = dispatch({ type: 'removeOption', itemId: it.id, optionId: o.id }); if (e) toast('已移除', { undoEntryId: e.id }); } } }, '從清單移除這個商品') : null) : null);
}
function todoRow(t, itemId, editable, ctx) {
  return h('div', { class: 'check-row', 'data-done': String(!!t.done) },
    h('button', { class: 'toggle', type: 'button', disabled: !editable, 'aria-pressed': String(!!t.done), onclick: () => { const e = dispatch({ type: 'toggleTodo', itemId, todoId: t.id, done: !t.done }); if (e && !t.done) toast('已完成', { undoEntryId: e.id }); } },
      h('span', { class: 'box' }, t.done ? icon('check') : null),
      h('span', {}, h('div', { class: 'label' }, t.text), ctx || t.done ? h('div', { class: 'ctx' }, [ctx, t.done && t.doneBy ? `${t.doneBy} ${fmtTime(t.doneAt)}` : null].filter(Boolean).join('・')) : null)),
    editable ? h('button', { class: 'del', type: 'button', 'aria-label': '刪除', onclick: async () => { if (await confirmDialog({ title: '刪除這個待辦？', text: t.text, ok: '刪除', danger: true })) { const e = dispatch({ type: 'removeTodo', itemId, todoId: t.id }); if (e) toast('已刪除', { undoEntryId: e.id }); } } }, icon('trash')) : h('span', {}));
}
function prepRow(p, editable) {
  return h('div', { class: 'check-row', 'data-done': String(!!p.done) },
    h('button', { class: 'toggle', type: 'button', disabled: !editable, 'aria-pressed': String(!!p.done), onclick: () => { const e = dispatch({ type: 'togglePrep', prepId: p.id, done: !p.done }); if (e && !p.done) toast('已完成', { undoEntryId: e.id }); } },
      h('span', { class: 'box' }, p.done ? icon('check') : null),
      h('span', {}, h('div', { class: 'label' }, p.text), p.done && p.doneBy ? h('div', { class: 'ctx' }, `${p.doneBy} ${fmtTime(p.doneAt)}`) : null)),
    h('span', {}, tagChip(p.trade)));
}

/* ---------- todos ---------- */
function renderTodos() {
  const editable = canEdit(), out = [pendingBanner()];
  const famGroups = [], desGroups = [];
  const general = (state.todos || []);
  const gf = general.filter(t => t.for === 'family'), gd = general.filter(t => t.for !== 'family');
  if (gf.length) famGroups.push({ title: '其他', itemId: null, todos: gf });
  if (gd.length) desGroups.push({ title: '其他', itemId: null, todos: gd });
  state.items.forEach(it => { const f = familyTodos(it), d = designerTodos(it); if (f.length) famGroups.push({ title: it.name, itemId: it.id, todos: f }); if (d.length) desGroups.push({ title: it.name, itemId: it.id, todos: d }); });
  const famOpen = openFamilyCount(), desOpen = openDesignerCount();
  out.push(h('div', { class: 'row between' }, h('div', {}, h('h2', { class: 'h-room' }, '要我們決定'), h('p', { class: 'small muted' }, famOpen ? `還有 ${famOpen} 件` : '都決定好了')), editable ? h('button', { class: 'btn primary', type: 'button', onclick: () => openAddTodoSheet(null) }, icon('plus'), '新增') : null));
  let any = false;
  famGroups.forEach(g => { const open = g.todos.filter(t => !t.done); if (open.length) { any = true; out.push(h('section', { class: 'stack' }, h('h2', { class: 'h-sec' }, g.title), h('div', { class: 'stack-sm' }, open.map(t => todoRow(t, g.itemId, editable))))); } });
  if (!any) out.push(h('div', { class: 'card tone-soft' }, h('p', { class: 'muted' }, '目前沒有需要家人決定的事，其他都交給設計師與水電。')));
  const desBody = h('div', { class: 'stack' });
  desGroups.forEach(g => { const open = g.todos.filter(t => !t.done); if (open.length) desBody.append(h('section', { class: 'stack' }, h('h2', { class: 'h-sec' }, g.title), h('div', { class: 'stack-sm' }, open.map(t => todoRow(t, g.itemId, editable))))); });
  const prepGroups = [...new Set(state.prep.map(p => p.group))];
  prepGroups.forEach(gn => { const ps = state.prep.filter(p => p.group === gn && !p.done); if (ps.length) desBody.append(h('section', { class: 'stack' }, h('h2', { class: 'h-sec' }, '前置工程・' + gn), h('div', { class: 'stack-sm' }, ps.map(p => prepRow(p, editable))))); });
  out.push(fold(`給設計師／水電（${desOpen}）`, desBody, { cls: 'card flat' }));
  const doneList = [];
  [...famGroups, ...desGroups].forEach(g => g.todos.filter(t => t.done).forEach(t => doneList.push(todoRow(t, g.itemId, editable, g.title))));
  state.prep.filter(p => p.done).forEach(p => doneList.push(prepRow(p, editable)));
  if (doneList.length) out.push(fold(`已完成（${doneList.length}）`, h('div', { class: 'stack-sm' }, doneList), { cls: 'card flat' }));
  return out;
}

/* ---------- history ---------- */
let historyShown = 30;
function renderHistory() {
  const out = [pendingBanner()], editable = canEdit();
  out.push(h('p', { class: 'small muted' }, '每一筆都記下誰、哪台裝置、幾點改的；改錯了可以還原。'));
  const hist = [...state.history].reverse();
  if (!hist.length) out.push(h('div', { class: 'card' }, h('p', { class: 'muted' }, '還沒有任何修改。')));
  const list = h('div', { class: 'card flat' });
  hist.slice(0, historyShown).forEach(e => {
    const isLatest = e === hist[0];
    list.append(h('div', { class: 'hist' }, h('div', { class: 'dot' + (e.restore ? ' restore' : '') }),
      h('div', {}, h('div', { class: 'when' }, fmtTime(e.ts, true)), h('div', { class: 'who' }, `${e.who}・${e.device}`), h('div', { class: 'what' }, e.summary),
        editable && e.changes && e.changes.length ? h('div', { class: 'acts' },
          h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (await confirmDialog({ title: '還原這一筆？', text: e.summary, ok: '還原' })) { const r = dispatch({ type: 'restore', entryId: e.id }); if (r) toast('已還原', { undoEntryId: r.id }); } } }, icon('undo'), '還原'),
          !isLatest ? h('button', { class: 'btn sm', type: 'button', onclick: async () => { const n = state.history.length - state.history.findIndex(x => x.id === e.id); if (await confirmDialog({ title: `回到 ${fmtTime(e.ts, true)} 之前？`, text: `會一次復原 ${n} 筆修改（復原本身也會留下紀錄）。`, ok: '回到這之前', danger: true })) { const r = dispatch({ type: 'restoreTo', entryId: e.id }); if (r) toast(`已復原 ${n} 筆`, { undoEntryId: r.id }); } } }, '回到這之前') : null) : null)));
  });
  out.push(list);
  if (hist.length > historyShown) out.push(h('button', { class: 'btn block', type: 'button', onclick: () => { historyShown += 30; render(); } }, `顯示更多（還有 ${hist.length - historyShown} 筆）`));
  if (API.configured && editable) out.push(h('button', { class: 'btn outline block', type: 'button', onclick: openSnapshotsSheet }, icon('cloud'), '雲端快照'));
  return out;
}

/* ---------- share ---------- */
function baseUrl() { return (state.meta.shareUrl || location.href.split('#')[0].split('?')[0]).trim(); }
function designerToken() {
  if (state.meta.shareToken) return state.meta.shareToken;
  if (canEdit()) { const t = Math.random().toString(36).slice(2, 8); dispatch({ type: 'setMeta', patch: { shareToken: t }, summary: '建立設計師專用連結' }, { silent: true }); return t; }
  return 'view';
}
function shareUrlFor(profileId) { const b = baseUrl(); return profileId === 'designer' ? b + (b.includes('?') ? '&' : '?') + 'd=' + designerToken() : b; }
function shareTextFor(profileId) {
  if (profileId === 'designer') return `${state.meta.title}｜設計與水電需求總表（尺寸、開孔、電壓迴路、給排水、排風）`;
  return `${state.meta.title}\n打開後輸入稱呼，就可以一起選方案、打勾。`;
}
async function shareLink(profileId) {
  const url = shareUrlFor(profileId), text = shareTextFor(profileId);
  if (navigator.share) { try { await navigator.share({ title: state.meta.title, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  await copyText(text + '\n' + url, '已複製連結，可以貼到 LINE');
}
async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg || '已複製'); }
  catch { openSheet({ title: '請全選複製', body: () => h('textarea', { class: 'input', readonly: true, style: 'min-height:7rem', onclick: e => e.target.select() }, text), actions: [{ label: '關閉' }] }); }
}

/* ---------- more ---------- */
function renderMore() {
  const editable = canEdit(), out = [pendingBanner()];
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '分享給家人'),
    h('input', { class: 'input', value: baseUrl(), readonly: true, onclick: e => e.target.select() }),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => shareLink('family') }, icon('share'), '分享'), h('button', { class: 'btn', type: 'button', onclick: () => copyText(baseUrl(), '已複製網址') }, '複製網址'))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '設計師專用連結'),
    h('p', { class: 'small muted' }, '設計師打開只看到尺寸、開孔、電壓迴路、給排水與排風需求，可直接列印。'),
    h('input', { class: 'input', value: shareUrlFor('designer'), readonly: true, onclick: e => e.target.select() }),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => shareLink('designer') }, icon('share'), '傳給設計師'), h('button', { class: 'btn', type: 'button', onclick: () => copyText(shareUrlFor('designer'), '已複製設計師連結') }, '複製'), h('button', { class: 'btn', type: 'button', onclick: () => go({ screen: 'doc' }) }, '預覽'))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '我是誰'),
    h('div', { class: 'row between' }, h('div', {}, h('div', { style: 'font-size:1.2rem;font-weight:800' }, (me && me.name) || '（尚未設定）'), h('div', { class: 'small muted' }, deviceName())), h('button', { class: 'btn', type: 'button', onclick: openNameSheet }, '變更'))));
  const curFont = store.get(KEYS.font, 'std');
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '文字大小'), h('div', { class: 'seg' }, [['std', '標準'], ['lg', '大'], ['xl', '特大']].map(([v, l]) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(curFont === v), onclick: () => { store.set(KEYS.font, v); render(); } }, l)))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, '操作教學'), h('button', { class: 'btn sm', type: 'button', onclick: () => showTutorial('family') }, icon('book'), '再看一次'))));
  const cloudLabel = !API.configured ? '尚未設定' : ({ ok: '已連線', none: '已連線（尚無資料）', offline: '連不上', unknown: '連線中…' })[remoteStatus] || remoteStatus;
  const reqs = []; state.items.forEach(it => it.requests.filter(r => r.status === 'pending').forEach(r => reqs.push({ it, r })));
  out.push(fold('雲端與備份', h('div', { class: 'stack' },
    h('div', { class: 'kv' }, h('dt', {}, '狀態'), h('dd', {}, cloudLabel), h('dt', {}, '最後同步'), h('dd', {}, lastSyncAt ? fmtTime(lastSyncAt, true) : '—'), h('dt', {}, '版本'), h('dd', {}, `第 ${state.rev} 版`), h('dt', {}, '未同步'), h('dd', {}, pending.length ? `${pending.length} 筆` : '無'), h('dt', {}, '家庭代碼'), h('dd', {}, API.code ? '已設定' : '未設定')),
    h('div', { class: 'btn-row' }, API.configured ? h('button', { class: 'btn sm', type: 'button', onclick: () => { pollRemote(); toast('已重新同步'); } }, '重新同步') : null, h('button', { class: 'btn sm', type: 'button', onclick: askFamilyCode }, API.code ? '更改家庭代碼' : '輸入家庭代碼'), h('button', { class: 'btn sm', type: 'button', onclick: downloadBackup }, '下載備份'), API.configured ? h('button', { class: 'btn sm', type: 'button', onclick: openSnapshotsSheet }, '雲端快照') : null),
    h('div', { class: 'row', style: 'margin-top:.3rem' }, h('input', { class: 'input grow', id: 'apiInput', value: store.get(KEYS.api, '') || '', placeholder: '連線網址（通常不用改）' }), h('button', { class: 'btn sm', type: 'button', onclick: () => { const v = $('#apiInput').value.trim(); if (v) store.set(KEYS.api, v); else store.del(KEYS.api); location.reload(); } }, '套用')),
    reqs.length ? h('div', {}, h('div', { class: 'eyebrow' }, `請 Claude 幫忙查（${reqs.length}）`), reqs.map(({ it, r }) => h('div', { class: 'note' }, h('div', { class: 'who' }, it.name), h('div', { class: 'txt' }, r.query || r.url), h('div', { class: 'when' }, `${r.who}・${fmtTime(r.ts, true)}`)))) : null,
    h('p', { class: 'tiny' }, `${state.meta.title} v${APP_VERSION}・${state.meta.priceNote}`),
    h('button', { class: 'linkbtn', type: 'button', onclick: async () => { if (await confirmDialog({ title: '重設這台裝置？', text: '會清掉這台裝置記住的稱呼與家庭代碼（雲端資料不受影響）。', ok: '重設', danger: true })) { [KEYS.me, KEYS.font, KEYS.code, KEYS.tut, KEYS.tut + '_designer'].forEach(k => store.del(k)); location.reload(); } } }, '重設這台裝置')), { cls: 'card flat' }));
  return out;
}
async function downloadBackup() {
  const json = JSON.stringify(state, null, 2); const filename = `homechecklist-backup-${todayIso()}.json`;
  try { const blob = new Blob([json], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: filename }); document.body.append(a); a.click(); a.remove(); toast('已下載備份'); return; } catch (e) { console.warn(e); }
  openSheet({ title: '備份資料', body: () => h('textarea', { class: 'input', readonly: true, style: 'min-height:12rem;font-size:.8rem' }, json), actions: [{ label: '關閉' }] });
}

/* ---------- designer document ---------- */
function renderDocScreen(preview) {
  const p = profileOf('designer');
  const right = [h('button', { class: 'btn ghost sm no-print', type: 'button', onclick: () => window.print() }, icon('print'), '列印')];
  if (!preview) right.push(h('button', { class: 'btn ghost sm no-print', type: 'button', onclick: openDesignerMoreSheet, 'aria-label': '更多' }, icon('more'), '更多'));
  const back = preview ? { label: '返回', onClick: () => go({ screen: 'tab', tab: 'more' }) } : null;
  return [topbar({ back, title: '設計與水電需求', right }), h('main', { class: 'content' }, ...renderDoc(p)), toastHost()];
}
function renderDoc(p) {
  const out = [], items = state.items.filter(i => i.status !== 'skipped'), decided = items.filter(i => picksOf(i).length);
  const noPrice = !p.show.price, txt = t => noPrice ? stripPriceSentences(t) : t;
  out.push(h('div', { class: 'doc' }, h('div', { class: 'doc-head' }, h('p', { class: 'eyebrow' }, '設計與水電需求總表'), h('h2', {}, state.meta.title), h('p', { class: 'muted' }, state.meta.subtitle),
    h('p', { class: 'small muted', style: 'margin-top:.3rem' }, `資料更新：${fmtTime(state.updatedAt, true)}（台灣時間）・已決定 ${decided.length}／${items.length} 項`))));
  const allVerify = items.flatMap(i => verifyPoints(i, p).map(v => Object.assign({ item: i.name }, v)));
  if (allVerify.length) out.push(h('div', { class: 'doc' }, h('div', { class: 'verify verify-top' },
    h('div', { class: 'vhead' }, icon('info'), `施工前必須確認（${allVerify.length} 項）`),
    h('p', { class: 'small' }, '以下是目前查到的規格互相矛盾、或原廠沒公開的數字。發包與開孔前請先向廠商確認，不要直接照本文件施工。'),
    h('ul', {}, allVerify.map(v => h('li', {}, h('b', {}, v.item), v.tag ? [' ', chip(v.tag, 'tag')] : null, ' ', v.text))))));
  const allTol = items.flatMap(i => tolerancePoints(i, p).map(v => Object.assign({ item: i.name }, v)));
  if (allTol.length) out.push(h('div', { class: 'doc' }, h('div', { class: 'tol tol-top' },
    h('div', { class: 'vhead' }, icon('pin'), `預留彈性（${allTol.length} 項實務提醒）`),
    h('p', { class: 'small' }, '規格書上塞得下，現場不一定裝得進去。以下位置請不要照最小尺寸抓，留一點可調整的餘裕。'),
    h('ul', {}, allTol.map(v => h('li', {}, h('b', {}, v.item), v.tag ? [' ', chip(v.tag, 'tag')] : null, ' ', v.text))))));
  out.push(h('div', { class: 'banner info no-print' }, icon('info'), h('div', { class: 'small' }, '每個品項列出「選定型號」（或候選方案）的尺寸、開孔與電源；安裝須知用標籤分 ', tagChip('電'), ' ', tagChip('水'), ' ', tagChip('排風'), ' ', tagChip('尺寸'), '。最下方是全屋前置工程清單。內容由屋主隨時更新，列印前建議重新整理。')));
  if (p.show.install) {
    const short = t => { const x = (t || '').split(/[；（(，,。]/)[0].trim(); return x.length > 16 ? x.slice(0, 16) + '…' : x; };
    const quick = items.map(i => { const o = chosenOption(i); const ins = installForProfile(i, p).notes; const tags = [...new Set(ins.map(n => n.tag))]; const powerNote = ins.find(n => n.tag === '電'); const chips = [chip('電：' + short((o && o.power) || (powerNote && powerNote.text) || '—'), 'tag tag-電')]; ['水', '排水', '排風', '搬運'].forEach(t => { if (tags.includes(t)) chips.push(tagChip(t)); }); if (o && o.cutout) chips.push(chip('開孔：' + short(o.cutout), 'tag tag-尺寸')); return h('div', { class: 'row wrap', style: 'padding:.45rem 0;border-top:1px solid var(--line)' }, h('b', { style: 'min-width:7em' }, i.name, (i.defaultQty || 1) > 1 || pickCount(i) > 1 ? h('span', { class: 'tiny' }, ` ×${pickCount(i) || i.defaultQty}`) : null), h('span', { class: 'tiny' }, o ? picksText(i, false) : '未決定'), h('span', { class: 'row wrap', style: 'gap:.3rem' }, chips)); });
    // 需求總表是「一眼掃過」用的，完整內容就在下方各品項，所以設計師版只取每條的第一句
    const gist = s => { const first = String(s || '').split(/[；。]/)[0].trim(); return first.length > 34 ? first.slice(0, 34) + '…' : first; };
    const brief = p.show.extras === false;
    const rows = items.map(i => { const o = chosenOption(i); const ins = installForProfile(i, p).notes;
      const byTag = t => { const parts = ins.filter(n => t.includes(n.tag)).map(n => txt(n.text)).filter(Boolean);
        return (brief ? parts.map(gist) : parts).filter(Boolean).join('；'); }; return h('tr', {}, h('td', {}, h('b', {}, i.name), h('div', { class: 'tiny' }, o ? picksText(i, false) : '未決定')), h('td', {}, pickCount(i) || i.defaultQty || 1), h('td', {}, byTag(['電'])), h('td', {}, byTag(['水', '排水'])), h('td', {}, byTag(['排風'])), h('td', {}, [brief ? gist(o && o.cutout) : (o && o.cutout), byTag(['尺寸', '搬運'])].filter(Boolean).join('；'))); });
    out.push(h('div', { class: 'doc' }, h('h3', { class: 'h-room' }, '需求總表'), h('div', { class: 'card flat only-narrow' }, quick, h('p', { class: 'tiny', style: 'margin-top:.4rem' }, '速覽；完整內容見下方各品項。')),
      h('p', { class: 'tiny only-wide', style: 'margin:-.4rem 0 .2rem' }, '速覽；每個品項的完整尺寸、開孔與安裝須知見下方。'), h('div', { class: 'table-wrap only-wide' }, h('table', { class: 'ctable' }, h('thead', {}, h('tr', {}, h('th', {}, '品項'), h('th', {}, '數量'), h('th', {}, '電'), h('th', {}, '給水／排水'), h('th', {}, '排風'), h('th', {}, '尺寸／預留／搬運'))), h('tbody', {}, rows)))));
  }
  const docEl = h('div', { class: 'doc' });
  state.rooms.forEach(r => { const its = items.filter(i => i.roomId === r.id); if (!its.length) return; const roomEl = h('div', { class: 'room' }, h('h3', {}, r.name, h('span', { class: 'small muted', style: 'font-weight:500;font-family:var(--sans)' }, `${its.length} 項`))); its.forEach(i => roomEl.append(docItem(i, p))); docEl.append(roomEl); });
  out.push(docEl);
  if (p.show.prep) {
    const groups = [...new Set(state.prep.map(x => x.group))];
    out.push(h('div', { class: 'doc' }, h('h3', { class: 'h-room' }, '全屋前置工程清單'), groups.map(gn => h('div', { class: 'ditem' }, h('h4', {}, gn), h('ul', {}, state.prep.filter(x => x.group === gn).map(x => h('li', { style: x.done ? 'color:var(--ink-3);text-decoration:line-through' : '' }, tagChip(x.trade), ' ', x.text)))))));
    const w = state.meta.water; if (w) out.push(h('div', { class: 'card flat' }, h('div', { class: 'eyebrow' }, '自來水水質（官方一手數據）'), h('p', {}, `${w.plant}，採樣 ${w.sampledAt}：總硬度 ${w.hardness} mg/L（${w.grade}）、TDS ${w.tds}、pH ${w.ph}。`), h('p', { class: 'small muted' }, w.note)));
  }
  out.push(h('p', { class: 'tiny', style: 'text-align:center' }, `產生時間 ${fmtTime(nowIso(), true)}`));
  return out;
}
function alertBlocks(it, p) {
  const out = [], vps = verifyPoints(it, p), tps = tolerancePoints(it, p);
  const list = arr => h('ul', {}, arr.map(v => h('li', {}, v.tag ? chip(v.tag, 'tag') : null, ' ', v.text)));
  if (vps.length) out.push(h('div', { class: 'verify' }, h('div', { class: 'vhead' }, icon('info'), '施工前必須確認'), list(vps)));
  if (tps.length) out.push(h('div', { class: 'tol' }, h('div', { class: 'vhead' }, icon('pin'), '預留彈性（實務提醒）'), list(tps)));
  return out;
}
function docItem(i, p) {
  const ps = picksOf(i), noPrice = !p.show.price, txt = t => noPrice ? stripPriceSentences(t) : t;
  const lean = p.show.extras === false;   // 設計師版：只留施工要用的東西
  const el = h('div', { class: 'ditem' }, h('h4', {}, tile(i), i.name, lean ? null : statusChip(i.status), ps.length ? (pickCount(i) > 1 ? chip(`共 ${pickCount(i)} 台`, 'tag') : null) : ((i.defaultQty || 1) > 1 ? chip(`建議 ${i.defaultQty} 台`, 'tag') : null), lean || !i.hardReq ? null : chip('硬需求', 'tag')));
  if (i.hardReq) el.append(h('p', { class: 'small' }, h('b', {}, '硬需求：'), i.hardReq));
  alertBlocks(i, p).forEach(b => el.append(b));
  const optBlock = (opt, label, qty) => {
    const rows = []; const hl = p.show.highlights === false ? [] : (opt.highlights || []).map(txt).filter(Boolean);
    if (p.show.dims) {
      const fields = lean ? [['尺寸', opt.dims], ['開孔／預留', opt.cutout], ['電源', opt.power], ['重量', opt.weight]]
                          : [['尺寸', opt.dims], ['開孔／預留', opt.cutout], ['電源', opt.power], ['重量', opt.weight], ['其他', opt.other]];
      fields.forEach(([k, v]) => { const t = txt(v); if (!t) return;
        if (lean && k === '重量' && String(opt.dims || '').includes(t)) return;   // 尺寸欄已經寫過就別再列一次
        rows.push([k, t]); });
    }
    if (p.show.price) rows.push(['價格', priceText(effectivePrice(opt))]);
    return h('div', {}, h('div', { style: 'font-weight:800' }, label ? label + '：' : '', `${opt.brand} ${opt.model}`, qty > 1 ? ` ×${qty}` : '', lean ? null : [' ', tierChip(opt.tier)], lean || i.pickOptionId !== opt.id ? null : [' ', chip('達人推薦', 'pick')]), txt(opt.name) ? h('div', { class: 'small muted' }, txt(opt.name)) : null,
      hl.length ? h('ul', { class: 'small muted', style: 'margin:.2rem 0' }, hl.map(x => h('li', {}, x))) : null,
      rows.length ? h('table', {}, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v))))) : null, p.show.links ? linkButtons(opt) : null);
  };
  if (ps.length) ps.forEach(pk => el.append(optBlock(pk.option, pk.backup ? '備案（買不到首選才用）' : '選定', pk.backup ? 1 : pk.qty)));
  else if (p.show.options && i.options.length) { el.append(h('div', { class: 'small muted' }, '尚未決定，候選方案：')); sortedOptions(i).forEach(opt => el.append(optBlock(opt))); }
  else el.append(h('div', { class: 'small muted' }, '尚未決定型號'));
  if (p.show.install && i.install.length) {
    const ins = installForProfile(i, p);
    if (ins.notes.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '安裝須知'), installList(ins.notes, noPrice)));
    if (ins.hidden.length) el.append(h('details', { class: 'fold hidden-notes no-print' },
      h('summary', {}, `已隱藏 ${ins.hidden.length} 句其他候選機型的說明`),
      h('ul', { class: 'small muted' }, ins.hidden.map(x => h('li', {}, tagChip(x.tag), ' ', x.text)))));
  }
  if (p.show.advice && txt(i.advice)) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '建議'), h('p', { class: 'small' }, txt(i.advice))));
  const warns = p.show.reviews === false ? [] : i.warnings.map(txt).filter(Boolean); if (warns.length && (p.show.advice || p.show.install)) el.append(h('ul', { class: 'small', style: 'color:var(--attn)' }, warns.map(w => h('li', {}, w))));
  if (p.show.price && i.costNotes.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '費用參考'), h('ul', { class: 'small' }, i.costNotes.map(c => h('li', {}, c)))));
  if (p.show.notes && i.notes.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '家人留言'), i.notes.map(n => h('div', { class: 'note' }, h('span', { class: 'who' }, n.who), ' ', h('span', { class: 'when' }, fmtTime(n.ts, true)), h('div', { class: 'txt' }, n.text)))));
  const dt = designerTodosFor(i, p); if (p.show.todos && dt.todos.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '待確認／待施工'), h('ul', { class: 'small' }, dt.todos.map(t => h('li', { style: t.done ? 'text-decoration:line-through;color:var(--ink-3)' : '' }, t.text)))));
  if (dt.hidden.length) el.append(h('details', { class: 'fold hidden-notes no-print' },
    h('summary', {}, `已隱藏 ${dt.hidden.length} 條待辦（家人已拍板或屬其他候選機型）`),
    h('ul', { class: 'small muted' }, dt.hidden.map(x => h('li', {}, chip(x.tag, 'tag'), ' ', x.text)))));
  return el;
}
