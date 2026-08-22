/**
 * 南投老家翻修清單 — Google 試算表後端（Google Apps Script）
 * 部署方式見 SETUP.md。這個檔案綁定在試算表上：擴充功能 → Apps Script → 貼上全文。
 *
 * 儲存方式：
 *  - 目前完整資料：Google 雲端硬碟資料夾「homechecklist-data」裡的 state.json
 *  - 每次儲存的快照：同資料夾 snapshots/rev-000123.json（最多保留 MAX_SNAPSHOTS 份）
 *  - 試算表分頁：history（誰／哪台裝置／幾點／改了什麼）、summary（目前各品項狀態）、meta
 */
const FAMILY_CODE = '2026';          // ← 家人修改時要輸入一次的「家庭代碼」，請自行更改（留空字串 '' 代表不檢查）
const FOLDER_NAME = 'homechecklist-data';
const MAX_SNAPSHOTS = 200;

function doGet(e) { return respond(safeHandle(e && e.parameter ? e.parameter : {})); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return respond({ ok: false, error: 'bad_json' }); }
  return respond(safeHandle(Object.assign({}, (e && e.parameter) || {}, body)));
}
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function safeHandle(p) {
  try { return handle(p); } catch (err) { return { ok: false, error: 'exception', message: String(err && err.message || err) }; }
}
function handle(p) {
  const action = p.action || 'load';
  if (action === 'ping') return { ok: true, time: new Date().toISOString(), version: 1 };
  if (action === 'load') return load(p);
  if (action === 'save') return save(p);
  if (action === 'snapshots') return listSnapshots();
  if (action === 'snapshot') return getSnapshot(p.rev);
  return { ok: false, error: 'unknown_action' };
}

/* ---------- storage helpers ---------- */
function dataFolder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(FOLDER_NAME);
}
function subFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}
function stateFile() {
  const f = dataFolder();
  const it = f.getFilesByName('state.json');
  return it.hasNext() ? it.next() : null;
}
function readState() {
  const file = stateFile();
  if (!file) return null;
  try { return JSON.parse(file.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}
function writeState(state) {
  const json = JSON.stringify(state);
  const file = stateFile();
  if (file) file.setContent(json);
  else dataFolder().createFile('state.json', json, 'application/json');
}
function writeSnapshot(state) {
  const snaps = subFolder(dataFolder(), 'snapshots');
  const name = 'rev-' + String(state.rev || 0).padStart(6, '0') + '.json';
  snaps.createFile(name, JSON.stringify(state), 'application/json');
  // prune
  const files = [];
  const it = snaps.getFiles();
  while (it.hasNext()) { const f = it.next(); files.push({ name: f.getName(), file: f }); }
  files.sort((a, b) => a.name < b.name ? -1 : 1);
  while (files.length > MAX_SNAPSHOTS) { files.shift().file.setTrashed(true); }
}
function listSnapshots() {
  const snaps = subFolder(dataFolder(), 'snapshots');
  const out = [];
  const it = snaps.getFiles();
  while (it.hasNext()) { const f = it.next(); const m = f.getName().match(/rev-(\d+)\.json/); if (m) out.push({ rev: Number(m[1]), at: f.getLastUpdated().toISOString(), size: f.getSize() }); }
  out.sort((a, b) => b.rev - a.rev);
  return { ok: true, snapshots: out.slice(0, 100) };
}
function getSnapshot(rev) {
  const snaps = subFolder(dataFolder(), 'snapshots');
  const it = snaps.getFilesByName('rev-' + String(Number(rev) || 0).padStart(6, '0') + '.json');
  if (!it.hasNext()) return { ok: false, error: 'not_found' };
  return { ok: true, state: JSON.parse(it.next().getBlob().getDataAsString('UTF-8')) };
}

/* ---------- sheet helpers ---------- */
function sheet(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (headers) { sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); } }
  return sh;
}
function tw(iso) {
  try { return Utilities.formatDate(new Date(iso), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); } catch (e) { return iso; }
}
const STATUS_LABEL = { choosing: '考慮中', decided: '已決定', bought: '已購買', installed: '已安裝', skipped: '不需要' };
function priceText(p) {
  if (!p) return '';
  if (typeof p.amount === 'number') return 'NT$' + p.amount.toLocaleString('en-US');
  if (typeof p.min === 'number') return '約 NT$' + p.min.toLocaleString('en-US') + (typeof p.max === 'number' && p.max !== p.min ? '–' + p.max.toLocaleString('en-US') : '');
  return '';
}
function writeSummary(state) {
  const sh = sheet('summary', ['品項', '空間', '狀態', '選定型號', '價格', '待辦未完成', '留言數', '最後更新']);
  const rows = (state.items || []).map(it => {
    const o = it.chosenOptionId ? (it.options || []).find(x => x.id === it.chosenOptionId) : null;
    const room = (state.rooms || []).find(r => r.id === it.roomId);
    return [it.name, room ? room.name : '', STATUS_LABEL[it.status] || it.status, o ? (o.brand + ' ' + o.model) : '', o ? priceText(o.price) : '', (it.todos || []).filter(t => !t.done).length, (it.notes || []).length, tw(state.updatedAt)];
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 8).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 8).setValues(rows);
}
function writeMeta(state) {
  const sh = sheet('meta', ['欄位', '值']);
  const folder = dataFolder();
  const rows = [['版本 rev', state.rev], ['最後更新（台灣時間）', tw(state.updatedAt)], ['資料資料夾', folder.getUrl()], ['紀錄筆數', (state.history || []).length], ['最後寫入', tw(new Date().toISOString())]];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
}
function appendHistory(entries) {
  if (!entries || !entries.length) return;
  const sh = sheet('history', ['時間（台灣）', '誰', '裝置', '做了什麼', '類型', '品項', '變更內容(JSON)', '紀錄ID']);
  const rows = entries.map(e => {
    const itemId = (e.changes && e.changes[0] && (e.changes[0].path.itemId || e.changes[0].path.id)) || '';
    let payload = '';
    try { payload = JSON.stringify(e.changes || []); } catch (x) { payload = ''; }
    if (payload.length > 45000) payload = payload.slice(0, 45000) + '…(truncated)';
    return [tw(e.ts), e.who || '', e.device || '', e.summary || '', e.type || '', itemId, payload, e.id || ''];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
}

/* ---------- actions ---------- */
function load(p) {
  const state = readState();
  return { ok: true, state: state, rev: state ? (state.rev || 0) : 0, codeRequired: !!FAMILY_CODE };
}
function save(p) {
  if (FAMILY_CODE && String(p.code || '') !== FAMILY_CODE) return { ok: false, error: 'code_required' };
  const incoming = p.state;
  if (!incoming || !incoming.schema || !Array.isArray(incoming.items)) return { ok: false, error: 'bad_state' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    const current = readState();
    const currentRev = current ? (current.rev || 0) : 0;
    const baseRev = Number(p.baseRev || 0);
    if (current && baseRev !== currentRev) return { ok: false, conflict: true, rev: currentRev, state: current };
    if ((incoming.rev || 0) <= currentRev && current) incoming.rev = currentRev + 1;
    incoming.updatedAt = incoming.updatedAt || new Date().toISOString();
    writeState(incoming);
    writeSnapshot(incoming);
    appendHistory(p.entries || []);
    writeSummary(incoming);
    writeMeta(incoming);
    return { ok: true, rev: incoming.rev, updatedAt: incoming.updatedAt };
  } finally { lock.releaseLock(); }
}

/* 在 Apps Script 編輯器裡可直接執行這個函式做測試（會要求授權） */
function selfTest() {
  const r = load({});
  Logger.log(JSON.stringify({ rev: r.rev, hasState: !!r.state }));
}
