const SETTINGS_KEY = "bd-weekly-github-settings";
const SNAPSHOT_PATH = "ledger/market_workbench_snapshot.json";
const CATEGORY_ORDER = ["政府部门", "城投平台", "开发商", "高校", "设计院", "施工单位", "资源方", "未分类"];
const ROLE_ORDER = ["最终决策", "核心建议", "项目执行", "信息入口"];

const state = {
  companies: [], projects: [], people: [], links: [], timeline: [], selectedId: new URLSearchParams(location.search).get("company") || "", generatedAt: "",
};
const elementIds = ["githubOwnerInput", "githubRepoInput", "githubBranchInput", "githubTokenInput", "loadResourcesButton", "resourceSummary", "resourceResult", "companySearch", "companyList", "companyDetail"];
const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));
const field = (row, key) => String(row?.[key] || "").trim();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

function settings() {
  return {
    owner: elements.githubOwnerInput.value.trim() || "asymptote-mhx",
    repo: elements.githubRepoInput.value.trim() || "BD-weekly-data",
    branch: elements.githubBranchInput.value.trim() || "main",
    token: elements.githubTokenInput.value.trim(),
  };
}
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (saved.owner) elements.githubOwnerInput.value = saved.owner;
    if (saved.repo) elements.githubRepoInput.value = saved.repo;
    if (saved.branch) elements.githubBranchInput.value = saved.branch;
    if (saved.token) elements.githubTokenInput.value = saved.token;
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}
function show(message, type = "info") {
  elements.resourceResult.textContent = message;
  elements.resourceResult.className = `weekly-result ${type}`;
}
function decodeBase64(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function readSnapshot() {
  const config = settings();
  if (!config.token) throw new Error("请先填写 GitHub Token。");
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${SNAPSHOT_PATH}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, {headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${config.token}`, "X-GitHub-Api-Version": "2022-11-28"}});
  if (!response.ok) {
    let message = await response.text();
    try { message = JSON.parse(message).message || message; } catch {}
    throw new Error(`资源库读取失败：${message}`);
  }
  const file = await response.json();
  const snapshot = JSON.parse(decodeBase64(file.content));
  const resources = snapshot.platform_resources || {};
  state.companies = Array.isArray(resources.platform_companies) ? resources.platform_companies : [];
  state.projects = Array.isArray(resources.projects) ? resources.projects : (Array.isArray(snapshot.projects) ? snapshot.projects : []);
  state.people = Array.isArray(resources.platform_chain_people) ? resources.platform_chain_people : [];
  state.links = Array.isArray(resources.project_platform_links) ? resources.project_platform_links : [];
  state.timeline = Array.isArray(resources.contact_timeline) ? resources.contact_timeline : [];
  state.generatedAt = snapshot.generated_at || "";
  if (!state.companies.some((row) => field(row, "platform_company_id") === state.selectedId)) {
    state.selectedId = field(state.companies[0], "platform_company_id");
  }
}

function categoryOf(company) { return field(company, "资源分类") || "未分类"; }
function companyProjectIds(companyId) {
  return new Set(state.links.filter((row) => field(row, "platform_company_id") === companyId).map((row) => field(row, "project_id")));
}
function companyProjects(companyId) {
  const ids = companyProjectIds(companyId);
  if (ids.size) return state.projects.filter((row) => ids.has(field(row, "project_id")));
  return state.projects.filter((row) => field(row, "平台公司ID") === companyId);
}

function renderList() {
  const keyword = elements.companySearch.value.trim().toLowerCase();
  const rows = state.companies.filter((row) => `${field(row,"平台公司名称")} ${field(row,"别名")} ${field(row,"地区")} ${categoryOf(row)}`.toLowerCase().includes(keyword));
  const grouped = new Map();
  rows.forEach((row) => {
    const category = categoryOf(row);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(row);
  });
  const categories = [...grouped.keys()].sort((a, b) => (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) - (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b)));
  elements.companyList.innerHTML = categories.length ? categories.map((category) => `
    <section class="online-company-group category-${CATEGORY_ORDER.indexOf(category) + 1}">
      <h3><span>${escapeHtml(category)}</span><small>${grouped.get(category).length} 家</small></h3>
      ${grouped.get(category).map((row) => {
        const id = field(row, "platform_company_id");
        return `<button class="online-company-item ${id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(id)}"><strong>${escapeHtml(field(row,"平台公司名称") || "未命名平台")}</strong><span>${escapeHtml(field(row,"地区") || "地区待补充")} · ${companyProjects(id).length} 个项目</span></button>`;
      }).join("")}
    </section>`).join("") : `<p class="muted">没有匹配的平台公司。</p>`;
}

function personCard(row) {
  return `<article class="online-mind-node"><span>${escapeHtml(field(row,"决策角色") || "角色待确认")}</span><strong>${escapeHtml(field(row,"姓名") || "姓名待补充")}</strong><small>${escapeHtml([field(row,"部门"),field(row,"职务")].filter(Boolean).join(" · ") || "部门职务待补充")}</small><em>对我院态度：${escapeHtml(field(row,"关系状态") || "态度待确认")}</em>${field(row,"性格爱好") ? `<small>性格爱好：${escapeHtml(field(row,"性格爱好"))}</small>` : ""}</article>`;
}
function mindMap(company, people) {
  const groups = ROLE_ORDER.map((role) => [role, people.filter((person) => field(person,"决策角色") === role)]).filter(([, rows]) => rows.length);
  const other = people.filter((person) => !ROLE_ORDER.includes(field(person,"决策角色")));
  if (other.length) groups.push(["待确认角色", other]);
  return groups.length ? `<div class="online-mind-map"><div class="online-mind-root">${escapeHtml(field(company,"平台公司名称"))}</div><div>${groups.map(([role, rows], index) => `<section class="online-mind-branch mind-rank-${index + 1}"><h4>${index + 1}. ${escapeHtml(role)}</h4><div>${rows.map(personCard).join("")}</div></section>`).join("")}</div></div>` : `<div class="empty-state">尚未录入平台决策链。</div>`;
}
function contactTimeline(companyId) {
  const rows = state.timeline.filter((row) => field(row,"platform_company_id") === companyId).sort((a, b) => field(b,"接触日期").localeCompare(field(a,"接触日期")));
  return rows.length ? `<div class="online-contact-timeline">${rows.map((event) => `<article><time>${escapeHtml(field(event,"接触日期") || "日期未知")}</time><div><strong>${escapeHtml(field(event,"接触对象") || field(event,"姓名") || "人员未填写")}</strong><span>${escapeHtml(field(event,"对应项目") || "未关联项目")}${field(event,"接触方式") ? ` · ${escapeHtml(field(event,"接触方式"))}` : ""}</span>${field(event,"参与拜访人员") ? `<small>UAD参与：${escapeHtml(field(event,"参与拜访人员"))}</small>` : ""}${field(event,"细节内容") ? `<p>${escapeHtml(field(event,"细节内容"))}</p>` : ""}${field(event,"下一步") ? `<small>下一步：${escapeHtml(field(event,"下一步"))}</small>` : ""}</div><span class="source-badge">${escapeHtml(field(event,"来源类型") || "周报")}</span></article>`).join("")}</div>` : `<p class="muted">暂无接触记录。</p>`;
}
function renderDetail() {
  const company = state.companies.find((row) => field(row,"platform_company_id") === state.selectedId);
  if (!company) { elements.companyDetail.innerHTML = `<div class="empty-state">暂无平台公司数据。</div>`; return; }
  const id = field(company,"platform_company_id");
  const projects = companyProjects(id);
  const people = state.people.filter((row) => field(row,"platform_company_id") === id);
  elements.companyDetail.innerHTML = `<header><span class="online-category-tag category-${CATEGORY_ORDER.indexOf(categoryOf(company)) + 1}">${escapeHtml(categoryOf(company))}</span><p class="eyebrow">PLATFORM PROFILE</p><h2>${escapeHtml(field(company,"平台公司名称"))}</h2><p>${escapeHtml(field(company,"上级主管单位") || "上级主管单位待补充")} · ${escapeHtml(field(company,"客户状态") || "状态待补充")}</p></header><div class="online-resource-metrics"><div><strong>${projects.length}</strong><span>关联项目</span></div><div><strong>${people.length}</strong><span>决策链人员</span></div><div><strong>${escapeHtml(field(company,"客户等级") || "-")}</strong><span>客户等级</span></div><div><strong>${escapeHtml(field(company,"内部维护人") || "-")}</strong><span>内部维护人</span></div></div><section><h3>决策链思维导图</h3>${mindMap(company,people)}</section><section><h3>接触时间线</h3>${contactTimeline(id)}</section><section><h3>关联项目</h3><div class="online-project-grid">${projects.length ? projects.map((project) => `<a class="online-project-link" href="ledger.html?project=${encodeURIComponent(field(project,"project_id"))}"><article><strong>${escapeHtml(field(project,"项目名称"))}</strong><span>${escapeHtml(field(project,"业主单位") || "业主待补充")} · ${escapeHtml(field(project,"当前进度"))}</span><small>${escapeHtml(field(project,"下一步工作") || "下一步待补充")}</small></article></a>`).join("") : `<p class="muted">尚未关联项目。</p>`}</div></section>`;
}

elements.loadResourcesButton.addEventListener("click", async () => {
  try {
    show("正在读取资源库..."); await readSnapshot(); renderList(); renderDetail();
    elements.resourceSummary.textContent = `${state.companies.length} 家平台公司 · ${state.links.length} 条项目关联 · 快照 ${state.generatedAt || "时间未知"}`;
    show("平台资源库已与最新台账快照同步。", "success");
  } catch (error) { show(error.message, "error"); }
});
elements.companySearch.addEventListener("input", renderList);
elements.companyList.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (!button) return; state.selectedId = button.dataset.id; const url = new URL(location.href); url.searchParams.set("company",state.selectedId); history.replaceState(null,"",url); renderList(); renderDetail(); });
loadSettings();
