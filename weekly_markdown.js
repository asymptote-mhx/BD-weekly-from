(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MarketWeeklyMarkdown = api;
}(typeof window !== "undefined" ? window : globalThis, function () {
  function clean(value) { return String(value || "").trim(); }

  function frontmatter(markdown) {
    const match = String(markdown || "").match(/^---\s*\n([\s\S]*?)\n---/);
    const result = {};
    if (!match) return result;
    match[1].split(/\r?\n/).forEach((line) => {
      const index = line.indexOf(":");
      if (index > 0) result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    });
    return result;
  }

  function parseKeyValueLine(line) {
    const source = String(line || "").replace(/^\s*-\s*/, "").trim();
    const colon = source.search(/[：:]/);
    return colon < 0 ? ["", ""] : [source.slice(0, colon).trim(), source.slice(colon + 1).trim()];
  }

  function markdownSection(markdown, headings) {
    for (const heading of headings) {
      const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = String(markdown || "").match(new RegExp(`(?:^|\\n)## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`));
      if (match) return match[1].trim();
    }
    return "";
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
      } else if (line.trim()) {
        current = line.trim();
      }
    });
    if (current.trim()) records.push(current.trim());
    return records;
  }

  function parseVisitLine(line) {
    const visit = {};
    const labels = ["单位", "平台公司", "平台公司ID", "姓名", "接触对象", "职务", "对应项目", "接触日期", "参与拜访人员", "接触方式", "沟通内容", "项目影响", "下一步行动", "下一步日期", "是否有效拜访"];
    const source = String(line || "").replace(/^\s*-\s*/, "");
    const pattern = new RegExp(`(?:^|[；;])\\s*(${labels.sort((a, b) => b.length - a.length).join("|")})\\s*[：:]`, "g");
    const matches = [...source.matchAll(pattern)];
    matches.forEach((match, index) => {
      const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
      const value = source.slice(match.index + match[0].length, end).trim().replace(/[；;\s]+$/, "");
      const keys = {单位:"unit",平台公司:"unit",平台公司ID:"platform_company_id",姓名:"name",接触对象:"contact_people",职务:"position",对应项目:"project",接触日期:"contact_date",参与拜访人员:"participants",接触方式:"contact_method",沟通内容:"discussion",项目影响:"project_impact",下一步行动:"next_action",下一步日期:"next_action_date",是否有效拜访:"is_effective"};
      visit[keys[match[1]]] = value;
    });
    if (!visit.contact_people && visit.name) visit.contact_people = visit.name;
    return visit;
  }

  function parsePlanLine(line) {
    const source = String(line || "").replace(/^\d+[.、]\s*/, "").trim();
    const item = {project:"", platform_company:"", contact_people:"", work:""};
    source.split("；").forEach((part) => {
      const [label, value] = parseKeyValueLine(part);
      if (label === "关联项目") item.project = value;
      if (label === "关联平台" || label === "平台公司") item.platform_company = value;
      if (label === "关联人员" || label === "接触对象") item.contact_people = value;
      if (label === "工作内容") item.work = value;
    });
    if (!Object.values(item).some(Boolean)) item.work = source;
    return item;
  }

  function parseProjectBlock(block) {
    const lines = block.split(/\r?\n/);
    const project = {name: clean(lines.shift()), next_week_work: []};
    let lastField = "";
    const fields = {业主单位:"owner_org",地区:"region",技术配合组:"technical_group",当前进度:"progress",当前细分阶段:"detail_stage",本周进展:"current_update",下一步工作:"next_work",下一节点时间:"next_node_time",关联项目:"related_project",备注:"note"};
    lines.forEach((line) => {
      const [label, value] = parseKeyValueLine(line);
      const key = fields[label];
      if (key) { project[key] = value; lastField = key; return; }
      if (label === "下周工作") {
        project.next_week_work = value.split(/；\s*/).map((item) => item.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
        lastField = "";
        return;
      }
      if (line.trim() && lastField) project[lastField] = `${project[lastField] || ""}\n${line.trim()}`.trim();
    });
    return project;
  }

  function parse(markdown, fallbackTitle = "") {
    const text = String(markdown || "");
    const meta = frontmatter(text);
    const titleMatch = text.match(/^#\s+(.+)$/m);
    const projectsText = markdownSection(text, ["本周项目推进", "项目跟进情况"]);
    const projects = projectsText.split(/\n###\s+/).map((block) => block.replace(/^###\s+/, "").trim()).filter(Boolean).map(parseProjectBlock);
    const visitsText = markdownSection(text, ["本周拜访与沟通", "主要拜访人员"]);
    const visits = structuredRecords(visitsText, /^\s*-\s+/, /^\s*-\s+/).map(parseVisitLine).filter((row) => Object.values(row).some(Boolean));
    let nextWeekPlan = structuredRecords(markdownSection(text, ["下周工作计划"]), /^\d+[.、]\s*/, /^\d+[.、]\s*/).map(parsePlanLine).filter((row) => Object.values(row).some(Boolean));
    if (!nextWeekPlan.length) nextWeekPlan = projects.flatMap((project) => project.next_week_work.map((work) => ({project:project.name, platform_company:"", contact_people:"", work})));
    return {
      title: clean(titleMatch?.[1]) || fallbackTitle,
      status: meta.status === "completed" ? "completed" : "draft",
      report_date: meta.week_monday || "",
      updated_at: meta.updated_at || "",
      projects, visits, next_week_plan: nextWeekPlan,
    };
  }

  return {frontmatter, parse};
}));
