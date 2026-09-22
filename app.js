// ---- 設定區:換成你自己 Supabase 專案的值 ----
// anon public key 設計上就是可以公開放在前端的,真正的存取控制
// 在 Supabase 那邊的 Row Level Security(見 supabase_schema.sql):
// 這個 key 只能「讀」,不能寫、改、刪。
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
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
      <button class="btn-primary" onclick="acknowledge('${c.id}')">標記已受理</button>
      <button class="btn-secondary">轉知業務</button>
    </div>
  `;
}

// 之後要接「標記已受理」寫回資料庫,可以在這裡呼叫一支有寫入權限的
// 後端 API(例如 Vercel Serverless Function),而不是直接讓前端用
// anon key 寫入 Supabase——保持「前端只能讀」的原則。
function acknowledge(id) {
  alert(`(示範) 已受理案件:${id}\n實際上線時,這裡應呼叫一支有權限管控的後端 API 來寫回資料庫。`);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

loadData();
