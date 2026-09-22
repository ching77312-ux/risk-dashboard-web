-- 在 Supabase 的 SQL Editor 貼上並執行

create table if not exists risk_companies (
  id text primary key,               -- 建議用統編當id
  company_name text not null,
  tax_id text,
  risk_level text not null check (risk_level in ('high', 'medium', 'low')),
  tier text,                         -- 分級代碼 A/B/C,取代AR金額,由同步腳本換算
  summary text,
  news_title text,
  news_link text,
  updated_at timestamptz not null default now()
);

-- 開啟 Row Level Security
alter table risk_companies enable row level security;

-- 只允許「讀取」,給 anon(前端公開金鑰)使用
create policy "allow anon read"
  on risk_companies
  for select
  to anon
  using (true);

-- 不建立 insert/update/delete 給 anon 的政策
-- 同步腳本用 service_role key 連線,會自動略過 RLS,不需要額外政策

-- 加速依風險等級查詢
create index if not exists idx_risk_companies_risk_level on risk_companies (risk_level);
