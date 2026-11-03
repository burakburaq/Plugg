import bundled from "../../feature-flags.json" with { type: "json" };
import { MODULE_VERSION_LOADERS } from "./module-loading.js";

export const FEATURE_FLAGS = Object.freeze({
  manager: "module.extensionManager", volume: "module.volumeBooster", themes: "module.htmlEditor",
  whatsthis: "module.whatsThis", qr: "module.qrCreator", font: "module.fontFinder", color: "module.colorPicker",
  drawing: "module.drawOnPage", newtab: "module.newTab", shortcuts: "module.keyboardShortcuts",
  screenshot: "module.pageCapture", dark: "module.darkMode", groups: "module.tabGroups",
  video: "module.videoTools", gestureflow: "module.gestureFlow"
});
export const FLAG_CACHE_KEY = "featureFlagsCache";
export const FLAG_CHANNEL_KEY = "featureFlagsChannel";
export const FLAG_URL = "https://raw.githubusercontent.com/burakburaq/Plugg/main/feature-flags.json";
export const DEFAULT_FLAGS = bundled;
export const PACKAGED_VERSIONS = Object.freeze({
  "extension.menu": [1],
  "extension.page": [],
  ...Object.fromEntries(Object.entries(FEATURE_FLAGS).map(([id, flag]) => [flag, Object.keys(MODULE_VERSION_LOADERS[id] || {}).map(Number).sort((a, b) => a - b)]))
});
const REFRESH_MS = 15 * 60 * 1000;
let refreshing;

export function validateFlags(value) {
  if (!value || typeof value !== "object") return null;
  const keys = Object.keys(bundled.stable);
  const result = {};
  for (const channel of ["stable", "beta"]) {
    const source = value[channel];
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    if (keys.some(key => !Number.isSafeInteger(source[key]) || source[key] < 0)) return null;
    result[channel] = Object.fromEntries(keys.map(key => [key, source[key]]));
  }
  return result;
}

// Version 1 is the only currently packaged implementation; the separate page does not exist yet.
export function resolveFlags(config, channel = "stable") {
  const valid = validateFlags(config) || bundled;
  const selected = valid[channel === "beta" ? "beta" : "stable"];
  const resolved = {};
  for (const key of Object.keys(bundled.stable)) {
    const desired = selected[key];
    const versions = PACKAGED_VERSIONS[key];
    resolved[key] = desired === 0 ? 0 : versions.includes(desired) ? desired : versions.includes(valid.stable[key]) ? valid.stable[key] : versions[0] || 0;
  }
  return resolved;
}

export function filterFlaggedLayout(layout, flags) {
  const visible = id => flags[FEATURE_FLAGS[id]] > 0;
  return { active: layout.active.filter(visible), passive: layout.passive.filter(visible) };
}

export function mergeFlaggedLayout(before, visible, flags) {
  const allowed = id => flags[FEATURE_FLAGS[id]] > 0;
  const active = visible.active.filter(allowed), passive = visible.passive.filter(allowed);
  const result = {};
  for (const group of ["active", "passive"]) {
    const queue = [...(group === "active" ? active : passive)];
    result[group] = before[group].flatMap(id => allowed(id) ? (queue.length ? [queue.shift()] : []) : [id]);
    result[group].push(...queue);
  }
  return result;
}

export async function currentFlags() {
  const [cached, channel] = await Promise.all([chrome.storage.local.get(FLAG_CACHE_KEY), chrome.storage.local.get(FLAG_CHANNEL_KEY)]);
  return resolveFlags(cached[FLAG_CACHE_KEY]?.config, channel[FLAG_CHANNEL_KEY]);
}

export async function refreshFlags(force = false) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const stored = await chrome.storage.local.get(FLAG_CACHE_KEY);
    if (!force && Date.now() - (stored[FLAG_CACHE_KEY]?.checkedAt || 0) < REFRESH_MS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(FLAG_URL, { signal: controller.signal, cache: "no-cache", credentials: "omit" });
      if (!response.ok) throw new Error("Feature flags unavailable");
      const config = validateFlags(await response.json());
      if (!config) throw new Error("Invalid feature flags");
      await chrome.storage.local.set({ [FLAG_CACHE_KEY]: { config, checkedAt: Date.now() } });
    } finally { clearTimeout(timer); }
  })().finally(() => { refreshing = null; });
  return refreshing;
}
