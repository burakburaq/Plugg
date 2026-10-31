import { t } from "../../../modules/i18n.js";
import { videoTools } from "./video-content.js";
import { VIDEO_SITES_KEY, normalizeVideoSettings } from "./video-settings.js";
const TABS_KEY = "videoToolsTabs";
async function tracked() { return (await chrome.storage.session.get(TABS_KEY))[TABS_KEY] || []; }
async function save(ids) {
  await chrome.storage.session.set({ [TABS_KEY]: ids });
  chrome.runtime.sendMessage({ target: "modules-popup", type: "modules:running", module: "video", active: ids.length > 0 }).catch(() => {});
}
export async function stopVideos(tabId) {
  const ids = await tracked();
  const stop = tabId === undefined ? ids : ids.filter(id => id === tabId);
  await Promise.all(stop.map(id => chrome.tabs.sendMessage(id, { target: "video-page", type: "video:stop" }, { frameId: 0 }).catch(() => {})));
  if (stop.length) await save(ids.filter(id => !stop.includes(id)));
}
export async function videoRunning() {
  const ids = await tracked(), live = [];
  for (const id of ids) {
    try { if ((await chrome.tabs.sendMessage(id, { target: "video-page", type: "video:status" }, { frameId: 0 }))?.active) live.push(id); } catch {}
  }
  if (live.length !== ids.length) await save(live);
  return live.length > 0;
}
export async function handleVideo(message, sender) {
  if (["video:state", "video:save"].includes(message.type)) {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0) throw new Error(t("video_tools_invalid_video_source"));
    if (message.type === "video:state") {
      const ids = (await tracked()).filter(id => id !== sender.tab.id);
      if (message.active) ids.push(sender.tab.id);
      await save(ids); return { active: !!message.active };
    }
    if (!(await tracked()).includes(sender.tab.id)) throw new Error(t("video_tools_video_tools_is_not_active_in_this"));
    const url = new URL(sender.url || sender.tab.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error(t("video_tools_invalid_site"));
    const stored = (await chrome.storage.local.get(VIDEO_SITES_KEY))[VIDEO_SITES_KEY] || {};
    const sites = { ...stored };
    if (message.remember === true) sites[url.origin] = normalizeVideoSettings(message.settings);
    else if (message.remember === false) delete sites[url.origin];
    else throw new Error(t("video_tools_invalid_remember_setting"));
    await chrome.storage.local.set({ [VIDEO_SITES_KEY]: sites });
    return { saved: true };
  }
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error(t("common_could_not_select_valid_tab"));
  if (message.type === "video:stop") { await stopVideos(message.tabId); return { active: false }; }
  if (message.type === "video:get") {
    try { return await chrome.tabs.sendMessage(message.tabId, { target: "video-page", type: "video:status" }, { frameId: 0 }); } catch { return { active: false }; }
  }
  if (message.type !== "video:start") throw new Error(t("video_tools_unknown_video_operation"));
  const tab = await chrome.tabs.get(message.tabId);
  if (!/^https?:\/\//.test(tab.url || "")) throw new Error(t("video_tools_try_regular_web_page_containing_video"));
  const sites = (await chrome.storage.local.get(VIDEO_SITES_KEY))[VIDEO_SITES_KEY] || {};
  const saved = sites[new URL(tab.url).origin];
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: videoTools, args: [normalizeVideoSettings(saved), !!saved] });
  const state = results.find(item => item.frameId === 0)?.result;
  if (!state?.active) throw new Error(state?.error || t("video_tools_could_not_open_video_tools_2"));
  await save([...new Set([...(await tracked()), tab.id])]);
  return state;
}
