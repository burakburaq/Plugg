import test from "node:test";
import assert from "node:assert/strict";
import { BANDS, PRESETS, normalizeSettings } from "../modules/audio-settings.js";

test("audio settings bound amplification/EQ and retain mute", () => {
  assert.equal(normalizeSettings({ gain: 0 }).gain, 0);
  assert.equal(normalizeSettings({ gain: 600 }).gain, 6);
  assert.equal(normalizeSettings({ gain: -1 }).gain, 0);
  assert.equal(normalizeSettings({ gain: "bad" }).gain, 1);
  assert.deepEqual(normalizeSettings({ eq: [30, -30, NaN] }).eq, [12, -12, 0, 0, 0, 0]);
  for (const [preset, eq] of Object.entries(PRESETS)) {
    assert.equal(eq.length, BANDS.length);
    assert.deepEqual(normalizeSettings({ gain: 1, eq, preset }).eq, eq);
  }
});

test("background shares capture startup and isolates tab state", async () => {
  let listener;
  let tabClosed;
  let documentOpen = false;
  let created = 0;
  let captures = 0;
  let engineChecks = 0;
  const sessions = new Map();
  const stored = {};
  const temporary = {};
  const area = data => ({ async get(key) { return { [key]: data[key] }; }, async set(values) { Object.assign(data, values); } });
  globalThis.chrome = {
    storage: { local: area(stored), session: area(temporary), onChanged: { addListener() {} } },
    runtime: {
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} },
      id: "test",
      getURL: file => `chrome-extension://test/${file}`,
      getContexts: async () => documentOpen ? [{}] : [],
      onMessage: { addListener(fn) { listener = fn; } },
      async sendMessage(message) {
        if (message.type === "audio:ping") {
          engineChecks++;
          if (engineChecks <= 3) assert.equal(captures, 0);
          return engineChecks < 3 ? undefined : { ok: true };
        }
        const { tabId } = message;
        if (message.type === "audio:start") sessions.set(tabId, { active: true, tabId, ...message.settings });
        if (message.type === "audio:set" && sessions.has(tabId)) Object.assign(sessions.get(tabId), message.settings);
        if (message.type === "audio:stop") sessions.delete(tabId);
        if (message.type === "audio:status") return { ok: true, state: { activeCount: sessions.size } };
        if (message.type === "audio:stop-all") { sessions.clear(); return { ok: true, state: { activeCount: 0 } }; }
        return { ok: true, state: sessions.get(tabId) || { active: false, tabId, gain: 1, eq: BANDS.map(() => 0), preset: "flat" } };
      }
    },
    offscreen: { async createDocument() { created++; documentOpen = true; }, async closeDocument() { documentOpen = false; } },
    tabCapture: { async getMediaStreamId({ targetTabId }) { captures++; return `stream-${targetTabId}`; } },
    commands: { onCommand: { addListener() {} } },
    tabs: { onActivated: { addListener() {} }, onReplaced: { addListener() {} }, onRemoved: { addListener(fn) { tabClosed = fn; } }, onUpdated: { addListener() {} } }
  };
  try {
    await import("../background.js");
    const call = (type, tabId, settings) => new Promise(resolve => listener({ target: "audio-background", type, tabId, settings }, { id: "test" }, resolve));
    const running = () => new Promise(resolve => listener({ target: "modules-background", type: "modules:status" }, { id: "test" }, resolve));
    assert.deepEqual((await running()).state, { volume: false, font: false, drawing: false, dark: false, editor: false, video: false });
    assert.equal(created, 0);
    const before = await call("audio:get", 1);
    assert.equal(before.state.active, false);
    assert.equal(created, 0);
    const [first, second] = await Promise.all([call("audio:start", 1, { gain: 6, eq: PRESETS.bass, preset: "bass" }), call("audio:start", 1, { gain: 6 })]);
    assert.equal(first.state.gain, 6);
    assert.equal(second.state.active, true);
    assert.equal(captures, 1);
    assert.equal(created, 1);
    assert.equal(engineChecks, 4);
    await call("audio:start", 2, { gain: 2, preset: "flat" });
    await call("audio:stop", 1);
    assert.deepEqual((await running()).state, { volume: true, font: false, drawing: false, dark: false, editor: false, video: false });
    assert.equal((await call("audio:get", 1)).state.active, false);
    assert.equal((await call("audio:get", 2)).state.gain, 2);
    await call("audio:set", 2, { gain: 600, eq: [100], preset: "custom" });
    assert.equal(sessions.get(2).gain, 6);
    assert.equal(sessions.get(2).eq[0], 12);
    assert.equal((await call("audio:start", -1)).ok, false);
    assert.equal(listener({ target: "audio-background", type: "audio:start", tabId: 2 }, { id: "other" }, () => assert.fail()), undefined);
    tabClosed(2);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sessions.size, 0);
    assert.deepEqual((await running()).state, { volume: false, font: false, drawing: false, dark: false, editor: false, video: false });
  } finally { delete globalThis.chrome; }
});
