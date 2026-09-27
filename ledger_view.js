const GITHUB_SETTINGS_KEY = "bd-weekly-github-settings";
const LEDGER_SNAPSHOT_PATH = "ledger/market_workbench_snapshot.json";
const WEEKLY_REPORT_DIR = "weekly";
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
const PROJECT_FIELD_GROUPS = [
  ["项目状态", [
    ["项目名称", "项目名称", "text", true], ["记录状态", "记录状态", "select", false, ["正常", "已结束", "已合并"]],
    ["结束原因", "结束原因", "select", false, ["未中标", "商务评价放弃"]],
    ["项目优先级", "项目优先级", "select", false, ["S", "A", "B", "C"]], ["数据确认状态", "数据确认状态"],
    ["当前进度", "当前进度", "select", false, Object.keys(STAGE_CLASS)], ["当前细分阶段", "当前细分阶段", "select", false, STAGE_ORDER],
    ["下一节点时间", "下一节点时间", "date"], ["内部负责人", "内部负责人"], ["状态备注", "状态备注", "textarea", true],
    ["下一步工作", "下一步工作", "textarea", true],
  ]],
  ["基础信息", [
    ["地区", "地区"], ["业主单位", "业主单位"], ["合作单位", "合作单位"], ["业主类型", "业主类型"],
    ["详细地址", "详细地址", "text", true], ["用地面积", "用地面积"], ["建筑面积", "建筑面积"],
    ["建设规模", "建设规模", "textarea", true], ["建设内容", "建设内容", "textarea", true],
    ["策划范围或设计范围", "策划范围或设计范围", "textarea", true], ["总投资", "总投资"], ["预估合同额", "预估合同额"],
  ]],
  ["协同与关联", [
    ["是否需要技术介入", "是否需要技术介入"], ["技术配合类型", "技术配合组"],
    ["主项目ID", "主项目 ID"], ["主项目名称", "主项目名称"], ["关联原因", "关联原因", "textarea", true],
    ["直接业主单位ID", "直接业主单位 ID"], ["平台归属确认状态", "平台归属确认状态"],
  ]],
];
const DETAIL_FIELDS = [
  ["项目概况", "项目概况"], ["决策与操作体系对接情况", "决策与操作体系对接情况"],
  ["业主决策链条", "业主决策链条（历史文本）"], ["营销大事纪", "拜访记录（历史文本）"],
  ["竞争态势分析", "竞争态势分析"], ["招标规划解析及招标文件策划", "招标规划解析及招标文件策划"],
  ["下一步重点", "下一步重点"], ["需院内协调事宜", "需院内协调事宜"], ["参考来源", "参考来源"],
];
const SENSITIVE_FIELDS = [
  ["预计设计费用", "预计设计费用"], ["报价区间", "报价区间"], ["商务成本", "商务成本"],
  ["竞争格局", "竞争格局"], ["切入优势", "切入优势"], ["风险点", "风险点"], ["商务备注", "商务备注"],
];

const state = {
  snapshot: null,
  sha: "",
  projects: [],
  details: {},
  progressRecords: [],
  filtered: [],
  selectedProjectId: "",
  generatedAt: "",
  dirty: false,
};

const elements = {
  owner: document.getElementById("githubOwnerInput"),
  repo: document.getElementById("githubRepoInput"),
  branch: document.getElementById("githubBranchInput"),
  token: document.getElementById("githubTokenInput"),
  loadButton: document.getElementById("loadLedgerButton"),
  saveButton: document.getElementById("saveLedgerButton"),
  importProgressButton: document.getElementById("importWeeklyProgressButton"),
  newProjectButton: document.getElementById("newProjectButton"),
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
  weeklyPdfLink: document.getElementById("weeklyPdfLink"),
  projectCount: document.getElementById("projectCount"),
  projectList: document.getElementById("projectList"),
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),
  detailBody: document.getElementById("detailBody"),
  editProjectButton: document.getElementById("editProjectButton"),
  archiveProjectButton: document.getElementById("archiveProjectButton"),
  deleteProjectButton: document.getElementById("deleteProjectButton"),
  projectEditorDialog: document.getElementById("projectEditorDialog"),
  projectEditorForm: document.getElementById("projectEditorForm"),
  projectEditorFields: document.getElementById("projectEditorFields"),
  projectEditorTitle: document.getElementById("projectEditorTitle"),
  progressEditorDialog: document.getElementById("progressEditorDialog"),
  progressEditorForm: document.getElementById("progressEditorForm"),
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
    "Content-Type": "application/json; charset=utf-8",
  };
}

function githubContentUrl(config, path, write = false) {
  const base = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
  return write ? base : `${base}?ref=${encodeURIComponent(config.branch)}`;
}

function base64ToUtf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function nowText() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function mondayDate(date = new Date()) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function mondayFilePrefix(date = new Date()) {
  return mondayDate(date).replace(/-/g, "").slice(2);
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function masterReady() {
  return Number(state.snapshot?.schema_version || 0) >= 3 && state.snapshot?.data_role === "github_master";
}

function markDirty(message = "修改已暂存，点击“保存到 GitHub”后生效。") {
  state.dirty = true;
  elements.saveButton.disabled = false;
  showResult(message, "warning");
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
  state.snapshot = snapshot;
  state.sha = String(file.sha || "");
  state.projects = Array.isArray(snapshot.projects) ? structuredClone(snapshot.projects) : [];
  state.details = snapshot.project_details && typeof snapshot.project_details === "object" ? snapshot.project_details : {};
  state.details = structuredClone(state.details);
  state.progressRecords = Array.isArray(snapshot.progress_records) ? structuredClone(snapshot.progress_records) : [];
  state.generatedAt = snapshot.generated_at || "";
  state.dirty = false;
  const requestedProjectId = new URLSearchParams(location.search).get("project") || "";
  state.selectedProjectId = state.projects.some((row) => String(row?.project_id || "") === requestedProjectId)
    ? requestedProjectId : (state.projects[0]?.project_id || "");
}

function validateBrowserMaster() {
  const ids = new Set();
  for (const project of state.projects) {
    const projectId = field(project, "project_id");
    if (!projectId) throw new Error("存在缺少 project_id 的项目，不能保存。");
    if (ids.has(projectId)) throw new Error(`项目 ID 重复：${projectId}`);
    ids.add(projectId);
  }
  for (const record of state.progressRecords) {
    if (!ids.has(field(record, "project_id"))) throw new Error(`推进记录引用了未知项目：${field(record, "project_id")}`);
  }
}

function synchronizedPlatformProjects(snapshot) {
  const resources = snapshot.platform_resources && typeof snapshot.platform_resources === "object"
    ? snapshot.platform_resources : {};
  const links = Array.isArray(resources.project_platform_links) ? resources.project_platform_links : [];
  const companyById = new Map(platformCompanies(resources).map((row) => [field(row, "platform_company_id"), row]));
  const synchronizedProjects = state.projects.map((project) => {
    const matched = links.filter((row) => field(row, "project_id") === field(project, "project_id")).map((row) => ({
      platform_company_id: field(row, "platform_company_id"),
      "平台公司名称": field(row, "平台公司名称") || field(companyById.get(field(row, "platform_company_id")), "平台公司名称"),
      "关联类型": field(row, "关联类型"),
      "是否主关联": field(row, "是否主关联"),
    }));
    const primary = matched.find((row) => row["是否主关联"] === "是") || matched[0] || {};
    return {...project, "关联平台公司": matched, "平台公司ID": field(primary, "platform_company_id"), "平台公司名称": field(primary, "平台公司名称")};
  });
  snapshot.projects = structuredClone(synchronizedProjects);
  resources.projects = structuredClone(synchronizedProjects);
  const linked = new Set(links.map((row) => field(row, "project_id")));
  resources.unassigned_projects = resources.projects.filter((row) => isActiveProject(row) && !linked.has(field(row, "project_id")));
  snapshot.platform_resources = resources;
}

async function saveLedgerMaster(commitMessage = "") {
  if (!state.snapshot || !state.sha) throw new Error("请先读取 GitHub 主档。");
  if (!masterReady()) throw new Error("当前文件仍是旧快照。请先执行 Excel → GitHub 主档迁移，避免丢失结束项目。");
  validateBrowserMaster();
  const config = settings();
  if (!config.token) throw new Error("请先填写 GitHub token。");
  const snapshot = structuredClone(state.snapshot);
  snapshot.schema_version = 3;
  snapshot.data_role = "github_master";
  snapshot.generated_at = nowText();
  snapshot.projects = structuredClone(state.projects);
  snapshot.project_details = structuredClone(state.details);
  snapshot.progress_records = structuredClone(state.progressRecords);
  synchronizedPlatformProjects(snapshot);
  const body = {
    message: commitMessage || `chore: update project ledger (${snapshot.generated_at})`,
    content: utf8ToBase64(JSON.stringify(snapshot, null, 2)),
    branch: config.branch,
    sha: state.sha,
  };
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = "正在保存...";
  try {
    const response = await fetch(githubContentUrl(config, LEDGER_SNAPSHOT_PATH, true), {
      method: "PUT", headers: githubHeaders(config.token), body: JSON.stringify(body),
    });
    if (!response.ok) {
      if (response.status === 409 || response.status === 422) {
        const conflict = new Error("保存冲突：GitHub 主档已被其他修改更新。");
        conflict.retryableConflict = true;
        throw conflict;
      }
      throw new Error(`保存失败：${await responseErrorMessage(response)}`);
    }
    const result = await response.json();
    state.snapshot = snapshot;
    state.projects = structuredClone(snapshot.projects || []);
    state.sha = String(result.content?.sha || state.sha);
    state.generatedAt = snapshot.generated_at;
    state.dirty = false;
    showResult("已保存到 GitHub 私有主档。", "success");
  } finally {
    elements.saveButton.textContent = "保存到 GitHub";
    elements.saveButton.disabled = !state.dirty;
  }
}

async function readWeeklyMarkdown(config, file) {
  const response = await fetch(githubContentUrl(config, file.path), {headers: githubHeaders(config.token)});
  if (!response.ok) throw new Error(`周报读取失败：${file.name}：${await responseErrorMessage(response)}`);
  const payload = await response.json();
  const markdown = base64ToUtf8(payload.content || "");
  return {file, report: window.MarketWeeklyMarkdown.parse(markdown, file.name.replace(/\.md$/i, ""))};
}

async function loadCurrentWeeklyReport() {
  if (!window.MarketWeeklyMarkdown?.parse) throw new Error("周报解析器未加载，请刷新页面后重试。");
  const config = settings();
  const response = await fetch(githubContentUrl(config, WEEKLY_REPORT_DIR), {headers: githubHeaders(config.token)});
  if (!response.ok) throw new Error(`周报目录读取失败：${await responseErrorMessage(response)}`);
  const files = (await response.json())
    .filter((file) => file.type === "file" && file.name.toLowerCase().endsWith(".md"))
    .sort((a, b) => b.name.localeCompare(a.name));
  const prefix = mondayFilePrefix();
  const preferred = files.filter((file) => file.name.startsWith(prefix));
  const candidates = preferred.length ? preferred : files.slice(0, 12);
  if (!candidates.length) throw new Error("没有找到可导入的周报。");
  const reports = await Promise.all(candidates.map((file) => readWeeklyMarkdown(config, file)));
  const currentMonday = mondayDate();
  const current = reports
    .filter(({report}) => report.report_date === currentMonday || (!report.report_date && report.title.startsWith(prefix)))
    .sort((a, b) => String(b.report.updated_at || b.file.name).localeCompare(String(a.report.updated_at || a.file.name)));
  const completed = current.find(({report}) => report.status === "completed");
  if (completed) return completed;
  if (current.length) throw new Error("本周周报仍是草稿，请先在周报页面点击“完成”。");
  throw new Error(`没有找到 ${currentMonday} 这一周的周报。`);
}

function ledgerProjectForWeekly(weeklyProject) {
  const projectId = String(weeklyProject.project_id || "").trim();
  if (projectId) return state.projects.find((project) => field(project, "project_id") === projectId);
  const name = String(weeklyProject.name || "").trim();
  return state.projects.find((project) => field(project, "项目名称") === name);
}

function importWeeklyProgress(report, sourceFile) {
  let updated = 0;
  const skipped = [];
  (report.projects || []).forEach((weeklyProject, index) => {
    const project = ledgerProjectForWeekly(weeklyProject);
    if (!project) {
      skipped.push(String(weeklyProject.name || weeklyProject.project_id || `第 ${index + 1} 个项目`));
      return;
    }
    [
      ["业主单位", "owner_org"], ["当前进度", "progress"], ["当前细分阶段", "detail_stage"],
      ["下一节点时间", "next_node_time"], ["状态备注", "current_update"], ["下一步工作", "next_work"],
    ].forEach(([target, source]) => {
      const value = String(weeklyProject[source] || "").trim();
      if (value) project[target] = value;
    });
    project["最近更新时间"] = nowText();
    const recordId = `weekly-${String(report.title || "week").replace(/[^0-9A-Za-z_-]/g, "-")}-${field(project, "project_id") || index}`;
    const progress = {
      record_id: recordId,
      project_id: field(project, "project_id"),
      更新日期: report.report_date || mondayDate(),
      来源文件: sourceFile,
      当前阶段: weeklyProject.detail_stage || weeklyProject.progress || "",
      更新内容: weeklyProject.current_update || "",
      下一步工作: weeklyProject.next_work || "",
      下一节点时间: weeklyProject.next_node_time || "",
      是否已确认: "是",
    };
    const recordIndex = state.progressRecords.findIndex((row) => field(row, "record_id") === recordId);
    if (progress["更新内容"] || progress["下一步工作"] || progress["下一节点时间"]) {
      if (recordIndex === -1) state.progressRecords.push(progress);
      else state.progressRecords[recordIndex] = {...state.progressRecords[recordIndex], ...progress};
    }
    updated += 1;
  });
  return {updated, skipped};
}

async function handleProgressImport() {
  if (!state.snapshot || !state.sha) throw new Error("请先读取 GitHub 主档。");
  if (!masterReady()) throw new Error("当前不是可编辑的 GitHub 主档。");
  if (state.dirty) throw new Error("页面存在尚未保存的台账修改。请先保存或读取 / 刷新，再进行进度导入。");
  elements.importProgressButton.disabled = true;
  elements.importProgressButton.textContent = "正在导入...";
  showResult("正在读取本周完成稿并更新台账...", "info");
  try {
    const {file, report} = await loadCurrentWeeklyReport();
    let result = null;
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      if (attempt > 0) showResult(`检测到 GitHub 主档更新，正在读取最新版并自动重试（${attempt}/2）...`, "info");
      await loadLedgerSnapshot();
      if (!masterReady()) throw new Error("当前不是可编辑的 GitHub 主档。");
      result = importWeeklyProgress(report, file.name);
      if (!result.updated) throw new Error("本周周报中没有可匹配的已有台账项目，未保存任何修改。");
      state.dirty = true;
      try {
        await saveLedgerMaster(`chore: import weekly progress from ${file.name}`);
        saved = true;
      } catch (error) {
        if (!error.retryableConflict || attempt === 2) throw error;
      }
    }
    refreshFilters();
    renderAll();
    elements.summary.textContent = `GitHub 主档 · 更新时间：${state.generatedAt || "未记录"} · 项目：${state.projects.length} · 平台公司：${platformCompanies().length}`;
    elements.weeklyPdfLink.href = `reports.html?title=${encodeURIComponent(report.title)}`;
    const skipped = result.skipped.length ? `；跳过 ${result.skipped.length} 个无法匹配的项目：${result.skipped.join("、")}` : "";
    showResult(`进度导入完成：已更新 ${result.updated} 个台账项目${skipped}。现在可点击“每周周报 PDF”生成 PDF。`, result.skipped.length ? "warning" : "success");
  } finally {
    elements.importProgressButton.textContent = "进度导入";
    elements.importProgressButton.disabled = !masterReady();
  }
}

function field(project, key) {
  return String(project?.[key] || "").trim();
}

function platformCompanies(resources = state.snapshot?.platform_resources) {
  return Array.isArray(resources?.platform_companies) ? resources.platform_companies : [];
}

function platformLinks() {
  const resources = state.snapshot?.platform_resources;
  return Array.isArray(resources?.project_platform_links) ? resources.project_platform_links : [];
}

function selectedPlatformIds(projectId, project = {}) {
  const linked = platformLinks().filter((row) => field(row, "project_id") === projectId).map((row) => field(row, "platform_company_id"));
  if (linked.length) return new Set(linked);
  return new Set(projectPlatforms(project).map((row) => field(row, "platform_company_id")).filter(Boolean));
}

function renderPlatformEditor(project) {
  const companies = [...platformCompanies()].sort((a, b) => field(a, "平台公司名称").localeCompare(field(b, "平台公司名称"), "zh-Hans-CN"));
  const selected = selectedPlatformIds(field(project, "project_id"), project);
  const choices = companies.map((company) => {
    const companyId = field(company, "platform_company_id");
    const description = [field(company, "地区"), field(company, "资源分类")].filter(Boolean).join(" · ");
    return `<label class="ledger-platform-choice"><input type="checkbox" data-platform-company-id="${escapeHtml(companyId)}"${selected.has(companyId) ? " checked" : ""}><span><strong>${escapeHtml(field(company, "平台公司名称") || "未命名平台")}</strong><small>${escapeHtml(description || "平台档案")}</small></span></label>`;
  }).join("");
  return `<section class="ledger-editor-group ledger-platform-editor"><header><div><h3>关联平台公司</h3><p>数据来自平台资源库，可多选；保存项目时同步写回双方关联。</p></div><a href="resources.html" target="_blank" rel="noopener">打开资源库</a></header><div class="ledger-platform-choice-grid">${choices || '<p class="panel-summary">平台资源库中尚无公司，请先新增平台档案。</p>'}</div></section>`;
}

function syncProjectPlatformLinks(project) {
  const resources = state.snapshot.platform_resources || (state.snapshot.platform_resources = {});
  const projectId = field(project, "project_id");
  const selectedIds = [...elements.projectEditorFields.querySelectorAll("[data-platform-company-id]:checked")].map((input) => input.dataset.platformCompanyId).filter(Boolean);
  const companyById = new Map(platformCompanies(resources).map((row) => [field(row, "platform_company_id"), row]));
  const existing = platformLinks().filter((row) => field(row, "project_id") === projectId);
  const existingByCompany = new Map(existing.map((row) => [field(row, "platform_company_id"), row]));
  const previousPrimary = existing.find((row) => field(row, "是否主关联") === "是");
  const primaryId = selectedIds.includes(field(previousPrimary, "platform_company_id")) ? field(previousPrimary, "platform_company_id") : (selectedIds[0] || "");
  const retained = platformLinks().filter((row) => field(row, "project_id") !== projectId);
  const updated = selectedIds.map((companyId) => {
    const company = companyById.get(companyId) || {};
    const old = existingByCompany.get(companyId) || {};
    return {...old, link_id: field(old, "link_id") || uniqueId("project-platform"), project_id: projectId, platform_company_id: companyId, "平台公司名称": field(company, "平台公司名称"), "关联类型": field(old, "关联类型") || "项目台账维护", "是否主关联": companyId === primaryId ? "是" : "否", "最近更新时间": nowText()};
  });
  resources.project_platform_links = [...retained, ...updated];
  const annotations = updated.map((row) => ({platform_company_id: field(row, "platform_company_id"), "平台公司名称": field(row, "平台公司名称"), "关联类型": field(row, "关联类型"), "是否主关联": field(row, "是否主关联")}));
  const primary = annotations.find((row) => row["是否主关联"] === "是") || annotations[0] || {};
  project["关联平台公司"] = annotations;
  project["平台公司ID"] = field(primary, "platform_company_id");
  project["平台公司名称"] = field(primary, "平台公司名称");
}

function projectPlatforms(project) {
  const linked = Array.isArray(project?.["关联平台公司"]) ? project["关联平台公司"] : [];
  if (linked.length) return linked;
  const legacyId = field(project, "平台公司ID");
  return legacyId ? [{platform_company_id: legacyId, "平台公司名称": field(project, "平台公司名称")}] : [];
}

function platformNames(project) {
  return projectPlatforms(project).map((row) => field(row, "平台公司名称")).filter(Boolean).join("、");
}

function renderPlatformSection(project) {
  const platforms = projectPlatforms(project);
  return `<section class="ledger-platform-section"><header><h4>关联平台公司</h4><a href="resources.html">查看平台资源库</a></header><div class="ledger-platform-tags">${platforms.length ? platforms.map((row) => `<a href="resources.html?company=${encodeURIComponent(field(row,"platform_company_id"))}">${escapeHtml(field(row,"平台公司名称") || "未命名平台")}</a>`).join("") : '<span>尚未关联平台公司</span>'}</div><p>业主单位为独立字段，可记录未进入资源库的实际业主。</p></section>`;
}

function recordStatus(project) {
  const status = field(project, "记录状态") || "正常";
  return status === "已归档" ? "已结束" : status;
}

function isActiveProject(project) {
  return recordStatus(project) === "正常";
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
      platformNames(project),
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
  const endedCount = state.projects.filter((project) => recordStatus(project) === "已结束").length;
  elements.projectCount.textContent = `当前 ${state.filtered.length} 个；正常 ${normalCount} 个，已结束 ${endedCount} 个，总计 ${state.projects.length} 个`;
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
            <span>平台：${escapeHtml(platformNames(project) || "未关联")}</span>
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
    ["平台公司", platformNames(project)],
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
    ["负责人", field(project, "内部负责人")],
    ...(recordStatus(project) === "已结束" ? [["结束原因", field(project, "结束原因")]] : []),
  ];
  return `<div class="detail-grid">${items.map(([label, value]) => metric(label, value)).join("")}</div>`;
}

function section(title, body) {
  const content = String(body || "").trim();
  if (!content) return "";
  return `<section class="chain-section"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(content)}</p></section>`;
}

function meaningfulValue(value) {
  return String(value || "").trim();
}

function meaningfulStructuredRow(row, ignoredFields = []) {
  const ignored = new Set(["item_id", "project_id", "排序", ...ignoredFields]);
  return row && Object.entries(row).some(([key, value]) => !ignored.has(key) && meaningfulValue(value));
}

function contactCount(row) {
  const raw = meaningfulValue(row["接触次数"]);
  if (!raw) return "0";
  return raw;
}

function formatDateTime(value) {
  const text = meaningfulValue(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderInfoPill(label, value) {
  const text = meaningfulValue(value);
  if (!text) return "";
  return `<span class="ledger-info-pill"><b>${escapeHtml(label)}</b>${escapeHtml(text)}</span>`;
}

function renderPeopleCards(title, rows) {
  const people = rows.filter((row) => meaningfulStructuredRow(row, ["链条类型"]));
  if (!people.length) return "";
  const totalContacts = people.reduce((sum, row) => sum + (Number.parseInt(contactCount(row), 10) || 0), 0);
  const decisionCount = people.filter((row) => meaningfulValue(row["权重"]).includes("决策")).length;
  return `
    <section class="ledger-visual-section">
      <div class="ledger-visual-header">
        <h4>${escapeHtml(title)}</h4>
        <span>${people.length} 人 · 接触 ${totalContacts} 次 · 关键 ${decisionCount} 人</span>
      </div>
      <div class="ledger-person-grid">
        ${people.map((row) => {
          const name = meaningfulValue(row["姓名"]) || "未填姓名";
          const meta = [row["单位"], row["职务"]].map(meaningfulValue).filter(Boolean).join(" · ");
          return `
            <article class="ledger-person-card">
              <div class="ledger-person-topline">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(meaningfulValue(row["权重"]) || "未标权重")}</span>
              </div>
              <p>${escapeHtml(meta || "未填单位/职务")}</p>
              <div class="ledger-person-metrics">
                <div><b>${escapeHtml(contactCount(row))}</b><span>接触次数</span></div>
                <div><b>${escapeHtml(formatDateTime(row["最近更新时间"]) || "未填")}</b><span>最近更新</span></div>
              </div>
              <div class="ledger-info-pills">
                ${renderInfoPill("电话", row["电话"])}
                ${renderInfoPill("备注", row["备注"])}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderMarketingCards(rows) {
  const events = rows.filter((row) => meaningfulStructuredRow(row));
  if (!events.length) return "";
  return `
    <section class="ledger-visual-section">
      <div class="ledger-visual-header">
        <h4>拜访记录</h4>
        <span>${events.length} 条记录</span>
      </div>
      <div class="ledger-event-list">
        ${events.map((row, index) => `
          <article class="ledger-event-card">
            <span>${escapeHtml(meaningfulValue(row["日期"]) || `记录 ${index + 1}`)}</span>
            <p>${escapeHtml(meaningfulValue(row["内容"]) || "未填内容")}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCompetitorCards(rows) {
  const competitors = rows.filter((row) => meaningfulStructuredRow(row));
  if (!competitors.length) return "";
  return `
    <section class="ledger-visual-section">
      <div class="ledger-visual-header">
        <h4>竞争态势</h4>
        <span>${competitors.length} 个对手/关系</span>
      </div>
      <div class="ledger-competitor-grid">
        ${competitors.map((row) => `
          <article class="ledger-competitor-card">
            <strong>${escapeHtml(meaningfulValue(row["竞争对手"]) || "未填竞争对手")}</strong>
            <p>${escapeHtml(meaningfulValue(row["条线关系"]) || "未填条线关系")}</p>
            ${meaningfulValue(row["备注"]) ? `<span>${escapeHtml(row["备注"])}</span>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
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
  const people = Array.isArray(value.chain_people) ? value.chain_people : [];
  const decisionPeople = people.filter((row) => row["链条类型"] !== "操作链条");
  const marketingEvents = Array.isArray(value.marketing_events) ? value.marketing_events : [];
  const competitors = Array.isArray(value.competitors) ? value.competitors : [];
  const content = [
    renderPeopleCards("业主决策链条", decisionPeople),
    renderMarketingCards(marketingEvents),
    renderCompetitorCards(competitors),
  ].filter(Boolean).join("");
  if (content) return content;
  return section(title, "暂无结构化详情。");
}

function editorControl(spec, value, source = "project") {
  const [key, label, type = "text", wide = false, options = []] = spec;
  const attrs = `data-editor-source="${source}" data-editor-key="${escapeHtml(key)}"`;
  let control;
  if (type === "select") {
    control = `<select ${attrs}><option value="">未选择</option>${options.map((option) => `<option value="${escapeHtml(option)}"${String(value || "") === option ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`;
  } else if (type === "textarea") {
    control = `<textarea ${attrs} rows="3">${escapeHtml(value)}</textarea>`;
  } else {
    control = `<input ${attrs} type="${type}" value="${escapeHtml(value)}"${key === "项目名称" ? " required" : ""}>`;
  }
  return `<label class="${wide ? "wide" : ""}">${escapeHtml(label)}${control}</label>`;
}

function delimitedLines(rows, fields) {
  return (Array.isArray(rows) ? rows : []).map((row) => fields.map((key) => field(row, key)).join("｜")).join("\n");
}

function structuredEditor(projectId, structured) {
  return `<section class="ledger-editor-group"><h3>结构化详情</h3><div class="ledger-editor-grid">
    <label class="wide">决策链人员 <small>每行：姓名｜单位｜职务｜电话｜权重｜备注</small><textarea data-editor-source="structured" data-editor-key="chain_people" rows="5">${escapeHtml(delimitedLines(structured.chain_people, ["姓名", "单位", "职务", "电话", "权重", "备注"]))}</textarea></label>
    <label class="wide">拜访记录 <small>每行：日期｜内容</small><textarea data-editor-source="structured" data-editor-key="marketing_events" rows="5">${escapeHtml(delimitedLines(structured.marketing_events, ["日期", "内容"]))}</textarea></label>
    <label class="wide">竞争态势 <small>每行：竞争对手｜条线关系｜备注</small><textarea data-editor-source="structured" data-editor-key="competitors" rows="5">${escapeHtml(delimitedLines(structured.competitors, ["竞争对手", "条线关系", "备注"]))}</textarea></label>
  </div></section>`;
}

function openProjectEditor(project = null) {
  if (!masterReady()) {
    showResult("当前还是旧快照，请先完成 GitHub 主档迁移。", "error");
    return;
  }
  const current = project ? {...project, "记录状态": recordStatus(project)} : {"记录状态": "正常", "当前进度": "项目接触", "当前细分阶段": "线索获取"};
  const projectId = field(current, "project_id");
  elements.projectEditorTitle.textContent = projectId ? `编辑：${field(current, "项目名称") || projectId}` : "新建项目";
  elements.projectEditorDialog.dataset.projectId = projectId;
  const groups = PROJECT_FIELD_GROUPS.map(([title, specs]) => `<section class="ledger-editor-group"><h3>${escapeHtml(title)}</h3><div class="ledger-editor-grid">${specs.map((spec) => editorControl(spec, current[spec[0]] || "")).join("")}</div></section>`);
  groups.push(renderPlatformEditor(current));
  elements.projectEditorFields.innerHTML = groups.join("");
  elements.projectEditorDialog.showModal();
}

function parseStructuredLines(text, fields, oldRows, projectId, prefix) {
  const rows = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return rows.map((line, index) => {
    const parts = line.split(/[｜|]/).map((part) => part.trim());
    const old = Array.isArray(oldRows) ? (oldRows[index] || {}) : {};
    const row = {...old, item_id: field(old, "item_id") || uniqueId(prefix), project_id: projectId, 排序: String(index + 1), 最近更新时间: nowText()};
    fields.forEach((key, partIndex) => { row[key] = parts[partIndex] || ""; });
    return row;
  });
}

function submitProjectEditor(event) {
  event.preventDefault();
  const oldId = elements.projectEditorDialog.dataset.projectId || "";
  const oldProject = state.projects.find((row) => field(row, "project_id") === oldId) || {};
  const projectId = oldId || uniqueId("project");
  const project = {...oldProject, project_id: projectId};
  for (const input of elements.projectEditorFields.querySelectorAll("[data-editor-source][data-editor-key]")) {
    const source = input.dataset.editorSource;
    const key = input.dataset.editorKey;
    const value = input.value.trim();
    if (source === "project") project[key] = value;
  }
  if (!field(project, "项目名称")) return;
  syncProjectPlatformLinks(project);
  project["记录状态"] = field(project, "记录状态") || "正常";
  project["最近更新时间"] = nowText();
  const index = state.projects.findIndex((row) => field(row, "project_id") === projectId);
  if (index === -1) state.projects.unshift(project); else state.projects[index] = project;
  state.selectedProjectId = projectId;
  markDirty(index === -1 ? "新项目已暂存，点击“保存到 GitHub”后生效。" : undefined);
  elements.projectEditorDialog.close();
  refreshFilters();
  renderAll();
}

function projectProgress(projectId) {
  return state.progressRecords.filter((row) => field(row, "project_id") === projectId)
    .sort((a, b) => field(b, "更新日期").localeCompare(field(a, "更新日期")));
}

function renderProgressSection(projectId) {
  const records = projectProgress(projectId);
  return `<section class="ledger-progress-section"><header><div><h4>推进记录</h4><span class="panel-summary">${records.length} 条</span></div><button type="button" data-add-progress>新增记录</button></header><div class="ledger-progress-list">${records.length ? records.map((row) => `<article class="ledger-progress-item"><time>${escapeHtml(field(row, "更新日期") || "日期未填")}</time><div><strong>${escapeHtml(field(row, "当前阶段") || "阶段未填")}</strong><p>${escapeHtml(field(row, "更新内容") || "内容未填")}</p>${field(row, "下一步工作") ? `<span>下一步：${escapeHtml(field(row, "下一步工作"))}</span>` : ""}</div><div><button type="button" data-edit-progress="${escapeHtml(field(row, "record_id"))}">编辑</button><button type="button" data-delete-progress="${escapeHtml(field(row, "record_id"))}">删除</button></div></article>`).join("") : '<p class="panel-summary">暂无推进记录。</p>'}</div></section>`;
}

function openProgressEditor(record = null) {
  const current = record || {};
  document.getElementById("progressEditorTitle").textContent = record ? "编辑推进记录" : "新增推进记录";
  document.getElementById("progressRecordId").value = field(current, "record_id");
  document.getElementById("progressDate").value = field(current, "更新日期") || new Date().toISOString().slice(0, 10);
  document.getElementById("progressStage").innerHTML = STAGE_ORDER.map((stage) => `<option${field(current, "当前阶段") === stage ? " selected" : ""}>${escapeHtml(stage)}</option>`).join("");
  document.getElementById("progressText").value = field(current, "更新内容");
  document.getElementById("progressNextWork").value = field(current, "下一步工作");
  document.getElementById("progressNextDate").value = field(current, "下一节点时间");
  document.getElementById("progressSource").value = field(current, "来源文件") || "线上台账";
  elements.progressEditorDialog.showModal();
}

function submitProgressEditor(event) {
  event.preventDefault();
  const recordId = document.getElementById("progressRecordId").value || uniqueId("progress");
  const old = state.progressRecords.find((row) => field(row, "record_id") === recordId) || {};
  const record = {...old, record_id: recordId, project_id: state.selectedProjectId,
    更新日期: document.getElementById("progressDate").value,
    当前阶段: document.getElementById("progressStage").value,
    更新内容: document.getElementById("progressText").value.trim(),
    下一步工作: document.getElementById("progressNextWork").value.trim(),
    下一节点时间: document.getElementById("progressNextDate").value,
    来源文件: document.getElementById("progressSource").value.trim() || "线上台账",
    是否已确认: "是"};
  const index = state.progressRecords.findIndex((row) => field(row, "record_id") === recordId);
  if (index === -1) state.progressRecords.push(record); else state.progressRecords[index] = record;
  markDirty("推进记录已暂存，点击“保存到 GitHub”后生效。");
  elements.progressEditorDialog.close();
  renderProjectDetail();
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
  elements.detailTitle.textContent = field(project, "项目名称") || "未命名项目";
  elements.detailSubtitle.textContent = `${field(project, "地区") || "未填地区"} · ${field(project, "当前进度") || "未填进度"} · ${field(project, "当前细分阶段") || "未填阶段"}`;
  elements.detailBody.innerHTML = `
    ${renderKeyGrid(project)}
    ${renderPlatformSection(project)}
    <section class="work-item">${escapeHtml(field(project, "下一步工作") || "暂无下一步工作。")}</section>
    ${renderProgressSection(id)}
  `;
}

function renderAll() {
  applyFilters();
  if (!state.filtered.some((project) => field(project, "project_id") === state.selectedProjectId)) {
    state.selectedProjectId = state.filtered[0]?.project_id || "";
  }
  renderProjectList();
  renderProjectDetail();
  const selected = state.projects.find((row) => field(row, "project_id") === state.selectedProjectId);
  elements.editProjectButton.disabled = !selected || !masterReady();
  elements.archiveProjectButton.disabled = !selected || !masterReady();
  elements.deleteProjectButton.disabled = !selected || !masterReady();
  elements.archiveProjectButton.textContent = selected && recordStatus(selected) === "已结束" ? "恢复项目" : "结束项目";
}

async function handleLoad() {
  elements.loadButton.disabled = true;
  showResult("正在读取 GitHub 台账快照...", "info");
  try {
    await loadLedgerSnapshot();
    refreshFilters();
    renderAll();
    elements.newProjectButton.disabled = !masterReady();
    elements.importProgressButton.disabled = !masterReady();
    elements.saveButton.disabled = true;
    const masterLabel = masterReady() ? "GitHub 主档" : "旧版只读快照";
    elements.summary.textContent = `${masterLabel} · 更新时间：${state.generatedAt || "未记录"} · 项目：${state.projects.length} · 平台公司：${platformCompanies().length}`;
    showResult(masterReady()
      ? `已读取 ${state.projects.length} 个台账项目，可在线维护。`
      : "已读取旧版快照。为防止结束项目数据丢失，编辑功能已锁定，请先执行主档迁移。", masterReady() ? "success" : "warning");
  } catch (error) {
    showResult(`读取失败：${error.message || error}`, "error");
  } finally {
    elements.loadButton.disabled = false;
  }
}

elements.loadButton.addEventListener("click", handleLoad);
elements.importProgressButton.addEventListener("click", () => handleProgressImport().catch((error) => {
  showResult(`进度导入失败：${error.message || error}`, "error");
  elements.importProgressButton.textContent = "进度导入";
  elements.importProgressButton.disabled = !masterReady();
}));
elements.saveButton.addEventListener("click", () => saveLedgerMaster().catch((error) => {
  showResult(error.message || String(error), "error");
  elements.saveButton.disabled = !state.dirty;
}));
elements.newProjectButton.addEventListener("click", () => openProjectEditor());
elements.editProjectButton.addEventListener("click", () => {
  const project = state.projects.find((row) => field(row, "project_id") === state.selectedProjectId);
  if (project) openProjectEditor(project);
});
elements.archiveProjectButton.addEventListener("click", () => {
  const project = state.projects.find((row) => field(row, "project_id") === state.selectedProjectId);
  if (!project) return;
  const restoring = recordStatus(project) === "已结束";
  let reason = "";
  if (!restoring) {
    reason = prompt("请选择结束原因并输入：未中标 或 商务评价放弃", field(project, "结束原因"));
    if (reason === null) return;
    reason = reason.trim();
    if (!["未中标", "商务评价放弃"].includes(reason)) { showResult("结束原因必须是“未中标”或“商务评价放弃”。", "error"); return; }
  }
  const action = restoring ? "恢复" : "结束";
  if (!confirm(`确定${action}“${field(project, "项目名称")}”吗？${reason ? `结束原因：${reason}` : ""}`)) return;
  project["记录状态"] = restoring ? "正常" : "已结束";
  project["结束原因"] = restoring ? "" : reason;
  project["最近更新时间"] = nowText();
  markDirty(`项目已${action}并暂存，点击“保存到 GitHub”后生效。`);
  renderAll();
});
elements.deleteProjectButton.addEventListener("click", () => {
  const project = state.projects.find((row) => field(row, "project_id") === state.selectedProjectId);
  if (!project || !confirm(`确认永久删除错误项目“${field(project, "项目名称")}”？项目、推进记录和平台关联将从主档删除；GitHub 历史仍可追溯。`)) return;
  const projectId = field(project, "project_id");
  state.projects = state.projects.filter((row) => field(row, "project_id") !== projectId);
  state.progressRecords = state.progressRecords.filter((row) => field(row, "project_id") !== projectId);
  delete state.details[projectId];
  const resources = state.snapshot.platform_resources || {};
  resources.project_platform_links = (resources.project_platform_links || []).filter((row) => field(row, "project_id") !== projectId);
  state.selectedProjectId = "";
  markDirty("错误项目已删除并暂存，点击“保存到 GitHub”后永久生效。");
  refreshFilters(); renderAll();
});
elements.projectEditorForm.addEventListener("submit", submitProjectEditor);
elements.progressEditorForm.addEventListener("submit", submitProgressEditor);
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
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
  const url = new URL(location.href); url.searchParams.set("project", state.selectedProjectId); history.replaceState(null, "", url);
  renderAll();
});

elements.detailBody.addEventListener("click", (event) => {
  if (event.target.closest("[data-add-progress]")) openProgressEditor();
  const edit = event.target.closest("[data-edit-progress]");
  if (edit) {
    const record = state.progressRecords.find((row) => field(row, "record_id") === edit.dataset.editProgress);
    if (record) openProgressEditor(record);
  }
  const remove = event.target.closest("[data-delete-progress]");
  if (remove && confirm("确定删除这条推进记录吗？GitHub 历史中仍可追溯。")) {
    state.progressRecords = state.progressRecords.filter((row) => field(row, "record_id") !== remove.dataset.deleteProgress);
    markDirty("推进记录已删除并暂存，点击“保存到 GitHub”后生效。");
    renderProjectDetail();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
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
