import { t, uiLocale } from "../../../modules/i18n.js";
import { loadPluggFont } from "../../../modules/ui-font.js";
import { LAYOUT_KEY, normalizeLayout } from "../../../modules/module-layout.js";

document.documentElement.lang = /^tr(?:[-_]|$)/i.test(uiLocale()) ? "tr" : "en";
document.title = t("common_new_tab");

async function nativePage() {
  const tab = await chrome.tabs.getCurrent();
  if (!Number.isInteger(tab?.id)) throw new Error("Yeni sekme bulunamadı.");
  await chrome.tabs.update(tab.id, { url: "chrome://new-tab-page/" });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[LAYOUT_KEY] && !normalizeLayout(changes[LAYOUT_KEY].newValue).active.includes("newtab")) void nativePage().catch(() => {});
});

try {
  const stored = await chrome.storage.local.get(LAYOUT_KEY);
  if (normalizeLayout(stored[LAYOUT_KEY]).active.includes("newtab")) {
    const { mountNewTab } = await import("./newtab-app.jsx");
    await loadPluggFont();
    mountNewTab();
  } else await nativePage();
} catch {
  try { await nativePage(); }
  catch { document.getElementById("newtab-root").textContent = t("new_tab_could_not_open_new_tab_2"); }
}
