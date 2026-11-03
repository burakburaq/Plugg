import { t } from "./src/modules/i18n.js";
import { normalizeSettings } from "./src/components/modules/volume-booster/audio-settings.js";
import { LAYOUT_KEY, normalizeLayout } from "./src/modules/module-layout.js";
import { inspectFonts } from "./src/components/modules/font-finder/font-inspector.js";
import { handleDrawing, stopDrawings, drawingRunning, restoreDrawing, invalidateDrawingSettings } from "./src/components/modules/page-drawing/drawing-background.js";
import { handleShortcuts, runShortcut, trackShortcutTab, resetShortcutTabs, forgetShortcutTab, replaceShortcutTab } from "./src/components/modules/keyboard-shortcuts/shortcuts-background.js";
import { handleDarkMode, getDarkSettings, stopDarkMode, fetchDarkResource, darkPageContext } from "./src/components/modules/dark-mode/dark-background.js";
import { handleVideo, stopVideos, videoRunning } from "./src/components/modules/video-tools/video-background.js";
import { groupDomainTabs, captureFullPage } from "./src/modules/page-tools.js";
import { DARK_KEY } from "./src/components/modules/dark-mode/dark-settings.js";
import { radiusEditor } from "./src/components/modules/themes/radius-editor.js";
import { loadRadiusEntries } from "./src/components/modules/themes/radius-storage.js";
import { textEditor } from "./src/components/modules/themes/text-editor.js";
import { loadTextEntries } from "./src/components/modules/themes/text-storage.js";
import { installThemesControl } from "./src/components/modules/themes/themes-control.js";
import { startWhatsThisPicker, stopWhatsThisPicker } from "./src/components/modules/whats-this/picker-manager.js";
import { FLAG_CACHE_KEY, FLAG_CHANNEL_KEY, FEATURE_FLAGS, currentFlags, filterFlaggedLayout, mergeFlaggedLayout, refreshFlags, resolveFlags } from "./src/modules/feature-flags.js";

let creating;
const starting = new Map();
let layoutPromise;
let commands = Promise.resolve();

function enqueue(task) {
  const job = commands.catch(() => {}).then(task);
  commands = job.catch(() => {});
  return job;
}

function getStoredLayout() {
  if (!layoutPromise) {
    layoutPromise = (async () => {
      const stored = await chrome.storage.local.get(LAYOUT_KEY);
      const layout = normalizeLayout(stored[LAYOUT_KEY]);
      if (!stored[LAYOUT_KEY]) await chrome.storage.local.set({ [LAYOUT_KEY]: layout });
      return layout;
    })().catch(error => { layoutPromise = undefined; throw error; });
  }
  return layoutPromise;
}
async function getLayout() { return filterFlaggedLayout(await getStoredLayout(), await currentFlags()); }

chrome.storage.onChanged.addListener((changes, area) => {
  invalidateDrawingSettings(changes, area);
  if (area === "local" && changes[LAYOUT_KEY]) layoutPromise = undefined;
  if (area === "local" && (changes[FLAG_CACHE_KEY] || changes[FLAG_CHANNEL_KEY])) {
    enqueue(async () => {
      const channel = (await chrome.storage.local.get(FLAG_CHANNEL_KEY))[FLAG_CHANNEL_KEY] || "stable";
      const cache = (await chrome.storage.local.get(FLAG_CACHE_KEY))[FLAG_CACHE_KEY];
      const oldChannel = changes[FLAG_CHANNEL_KEY] ? changes[FLAG_CHANNEL_KEY].oldValue || "stable" : channel;
      const oldConfig = changes[FLAG_CACHE_KEY] ? changes[FLAG_CACHE_KEY].oldValue?.config : cache?.config;
      const before = resolveFlags(oldConfig, oldChannel), after = resolveFlags(cache?.config, channel);
      const disabled = id => before[FEATURE_FLAGS[id]] > 0 && after[FEATURE_FLAGS[id]] === 0;
      if (disabled("volume")) await stopAllAudio();
      if (disabled("font")) await stopAllFonts();
      if (disabled("drawing")) await stopDrawings();
      if (disabled("shortcuts")) await resetShortcutTabs(false);
      if (disabled("dark")) await stopDarkMode(true);
      if (disabled("video")) await stopVideos();
      if (disabled("whatsthis")) await stopWhatsThisPicker();
      for (const id of ["themes", "color"]) if (disabled(id)) {
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { target: "plugg-feature-control", module: id }, { frameId: 0 }).catch(() => {})));
      }
      if (!before[FEATURE_FLAGS.dark] && after[FEATURE_FLAGS.dark] && (await getStoredLayout()).active.includes("dark")) await handleDarkMode({ type: "dark:get" });
    }).catch(() => {});
  }
  if (area === "local" && changes[DARK_KEY]) {
    chrome.runtime.sendMessage({ target: "modules-popup", type: "modules:running", module: "dark", active: !!changes[DARK_KEY].newValue?.enabled }).catch(() => {});
  }
});

async function hasAudioDocument() {
  if (!chrome.runtime.getContexts || !chrome.offscreen) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("src/components/modules/volume-booster/offscreen.html")]
  });
  return contexts.length > 0;
}

async function ensureAudioDocument() {
  if (!chrome.offscreen) throw new Error(t("common_volume_booster_is_not_supported_in_this"));
  if (creating) return creating;
  creating = (async () => {
    if (!await hasAudioDocument()) {
      await chrome.offscreen.createDocument({
        url: "src/components/modules/volume-booster/offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: t("common_boost_and_equalize_tab_audio_while_popup")
      });
    }
    // The dev server may still be loading the document's module scripts.
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage({ target: "audio-engine", type: "audio:ping" });
        if (response?.ok) return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(t("common_could_not_load_audio_engine"));
  })();
  try { await creating; } finally { creating = undefined; }
}

function defaults(tabId) {
  return { active: false, tabId, ...normalizeSettings({ gain: 1, preset: "flat" }) };
}

async function forward(message) {
  const response = await chrome.runtime.sendMessage({ ...message, target: "audio-engine" });
  if (!response?.ok) throw new Error(response?.error || t("common_could_not_connect_to_audio_engine"));
  return response.state;
}

async function closeIdleAudio() {
  if (!await hasAudioDocument()) return;
  const state = await forward({ type: "audio:status" });
  if (state.activeCount === 0) await chrome.offscreen.closeDocument();
}

async function stopAllAudio() {
  if (!await hasAudioDocument()) return;
  await forward({ type: "audio:stop-all" });
  await chrome.offscreen.closeDocument();
}

async function trackedFontTabs() {
  const stored = await chrome.storage.session.get("fontTabIds");
  return new Set((stored.fontTabIds || []).filter(Number.isInteger));
}

async function saveFontTabs(tabs) {
  await chrome.storage.session.set({ fontTabIds: [...tabs] });
  chrome.runtime.sendMessage({ target: "modules-popup", type: "modules:running", module: "font", active: tabs.size > 0 }).catch(() => {});
}

async function runningModules() {
  const layout = await getLayout();
  const tabs = await trackedFontTabs();
  const liveTabs = new Set();
  await Promise.all([...tabs].map(async tabId => {
    try {
      const state = await chrome.tabs.sendMessage(tabId, { target: "font-inspector", type: "font:status" }, { frameId: 0 });
      if (state?.active) liveTabs.add(tabId);
    } catch {}
  }));
  if (liveTabs.size !== tabs.size) await saveFontTabs(liveTabs);
  const audio = await hasAudioDocument() ? await forward({ type: "audio:status" }) : { activeCount: 0 };
  return { volume: layout.active.includes("volume") && audio.activeCount > 0, font: layout.active.includes("font") && liveTabs.size > 0,
    drawing: layout.active.includes("drawing") && await drawingRunning(),
    dark: layout.active.includes("dark") && (await getDarkSettings()).enabled,
    video: layout.active.includes("video") && await videoRunning() };
}

async function stopFont(tabId) {
  // The in-page receiver can clean up even after activeTab access has expired.
  try { await chrome.tabs.sendMessage(tabId, { target: "font-inspector", type: "font:stop" }); }
  catch { /* A closed/navigated page or an inspector already stopped by Esc. */ }
}

async function stopAllFonts() {
  const tabs = await trackedFontTabs();
  await Promise.all([...tabs].map(stopFont));
  await saveFontTabs(new Set());
}

async function handleFont(message, sender) {
  if (["font:started", "font:ended"].includes(message.type)) {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0) return;
    const tabs = await trackedFontTabs();
    if (message.type === "font:started") {
      if (!(await getLayout()).active.includes("font")) { await stopFont(sender.tab.id); return { active: false }; }
      tabs.add(sender.tab.id);
    } else tabs.delete(sender.tab.id);
    await saveFontTabs(tabs);
    return { active: message.type === "font:started" };
  }
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error(t("common_could_not_select_valid_tab"));
  const action = { "font:status": "status", "font:stop": "stop", "font:prepare": "prepare" }[message.type];
  if (!action) throw new Error(t("common_unknown_font_operation"));
  if (action === "prepare" && (typeof message.connectionName !== "string" || !message.connectionName.startsWith("font-finder:"))) throw new Error(t("common_invalid_font_connection"));
  const tabs = await trackedFontTabs();
  if (action === "stop") {
    await stopFont(message.tabId);
    tabs.delete(message.tabId);
    await saveFontTabs(tabs);
    return { active: false };
  }
  if (!(await getLayout()).active.includes("font")) throw new Error(t("common_font_finder_is_inactive"));
  const results = await chrome.scripting.executeScript({ target: { tabId: message.tabId }, func: inspectFonts, args: [action, message.connectionName] });
  const state = (results.find(item => item.frameId === 0) || results[0])?.result;
  if (!state) throw new Error(t("common_could_not_connect_to_font_finder"));
  if (state.active) tabs.add(message.tabId); else tabs.delete(message.tabId);
  await saveFontTabs(tabs);
  return state;
}

async function handleModules(message) {
  if (message.type === "modules:get") return getStoredLayout();
  if (message.type === "modules:status") return runningModules();
  if (message.type !== "modules:set") throw new Error(t("common_unknown_module_operation"));
  const before = await getLayout();
  const flags = await currentFlags();
  const next = normalizeLayout(mergeFlaggedLayout(await getStoredLayout(), message.layout, flags));
  const nextVisible = filterFlaggedLayout(next, flags);
  // Commands are serialized: any pending start finishes before this cleanup.
  if (before.active.includes("volume") && !nextVisible.active.includes("volume")) await stopAllAudio();
  if (before.active.includes("font") && !nextVisible.active.includes("font")) await stopAllFonts();
  if (before.active.includes("drawing") && !nextVisible.active.includes("drawing")) await stopDrawings();
  if (before.active.includes("shortcuts") !== nextVisible.active.includes("shortcuts")) await resetShortcutTabs(nextVisible.active.includes("shortcuts"));
  if (before.active.includes("dark") && !nextVisible.active.includes("dark")) await stopDarkMode();
  if (before.active.includes("video") && !nextVisible.active.includes("video")) await stopVideos();
  if (before.active.includes("whatsthis") && !nextVisible.active.includes("whatsthis")) await stopWhatsThisPicker();
  await chrome.storage.local.set({ [LAYOUT_KEY]: next });
  layoutPromise = Promise.resolve(next);
  return next;
}

async function handleFlags(message) {
  if (message.type === "flags:get") { void refreshFlags().catch(() => {}); return currentFlags(); }
  if (message.type === "flags:channel" && ["stable", "beta"].includes(message.channel)) {
    await chrome.storage.local.set({ [FLAG_CHANNEL_KEY]: message.channel });
    void refreshFlags(true).catch(() => {});
    return currentFlags();
  }
  throw new Error("Invalid feature flag operation");
}

async function startAudio(message) {
  if (starting.has(message.tabId)) return starting.get(message.tabId);
  const job = (async () => {
    await ensureAudioDocument();
    const current = await forward({ type: "audio:get", tabId: message.tabId });
    const settings = normalizeSettings(message.settings);
    if (current.active) return forward({ type: "audio:set", tabId: message.tabId, settings });
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId });
    return forward({ type: "audio:start", tabId: message.tabId, streamId, settings });
  })();
  starting.set(message.tabId, job);
  try { return await job; } finally { starting.delete(message.tabId); }
}

async function handle(message) {
  if (message.type === "audio:idle") { await closeIdleAudio(); return; }
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error(t("common_could_not_select_valid_tab"));
  if (message.type !== "audio:stop" && !(await getLayout()).active.includes("volume")) {
    if (message.type === "audio:get") return defaults(message.tabId);
    throw new Error("Volume Booster pasif.");
  }
  if (message.type === "audio:start") return startAudio(message);
  if (!["audio:get", "audio:set", "audio:stop"].includes(message.type)) throw new Error(t("common_unknown_audio_operation"));
  if (!await hasAudioDocument()) return defaults(message.tabId);
  const state = await forward({ ...message, settings: normalizeSettings(message.settings) });
  if (message.type === "audio:stop") await closeIdleAudio();
  return state;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  const handler = { "audio-background": handle, "font-background": handleFont, "modules-background": handleModules, "drawing-background": drawingHandler, "shortcuts-background": shortcutsHandler,
    "dark-background": darkHandler, "video-background": videoHandler, "page-tools-background": pageToolsHandler, "color-background": colorHandler,
    "whats-this-color-background": (message, sender) => colorHandler(message, sender, "whatsthis"),
    "whats-this-picker-background": whatsThisPickerHandler, "flags-background": handleFlags }[message?.target];
  if (!handler) return;
  // Independent read-only resource requests must not block control/cleanup commands.
  if (message.target === "dark-background" && ["dark:fetch", "dark:context"].includes(message.type)) {
    darkHandler(message, sender).then(state => reply({ ok: true, state })).catch(error => reply({ ok: false, error: error.message }));
    return true;
  }
  enqueue(() => handler(message, sender)).then(result => reply({ ok: true, [message.target === "modules-background" && message.type !== "modules:status" ? "layout" : "state"]: result }))
    .catch(error => reply({ ok: false, error: error.message }));
  return true;
});

async function drawingHandler(message, sender) {
  if (!(await getLayout()).active.includes("drawing") && !["draw:save-url", "draw:save-custom"].includes(message.type)) {
    if (message.type === "draw:state" && sender?.tab) { if (message.active) await stopDrawings(sender.tab.id); return; }
    throw new Error(t("common_draw_on_page_is_inactive"));
  }
  return handleDrawing(message, sender);
}

async function shortcutsHandler(message) {
  if (!(await getLayout()).active.includes("shortcuts")) throw new Error(t("common_keyboard_shortcuts_is_inactive"));
  return handleShortcuts(message);
}

async function darkHandler(message, sender) {
  if (!(await getLayout()).active.includes("dark")) throw new Error("Koyu Mod pasif.");
  if (message.type === "dark:context") return darkPageContext(sender);
  if (message.type === "dark:fetch") return fetchDarkResource(message.url);
  return handleDarkMode(message);
}

async function pageToolsHandler(message) {
  const module = { "capture:full": "screenshot", "groups:domain": "groups" }[message.type];
  if (!module || !(await getLayout()).active.includes(module)) throw new Error(t("common_module_is_inactive_or_operation_is_invalid"));
  if (module === "groups") return groupDomainTabs();
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error(t("common_could_not_select_valid_tab"));
  return captureFullPage(message.tabId);
}

async function colorHandler(message, sender, moduleId = "color") {
  if (!Number.isInteger(sender.tab?.id) || !(await getLayout()).active.includes(moduleId)) throw new Error(t("common_color_picker_is_unavailable"));
  if (message.type === "color:save" && /^#[\da-f]{6}$/i.test(message.color)) {
    const now = Date.now();
    const { colorHistory } = await chrome.storage.local.get("colorHistory");
    const history = Array.isArray(colorHistory) ? colorHistory : [];
    const recent = history.filter(item => item && /^#[\da-f]{6}$/i.test(item.color) && Number.isFinite(item.time) && item.time > now - 21600000 && item.time <= now);
    recent.unshift({ color: message.color.toLowerCase(), time: now });
    await chrome.storage.local.set({ colorHistory: recent.slice(0, 5) });
    return;
  }
  if (message.type !== "color:capture") throw new Error(t("common_invalid_color_picker_operation"));
  const tab = await chrome.tabs.get(sender.tab.id);
  if (!tab.active) throw new Error(t("common_tab_is_not_active"));
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
}

async function whatsThisPickerHandler(message) {
  if (message.type !== "start" || !(await getLayout()).active.includes("whatsthis")) throw new Error("Picker is unavailable");
  return startWhatsThisPicker(message.tabId, message.mode);
}

async function videoHandler(message, sender) {
  if (!(await getLayout()).active.includes("video")) throw new Error(t("common_video_tools_is_inactive"));
  return handleVideo(message, sender);
}

chrome.commands.onCommand.addListener((command, tab) => {
  enqueue(async () => { if ((await getLayout()).active.includes("shortcuts")) await runShortcut(command, tab); }).catch(() => {});
});

chrome.tabs.onActivated.addListener(info => {
  enqueue(async () => { if ((await getLayout()).active.includes("shortcuts")) await trackShortcutTab(info); }).catch(() => {});
});

chrome.tabs.onReplaced?.addListener((added, removed) => {
  enqueue(async () => { if ((await getLayout()).active.includes("shortcuts")) await replaceShortcutTab(added, removed); }).catch(() => {});
});

function initializeShortcutTabs() {
  enqueue(async () => { if ((await getLayout()).active.includes("shortcuts")) await resetShortcutTabs(true); }).catch(() => {});
}
chrome.alarms?.onAlarm.addListener(alarm => { if (alarm.name === "feature-flags-refresh") void refreshFlags(true).catch(() => {}); });
if (chrome.alarms) void chrome.alarms.get("feature-flags-refresh").then(alarm => {
  if (!alarm) return chrome.alarms.create("feature-flags-refresh", { periodInMinutes: 15 });
}).catch(() => {});
chrome.runtime.onStartup.addListener(initializeShortcutTabs);
chrome.runtime.onInstalled.addListener(initializeShortcutTabs);

chrome.tabs.onRemoved.addListener((tabId, info) => {
  enqueue(async () => {
    await stopWhatsThisPicker(tabId);
    if ((await getLayout()).active.includes("shortcuts")) await forgetShortcutTab(tabId, info);
    if ((await getLayout()).active.includes("video")) await stopVideos(tabId);
    await handle({ type: "audio:stop", tabId });
    const tabs = await trackedFontTabs();
    if (tabs.delete(tabId)) await saveFontTabs(tabs);
    if ((await getLayout()).active.includes("drawing")) await stopDrawings(tabId);
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if ((change.status === "complete" || change.url) && (change.url || tab.url)) {
    const url = change.url || tab.url;
    enqueue(async () => {
      if (!(await getLayout()).active.includes("themes") || !/^https?:\/\//.test(url)) return;
      const [radiusResult, textResult] = await Promise.allSettled([loadRadiusEntries(url), loadTextEntries(url)]);
      const radius = radiusResult.status === "fulfilled" ? radiusResult.value : { entries: [] };
      const text = textResult.status === "fulfilled" ? textResult.value : { entries: [] };
      if (!radius.entries.length && !text.entries.length) return;
      await chrome.scripting.executeScript({ target: { tabId }, func: installThemesControl });
      await Promise.allSettled([
        (async () => { if (radius.entries.length) await chrome.scripting.executeScript({ target: { tabId }, func: radiusEditor, args: ["restore", radius.entries, url] }); })(),
        (async () => { if (text.entries.length) await chrome.scripting.executeScript({ target: { tabId }, func: textEditor, args: ["restore", text.entries, url] }); })()
      ]);
    }).catch(() => {});
  }
  if (change.url && !change.status) {
    enqueue(async () => {
      if ((await getLayout()).active.includes("video")) await stopVideos(tabId);
      if (!(await getLayout()).active.includes("drawing")) return;
      await stopDrawings(tabId);
      await restoreDrawing(tabId, change.url);
    }).catch(() => {});
    return;
  }
  if (change.status === "complete") {
    enqueue(async () => { if ((await getLayout()).active.includes("drawing")) await restoreDrawing(tabId, tab.url); }).catch(() => {});
    return;
  }
  if (change.status !== "loading") return;
  enqueue(async () => {
    const tabs = await trackedFontTabs();
    if (tabs.delete(tabId)) await saveFontTabs(tabs);
    if ((await getLayout()).active.includes("video")) await stopVideos(tabId);
    if ((await getLayout()).active.includes("drawing")) await stopDrawings(tabId);
  }).catch(() => {});
});
