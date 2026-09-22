// ---- 設定區:換成你自己 Supabase 專案的值 ----
const SUPABASE_URL = "https://eoalgecdmfzfzikbqful.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYWxnZWNkbWZ6Znppa2JxZnVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjc4MjIsImV4cCI6MjEwNTYwMzgyMn0.Vh1nxBNlTJ-8dbbEL7jRRfaBCxujI1O-W3enNpNu1OE";
// ----------------------------------------------

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RISK_META = {
  high: { label: "🔴 高風險", badgeBg: "#FEE2E2", badgeColor: "#B91C1C" },
  medium: { label: "🟡 中風險", badgeBg: "#FEF3C7", badgeColor: "#92400E" },
  low: { label: "🟢 低風險", badgeBg: "#DCFCE7", badgeColor: "#166534" },
};

let allCompanies = [];
let currentFilter = "all";
let selectedId = null;

async function loadData() {
  const { data, error } = await supabaseClient
    .from("risk_companies")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    document.getElementById("list").innerHTML =
      `<div class="empty">讀取資料失敗,請確認 Supabase 設定是否正確。<br>${error.message}</div>`;
    return;
  }

  allCompanies = data || [];
  if (allCompanies.length && !selectedId) {
    selectedId = allCompanies[0].id;
  }
  const latest = allCompanies.reduce(
    (max, c) => (c.updated_at > max ? c.updated_at : max),
    ""
  );
  document.getElementById("last-updated").textContent = latest
    ? new Date(latest).toLocaleString("zh-TW")
    : "尚無資料";

  render();
}

function counts() {
  return {
    total: allCompanies.length,
    high: allCompanies.filter((c) => c.risk_level === "high").length,
    medium: allCompanies.filter((c) => c.risk_level === "medium").length,
    low: allCompanies.filter((c) => c.risk_level === "low").length,
  };
}

function render() {
  const c = counts();
  document.getElementById("stat-total").textContent = c.total.toLocaleString("zh-TW");
  document.getElementById("stat-high").textContent = c.high;
  document.getElementById("stat-medium").textContent = c.medium;
  document.getElementById("stat-low").textContent = c.low;

  renderTabs(c);
  renderList();
  renderDetail();
}

function renderTabs(c) {
  const tabs = [
    { key: "all", label: `全部（${c.total}）` },
    { key: "high", label: `🔴 高風險（${c.high}）` },
    { key: "medium", label: `🟡 中風險（${c.medium}）` },
    { key: "low", label: `🟢 低風險（${c.low}）` },
  ];
  const el = document.getElementById("tabs");
  el.innerHTML = "";
  tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (currentFilter === t.key ? " active" : "");
    btn.textContent = t.label;
    btn.onclick = () => {
      currentFilter = t.key;
      render();
    };
    el.appendChild(btn);
  });
}

function filteredCompanies() {
  if (currentFilter === "all") return allCompanies;
  return allCompanies.filter((c) => c.risk_level === currentFilter);
}

function renderList() {
  const el = document.getElementById("list");
  const items = filteredCompanies();
  el.innerHTML = "";

  if (items.length === 0) {
    el.innerHTML = `<div class="empty">此風險等級目前無案件</div>`;
    return;
  }

  items.forEach((c) => {
    const meta = RISK_META[c.risk_level] || RISK_META.low;
    const card = document.createElement("button");
    card.className = "card" + (c.id === selectedId ? " selected" : "");
    card.onclick = () => {
      selectedId = c.id;
      render();
    };
    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${escapeHtml(c.company_name)}</div>
        <span class="badge" style="background:${meta.badgeBg}; color:${meta.badgeColor}">${meta.label}</span>
      </div>
      <div class="card-meta">
        <span>統編 ${escapeHtml(c.tax_id || "")}</span>
        <span class="tier-badge">額度分級 ${escapeHtml(c.tier || "—")}</span>
      </div>
      <div class="card-summary">${escapeHtml(c.summary || "")}</div>
      <div class="card-updated">更新於 ${new Date(c.updated_at).toLocaleString("zh-TW")}</div>
    `;
    el.appendChild(card);
  });
}

function renderDetail() {
  const el = document.getElementById("detail");
  const c = allCompanies.find((x) => x.id === selectedId);

  if (!c) {
    el.innerHTML = `<div class="placeholder">選取左側案件以查看詳情</div>`;
    return;
  }

  const meta = RISK_META[c.risk_level] || RISK_META.low;
  el.innerHTML = `
    <div>
      <span class="badge" style="background:${meta.badgeBg}; color:${meta.badgeColor}">${meta.label}</span>
      <div class="name">${escapeHtml(c.company_name)}</div>
      <div class="tax">統編 ${escapeHtml(c.tax_id || "")}</div>
    </div>
    <div class="divider"></div>
    <div>
      <div class="section-title">風險摘要</div>
      <div class="point"><span class="bullet">・</span><span>${escapeHtml(c.summary || "無")}</span></div>
    </div>
    <div style="display:flex; flex-direction:column; gap:4px;">
      <div style="font-size:12px; color:#9CA3AF;">重點新聞來源</div>
      <a href="${c.news_link || "#"}" target="_blank" rel="noopener">${escapeHtml(c.news_title || "無")}</a>
    </div>
    <div class="actions">
      <a class="btn-primary" href="${buildMailtoLink(c)}">轉寄給他人</a>
    </div>
  `;
}

// 產生 mailto 連結,點下去會用使用者電腦預設的信箱軟體(如 Outlook)
// 開一封新信,主旨跟內容自動帶入這筆案件的重點資訊。
function buildMailtoLink(c) {
  const meta = RISK_META[c.risk_level] || RISK_META.low;
  const subject = `【風控通報】${c.company_name}－${meta.label}`;
  const bodyLines = [
    `客戶名稱:${c.company_name}`,
    `統一編號:${c.tax_id || ""}`,
    `風險等級:${meta.label}`,
    `額度分級:${c.tier || "—"}`,
    "",
    `風險摘要:`,
    c.summary || "無",
    "",
    `重點新聞:${c.news_title || "無"}`,
    c.news_link ? `新聞連結:${c.news_link}` : "",
    "",
    `更新時間:${new Date(c.updated_at).toLocaleString("zh-TW")}`,
  ];
  const body = bodyLines.join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

loadData();
