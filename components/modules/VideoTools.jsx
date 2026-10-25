import { useEffect, useRef, useState } from "react";
import Button from "../Button.jsx";
export default function VideoTools() {
  const tabId = useRef();
  const [active, setActive] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId.current = tab?.id;
        const response = await chrome.runtime.sendMessage({ target: "video-background", type: "video:get", tabId: tab?.id });
        if (!response?.ok) throw new Error(response?.error || "Sekme okunamadı.");
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
      if (!response?.ok) throw new Error(response?.error || "Video araçları açılamadı.");
      setActive(!!response.state?.active);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section id="video-view" className="tool-content">
    <Button id="video-tools-toggle" variant="primary" disabled={!ready || busy} onClick={toggle}>{active ? "Video araçlarını kapat" : "Video araçlarını aç"}</Button>
    <p className="muted">Videonun üst ortasındaki ZOOM düğmesi yakınlaştırmayı açıp kapatır. Çarktan en boy ve görüntü ayarlarını düzenle.</p>
    <p className="muted">Popup kapansa da bu sekmede çalışır. Sayfa yenilenince kapanır; siteye kaydettiğin ayarlar sonraki manuel açılışta yüklenir.</p>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
