/**
 * 南投老家翻修清單 — Google 試算表後端（Google Apps Script）
 * 只使用這份試算表本身（權限：目前這份試算表），不碰雲端硬碟其他檔案。
 *
 * 分頁：
 *  - state     目前完整資料（壓縮後分段存放，請勿手動編輯）
 *  - snapshots 每次儲存的快照（最近 MAX_SNAPSHOTS 份，可整份回復）
 *  - history   誰／哪台裝置／幾點／改了什麼（人看的）
 *  - summary   各品項目前狀態（人看的）
 *  - meta      版本資訊
 */
const FAMILY_CODE = '2026';     // ← 家人第一次修改時要輸入一次的「家庭代碼」，可自行更改；設成 '' 代表不檢查
const MAX_SNAPSHOTS = 120;
const CHUNK = 40000;            // 每格最多 5 萬字，保守切 4 萬

function doGet(e) { return respond(safeHandle(e && e.parameter ? e.parameter : {})); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return respond({ ok: false, error: 'bad_json' }); }
  return respond(safeHandle(Object.assign({}, (e && e.parameter) || {}, body)));
}
function respond(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function safeHandle(p) { try { return handle(p); } catch (err) { return { ok: false, error: 'exception', message: String(err && err.message || err) }; } }
function handle(p) {
  const action = p.action || 'load';
  if (action === 'ping') return { ok: true, time: new Date().toISOString(), version: 2 };
  if (action === 'load') return load(p);
  if (action === 'save') return save(p);
  if (action === 'snapshots') return listSnapshots();
  if (action === 'snapshot') return getSnapshot(p.rev);
  return { ok: false, error: 'unknown_action' };
}

/* ---------- helpers ---------- */
function sheet(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (headers) { sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); } }
  return sh;
}
function tw(iso) { try { return Utilities.formatDate(new Date(iso), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); } catch (e) { return String(iso || ''); } }
function enc(obj) { const gz = Utilities.gzip(Utilities.newBlob(JSON.stringify(obj), 'application/json')); return Utilities.base64Encode(gz.getBytes()); }
function dec(b64) { const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/x-gzip'); return JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8')); }
function chunks(s) { const out = []; for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK)); return out; }
const STATUS_LABEL = { choosing: '考慮中', decided: '已決定', bought: '已購買', installed: '已安裝', skipped: '不需要' };
function priceText(p) {
  if (!p) return '';
  if (typeof p.amount === 'number') return 'NT$' + p.amount.toLocaleString('en-US');
  if (typeof p.min === 'number') return '約 NT$' + p.min.toLocaleString('en-US') + (typeof p.max === 'number' && p.max !== p.min ? '–' + p.max.toLocaleString('en-US') : '');
  return '';
}

/* ---------- state (state tab) ---------- */
function readState() {
  const sh = sheet('state');
  const n = Number(sh.getRange('B3').getValue() || 0);
  if (!n) return null;
  const b64 = sh.getRange(5, 1, n, 1).getValues().map(r => String(r[0] || '')).join('');
  try { return dec(b64); } catch (e) { return null; }
}
function writeState(state) {
  const sh = sheet('state');
  const parts = chunks(enc(state));
  sh.clearContents();
  sh.getRange(1, 1, 3, 2).setValues([['rev', state.rev || 0], ['updatedAt', tw(state.updatedAt)], ['chunks', parts.length]]);
  sh.getRange(4, 1).setValue('以下為壓縮後的資料（請勿手動編輯）；要看內容請看 summary / history 分頁');
  sh.getRange(5, 1, parts.length, 1).setValues(parts.map(p => [p]));
}

/* ---------- snapshots tab ---------- */
function writeSnapshot(state, who) {
  const sh = sheet('snapshots', ['rev', '時間（台灣）', '誰', 'chunks', '資料（壓縮）']);
  const parts = chunks(enc(state));
  sh.appendRow([state.rev || 0, tw(state.updatedAt), who || '', parts.length].concat(parts));
  const rows = sh.getLastRow() - 1;
  if (rows > MAX_SNAPSHOTS) sh.deleteRows(2, rows - MAX_SNAPSHOTS);
}
function listSnapshots() {
  const sh = sheet('snapshots'); const n = sh.getLastRow() - 1;
  if (n <= 0) return { ok: true, snapshots: [] };
  const vals = sh.getRange(2, 1, n, 3).getValues();
  return { ok: true, snapshots: vals.map(r => ({ rev: Number(r[0]), at: String(r[1]), who: String(r[2]) })).reverse().slice(0, 100) };
}
function getSnapshot(rev) {
  const sh = sheet('snapshots'); const n = sh.getLastRow() - 1;
  if (n <= 0) return { ok: false, error: 'not_found' };
  const vals = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  const row = vals.find(r => Number(r[0]) === Number(rev));
  if (!row) return { ok: false, error: 'not_found' };
  const cnt = Number(row[3]); const b64 = row.slice(4, 4 + cnt).map(String).join('');
  return { ok: true, state: dec(b64) };
}

/* ---------- human-readable tabs ---------- */
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
  const rows = [['版本 rev', state.rev || 0], ['最後更新（台灣時間）', tw(state.updatedAt)], ['紀錄筆數', (state.history || []).length], ['最後寫入', tw(new Date().toISOString())]];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
}
function appendHistory(entries) {
  if (!entries || !entries.length) return;
  const sh = sheet('history', ['時間（台灣）', '誰', '裝置', '做了什麼', '類型', '品項', '變更內容(JSON)', '紀錄ID']);
  const rows = entries.map(e => {
    const itemId = (e.changes && e.changes[0] && e.changes[0].path && (e.changes[0].path.itemId || e.changes[0].path.id)) || '';
    let payload = ''; try { payload = JSON.stringify(e.changes || []); } catch (x) { payload = ''; }
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
    if (current && (incoming.rev || 0) <= currentRev) incoming.rev = currentRev + 1;
    incoming.updatedAt = incoming.updatedAt || new Date().toISOString();
    writeState(incoming);
    writeSnapshot(incoming, p.who);
    appendHistory(p.entries || []);
    writeSummary(incoming);
    writeMeta(incoming);
    return { ok: true, rev: incoming.rev, updatedAt: incoming.updatedAt };
  } finally { lock.releaseLock(); }
}

/* 在編輯器裡選這個函式按「執行」可先完成授權並建立分頁 */
function selfTest() {
  const r = load({});
  sheet('history', ['時間（台灣）', '誰', '裝置', '做了什麼', '類型', '品項', '變更內容(JSON)', '紀錄ID']);
  Logger.log(JSON.stringify({ rev: r.rev, hasState: !!r.state }));
}
