/* 把一份「單一品項的目錄更新」套進 src/seed.json。
   用途：家人自己加的機型（fam_…）查證完成後升級成正式目錄項目，並把整個品項的
   建議／安裝須知／需確認／實務提醒／待辦一起換成「選定機型」的版本。

   用法：node tools/apply-item-update.js <payload.json>
   payload 形狀（欄位都可省略，省略就不動）：
   {
     "itemId": "door_lock",
     "option": { "id": "...", "replaces": ["fam_xxx"], ...其餘 option 欄位 },
     "dropOptions": ["要從目錄移除的 option id"],
     "advice": "…", "hardReq": "…",
     "install": [{"tag":"電","text":"…"}],
     "verify": [{"tag":"…","text":"…"}],
     "tolerance": [{"tag":"…","text":"…"}],
     "costNotes": ["…"], "installCost": {"min":0,"max":0,"note":"…"},
     "pickOptionId": "…", "pickReason": "…",
     "retireTodos": ["door_lock_v1"],
     "todos": [{"id":"door_lock_h1","text":"…","for":"designer"}]
   }
*/
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'src', 'seed.json');
const payloadPath = process.argv[2];
if (!payloadPath) { console.error('用法：node tools/apply-item-update.js <payload.json>'); process.exit(1); }

const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const it = seed.items.find(i => i.id === payload.itemId);
if (!it) { console.error('找不到品項', payload.itemId); process.exit(2); }

const log = [];
// 1) 選項：新增或就地更新（保留 replaces 供雲端接手舊 id）
if (payload.option) {
  const o = payload.option;
  if (!o.id) { console.error('option 缺 id'); process.exit(3); }
  const idx = it.options.findIndex(x => x.id === o.id);
  if (idx >= 0) { it.options[idx] = Object.assign({}, it.options[idx], o); log.push(`更新選項 ${o.id}`); }
  else { it.options.push(o); log.push(`新增選項 ${o.id}（replaces: ${(o.replaces || []).join(',') || '無'}）`); }
}
// 2) 下架選項
(payload.dropOptions || []).forEach(id => {
  const n = it.options.length;
  it.options = it.options.filter(o => o.id !== id);
  if (it.options.length < n) log.push(`移除選項 ${id}`);
});
// 3) 純文字欄位
['advice', 'hardReq', 'short', 'pickOptionId', 'pickReason'].forEach(k => {
  if (payload[k] !== undefined) { it[k] = payload[k]; log.push(`更新 ${k}`); }
});
['install', 'verify', 'tolerance', 'costNotes', 'warnings'].forEach(k => {
  if (Array.isArray(payload[k])) { it[k] = payload[k]; log.push(`更新 ${k}（${payload[k].length} 條）`); }
});
if (payload.installCost) { it.installCost = payload.installCost; log.push('更新 installCost'); }
// 4) 待辦：退場 + 新增（用 id 去重，雲端已存在的不會重複）
if (payload.retireTodos) {
  it.retiredTodos = [...new Set([...(it.retiredTodos || []), ...payload.retireTodos])];
  log.push(`退場待辦 ${payload.retireTodos.length} 條`);
}
(payload.todos || []).forEach(t => {
  if (!t.id || !t.text) return;
  const i = it.todos.findIndex(x => x.id === t.id);
  const row = { id: t.id, text: t.text, done: false, for: t.for === 'family' ? 'family' : 'designer' };
  if (i >= 0) it.todos[i] = Object.assign({}, it.todos[i], row); else it.todos.push(row);
});
if ((payload.todos || []).length) log.push(`寫入待辦 ${payload.todos.length} 條`);

// 5) 一致性檢查：選定機型三個欄位不可留空（留空會觸發「缺資料」警示）
const picked = payload.pickOptionId ? it.options.find(o => o.id === payload.pickOptionId) : null;
if (picked) ['dims', 'cutout', 'power'].forEach(k => { if (!picked[k]) log.push(`⚠ ${picked.id} 的 ${k} 是空的，會觸發「缺資料」警示`); });
// 退場的 id 必須真的存在
(payload.retireTodos || []).forEach(id => { if (!it.todos.some(t => t.id === id)) log.push(`⚠ retireTodos 指到不存在的待辦 ${id}`); });

seed.catalogVersion = Math.max(Number(seed.catalogVersion) || 0, Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')) * 100) + 1;
seed.rev = (seed.rev || 0) + 1;
seed.updatedAt = new Date().toISOString();
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
log.forEach(l => console.log(' -', l));
console.log(`catalogVersion → ${seed.catalogVersion}；${it.name} 目前 ${it.options.length} 個方案、${it.todos.filter(t => !(it.retiredTodos || []).includes(t.id)).length} 條有效待辦`);
