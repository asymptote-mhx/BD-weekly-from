(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MarketPlatformVisit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function field(row, key) { return String(row?.[key] ?? "").trim(); }
  function parseDate(value) {
    const match = field({ value }, "value").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function latestVisit(timeline, companyId, now = new Date()) {
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return (Array.isArray(timeline) ? timeline : []).reduce((latest, row) => {
      if (field(row, "platform_company_id") !== companyId || field(row, "来源类型") === "已删除") return latest;
      const parsed = parseDate(row?.["接触日期"]);
      const time = parsed?.getTime();
      return time != null && time <= today && (latest == null || time > latest) ? time : latest;
    }, null);
  }
  function describe(timeline, companyId, now = new Date()) {
    const latest = latestVisit(timeline, companyId, now);
    if (latest == null) return { label: "尚无拜访记录", date: "", days: null };
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.floor((today - latest) / 86400000);
    const label = days <= 30 ? `距上次拜访 ${days} 天` : `距上次拜访 ${Math.floor(days / 30)} 个月`;
    return { label, date: new Date(latest).toISOString().slice(0, 10), days };
  }
  return { describe, latestVisit };
});
