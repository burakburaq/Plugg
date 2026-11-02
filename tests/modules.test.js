import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LAYOUT, normalizeLayout, moveModule } from "../modules/module-layout.js";
import { MENU_THEMES, normalizeMenuTheme, resolveTileVariant } from "../components/menuThemes.js";
import { radiusEditor } from "../components/modules/themes/radius-editor.js";
import { hasRadiusChanges, loadRadiusEntries, mergeRadiusEntries, radiusStorageKey } from "../components/modules/themes/radius-storage.js";

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
  assert.deepEqual(normalizeLayout({ active: [], passive: ["font", "qr", "volume", "manager"] }), { active: [], passive: ["font", "qr", "volume", "manager", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video", "gestureflow", "themes"] });
  assert.deepEqual(normalizeLayout({ active: ["font", "font", "unknown"], passive: ["font", "manager"] }), { active: ["font"], passive: ["manager", "volume", "qr", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video", "gestureflow", "themes"] });
});

test("drop positions support reordering and moving to an empty group without duplicating modules", () => {
  const reordered = moveModule(DEFAULT_LAYOUT, "manager", "active", 2);
  assert.deepEqual(reordered.active, ["volume", "manager", "themes"]);
  assert.deepEqual(moveModule(reordered, "manager", "active", 0).active, DEFAULT_LAYOUT.active);
  const passive = moveModule(DEFAULT_LAYOUT, "volume", "passive", 1);
  assert.deepEqual(passive, { active: ["manager", "themes"], passive: ["qr", "volume", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video", "gestureflow"] });
  const allPassive = moveModule(passive, "manager", "passive", 3);
  assert.deepEqual(moveModule(allPassive, "font", "active", 0), { active: ["font", "themes"], passive: ["qr", "volume", "manager", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video", "gestureflow"] });
  assert.deepEqual(DEFAULT_LAYOUT, { active: ["manager", "volume", "themes"], passive: ["qr", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video", "gestureflow"] });
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
  const saved = {};
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
    assert.deepEqual((await call("modules-background", "modules:status")).state, { volume: false, font: true, drawing: false, dark: false, editor: false, video: false });
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
