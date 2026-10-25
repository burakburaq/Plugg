import { useState } from "react";
import Button from "../Button.jsx";

export default function QrCreator({ draft, onDraftChange }) {
  const [error, setError] = useState("");
  const update = patch => onDraftChange(current => ({ ...current, ...patch }));
  async function useCurrentTab() {
    setError("");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) throw new Error();
      update({ type: "url", text: tab.url.slice(0, 2000) });
    } catch { setError("Açık sayfanın bağlantısı alınamadı."); }
  }
  return <section id="qr-view" className="tool-content">
    <div className="module-toolbar"><span className="view-badge">Tasarım</span></div>
    <div className="field"><label htmlFor="qr-type">İçerik türü</label><select id="qr-type" value={draft.type} onChange={event => update({ type: event.target.value })}><option value="url">Bağlantı</option><option value="text">Metin</option></select></div>
    <div className="field"><div className="field-heading"><label htmlFor="qr-text">İçerik</label><Button id="qr-current-tab" onClick={useCurrentTab}>Açık sayfayı kullan</Button></div>
      <textarea id="qr-text" rows="3" maxLength="2000" value={draft.text} placeholder={draft.type === "url" ? "https://ornek.com" : "QR içeriğini yaz…"} onChange={event => update({ text: event.target.value })} />
      <span id="qr-count" className="muted">{draft.text.length} / 2000</span>
    </div>
    <div className="field-grid">
      <div className="field"><label htmlFor="qr-size">Boyut</label><select id="qr-size" value={draft.size} onChange={event => update({ size: event.target.value })}><option>256 × 256</option><option>512 × 512</option><option>1024 × 1024</option></select></div>
      <div className="field"><label htmlFor="qr-correction">Hata düzeltme</label><select id="qr-correction" value={draft.correction} onChange={event => update({ correction: event.target.value })}><option value="L">Düşük</option><option value="M">Orta</option><option value="Q">Yüksek</option><option value="H">En yüksek</option></select></div>
    </div>
    <div className="field-grid">
      <div className="color-field"><label htmlFor="qr-foreground">QR rengi</label><input id="qr-foreground" type="color" value={draft.foreground} onChange={event => update({ foreground: event.target.value })} /></div>
      <div className="color-field"><label htmlFor="qr-background">Arka plan</label><input id="qr-background" type="color" value={draft.background} onChange={event => update({ background: event.target.value })} /></div>
    </div>
    <div className="qr-preview" aria-label="QR önizleme alanı"><span aria-hidden="true">▦</span><p>QR önizlemesi burada görünecek</p></div>
    <p className="muted">QR üretimi henüz etkin değil.</p>
    <div className="button-row"><Button variant="primary" disabled>QR oluştur</Button><Button variant="secondary" disabled>PNG indir</Button></div>
    {error && <p id="qr-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
