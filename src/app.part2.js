/* ===================== Part 2: rendering ===================== */
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
function tierChip(tier) { return chip(tier, 'tier'); }
function availChip(a) { if (a === 'in_stock') return chip('有現貨', 's-bought'); if (a === 'discontinued') return chip('已下架', 'warn'); if (a === 'unclear') return chip('庫存待確認', 's-choosing'); return null; }
function tagChip(tag) { return chip(tag, 'tag tag-' + tag); }
function section(title, count, ...kids) { return h('section', { class: 'stack' }, h('h2', { class: 'h-sec' }, title, count != null ? h('span', { class: 'count' }, count) : null), ...kids); }
function roomHeader(r, n) { return h('h2', { class: 'h-room' }, r.name, h('span', { class: 'count' }, `${n} 項`)); }

function render() {
  const app = $('#app'); if (!app) return;
  document.documentElement.dataset.font = store.get(KEYS.font, 'std');
  if (!state) { app.replaceChildren(h('main', { class: 'content' }, h('div', { class: 'card' }, h('p', { class: 'muted' }, '載入中…')))); return; }
  const y = window.scrollY;
  let screen;
  if (!role) screen = renderWelcome();
  else if (role === 'designer') screen = renderDocScreen(false);
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
  if (s === 'idle') { if (!API.configured) { s = 'local'; msg = '尚未連線雲端：修改只留在這台裝置（設定完成後會自動同步）'; } else if (remoteStatus === 'offline') { s = 'error'; msg = '目前連不上雲端，修改會先留在手機，連上後自動同步'; } }
  el.dataset.s = s;
  const map = { idle: '', saving: '儲存中…', saved: '已儲存', error: '未同步', local: '未連線', readonly: '檢視' };
  el.replaceChildren(...[s === 'saved' ? icon('check') : (s === 'idle' ? null : icon('cloud')), map[s] || ''].filter(Boolean));
  el.hidden = s === 'idle'; el.title = msg || '';
  el.onclick = () => { if (msg) toast(msg); };
}
function saveStateEl() { const el = h('button', { id: 'saveState', class: 'save-state', type: 'button' }); renderSaveState(el); return el; }
function openTodoCount() { return state.items.reduce((n, i) => n + i.todos.filter(t => !t.done).length, 0) + (state.todos || []).filter(t => !t.done).length + state.prep.filter(p => !p.done).length; }
function tabbar(active) {
  const tabs = [['list', '清單', 'list'], ['todos', '待辦', 'todo'], ['history', '紀錄', 'history'], ['more', '更多', 'more']];
  const open = openTodoCount();
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

/* ---------- welcome / identity ---------- */
function renderWelcome() {
  const pick = id => { role = id; store.set(KEYS.role, role); route = { screen: 'tab', tab: 'list' }; render(); window.scrollTo(0, 0); if (id === 'designer' && !store.get(KEYS.tut + '_designer')) showTutorial('designer'); };
  const main = h('main', { class: 'content welcome' },
    h('p', { class: 'eyebrow' }, '全家共用・南投老家翻修'),
    h('h1', { class: 'big' }, state.meta.title),
    h('p', { class: 'muted' }, '家電採購與安裝需求清單。請先選擇您是誰，之後可以在「更多」更改。'),
    h('button', { class: 'role-btn primary', type: 'button', onclick: () => pick('family') }, h('span', { class: 'tile r-kitchen' }, icon('user')), h('div', {}, h('div', { class: 't' }, '我是家人'), h('div', { class: 'd' }, '負責選擇與採購：看價格、比價、選方案、打勾、留言')), icon('next')),
    h('button', { class: 'role-btn', type: 'button', onclick: () => pick('designer') }, h('span', { class: 'tile r-living' }, icon('book')), h('div', {}, h('div', { class: 't' }, '我是設計師'), h('div', { class: 'd' }, '整合設計與水電：看尺寸、開孔、電壓迴路、給排水、排風；不顯示價格')), icon('next')),
    h('p', { class: 'tiny' }, '這個網址是固定的，不用登入，可以直接傳給家人或設計師。'));
  return [main];
}
function renderNameEntry() {
  const names = knownNames();
  const input = h('input', { class: 'input', type: 'text', placeholder: '例如：爸爸、媽媽、阿華', autocomplete: 'off', maxlength: '20', style: 'font-size:1.2rem', id: 'nameInput' });
  const dev = deviceLabel();
  const start = () => { const name = input.value.trim(); if (!name) { input.focus(); toast('請先輸入稱呼'); return; } me = { name, device: dev }; store.set(KEYS.me, me); route = { screen: 'tab', tab: 'list' }; render(); window.scrollTo(0, 0); if (!store.get(KEYS.tut)) showTutorial('family'); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
  const main = h('main', { class: 'content welcome' },
    h('h1', { class: 'big' }, '請問怎麼稱呼您？'),
    h('p', { class: 'muted' }, '每一筆修改都會記下是誰、用哪台裝置改的，家人才看得懂。只需要輸入一次。'),
    h('div', { class: 'field' }, h('label', { for: 'nameInput' }, '稱呼'), input),
    names.length ? h('div', { class: 'row wrap' }, h('span', { class: 'small muted' }, '或點選：'), names.map(n => h('button', { class: 'btn sm', type: 'button', onclick: () => { input.value = n; } }, n))) : null,
    h('p', { class: 'small muted' }, '這台裝置：', dev),
    h('button', { class: 'btn primary lg block', type: 'button', onclick: start }, '開始使用'),
    h('button', { class: 'linkbtn', type: 'button', onclick: () => { role = null; store.del(KEYS.role); render(); } }, '← 我不是家人，回上一步'));
  setTimeout(() => input.focus(), 50);
  return [main];
}

/* ---------- tab screens ---------- */
function renderTabScreen() {
  const tab = route.tab || 'list';
  const titles = { list: state.meta.title, todos: '待辦事項', history: '修改紀錄', more: '更多' };
  const body = { list: renderList, todos: renderTodos, history: renderHistory, more: renderMore }[tab]();
  return [topbar({ title: titles[tab], right: [saveStateEl()] }), h('main', { class: 'content' }, ...body), tabbar(tab), toastHost()];
}
function pendingBanner() {
  if (!pending.length) return null;
  if (saveState.s === 'saving' || saveState.s === 'saved') return null;
  const msg = !API.configured ? '雲端還沒設定好（見 SETUP.md），修改先留在這台裝置，設定完成後會自動同步。' : (saveState.msg || '稍後會自動再試');
  return h('div', { class: 'banner warn pending-banner' }, icon('warn'), h('div', { class: 'grow' }, `有 ${pending.length} 筆修改還沒存到雲端。`, h('div', { class: 'small', style: 'margin-top:.2rem' }, msg),
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
  if (choosing.length) { const hard = choosing.find(i => i.hardReq) || choosing[0]; return { t: `先決定「${hard.name}」`, d: hard.hardReq ? `硬需求：${hard.hardReq}` : `還有 ${choosing.length} 項沒決定，按進去比較方案、按「選這個」。`, go: () => go({ screen: 'item', itemId: hard.id }) }; }
  const open = openTodoCount();
  if (open) return { t: `還有 ${open} 項待辦`, d: '量尺寸、拉電線、確認規格，做完就打勾。', go: () => go({ screen: 'tab', tab: 'todos' }) };
  const notBought = items.filter(i => i.status === 'decided');
  if (notBought.length) return { t: `有 ${notBought.length} 項已決定、還沒買`, d: '到品項頁按「MOMO 看商品」下單後，記得改成「已購買」。', go: () => go({ screen: 'item', itemId: notBought[0].id }) };
  return { t: '全部完成！', d: '所有品項都已決定、待辦都打勾了。', go: null };
}
function renderList() {
  const items = state.items;
  const active = items.filter(i => i.status !== 'skipped');
  const decided = active.filter(i => ['decided', 'bought', 'installed'].includes(i.status)).length;
  const bought = active.filter(i => ['bought', 'installed'].includes(i.status)).length;
  const pct = active.length ? Math.round(decided / active.length * 100) : 0;
  let decidedSum = 0, decidedN = 0;
  active.forEach(i => { const o = chosenOption(i); const v = o && priceValue(effectivePrice(o)); if (v != null) { decidedSum += v; decidedN++; } });
  const est = { cp: 0, mid: 0, top: 0 }; active.forEach(i => ['cp', 'mid', 'top'].forEach(k => { const v = tierEstimate(i, k); if (v != null) est[k] += v; }));
  const out = [pendingBanner()];
  const ring = h('div', { class: 'ring', style: `--p:${pct}` }, h('span', {}, `${decided}/${active.length}`, h('small', {}, '已決定')));
  out.push(h('div', { class: 'hero' },
    h('div', {}, h('p', { class: 'eyebrow' }, '全家共用・南投老家翻修'), h('h2', { class: 'h-hero' }, state.meta.title), h('p', { class: 'sub' }, `已購買 ${bought} 項・待辦未完成 ${openTodoCount()} 項${decidedN ? `・已決定合計 ${fmtMoney(decidedSum)}` : ''}`)),
    ring,
    h('div', { class: 'hero-actions' }, h('button', { class: 'btn sm', type: 'button', onclick: () => shareLink('family') }, icon('share'), '分享給家人'), h('button', { class: 'btn sm', type: 'button', onclick: () => shareLink('designer') }, icon('book'), '分享給設計師'))));
  const ns = nextStep();
  out.push(h(ns.go ? 'button' : 'div', { class: 'card next' + (ns.go ? ' item-row' : ''), type: ns.go ? 'button' : null, style: ns.go ? 'grid-template-columns:1fr auto' : '', onclick: ns.go || null },
    h('div', {}, h('div', { class: 'eyebrow' }, '下一步'), h('div', { class: 't' }, ns.t), h('div', { class: 'small muted' }, ns.d)), ns.go ? icon('next', 'arrow') : null));
  out.push(h('details', { class: 'card flat' },
    h('summary', { style: 'cursor:pointer;font-weight:800;font-size:1.05rem;display:flex;justify-content:space-between;align-items:center;min-height:2.4rem' }, h('span', {}, '預算總覽'), h('span', { class: 'price' }, decidedN ? fmtMoney(decidedSum) : '—')),
    h('p', { class: 'small muted' }, decidedN ? `已決定 ${decidedN} 項的合計（以目前查到的價格計）` : '還沒有已決定的品項'),
    h('div', { class: 'summary' }, [['cp', '全選高CP值'], ['mid', '全選高級'], ['top', '全選頂級']].map(([k, l]) => h('div', { class: 'cell' }, h('div', { class: 'v', style: 'font-size:1.02rem' }, fmtMoney(est[k])), h('div', { class: 'k' }, l)))),
    h('div', { class: 'table-wrap' }, h('table', { class: 'ctable', style: 'min-width:420px' }, h('thead', {}, h('tr', {}, h('th', {}, '品項'), h('th', {}, '高CP值'), h('th', {}, '高級'), h('th', {}, '頂級'))),
      h('tbody', {}, active.map(i => h('tr', {}, h('td', {}, i.name), ['cp', 'mid', 'top'].map(k => { const v = tierEstimate(i, k); return h('td', {}, v == null ? '—' : v.toLocaleString('en-US')); })))))),
    h('p', { class: 'tiny' }, state.budget.note)));
  state.rooms.forEach(r => { const its = items.filter(i => i.roomId === r.id); if (its.length) out.push(h('section', { class: 'stack' }, roomHeader(r, its.length), its.map(itemRow))); });
  out.push(h('p', { class: 'tiny', style: 'text-align:center' }, state.meta.priceNote, prices && prices.checkedAt ? `（PChome 價格更新：${fmtDateShort(prices.checkedAt)}）` : ''));
  return out;
}
function itemRow(it) {
  const o = chosenOption(it);
  const openTodos = it.todos.filter(t => !t.done).length, pendingReq = it.requests.filter(r => r.status === 'pending').length;
  const sub = o ? `${o.brand} ${o.model}${profileOf(role).show.price ? '　' + priceText(effectivePrice(o)) : ''}` : (it.status === 'skipped' ? '這次不買' : `${it.options.length} 個方案可以選${it.pickOptionId ? '・有專家建議' : ''}`);
  return h('button', { class: 'item-row', type: 'button', onclick: () => go({ screen: 'item', itemId: it.id }) }, tile(it),
    h('div', {}, h('div', { class: 'title' }, it.name), h('div', { class: 'sub' }, sub),
      h('div', { class: 'meta' }, statusChip(it.status), it.hardReq ? chip('有硬需求', 'tag') : null, openTodos ? chip(`待辦 ${openTodos}`, 'tag') : null, it.notes.length ? chip(`留言 ${it.notes.length}`, 'tag') : null, pendingReq ? chip(`待查 ${pendingReq}`, 'warn') : null)),
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
function renderItemBody(it) {
  const prof = profileOf(role), editable = canEdit(), out = [pendingBanner()];
  out.push(h('div', { class: 'row' }, tile(it), h('div', {}, h('div', { class: 'small muted' }, room(it.roomId).name), h('div', { style: 'font-weight:700' }, it.short))));
  const grid = h('div', { class: 'status-grid' }, ['choosing', 'decided', 'bought', 'installed'].map(st => h('button', { class: 'btn s-' + st, type: 'button', 'aria-pressed': String(it.status === st), disabled: !editable, onclick: () => { if (it.status === st) return; const e = dispatch({ type: 'setStatus', itemId: it.id, status: st }); if (e) toast(`已改為「${STATUS[st].label}」`, { undoEntryId: e.id }); } }, STATUS[st].label, h('span', { class: 'hint' }, STATUS[st].hint))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '進度'), grid,
    editable ? h('button', { class: 'linkbtn', type: 'button', onclick: async () => { if (it.status === 'skipped') { dispatch({ type: 'setStatus', itemId: it.id, status: 'choosing' }); return; } if (await confirmDialog({ title: `「${it.name}」這次不買？`, text: '會標示為「不需要」，之後隨時可以改回來。', ok: '標示為不需要' })) { const e = dispatch({ type: 'setStatus', itemId: it.id, status: 'skipped' }); if (e) toast('已標示為不需要', { undoEntryId: e.id }); } } }, it.status === 'skipped' ? '改回「考慮中」' : '這次不買（標示為不需要）') : null));
  if (it.hardReq) out.push(h('div', { class: 'banner info' }, icon('pin'), h('div', {}, h('b', {}, '硬需求：'), it.hardReq)));
  if (it.warnings.length) out.push(h('div', { class: 'banner warn' }, icon('warn'), h('ul', { style: 'padding-left:1.1em' }, it.warnings.map(w => h('li', {}, w)))));
  const chosen = chosenOption(it);
  if (chosen) out.push(h('div', { class: 'card tone-accent' }, h('div', { class: 'eyebrow' }, '目前選擇'), optionCard(it, chosen, { prof, editable })));
  else if (it.status !== 'skipped') out.push(h('div', { class: 'card tone-attn' }, h('div', { class: 'eyebrow' }, '目前選擇'), h('p', {}, '還沒決定。比較下面的方案，按「選這個」就完成。', it.pickOptionId ? '有「專家建議」標記的方案排在最前面。' : '')));
  if (prof.show.options) { const opts = sortedOptions(it).filter(o => !chosen || o.id !== chosen.id); out.push(section(chosen ? '其他方案' : '方案比較', `${it.options.length} 個`, opts.map(o => optionCard(it, o, { prof, editable })))); }
  if (editable) out.push(h('button', { class: 'btn outline block lg', type: 'button', onclick: () => openAddProductSheet(it) }, icon('plus'), '新增其他商品（貼連結或輸入關鍵字）'));
  const reqs = it.requests.filter(r => r.status === 'pending');
  if (reqs.length && prof.show.notes) out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '等 Claude 幫忙查'), reqs.map(r => h('div', { class: 'row between' }, h('div', { class: 'grow' }, h('div', {}, r.query || r.url), h('div', { class: 'tiny' }, `${r.who}・${fmtTime(r.ts)}`)), editable ? h('button', { class: 'btn sm', type: 'button', onclick: () => dispatch({ type: 'updateRequest', itemId: it.id, requestId: r.id, patch: { status: 'done' } }) }, '已處理') : null))));
  if (prof.show.advice && it.advice) out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '專家建議'), h('p', {}, it.advice)));
  if (prof.show.install && it.install.length) out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '安裝須知（給設計師／水電）'), h('div', {}, installList(it.install))));
  if (prof.show.price && it.costNotes.length) out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '費用參考'), h('ul', { class: 'small' }, it.costNotes.map(c => h('li', {}, c)))));
  if (prof.show.todos) { const open = it.todos.filter(t => !t.done), done = it.todos.filter(t => t.done); out.push(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, `待辦（${open.length} 未完成）`), editable ? h('button', { class: 'btn sm', type: 'button', onclick: () => openAddTodoSheet(it.id) }, icon('plus'), '新增') : null), open.length || done.length ? h('div', { class: 'stack-sm' }, open.map(t => todoRow(t, it.id, editable)), done.map(t => todoRow(t, it.id, editable))) : h('p', { class: 'small muted' }, '沒有待辦'))); }
  if (prof.show.notes) out.push(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'eyebrow' }, `家人留言（${it.notes.length}）`), editable ? h('button', { class: 'btn sm', type: 'button', onclick: () => openNoteSheet(it.id) }, icon('plus'), '留言') : null),
    it.notes.length ? h('div', { class: 'stack-sm' }, [...it.notes].reverse().map(n => h('div', { class: 'note' }, h('div', { class: 'row between' }, h('span', { class: 'who' }, n.who), h('span', { class: 'when' }, fmtTime(n.ts, true))), h('div', { class: 'txt' }, n.text), editable && me && n.who === me.name ? h('button', { class: 'linkbtn small', type: 'button', onclick: async () => { if (await confirmDialog({ title: '刪除這則留言？', ok: '刪除', danger: true })) dispatch({ type: 'removeNote', itemId: it.id, noteId: n.id }); } }, '刪除') : null))) : h('p', { class: 'small muted' }, '還沒有留言。有想法就寫下來，全家都看得到。')));
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
    search.length ? h('div', { class: 'link-row' }, search.map(l => linkBtn(l, true))) : null,
    h('div', { class: 'link-row' }, h('a', { class: 'btn sm lnk-cmp', href: cu.feebee, target: '_blank', rel: 'noopener noreferrer' }, '飛比價格 即時比價', icon('ext')), h('a', { class: 'btn sm lnk-cmp', href: cu.biggo, target: '_blank', rel: 'noopener noreferrer' }, 'BigGo 即時比價', icon('ext'))));
}
function priceBlock(o) {
  const p = effectivePrice(o), lp = livePrice(o);
  return h('div', {},
    h('div', { class: 'row wrap' }, h('span', { class: 'price' }, priceText(p)), p && p.source ? chip(SOURCE_LABEL[p.source] || p.source, 'src') : null, p && p.live ? chip(`今日價 ${fmtDateShort(p.checkedAt)}`, 'live') : (p && p.checkedAt ? h('span', { class: 'tiny' }, fmtDate(p.checkedAt) + ' 查') : null)),
    lp && lp.qty === 0 ? h('div', { class: 'tiny', style: 'color:var(--attn)' }, `PChome 今日顯示缺貨（${fmtDateShort(lp.checkedAt)}）`) : null,
    o.price && o.price.note ? h('div', { class: 'tiny', style: 'margin-top:.15rem' }, o.price.note) : null);
}
function optionCard(it, o, { prof, editable }) {
  const chosen = it.chosenOptionId === o.id, picked = it.pickOptionId === o.id;
  const kv = [];
  if (prof.show.dims) { if (o.dims) kv.push(['尺寸', o.dims]); if (o.cutout) kv.push(['開孔／預留', o.cutout]); if (o.power) kv.push(['電源', o.power]); if (o.weight) kv.push(['重量', o.weight]); if (o.other) kv.push(['其他', o.other]); }
  return h('div', { class: 'opt' + (chosen ? ' chosen' : '') + (picked ? ' picked' : '') },
    h('div', { class: 'row wrap' }, picked ? chip('專家建議', 'pick') : null, tierChip(o.tier), availChip(o.availability), chosen ? chip('已選擇', 's-decided') : null),
    h('div', { class: 'model' }, `${o.brand} ${o.model}`),
    o.name ? h('div', { class: 'name' }, o.name) : null,
    o.highlights && o.highlights.length ? h('ul', { class: 'hl' }, o.highlights.map(x => h('li', {}, x))) : null,
    picked && it.pickReason ? h('div', { class: 'pick-reason' }, '建議原因：', it.pickReason) : null,
    prof.show.price ? priceBlock(o) : null,
    prof.show.links ? linkButtons(o) : null,
    kv.length ? h('dl', { class: 'kv' }, kv.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])) : null,
    o.note ? h('div', { class: 'small muted' }, '備註：', o.note) : null,
    editable ? h('div', { class: 'btn-row' },
      chosen ? h('button', { class: 'btn', type: 'button', onclick: () => { const e = dispatch({ type: 'choose', itemId: it.id, optionId: null }); if (e) toast('已取消選擇', { undoEntryId: e.id }); } }, '取消選擇')
        : h('button', { class: 'btn primary', type: 'button', onclick: () => { const e = dispatch({ type: 'choose', itemId: it.id, optionId: o.id }); if (e) toast(`已選 ${o.model}`, { undoEntryId: e.id }); } }, icon('check'), '選這個'),
      h('button', { class: 'btn', type: 'button', onclick: () => openPriceSheet(it, o) }, '回報價格／連結'),
      o.tier === '家人推薦' ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirmDialog({ title: `移除 ${o.model}？`, text: '只會從方案清單移除，紀錄裡還找得到、也可以還原。', ok: '移除', danger: true })) { const e = dispatch({ type: 'removeOption', itemId: it.id, optionId: o.id }); if (e) toast('已移除', { undoEntryId: e.id }); } } }, icon('trash'), '移除') : null) : null);
}
function todoRow(t, itemId, editable, ctx) {
  return h('div', { class: 'check-row', 'data-done': String(!!t.done) },
    h('button', { class: 'toggle', type: 'button', disabled: !editable, 'aria-pressed': String(!!t.done), onclick: () => { const e = dispatch({ type: 'toggleTodo', itemId, todoId: t.id, done: !t.done }); if (e && !t.done) toast('已完成', { undoEntryId: e.id }); } },
      h('span', { class: 'box' }, t.done ? icon('check') : null),
      h('span', {}, h('div', { class: 'label' }, t.text), ctx || t.done ? h('div', { class: 'ctx' }, [ctx, t.done && t.doneBy ? `${t.doneBy} 於 ${fmtTime(t.doneAt)} 完成` : null].filter(Boolean).join('・')) : null)),
    editable ? h('button', { class: 'del', type: 'button', 'aria-label': '刪除', onclick: async () => { if (await confirmDialog({ title: '刪除這個待辦？', text: t.text, ok: '刪除', danger: true })) { const e = dispatch({ type: 'removeTodo', itemId, todoId: t.id }); if (e) toast('已刪除', { undoEntryId: e.id }); } } }, icon('trash')) : h('span', {}));
}
function prepRow(p, editable) {
  return h('div', { class: 'check-row', 'data-done': String(!!p.done) },
    h('button', { class: 'toggle', type: 'button', disabled: !editable, 'aria-pressed': String(!!p.done), onclick: () => { const e = dispatch({ type: 'togglePrep', prepId: p.id, done: !p.done }); if (e && !p.done) toast('已完成', { undoEntryId: e.id }); } },
      h('span', { class: 'box' }, p.done ? icon('check') : null),
      h('span', {}, h('div', { class: 'label' }, p.text), h('div', { class: 'ctx' }, [p.trade, p.done && p.doneBy ? `${p.doneBy} 於 ${fmtTime(p.doneAt)} 完成` : null].filter(Boolean).join('・')))),
    h('span', {}, tagChip(p.trade)));
}

/* ---------- todos ---------- */
function renderTodos() {
  const editable = canEdit(), out = [pendingBanner()];
  const groups = []; const general = (state.todos || []); if (general.length) groups.push({ title: '一般待辦', itemId: null, todos: general });
  state.items.forEach(it => { if (it.todos.length) groups.push({ title: it.name, itemId: it.id, todos: it.todos }); });
  const openTotal = groups.reduce((n, g) => n + g.todos.filter(t => !t.done).length, 0);
  out.push(h('div', { class: 'row between' }, h('p', { class: 'muted' }, `品項待辦未完成 ${openTotal} 項`), editable ? h('button', { class: 'btn primary', type: 'button', onclick: () => openAddTodoSheet(null) }, icon('plus'), '新增待辦') : null));
  groups.forEach(g => { const open = g.todos.filter(t => !t.done); if (open.length) out.push(section(g.title, null, h('div', { class: 'stack-sm' }, open.map(t => todoRow(t, g.itemId, editable))))); });
  const prepGroups = [...new Set(state.prep.map(p => p.group))]; const prepOpen = state.prep.filter(p => !p.done).length;
  out.push(h('h2', { class: 'h-room', style: 'margin-top:.4rem' }, '全屋前置工程', h('span', { class: 'count' }, `${prepOpen} 未完成`)));
  out.push(h('p', { class: 'small muted', style: 'margin-top:-.5rem' }, '水電／木作施工前要先做好的事，和師傅確認完成就打勾。'));
  prepGroups.forEach(gn => { const ps = state.prep.filter(p => p.group === gn && !p.done); if (ps.length) out.push(section(gn, null, h('div', { class: 'stack-sm' }, ps.map(p => prepRow(p, editable))))); });
  const doneList = []; groups.forEach(g => g.todos.filter(t => t.done).forEach(t => doneList.push(todoRow(t, g.itemId, editable, g.title)))); state.prep.filter(p => p.done).forEach(p => doneList.push(prepRow(p, editable)));
  if (doneList.length) out.push(h('details', { class: 'card flat' }, h('summary', { style: 'cursor:pointer;font-weight:800;min-height:2.4rem;display:flex;align-items:center' }, `已完成（${doneList.length}）`), h('div', { class: 'stack-sm', style: 'margin-top:.5rem' }, doneList)));
  return out;
}

/* ---------- history ---------- */
let historyShown = 30;
function renderHistory() {
  const out = [pendingBanner()], editable = canEdit();
  out.push(h('div', { class: 'banner info' }, icon('history'), h('div', {}, '每一筆修改都記下了是誰、哪台裝置、幾月幾號幾點改的。改錯了可以按「還原這一筆」，或「回到這之前」一次復原後面所有修改。雲端（Google 試算表）也有同樣的紀錄與快照。')));
  const hist = [...state.history].reverse();
  if (state.historyTrimmedAt) out.push(h('p', { class: 'tiny' }, `為了控制大小，${fmtTime(state.historyTrimmedAt, true)} 之前較舊的紀錄已精簡（試算表裡仍有完整紀錄）。`));
  if (!hist.length) out.push(h('div', { class: 'card' }, h('p', { class: 'muted' }, '還沒有任何修改。')));
  const list = h('div', { class: 'card flat' });
  hist.slice(0, historyShown).forEach(e => {
    const isLatest = e === hist[0];
    list.append(h('div', { class: 'hist' }, h('div', { class: 'dot' + (e.restore ? ' restore' : '') }),
      h('div', {}, h('div', { class: 'when' }, fmtTime(e.ts, true)), h('div', { class: 'who' }, `${e.who}・${e.device}`), h('div', { class: 'what' }, e.summary),
        editable && e.changes && e.changes.length ? h('div', { class: 'acts' },
          h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (await confirmDialog({ title: '還原這一筆修改？', text: e.summary + '\n會把這一筆改回修改前的樣子（之後的其他修改不受影響）。', ok: '還原' })) { const r = dispatch({ type: 'restore', entryId: e.id }); if (r) toast('已還原', { undoEntryId: r.id }); } } }, icon('undo'), '還原這一筆'),
          !isLatest ? h('button', { class: 'btn sm', type: 'button', onclick: async () => { const n = state.history.length - state.history.findIndex(x => x.id === e.id); if (await confirmDialog({ title: `回到 ${fmtTime(e.ts, true)} 之前？`, text: `會一次復原這一筆和之後共 ${n} 筆修改。復原本身也會留下紀錄，隨時可以再還原。`, ok: '回到這之前', danger: true })) { const r = dispatch({ type: 'restoreTo', entryId: e.id }); if (r) toast(`已復原 ${n} 筆`, { undoEntryId: r.id }); } } }, '回到這之前') : null) : null)));
  });
  out.push(list);
  if (hist.length > historyShown) out.push(h('button', { class: 'btn block', type: 'button', onclick: () => { historyShown += 30; render(); } }, `顯示更多（還有 ${hist.length - historyShown} 筆）`));
  out.push(h('p', { class: 'tiny', style: 'text-align:center' }, `共 ${state.history.length} 筆紀錄・台灣時間`));
  if (API.configured && editable) out.push(h('button', { class: 'btn outline block', type: 'button', onclick: openSnapshotsSheet }, icon('cloud'), '雲端快照（可整份回復）'));
  return out;
}

/* ---------- share ---------- */
function shareUrlFor() { return (state.meta.shareUrl || location.href.split('#')[0].split('?')[0]).trim(); }
function shareTextFor(profileId) {
  if (profileId === 'designer') return `${state.meta.title}（設計師版）\n打開後請點「我是設計師」，會看到各品項的尺寸、開孔、電壓迴路與給排水需求，可直接列印。`;
  return `${state.meta.title}\n打開後請點「我是家人」、輸入稱呼，就可以一起選方案、打勾。`;
}
async function shareLink(profileId) {
  const url = shareUrlFor(), text = shareTextFor(profileId);
  if (navigator.share) { try { await navigator.share({ title: state.meta.title, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  await copyText(text + '\n' + url, '已複製網址與說明，可以貼到 LINE 傳給對方');
}
async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg || '已複製'); }
  catch { openSheet({ title: '請全選複製', body: () => h('textarea', { class: 'input', readonly: true, style: 'min-height:7rem', onclick: e => e.target.select() }, text), actions: [{ label: '關閉' }] }); }
}

/* ---------- more ---------- */
function renderMore() {
  const editable = canEdit(), out = [pendingBanner()];
  const url = shareUrlFor();
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '分享（固定網址，不用登入）'),
    h('input', { class: 'input', value: url, readonly: true, onclick: e => e.target.select() }),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => shareLink('family') }, icon('share'), '分享給家人'), h('button', { class: 'btn', type: 'button', onclick: () => shareLink('designer') }, icon('book'), '分享給設計師')),
    h('p', { class: 'small muted' }, '所有人用同一個網址。打開後自己選「家人」或「設計師」，手機會記住。設計師版只有尺寸與安裝需求、不顯示價格。'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => go({ screen: 'doc' }) }, '預覽設計師版')));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '我是誰'),
    h('div', { class: 'row between' }, h('div', {}, h('div', { style: 'font-size:1.2rem;font-weight:800' }, (me && me.name) || '（尚未設定）'), h('div', { class: 'small muted' }, '這台裝置：' + deviceLabel())), h('button', { class: 'btn', type: 'button', onclick: openNameSheet }, '變更')),
    h('div', { class: 'seg' }, Object.values(state.profiles).map(p => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(role === p.id), onclick: () => { role = p.id; store.set(KEYS.role, role); route = { screen: 'tab', tab: 'list' }; render(); window.scrollTo(0, 0); } }, '身分：' + p.label)))));
  const curFont = store.get(KEYS.font, 'std');
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '文字大小'), h('div', { class: 'seg' }, [['std', '標準'], ['lg', '大'], ['xl', '特大']].map(([v, l]) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(curFont === v), onclick: () => { store.set(KEYS.font, v); render(); } }, l)))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '操作教學'), h('p', { class: 'small muted' }, '四個步驟，一分鐘看完：怎麼選方案、打勾、還原、分享。'), h('button', { class: 'btn outline', type: 'button', onclick: () => showTutorial('family') }, icon('book'), '再看一次操作教學')));
  // cloud
  const cloudLabel = !API.configured ? '尚未設定（見 SETUP.md）' : ({ ok: '已連線', none: '已連線（雲端還沒有資料，第一次儲存時會建立）', offline: '連不上', unknown: '連線中…' })[remoteStatus] || remoteStatus;
  const reqs = []; state.items.forEach(it => it.requests.filter(r => r.status === 'pending').forEach(r => reqs.push({ it, r })));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '雲端（Google 試算表）'),
    h('div', { class: 'kv' }, h('dt', {}, '狀態'), h('dd', {}, cloudLabel), h('dt', {}, '最後同步'), h('dd', {}, lastSyncAt ? fmtTime(lastSyncAt, true) : '—'), h('dt', {}, '資料版本'), h('dd', {}, `第 ${state.rev} 版・${fmtTime(state.updatedAt, true)}`), h('dt', {}, '未同步'), h('dd', {}, pending.length ? `${pending.length} 筆` : '無'), h('dt', {}, '家庭代碼'), h('dd', {}, API.code ? '已設定' : '未設定')),
    h('div', { class: 'btn-row' }, API.configured ? h('button', { class: 'btn sm', type: 'button', onclick: () => { pollRemote(); toast('已重新同步'); } }, '重新同步') : null, h('button', { class: 'btn sm', type: 'button', onclick: askFamilyCode }, API.code ? '更改家庭代碼' : '輸入家庭代碼'), h('button', { class: 'btn sm', type: 'button', onclick: downloadBackup }, '下載備份檔'), API.configured ? h('button', { class: 'btn sm', type: 'button', onclick: openSnapshotsSheet }, '雲端快照') : null),
    h('details', {}, h('summary', { class: 'tiny', style: 'cursor:pointer;min-height:2rem;display:flex;align-items:center' }, '進階：連線網址'), h('div', { class: 'row', style: 'margin-top:.3rem' }, h('input', { class: 'input grow', id: 'apiInput', value: store.get(KEYS.api, '') || '', placeholder: API.url || 'https://script.google.com/macros/s/…/exec' }), h('button', { class: 'btn sm', type: 'button', onclick: () => { const v = $('#apiInput').value.trim(); if (v) store.set(KEYS.api, v); else store.del(KEYS.api); location.reload(); } }, '套用')), h('p', { class: 'tiny' }, '通常不用改：網站會自動讀取 config.json 的設定。這裡只覆蓋這台裝置。'))));
  if (reqs.length) out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, `請 Claude 幫忙查（${reqs.length}）`), h('div', { class: 'stack-sm' }, reqs.map(({ it, r }) => h('div', { class: 'note' }, h('div', { class: 'who' }, it.name), h('div', { class: 'txt' }, r.query || '', r.url ? h('div', {}, h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.url)) : null), h('div', { class: 'when' }, `${r.who}・${fmtTime(r.ts, true)}`))))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, '關於'), h('p', { class: 'small muted' }, `${state.meta.title} v${APP_VERSION}。資料來源：2026/8/22 全屋家電採購報告＋MOMO／PChome 逐項實查；PChome 價格每日自動更新。${state.meta.priceNote}`),
    h('button', { class: 'linkbtn', type: 'button', onclick: async () => { if (await confirmDialog({ title: '重設這台裝置？', text: '會清掉這台裝置記住的稱呼、身分與家庭代碼（雲端資料不受影響）。', ok: '重設', danger: true })) { [KEYS.me, KEYS.role, KEYS.font, KEYS.code, KEYS.tut, KEYS.tut + '_designer'].forEach(k => store.del(k)); location.reload(); } } }, '重設這台裝置的設定')));
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
  const back = preview ? { label: '回家人版', onClick: () => go({ screen: 'tab', tab: 'more' }) } : null;
  return [topbar({ back, title: '設計師版', right }), h('main', { class: 'content' }, ...renderDoc(p)), toastHost()];
}
function renderDoc(p) {
  const out = [], items = state.items.filter(i => i.status !== 'skipped'), decided = items.filter(i => chosenOption(i));
  const noPrice = !p.show.price, txt = t => noPrice ? stripPriceSentences(t) : t;
  out.push(h('div', { class: 'doc' }, h('div', { class: 'doc-head' }, h('p', { class: 'eyebrow' }, '設計師版・整合設計與水電需求'), h('h2', {}, state.meta.title), h('p', { class: 'muted' }, state.meta.subtitle),
    h('p', { class: 'small muted', style: 'margin-top:.3rem' }, `資料更新：${fmtTime(state.updatedAt, true)}（台灣時間）・已決定 ${decided.length}／${items.length} 項${noPrice ? '・本版不含價格' : ''}`))));
  out.push(h('div', { class: 'banner info no-print' }, icon('info'), h('div', { class: 'small' }, '怎麼看：每個品項列出「選定型號」（或候選方案）的尺寸、開孔與電源；安裝須知用顏色標籤分 ', tagChip('電'), ' ', tagChip('水'), ' ', tagChip('排風'), ' ', tagChip('尺寸'), '。最下方是全屋前置工程清單。資料由家人即時更新，列印前建議重新整理。')));
  if (p.show.install) {
    const short = t => { const x = (t || '').split(/[；（(，,。]/)[0].trim(); return x.length > 16 ? x.slice(0, 16) + '…' : x; };
    const quick = items.map(i => { const o = chosenOption(i); const tags = [...new Set(i.install.map(n => n.tag))]; const powerNote = i.install.find(n => n.tag === '電'); const chips = [chip('電：' + short((o && o.power) || (powerNote && powerNote.text) || '—'), 'tag tag-電')]; ['水', '排水', '排風', '搬運'].forEach(t => { if (tags.includes(t)) chips.push(tagChip(t)); }); if (o && o.cutout) chips.push(chip('開孔：' + short(o.cutout), 'tag tag-尺寸')); return h('div', { class: 'row wrap', style: 'padding:.45rem 0;border-top:1px solid var(--line)' }, h('b', { style: 'min-width:7em' }, i.name), h('span', { class: 'tiny' }, o ? `${o.brand} ${o.model}` : '未決定'), h('span', { class: 'row wrap', style: 'gap:.3rem' }, chips)); });
    const rows = items.map(i => { const o = chosenOption(i); const byTag = t => i.install.filter(n => t.includes(n.tag)).map(n => txt(n.text)).filter(Boolean).join('；'); return h('tr', {}, h('td', {}, h('b', {}, i.name), h('div', { class: 'tiny' }, o ? `${o.brand} ${o.model}` : '未決定')), h('td', {}, byTag(['電'])), h('td', {}, byTag(['水', '排水'])), h('td', {}, byTag(['排風'])), h('td', {}, [o && o.cutout, byTag(['尺寸', '搬運'])].filter(Boolean).join('；'))); });
    out.push(h('div', { class: 'doc' }, h('h3', { class: 'h-room' }, '需求總表'), h('div', { class: 'card flat only-narrow' }, quick, h('p', { class: 'tiny', style: 'margin-top:.4rem' }, '速覽；完整內容見下方各品項。')),
      h('div', { class: 'table-wrap only-wide' }, h('table', { class: 'ctable' }, h('thead', {}, h('tr', {}, h('th', {}, '品項'), h('th', {}, '電'), h('th', {}, '給水／排水'), h('th', {}, '排風'), h('th', {}, '尺寸／預留／搬運'))), h('tbody', {}, rows)))));
  }
  const docEl = h('div', { class: 'doc' });
  state.rooms.forEach(r => { const its = items.filter(i => i.roomId === r.id); if (!its.length) return; const roomEl = h('div', { class: 'room' }, h('h3', {}, r.name, h('span', { class: 'small muted', style: 'font-weight:500;font-family:var(--sans)' }, `${its.length} 項`))); its.forEach(i => roomEl.append(docItem(i, p))); docEl.append(roomEl); });
  out.push(docEl);
  if (p.show.prep) {
    const groups = [...new Set(state.prep.map(x => x.group))];
    out.push(h('div', { class: 'doc' }, h('h3', { class: 'h-room' }, '全屋前置工程清單'), groups.map(gn => h('div', { class: 'ditem' }, h('h4', {}, gn), h('ul', {}, state.prep.filter(x => x.group === gn).map(x => h('li', { style: x.done ? 'color:var(--ink-3);text-decoration:line-through' : '' }, tagChip(x.trade), ' ', x.text)))))));
    const w = state.meta.water; if (w) out.push(h('div', { class: 'card flat' }, h('div', { class: 'eyebrow' }, '自來水水質（官方一手數據）'), h('p', {}, `${w.plant}，採樣 ${w.sampledAt}：總硬度 ${w.hardness} mg/L（${w.grade}）、TDS ${w.tds}、pH ${w.ph}。`), h('p', { class: 'small muted' }, w.note)));
  }
  out.push(h('p', { class: 'tiny', style: 'text-align:center' }, `本頁由家人清單自動產生・${fmtTime(nowIso(), true)}`));
  return out;
}
function docItem(i, p) {
  const o = chosenOption(i), noPrice = !p.show.price, txt = t => noPrice ? stripPriceSentences(t) : t;
  const el = h('div', { class: 'ditem' }, h('h4', {}, tile(i), i.name, statusChip(i.status), i.hardReq ? chip('硬需求', 'tag') : null));
  if (i.hardReq) el.append(h('p', { class: 'small' }, h('b', {}, '硬需求：'), i.hardReq));
  const optBlock = (opt, label) => {
    const rows = []; const hl = (opt.highlights || []).map(txt).filter(Boolean);
    if (p.show.dims) [['尺寸', opt.dims], ['開孔／預留', opt.cutout], ['電源', opt.power], ['重量', opt.weight], ['其他', opt.other]].forEach(([k, v]) => { const t = txt(v); if (t) rows.push([k, t]); });
    if (p.show.price) rows.push(['價格', priceText(effectivePrice(opt))]);
    return h('div', {}, h('div', { style: 'font-weight:800' }, label ? label + '：' : '', `${opt.brand} ${opt.model}`, ' ', tierChip(opt.tier), i.pickOptionId === opt.id ? [' ', chip('專家建議', 'pick')] : null), txt(opt.name) ? h('div', { class: 'small muted' }, txt(opt.name)) : null,
      hl.length ? h('ul', { class: 'small muted', style: 'margin:.2rem 0' }, hl.map(x => h('li', {}, x))) : null,
      rows.length ? h('table', {}, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v))))) : null, p.show.links ? linkButtons(opt) : null);
  };
  if (o) el.append(optBlock(o, '選定'));
  else if (p.show.options && i.options.length) { el.append(h('div', { class: 'small muted' }, '尚未決定，候選方案：')); sortedOptions(i).forEach(opt => el.append(optBlock(opt))); }
  else el.append(h('div', { class: 'small muted' }, '尚未決定型號'));
  if (p.show.install && i.install.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '安裝須知'), installList(i.install, noPrice)));
  if (p.show.advice && txt(i.advice)) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '專家建議'), h('p', { class: 'small' }, txt(i.advice))));
  const warns = i.warnings.map(txt).filter(Boolean); if (warns.length && (p.show.advice || p.show.install)) el.append(h('ul', { class: 'small', style: 'color:var(--attn)' }, warns.map(w => h('li', {}, w))));
  if (p.show.price && i.costNotes.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '費用參考'), h('ul', { class: 'small' }, i.costNotes.map(c => h('li', {}, c)))));
  if (p.show.notes && i.notes.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '家人留言'), i.notes.map(n => h('div', { class: 'note' }, h('span', { class: 'who' }, n.who), ' ', h('span', { class: 'when' }, fmtTime(n.ts, true)), h('div', { class: 'txt' }, n.text)))));
  if (p.show.todos && i.todos.length) el.append(h('div', {}, h('div', { class: 'eyebrow', style: 'margin-top:.3rem' }, '待辦'), h('ul', { class: 'small' }, i.todos.map(t => h('li', { style: t.done ? 'text-decoration:line-through;color:var(--ink-3)' : '' }, t.text)))));
  return el;
}
