import test from "node:test";
import assert from "node:assert/strict";
import { defaultNewTab, normalizeNewTab, fitWidget, normalizeSearchSite, searchQuery, searchUrl } from "../src/components/modules/newtab/newtab-settings.js";
import { normalizeFocus, focusRemaining, normalizeTodos, normalizeLinks, safeLink, normalizeWeather } from "../src/components/modules/newtab/newtab-data.js";

test("search filters form an encoded Google query and reject invalid sites", () => {
  assert.equal(searchQuery("  react rehberi  ", "https://example.com/docs/", "pdf"), "react rehberi site:example.com/docs filetype:pdf");
  assert.equal(new URL(searchUrl("C++ & React", "example.com", "pdf")).searchParams.get("q"), "C++ & React site:example.com filetype:pdf");
  assert.equal(searchQuery("site:example.org örnek", "", ""), "site:example.org örnek");
  assert.equal(searchQuery("", "example.com", "docx"), "site:example.com filetype:docx");
  assert.throws(() => searchUrl("", "", ""));
  assert.throws(() => searchQuery("test", "example.com başka-site", "pdf"));
  assert.throws(() => searchQuery("test", "javascript:alert(1)", ""));
});

test("widget geometry stays usable on smaller windows and removed widgets stay removed", () => {
  const viewport = { width: 360, height: 500 };
  for (const item of defaultNewTab(viewport).items) {
    const fitted = fitWidget({ ...item, x: 20000, y: -200, width: 9000, height: 9000 }, viewport);
    assert(fitted.x >= 16 && fitted.x + fitted.width <= viewport.width - 16);
    assert(fitted.y >= 72 && fitted.y + fitted.height <= viewport.height - 16);
  }
  assert.deepEqual(normalizeNewTab({ items: [], site: "example.com", fileType: "pdf" }, viewport), { version: 3, items: [], site: "example.com", fileType: "pdf", timeRange: "", customSites: [] });
  const config = normalizeNewTab({ version: 3, items: [{ type: "search", x: NaN }, { type: "search" }, { type: "unknown" }], fileType: "unsafe" }, viewport);
  assert.equal(config.items.length, 1);
  assert.equal(config.items[0].x, 16);
  assert.equal(config.fileType, "");
});

test("date filters use calendar boundaries and the last 24 hours remains a rolling range", () => {
  const now = new Date(2026, 9, 2, 12);
  assert.equal(searchQuery("test", "", "", "week", now), "test after:2026-09-28");
  assert.equal(searchQuery("test", "", "", "month", now), "test after:2026-10-01");
  assert.equal(searchQuery("test", "", "", "year", now), "test after:2026-01-01");
  const url = new URL(searchUrl("test", "youtube.com", "pdf", "day", now));
  assert.equal(url.searchParams.get("as_qdr"), "d");
  assert.equal(url.searchParams.get("q"), "test site:youtube.com filetype:pdf");
  assert.equal(new URL(searchUrl("test", "", "", "", now)).searchParams.has("as_qdr"), false);
  assert.equal(searchQuery("test", "", "image"), "test (filetype:png OR filetype:jpg OR filetype:jpeg OR filetype:webp OR filetype:gif OR filetype:svg)");
});

test("saved custom sites are validated, deduplicated and bounded", () => {
  assert.equal(normalizeSearchSite(" https://example.com/docs/ "), "example.com/docs");
  const config = normalizeNewTab({ version: 3, items: [], timeRange: "invalid", customSites: ["https://example.com/", "example.com", "bad domain", "javascript:alert(1)", ...Array.from({ length: 8 }, (_, i) => `site${i}.com`)] }, { width: 1440, height: 900 });
  assert.equal(config.timeRange, "");
  assert.deepEqual(config.customSites, ["example.com", "site0.com", "site1.com", "site2.com", "site3.com", "site4.com"]);
});

test("new tab defaults stay minimal and legacy filters migrate without losing search restrictions", () => {
  const viewport = { width: 1440, height: 900 };
  assert.deepEqual(defaultNewTab(viewport).items.map(item => item.type), ["clock", "search", "links"]);
  const next = normalizeNewTab({ items: [{ type: "search" }, { type: "filters" }], site: "example.com", fileType: "pdf" }, viewport);
  assert.deepEqual(next.items.map(item => item.type), ["clock", "search", "links"]);
  assert.equal(next.site, "example.com"); assert.equal(next.fileType, "pdf");
  for (const type of ["todo", "weather", "focus"]) {
    const widget = fitWidget({ type, width: 9000, height: 9000, x: 9000, y: 9000 }, { width: 360, height: 500 });
    assert(widget.x + widget.width <= 344); assert(widget.y + widget.height <= 484);
  }
});

test("focus deadline survives closed pages and pause preserves remaining time", () => {
  const now = 1000000;
  const running = normalizeFocus({ duration: 25, remaining: 1500, endsAt: now + 61000 });
  assert.equal(focusRemaining(running, now), 61);
  assert.equal(focusRemaining(running, now + 30000), 31);
  assert.equal(focusRemaining(running, now + 90000), 0);
  assert.equal(focusRemaining({ ...running, remaining: 31, endsAt: null }, now + 90000), 31);
  assert.deepEqual(normalizeFocus({ duration: -1, remaining: NaN }), { duration: 25, remaining: 1500, endsAt: null });
});

test("task, shortcut and weather records ignore damaged data and unsafe links", () => {
  assert.deepEqual(normalizeTodos([{ id: "a", text: "Görev", done: true }, { id: "a", text: "Tekrar" }, { id: "b", text: " " }, null]), [{ id: "a", text: "Görev", done: true }]);
  for (const value of ["javascript:alert(1)", "file:///test", "data:text/html,test", "https://user:pass@example.com", "", undefined]) assert.throws(() => safeLink(value));
  assert.equal(safeLink("example.com"), "https://example.com/");
  assert.deepEqual(normalizeLinks([{ id: "a", title: "Test", url: "javascript:alert(1)" }]), []);
  assert.deepEqual(normalizeLinks([]), []);
  assert.deepEqual(normalizeWeather({ city: { latitude: 200, longitude: 0, name: "Test" } }), { city: null, snapshot: null });
});

test("compact layout migration preserves selected widgets and subsequent custom geometry", () => {
  const viewport = { width: 1440, height: 900 };
  const before = { version: 2, site: "example.org", fileType: "pdf", items: [{ id: "weather", type: "weather", x: 900, y: 100, width: 300, height: 260 }, { id: "focus", type: "focus", x: 900, y: 600, width: 300, height: 320 }] };
  const next = normalizeNewTab(before, viewport);
  assert.deepEqual(next.items.map(item => item.type), ["weather", "focus"]);
  assert.equal(next.items[0].height, 76); assert.equal(next.items[1].height, 42);
  assert.equal(next.site, "example.org"); assert.equal(next.fileType, "pdf");
  next.items[1] = { ...next.items[1], x: 300, y: 400, width: 250 };
  assert.deepEqual(normalizeNewTab(next, viewport), next);
  assert.deepEqual(normalizeNewTab({ ...before, items: [] }, viewport).items, []);
});

test("tasks retain optional valid times without changing older records", () => {
  const records = normalizeTodos([{ id: "a", text: "Görev", done: false, time: "09:00" }, { id: "b", text: "Eski görev", done: false }, { id: "c", text: "Hatalı saat", time: "25:99" }]);
  assert.equal(records[0].time, "09:00"); assert.equal(Object.hasOwn(records[1], "time"), false); assert.equal(Object.hasOwn(records[2], "time"), false);
});
