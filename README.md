# 南投老家翻修清單（homechecklist）

全家共用的家電採購／安裝需求 checklist。固定網址、不用登入：
**https://kenhuangads.github.io/homechecklist/**

- 家人：看價格、即時比價、選方案、打勾待辦、留言；每筆修改都有「誰／哪台裝置／幾點／改了什麼」的紀錄，可還原。
- 設計師：同一網址，點「我是設計師」→ 只看尺寸、開孔、電壓迴路、給排水、排風與全屋前置工程（不顯示價格），可直接列印。

## 架構
| 層 | 做法 |
|---|---|
| 網站 | 靜態單檔 `docs/index.html`，由 GitHub Pages 提供（`main` 分支 `/docs`） |
| 雲端資料與版本紀錄 | Google 試算表 + Apps Script 網頁應用程式（`apps-script/Code.gs`）；資料存在你的雲端硬碟 `homechecklist-data/state.json`，每次儲存都留快照；試算表 `history` 分頁記錄每筆修改 |
| 每日價格 | GitHub Actions 每天 11:00（台灣）呼叫 PChome 公開 API 更新 `docs/prices.json`，網站顯示「今日價」；另有飛比價格／BigGo 即時比價連結 |
| 商品資料 | `src/seed.json`：42 個方案、133 個連結（2026/8/22 逐一實查，失效連結已替換） |

## 第一次部署後要做的事
1. 照 [SETUP.md](SETUP.md) 建立 Google 試算表與 Apps Script（約 5 分鐘），取得 `/exec` 網址。
2. 把網址填進 `docs/config.json` 的 `apiUrl`（或貼給 Claude），push 後約 1–2 分鐘生效。
3. 在 GitHub → Settings → Pages 確認來源為 `main` / `docs`（已用 API 設定）。

## 開發
```bash
node tools/merge-research.js    # 把 research/*.json 合併進 seed（只在重新實查時）
node tools/content-pass.js      # 簡潔優點／專家建議／比價關鍵字（只在重新實查時）
node tools/apply-linkcheck.js   # 套用 research/links-result-*.json 的連結檢查
node tools/fetch-prices.js      # 手動更新 docs/prices.json
node build.js                   # 產生 docs/index.html（SHARE_URL 可覆蓋分享網址）
```
本機預覽：`.claude/launch.json`（port 8791，serve `docs/`）；在瀏覽器 localStorage 設 `hc_api` 為 `"mock"` 可模擬雲端。

## 資料流與更新規則
- 網站內嵌的 seed 是「商品目錄基準」（`catalogVersion`）；家人的修改只存在雲端。載入時若 seed 的 `catalogVersion` 比雲端新，會自動把目錄欄位（價格、連結、優點、安裝須知…）合併進雲端資料，不會動到家人的選擇、待辦、留言與紀錄。
- 所以更新商品資料只要：改 `src/seed.json` → bump `catalogVersion` → `node build.js` → push。
- 雲端資料格式：`items[]`（status、chosenOptionId、options[]、install[]、costNotes[]、notes[]、todos[]、requests[]）、`prep[]`、`profiles{}`、`history[]`。

## 舊版
claude.ai Artifact 版（需登入）已停用：https://claude.ai/code/artifact/c844b959-4287-47dc-95be-a8114464b809
