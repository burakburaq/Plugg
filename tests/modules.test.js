import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LAYOUT, normalizeLayout, moveModule } from "../modules/module-layout.js";

test("layout preserves choices, defaults only missing data and keeps unlisted modules passive", () => {
  assert.deepEqual(normalizeLayout(), DEFAULT_LAYOUT);
  assert.deepEqual(normalizeLayout({ active: [], passive: ["font", "qr", "volume", "manager"] }), { active: [], passive: ["font", "qr", "volume", "manager", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video"] });
  assert.deepEqual(normalizeLayout({ active: ["font", "font", "unknown"], passive: ["font", "manager"] }), { active: ["font"], passive: ["manager", "volume", "qr", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video"] });
});

test("drop positions support reordering and moving to an empty group without duplicating modules", () => {
  const reordered = moveModule(DEFAULT_LAYOUT, "manager", "active", 2);
  assert.deepEqual(reordered.active, ["volume", "manager"]);
  assert.deepEqual(moveModule(reordered, "manager", "active", 0).active, DEFAULT_LAYOUT.active);
  const passive = moveModule(DEFAULT_LAYOUT, "volume", "passive", 1);
  assert.deepEqual(passive, { active: ["manager"], passive: ["qr", "volume", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video"] });
  const allPassive = moveModule(passive, "manager", "passive", 3);
  assert.deepEqual(moveModule(allPassive, "font", "active", 0), { active: ["font"], passive: ["qr", "volume", "manager", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video"] });
  assert.deepEqual(DEFAULT_LAYOUT, { active: ["manager", "volume"], passive: ["qr", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "editor", "video"] });
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
