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
const LOCAL_WEEKLY_URL = "http://127.0.0.1:8798/weekly-input.html?v=20260628-github-save";
const GITHUB_SETTINGS_KEY = "bd-weekly-github-settings";

const elements = {
  weeklyInputPanel: document.getElementById("weeklyInputPanel"),
  weeklyTitleInput: document.getElementById("weeklyTitleInput"),
  weeklyVisitRows: document.getElementById("weeklyVisitRows"),
  weeklyProjectRows: document.getElementById("weeklyProjectRows"),
  addWeeklyVisitButton: document.getElementById("addWeeklyVisitButton"),
  addWeeklyProjectButton: document.getElementById("addWeeklyProjectButton"),
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
    ].forEach(([label, value]) => {
      lines.push(`- ${label}：${value || ""}`);
    });
    const workItems = Array.isArray(project.next_week_work) ? project.next_week_work.map(cleanWorkItem).filter(Boolean) : [];
    lines.push(`- 下周工作：${workItems.map((item, index) => `${index + 1}. ${item}`).join("；")}`);
    [
      ["下一节点时间", project.next_node_time],
      ["关联项目", project.related_project],
      ["备注", project.note],
    ].forEach(([label, value]) => {
      lines.push(`- ${label}：${value || ""}`);
    });
  });
  lines.push("", "## 下周工作计划");
  return `${lines.join("\n")}\n`;
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

function saveGitHubSettings() {
  const settings = collectGitHubSettings();
  localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
  showWeeklyResult("GitHub 保存设置已保存在当前浏览器。", "success");
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
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
  saveGitHubSettings();
  const fileName = `${payload.title || mondayReportTitle()}.md`;
  const path = `weekly/${encodeURIComponent(fileName).replace(/%2F/g, "-")}`;
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
    throw new Error(await responseErrorMessage(response));
  }
  return { file: fileName, path };
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
  elements.weeklyVisitRows.appendChild(wrapper);
}

function addWeeklyProjectRow(row = {}) {
  const wrapper = document.createElement("section");
  wrapper.className = "weekly-project-row";
  const workItems = Array.isArray(row.next_week_work) && row.next_week_work.length
    ? row.next_week_work
    : [row.next_work || ""];
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
      <section class="weekly-work-items full-width">
        <div class="weekly-work-header">
          <strong>下周工作</strong>
          <button type="button" data-add-weekly-work>+</button>
        </div>
        <div class="weekly-work-list"></div>
      </section>
      <label class="full-width">备注<textarea data-weekly-field="note" rows="2">${escapeHtml(row.note || "")}</textarea></label>
    </div>
    <button class="remove-weekly-project" type="button" data-remove-weekly-row>删除项目</button>
  `;
  elements.weeklyProjectRows.appendChild(wrapper);
  const list = wrapper.querySelector(".weekly-work-list");
  workItems.forEach((item) => addWeeklyWorkItem(list, item));
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
  };
}

async function saveWeeklyForm(status = "draft") {
  const button = status === "completed" ? elements.completeWeeklyButton : elements.saveWeeklyDraftButton;
  button.disabled = true;
  showWeeklyResult(status === "completed" ? "正在保存完成稿..." : "正在暂存草稿...", "info");
  try {
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

function setupWeeklyInput() {
  loadGitHubSettings();
  elements.weeklyTitleInput.value = mondayReportTitle();
  addWeeklyVisitRow();
  addWeeklyProjectRow();
  if (isGitHubSaveMode()) {
    showWeeklyResult("当前为 GitHub 保存模式。第一次使用请填写 token 并保存设置。", "info");
  }
}

elements.addWeeklyVisitButton.addEventListener("click", () => addWeeklyVisitRow());
elements.addWeeklyProjectButton.addEventListener("click", () => addWeeklyProjectRow());
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
