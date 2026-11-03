import { installInfoBubble } from "./info-bubble.js";
import { inspectFonts } from "./font-inspector.js";
import { startColorInspector } from "./color-inspector.js";

const KEY = "whatsThisActivePicker";

// Runs in the tab and remains reachable after activeTab access expires.
export function installPickerControl() {
  const key = "__pluggWhatsThisPickerControl";
  if (globalThis[key]) return;
  const receive = (message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.target !== "whats-this-picker-control" || message.type !== "stop") return;
    globalThis.__pluggWhatsThisColorInspector?.();
    globalThis.__pluggWhatsThisFontInspector?.stop();
    reply({ ok: true });
  };
  chrome.runtime.onMessage.addListener(receive);
  globalThis[key] = true;
}

export async function stopWhatsThisPicker(tabId) {
  const current = (await chrome.storage.session.get(KEY))[KEY];
  if (!current || (tabId !== undefined && current.tabId !== tabId)) return;
  try { await chrome.tabs.sendMessage(current.tabId, { target: "whats-this-picker-control", type: "stop" }, { frameId: 0 }); }
  catch { /* The previous tab was closed, navigated or the inspector already stopped. */ }
  await chrome.storage.session.set({ [KEY]: null });
}

export async function startWhatsThisPicker(tabId, mode) {
  if (!Number.isInteger(tabId) || tabId < 0 || !["font", "color"].includes(mode)) throw new Error("Invalid picker request");
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) throw new Error("The tab is not active");
  await stopWhatsThisPicker();
  await chrome.storage.session.set({ [KEY]: { tabId, mode } });
  try {
    const target = { tabId };
    await chrome.scripting.executeScript({ target, func: installPickerControl });
    await chrome.scripting.executeScript({ target, func: installInfoBubble });
    if (mode === "color") {
      const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      await chrome.scripting.executeScript({ target, func: startColorInspector, args: [image] });
    } else {
      await chrome.scripting.executeScript({ target, func: inspectFonts, args: ["start"] });
    }
    return { active: true, tabId, mode };
  } catch (error) {
    await stopWhatsThisPicker(tabId);
    throw error;
  }
}
