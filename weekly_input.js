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
const state = { ledgerProjects: [] };

const elements = {
  weeklyInputPanel: document.getElementById("weeklyInputPanel"),
  weeklyTitleInput: document.getElementById("weeklyTitleInput"),
  weeklyVisitRows: document.getElementById("weeklyVisitRows"),
  weeklyProjectRows: document.getElementById("weeklyProjectRows"),
  weeklyPlanRows: document.getElementById("weeklyPlanRows"),
  addWeeklyVisitButton: document.getElementById("addWeeklyVisitButton"),
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
    "## 主要拜访人员",
  ];

  const visits = Array.isArray(payload.visits) ? payload.visits : [];
  const meaningfulVisits = visits.filter((visit) => Object.values(visit).some(Boolean));
  if (meaningfulVisits.length) {
    meaningfulVisits.forEach((visit) => {
      lines.push(`- 单位：${visit.unit || ""}；姓名：${visit.name || ""}；职务：${visit.position || ""}；对应项目：${visit.project || ""}；`);
    });
  } else {
    lines.push("- 单位：；姓名：；职务：；对应项目：；");
  }

  lines.push("", "## 项目跟进情况");
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
      ["下一步工作", project.next_work],
    ].forEach(([label, value]) => {
      lines.push(`- ${label}：${value || ""}`);
    });
    [
      ["下一节点时间", project.next_node_time],
      ["关联项目", project.related_project],
      ["备注", project.note],
    ].forEach(([label, value]) => {
      lines.push(`- ${label}：${value || ""}`);
    });
  });
  lines.push("", "## 下周工作计划");
  const planItems = Array.isArray(payload.next_week_plan) ? payload.next_week_plan.map(formatWeeklyPlanItem).filter(Boolean) : [];
  if (planItems.length) {
    planItems.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  } else {
    lines.push("1. ");
  }
  return `${lines.join("\n")}\n`;
}

function formatWeeklyPlanItem(item) {
  if (item && typeof item === "object") {
    const project = cleanWorkItem(item.project || "");
    const work = cleanWorkItem(item.work || "");
    if (project && work) return `关联项目：${project}；工作内容：${work}`;
    if (project) return `关联项目：${project}`;
    return work;
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
  document.querySelectorAll("[data-ledger-project]").forEach((select) => {
    const selected = select.value;
    select.innerHTML = ledgerProjectOptions(selected);
  });
  return state.ledgerProjects.length;
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
  String(line || "")
    .replace(/^-\s*/, "")
    .split("；")
    .forEach((part) => {
      const [label, value] = parseKeyValueLine(part);
      if (label === "单位") visit.unit = value;
      if (label === "姓名") visit.name = value;
      if (label === "职务") visit.position = value;
      if (label === "对应项目") visit.project = value;
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
  const item = { project: "", work: "" };
  cleaned.split("；").forEach((part) => {
    const [label, value] = parseKeyValueLine(part);
    if (label === "关联项目") item.project = value;
    if (label === "工作内容") item.work = value;
  });
  if (!item.project && !item.work) item.work = cleaned;
  return item;
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
  const visitsText = markdownSection(markdown, "主要拜访人员");
  payload.visits = visitsText
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .map(parseVisitLine)
    .filter((visit) => Object.values(visit).some(Boolean));

  const projectsText = markdownSection(markdown, "项目跟进情况");
  payload.projects = projectsText
    .split(/\n###\s+/)
    .map((block) => block.replace(/^###\s+/, "").trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const project = { name: lines.shift().trim(), next_week_work: [] };
      lines.forEach((line) => {
        const [label, value] = parseKeyValueLine(line);
        if (label === "业主单位") project.owner_org = value;
        if (label === "地区") project.region = value;
        if (label === "技术配合组") project.technical_group = value;
        if (label === "当前进度") project.progress = value;
        if (label === "当前细分阶段") project.detail_stage = value;
        if (label === "本周进展") project.current_update = value;
        if (label === "下一步工作") project.next_work = value;
        if (label === "下周工作") project.next_week_work = parseNextWeekWork(value);
        if (label === "下一节点时间") project.next_node_time = value;
        if (label === "关联项目") project.related_project = value;
        if (label === "备注") project.note = value;
      });
      return project;
    });
  payload.next_week_plan = markdownSection(markdown, "下周工作计划")
    .split("\n")
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

function addWeeklyVisitRow(row = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-row weekly-visit-row";
  wrapper.innerHTML = `
    <input data-weekly-field="unit" placeholder="单位" value="${escapeHtml(row.unit || "")}">
    <input data-weekly-field="name" placeholder="姓名" value="${escapeHtml(row.name || "")}">
    <input data-weekly-field="position" placeholder="职务" value="${escapeHtml(row.position || "")}">
    <input data-weekly-field="project" placeholder="对应项目" value="${escapeHtml(row.project || "")}">
    <button type="button" data-remove-weekly-row>删除</button>
  `;
  prependWeeklyRow(elements.weeklyVisitRows, wrapper);
}

function addCustomWeeklyProjectRow(row = {}, options = {}) {
  const wrapper = document.createElement("section");
  wrapper.className = "weekly-project-row";
  wrapper.dataset.weeklyMode = "custom";
  wrapper.innerHTML = `
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
      <label>关联项目<input data-weekly-field="related_project" placeholder="关联项目" value="${escapeHtml(row.related_project || "")}"></label>
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
    <div class="weekly-project-grid" data-weekly-mode="ledger">
      <label class="full-width">台账项目<select data-ledger-project>${ledgerProjectOptions(row.project_id || "")}</select></label>
      <label>项目名称<input data-weekly-field="name" readonly value="${escapeHtml(row.name || "")}"></label>
      <label>业主单位<input data-weekly-field="owner_org" readonly value="${escapeHtml(row.owner_org || "")}"></label>
      <label>地区<input data-weekly-field="region" readonly value="${escapeHtml(row.region || "")}"></label>
      <label>技术配合组<select data-weekly-field="technical_group" disabled>${optionHtml(TECHNICAL_GROUP_OPTIONS, row.technical_group || "")}</select></label>
      <label>当前进度<select data-weekly-field="progress">${optionHtml(WEEKLY_PROGRESS_OPTIONS, row.progress || "项目接触")}</select></label>
      <label>当前细分阶段<select data-weekly-field="detail_stage">${optionHtml(DETAIL_STAGES, row.detail_stage || "线索获取")}</select></label>
      <label>下一节点时间<input data-weekly-field="next_node_time" value="${escapeHtml(row.next_node_time || "")}"></label>
      <label>关联项目<input data-weekly-field="related_project" value="${escapeHtml(row.related_project || "")}"></label>
      <label class="full-width">本周进展<textarea data-weekly-field="current_update" rows="3">${escapeHtml(row.current_update || "")}</textarea></label>
      <label class="full-width">下一步工作<textarea data-weekly-field="next_work" rows="2">${escapeHtml(row.next_work || "")}</textarea></label>
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
  if (options.append) {
    container.appendChild(wrapper);
    return;
  }
  if (container === elements.weeklyProjectRows) {
    elements.weeklyProjectRows.prepend(wrapper);
    return;
  }
  if (container === elements.weeklyPlanRows) {
    elements.weeklyPlanRows.prepend(wrapper);
    return;
  }
  container.prepend(wrapper);
}

function renderWeeklyPayload(payload) {
  elements.weeklyTitleInput.value = payload.title || mondayReportTitle();
  elements.weeklyVisitRows.innerHTML = "";
  elements.weeklyProjectRows.innerHTML = "";
  elements.weeklyPlanRows.innerHTML = "";
  const visits = Array.isArray(payload.visits) && payload.visits.length ? payload.visits : [{}];
  const projects = Array.isArray(payload.projects) && payload.projects.length ? payload.projects : [{}];
  const planItems = Array.isArray(payload.next_week_plan) && payload.next_week_plan.length ? payload.next_week_plan : [""];
  visits.forEach((visit) => addWeeklyVisitRow(visit));
  projects.forEach((project) => addCustomWeeklyProjectRow(project, { append: true }));
  planItems.forEach((item) => addWeeklyPlanItem(item, { append: true }));
}

function addWeeklyPlanItem(value = "", options = {}) {
  const item = value && typeof value === "object" ? value : { project: "", work: value || "" };
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-plan-row";
  wrapper.innerHTML = `
    <span class="weekly-work-index"></span>
    <input data-weekly-plan-project placeholder="关联项目" value="${escapeHtml(item.project || "")}">
    <input data-weekly-plan-item placeholder="工作内容" value="${escapeHtml(item.work || "")}">
    <button type="button" data-remove-weekly-plan>删除</button>
  `;
  prependWeeklyRow(elements.weeklyPlanRows, wrapper, options);
  renumberWeeklyPlanItems();
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
  [...elements.weeklyPlanRows.querySelectorAll(".weekly-plan-row")].forEach((item, index) => {
    item.querySelector(".weekly-work-index").textContent = `${index + 1}.`;
  });
}

function collectWeeklyRows(container) {
  return [...container.children].map((row) => {
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

function collectWeeklyForm(status = "draft") {
  return {
    title: elements.weeklyTitleInput.value.trim() || mondayReportTitle(),
    status,
    import_now: false,
    visits: collectWeeklyRows(elements.weeklyVisitRows),
    projects: collectWeeklyRows(elements.weeklyProjectRows),
    next_week_plan: [...elements.weeklyPlanRows.querySelectorAll(".weekly-plan-row")]
      .map((row) => ({
        project: row.querySelector("[data-weekly-plan-project]")?.value.trim() || "",
        work: row.querySelector("[data-weekly-plan-item]")?.value.trim() || "",
      }))
      .filter((item) => item.project || item.work),
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
  addWeeklyVisitRow();
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
      } catch (error) {
        showWeeklyResult(`GitHub 读取失败：${error.message || error}`, "error");
      }
    } else {
      showWeeklyResult("当前为 GitHub 保存模式。第一次使用请填写 token 并保存设置。", "info");
    }
  }
}

elements.addWeeklyVisitButton.addEventListener("click", () => addWeeklyVisitRow());
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
  button.closest(".weekly-row, .weekly-project-row")?.remove();
});

window.addEventListener("error", (event) => {
  showWeeklyResult(`页面脚本出错：${event.message || "未知错误"}。请刷新页面后再试。`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || event.reason || "未知错误";
  showWeeklyResult(`页面请求出错：${reason}。请刷新页面后再试。`, "error");
});

setupWeeklyInput();
