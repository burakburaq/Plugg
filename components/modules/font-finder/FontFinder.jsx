import { t } from "../../../modules/i18n.js";
import { useEffect, useState } from "react";

export default function FontFinder() {
  const [status, setStatus] = useState(t("common_preparing"));
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    let port;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!mounted) return;
        if (!Number.isInteger(tab?.id)) throw new Error();
        const connectionName = `font-finder:${crypto.randomUUID()}`;
        const response = await chrome.runtime.sendMessage({ target: "font-background", type: "font:prepare", tabId: tab.id, connectionName });
        if (!mounted) return;
        if (!response?.ok) throw new Error();
        // The page starts inspection only after this live connection is established.
        port = chrome.tabs.connect(tab.id, { name: connectionName, frameId: 0 });
        port.onMessage.addListener(message => {
          if (mounted) setStatus(message.active ? t("font_finder_hover_over_text") : t("font_finder_font_finder_is_off"));
        });
        port.onDisconnect.addListener(() => {
          const failure = chrome.runtime.lastError;
          if (!mounted) return;
          setStatus(t("font_finder_font_finder_is_off"));
          if (failure) setError(t("font_finder_could_not_connect_to_page"));
        });
      } catch {
        if (mounted) {
          setStatus(t("font_finder_unavailable_on_this_page"));
          setError(t("font_finder_try_regular_web_page"));
        }
      }
    })();
    return () => { mounted = false; port?.disconnect(); };
  }, []);

  return <section id="font-view" className="tool-content">
    <div className="font-preview"><span aria-hidden="true">{"" + t("font_finder_aa") + ""}</span><p aria-live="polite">{status}</p></div>
    <p className="tool-description">{"" + t("font_finder_hover_over_text_while_this_screen_is") + ""}</p>
    <p className="muted">{"" + t("font_finder_font_finder_closes_when_you_return_to") + ""}</p>
    {error && <p id="font-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
