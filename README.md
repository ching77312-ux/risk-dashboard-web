# 企業輿情風控儀表板 — Vercel + Supabase 起始專案

不碰公司伺服器的架構:
內部 SQL Server → (Python 排程腳本,單向推送,不含AR金額) → Supabase (雲端資料庫)
→ 靜態網頁 (部署在 Vercel,直接讀 Supabase)

## 資料夾結構

```
risk-web-starter/
├── public/              # 前端(純 HTML/JS/CSS,部署到 Vercel)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── sync/                # 從 SQL Server 同步到 Supabase 的排程腳本
│   ├── sync_to_supabase.py
│   └── requirements.txt
├── supabase_schema.sql  # 在 Supabase 建表用的 SQL
├── vercel.json
└── README.md
```

## 建置步驟

### 1. 建立 Supabase 專案(5分鐘)

1. 到 https://supabase.com 免費註冊,建立一個新專案(選新加坡或東京節點,延遲較低)。
2. 進入 SQL Editor,貼上 `supabase_schema.sql` 的內容執行,建立資料表與權限規則。
3. 到 Project Settings → API,記下三個值:
   - `Project URL`
   - `anon public key`(前端用,可公開,只有讀取權限)
   - `service_role key`(**絕對不能外流**,只用在你們公司內網跑的同步腳本裡)

### 2. 設定同步腳本(在你們公司內網,用現有排程機制跑)

```bash
cd sync
pip install -r requirements.txt
```

環境變數(建議用 `.env` 或排程系統本身的密碼保管機制,不要寫死在程式碼裡):

```
SQL_SERVER_CONN=Driver={ODBC Driver 17 for SQL Server};Server=你的SQLServer;Database=你的DB;UID=...;PWD=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=你的service_role_key
```

`sync_to_supabase.py` 每天排程跑一次(接在你們現有 SSIS/Gemini批次流程之後):
- 從 SQL Server 撈 CompanyName、統編、RiskLevel、TargetTitle、TargetLink、Summary、UpdatedAt
- **刻意不撈AR金額**,改成用你們設定的門檻自行換算成分級代碼(A/B/C),原始金額留在SQL Server裡,不會被推到雲端
- upsert 進 Supabase 的 `risk_companies` 資料表

### 3. 部署前端到 Vercel

1. 到 https://vercel.com 用 GitHub 帳號登入(免費方案足夠內部工具使用)。
2. 把這個資料夾推上一個 GitHub repo(可以是 private repo)。
3. Vercel 上「New Project」選這個 repo,Framework 選 "Other"(純靜態),Root Directory 指到專案根目錄,Output Directory 填 `public`。
4. 在 Vercel 的 Environment Variables 加兩個(前端會用到,是公開的anon key,沒關係):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_public_key
   ```
   *(這個純靜態版本目前把值直接寫在 `app.js` 開頭,正式使用前記得改成從 Vercel 環境變數注入,或至少換成你自己專案的值)*
5. 按 Deploy,幾十秒後會拿到一個 `https://你的專案.vercel.app` 網址,設成公司內部書籤即可。

### 4. (選用)加瀏覽器推播

之後要加高風險即時推播,可以在同步腳本推完資料後,額外呼叫瀏覽器的 Web Push API,或先簡單一點,讓網頁每次開啟時自動偵測「有新的高風險案件」並跳提示。這一步之後有需要我可以再幫你補。

## 安全性重點

- **AR金額永遠不離開公司內網**——同步腳本只送分級代碼,不送金額。
- Supabase 的 `anon` key 是設計成可以公開在前端程式碼裡的(這是官方標準用法),真正的存取控制在資料庫的 Row Level Security 規則(見 `supabase_schema.sql`),已經設定成「只能讀,不能寫、不能改、不能刪」。
- 正式使用前,還是建議讓公司資安過目一次這個架構,即使AR沒有外流,公司名稱+風險等級的組合仍屬於商業資訊,先取得共識比較保險。
