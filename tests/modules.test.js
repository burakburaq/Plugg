import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LAYOUT, normalizeLayout, moveModule } from "../src/modules/module-layout.js";
import { MENU_THEMES, normalizeMenuTheme, resolveTileVariant } from "../src/components/menuThemes.js";
import { radiusEditor } from "../src/components/modules/themes/radius-editor.js";
import { hasRadiusChanges, loadRadiusEntries, mergeRadiusEntries, radiusStorageKey } from "../src/components/modules/themes/radius-storage.js";
import { textEditor } from "../src/components/modules/themes/text-editor.js";
import { hasTextChanges, mergeTextEntries, textStorageKey } from "../src/components/modules/themes/text-storage.js";
import { startWhatsThisPicker, stopWhatsThisPicker } from "../src/components/modules/whats-this/picker-manager.js";
import { DEFAULT_FLAGS, resolveFlags, validateFlags, filterFlaggedLayout, mergeFlaggedLayout, currentFlags, refreshFlags } from "../src/modules/feature-flags.js";

test("feature flag refresh keeps the last valid configuration and honors the selected channel", async () => {
  const oldChrome = globalThis.chrome, oldFetch = globalThis.fetch;
  const config = structuredClone(DEFAULT_FLAGS);
  config.stable["module.darkMode"] = 0;
  config.beta["module.darkMode"] = 1;
  const storage = { featureFlagsChannel: "stable" };
  globalThis.chrome = { storage: { local: {
    get: async key => ({ [key]: storage[key] }),
    set: async data => Object.assign(storage, data)
  } } };
  globalThis.fetch = async () => ({ ok: true, json: async () => config });
  try {
    await refreshFlags(true);
    assert.equal((await currentFlags())["module.darkMode"], 0);
    storage.featureFlagsChannel = "beta";
    assert.equal((await currentFlags())["module.darkMode"], 1);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ stable: {}, beta: {} }) });
    await assert.rejects(refreshFlags(true));
    assert.equal((await currentFlags())["module.darkMode"], 1);
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(refreshFlags(true));
    assert.equal((await currentFlags())["module.darkMode"], 1);
  } finally {
    if (oldChrome === undefined) delete globalThis.chrome; else globalThis.chrome = oldChrome;
    globalThis.fetch = oldFetch;
  }
});

test("feature flags hide modules without losing their layout and fall back for unavailable versions", () => {
  const flags = resolveFlags(DEFAULT_FLAGS, "beta");
  assert.equal(flags["module.whatsThis"], 1);
  assert.equal(flags["module.fontFinder"], 0);
  const before = { active: ["manager", "font", "volume"], passive: ["color", "whatsthis"] };
  const visible = filterFlaggedLayout(before, flags);
  assert.deepEqual(visible, { active: ["manager", "volume"], passive: ["whatsthis"] });
  assert.deepEqual(mergeFlaggedLayout(before, { active: ["whatsthis", "manager", "volume"], passive: [] }, flags),
    { active: ["whatsthis", "font", "manager", "volume"], passive: ["color"] });
  assert.equal(validateFlags({ stable: { "module.whatsThis": -1 }, beta: {} }), null);
  assert.deepEqual(resolveFlags(null), resolveFlags(DEFAULT_FLAGS));
});

test("Whats This stops the previous tab before starting another picker", async () => {
  const previousChrome = globalThis.chrome;
  const state = {}, actions = [];
  globalThis.chrome = {
    storage: { session: { get: async key => ({ [key]: state[key] }), set: async values => Object.assign(state, values) } },
    tabs: {
      get: async tabId => ({ id: tabId, active: true, windowId: 1 }),
      sendMessage: async tabId => { actions.push(`stop:${tabId}`); return { ok: true }; },
      captureVisibleTab: async () => "image"
    },
    scripting: { executeScript: async ({ target, func }) => { actions.push(`${func.name}:${target.tabId}`); } }
  };
  try {
    await startWhatsThisPicker(1, "font");
    await startWhatsThisPicker(2, "color");
    assert.ok(actions.indexOf("stop:1") < actions.indexOf("installPickerControl:2"));
    assert.deepEqual(state.whatsThisActivePicker, { tabId: 2, mode: "color" });
    await stopWhatsThisPicker(1);
    assert.deepEqual(state.whatsThisActivePicker, { tabId: 2, mode: "color" });
    await stopWhatsThisPicker();
    assert.equal(state.whatsThisActivePicker, null);
    assert.equal(actions.at(-1), "stop:2");
  } finally { if (previousChrome === undefined) delete globalThis.chrome; else globalThis.chrome = previousChrome; }
});

test("text changes are independent of radius settings and require matching original text", async () => {
  assert.equal(await textStorageKey("https://example.com/a"), await textStorageKey("https://example.com/b"));
  assert.notEqual(await textStorageKey("https://example.com/a"), await radiusStorageKey("https://example.com/a"));
  const entries = [{ selector: "#title", original: "Original", text: "Edited" }];
  assert.equal(hasTextChanges(entries, []), true);
  assert.equal(hasTextChanges(entries, mergeTextEntries([], entries)), false);
  const savedGlobals = { document: globalThis.document, location: globalThis.location, MutationObserver: globalThis.MutationObserver };
  const element = { isConnected: true, children: [], textContent: "Different" };
  globalThis.location = { href: "https://example.com/a" };
  globalThis.document = { documentElement: {}, querySelector: () => element };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  try {
    textEditor("restore", entries, location.href);
    assert.equal(element.textContent, "Different");
    element.textContent = "Original";
    textEditor("restore", entries, location.href);
    assert.equal(element.textContent, "Edited");
    assert.deepEqual(textEditor("snapshot").entries, entries);
    textEditor("reset");
    assert.equal(element.textContent, "Original");
  } finally {
    delete globalThis.__pluggTextChanges;
    for (const [key, value] of Object.entries(savedGlobals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test("radius changes are shared across a site and reset restores the original styles", async () => {
  assert.equal(await radiusStorageKey("https://example.com/a"), await radiusStorageKey("https://example.com/b"));
  assert.notEqual(await radiusStorageKey("https://example.com/a"), await radiusStorageKey("https://other.com/a"));
  const previous = [{ selector: "#footer", radius: "10px" }, { selector: "#header", radius: "8px" }];
  const updates = [{ selector: "#footer", radius: "20px" }];
  assert.equal(hasRadiusChanges(updates, previous), true);
  assert.deepEqual(mergeRadiusEntries(previous, updates), [{ selector: "#footer", radius: "20px" }, { selector: "#header", radius: "8px" }]);
  assert.equal(hasRadiusChanges(updates, mergeRadiusEntries(previous, updates)), false);
  const savedGlobals = { document: globalThis.document, location: globalThis.location, MutationObserver: globalThis.MutationObserver };
  const properties = new Map([["border-top-left-radius", { value: "5px", priority: "" }]]);
  const element = { isConnected: true, style: {
    getPropertyValue: name => properties.get(name)?.value || "",
    getPropertyPriority: name => properties.get(name)?.priority || "",
    setProperty: (name, value, priority) => properties.set(name, { value, priority }),
    removeProperty: name => properties.delete(name)
  } };
  globalThis.location = { href: "https://example.com/a" };
  globalThis.document = { documentElement: {}, querySelector: selector => selector === "#item" ? element : null };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  try {
    const entries = [{ selector: "#item", radius: "30px" }];
    assert.equal(radiusEditor("restore", entries, "https://example.com/b").restored, false);
    assert.equal(radiusEditor("restore", entries, location.href).restored, true);
    assert.deepEqual(radiusEditor("snapshot").entries, entries);
    assert.equal(properties.get("border-radius").value, "30px");
    radiusEditor("reset");
    assert.equal(properties.get("border-top-left-radius").value, "5px");
    assert.deepEqual(radiusEditor("snapshot").entries, []);
  } finally {
    delete globalThis.__pluggRadiusChanges;
    for (const [key, value] of Object.entries(savedGlobals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test("old page-specific radius settings migrate without overwriting site settings", async () => {
  const url = "https://example.com/old";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const oldKey = `themes:radius:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
  const siteKey = await radiusStorageKey(url);
  const stored = { [oldKey]: [{ selector: "#footer", radius: "4px" }], [siteKey]: [{ selector: "#footer", radius: "8px" }] };
  const previousChrome = globalThis.chrome;
  globalThis.chrome = { storage: { local: {
    get: async keys => Object.fromEntries(keys.filter(key => key in stored).map(key => [key, stored[key]])),
    set: async data => Object.assign(stored, data),
    remove: async key => { delete stored[key]; }
  } } };
  try {
    assert.deepEqual((await loadRadiusEntries(url)).entries, [{ selector: "#footer", radius: "8px" }]);
    assert.equal(oldKey in stored, false);
  } finally { if (previousChrome === undefined) delete globalThis.chrome; else globalThis.chrome = previousChrome; }
});

test("theme migration and picture policy preserve small card variants", () => {
  assert.equal(normalizeMenuTheme("theme-1"), "dull");
  assert.equal(normalizeMenuTheme("theme-2"), "win8");
  assert.equal(normalizeMenuTheme("unknown"), "dull");
  assert.equal(resolveTileVariant("picture", MENU_THEMES.dull.allowPictures, true), "icon");
  assert.equal(resolveTileVariant("picture-tiny", MENU_THEMES.dull.allowPictures, true), "icon-tiny");
  assert.equal(resolveTileVariant("icon-tiny", MENU_THEMES.win8.allowPictures, true), "picture-tiny");
  assert.equal(resolveTileVariant("picture", MENU_THEMES.win8.allowPictures, false), "icon");
});

test("layout preserves choices, defaults only missing data and keeps unlisted modules passive", () => {
  assert.deepEqual(normalizeLayout(), DEFAULT_LAYOUT);
  const migrated = normalizeLayout({ active: ["editor"], passive: ["themes"] });
  assert.deepEqual(migrated.active, ["themes"]);
  assert.equal(migrated.passive.includes("editor"), false);
  assert.deepEqual(normalizeLayout({ active: [], passive: ["font", "qr", "volume", "manager"] }), { active: [], passive: ["font", "qr", "volume", "manager", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow", "themes", "whatsthis"] });
  assert.deepEqual(normalizeLayout({ active: ["font", "font", "unknown"], passive: ["font", "manager"] }), { active: ["font"], passive: ["manager", "volume", "qr", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow", "themes", "whatsthis"] });
});

test("drop positions support reordering and moving to an empty group without duplicating modules", () => {
  const reordered = moveModule(DEFAULT_LAYOUT, "manager", "active", 2);
  assert.deepEqual(reordered.active, ["volume", "manager", "themes"]);
  assert.deepEqual(moveModule(reordered, "manager", "active", 0).active, DEFAULT_LAYOUT.active);
  const passive = moveModule(DEFAULT_LAYOUT, "volume", "passive", 1);
  assert.deepEqual(passive, { active: ["manager", "themes"], passive: ["qr", "volume", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow", "whatsthis"] });
  const allPassive = moveModule(passive, "manager", "passive", 3);
  assert.deepEqual(moveModule(allPassive, "font", "active", 0), { active: ["font", "themes"], passive: ["qr", "volume", "manager", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow", "whatsthis"] });
  assert.deepEqual(DEFAULT_LAYOUT, { active: ["manager", "volume", "themes"], passive: ["qr", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow", "whatsthis"] });
});

test("passivation waits for pending starts, stops all tabs and blocks further starts", async () => {
  let listener;
  let onTabRemoved;
  let onTabUpdated;
  let documentOpen = false;
  let captureStarted;
  let resumeCapture;
  const capturing = new Promise(resolve => { captureStarted = resolve; });
  const deferredCapture = new Promise(resolve => { resumeCapture = resolve; });
  const testFlags = structuredClone(DEFAULT_FLAGS);
  testFlags.stable["module.fontFinder"] = 1;
  const saved = { featureFlagsCache: { config: testFlags } };
  const sessionSaved = {};
  const sessions = new Map();
  const fontTabs = new Set();
  let closed = 0;
  let captures = 0;
  const storageArea = data => ({ async get(key) { return { [key]: structuredClone(data[key]) }; }, async set(values) { Object.assign(data, structuredClone(values)); } });
  globalThis.chrome = {
    storage: { local: storageArea(saved), session: storageArea(sessionSaved), onChanged: { addListener() {} } },
    runtime: {
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} },
      id: "test", getURL: file => `chrome-extension://test/${file}`,
      getContexts: async () => documentOpen ? [{}] : [],
      onMessage: { addListener(fn) { listener = fn; } },
      async sendMessage(message) {
        if (message.type === "audio:ping") return { ok: true };
        if (message.type === "audio:start") sessions.set(message.tabId, { active: true, tabId: message.tabId, ...message.settings });
        if (message.type === "audio:stop-all") sessions.clear();
        if (message.type === "audio:stop") sessions.delete(message.tabId);
        if (["audio:status", "audio:stop-all"].includes(message.type)) return { ok: true, state: { activeCount: sessions.size } };
        return { ok: true, state: sessions.get(message.tabId) || { active: false, tabId: message.tabId, gain: 1, eq: [0,0,0,0,0,0], preset: "flat" } };
      }
    },
    offscreen: { async createDocument() { documentOpen = true; }, async closeDocument() { closed++; documentOpen = false; } },
    tabCapture: { async getMediaStreamId() { captures++; captureStarted(); await deferredCapture; return "stream"; } },
    commands: { onCommand: { addListener() {} } },
    tabs: { onActivated: { addListener() {} }, onReplaced: { addListener() {} }, onRemoved: { addListener(fn) { onTabRemoved = fn; } }, onUpdated: { addListener(fn) { onTabUpdated = fn; } }, async sendMessage(tabId, message) {
      if (message.type === "font:stop") fontTabs.delete(tabId);
      return { active: fontTabs.has(tabId) };
    } },
    scripting: { async executeScript({ target, args }) {
      if (args[0] === "start") fontTabs.add(target.tabId);
      return [{ frameId: 0, result: { active: fontTabs.has(target.tabId) } }];
    } }
  };
  try {
    await import("../background.js?modules-test");
    const call = (target, type, extra = {}) => new Promise(resolve => listener({ target, type, ...extra }, { id: "test" }, resolve));
    const startFont = async tabId => {
      assert.equal((await call("font-background", "font:prepare", { tabId, connectionName: "font-finder:test" })).ok, true);
      fontTabs.add(tabId); // The page starts only once its popup connection arrives.
      await new Promise(resolve => listener({ target: "font-background", type: "font:started" }, { id: "test", tab: { id: tabId }, frameId: 0 }, resolve));
    };
    assert.deepEqual((await call("modules-background", "modules:get")).layout, DEFAULT_LAYOUT);
    assert.deepEqual(saved.moduleLayout, DEFAULT_LAYOUT);
    const saveColor = target => new Promise(resolve => listener({ target, type: "color:save", color: "#123456" }, { id: "test", tab: { id: 1 } }, resolve));
    assert.equal((await saveColor("whats-this-color-background")).ok, false);
    await call("modules-background", "modules:set", { layout: { active: ["manager", "volume", "whatsthis"], passive: ["color"] } });
    assert.equal((await saveColor("whats-this-color-background")).ok, true);
    assert.equal(saved.colorHistory[0].color, "#123456");
    assert.equal((await saveColor("color-background")).ok, false);
    assert.equal((await call("font-background", "font:start", { tabId: 3 })).ok, false);
    const starting = call("audio-background", "audio:start", { tabId: 1, settings: { gain: 6, preset: "flat" } });
    await capturing;
    const disabling = call("modules-background", "modules:set", { layout: { active: ["manager"], passive: ["volume", "qr", "font"] } });
    resumeCapture();
    assert.equal((await starting).state.active, true);
    assert.equal((await disabling).ok, true);
    assert.equal(sessions.size, 0);
    assert.equal(documentOpen, false);
    assert.equal(closed, 1);
    assert.equal((await call("audio-background", "audio:start", { tabId: 2 })).ok, false);
    assert.equal((await call("audio-background", "audio:set", { tabId: 2 })).ok, false);
    assert.equal(captures, 1);
    await call("modules-background", "modules:set", { layout: { active: ["font", "manager"], passive: ["volume", "qr"] } });
    assert.equal((await call("font-background", "font:prepare", { tabId: 3, connectionName: "font-finder:test" })).state.active, false);
    assert.deepEqual(sessionSaved.fontTabIds, []);
    assert.equal((await call("font-background", "font:start", { tabId: 3 })).ok, false);
    await startFont(3);
    await startFont(4);
    assert.deepEqual(sessionSaved.fontTabIds, [3,4]);
    assert.deepEqual((await call("modules-background", "modules:status")).state, { volume: false, font: true, drawing: false, dark: false, video: false });
    fontTabs.delete(3);
    await new Promise(resolve => listener({ target: "font-background", type: "font:ended" }, { id: "test", tab: { id: 3 }, frameId: 0 }, resolve));
    assert.deepEqual(sessionSaved.fontTabIds, [4]);
    assert.equal((await call("modules-background", "modules:status")).state.font, true);
    onTabUpdated(4, { status: "loading" });
    fontTabs.delete(4);
    assert.equal((await call("modules-background", "modules:status")).state.font, false);
    assert.deepEqual(sessionSaved.fontTabIds, []);
    await startFont(3);
    fontTabs.delete(3); // Missing receiver after a page has navigated.
    assert.equal((await call("modules-background", "modules:status")).state.font, false);
    assert.deepEqual(sessionSaved.fontTabIds, []);
    await startFont(3);
    await startFont(4);
    await call("modules-background", "modules:set", { layout: { active: [], passive: ["font", "volume", "qr", "manager"] } });
    assert.equal(fontTabs.size, 0);
    assert.deepEqual(sessionSaved.fontTabIds, []);
    assert.equal((await call("font-background", "font:start", { tabId: 3 })).ok, false);
    // Simulate worker termination and resurrection; choices remain in persistent storage.
    await import("../background.js?modules-restarted-test");
    assert.deepEqual((await call("modules-background", "modules:get")).layout, saved.moduleLayout);
    assert.equal((await call("audio-background", "audio:start", { tabId: 1 })).ok, false);
    assert.equal(listener({ target: "modules-background", type: "modules:set" }, { id: "other" }, () => assert.fail()), undefined);
    onTabRemoved(3);
  } finally { delete globalThis.chrome; }
});
