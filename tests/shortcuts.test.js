import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_COMMANDS, SHORTCUTS_KEY, SHORTCUT_CONDITIONS_KEY, TAB_HISTORY_KEY, normalizeShortcuts, normalizeShortcutConditions, validateShortcut, recordActivation } from "../components/modules/keyboard-shortcuts/shortcut-settings.js";
import { usesArrowKey, shortcutCondition } from "../components/modules/keyboard-shortcuts/shortcut-focus.js";

test("arrow shortcuts recognize Chrome's English and Turkish labels without matching ordinary shortcuts", () => {
  for (const value of ["Ctrl+Left", "Ctrl+Shift+ArrowRight", "Ctrl+Sol Ok", "Ctrl+Sağ Ok", "Alt+Yukarı Ok", "Ctrl+↓"]) assert.equal(usesArrowKey(value), true);
  for (const value of ["Ctrl+Q", "Ctrl+L", "", "Ctrl+Home"]) assert.equal(usesArrowKey(value), false);
});

test("typing conditions retain arrow defaults and explicit choices override every binding", () => {
  assert.deepEqual(normalizeShortcutConditions({ "previous-tab": true, "tab-left": false, "custom-1": "typing", "custom-2": "false", unknown: true }), { "previous-tab": "not-typing", "tab-left": "always", "custom-1": "typing" });
  assert.deepEqual(normalizeShortcutConditions(null), {});
  assert.equal(shortcutCondition("previous-tab", "Ctrl+Q", {}), "always");
  assert.equal(shortcutCondition("tab-left", "", {}), "not-typing");
  assert.equal(shortcutCondition("custom-1", "Ctrl+Sağ Ok", {}), "not-typing");
  assert.equal(shortcutCondition("previous-tab", "Ctrl+Q", { "previous-tab": "typing" }), "typing");
  assert.equal(shortcutCondition("custom-1", "Ctrl+Sağ Ok", { "custom-1": "always" }), "always");
});

test("shortcut settings reject unsafe URLs, unknown actions and duplicate slots", () => {
  const valid = { command: "custom-1", name: " Örnek ", action: "open-url", url: "https://example.com" };
  assert.deepEqual(validateShortcut(valid), { ...valid, name: "Örnek", url: "https://example.com/" });
  for (const url of ["javascript:alert(1)", "file:///C:/test", "chrome://settings", "https://user:pass@example.com", "invalid"]) {
    assert.throws(() => validateShortcut({ ...valid, url }));
  }
  assert.throws(() => validateShortcut({ ...valid, command: "previous-tab" }));
  assert.throws(() => validateShortcut({ ...valid, name: " " }));
  assert.throws(() => validateShortcut({ ...valid, action: "toString" }));
  assert.deepEqual(normalizeShortcuts([valid, valid, { ...valid, command: "custom-9" }]), [validateShortcut(valid)]);
  assert.equal(CUSTOM_COMMANDS.length, 8);
});

test("repeated tab activations do not destroy the previous tab", () => {
  const first = recordActivation({}, { tabId: 2, windowId: 1 });
  assert.equal(recordActivation(first, { tabId: 2, windowId: 1 }), first);
  const second = recordActivation(first, { tabId: 3, windowId: 1 });
  assert.deepEqual(recordActivation(second, { tabId: 8, windowId: 2 }), {
    1: { current: 3, previous: 2 }, 2: { current: 8, previous: null }
  });
});

test("native command toggles tabs per window, survives worker restart and stops when passive", async () => {
  const events = {};
  const local = {};
  const session = {};
  let writes = 0;
  let queries = 0;
  let created = 0;
  let duplicated;
  let typing = false;
  let customBinding = "";
  let pageFocused = true;
  let inspectionFails = false;
  let inspections = 0;
  const tabs = new Map([
    [2, { id: 2, windowId: 1, index: 0, active: true }], [3, { id: 3, windowId: 1, index: 1, active: false }],
    [8, { id: 8, windowId: 2, index: 0, active: true }], [9, { id: 9, windowId: 2, index: 1, active: false }]
  ]);
  const event = key => ({ addListener(fn) { events[key] = fn; } });
  const area = data => ({ async get(key) { return { [key]: structuredClone(data[key]) }; }, async set(value) { writes++; Object.assign(data, structuredClone(value)); } });
  globalThis.chrome = {
    runtime: { id: "test", onStartup: event("startup"), onInstalled: event("installed"), onMessage: event("message"), getContexts: async () => [], getURL: name => `chrome-extension://test/${name}` },
    storage: { local: area(local), session: area(session), onChanged: event("storage") },
    commands: { onCommand: event("command"), async getAll() { return [{ name: "previous-tab", shortcut: "Ctrl+Q" }, { name: "custom-1", shortcut: customBinding }]; } },
    scripting: { async executeScript() { inspections++; if (inspectionFails) throw new Error("Cannot access page"); return [{ frameId: 0, result: { focused: pageFocused, typing } }]; } },
    tabs: {
      onActivated: event("activated"), onReplaced: event("replaced"), onUpdated: event("updated"), onRemoved: event("removed"),
      async query(filter) { queries++; return [...tabs.values()].filter(tab => (!filter.active || tab.active) && (filter.windowId === undefined || tab.windowId === filter.windowId) && (!filter.currentWindow || tab.windowId === 1)); },
      async get(id) { if (!tabs.has(id)) throw new Error("Closed"); return { ...tabs.get(id) }; },
      async update(id, value) {
        if (value.active) for (const tab of tabs.values()) if (tab.windowId === tabs.get(id).windowId) tab.active = tab.id === id;
        events.activated({ tabId: id, windowId: tabs.get(id).windowId });
        return { ...tabs.get(id) };
      },
      async create() { created++; }, async duplicate(id) { duplicated = id; }
    }
  };
  try {
    await import("../background.js?shortcuts-test");
    const call = (target, type, extra = {}) => new Promise(resolve => events.message({ target, type, ...extra }, { id: "test" }, resolve));
    const flush = () => call("modules-background", "modules:get");
    const emitCommand = async (command, tabId = 3) => { events.command(command, tabs.get(tabId)); await flush(); await flush(); };
    const activate = async id => { await chrome.tabs.update(id, { active: true }); await flush(); };
    const initial = (await flush()).layout;
    const idleWrites = writes;
    events.activated({ tabId: 3, windowId: 1 });
    await emitCommand("previous-tab");
    assert.equal(writes, idleWrites);
    assert.equal(queries, 0);
    assert.equal((await call("shortcuts-background", "shortcuts:get")).ok, false);
    await call("modules-background", "modules:set", { layout: { active: [...initial.active, "shortcuts"], passive: initial.passive.filter(id => id !== "shortcuts") } });
    assert.deepEqual(session[TAB_HISTORY_KEY][1], { current: 2, previous: null });
    const initialConditions = (await call("shortcuts-background", "shortcuts:get")).state.conditions;
    assert.equal(initialConditions["previous-tab"], "always");
    assert.equal(initialConditions["tab-left"], "not-typing");
    await activate(3);
    typing = true;
    await emitCommand("tab-left", 3);
    assert.equal(tabs.get(3).active, true);
    typing = false;
    await emitCommand("tab-left", 3);
    assert.equal(tabs.get(2).active, true);
    await emitCommand("tab-left", 2); // No wrap-around at the left edge.
    assert.equal(tabs.get(2).active, true);
    typing = true;
    await emitCommand("tab-right", 2);
    assert.equal(tabs.get(2).active, true);
    typing = false;
    await emitCommand("tab-right", 2);
    assert.equal(tabs.get(3).active, true);
    await emitCommand("tab-right", 3);
    assert.equal(tabs.get(3).active, true);
    typing = true;
    const setCondition = (command, skipWhenTyping) => call("shortcuts-background", "shortcuts:condition", { command, skipWhenTyping });
    assert.equal((await setCondition("custom-8", true)).ok, false);
    assert.equal((await setCondition("previous-tab", "true")).ok, false);
    await setCondition("previous-tab", true);
    await emitCommand("previous-tab", 3);
    assert.equal(tabs.get(3).active, true);
    assert.equal(local[SHORTCUT_CONDITIONS_KEY]["previous-tab"], "not-typing");
    await setCondition("previous-tab", false);
    const beforeAlways = inspections;
    await emitCommand("previous-tab");
    assert.equal(inspections, beforeAlways);
    assert.equal(tabs.get(2).active, true);
    typing = false;
    await emitCommand("previous-tab", 2);
    assert.equal(tabs.get(3).active, true);
    for (let index = 0; index < 6; index++) await emitCommand("previous-tab", index % 2 ? 2 : 3);
    assert.equal(tabs.get(3).active, true);
    await activate(9);
    await emitCommand("previous-tab", 9);
    assert.equal(tabs.get(8).active, true);
    assert.equal(tabs.get(3).active, true);
    await import("../background.js?shortcuts-restarted");
    await emitCommand("previous-tab", 3);
    assert.equal(tabs.get(2).active, true);
    tabs.delete(3);
    events.removed(3, { windowId: 1, isWindowClosing: false });
    await flush();
    await emitCommand("previous-tab", 2);
    assert.equal(tabs.get(2).active, true);
    assert.equal(session[TAB_HISTORY_KEY][1].previous, null);
    const add = (command, action) => call("shortcuts-background", "shortcuts:add", { shortcut: { command, name: "Deneme", action } });
    assert.equal((await add("custom-1", "new-tab")).ok, true);
    assert.equal((await add("custom-1", "new-tab")).ok, false);
    customBinding = "Ctrl+Yukarı Ok"; typing = true;
    await emitCommand("custom-1", 2);
    assert.equal(created, 0);
    typing = false;
    await emitCommand("custom-1", 2);
    assert.equal(created, 1);
    await setCondition("custom-1", false);
    typing = true;
    const beforeOverride = inspections;
    await emitCommand("custom-1", 2);
    assert.equal(created, 2);
    assert.equal(inspections, beforeOverride);
    customBinding = "Ctrl+K";
    await setCondition("custom-1", true);
    await emitCommand("custom-1", 2);
    assert.equal(created, 2);
    typing = false; pageFocused = false;
    await emitCommand("custom-1", 2);
    assert.equal(created, 2);
    pageFocused = true; inspectionFails = true;
    await emitCommand("custom-1", 2);
    assert.equal(created, 2);
    inspectionFails = false;
    await emitCommand("custom-1", 2);
    assert.equal(created, 3);
    await import("../background.js?shortcut-conditions-restarted");
    assert.equal((await call("shortcuts-background", "shortcuts:get")).state.conditions["custom-1"], "not-typing");
    typing = true;
    await emitCommand("custom-1", 2);
    assert.equal(created, 3);
    typing = false;
    assert.equal((await add("custom-2", "duplicate-tab")).ok, true);
    const onlyTyping = await call("shortcuts-background", "shortcuts:condition", { command: "custom-2", condition: "typing" });
    assert.equal(onlyTyping.ok, true);
    assert.equal(onlyTyping.state.conditions["custom-2"], "typing");
    await emitCommand("custom-2", 2);
    assert.equal(duplicated, undefined);
    typing = true;
    await emitCommand("custom-2", 2);
    assert.equal(duplicated, 2);
    duplicated = undefined;
    typing = null; // An inaccessible focused frame is unknown, not a confirmed editor.
    await emitCommand("custom-2", 2);
    assert.equal(duplicated, undefined);
    typing = true; pageFocused = false;
    await emitCommand("custom-2", 2);
    assert.equal(duplicated, undefined);
    pageFocused = true; inspectionFails = true;
    await emitCommand("custom-2", 2);
    assert.equal(duplicated, undefined);
    inspectionFails = false; typing = false;
    assert.equal((await call("shortcuts-background", "shortcuts:condition", { command: "custom-2", condition: "invalid" })).ok, false);
    await call("shortcuts-background", "shortcuts:remove", { command: "custom-1" });
    await emitCommand("custom-1", 2);
    assert.equal(created, 3);
    assert.equal(Object.hasOwn(local[SHORTCUT_CONDITIONS_KEY], "custom-1"), false);
    assert.equal(local[SHORTCUTS_KEY].length, 1);
    tabs.set(10, { id: 10, windowId: 1, active: false });
    await activate(10);
    tabs.set(11, { id: 11, windowId: 1, active: true }); tabs.delete(10);
    events.replaced(11, 10); await flush();
    assert.equal(session[TAB_HISTORY_KEY][1].current, 11);
    await call("modules-background", "modules:set", { layout: initial });
    assert.deepEqual(session[TAB_HISTORY_KEY], {});
    const passiveWrites = writes;
    events.activated({ tabId: 2, windowId: 1 });
    await emitCommand("custom-2", 2);
    await emitCommand("previous-tab", 11);
    assert.equal(writes, passiveWrites);
    assert.equal(local[SHORTCUTS_KEY].length, 1);
    assert.equal(tabs.get(11).active, true);
  } finally { delete globalThis.chrome; }
});
