import test from "node:test";
import assert from "node:assert/strict";
globalThis.window = new EventTarget();
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
window.localStorage = storage;
window.sessionStorage = storage;
const { default: reducer, fetchDashboard, resetDashboard } = await import("../src/features/dashboard/dashboardSlice.js");

test("late dashboard response cannot restore data after logout", () => {
  let state = reducer(undefined, fetchDashboard.pending("old", "admin"));
  state = reducer(state, resetDashboard());
  state = reducer(state, fetchDashboard.fulfilled({ private: "old user" }, "old", "admin"));
  assert.equal(state.data, null);
  assert.equal(state.role, null);
});
test("only the most recent dashboard request can finish or fail", () => {
  let state = reducer(undefined, fetchDashboard.pending("first", "admin"));
  state = reducer(state, fetchDashboard.pending("second", "outpost"));
  state = reducer(state, fetchDashboard.rejected(new Error("old failure"), "first", "admin"));
  assert.equal(state.loading, true);
  assert.equal(state.error, null);
  state = reducer(state, fetchDashboard.fulfilled({ owner: "outpost" }, "second", "outpost"));
  state = reducer(state, fetchDashboard.fulfilled({ owner: "admin" }, "first", "admin"));
  assert.equal(state.data.owner, "outpost");
  assert.equal(state.role, "outpost");
});
