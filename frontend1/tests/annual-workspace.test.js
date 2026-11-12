import test from "node:test";
import assert from "node:assert/strict";
import { annualKey, reportingYear, readAnnualDrafts, writeAnnualDraft } from "../src/annualWorkspace.js";
const values = new Map();
globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };

test("year changes at midnight in Bishkek rather than browser timezone", () => {
  assert.equal(reportingYear(new Date("2026-12-31T17:59:59Z")), 2026);
  assert.equal(reportingYear(new Date("2026-12-31T18:00:00Z")), 2027);
});
test("new year keeps old data and creates a separate clean document template", () => {
  values.clear();
  localStorage.setItem("periods", JSON.stringify([{ id: "one", title: "2026 отчёт", table: { rows: [{ number: "1", topic: "old report", hours: "99" }] } }]));
  const oldKey = annualKey("periods", 10, 2026, true);
  const newKey = annualKey("periods", 10, 2027, true);
  const next = JSON.parse(localStorage.getItem(newKey));
  assert.equal(next[0].title, "2027 отчёт");
  assert.equal(next[0].table.rows[0].topic, "");
  assert.equal(next[0].table.rows[0].number, "1");
  assert.equal(JSON.parse(localStorage.getItem(oldKey))[0].table.rows[0].topic, "old report");
  assert.equal(localStorage.getItem(annualKey("periods", 11, 2027)), null);
});
test("snapshots for different years and owners do not overwrite one another", () => {
  writeAnnualDraft(10, { year: 2026, key: "doc", table: { rows: ["old"] } });
  writeAnnualDraft(10, { year: 2027, key: "doc", table: { rows: ["new"] } });
  assert.equal(Object.keys(readAnnualDrafts(10)).length, 2);
  assert.deepEqual(readAnnualDrafts(11), {});
});
