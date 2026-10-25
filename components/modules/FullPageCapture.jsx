import { useState } from "react";
import Button from "../Button.jsx";
export default function FullPageCapture() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function capture() {
    const permission = chrome.permissions.request({ permissions: ["debugger", "downloads"] });
    setBusy(true); setMessage("");
    try {
      if (!await permission) throw new Error("Ekran görüntüsü izni verilmedi.");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.runtime.sendMessage({ target: "page-tools-background", type: "capture:full", tabId: tab?.id });
      if (!response?.ok) throw new Error(response?.error || "Görüntü alınamadı.");
      setMessage(`${response.state.width} × ${response.state.height} · PNG indiriliyor.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section id="capture-view" className="tool-content">
    <Button id="capture-full-page" variant="primary" disabled={busy} onClick={capture}>{busy ? "Görüntü alınıyor…" : "Tüm sayfayı PNG indir"}</Button>
    <p className="muted">Sayfanın tamamı tek parça PNG olarak indirilir. Görüntü alınırken Chrome kısa süreli hata ayıklama bildirimi gösterir.</p>
    {message && <p role="status" className="tool-description">{message}</p>}
  </section>;
}
