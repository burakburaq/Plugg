import { t } from "../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import Button from "../../Button.jsx";
export default function PageEditor() {
  const tabId = useRef();
  const [active, setActive] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId.current = tab?.id;
        const response = await chrome.runtime.sendMessage({ target: "editor-background", type: "editor:get", tabId: tab?.id });
        if (!response?.ok) throw new Error(response?.error || t("page_editor_could_not_read_page"));
        if (mounted) { setActive(!!response.state?.active); setReady(true); }
      } catch (error) { if (mounted) setMessage(error.message); }
    })();
    const listener = (message, sender) => { if (sender.id === chrome.runtime.id && sender.tab?.id === tabId.current && message.target === "editor-background" && message.type === "editor:state") setActive(!!message.active); };
    chrome.runtime.onMessage.addListener(listener);
    return () => { mounted = false; chrome.runtime.onMessage.removeListener(listener); };
  }, []);
  async function toggle() {
    setBusy(true); setMessage("");
    try {
      const response = await chrome.runtime.sendMessage({ target: "editor-background", type: active ? "editor:stop" : "editor:start", tabId: tabId.current });
      if (!response?.ok) throw new Error(response?.error || t("page_editor_could_not_open_editor"));
      setActive(!!response.state?.active);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section id="editor-view" className="tool-content">
    <Button id="page-editor-toggle" variant="primary" disabled={!ready || busy} onClick={toggle}>{active ? t("common_finish_editing") : t("page_editor_edit_text")}</Button>
    <p className="muted">{"" + t("page_editor_click_text_to_change_it") + ""}</p>
    <p className="muted">{"" + t("page_editor_changes_are_temporary_in_this_tab_and") + ""}</p>
    {message && <p className="tool-error" role="alert">{message}</p>}
  </section>;
}
