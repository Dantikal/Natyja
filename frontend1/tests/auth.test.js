import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";

const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
globalThis.window = new EventTarget();
window.sessionStorage = storage();
window.localStorage = storage();
const { authStorage, readStoredUser, clearAuthStorage } = await import("../src/features/auth/authStorage.js");
const { api } = await import("../src/api/client.js");
const { getPendingRequests } = await import("../src/api/loading.js");

test("malformed stored user recovers to a clean login session", () => {
  authStorage.setItem("user", "{broken");
  authStorage.setItem("access", "stale");
  assert.equal(readStoredUser(), null);
  assert.equal(authStorage.getItem("access"), null);
});

test("parallel unauthorized requests share refresh and retry with the new token", async () => {
  authStorage.setItem("access", "old");
  authStorage.setItem("refresh", "refresh");
  let refreshCalls = 0;
  const originalPost = axios.post;
  axios.post = async () => {
    refreshCalls++;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { data: { access: "new" } };
  };
  const adapter = async (config) => {
    if (config.headers.Authorization === "Bearer old") {
      throw new axios.AxiosError("Expired", "ERR_BAD_REQUEST", config, null, { status: 401 });
    }
    assert.equal(config.headers.Authorization, "Bearer new");
    return { status: 200, data: {}, config };
  };
  try {
    await Promise.all([api.get("/one", { adapter }), api.get("/two", { adapter })]);
    assert.equal(refreshCalls, 1);
    assert.equal(getPendingRequests(), 0);
  } finally { axios.post = originalPost; clearAuthStorage(); }
});

test("unauthorized request without refresh notifies the UI", async () => {
  let expired = false;
  window.addEventListener("auth:expired", () => { expired = true; }, { once: true });
  await assert.rejects(api.get("/private", { adapter: async (config) => {
    throw new axios.AxiosError("Expired", "ERR_BAD_REQUEST", config, null, { status: 401 });
  } }));
  assert.equal(expired, true);
  assert.equal(getPendingRequests(), 0);
});

test("late unauthorized response from a previous account does not expire the new session", async () => {
  authStorage.setItem("refresh", "old-account");
  authStorage.setItem("access", "old-access");
  let expired = false;
  const listener = () => { expired = true; };
  window.addEventListener("auth:expired", listener);
  try {
    await assert.rejects(api.get("/old-account", { adapter: async (config) => {
      authStorage.setItem("refresh", "new-account");
      authStorage.setItem("access", "new-access");
      throw new axios.AxiosError("Expired", "ERR_BAD_REQUEST", config, null, { status: 401 });
    } }));
    assert.equal(expired, false);
    assert.equal(authStorage.getItem("access"), "new-access");
    assert.equal(getPendingRequests(), 0);
  } finally { window.removeEventListener("auth:expired", listener); clearAuthStorage(); }
});
