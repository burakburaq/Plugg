import test from "node:test";
import assert from "node:assert/strict";
import { drawingUrlKey, normalizeDrawing } from "../src/components/modules/page-drawing/drawing-data.js";
import { handleDrawing, restoreDrawing, stopDrawings, drawingRunning, invalidateDrawingSettings } from "../src/components/modules/page-drawing/drawing-background.js";

const sample = { width: 800, height: 1600, strokes: [{ color: "#ff0000", width: 4, tool: "pen", points: [[10, 20], [30, 40]] }] };
test("drawings validate geometry and bind records to the full URL", async () => {
  assert.deepEqual(normalizeDrawing(sample), sample);
  assert.notEqual(await drawingUrlKey("https://example.com/a?x=1"), await drawingUrlKey("https://example.com/a?x=2"));
  assert.notEqual(await drawingUrlKey("https://example.com/a#one"), await drawingUrlKey("https://example.com/a#two"));
  await assert.rejects(drawingUrlKey("chrome://extensions"));
  assert.throws(() => normalizeDrawing({ ...sample, strokes: [{ ...sample.strokes[0], points: [[NaN, 1]] }] }));
  assert.throws(() => normalizeDrawing({ ...sample, strokes: [{ ...sample.strokes[0], width: 1000 }] }));
});

test("URL and custom saves survive separately; automatic restore is optional and injects only on saved URLs", async () => {
  const local = {}, session = {}, pages = new Map();
  let injections = 0, access = false;
  const urls = { 1: "https://example.com/a", 2: "https://example.com/b" };
  const area = data => ({
    async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(data[key])])); },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async remove(key) { delete data[key]; }
  });
  globalThis.chrome = {
    storage: { local: area(local), session: area(session) },
    permissions: { async contains() { return access; } },
    runtime: { async sendMessage() {} },
    tabs: { async get(id) { return { id, url: urls[id] }; }, async sendMessage(id, message) {
      if (!pages.has(id)) throw new Error("No page inspector");
      if (message.type === "draw:stop") pages.delete(id);
      return { ok: true, state: pages.get(id) || { active: false, editing: false } };
    } },
    scripting: { async executeScript({ target, args }) {
      injections++;
      pages.set(target.tabId, { active: true, editing: args[0].editing, data: args[0].data });
      return [{ result: pages.get(target.tabId) }];
    } }
  };
  invalidateDrawingSettings({ drawingAutoRestore: {} }, "local");
  const sender = { tab: { id: 1 }, frameId: 0, url: urls[1] };
  try {
    await handleDrawing({ type: "draw:save-url", data: sample }, sender);
    const urlKey = await drawingUrlKey(urls[1]);
    assert.equal(local[urlKey].strokes.length, 1);
    await handleDrawing({ type: "draw:save-custom", name: "Özel çizim", data: sample }, sender);
    const key = local.drawingCustomIndex[0].key;
    await handleDrawing({ type: "draw:save-url", data: { ...sample, strokes: [] } }, sender);
    assert.equal(local[urlKey], undefined);
    assert.deepEqual(local[key], sample);
    await handleDrawing({ type: "draw:start", tabId: 2, key }, {});
    assert.deepEqual(pages.get(2).data, sample);
    assert.equal(await drawingRunning(), true);
    await stopDrawings();
    assert.equal(pages.size, 0);
    assert.equal(await drawingRunning(), false);
    await handleDrawing({ type: "draw:save-url", data: sample }, sender);
    const before = injections;
    await restoreDrawing(1, urls[1]);
    assert.equal(injections, before);
    await assert.rejects(handleDrawing({ type: "draw:automatic", enabled: true }, {}));
    access = true;
    await handleDrawing({ type: "draw:automatic", enabled: true }, {});
    await restoreDrawing(2, urls[2]);
    assert.equal(injections, before);
    await restoreDrawing(1, urls[1]);
    assert.equal(injections, before + 1);
    assert.equal(pages.get(1).editing, false);
    assert.equal(await drawingRunning(), false);
    await stopDrawings();
    await handleDrawing({ type: "draw:automatic", enabled: false }, {});
    await restoreDrawing(1, urls[1]);
    assert.equal(injections, before + 1);
    await handleDrawing({ type: "draw:delete-custom", key }, {});
    assert.equal(local[key], undefined);
    assert.deepEqual(local.drawingCustomIndex, []);
    assert.equal(local[urlKey].strokes.length, 1);
  } finally { delete globalThis.chrome; }
});
