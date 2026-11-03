import { t, uiLocale } from "../../../modules/i18n.js";
import { loadPluggFont } from "../../../modules/ui-font.js";
import { LAYOUT_KEY, normalizeLayout } from "../../../modules/module-layout.js";
import { FLAG_CACHE_KEY, FLAG_CHANNEL_KEY, FEATURE_FLAGS, currentFlags } from "../../../modules/feature-flags.js";

document.documentElement.lang = /^tr(?:[-_]|$)/i.test(uiLocale()) ? "tr" : "en";
document.title = t("common_new_tab");

async function nativePage() {
  const tab = await chrome.tabs.getCurrent();
  if (!Number.isInteger(tab?.id)) throw new Error("Yeni sekme bulunamadı.");
  await chrome.tabs.update(tab.id, { url: "chrome://new-tab-page/" });
}
async function newTabEnabled() {
  const [stored, flags] = await Promise.all([chrome.storage.local.get(LAYOUT_KEY), currentFlags()]);
  return flags[FEATURE_FLAGS.newtab] > 0 && normalizeLayout(stored[LAYOUT_KEY]).active.includes("newtab");
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes[LAYOUT_KEY] || changes[FLAG_CACHE_KEY] || changes[FLAG_CHANNEL_KEY])) {
    void newTabEnabled().then(enabled => { if (!enabled) return nativePage(); }).catch(() => {});
  }
});

try {
  if (await newTabEnabled()) {
    const { mountNewTab } = await import("./newtab-app.jsx");
    await loadPluggFont();
    mountNewTab();
  } else await nativePage();
} catch {
  try { await nativePage(); }
  catch { document.getElementById("newtab-root").textContent = t("new_tab_could_not_open_new_tab_2"); }
}
