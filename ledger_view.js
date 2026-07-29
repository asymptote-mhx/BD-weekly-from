const GITHUB_SETTINGS_KEY = "bd-weekly-github-settings";
const LEDGER_SNAPSHOT_PATH = "ledger/market_workbench_snapshot.json";
const STAGE_CLASS = {
  项目接触: "stage-contact",
  前期方案: "stage-plan",
  招标流程: "stage-bid",
  维护服务: "stage-service",
};
const CARD_CLASS = {
  项目接触: "stage-contact-card",
  前期方案: "stage-plan-card",
  招标流程: "stage-bid-card",
  维护服务: "stage-service-card",
};

const state = {
  projects: [],
  details: {},
  filtered: [],
  selectedProjectId: "",
  generatedAt: "",
};

const elements = {
  owner: document.getElementById("githubOwnerInput"),
  repo: document.getElementById("githubRepoInput"),
  branch: document.getElementById("githubBranchInput"),
  token: document.getElementById("githubTokenInput"),
  loadButton: document.getElementById("loadLedgerButton"),
  result: document.getElementById("ledgerResult"),
  summary: document.getElementById("snapshotSummary"),
  search: document.getElementById("projectSearch"),
  progressFilter: document.getElementById("progressFilter"),
  regionFilter: document.getElementById("regionFilter"),
  technicalFilter: document.getElementById("technicalFilter"),
  projectCount: document.getElementById("projectCount"),
  projectList: document.getElementById("projectList"),
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),
  detailBody: document.getElementById("detailBody"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showResult(message, type = "info") {
  elements.result.textContent = message;
  elements.result.className = `weekly-result ${type}`;
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GITHUB_SETTINGS_KEY) || "{}");
    if (saved.owner) elements.owner.value = saved.owner;
    if (saved.repo) elements.repo.value = saved.repo;
    if (saved.branch) elements.branch.value = saved.branch;
    if (saved.token) elements.token.value = saved.token;
  } catch {
    localStorage.removeItem(GITHUB_SETTINGS_KEY);
  }
}

function settings() {
  return {
    owner: elements.owner.value.trim() || "asymptote-mhx",
    repo: elements.repo.value.trim() || "BD-weekly-data",
    branch: elements.branch.value.trim() || "main",
    token: elements.token.value.trim(),
  };
}

function saveSettings() {
  localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings()));
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function githubContentUrl(config, path) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}?ref=${encodeURIComponent(config.branch)}`;
}

function base64ToUtf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function responseErrorMessage(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

async function loadLedgerSnapshot() {
  const config = settings();
  if (!config.token) throw new Error("请先填写 GitHub token。");
  saveSettings();
  const response = await fetch(githubContentUrl(config, LEDGER_SNAPSHOT_PATH), {
    headers: githubHeaders(config.token),
  });
  if (!response.ok) {
    throw new Error(`台账快照读取失败：${await responseErrorMessage(response)}`);
  }
  const file = await response.json();
  const snapshot = JSON.parse(base64ToUtf8(file.content || ""));
  state.projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  state.details = snapshot.project_details && typeof snapshot.project_details === "object" ? snapshot.project_details : {};
  state.generatedAt = snapshot.generated_at || "";
  state.selectedProjectId = state.projects[0]?.project_id || "";
}

function field(project, key) {
  return String(project?.[key] || "").trim();
}

function uniqueOptions(key) {
  return [...new Set(state.projects.map((project) => field(project, key)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function setOptions(select, label, values) {
  select.innerHTML = [`<option value="">${label}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

function refreshFilters() {
  setOptions(elements.progressFilter, "全部进度", uniqueOptions("当前进度"));
  setOptions(elements.regionFilter, "全部地区", uniqueOptions("地区"));
  setOptions(elements.technicalFilter, "全部技术配合组", uniqueOptions("技术配合类型"));
}

function applyFilters() {
  const query = elements.search.value.trim().toLowerCase();
  const progress = elements.progressFilter.value;
  const region = elements.regionFilter.value;
  const technical = elements.technicalFilter.value;
  state.filtered = state.projects.filter((project) => {
    const haystack = [
      field(project, "项目名称"),
      field(project, "业主单位"),
      field(project, "地区"),
      field(project, "合作单位"),
      field(project, "当前进度"),
      field(project, "当前细分阶段"),
      field(project, "下一步工作"),
    ].join(" ").toLowerCase();
    return (!query || haystack.includes(query))
      && (!progress || field(project, "当前进度") === progress)
      && (!region || field(project, "地区") === region)
      && (!technical || field(project, "技术配合类型") === technical);
  });
}

function stageClass(project) {
  return STAGE_CLASS[field(project, "当前进度")] || "stage-contact";
}

function cardClass(project) {
  return CARD_CLASS[field(project, "当前进度")] || "stage-contact-card";
}

function renderProjectList() {
  elements.projectCount.textContent = `共 ${state.filtered.length} / ${state.projects.length} 个项目`;
  if (!state.filtered.length) {
    elements.projectList.innerHTML = '<div class="empty-state">没有匹配的项目。</div>';
    return;
  }
  elements.projectList.innerHTML = state.filtered.map((project) => {
    const id = field(project, "project_id");
    const active = id === state.selectedProjectId ? " active" : "";
    return `
      <button class="project-card ${cardClass(project)}${active}" type="button" data-project-id="${escapeHtml(id)}">
        <span class="stage-block ${stageClass(project)}">${escapeHtml(field(project, "当前进度") || "未指定")}</span>
        <span>
          <span class="project-card-topline">
            <strong class="project-name">${escapeHtml(field(project, "项目名称") || "未命名项目")}</strong>
            <em>${escapeHtml(field(project, "项目优先级") || "未评级")}</em>
          </span>
          <span class="project-meta">
            <span>地区：${escapeHtml(field(project, "地区") || "未填")}</span>
            <span>业主：${escapeHtml(field(project, "业主单位") || "未填")}</span>
            <span>阶段：${escapeHtml(field(project, "当前细分阶段") || "未填")}</span>
            <span>技术：${escapeHtml(field(project, "技术配合类型") || "未填")}</span>
          </span>
          <span class="project-next">${escapeHtml(field(project, "下一步工作") || "")}</span>
        </span>
      </button>
    `;
  }).join("");
}

function metric(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "未填")}</strong></div>`;
}

function renderKeyGrid(project) {
  const items = [
    ["业主单位", field(project, "业主单位")],
    ["地区", field(project, "地区")],
    ["合作单位", field(project, "合作单位")],
    ["业主类型", field(project, "业主类型")],
    ["当前进度", field(project, "当前进度")],
    ["当前细分阶段", field(project, "当前细分阶段")],
    ["下一节点时间", field(project, "下一节点时间")],
    ["项目优先级", field(project, "项目优先级")],
    ["预估合同额", field(project, "预估合同额")],
    ["是否需要技术介入", field(project, "是否需要技术介入")],
    ["技术配合组", field(project, "技术配合类型")],
    ["负责人", field(project, "负责人")],
  ];
  return `<div class="detail-grid">${items.map(([label, value]) => metric(label, value)).join("")}</div>`;
}

function section(title, body) {
  const content = String(body || "").trim();
  if (!content) return "";
  return `<section class="chain-section"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(content)}</p></section>`;
}

function renderObjectTable(title, value) {
  if (!value || typeof value !== "object") return "";
  const rows = Array.isArray(value) ? value : Object.entries(value).map(([key, item]) => ({ 名称: key, 内容: item }));
  const meaningful = rows.filter((row) => row && Object.values(row).some(Boolean));
  if (!meaningful.length) return "";
  return `
    <section class="chain-section">
      <h4>${escapeHtml(title)}</h4>
      <div class="ledger-view-structured-list">
        ${meaningful.map((row) => `<pre>${escapeHtml(JSON.stringify(row, null, 2))}</pre>`).join("")}
      </div>
    </section>
  `;
}

function renderProjectDetail() {
  const project = state.projects.find((item) => field(item, "project_id") === state.selectedProjectId);
  if (!project) {
    elements.detailTitle.textContent = "请选择项目";
    elements.detailSubtitle.textContent = "从左侧选择项目查看台账详情。";
    elements.detailBody.innerHTML = '<div class="empty-state">没有选中的项目。</div>';
    return;
  }
  const id = field(project, "project_id");
  const detail = state.details[id] || {};
  const sensitive = detail.sensitive || {};
  const freeDetail = detail.detail || {};
  const structured = detail.structured || {};
  elements.detailTitle.textContent = field(project, "项目名称") || "未命名项目";
  elements.detailSubtitle.textContent = `${field(project, "地区") || "未填地区"} · ${field(project, "当前进度") || "未填进度"} · ${field(project, "当前细分阶段") || "未填阶段"}`;
  elements.detailBody.innerHTML = `
    ${renderKeyGrid(project)}
    <section class="work-item">${escapeHtml(field(project, "下一步工作") || "暂无下一步工作。")}</section>
    <div class="detail-chain-preview">
      ${section("备注", field(project, "备注"))}
      ${section("业主决策链条", freeDetail["业主决策链条"] || sensitive["业主决策链条"])}
      ${section("操作链条", freeDetail["操作链条"] || sensitive["操作链条"])}
      ${section("历史沟通", freeDetail["历史沟通"] || sensitive["历史沟通"])}
      ${renderObjectTable("结构化详情", structured)}
    </div>
  `;
}

function renderAll() {
  applyFilters();
  if (!state.filtered.some((project) => field(project, "project_id") === state.selectedProjectId)) {
    state.selectedProjectId = state.filtered[0]?.project_id || "";
  }
  renderProjectList();
  renderProjectDetail();
}

async function handleLoad() {
  elements.loadButton.disabled = true;
  showResult("正在读取 GitHub 台账快照...", "info");
  try {
    await loadLedgerSnapshot();
    refreshFilters();
    renderAll();
    elements.summary.textContent = state.generatedAt
      ? `快照时间：${state.generatedAt}，项目数：${state.projects.length}`
      : `项目数：${state.projects.length}`;
    showResult(`已读取 ${state.projects.length} 个台账项目。`, "success");
  } catch (error) {
    showResult(`读取失败：${error.message || error}`, "error");
  } finally {
    elements.loadButton.disabled = false;
  }
}

elements.loadButton.addEventListener("click", handleLoad);
[elements.search, elements.progressFilter, elements.regionFilter, elements.technicalFilter].forEach((control) => {
  control.addEventListener("input", renderAll);
  control.addEventListener("change", renderAll);
});

elements.projectList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-project-id]");
  if (!card) return;
  state.selectedProjectId = card.dataset.projectId;
  renderAll();
});

window.addEventListener("error", (event) => {
  showResult(`页面脚本出错：${event.message || "未知错误"}。请刷新页面后再试。`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || event.reason || "未知错误";
  showResult(`页面请求出错：${reason}。请刷新页面后再试。`, "error");
});

loadSettings();
if (settings().token) {
  handleLoad();
} else {
  showResult("第一次使用请填写 GitHub token，再点击“读取台账”。", "info");
}
