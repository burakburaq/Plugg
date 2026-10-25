import { useEffect, useRef, useState } from "react";
import Button from "../Button.jsx";

export default function ColorPicker() {
  const [color, setColor] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selection = useRef();
  useEffect(() => {
    let mounted = true;
    chrome.storage.local.get("pickedColor").then(({ pickedColor }) => {
      if (mounted && /^#[\da-f]{6}$/i.test(pickedColor)) setColor(pickedColor);
    }).catch(() => {});
    return () => { mounted = false; selection.current?.abort(); };
  }, []);
  const rgb = `rgb(${[1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).join(", ")})`;
  async function pick() {
    if (busy) return;
    setBusy(true); setMessage("");
    selection.current = new AbortController();
    try {
      const result = await new EyeDropper().open({ signal: selection.current.signal });
      setColor(result.sRGBHex.toLowerCase());
      await chrome.storage.local.set({ pickedColor: result.sRGBHex.toLowerCase() });
    } catch (error) {
      if (error.name !== "AbortError") setMessage("Renk seçilemedi. Tekrar deneyebilirsin.");
    } finally { setBusy(false); }
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setMessage("Kopyalandı."); }
    catch { setMessage("Panoya kopyalanamadı."); }
  }
  return <section id="color-view" className="tool-content">
    <div className="color-preview" style={{ backgroundColor: color }} aria-label={`Seçilen renk: ${color}`} />
    <Button id="pick-color" variant="primary" disabled={busy || !globalThis.EyeDropper} onClick={pick}>{busy ? "Renk seçiliyor…" : "Ekrandan renk seç"}</Button>
    <div className="color-value"><code>{color.toUpperCase()}</code><Button onClick={() => copy(color.toUpperCase())}>HEX kopyala</Button></div>
    <div className="color-value"><code>{rgb}</code><Button onClick={() => copy(rgb)}>RGB kopyala</Button></div>
    <p className="muted">Seçmek için bir piksele tıkla. Esc ile iptal edebilirsin.</p>
    {!globalThis.EyeDropper && <p className="tool-error">Bu tarayıcı ekran renk seçicisini desteklemiyor.</p>}
    {message && <p role="status" className="muted">{message}</p>}
  </section>;
}
