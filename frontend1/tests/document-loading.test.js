import test from "node:test";
import assert from "node:assert/strict";
const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
globalThis.window = new EventTarget();
window.localStorage = storage;
window.sessionStorage = storage;
const { api } = await import("../src/api/client.js");
const { getThematicAccountSubmissions } = await import("../src/api/dashboard.js");

test("document pages preserve filters and simultaneous consumers share one load", async () => {
  const cursors = [];
  api.defaults.adapter = async (config) => {
    const params = config.params;
    assert.equal(params.get("senderId"), "7");
    assert.deepEqual(params.getAll("sectionId"), ["lesson-schedule"]);
    cursors.push(params.get("beforeId"));
    await new Promise((resolve) => setTimeout(resolve, 1));
    return { status: 200, config, data: params.get("beforeId")
      ? { results: [{ id: 1 }], nextCursor: null }
      : { results: [{ id: 2 }], nextCursor: 2 } };
  };
  const [first, second] = await Promise.all([
    getThematicAccountSubmissions(undefined, ["lesson-schedule"], 7),
    getThematicAccountSubmissions(undefined, ["lesson-schedule"], 7),
  ]);
  assert.deepEqual(first, [{ id: 2 }, { id: 1 }]);
  assert.deepEqual(second, first);
  assert.deepEqual(cursors, [null, "2"]);
});
