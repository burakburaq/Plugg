import test from "node:test";
import assert from "node:assert/strict";
import { recentModules, RECENT_WINDOW, normalizeSortOrder } from "../modules/module-loading.js";

test("recent opens exclude expired, future, invalid and unknown entries", () => {
  const now = RECENT_WINDOW * 2;
  assert.deepEqual(recentModules({ manager: now - RECENT_WINDOW + 1, volume: now - RECENT_WINDOW,
    qr: now + 1, font: "123", unknown: now, toString: now }, now), { manager: now - RECENT_WINDOW + 1 });
  assert.deepEqual(recentModules(null, now), {});
});

test("manager sorting defaults to active and preserves valid saved choices", () => {
  assert.equal(normalizeSortOrder(), "enabled");
  assert.equal(normalizeSortOrder("invalid"), "enabled");
  for (const value of ["enabled", "disabled", "alphabetical"]) assert.equal(normalizeSortOrder(value), value);
});
