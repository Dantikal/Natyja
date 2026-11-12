import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { create, act } from "react-test-renderer";
import { useHistoryState } from "../src/hooks/useHistoryState.js";

test("Back and Forward restore sections without adding history; remount restores the current section", () => {
  globalThis.window = new EventTarget();
  const entries = [null];
  let index = 0;
  window.history = {
    get state() { return entries[index]; },
    replaceState(state) { entries[index] = state; },
    pushState(state) { entries.splice(++index); entries[index] = state; },
    go(delta) { index += delta; window.dispatchEvent(new Event("popstate")); },
  };
  let route;
  function Page({ account = "dashboard" }) {
    route = useHistoryState(account, "home");
    return React.createElement("span", null, route[0]);
  }
  let root;
  act(() => { root = create(React.createElement(Page)); });
  act(() => route[1]("library"));
  act(() => route[1]("profile"));
  assert.equal(entries.length, 3);
  act(() => window.history.go(-1));
  assert.equal(route[0], "library");
  act(() => window.history.go(-1));
  assert.equal(route[0], "home");
  act(() => window.history.go(1));
  assert.equal(route[0], "library");
  act(() => route[1]("library"));
  assert.equal(entries.length, 3);
  act(() => root.unmount());
  act(() => { root = create(React.createElement(Page)); });
  assert.equal(route[0], "library");
  act(() => root.update(React.createElement(Page, { account: "another-user" })));
  assert.equal(route[0], "home");
  act(() => root.update(React.createElement(Page)));
  assert.equal(route[0], "library");
  act(() => root.unmount());
});

test("opening a different document uses its own initial section", () => {
  globalThis.window = new EventTarget();
  let historyState = null;
  window.history = { get state() { return historyState; }, replaceState(next) { historyState = next; }, pushState(next) { historyState = next; } };
  let route;
  function Editor({ id, section }) { route = useHistoryState(id, section); return React.createElement('span', null, route[0]); }
  let root;
  act(() => { root = create(React.createElement(Editor, {id:'first',section:'monthly'})); });
  act(() => route[1]('other'));
  act(() => root.update(React.createElement(Editor, {id:'second',section:'shooting'})));
  assert.equal(route[0], 'shooting');
  act(() => root.update(React.createElement(Editor, {id:'first',section:'monthly'})));
  assert.equal(route[0], 'other');
  act(() => root.unmount());
});
