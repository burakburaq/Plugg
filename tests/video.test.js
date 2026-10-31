import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVideoSettings, VIDEO_DEFAULTS, VIDEO_SITES_KEY } from "../components/modules/video-tools/video-settings.js";
import { handleVideo, stopVideos, videoRunning } from "../components/modules/video-tools/video-background.js";

test("video settings reject damaged values and bound geometry and image controls", () => {
  assert.deepEqual(normalizeVideoSettings(null), VIDEO_DEFAULTS);
  const next = normalizeVideoSettings({ enabled: true, fill: "false", zoom: Infinity, stretchX: 999, offsetY: -500, brightness: -1, saturation: NaN, sharpness: 4, hue: 400, temperature: 80, unexpected: "discard" });
  assert.equal(next.enabled, true); assert.equal(next.fill, true); assert.equal(next.zoom, 1);
  assert.equal(next.stretchX, 2); assert.equal(next.offsetY, -100); assert.equal(next.brightness, .25);
  assert.equal(next.saturation, 1); assert.equal(next.sharpness, 1);
  assert.equal(Object.hasOwn(next, "hue"), false); assert.equal(Object.hasOwn(next, "temperature"), false);
  assert.equal(Object.hasOwn(next, "unexpected"), false);
});

test("video lifecycle is manual, preferences are origin-specific, and stop cleans tracked tabs", async () => {
  const local = {}, session = {}, live = new Set();
  const injected = [], stopped = [];
  const area = data => ({ async get(key) { return { [key]: structuredClone(data[key]) }; }, async set(patch) { Object.assign(data, structuredClone(patch)); } });
  globalThis.chrome = {
    storage: { local: area(local), session: area(session) },
    runtime: { async sendMessage() {} },
    tabs: {
      async get(id) { return { id, url: id === 99 ? "chrome://settings" : `https://${id === 2 ? "other" : "example"}.com/watch` }; },
      async sendMessage(id, message) {
        if (message.type === "video:stop") { stopped.push(id); live.delete(id); }
        return { active: live.has(id) };
      }
    },
    scripting: { async executeScript(options) { injected.push(options); live.add(options.target.tabId); return [{ frameId: 0, result: { active: true } }]; } }
  };
  try {
    assert.deepEqual(await handleVideo({ type: "video:get", tabId: 1 }), { active: false });
    assert.equal(injected.length, 0);
    await handleVideo({ type: "video:start", tabId: 1 });
    const sender = { tab: { id: 1, url: "https://example.com/watch" }, url: "https://example.com/watch", frameId: 0 };
    await handleVideo({ type: "video:save", remember: true, settings: { zoom: 2, brightness: 1.2 } }, sender);
    await assert.rejects(handleVideo({ type: "video:save", remember: true }, { ...sender, frameId: 1 }));
    await handleVideo({ type: "video:start", tabId: 2 });
    assert.equal(injected.at(-1).args[0].zoom, 1); assert.equal(injected.at(-1).args[1], false);
    await stopVideos(1);
    assert.equal(live.has(2), true);
    await handleVideo({ type: "video:start", tabId: 1 });
    assert.equal(injected.at(-1).args[0].zoom, 2); assert.equal(injected.at(-1).args[1], true);
    assert.equal(await videoRunning(), true);
    await handleVideo({ type: "video:save", remember: false }, sender);
    assert.equal(Object.hasOwn(local[VIDEO_SITES_KEY], "https://example.com"), false);
    await assert.rejects(handleVideo({ type: "video:start", tabId: 99 }));
    await stopVideos();
    assert.equal(await videoRunning(), false); assert.deepEqual(session.videoToolsTabs, []);
    assert.deepEqual(stopped.sort(), [1, 1, 2]);
    await assert.rejects(handleVideo({ type: "video:save", remember: true, settings: {} }, sender));
  } finally { delete globalThis.chrome; }
});
