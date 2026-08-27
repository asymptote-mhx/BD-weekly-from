const DETAIL_STAGES = [
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

const TECHNICAL_GROUP_OPTIONS = ["", "一组", "二组", "丁德强团队", "王启宇团队", "自行填写"];
const WEEKLY_PROGRESS_OPTIONS = ["项目接触", "前期方案", "招标流程", "维护服务"];
const LOCAL_WEEKLY_URL = "http://127.0.0.1:8798/weekly-input.html?v=20260704-plan-project";
const GITHUB_SETTINGS_KEY = "bd-weekly-github-settings";
const LEDGER_SNAPSHOT_PATH = "ledger/market_workbench_snapshot.json";
const state = {
  ledgerProjects: [],
  platformResources: { platform_companies: [], platform_chain_people: [], project_platform_links: [] },
};

const elements = {
  weeklyInputPanel: document.getElementById("weeklyInputPanel"),
  weeklyTitleInput: document.getElementById("weeklyTitleInput"),
  weeklyVisitRows: document.getElementById("weeklyVisitRows"),
  weeklyProjectRows: document.getElementById("weeklyProjectRows"),
  weeklyPlanRows: document.getElementById("weeklyPlanRows"),
  addWeeklyVisitButton: document.getElementById("addWeeklyVisitButton"),
  refreshWeeklyResourcesButton: document.getElementById("refreshWeeklyResourcesButton"),
  addLedgerWeeklyProjectButton: document.getElementById("addLedgerWeeklyProjectButton"),
  addCustomWeeklyProjectButton: document.getElementById("addCustomWeeklyProjectButton"),
  addWeeklyPlanButton: document.getElementById("addWeeklyPlanButton"),
  saveWeeklyDraftButton: document.getElementById("saveWeeklyDraftButton"),
  completeWeeklyButton: document.getElementById("completeWeeklyButton"),
  weeklyFormResult: document.getElementById("weeklyFormResult"),
  githubOwnerInput: document.getElementById("githubOwnerInput"),
  githubRepoInput: document.getElementById("githubRepoInput"),
  githubBranchInput: document.getElementById("githubBranchInput"),
  githubTokenInput: document.getElementById("githubTokenInput"),
  saveGithubSettingsButton: document.getElementById("saveGithubSettingsButton"),
};

function guardAgainstFileOpen() {
  if (location.protocol === "file:") {
    document.body.innerHTML = `
      <main class="file-open-warning">
        <h1>不能直接打开 HTML 文件</h1>
        <p>当前页面需要通过本地服务打开，才能保存周工作小结。</p>
        <p>请使用这个地址：</p>
        <a href="${LOCAL_WEEKLY_URL}">${LOCAL_WEEKLY_URL}</a>
      </main>
    `;
    return true;
  }
  return false;
}

if (guardAgainstFileOpen()) {
  throw new Error("Cannot run weekly input from file://");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mondayReportTitle(date = new Date()) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return `${String(monday.getFullYear()).slice(2)}${String(monday.getMonth() + 1).padStart(2, "0")}${String(monday.getDate()).padStart(2, "0")}_周工作小结`;
}

function optionHtml(options, selected = "") {
  return options.map((option) => `<option value="${escapeHtml(option)}"${option === selected ? " selected" : ""}>${escapeHtml(option || "暂未指定")}</option>`).join("");
}

function showWeeklyResult(message, type = "info") {
  elements.weeklyFormResult.textContent = message;
  elements.weeklyFormResult.className = `weekly-result ${type}`;
}

function isGitHubSaveMode() {
  return location.hostname.endsWith("github.io");
}

function todayText(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function weekMondayFromTitle(title) {
  const match = String(title || "").match(/^(\d{2})(\d{2})(\d{2})_/);
  if (!match) return todayText();
  return `20${match[1]}-${match[2]}-${match[3]}`;
}

function cleanWorkItem(value) {
  return String(value || "").trim().replace(/[。；; ]+$/g, "");
}

function weeklyMarkdownValue(value) {
  return String(value || "").replace(/\r\n?/g, "\n  ");
}

function weeklyFormPayloadToMarkdown(payload) {
  const title = payload.title || mondayReportTitle();
  const status = payload.status === "completed" ? "completed" : "draft";
  const lines = [
    "---",
    `status: ${status}`,
    `week_monday: ${weekMondayFromTitle(title)}`,
    `updated_at: ${todayText()}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## 本周项目推进",
  ];
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  projects.forEach((project) => {
    if (!project.name) return;
    lines.push("", `### ${project.name}`);
    [
      ["业主单位", project.owner_org],
      ["地区", project.region],
      ["技术配合组", project.technical_group],
      ["当前进度", project.progress],
      ["当前细分阶段", project.detail_stage],
      ["本周进展", project.current_update],
    ].forEach(([label, value]) => {
      lines.push(`- ${label}：${weeklyMarkdownValue(value)}`);
    });
    [
      ["下一节点时间", project.next_node_time],
      ["备注", project.note],
    ].forEach(([label, value]) => {
      lines.push(`- ${label}：${weeklyMarkdownValue(value)}`);
    });
  });
  lines.push("", "## 本周拜访与沟通");
  const visits = Array.isArray(payload.visits) ? payload.visits : [];
  const meaningfulVisits = visits.filter((visit) => Object.values(visit).some((value) => Array.isArray(value) ? value.length : Boolean(value)));
  if (meaningfulVisits.length) {
    meaningfulVisits.forEach((visit) => {
      lines.push(weeklyMarkdownValue(`- 接触日期：${visit.contact_date || ""}；平台公司ID：${visit.platform_company_id || ""}；平台公司：${visit.unit || ""}；接触对象：${visit.contact_people || visit.name || ""}；参与拜访人员：${visit.participants || ""}；接触方式：${visit.contact_method || ""}；对应项目：${visit.project || ""}；沟通内容：${visit.discussion || ""}；项目影响：${visit.project_impact || ""}；下一步行动：${visit.next_action || ""}；是否有效拜访：${visit.is_effective || ""}；`));
    });
  } else {
    lines.push("- 接触日期：；平台公司：；接触对象：；参与拜访人员：；接触方式：；对应项目：；沟通内容：；项目影响：；下一步行动：；");
  }
  lines.push("", "## 下周工作计划");
  const planItems = Array.isArray(payload.next_week_plan) ? payload.next_week_plan.map(formatWeeklyPlanItem).filter(Boolean) : [];
  if (planItems.length) {
    planItems.forEach((item, index) => lines.push(`${index + 1}. ${weeklyMarkdownValue(item)}`));
  } else {
    lines.push("1. ");
  }
  return `${lines.join("\n")}\n`;
}

function formatWeeklyPlanItem(item) {
  if (item && typeof item === "object") {
    const project = cleanWorkItem(item.project || "");
    const company = cleanWorkItem(item.platform_company || item.unit || "");
    const people = cleanWorkItem(item.contact_people || "");
    const work = cleanWorkItem(item.work || "");
    return [
      project ? `关联项目：${project}` : "",
      company ? `关联平台：${company}` : "",
      people ? `关联人员：${people}` : "",
      work ? `工作内容：${work}` : "",
    ].filter(Boolean).join("；");
  }
  return cleanWorkItem(item || "");
}

function loadGitHubSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GITHUB_SETTINGS_KEY) || "{}");
    if (saved.owner) elements.githubOwnerInput.value = saved.owner;
    if (saved.repo) elements.githubRepoInput.value = saved.repo;
    if (saved.branch) elements.githubBranchInput.value = saved.branch;
    if (saved.token) elements.githubTokenInput.value = saved.token;
  } catch {
    localStorage.removeItem(GITHUB_SETTINGS_KEY);
  }
}

function collectGitHubSettings() {
  return {
    owner: elements.githubOwnerInput.value.trim() || "asymptote-mhx",
    repo: elements.githubRepoInput.value.trim() || "BD-weekly-data",
    branch: elements.githubBranchInput.value.trim() || "main",
    token: elements.githubTokenInput.value.trim(),
  };
}

async function saveGitHubSettings() {
  persistGitHubSettings();
  showWeeklyResult("GitHub 保存设置已保存在当前浏览器。", "success");
  if (isGitHubSaveMode() && collectGitHubSettings().token) {
    try {
      const count = await loadLedgerProjects();
      showWeeklyResult(`GitHub 设置已保存，已加载 ${count} 个台账项目。`, count ? "success" : "error");
      await loadWeeklyFromGitHub();
      if (!elements.weeklyVisitRows.children.length) addWeeklyVisitRow();
    } catch (error) {
      showWeeklyResult(`GitHub 设置已保存，但读取失败：${error.message || error}`, "error");
    }
  }
}

function persistGitHubSettings() {
  const settings = collectGitHubSettings();
  localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function weeklyGitHubFilePath(title) {
  const fileName = `${title || mondayReportTitle()}.md`;
  return {
    fileName,
    path: `weekly/${encodeURIComponent(fileName).replace(/%2F/g, "-")}`,
  };
}

function githubContentUrl(settings, path) {
  return `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}?ref=${encodeURIComponent(settings.branch)}`;
}

function isActiveLedgerProject(project) {
  const status = String(project?.["记录状态"] || "").trim();
  return !status || status === "正常";
}

async function loadLedgerProjects() {
  if (!isGitHubSaveMode()) return state.ledgerProjects.length;
  const settings = collectGitHubSettings();
  if (!settings.token) throw new Error("请先填写 GitHub token，并点击“保存设置”。");
  const response = await fetch(githubContentUrl(settings, LEDGER_SNAPSHOT_PATH), { headers: githubHeaders(settings.token) });
  if (!response.ok) throw new Error(`台账快照读取失败：${await responseErrorMessage(response)}`);
  const file = await response.json();
  const snapshot = JSON.parse(base64ToUtf8(file.content || ""));
  state.ledgerProjects = Array.isArray(snapshot.projects) ? snapshot.projects.filter(isActiveLedgerProject) : [];
  state.platformResources = snapshot.platform_resources || state.platformResources;
  document.querySelectorAll("[data-ledger-project]").forEach((select) => {
    const selected = select.value;
    select.innerHTML = ledgerProjectOptions(selected);
  });
  refreshVisitResourceSelectors();
  refreshPlanResourceSelectors();
  return state.ledgerProjects.length;
}

let weeklyResourceRefreshInFlight = false;
async function refreshWeeklyResources(options = {}) {
  if (weeklyResourceRefreshInFlight) return;
  if (!collectGitHubSettings().token) {
    if (!options.silent) showWeeklyResult("请先填写 GitHub token 并保存设置，再刷新资源库。", "info");
    return;
  }
  weeklyResourceRefreshInFlight = true;
  const button = elements.refreshWeeklyResourcesButton;
  if (button) { button.disabled = true; button.textContent = "正在刷新..."; }
  try {
    await loadLedgerProjects();
    refreshVisitResourceSelectors();
    refreshPlanResourceSelectors();
    if (!options.silent) showWeeklyResult(`资源库已刷新：${platformCompanies().length} 家平台公司、${state.ledgerProjects.length} 个正常项目。`, "success");
  } catch (error) {
    if (!options.silent) showWeeklyResult(`资源库刷新失败：${error.message || error}`, "error");
  } finally {
    weeklyResourceRefreshInFlight = false;
    if (button) { button.disabled = false; button.textContent = "刷新资源库"; }
  }
}

async function existingGitHubFileSha(settings, path) {
  const url = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}?ref=${encodeURIComponent(settings.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(settings.token) });
  if (response.status === 404) return "";
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
  const data = await response.json();
  return data.sha || "";
}

async function saveWeeklyToGitHub(payload) {
  const settings = collectGitHubSettings();
  if (!settings.token) {
    throw new Error("请先填写 GitHub token，并点击“保存设置”。");
  }
  persistGitHubSettings();
  return saveWeeklyToGitHubWithRetry(payload, settings);
}

async function saveWeeklyToGitHubWithRetry(payload, settings) {
  try {
    return await putWeeklyToGitHub(payload, settings);
  } catch (error) {
    if (!error.retryableConflict) throw error;
    return putWeeklyToGitHub(payload, settings);
  }
}

async function putWeeklyToGitHub(payload, settings) {
  const { fileName, path } = weeklyGitHubFilePath(payload.title);
  const markdown = weeklyFormPayloadToMarkdown(payload);
  const sha = await existingGitHubFileSha(settings, path);
  const body = {
    message: `${payload.status === "completed" ? "Complete" : "Save draft"} ${fileName}`,
    content: utf8ToBase64(markdown),
    branch: settings.branch,
  };
  if (sha) body.sha = sha;
  const url = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(settings.token),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await responseErrorMessage(response);
    const error = new Error(message);
    error.retryableConflict = response.status === 409 || message.includes("does not match");
    throw error;
  }
  return { file: fileName, path };
}

async function loadWeeklyFromGitHub() {
  const settings = collectGitHubSettings();
  if (!settings.token) {
    showWeeklyResult("请先填写 GitHub token，并点击“保存设置”。", "info");
    return;
  }
  const title = elements.weeklyTitleInput.value.trim() || mondayReportTitle();
  const { fileName, path } = weeklyGitHubFilePath(title);
  showWeeklyResult(`正在读取本周小结：${fileName}...`, "info");
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}?ref=${encodeURIComponent(settings.branch)}`;
    const response = await fetch(url, { headers: githubHeaders(settings.token) });
    if (response.status === 404) {
      showWeeklyResult("本周还没有已保存的小结，可以直接开始填写。", "info");
      return;
    }
    if (!response.ok) {
      showWeeklyResult(`读取失败：${await responseErrorMessage(response)}`, "error");
      return;
    }
    const data = await response.json();
    const markdown = base64ToUtf8(data.content || "");
    renderWeeklyPayload(parseWeeklyMarkdownToPayload(markdown, title));
    showWeeklyResult(`已载入 GitHub 上的本周小结：${fileName}。`, "success");
  } catch (error) {
    showWeeklyResult(`读取失败：${error.message || error}`, "error");
  }
}

function parseKeyValueLine(line) {
  const cleaned = String(line || "").replace(/^-\s*/, "").trim();
  const index = cleaned.indexOf("：");
  if (index < 0) return ["", ""];
  return [cleaned.slice(0, index).trim(), cleaned.slice(index + 1).trim()];
}

function parseVisitLine(line) {
  const visit = {};
  const labels = ["单位", "平台公司", "平台公司ID", "姓名", "接触对象", "职务", "对应项目", "接触日期", "参与拜访人员", "接触方式", "沟通内容", "项目影响", "下一步行动", "下一步日期", "是否有效拜访"];
  const source = String(line || "").replace(/^-\s*/, "");
  const pattern = new RegExp(`(?:^|[；;])\\s*(${labels.sort((a, b) => b.length - a.length).join("|")})\\s*[：:]`, "g");
  const matches = [...source.matchAll(pattern)];
  matches.forEach((match, index) => {
      const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
      const label = match[1];
      const value = source.slice(match.index + match[0].length, end).trim().replace(/[；;\s]+$/, "");
      if (label === "单位") visit.unit = value;
      if (label === "平台公司") visit.unit = value;
      if (label === "平台公司ID") visit.platform_company_id = value;
      if (label === "姓名") visit.name = value;
      if (label === "接触对象") visit.contact_people = value;
      if (label === "职务") visit.position = value;
      if (label === "对应项目") visit.project = value;
      if (label === "接触日期") visit.contact_date = value;
      if (label === "参与拜访人员") visit.participants = value;
      if (label === "接触方式") visit.contact_method = value;
      if (label === "沟通内容") visit.discussion = value;
      if (label === "项目影响") visit.project_impact = value;
      if (label === "下一步行动") visit.next_action = value;
      if (label === "下一步日期") visit.next_action_date = value;
      if (label === "是否有效拜访") visit.is_effective = value;
    });
  return visit;
}

function parseNextWeekWork(value) {
  return String(value || "")
    .split(/；\s*/)
    .map((item) => item.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function parseWeeklyPlanLine(line) {
  const cleaned = String(line || "").replace(/^\d+\.\s*/, "").trim();
  const item = { project: "", platform_company: "", contact_people: "", work: "" };
  cleaned.split("；").forEach((part) => {
    const [label, value] = parseKeyValueLine(part);
    if (label === "关联项目") item.project = value;
    if (label === "关联平台" || label === "平台公司") item.platform_company = value;
    if (label === "关联人员" || label === "接触对象") item.contact_people = value;
    if (label === "工作内容") item.work = value;
  });
  if (!item.project && !item.platform_company && !item.contact_people && !item.work) item.work = cleaned;
  return item;
}

function structuredRecords(text, startPattern, markerPattern) {
  const records = [];
  let current = "";
  String(text || "").split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/, "");
    if (startPattern.test(line)) {
      if (current.trim()) records.push(current.trim());
      current = line.replace(markerPattern, "").trim();
    } else if (line.trim() && current) {
      current += `\n${line.trim()}`;
    } else if (line.trim() && !current) {
      current = line.trim();
    }
  });
  if (current.trim()) records.push(current.trim());
  return records;
}

function markdownSection(text, heading) {
  const pattern = new RegExp(`(?:^|\\n)## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : "";
}

function parseWeeklyMarkdownToPayload(markdown, fallbackTitle = "") {
  const titleMatch = String(markdown || "").match(/^#\s+(.+)$/m);
  const payload = {
    title: titleMatch ? titleMatch[1].trim() : fallbackTitle || mondayReportTitle(),
    visits: [],
    projects: [],
    next_week_plan: [],
  };
  const visitsText = markdownSection(markdown, "本周拜访与沟通") || markdownSection(markdown, "主要拜访人员");
  payload.visits = structuredRecords(visitsText, /^\s*-\s+/, /^\s*-\s+/)
    .map(parseVisitLine)
    .filter((visit) => Object.values(visit).some(Boolean));

  const projectsText = markdownSection(markdown, "本周项目推进") || markdownSection(markdown, "项目跟进情况");
  payload.projects = projectsText
    .split(/\n###\s+/)
    .map((block) => block.replace(/^###\s+/, "").trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const project = { name: lines.shift().trim(), next_week_work: [] };
      let lastField = "";
      lines.forEach((line) => {
        const [label, value] = parseKeyValueLine(line);
        const fields = { 业主单位: "owner_org", 地区: "region", 技术配合组: "technical_group", 当前进度: "progress", 当前细分阶段: "detail_stage", 本周进展: "current_update", 下一步工作: "next_work", 下一节点时间: "next_node_time", 关联项目: "related_project", 备注: "note" };
        const field = fields[label];
        if (field) { project[field] = value; lastField = field; return; }
        if (label === "下周工作") { project.next_week_work = parseNextWeekWork(value); lastField = ""; return; }
        if (line.trim() && lastField) project[lastField] = `${project[lastField] || ""}\n${line.trim()}`.trim();
      });
      return project;
    });
  payload.next_week_plan = structuredRecords(markdownSection(markdown, "下周工作计划"), /^\d+[.、]\s*/, /^\d+[.、]\s*/)
    .map(parseWeeklyPlanLine)
    .filter((item) => item.project || item.work);
  if (!payload.next_week_plan.length) {
    payload.next_week_plan = payload.projects.flatMap((project) => (project.next_week_work || []).map((work) => ({ project: project.name || "", work })));
  }
  return payload;
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

function platformCompanies() { return state.platformResources.platform_companies || []; }
function companyPeople(companyId) { return (state.platformResources.platform_chain_people || []).filter((row) => String(row.platform_company_id || "") === companyId); }
function companyProjects(companyId) {
  const ids = new Set((state.platformResources.project_platform_links || []).filter((row) => String(row.platform_company_id || "") === companyId).map((row) => String(row.project_id || "")));
  return state.ledgerProjects.filter((project) => ids.has(String(project.project_id || "")));
}
function projectCompanies(projectId) {
  const ids = new Set((state.platformResources.project_platform_links || []).filter((row) => String(row.project_id || "") === projectId).map((row) => String(row.platform_company_id || "")));
  return platformCompanies().filter((company) => ids.has(String(company.platform_company_id || "")));
}
function splitSelections(value) { return String(value || "").split(/[、,，|]/).map((item) => item.trim()).filter(Boolean); }
function combineSelections(...values) {
  return [...new Set(values.flatMap(splitSelections))].join("、");
}
function unmatchedSelections(value, availableLabels) {
  const available = new Set(availableLabels.map((item) => String(item || "").trim()).filter(Boolean));
  return splitSelections(value).filter((item) => !available.has(item)).join("、");
}
function sequencedPlatformCompanies() {
  return platformCompanies().map((company, index) => ({ company, sequence: index + 1 })).reverse();
}
function companyOptions(selectedId = "", fallbackName = "") {
  const rows = sequencedPlatformCompanies().map(({ company, sequence }) => `<option value="${escapeHtml(company.platform_company_id || "")}"${company.platform_company_id === selectedId ? " selected" : ""}>${sequence}. ${escapeHtml(company["平台公司名称"] || "未命名平台")}</option>`);
  if (fallbackName && !selectedId) rows.unshift(`<option value="" selected>${escapeHtml(fallbackName)}（旧记录，待关联资源库）</option>`);
  return `<option value="">选择平台公司</option>${rows.join("")}`;
}
function dependentVisitOptions(row, companyId) {
  const selectedPeople = new Set(splitSelections(row.contact_people || row.name));
  const selectedPersonIds = new Set(splitSelections(row.contact_person_ids));
  const people = companyPeople(companyId).map((person) => {
    const value = person.item_id || person["姓名"] || "";
    const label = person["姓名"] || "姓名待补充";
    const checked = selectedPersonIds.has(person.item_id) || selectedPeople.has(person["姓名"]);
    return `<label class="visit-choice"><input type="checkbox" value="${escapeHtml(value)}" data-choice-label="${escapeHtml(label)}"${checked ? " checked" : ""}><span><strong>${escapeHtml(label)}</strong>${person["决策角色"] ? `<small>${escapeHtml(person["决策角色"])}</small>` : ""}</span></label>`;
  }).join("");
  const selectedProjects = new Set(splitSelections(row.project));
  const selectedProjectIds = new Set(splitSelections(row.project_ids));
  const projects = companyProjects(companyId).map((project) => {
    const value = project.project_id || "";
    const label = project["项目名称"] || "未命名项目";
    const checked = selectedProjectIds.has(project.project_id) || selectedProjects.has(project["项目名称"]);
    return `<label class="visit-choice"><input type="checkbox" value="${escapeHtml(value)}" data-choice-label="${escapeHtml(label)}"${checked ? " checked" : ""}><span><strong>${escapeHtml(label)}</strong></span></label>`;
  }).join("");
  return { people, projects };
}
function refreshVisitDependencies(wrapper, row = {}) {
  const companyId = wrapper.querySelector('[data-weekly-field="platform_company_id"]').value;
  const options = dependentVisitOptions(row, companyId);
  wrapper.querySelector("[data-visit-people]").innerHTML = options.people || `<span class="visit-choice-empty">${companyId ? "该公司尚未录入决策链人员" : "请先选择平台公司"}</span>`;
  wrapper.querySelector("[data-visit-projects]").innerHTML = options.projects || `<span class="visit-choice-empty">${companyId ? "该公司尚未关联项目" : "请先选择平台公司"}</span>`;
}
function visitResourceSnapshot(wrapper) {
  const companyId = wrapper.querySelector('[data-weekly-field="platform_company_id"]')?.value || "";
  const people = [...wrapper.querySelectorAll("[data-visit-people] input:checked")];
  const projects = [...wrapper.querySelectorAll("[data-visit-projects] input:checked")];
  const customUnit = wrapper.querySelector("[data-visit-custom-unit]")?.value.trim() || "";
  const customPeople = wrapper.querySelector("[data-visit-custom-people]")?.value.trim() || "";
  const customProjects = wrapper.querySelector("[data-visit-custom-projects]")?.value.trim() || "";
  return {
    platform_company_id: companyId,
    unit: platformCompanies().find((company) => company.platform_company_id === companyId)?.["平台公司名称"] || customUnit,
    contact_person_ids: people.map((option) => option.value).join("、"),
    contact_people: combineSelections(people.map((option) => option.dataset.choiceLabel || ""), customPeople),
    project_ids: projects.map((option) => option.value).join("、"),
    project: combineSelections(projects.map((option) => option.dataset.choiceLabel || ""), customProjects),
  };
}
function refreshVisitResourceSelectors() {
  [...elements.weeklyVisitRows.querySelectorAll(".weekly-visit-card")].forEach((wrapper) => {
    const snapshot = visitResourceSnapshot(wrapper);
    const companySelect = wrapper.querySelector('[data-weekly-field="platform_company_id"]');
    companySelect.innerHTML = companyOptions(snapshot.platform_company_id);
    refreshVisitDependencies(wrapper, snapshot);
  });
}
function addWeeklyVisitRow(row = {}, options = {}) {
  const wrapper = document.createElement("section");
  wrapper.className = "weekly-visit-card";
  const companyId = row.platform_company_id || "";
  const customUnit = row.unit_custom || (!companyId ? row.unit || "" : "");
  const customPeople = row.contact_people_custom || unmatchedSelections(
    row.contact_people || row.name,
    companyPeople(companyId).map((person) => person["姓名"]),
  );
  const customProjects = row.project_custom || unmatchedSelections(
    row.project,
    companyProjects(companyId).map((project) => project["项目名称"]),
  );
  wrapper.innerHTML = `<div class="weekly-project-card-heading"><strong data-weekly-visit-number>拜访</strong><span>拜访与沟通</span></div><div class="weekly-visit-grid">
    <label>接触日期<input data-weekly-field="contact_date" type="date" value="${escapeHtml(row.contact_date || todayText())}"></label>
    <label>平台公司（资源库，可选）<select data-weekly-field="platform_company_id">${companyOptions(companyId)}</select></label>
    <label>其他单位（可手填）<input data-visit-custom-unit placeholder="资源库没有时直接填写单位" value="${escapeHtml(customUnit)}"></label>
    <label>接触方式<select data-weekly-field="contact_method"><option value="">请选择</option>${["简单拜访","项目汇报","商务宴请","线上交流","陪同考察"].map((value) => `<option${row.contact_method === value ? " selected" : ""}>${value}</option>`).join("")}</select></label>
    <label>参与拜访人员<input data-weekly-field="participants" placeholder="填写UAD内部参与人员，支持多人" value="${escapeHtml(row.participants || "")}"></label>
    <div class="visit-multi"><span class="visit-multi-title">接触对象（可多选）</span><div class="visit-choice-list" data-visit-people role="group" aria-label="接触对象"></div><input data-visit-custom-people placeholder="资源库没有该人员时直接填写，支持多人" value="${escapeHtml(customPeople)}"><small>可勾选决策链人员，也可直接手填</small></div>
    <div class="visit-multi"><span class="visit-multi-title">讨论项目（可多选）</span><div class="visit-choice-list" data-visit-projects role="group" aria-label="讨论项目"></div><input data-visit-custom-projects placeholder="没有对应项目时可留空；未登记项目可手填" value="${escapeHtml(customProjects)}"><small>可勾选关联项目，也可直接手填或不关联项目</small></div>
    <label class="full-width">沟通内容<textarea data-weekly-field="discussion" rows="3" placeholder="讨论了什么、获得了哪些关键信息">${escapeHtml(row.discussion || "")}</textarea></label>
    <label class="full-width">对项目的影响<textarea data-weekly-field="project_impact" rows="2" placeholder="对项目判断、阶段或决策产生了什么影响">${escapeHtml(row.project_impact || "")}</textarea></label>
    <label class="full-width">下一步行动<textarea data-weekly-field="next_action" rows="2">${escapeHtml(row.next_action || "")}</textarea></label>
  </div><button class="remove-weekly-project" type="button" data-remove-weekly-row>删除拜访记录</button>`;
  const companySelect = wrapper.querySelector('[data-weekly-field="platform_company_id"]');
  companySelect.addEventListener("change", () => refreshVisitDependencies(wrapper));
  refreshVisitDependencies(wrapper, row);
  prependWeeklyRow(elements.weeklyVisitRows, wrapper, options);
}

function addCustomWeeklyProjectRow(row = {}, options = {}) {
  const wrapper = document.createElement("section");
  wrapper.className = "weekly-project-row";
  wrapper.dataset.weeklyMode = "custom";
  wrapper.innerHTML = `
    <div class="weekly-project-card-heading"><strong data-weekly-project-number>项目</strong><span>自填项目</span></div>
    <div class="weekly-project-grid">
      <label>项目名称<input data-weekly-field="name" placeholder="项目名称" value="${escapeHtml(row.name || "")}"></label>
      <label>业主单位<input data-weekly-field="owner_org" placeholder="业主单位" value="${escapeHtml(row.owner_org || "")}"></label>
      <label>地区<input data-weekly-field="region" placeholder="地区" value="${escapeHtml(row.region || "")}"></label>
      <label>技术配合组
        <select data-weekly-field="technical_group">${optionHtml(TECHNICAL_GROUP_OPTIONS, row.technical_group || "")}</select>
      </label>
      <label>当前进度
        <select data-weekly-field="progress">${optionHtml(WEEKLY_PROGRESS_OPTIONS, row.progress || "项目接触")}</select>
      </label>
      <label>当前细分阶段
        <select data-weekly-field="detail_stage">${optionHtml(DETAIL_STAGES, row.detail_stage || "线索获取")}</select>
      </label>
      <label>下一节点时间<input data-weekly-field="next_node_time" placeholder="2026-07-05" value="${escapeHtml(row.next_node_time || "")}"></label>
      <label class="full-width">本周进展<textarea data-weekly-field="current_update" rows="3">${escapeHtml(row.current_update || "")}</textarea></label>
      <label class="full-width">备注<textarea data-weekly-field="note" rows="2">${escapeHtml(row.note || "")}</textarea></label>
    </div>
    <button class="remove-weekly-project" type="button" data-remove-weekly-row>删除项目</button>
  `;
  prependWeeklyRow(elements.weeklyProjectRows, wrapper, options);
}

function addWeeklyProjectRow(row = {}, options = {}) {
  addCustomWeeklyProjectRow(row, options);
}

function ledgerProjectOptions(selectedId = "") {
  const prompt = state.ledgerProjects.length ? "请选择台账项目" : "请先保存 GitHub 设置并加载台账";
  const options = [`<option value="">${prompt}</option>`];
  state.ledgerProjects.forEach((project) => {
    const id = String(project.project_id || "");
    const name = String(project["项目名称"] || "");
    options.push(`<option value="${escapeHtml(id)}"${id === selectedId ? " selected" : ""}>${escapeHtml(name)}</option>`);
  });
  return options.join("");
}

function applyLedgerProject(row, projectId) {
  const project = state.ledgerProjects.find((item) => item.project_id === projectId);
  if (!project) return;
  const fields = {
    name: project["项目名称"], owner_org: project["业主单位"], region: project["地区"],
    technical_group: project["技术配合类型"], progress: project["当前进度"],
    detail_stage: project["当前细分阶段"], next_node_time: project["下一节点时间"],
  };
  Object.entries(fields).forEach(([key, value]) => {
    const input = row.querySelector(`[data-weekly-field="${key}"]`);
    if (input) input.value = String(value || "").trim();
  });
}

function addLedgerWeeklyProjectRow(row = {}, options = {}) {
  const wrapper = document.createElement("section");
  wrapper.className = "weekly-project-row";
  wrapper.dataset.weeklyMode = "ledger";
  wrapper.innerHTML = `
    <div class="weekly-project-card-heading"><strong data-weekly-project-number>项目</strong><span>台账项目</span></div>
    <div class="weekly-project-grid" data-weekly-mode="ledger">
      <label class="full-width">台账项目<select data-ledger-project>${ledgerProjectOptions(row.project_id || "")}</select></label>
      <label>项目名称<input data-weekly-field="name" readonly value="${escapeHtml(row.name || "")}"></label>
      <label>业主单位<input data-weekly-field="owner_org" readonly value="${escapeHtml(row.owner_org || "")}"></label>
      <label>地区<input data-weekly-field="region" readonly value="${escapeHtml(row.region || "")}"></label>
      <label>技术配合组<select data-weekly-field="technical_group" disabled>${optionHtml(TECHNICAL_GROUP_OPTIONS, row.technical_group || "")}</select></label>
      <label>当前进度<select data-weekly-field="progress">${optionHtml(WEEKLY_PROGRESS_OPTIONS, row.progress || "项目接触")}</select></label>
      <label>当前细分阶段<select data-weekly-field="detail_stage">${optionHtml(DETAIL_STAGES, row.detail_stage || "线索获取")}</select></label>
      <label>下一节点时间<input data-weekly-field="next_node_time" value="${escapeHtml(row.next_node_time || "")}"></label>
      <label class="full-width">本周进展<textarea data-weekly-field="current_update" rows="3">${escapeHtml(row.current_update || "")}</textarea></label>
      <label class="full-width">备注<textarea data-weekly-field="note" rows="2">${escapeHtml(row.note || "")}</textarea></label>
    </div>
    <button class="remove-weekly-project" type="button" data-remove-weekly-row>删除项目</button>`;
  const selector = wrapper.querySelector("[data-ledger-project]");
  selector.addEventListener("change", () => applyLedgerProject(wrapper, selector.value));
  if (selector.value) applyLedgerProject(wrapper, selector.value);
  prependWeeklyRow(elements.weeklyProjectRows, wrapper, options);
}

async function addLedgerWeeklyProjectRowWithLoad() {
  try {
    if (!state.ledgerProjects.length) {
      showWeeklyResult("正在读取台账项目...", "info");
      const count = await loadLedgerProjects();
      if (!count) {
        showWeeklyResult("没有读到台账项目。请先在本地台账点击“上传台账快照”，再确认 GitHub 设置里的数据仓库是 BD-weekly-data。", "error");
        return;
      }
      showWeeklyResult(`已加载 ${count} 个台账项目。`, "success");
    }
    addLedgerWeeklyProjectRow();
  } catch (error) {
    showWeeklyResult(`台账项目读取失败：${error.message || error}`, "error");
  }
}

function prependWeeklyRow(container, wrapper, options = {}) {
  wrapper.dataset.weeklySequence = String(nextWeeklySequence(container));
  if (options.append) container.appendChild(wrapper);
  else container.prepend(wrapper);
  if (container === elements.weeklyProjectRows) renumberWeeklyProjectRows();
  if (container === elements.weeklyVisitRows) renumberWeeklyVisitRows();
  if (container === elements.weeklyPlanRows) renumberWeeklyPlanItems();
}

function nextWeeklySequence(container) {
  return Math.max(0, ...[...container.children].map((row) => Number(row.dataset.weeklySequence) || 0)) + 1;
}

function rowsByWeeklySequence(container, selector) {
  return [...container.querySelectorAll(selector)].sort((left, right) =>
    (Number(left.dataset.weeklySequence) || 0) - (Number(right.dataset.weeklySequence) || 0));
}

function normalizeWeeklySequence(container, selector, labelSelector, prefix) {
  rowsByWeeklySequence(container, selector).forEach((row, index) => {
    const sequence = index + 1;
    row.dataset.weeklySequence = String(sequence);
    const label = row.querySelector(labelSelector);
    if (label) label.textContent = `${prefix} ${sequence}`;
  });
}

function renumberWeeklyProjectRows() {
  normalizeWeeklySequence(elements.weeklyProjectRows, ".weekly-project-row", "[data-weekly-project-number]", "项目");
}

function renumberWeeklyVisitRows() {
  normalizeWeeklySequence(elements.weeklyVisitRows, ".weekly-visit-card", "[data-weekly-visit-number]", "拜访");
}

function renderWeeklyPayload(payload) {
  elements.weeklyTitleInput.value = payload.title || mondayReportTitle();
  elements.weeklyVisitRows.innerHTML = "";
  elements.weeklyProjectRows.innerHTML = "";
  elements.weeklyPlanRows.innerHTML = "";
  const visits = Array.isArray(payload.visits) && payload.visits.length ? payload.visits : [{}];
  const projects = Array.isArray(payload.projects) && payload.projects.length ? payload.projects : [{}];
  const planItems = Array.isArray(payload.next_week_plan) && payload.next_week_plan.length ? payload.next_week_plan : [""];
  visits.forEach((visit) => addWeeklyVisitRow(visit, { append: true }));
  projects.forEach((project) => addCustomWeeklyProjectRow(project, { append: true }));
  planItems.forEach((item) => addWeeklyPlanItem(item, { append: true }));
}

function projectIdFromPlanItem(item = {}) {
  if (item.project_id) return String(item.project_id);
  return String(state.ledgerProjects.find((project) => String(project["项目名称"] || "") === String(item.project || ""))?.project_id || "");
}

function planCompanyOptions(projectId, selectedId = "", fallbackName = "") {
  const linkedIds = new Set(projectCompanies(projectId).map((company) => String(company.platform_company_id || "")));
  const companies = sequencedPlatformCompanies().sort((left, right) =>
    Number(linkedIds.has(String(right.company.platform_company_id || ""))) - Number(linkedIds.has(String(left.company.platform_company_id || ""))));
  const rows = companies.map(({ company, sequence }) => {
    const id = String(company.platform_company_id || "");
    const relation = projectId && linkedIds.has(id) ? "（项目关联）" : "";
    return `<option value="${escapeHtml(id)}"${id === selectedId ? " selected" : ""}>${sequence}. ${escapeHtml(company["平台公司名称"] || "未命名平台")}${relation}</option>`;
  });
  if (fallbackName && !selectedId) rows.unshift(`<option value="" selected>${escapeHtml(fallbackName)}（旧记录）</option>`);
  const prompt = projectId ? "选择平台公司（项目关联项优先）" : "选择平台公司（项目可不选）";
  return `<option value="">${prompt}</option>${rows.join("")}`;
}

function planPeopleOptions(companyId, item = {}) {
  const selectedIds = new Set(splitSelections(item.contact_person_ids));
  const selectedNames = new Set(splitSelections(item.contact_people));
  return companyPeople(companyId).map((person) => {
    const id = String(person.item_id || person["姓名"] || "");
    const name = String(person["姓名"] || "姓名待补充");
    const checked = selectedIds.has(id) || selectedNames.has(name);
    return `<label class="visit-choice"><input type="checkbox" value="${escapeHtml(id)}" data-choice-label="${escapeHtml(name)}"${checked ? " checked" : ""}><span><strong>${escapeHtml(name)}</strong>${person["决策角色"] ? `<small>${escapeHtml(person["决策角色"])}</small>` : ""}</span></label>`;
  }).join("");
}

function refreshPlanDependencies(wrapper, item = {}, resetCompany = false) {
  const projectSelect = wrapper.querySelector("[data-weekly-plan-project-id]");
  const projectId = projectSelect?.value || "";
  const companySelect = wrapper.querySelector("[data-weekly-plan-company-id]");
  const selectedCompanyId = resetCompany ? "" : (item.platform_company_id || companySelect?.value || "");
  const customCompany = wrapper.querySelector("[data-weekly-plan-custom-company]")?.value.trim() || "";
  const fallbackCompany = customCompany ? "" : (item.platform_company || item.unit || "");
  if (companySelect) companySelect.innerHTML = planCompanyOptions(projectId, selectedCompanyId, fallbackCompany);
  const companyId = companySelect?.value || "";
  const peopleList = wrapper.querySelector("[data-weekly-plan-people]");
  if (peopleList) {
    const people = planPeopleOptions(companyId, resetCompany ? {} : item);
    peopleList.innerHTML = people || `<span class="visit-choice-empty">${companyId ? "该平台尚未录入人员" : "请先选择关联平台"}</span>`;
  }
}

function planResourceSnapshot(wrapper) {
  const projectId = wrapper.querySelector("[data-weekly-plan-project-id]")?.value || "";
  const companyId = wrapper.querySelector("[data-weekly-plan-company-id]")?.value || "";
  const customProject = wrapper.querySelector("[data-weekly-plan-custom-project]")?.value.trim() || "";
  const customCompany = wrapper.querySelector("[data-weekly-plan-custom-company]")?.value.trim() || "";
  const people = selectedOptionData(wrapper.querySelector("[data-weekly-plan-people]"));
  return {
    project_id: projectId,
    project: state.ledgerProjects.find((project) => String(project.project_id || "") === projectId)?.["项目名称"] || customProject || wrapper.dataset.fallbackProject || "",
    platform_company_id: companyId,
    platform_company: platformCompanies().find((company) => String(company.platform_company_id || "") === companyId)?.["平台公司名称"] || customCompany || wrapper.dataset.fallbackCompany || "",
    contact_person_ids: people.ids.join("、"),
    contact_people: people.names.join("、") || wrapper.dataset.fallbackPeople || "",
  };
}

function refreshPlanResourceSelectors() {
  [...elements.weeklyPlanRows.querySelectorAll(".weekly-plan-row")].forEach((wrapper) => {
    const snapshot = planResourceSnapshot(wrapper);
    const projectSelect = wrapper.querySelector("[data-weekly-plan-project-id]");
    const resolvedProjectId = snapshot.project_id || projectIdFromPlanItem(snapshot);
    projectSelect.innerHTML = ledgerProjectOptions(resolvedProjectId);
    refreshPlanDependencies(wrapper, { ...snapshot, project_id: resolvedProjectId });
  });
}

function addWeeklyPlanItem(value = "", options = {}) {
  const item = value && typeof value === "object" ? value : { project: "", work: value || "" };
  const projectId = projectIdFromPlanItem(item);
  const companyId = String(item.platform_company_id || "");
  const hasKnownCompany = platformCompanies().some((company) => String(company.platform_company_id || "") === companyId);
  const customProject = projectId ? "" : (item.project || "");
  const customCompany = hasKnownCompany ? "" : (item.platform_company || item.unit || "");
  const wrapper = document.createElement("section");
  wrapper.className = "weekly-plan-row";
  wrapper.dataset.fallbackProject = item.project || "";
  wrapper.dataset.fallbackCompany = item.platform_company || item.unit || "";
  wrapper.dataset.fallbackPeople = item.contact_people || "";
  wrapper.innerHTML = `
    <div class="weekly-plan-heading"><strong class="weekly-work-index"></strong><span>下周工作</span></div>
    <div class="weekly-plan-grid">
      <label>关联项目（可选）<select data-weekly-plan-project-id>${ledgerProjectOptions(projectId)}</select></label>
      <label>关联平台（可独立选择）<select data-weekly-plan-company-id>${planCompanyOptions(projectId, companyId, hasKnownCompany ? (item.platform_company || item.unit || "") : "")}</select></label>
      <label>其他项目（可手填）<input data-weekly-plan-custom-project placeholder="台账没有时直接填写项目" value="${escapeHtml(customProject)}"></label>
      <label>其他平台/单位（可手填）<input data-weekly-plan-custom-company placeholder="资源库没有时直接填写单位" value="${escapeHtml(customCompany)}"></label>
      <div class="visit-multi"><span class="visit-multi-title">关联人员（可多选）</span><div class="visit-choice-list plan-people-list" data-weekly-plan-people role="group" aria-label="关联人员"></div></div>
      <label class="full-width">工作内容<textarea data-weekly-plan-item rows="3" placeholder="填写下周需要推进的具体工作">${escapeHtml(item.work || "")}</textarea></label>
    </div>
    <button type="button" class="remove-weekly-project" data-remove-weekly-plan>删除下周工作</button>
  `;
  const projectSelect = wrapper.querySelector("[data-weekly-plan-project-id]");
  const companySelect = wrapper.querySelector("[data-weekly-plan-company-id]");
  projectSelect.addEventListener("change", () => {
    const snapshot = planResourceSnapshot(wrapper);
    wrapper.dataset.fallbackProject = "";
    refreshPlanDependencies(wrapper, { ...snapshot, project_id: projectSelect.value });
  });
  companySelect.addEventListener("change", () => {
    wrapper.dataset.fallbackCompany = "";
    wrapper.dataset.fallbackPeople = "";
    refreshPlanDependencies(wrapper);
  });
  refreshPlanDependencies(wrapper, item);
  prependWeeklyRow(elements.weeklyPlanRows, wrapper, options);
}

function addWeeklyWorkItem(container, value = "") {
  const item = document.createElement("div");
  item.className = "weekly-work-item";
  item.innerHTML = `
    <span class="weekly-work-index"></span>
    <input data-weekly-work-item placeholder="下周工作" value="${escapeHtml(value || "")}">
    <button type="button" data-remove-weekly-work>删除</button>
  `;
  container.appendChild(item);
  renumberWeeklyWorkItems(container);
}

function renumberWeeklyWorkItems(container) {
  [...container.querySelectorAll(".weekly-work-item")].forEach((item, index) => {
    item.querySelector(".weekly-work-index").textContent = `${index + 1}.`;
  });
}

function renumberWeeklyPlanItems() {
  normalizeWeeklySequence(elements.weeklyPlanRows, ".weekly-plan-row", ".weekly-work-index", "计划");
}

function collectWeeklyRows(container) {
  return [...container.children].sort((left, right) =>
    (Number(left.dataset.weeklySequence) || 0) - (Number(right.dataset.weeklySequence) || 0)).map((row) => {
    const values = {};
    row.querySelectorAll("[data-weekly-field]").forEach((input) => {
      values[input.dataset.weeklyField] = input.value.trim();
    });
    const workItems = [...row.querySelectorAll("[data-weekly-work-item]")]
      .map((input) => input.value.trim())
      .filter(Boolean);
    if (workItems.length) {
      values.next_week_work = workItems;
    }
    return values;
  }).filter((row) => Object.values(row).some((value) => Array.isArray(value) ? value.length : Boolean(value)));
}

function selectedOptionData(control) {
  if (!control) return { ids: [], names: [] };
  const options = control.selectedOptions
    ? Array.from(control.selectedOptions).filter((option) => !option.disabled && option.value)
    : Array.from(control.querySelectorAll('input[type="checkbox"]:checked')).filter((option) => !option.disabled && option.value);
  return {
    ids: options.map((option) => option.value),
    names: options.map((option) => option.dataset.choiceLabel || option.textContent?.split("｜")[0].trim() || ""),
  };
}

function collectWeeklyVisits() {
  return rowsByWeeklySequence(elements.weeklyVisitRows, ".weekly-visit-card").map((row) => {
    const values = {};
    row.querySelectorAll("[data-weekly-field]").forEach((input) => { values[input.dataset.weeklyField] = input.value.trim(); });
    Object.assign(values, visitResourceSnapshot(row));
    const meaningful = [values.platform_company_id, values.unit, values.contact_people, values.participants, values.project, values.contact_method, values.discussion, values.project_impact, values.next_action].some(Boolean);
    if (!meaningful) return null;
    values.is_effective = values.unit && values.contact_people && values.participants && values.contact_method && (values.discussion || values.project_impact) && values.next_action ? "是" : "否";
    return values;
  }).filter(Boolean);
}

function collectWeeklyForm(status = "draft") {
  return {
    title: elements.weeklyTitleInput.value.trim() || mondayReportTitle(),
    status,
    import_now: false,
    visits: collectWeeklyVisits(),
    projects: collectWeeklyRows(elements.weeklyProjectRows),
    next_week_plan: rowsByWeeklySequence(elements.weeklyPlanRows, ".weekly-plan-row")
      .map((row) => ({
        ...planResourceSnapshot(row),
        work: row.querySelector("[data-weekly-plan-item]")?.value.trim() || "",
      }))
      .filter((item) => item.project || item.platform_company || item.contact_people || item.work),
  };
}

function validateWeeklyProjectRows(status) {
  if (status !== "completed") return true;
  const missing = [...elements.weeklyProjectRows.querySelectorAll('[data-weekly-mode="ledger"]')]
    .find((row) => !row.querySelector("[data-ledger-project]")?.value);
  if (!missing) return true;
  const selector = missing.querySelector("[data-ledger-project]");
  selector.focus();
  showWeeklyResult("请选择台账项目后再完成本周小结。", "error");
  return false;
}

async function saveWeeklyForm(status = "draft") {
  const button = status === "completed" ? elements.completeWeeklyButton : elements.saveWeeklyDraftButton;
  button.disabled = true;
  showWeeklyResult(status === "completed" ? "正在保存完成稿..." : "正在暂存草稿...", "info");
  try {
    if (!validateWeeklyProjectRows(status)) return;
    const payload = collectWeeklyForm(status);
    if (isGitHubSaveMode()) {
      const data = await saveWeeklyToGitHub(payload);
      showWeeklyResult(status === "completed" ? `已完成并保存到 GitHub：${data.file}。` : `已暂存到 GitHub：${data.file}。`, "success");
      return;
    }
    const response = await fetch("/api/weekly/form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      showWeeklyResult(`保存失败：${await responseErrorMessage(response)}`, "error");
      return;
    }
    const data = await response.json();
    showWeeklyResult(status === "completed" ? `已完成：${data.file}。台账导入时会读取这份小结。` : `已暂存：${data.file}。`, "success");
  } catch (error) {
    showWeeklyResult(`保存失败：${error.message || error}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function setupWeeklyInput() {
  loadGitHubSettings();
  elements.weeklyTitleInput.value = mondayReportTitle();
  addLedgerWeeklyProjectRow();
  addWeeklyPlanItem();
  if (isGitHubSaveMode()) {
    if (collectGitHubSettings().token) {
      try {
        const count = await loadLedgerProjects();
        if (count) {
          showWeeklyResult(`已加载 ${count} 个台账项目。`, "success");
        }
        await loadWeeklyFromGitHub();
        if (!elements.weeklyVisitRows.children.length) addWeeklyVisitRow();
      } catch (error) {
        showWeeklyResult(`GitHub 读取失败：${error.message || error}`, "error");
        addWeeklyVisitRow();
      }
    } else {
      addWeeklyVisitRow();
      showWeeklyResult("当前为 GitHub 保存模式。第一次使用请填写 token 并保存设置。", "info");
    }
  }
}

elements.addWeeklyVisitButton.addEventListener("click", () => addWeeklyVisitRow());
elements.refreshWeeklyResourcesButton.addEventListener("click", () => refreshWeeklyResources());
elements.addLedgerWeeklyProjectButton.addEventListener("click", addLedgerWeeklyProjectRowWithLoad);
elements.addCustomWeeklyProjectButton.addEventListener("click", () => addCustomWeeklyProjectRow());
elements.addWeeklyPlanButton.addEventListener("click", () => addWeeklyPlanItem());
elements.saveGithubSettingsButton.addEventListener("click", saveGitHubSettings);
elements.saveWeeklyDraftButton.addEventListener("click", () => saveWeeklyForm("draft"));
elements.completeWeeklyButton.addEventListener("click", () => saveWeeklyForm("completed"));

elements.weeklyInputPanel.addEventListener("click", (event) => {
  const addWorkButton = event.target.closest("[data-add-weekly-work]");
  if (addWorkButton) {
    const list = addWorkButton.closest(".weekly-work-items")?.querySelector(".weekly-work-list");
    if (list) addWeeklyWorkItem(list);
    return;
  }
  const removeWorkButton = event.target.closest("[data-remove-weekly-work]");
  if (removeWorkButton) {
    const list = removeWorkButton.closest(".weekly-work-list");
    removeWorkButton.closest(".weekly-work-item")?.remove();
    if (list) renumberWeeklyWorkItems(list);
    return;
  }
  const removePlanButton = event.target.closest("[data-remove-weekly-plan]");
  if (removePlanButton) {
    removePlanButton.closest(".weekly-plan-row")?.remove();
    if (!elements.weeklyPlanRows.children.length) addWeeklyPlanItem();
    renumberWeeklyPlanItems();
    return;
  }
  const button = event.target.closest("[data-remove-weekly-row]");
  if (!button) return;
  button.closest(".weekly-row, .weekly-project-row, .weekly-visit-card")?.remove();
  renumberWeeklyProjectRows();
  renumberWeeklyVisitRows();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshWeeklyResources({ silent: true });
});

window.addEventListener("error", (event) => {
  showWeeklyResult(`页面脚本出错：${event.message || "未知错误"}。请刷新页面后再试。`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || event.reason || "未知错误";
  showWeeklyResult(`页面请求出错：${reason}。请刷新页面后再试。`, "error");
});

setupWeeklyInput();
