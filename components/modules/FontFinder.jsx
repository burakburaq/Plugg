import { useEffect, useState } from "react";

export default function FontFinder() {
  const [status, setStatus] = useState("Hazırlanıyor…");
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
          if (mounted) setStatus(message.active ? "Yazıların üzerinde gezin" : "Font bulucu kapalı");
        });
        port.onDisconnect.addListener(() => {
          const failure = chrome.runtime.lastError;
          if (!mounted) return;
          setStatus("Font bulucu kapalı");
          if (failure) setError("Sayfaya bağlanılamadı. Modülü kapatıp tekrar açabilirsin.");
        });
      } catch {
        if (mounted) {
          setStatus("Bu sayfada kullanılamıyor");
          setError("Normal bir web sayfasında tekrar dene. Chrome sayfaları ve Web Mağazası font incelemesine izin vermez.");
        }
      }
    })();
    return () => { mounted = false; port?.disconnect(); };
  }, []);

  return <section id="font-view" className="tool-content">
    <div className="font-preview"><span aria-hidden="true">Aa</span><p aria-live="polite">{status}</p></div>
    <p className="tool-description">Bu ekran açıkken sayfadaki yazıların üzerine gel. Font adı, boyutu ve kalınlığı imlecin yanında görünür.</p>
    <p className="muted">Menüye dönünce veya popup kapanınca font bulucu kapanır.</p>
    {error && <p id="font-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
