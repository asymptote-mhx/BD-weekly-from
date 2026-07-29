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
const STAGE_ORDER = [
  "线索获取",
  "关键人接触",
  "需求确认",
  "资料收集",
  "初步方案",
  "标前准备",
  "投标中",
  "定标阶段",
  "合同签署",
  "建设期",
  "建成",
  "衔接下阶段招标",
];
const PROGRESS_ORDER = ["维护服务", "招标流程", "前期方案", "项目接触"];
const PROGRESS_BY_STAGE = {
  线索获取: "项目接触",
  关键人接触: "项目接触",
  需求确认: "项目接触",
  资料收集: "前期方案",
  初步方案: "前期方案",
  标前准备: "招标流程",
  投标中: "招标流程",
  定标阶段: "招标流程",
  合同签署: "招标流程",
  建设期: "维护服务",
  建成: "维护服务",
  衔接下阶段招标: "维护服务",
};
const PRIORITY_ORDER = ["S", "A", "B", "C"];
const MEETING_GROUP_ORDER = ["一组", "二组", "丁德强组", "未分组项目"];

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
  statusFilter: document.getElementById("statusFilter"),
  sortBy: document.getElementById("sortBy"),
  exportWeeklyReportButton: document.getElementById("exportWeeklyReportButton"),
  exportMeetingListButton: document.getElementById("exportMeetingListButton"),
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

function recordStatus(project) {
  return field(project, "记录状态") || "正常";
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
  const status = elements.statusFilter.value;
  const sortBy = elements.sortBy.value || "stage";
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
      && (!technical || field(project, "技术配合类型") === technical)
      && (!status || recordStatus(project) === status);
  }).sort((a, b) => compareProjects(a, b, sortBy));
}

function priorityIndex(project) {
  const index = PRIORITY_ORDER.indexOf(field(project, "项目优先级").toUpperCase());
  return index === -1 ? PRIORITY_ORDER.length : index;
}

function stageIndex(project) {
  const index = STAGE_ORDER.indexOf(field(project, "当前细分阶段"));
  return index === -1 ? STAGE_ORDER.length : STAGE_ORDER.length - 1 - index;
}

function progressIndex(project) {
  const progress = field(project, "当前进度") || PROGRESS_BY_STAGE[field(project, "当前细分阶段")] || "";
  const index = PROGRESS_ORDER.indexOf(progress);
  return index === -1 ? PROGRESS_ORDER.length : index;
}

function parseInvestment(rawValue) {
  const text = String(rawValue || "").replace(/,/g, "").trim();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return 0;
  if (text.includes("万") && !text.includes("亿")) return amount / 10000;
  return amount;
}

function parseTime(rawValue) {
  const time = Date.parse(String(rawValue || "").replace(/\./g, "-").replace(/\//g, "-"));
  return Number.isFinite(time) ? time : 0;
}

function compareText(a, b, key) {
  return field(a, key).localeCompare(field(b, key), "zh-CN");
}

function comparePriorityThenStageThenName(a, b) {
  return priorityIndex(a) - priorityIndex(b)
    || stageIndex(a) - stageIndex(b)
    || compareText(a, b, "项目名称");
}

function compareProjects(a, b, sortBy) {
  if (sortBy === "stage") {
    return progressIndex(a) - progressIndex(b) || comparePriorityThenStageThenName(a, b);
  }
  if (sortBy === "priority") {
    return comparePriorityThenStageThenName(a, b);
  }
  if (sortBy === "updatedDesc") {
    return parseTime(field(b, "最近更新时间")) - parseTime(field(a, "最近更新时间")) || comparePriorityThenStageThenName(a, b);
  }
  if (sortBy === "investmentDesc") {
    return parseInvestment(field(b, "总投资")) - parseInvestment(field(a, "总投资")) || comparePriorityThenStageThenName(a, b);
  }
  return compareText(a, b, sortBy) || comparePriorityThenStageThenName(a, b);
}

function stageClass(project) {
  return STAGE_CLASS[field(project, "当前进度")] || "stage-contact";
}

function cardClass(project) {
  return CARD_CLASS[field(project, "当前进度")] || "stage-contact-card";
}

function renderProjectList() {
  const normalCount = state.projects.filter((project) => recordStatus(project) === "正常").length;
  const archivedCount = state.projects.filter((project) => recordStatus(project) === "已归档").length;
  elements.projectCount.textContent = `当前 ${state.filtered.length} 个；正常 ${normalCount} 个，已归档 ${archivedCount} 个，总计 ${state.projects.length} 个`;
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

function mondayReportTitle(date = new Date()) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return `${String(monday.getFullYear()).slice(2)}${String(monday.getMonth() + 1).padStart(2, "0")}${String(monday.getDate()).padStart(2, "0")}_周工作小结`;
}

function activeExportProjects() {
  return state.filtered.length ? state.filtered : [];
}

function exportWeeklyReportMarkdown() {
  const projects = activeExportProjects();
  if (!projects.length) {
    showResult("没有可导出的项目。", "error");
    return;
  }
  const lines = [
    `# ${mondayReportTitle()}`,
    "",
    "## 主要拜访人员",
    "- ",
    "",
    "## 项目跟进情况",
  ];
  projects.forEach((project) => {
    lines.push(
      "",
      `### ${field(project, "项目名称")}`,
      `- 业主单位：${field(project, "业主单位")}`,
      `- 地区：${field(project, "地区")}`,
      `- 技术配合组：${field(project, "技术配合类型")}`,
      `- 当前进度：${field(project, "当前进度")}`,
      `- 当前细分阶段：${field(project, "当前细分阶段")}`,
      `- 本周进展：${field(project, "状态备注")}`,
      `- 下一步工作：${field(project, "下一步工作")}`,
      `- 下一节点时间：${field(project, "下一节点时间")}`,
    );
  });
  lines.push("", "## 下周工作计划", "1. ", "");
  downloadText(`${mondayReportTitle()}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  showResult(`已导出工作小结：${projects.length} 个项目。`, "success");
}

function meetingGroupName(value) {
  const normalized = String(value || "").trim();
  if (normalized === "一组" || normalized === "二组") return normalized;
  if (normalized === "丁德强团队" || normalized === "丁德强组") return "丁德强组";
  return "未分组项目";
}

function meetingScale(project) {
  return field(project, "建设规模")
    || field(project, "总投资")
    || field(project, "用地面积")
    || field(project, "建设内容")
    || "";
}

function exportMeetingListExcelHtml() {
  const projects = activeExportProjects();
  if (!projects.length) {
    showResult("没有可导出的项目。", "error");
    return;
  }
  const groups = new Map(MEETING_GROUP_ORDER.map((name) => [name, []]));
  projects.forEach((project) => {
    const group = meetingGroupName(field(project, "技术配合类型"));
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(project);
  });
  groups.forEach((rows) => rows.sort(comparePriorityThenStageThenName));
  const tableRows = [
    "<tr><th>项目优先级</th><th>项目名称</th><th>规模</th><th>进度</th><th>下一节点时间</th><th>预估合同额</th></tr>",
  ];
  MEETING_GROUP_ORDER.forEach((group) => {
    const rows = groups.get(group) || [];
    if (!rows.length) return;
    tableRows.push(`<tr class="group"><td colspan="6">${escapeHtml(group)}</td></tr>`);
    rows.forEach((project) => {
      tableRows.push(`<tr><td>${escapeHtml(field(project, "项目优先级"))}</td><td>${escapeHtml(field(project, "项目名称"))}</td><td>${escapeHtml(meetingScale(project))}</td><td>${escapeHtml(field(project, "当前进度"))}</td><td>${escapeHtml(field(project, "下一节点时间"))}</td><td>${escapeHtml(field(project, "预估合同额"))}</td></tr>`);
    });
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:"Microsoft YaHei",Arial,sans-serif;font-size:12px}th,td{border:1px solid #999;padding:6px 8px;vertical-align:top}th{background:#e8ddcb}.group td{background:#d6e3dc;font-weight:bold}</style></head><body><table>${tableRows.join("")}</table></body></html>`;
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  downloadText(`${stamp}_部门例会项目清单.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  showResult(`已导出例会清单：${projects.length} 个项目。`, "success");
}

function downloadText(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
elements.exportWeeklyReportButton.addEventListener("click", exportWeeklyReportMarkdown);
elements.exportMeetingListButton.addEventListener("click", exportMeetingListExcelHtml);
[elements.search, elements.progressFilter, elements.regionFilter, elements.technicalFilter, elements.statusFilter, elements.sortBy].forEach((control) => {
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
