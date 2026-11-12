export const reportingYear = (date = new Date()) => Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bishkek", year: "numeric" }).format(date));
export const annualRegistryKey = (userId) => `munara:annual-drafts:${userId}`;
export function readAnnualDrafts(userId) {
  const value = JSON.parse(localStorage.getItem(annualRegistryKey(userId)) || "{}");
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function writeAnnualDraft(userId, draft) {
  const drafts = readAnnualDrafts(userId);
  drafts[`${draft.year}:${draft.key}`] = draft;
  localStorage.setItem(annualRegistryKey(userId), JSON.stringify(drafts));
}
export function annualKey(base, userId, year, clonePeriods = false) {
  if (!base || !userId) return base;
  const key = `${base}:owner:${userId}:year:${year}`;
  const baseline = `munara:annual-baseline:${userId}`;
  if (!localStorage.getItem(baseline)) localStorage.setItem(baseline, String(year));
  if (localStorage.getItem(key) === null) {
    const legacyOwner = `munara:annual-owner:${base}`;
    if (Number(localStorage.getItem(baseline)) === year && localStorage.getItem(base) !== null &&
      (!localStorage.getItem(legacyOwner) || localStorage.getItem(legacyOwner) === String(userId))) {
      localStorage.setItem(legacyOwner, String(userId));
      localStorage.setItem(key, localStorage.getItem(base));
    } else if (clonePeriods) {
      let previous = null;
      for (let priorYear = year - 1; priorYear >= Number(localStorage.getItem(baseline)); priorYear--) {
        previous = localStorage.getItem(`${base}:owner:${userId}:year:${priorYear}`);
        if (previous) break;
      }
      if (previous) {
        const clean = (table) => table ? { ...table, cellColors: {}, rows: (table.rows || []).map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, ["number", "rowType"].includes(name) ? value : ""]))) } : table;
        const periods = JSON.parse(previous).map((period) => ({ ...period, title: String(period.title || "").replace(/20\d{2}|20__/g, String(year)), table: clean(period.table) }));
        localStorage.setItem(key, JSON.stringify(periods));
      }
    }
  }
  return key;
}
