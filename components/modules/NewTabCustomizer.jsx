import { useState } from "react";
import Button from "../Button.jsx";

export default function NewTabCustomizer() {
  const [error, setError] = useState("");
  async function open() {
    try { await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") }); }
    catch { setError("Yeni sekme açılamadı."); }
  }
  return <section id="newtab-view" className="tool-content">
    <Button id="open-newtab" variant="primary" onClick={open}>Yeni sekmeyi aç</Button>
    <p className="muted">Yeni sekmedeki çarktan saat, arama, kısayollar, yapılacaklar, hızlı notlar, hava durumu ve odak süresi ekleyebilirsin. Öğeler taşınabilir ve boyutlandırılabilir; düzen otomatik kaydedilir.</p>
    <p className="muted">Yeni sekmeler bu modül aktifken özelleştirilir.</p>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
