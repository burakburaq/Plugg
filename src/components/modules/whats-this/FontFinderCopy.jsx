import { t } from "../../../modules/i18n.js";
import { useEffect, useState } from "react";
import Toggle from "../../Toggle.jsx";

export default function FontFinder() {
  const [keepIndicators, setKeepIndicators] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    chrome.storage.local.get("keepFontIndicators").then(result => {
      if (mounted) setKeepIndicators(result.keepFontIndicators === true);
    }).catch(() => {});
    const listener = (changes, area) => {
      if (area === "local" && changes.keepFontIndicators) setKeepIndicators(changes.keepFontIndicators.newValue === true);
    };
    chrome.storage.onChanged.addListener(listener);
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!mounted) return;
        if (!Number.isInteger(tab?.id)) throw new Error();
        const response = await chrome.runtime.sendMessage({ target: "whats-this-picker-background", type: "start", tabId: tab.id, mode: "font" });
        if (!response?.ok) throw new Error();
      } catch {
        if (mounted) {
          setError(t("font_finder_try_regular_web_page"));
        }
      }
    })();
    return () => { mounted = false; chrome.storage.onChanged.removeListener(listener); };
  }, []);

  return <section id="font-view" className="tool-content">
    <div className="color-indicator-setting">
      <span id="keep-font-indicators-label">{t("whats_this_keep_font_indicators")}</span>
      <Toggle aria-labelledby="keep-font-indicators-label" checked={keepIndicators} onChange={value => {
        setKeepIndicators(value);
        void chrome.storage.local.set({ keepFontIndicators: value }).catch(() => setKeepIndicators(!value));
      }} />
    </div>
    {error && <p id="font-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
