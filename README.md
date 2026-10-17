# 宿舍點名助手 (cyut.dorm)

> 專為宿舍幹部打造的快速點名、房號篩選、床位核對與歷史查詢系統。

這個專案是一個手機優先的 Web 應用，用來協助宿舍幹部快速進行點名作業、管理名冊版本、同步資料並保留稽核日誌。系統支援離線先行、自動儲存、Supabase 實時同步與完整的匯出/匯入功能。

---

## 亮點

- 手機優先 UI：快速切換樓層、房間與床位，操作流暢且適配窄螢幕。  
- Roll Call（點名）模式：逐間點名、一鍵全員到齊 / 一鍵全未到（未開門）、逐人狀態切換（已到/未到/請假/晚歸/待確認）。  
- Query（查詢）模式：以不同名冊版本查詢歷史紀錄與指定日期。  
- 名冊版本管理：支援匯入、建立、編輯、刪除名冊版本並可設為當前生效版本。  
- 帳號與稽核：幹部/管理者登入、每次操作會產生 Audit Log。  
- 離線支援與同步：本機儲存 + 同步佇列 + Supabase realtime，網路恢復時自動同步。  
- 資料匯出/還原：可以匯出整個本機資料庫為 JSON 備份，並可匯入還原或重設為示範資料。

---

## 專案結構（重點）

- index.html
- package.json
- tsconfig.json
- vite.config.ts
- src/
  - App.tsx                — 應用核心與主要狀態邏輯
  - main.tsx               — React 啟動程式
  - components/            — UI 組件（RollCallMode、QueryMode、RosterManager、AdminPanel、LoginScreen 等）
  - types/                 — TypeScript 型別定義（Resident、DailySession、AuthConfig、AuditLog 等）
  - utils/                 — 儲存、同步、Supabase client、點名邏輯、授權/稽核邏輯等

---

## 技術棧

- 前端：React + TypeScript
- 打包 / 開發：Vite
- CSS：Tailwind CSS
- 即時/後端資料：Supabase
- 圖示：lucide-react
- (可選) 伺服端 AI：@google/genai（metadata 顯示可能使用 Gemini API）
- 部署：支援 Vercel（專案含 vercel.json）

---

## 環境變數

請建立 `.env` 或在部署平台（如 Vercel）加入下列環境變數：

- GEMINI_API_KEY (選用) — 如果使用 Gemini / Google GenAI 相關功能時需要。  
- APP_URL — 網站 URL（用於某些回調或顯示）。
- VITE_SUPABASE_URL — Supabase 專案 URL（例如：https://xyzcompany.supabase.co）。  
- VITE_SUPABASE_ANON_KEY — Supabase anon 公開鍵（用於前端呼叫）。

範例（.env.example 已包含說明）：

```dotenv
GEMINI_API_KEY="YOUR_GEMINI_KEY"
APP_URL="https://your-app.example.com"
VITE_SUPABASE_URL="https://xxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIU..."
```

注意：Supabase 的資料表會直接在前端被存取（anon key），請在部署與權限設定上謹慎處理 RLS 與 API 權限以保護資料安全。

---

## 本地開發

1. 安裝依賴

```bash
# 使用 npm
npm install

# 或者使用 bun
# bun install
```

2. 啟動開發伺服器（預設監聽 3000）

```bash
npm run dev
```

3. 建置

```bash
npm run build
```

4. 本地預覽（build 後）

```bash
npm run preview
```

---

## 部署建議

- Vercel：此專案包含 `vercel.json`，直接連結到 GitHub 並在 Vercel 專案設定中加入必要的 Environment Variables（VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、GEMINI_API_KEY、APP_URL）。  
- Supabase：建立 4 個主要資料表（或使用專案中的 schema）：
  1. dorm_roster_versions — 名冊版本與住宿生
  2. dorm_daily_sessions — 每日點名紀錄
  3. dorm_auth_config — 帳號與權限設定
  4. dorm_audit_logs — 操作稽核紀錄

- 權限 (RLS)：建議為前端 anon key 設計有限度的 RLS 規則或改以儲存後端 proxy 以避免資料遭未授權存取或竄改。

---

## 資料流程摘要

- 啟動時：App 會嘗試呼叫 `fetchFromSupabase()` 取得最新資料，同步至本機儲存。  
- 操作時：大多數用戶操作會先儲存在本機（localStorage / IndexedDB），並排入同步佇列（queueSyncAction）；若有網路則立即推送至 Supabase。  
- Realtime：使用 `setupSupabaseRealtime()` 訂閱 Supabase 變更，實現多人即時同步。  
- 匯出/匯入：支援完整 JSON 匯出與還原，便於備份或移轉資料。

---

## 使用說明（快速）

1. 管理員或幹部登入（LoginScreen）。  
2. 進入「點名」模式 (Roll Call)：選樓層 → 選房間 → 逐床標記狀態。  
3. 常用按鈕：一鍵全員到齊 / 一鍵全未到（房門未開）/ 下一間房（自動存檔）。  
4. 查詢模式：切換到 Query 查看其他日期或使用不同名冊版本的歷史紀錄。  
5. 名冊管理：上傳或編輯名冊版本、設定當前生效版本。  
6. 管理員面板：檢視稽核日誌並管理帳號設定。

---

## 注意事項

- 點名流程故意保留「unmarked（待點名）」狀態，不會自動把未標記的床位視為「已到」，以避免誤存。  
- 若要在公開環境使用，務必確認 Supabase 的安全規則 (RLS) 與環境變數保護已妥善設定。  
- 若使用 Gemini / GenAI 功能，請妥善管理 GEMINI_API_KEY（不要放在公開 repo）。

---

## 貢獻

歡迎提出 Issue 或 Pull Request。若要修正或新增功能，請：

1. Fork 專案並建立分支。  
2. 提交清楚的 PR 說明與變更內容。  
3. 若 PR 涉及資料結構變更，請說明相容性與遷移步驟。

---

## 授權

本專案採用 MIT License，詳見 `LICENSE` 檔案。

---
