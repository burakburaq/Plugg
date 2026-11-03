import { t } from "../../../modules/i18n.js";
import { DARK_KEY, normalizeDark } from "./dark-settings.js";
const SCRIPT_ID = "extension-manager-dark";
const files = ["vendor/darkreader.js", "dark-mode-content.js"];
export async function getDarkSettings() { return normalizeDark((await chrome.storage.local.get(DARK_KEY))[DARK_KEY]); }
async function registerDarkMode() {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!registered.length) await chrome.scripting.registerContentScripts([{ id: SCRIPT_ID, js: files, matches: ["http://*/*", "https://*/*"], allFrames: true, runAt: "document_start", persistAcrossSessions: true }]);
}
async function applyToOpenTabs(force = true) {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  const results = await Promise.allSettled(tabs.filter(tab => !tab.discarded && !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(tab.url || "")).map(async tab => {
    // A live child frame must never mask a missing controller in the main document.
    const apply = () => chrome.tabs.sendMessage(tab.id, { target: "dark-page", type: "dark:apply" }, { frameId: 0 });
    let result;
    try { result = await chrome.tabs.sendMessage(tab.id, { target: "dark-page", type: force ? "dark:apply" : "dark:status" }, { frameId: 0 }); } catch {}
    if (!result?.ok) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files });
      result = await apply();
    }
    if (!result?.ok) throw new Error(result?.error || t("dark_mode_could_not_apply_dark_mode_to_page"));
  }));
  if (results.length && results.every(result => result.status === "rejected")) throw new Error(t("dark_mode_could_not_apply_dark_mode_to_open"));
}

export async function darkPageContext(sender) {
  if (!Number.isInteger(sender?.tab?.id)) throw new Error(t("dark_mode_invalid_page_context"));
  let hostname = "";
  try { hostname = new URL(sender.tab.url).hostname.toLowerCase(); } catch {}
  return { settings: await getDarkSettings(), hostname };
}
export async function fetchDarkResource(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(t("dark_mode_invalid_style_resource"));
  if (!(await getDarkSettings()).enabled) throw new Error(t("dark_mode_dark_mode_is_off"));
  if (!await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] })) throw new Error(t("dark_mode_site_access_was_removed"));
  const response = await fetch(parsed.href, { credentials: "omit", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(t("dark_mode_could_not_load_style_resource"));
  if (Number(response.headers.get("content-length")) > 5 * 1024 * 1024) throw new Error(t("dark_mode_style_resource_is_too_large"));
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) throw new Error(t("dark_mode_style_resource_is_too_large"));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { data: btoa(binary), contentType: response.headers.get("content-type") || "application/octet-stream" };
}
export async function stopDarkMode(preserveSettings = false) {
  await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => {});
  const settings = await getDarkSettings();
  if (settings.enabled && !preserveSettings) await chrome.storage.local.set({ [DARK_KEY]: { ...settings, enabled: false } });
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { target: "dark-page", type: "dark:stop" }).catch(() => {})));
}
export async function handleDarkMode(message) {
  const before = await getDarkSettings();
  if (message.type === "dark:get") {
    if (before.enabled) {
      if (!await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] })) { await stopDarkMode(); return { ...before, enabled: false }; }
      try { await registerDarkMode(); await applyToOpenTabs(); }
      catch (error) { return { ...before, warning: error.message }; }
    }
    return before;
  }
  if (message.type !== "dark:set") throw new Error(t("dark_mode_unknown_dark_mode_operation"));
  const settings = normalizeDark(message.patch ? { ...before, ...message.patch } : message.settings);
  if (settings.enabled && !await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] })) throw new Error(t("dark_mode_permission_to_access_all_sites_is_required"));
  if (!settings.enabled) {
    await chrome.storage.local.set({ [DARK_KEY]: settings }); await stopDarkMode(); return settings;
  }
  try {
    await registerDarkMode();
    await chrome.storage.local.set({ [DARK_KEY]: settings });
    await applyToOpenTabs(!message.patch || Object.hasOwn(message.patch, "enabled"));
  } catch (error) {
    await chrome.storage.local.set({ [DARK_KEY]: before });
    if (!before.enabled) await stopDarkMode();
    throw error;
  }
  return settings;
}
