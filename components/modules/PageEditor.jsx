import { useEffect, useRef, useState } from "react";
import Button from "../Button.jsx";
export default function PageEditor() {
  const tabId = useRef();
  const [active, setActive] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId.current = tab?.id;
        const response = await chrome.runtime.sendMessage({ target: "editor-background", type: "editor:get", tabId: tab?.id });
        if (!response?.ok) throw new Error(response?.error || "Sayfa okunamadı.");
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
      if (!response?.ok) throw new Error(response?.error || "Editör açılamadı.");
      setActive(!!response.state?.active);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section id="editor-view" className="tool-content">
    <Button id="page-editor-toggle" variant="primary" disabled={!ready || busy} onClick={toggle}>{active ? "Düzenlemeyi bitir" : "Metin düzenlemeyi aç"}</Button>
    <p className="muted">Metne tıklayıp değiştir. Düzenleme sırasında sol tıkla link açılması engellenir. Esc veya sayfadaki Bitir düğmesi linkleri yeniden etkinleştirir.</p>
    <p className="muted">Değişiklikler bu sekmede geçicidir; sayfa yenilenince silinir.</p>
    {message && <p className="tool-error" role="alert">{message}</p>}
  </section>;
}
