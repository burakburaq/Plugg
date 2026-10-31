import { t } from "../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import Button from "../../Button.jsx";
export default function VideoTools() {
  const tabId = useRef();
  const [active, setActive] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId.current = tab?.id;
        const response = await chrome.runtime.sendMessage({ target: "video-background", type: "video:get", tabId: tab?.id });
        if (!response?.ok) throw new Error(response?.error || t("video_tools_could_not_read_tab"));
        if (mounted) { setActive(!!response.state?.active); setReady(true); }
      } catch (err) { if (mounted) setError(err.message); }
    })();
    const listener = (message, sender) => { if (sender.id === chrome.runtime.id && sender.tab?.id === tabId.current && message.target === "video-background" && message.type === "video:state" && mounted) setActive(!!message.active); };
    chrome.runtime.onMessage.addListener(listener);
    return () => { mounted = false; chrome.runtime.onMessage.removeListener(listener); };
  }, []);
  async function toggle() {
    setBusy(true); setError("");
    try {
      const response = await chrome.runtime.sendMessage({ target: "video-background", type: active ? "video:stop" : "video:start", tabId: tabId.current });
      if (!response?.ok) throw new Error(response?.error || t("video_tools_could_not_open_video_tools"));
      setActive(!!response.state?.active);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section id="video-view" className="tool-content">
    <Button id="video-tools-toggle" variant="primary" disabled={!ready || busy} onClick={toggle}>{active ? t("video_tools_close_video_tools") : t("video_tools_open_video_tools")}</Button>
    <p className="muted">{"" + t("video_tools_zoom_button_above_video_toggles_zoom") + ""}</p>
    <p className="muted">{"" + t("video_tools_works_in_this_tab_even_when_popup") + ""}</p>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
