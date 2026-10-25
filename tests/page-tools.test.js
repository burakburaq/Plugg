import test from "node:test";
import assert from "node:assert/strict";
import { domainOf, groupByDomain, captureFullPage, groupDomainTabs } from "../modules/page-tools.js";
import { normalizeDark, DARK_DEFAULTS } from "../modules/dark-settings.js";

test("domain grouping excludes pinned/internal tabs and keeps subdomains separate", () => {
  assert.equal(domainOf("https://www.example.com/path"), "example.com");
  assert.equal(domainOf("chrome://settings"), null);
  assert.deepEqual(groupByDomain([
    { id: 1, url: "https://www.example.com/a" }, { id: 2, url: "https://example.com/b" },
    { id: 3, url: "https://example.com/c", pinned: true }, { id: 4, url: "https://app.example.com" },
    { id: 5, url: "chrome://newtab" }
  ]).map(([domain, tabs]) => [domain, tabs.map(tab => tab.id)]), [["example.com", [1, 2]]]);
  assert.deepEqual(normalizeDark(), DARK_DEFAULTS);
  const dark = normalizeDark({ enabled: true, brightness: 300, contrast: -20, sepia: NaN, background: "red; bad", excluded: ["Example.com", "example.com", "a b", null] });
  assert.equal(dark.brightness, 150); assert.equal(dark.contrast, 50); assert.equal(dark.background, DARK_DEFAULTS.background);
  assert.deepEqual(dark.excluded, ["example.com"]);
});

test("full-page PNG uses document bounds and releases the debugger even after errors", async () => {
  let attach = 0, detach = 0, failure = false, screenshot, download;
  globalThis.chrome = {
    permissions: { contains: async () => true }, tabs: { get: async () => ({ url: "https://example.com/page" }) },
    downloads: { async download(options) { download = options; return 5; } },
    debugger: {
      async attach() { attach++; }, async detach() { detach++; },
      async sendCommand(target, command, options) {
        if (command === "Page.getLayoutMetrics") return { cssContentSize: { width: 1280, height: 4000 } };
        screenshot = options; if (failure) throw new Error("Capture failed"); return { data: "PNG" };
      }
    }
  };
  try {
    const result = await captureFullPage(1);
    assert.equal(result.width, 1280); assert.equal(result.height, 4000);
    assert.deepEqual(screenshot.clip, { x: 0, y: 0, width: 1280, height: 4000, scale: 1 });
    assert.equal(screenshot.captureBeyondViewport, true); assert.equal(download.url, "data:image/png;base64,PNG");
    assert.equal(detach, 1);
    failure = true; await assert.rejects(captureFullPage(1)); assert.equal(attach, 2); assert.equal(detach, 2);
    chrome.debugger.attach = async () => { throw new Error("Already attached"); };
    await assert.rejects(captureFullPage(1)); assert.equal(detach, 2); // Do not detach another debugger.
  } finally { delete globalThis.chrome; }
});

test("domain grouping reuses a matching group without including pinned or unrelated members", async () => {
  const grouped = [], updated = [];
  const tabs = [{ id: 1, windowId: 7, groupId: 4, url: "https://example.com" }, { id: 2, windowId: 7, groupId: -1, url: "https://example.com/page" }, { id: 3, windowId: 7, pinned: true, groupId: -1, url: "https://example.com/pinned" }];
  globalThis.chrome = {
    permissions: { contains: async () => true },
    tabs: { query: async () => tabs, async group(options) { grouped.push(options); return options.groupId ?? 9; } },
    tabGroups: { query: async () => [{ id: 4, title: "example.com" }], async update(id, options) { updated.push([id, options]); } }
  };
  try {
    assert.deepEqual(await groupDomainTabs(), { groups: 1, tabs: 2 });
    assert.deepEqual(grouped, [{ tabIds: [1, 2], groupId: 4 }]);
    assert.equal(updated[0][1].title, "example.com");
  } finally { delete globalThis.chrome; }
});
