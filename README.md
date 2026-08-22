# 南投老家翻修清單（homechecklist）

全家共用的家電採購／安裝需求 checklist，發布為 claude.ai Artifact（固定網址），
資料存在同一個 artifact 的 `data/state.json`，每次儲存都是一個有署名的不可變版本。

## 結構
- `src/seed.base.json` — 從報告整理出的原始結構化資料（人工維護）
- `research/*.json` — 2026/8/22 MOMO／PChome／官網逐項實查結果（由 agent 產出）
- `tools/merge-research.js` — 把實查結果合併進 `src/seed.json`，並套用事實修正（電壓、停售、價格）
- `src/styles.css`、`src/app.part1~3.js`、`src/index.html` — 應用程式（無框架、單檔）
- `build.js` — 內嵌 CSS／JS／seed → `dist/index.html`（發布用片段）與 `dist/preview.html`（本機測試，含 mock 儲存 API）
- `.claude/launch.json` — 本機預覽伺服器（port 8791）

## 指令
```bash
node tools/merge-research.js   # 重新合併實查資料（只在 research/ 或 seed.base.json 變更時需要）
SHARE_URL="https://claude.ai/..." node build.js   # 建置；SHARE_URL 會寫進 seed.meta.shareUrl
```

## 發布／更新規則（重要）
1. 發布用 Artifact 工具，`file_path` 固定為 `dist/index.html`，網址才會不變。
2. 實測此環境的 files-form 不可用，頁面儲存時走「整頁 HTML 重新發布」：**線上 index.html 內嵌的 `hc-seed` JSON 就是最新資料**。
   重新發布前務必：WebFetch artifact 網址（會存成 html 檔）→ `node tools/pull-live-seed.js <html 檔>` → 再 `SHARE_URL=<url> node build.js`。
   頁面載入時會比較 `rev`／`updatedAt` 取較新者，但舊 seed 仍可能蓋掉家人的修改，所以一定要先拉。
3. 價格刷新：更新 `research/*.json` 或直接改 `src/seed.json` 的 option.price／links（保留 history、bump `rev`），重建後發布。
4. 分享：外層網址參數不會傳進頁面，所以所有人用同一網址，打開後自己選身分（裝置會記住）。

## 資料模型（state.json）
- `items[]`：品項（status: choosing/decided/bought/installed/skipped、chosenOptionId、options[]、install[]（tag 電/水/排水/排風/尺寸/搬運/木作/其他）、costNotes[]、notes[]、todos[]、requests[]）
- `prep[]`：全屋前置工程；`profiles{}`：家人／設計師／水電師傅／採購各自顯示欄位
- `history[]`：每筆修改 {ts, who, device, summary, changes[{path, before, after}]}，可單筆還原或回到某時間點
