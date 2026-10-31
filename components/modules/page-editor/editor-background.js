import { t } from "../../../modules/i18n.js";
import { editPage } from "./editor-inspector.js";
const KEY = "pageEditorTabs";
async function tracked() { return (await chrome.storage.session.get(KEY))[KEY] || []; }
async function save(ids) {
  await chrome.storage.session.set({ [KEY]: ids });
  chrome.runtime.sendMessage({ target: "modules-popup", type: "modules:running", module: "editor", active: ids.length > 0 }).catch(() => {});
}
export async function stopEditors(tabId) {
  const tabs = await tracked();
  const ids = tabId === undefined ? tabs : tabs.filter(id => id === tabId);
  if (!ids.length) return;
  await Promise.all(ids.map(id => chrome.tabs.sendMessage(id, { target: "editor-page", type: "editor:stop" }, { frameId: 0 }).catch(() => {})));
  await save(tabs.filter(id => !ids.includes(id)));
}
export async function editorRunning() {
  const tabs = await tracked();
  const live = [];
  for (const id of tabs) {
    try { if ((await chrome.tabs.sendMessage(id, { target: "editor-page", type: "editor:status" }, { frameId: 0 }))?.active) live.push(id); } catch {}
  }
  if (live.length !== tabs.length) await save(live);
  return live.length > 0;
}
export async function handleEditor(message, sender) {
  if (message.type === "editor:state") {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0) return;
    const ids = (await tracked()).filter(id => id !== sender.tab.id);
    if (message.active) ids.push(sender.tab.id);
    await save(ids); return { active: !!message.active };
  }
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error(t("common_could_not_select_valid_tab"));
  if (message.type === "editor:stop") { await stopEditors(message.tabId); return { active: false }; }
  if (message.type === "editor:get") {
    try { return await chrome.tabs.sendMessage(message.tabId, { target: "editor-page", type: "editor:status" }, { frameId: 0 }); } catch { return { active: false }; }
  }
  if (message.type !== "editor:start") throw new Error(t("page_editor_unknown_editing_operation"));
  const tab = await chrome.tabs.get(message.tabId);
  if (!/^https?:\/\//.test(tab.url || "")) throw new Error(t("common_try_again_on_regular_web_page"));
  const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: editPage });
  const state = result.find(item => item.frameId === 0)?.result;
  if (!state?.active) throw new Error(t("page_editor_could_not_open_page_editor"));
  await save([...new Set([...(await tracked()), tab.id])]);
  return state;
}
