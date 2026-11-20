# JLPT Study｜日本語能力試験 練習 App

N5／N4 文字・語彙、文法、讀解的線上練習與模擬考。React + TypeScript + Vite + Tailwind，後端為 Supabase（Auth / PostgreSQL / RLS），以 PWA 形式部署在 GitHub Pages，可安裝、可離線。

> 不含聽解。成績為本站「練習測驗分數」（答對率），**不是** JLPT 官方等化分數，也不代表合格判定。

## 功能

| 區塊 | 說明 |
|---|---|
| 訪客模式 | 不需登入即可練習、模擬考、收藏、記錄錯題，資料存在本機 IndexedDB |
| 會員 | Email 註冊／登入／登出／忘記密碼／重設密碼／個人資料；資料同步到 Supabase，跨裝置共用 |
| 訪客資料匯入 | 登入後詢問是否把訪客資料匯入帳號（個人頁可再次匯入） |
| 練習模式 | 選等級、科目、題型、題數（10/20/30/全部）、只練錯題、練收藏；作答後立即顯示答案、中文解析、單字、文法；可回顧 |
| 模擬考 | N5／N4 **各自**的官方架構與時間，分節計時、跳題、標記待確認、提交確認、時間到自動提交、重新整理可還原、不會重複提交 |
| 成績頁 | 答對／答錯／正確率／各科目／花費時間／逐題解析；再考一次、錯題重練 |
| 錯題本、收藏 | 依等級、科目篩選；同題重複答錯只更新次數 |
| 學習紀錄 | 每日題數、每週趨勢、累計正確率、科目雷達圖、測驗歷史 |
| PWA | 可安裝、離線可練習、離線作答暫存、恢復網路後自動同步、新版本提示更新 |

### 模擬考規格（`src/data/blueprints.ts`）

時間依 JLPT 官方網站公布（2020 年 12 月起）：

| | 文字・語彙 | 文法・讀解 |
|---|---|---|
| N5 | 20 分／21 題 | 40 分／22 題 |
| N4 | 25 分／28 題 | 55 分／29 題 |

題數為官方公布的「目安」，各回實際題數可能略有差異；N5 與 N4 的題型與題數分開設定，不會混用。**題庫不足時會明確列出缺少的大題並拒絕開考，不會偷偷減少題數。**

## 本機開發

需要 Node.js 20+。

```bash
npm install
cp .env.example .env.local   # 填入 Supabase URL / anon key（不填也能以訪客模式運作）
npm run dev                  # http://localhost:5173
npm test                     # 題庫品質、抽題規則、資料層與測驗流程測試
npm run build                # 型別檢查 + 正式建置
```

## Supabase 設定

1. 到 <https://supabase.com> 建立專案，記下 **Project URL** 與 **anon public key**（Project Settings → API）。
2. SQL Editor 依序執行：
   - `supabase/migrations/0001_init.sql`（資料表、索引、RLS、觸發器）
   - `supabase/seed.sql`（內建題庫；修改題庫後用 `npm run gen:seed` 重新產生）
3. Authentication → URL Configuration：
   - **Site URL**：`https://<你的帳號>.github.io/<repo>/`
   - **Redirect URLs** 加入：`https://<你的帳號>.github.io/<repo>/**` 與 `http://localhost:5173/**`
4. （選用）設定管理者：註冊一個帳號後，在 SQL Editor 執行
   `insert into public.admin_users (user_id) select id from auth.users where email = 'you@example.com';`
5. 本機：把 URL 與 anon key 填入 `.env.local`。

**金鑰規則**：前端只使用 anon key（受 RLS 保護）。`service_role` key 與 AI API Key 只可存在 Supabase（Edge Function 內建環境變數／`supabase secrets`），不可出現在任何 `VITE_` 變數或前端程式碼。

### RLS 重點

- `profiles`、`quiz_sessions`、`quiz_answers`、`bookmarks`、`wrong_questions`：只能存取 `user_id = auth.uid()` 的列。
- `questions`、`reading_passages`：任何人只能讀 `status = 'approved'`；寫入僅管理者（`public.is_admin()`）。
- `ai_generated_questions`：僅管理者；`admin_users` 對一般使用者完全不可見。

## 部署到 GitHub Pages

1. 把專案推到 GitHub（預設分支 `main`）。
2. Settings → Pages → **Source 選 GitHub Actions**。
3. Settings → Secrets and variables → Actions → 新增 repository secrets：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
4. Push 到 `main`，`.github/workflows/deploy.yml` 會自動測試、建置、部署。

Base path 由 workflow 自動判斷（`<user>.github.io` 倉庫用 `/`，其他用 `/<repo>/`）；manifest、Service Worker、icon 路徑都會跟著調整。路由使用 **HashRouter**，在純靜態託管上重新整理任何頁面都不會 404。

## PWA 與離線

- Workbox precache 所有靜態資源與內建題庫；Supabase 請求不快取。
- 資料皆先寫入 IndexedDB；會員的變更進入 outbox 佇列，連線時依序上傳，任何一筆失敗就停下並保留，不會遺失。
- 更新策略 `prompt`：偵測到新版本時顯示「立即更新」，每小時檢查一次，不會在作答中途強制重新載入。
- iOS：Safari → 分享 → 加入主畫面（App 內有說明）。

## 題庫

題庫在 `src/data/bank/n5.ts`、`n4.ts`，用 `makeBuilder` 撰寫，**不寫在 UI 元件中**。每題有唯一 ID、4 個選項、答案、中文解析、日文補充、單字、文法、來源與審核狀態；只有 `approved` 會被抽到。`npm test` 會檢查 ID 唯一、選項不重複、答案合法、文章題對應正確、句子組合格式，並驗證 N5／N4 能組出完整考卷。

### AI 出題（預留架構）

`supabase/functions/generate-questions` 是 Edge Function 範例：驗證呼叫者為管理者 → 呼叫 AI → 驗證格式 → 寫入 `ai_generated_questions`（`pending`）。通過審核後由管理者呼叫 SQL 函式 `publish_ai_question` 才會進入正式題庫。AI 題目預設不會進入模擬考。管理介面尚未實作（目前為 API／SQL 流程）。

## 專案結構

```
src/
  components/  QuestionView、Explanation、RichJa、ui…
  contexts/    Auth、Prefs、Bank、UserData
  features/    auth / dashboard / practice / exam / results / bookmarks / wrong-questions / statistics
  layouts/     AppLayout
  services/    repository(IndexedDB) / sync(Supabase) / selection(抽題) / runs(測驗流程) / stats
  lib/         supabase、db、env、prefs
  data/        bank/、blueprints.ts、meta.ts
  types/       統一型別
supabase/      migrations/、seed.sql、functions/
.github/workflows/deploy.yml
```

## 目前狀態與待辦

**已驗證**：`tsc` 型別檢查、正式建置（含子路徑 base）、15 個自動化測試（題庫品質、抽題規則、模擬考計時與計分、重複提交保護、錯題去重、離線佇列、訪客匯入）。

**尚未驗證（需要你的環境）**：
- 與真實 Supabase 專案的端對端串接（註冊信、重設密碼信、RLS、跨裝置同步）——我沒有你的專案金鑰，請依上面步驟設定後實測。
- 實機瀏覽器操作與 PWA 安裝（本次環境沒有瀏覽器）。
- Edge Function 尚未部署測試。

**已知限制**：
- 內建題庫目前 N5 65 題、N4 80 題，剛好足以組成完整考卷，但**隨機性有限**，需要持續擴充題庫（建議每個題型至少 2～3 倍於考卷需求）。題目為原創，上線前建議請日語老師審閱。
- 題數目安取自官方公布資訊，各回實際會有差異。
- iOS 啟動畫面（splash）圖片未提供（Android 以 manifest 的圖示與背景色顯示）。
- AI 出題的管理畫面尚未實作。
