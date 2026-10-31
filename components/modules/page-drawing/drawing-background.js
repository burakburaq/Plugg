import { t } from "../../../modules/i18n.js";
import { inspectDrawing } from "./drawing-inspector.js";
import { drawingUrlKey, normalizeDrawing, DRAWING_AUTO_KEY, DRAWING_INDEX_KEY } from "./drawing-data.js";

let automatic;
export function invalidateDrawingSettings(changes, area) { if (area === "local" && changes[DRAWING_AUTO_KEY]) automatic = undefined; }
async function automaticEnabled() {
  if (!automatic) automatic = chrome.storage.local.get(DRAWING_AUTO_KEY).then(data => !!data[DRAWING_AUTO_KEY]);
  return automatic;
}
async function trackedTabs() { return (await chrome.storage.session.get("drawingTabs")).drawingTabs || {}; }
async function saveTabs(tabs) {
  await chrome.storage.session.set({ drawingTabs: tabs });
  chrome.runtime.sendMessage({ target: "modules-popup", type: "modules:running", module: "drawing", active: Object.values(tabs).some(Boolean) }).catch(() => {});
}
async function pageMessage(tabId, type, extra = {}) {
  const response = await chrome.tabs.sendMessage(tabId, { target: "drawing-page", type, ...extra }, { frameId: 0 });
  if (!response?.ok) throw new Error(response?.error || t("drawing_turn_on_drawing_mode_first"));
  return response.state;
}
export async function stopDrawings(tabId) {
  const tabs = await trackedTabs();
  if (tabId !== undefined && !Object.hasOwn(tabs, tabId)) return;
  if (!Object.keys(tabs).length) return;
  const ids = tabId === undefined ? Object.keys(tabs).map(Number) : [tabId];
  await Promise.all(ids.map(async id => { try { await pageMessage(id, "draw:stop"); } catch {} delete tabs[id]; }));
  await saveTabs(tabs);
}
export async function drawingRunning() {
  const tabs = await trackedTabs();
  if (!Object.keys(tabs).length) return false;
  for (const id of Object.keys(tabs)) {
    try { const state = await pageMessage(Number(id), "draw:status"); tabs[id] = !!state.editing; }
    catch { delete tabs[id]; }
  }
  await saveTabs(tabs);
  return Object.values(tabs).some(Boolean);
}
export async function restoreDrawing(tabId, url) {
  if (!url || !await automaticEnabled()) return;
  const key = await drawingUrlKey(url).catch(() => null);
  if (!key) return;
  const stored = await chrome.storage.local.get(key);
  if (!stored[key]?.strokes?.length) return;
  try { if ((await pageMessage(tabId, "draw:status"))?.active) return; } catch {}
  const data = normalizeDrawing(stored[key]);
  const tabs = await trackedTabs(); tabs[tabId] = false; await saveTabs(tabs);
  await chrome.scripting.executeScript({ target: { tabId }, func: inspectDrawing, args: [{ data, editing: false, url }] });
}
export async function handleDrawing(message, sender) {
  if (message.type === "draw:state") {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0) throw new Error(t("drawing_invalid_drawing_state"));
    const tabs = await trackedTabs();
    if (message.active) tabs[sender.tab.id] = !!message.editing; else delete tabs[sender.tab.id];
    await saveTabs(tabs); return;
  }
  if (["draw:save-url", "draw:save-custom"].includes(message.type)) {
    if (!sender?.tab || sender.frameId !== 0) throw new Error(t("drawing_could_not_connect_to_drawing_page"));
    const data = normalizeDrawing(message.data);
    if (message.type === "draw:save-url") {
      const key = await drawingUrlKey(sender.url || message.url);
      if (data.strokes.length) await chrome.storage.local.set({ [key]: { ...data, savedAt: Date.now() } });
      else await chrome.storage.local.remove(key);
    } else {
      const name = String(message.name || "").trim().slice(0, 80);
      if (!name) throw new Error(t("drawing_enter_save_name"));
      const key = `drawing:custom:${crypto.randomUUID()}`;
      const saved = await chrome.storage.local.get(DRAWING_INDEX_KEY);
      const index = [...(saved[DRAWING_INDEX_KEY] || []), { key, name, savedAt: Date.now() }];
      await chrome.storage.local.set({ [key]: data, [DRAWING_INDEX_KEY]: index });
    }
    return { saved: true };
  }
  if (message.type === "draw:library") {
    const saved = await chrome.storage.local.get([DRAWING_INDEX_KEY, DRAWING_AUTO_KEY]);
    return { items: saved[DRAWING_INDEX_KEY] || [], automatic: !!saved[DRAWING_AUTO_KEY] };
  }
  if (message.type === "draw:automatic") {
    if (message.enabled && !await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] })) throw new Error(t("drawing_site_access_is_required_for_automatic_loading"));
    await chrome.storage.local.set({ [DRAWING_AUTO_KEY]: !!message.enabled }); automatic = Promise.resolve(!!message.enabled);
    return { automatic: !!message.enabled };
  }
  if (message.type === "draw:delete-custom") {
    const saved = await chrome.storage.local.get(DRAWING_INDEX_KEY);
    const index = saved[DRAWING_INDEX_KEY] || [];
    if (!index.some(item => item.key === message.key)) throw new Error(t("drawing_save_not_found"));
    await chrome.storage.local.remove(message.key);
    await chrome.storage.local.set({ [DRAWING_INDEX_KEY]: index.filter(item => item.key !== message.key) }); return { deleted: true };
  }
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error(t("common_could_not_select_valid_tab"));
  if (message.type === "draw:get") {
    try { return await pageMessage(message.tabId, "draw:status"); }
    catch { return { active: false, editing: false, strokeCount: 0 }; }
  }
  if (message.type === "draw:stop") { await stopDrawings(message.tabId); return { active: false, editing: false, strokeCount: 0 }; }
  if (message.type === "draw:start") {
    const tab = await chrome.tabs.get(message.tabId);
    const key = message.key || await drawingUrlKey(tab.url);
    if (message.key && !key.startsWith("drawing:custom:")) throw new Error(t("drawing_invalid_save"));
    const stored = await chrome.storage.local.get(key);
    if (message.key && !stored[key]) throw new Error(t("drawing_save_not_found"));
    const data = normalizeDrawing(stored[key] || { strokes: [], width: 1, height: 1 });
    const tabs = await trackedTabs(); tabs[message.tabId] = true; await saveTabs(tabs);
    try {
      const results = await chrome.scripting.executeScript({ target: { tabId: message.tabId }, func: inspectDrawing,
        args: [{ data, editing: true, replace: !!message.key, url: tab.url }] });
      return results[0]?.result;
    } catch (error) { delete tabs[message.tabId]; await saveTabs(tabs); throw error; }
  }
  throw new Error(t("drawing_unknown_drawing_operation"));
}
