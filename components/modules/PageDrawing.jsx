import { useEffect, useRef, useState } from "react";
import Button from "../Button.jsx";
import Toggle from "../Toggle.jsx";

async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ target: "drawing-background", type, ...extra });
  if (!response?.ok) throw new Error(response?.error || "Çizim modülüne bağlanılamadı.");
  return response.state;
}

export default function PageDrawing() {
  const [state, setState] = useState({ active: false, editing: false, strokeCount: 0 });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const tabId = useRef();
  const pending = useRef(false);
  const mounted = useRef(false);
  async function library() {
    const result = await request("draw:library");
    if (mounted.current) { setItems(result.items); setAutomatic(result.automatic); }
  }
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!Number.isInteger(tab?.id) || !/^https?:\/\//.test(tab.url || "")) throw new Error("Normal bir web sayfasında tekrar dene.");
        tabId.current = tab.id;
        const result = await request("draw:get", { tabId: tab.id });
        await library();
        if (mounted.current) { setState(result); setReady(true); }
      } catch (error) { if (mounted.current) setMessage(error.message); }
    })();
    const listener = (message, sender) => {
      if (sender.id === chrome.runtime.id && sender.tab?.id === tabId.current && message.target === "drawing-popup") setState(message.state);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => { mounted.current = false; chrome.runtime.onMessage.removeListener(listener); };
  }, []);

  async function run(action) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { if (mounted.current) setMessage(error.message); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function pageAction(type, extra = {}) {
    const response = await chrome.tabs.sendMessage(tabId.current, { target: "drawing-page", type, ...extra }, { frameId: 0 });
    if (!response?.ok) throw new Error(response?.error || "Önce çizim modunu aç.");
    return response.state;
  }
  async function start(key) {
    const result = await request("draw:start", { tabId: tabId.current, key });
    if (mounted.current) setState(result);
  }
  async function changeAutomatic() {
    if (busy || !ready) return;
    // Request inside the click handler so Chrome can show its permission prompt.
    const permission = automatic ? Promise.resolve(true) : chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] });
    await run(async () => {
      if (!await permission) throw new Error("Site erişimi verilmedi. Manuel çizim kullanabilirsin.");
      const result = await request("draw:automatic", { enabled: !automatic });
      if (mounted.current) setAutomatic(result.automatic);
    });
  }
  const disabled = !ready || busy;
  return <section id="drawing-view" className="tool-content">
    <div className="button-row">
      <Button id="drawing-start" variant="primary" disabled={disabled} onClick={() => run(() => start())}>{state.editing ? "Çizime devam et" : "Çizim modunu aç"}</Button>
      <Button id="drawing-stop" variant="secondary" disabled={disabled || !state.active} onClick={() => run(async () => setState(await request("draw:stop", { tabId: tabId.current })))}>Kapat</Button>
    </div>
    <p className="muted">{state.active ? `${state.strokeCount} çizgi · ${state.editing ? "Çizim açık" : "Görüntüleme"}` : "Çizim kapalı"}. Sayfadaki araç çubuğuyla çiz. Çizgiler bu URL’ye otomatik kaydedilir.</p>
    <div className="button-row">
      <Button id="drawing-save-url" variant="secondary" disabled={disabled || !state.active} onClick={() => run(async () => { await pageAction("draw:save-url"); setMessage("Bu URL’ye kaydedildi."); })}>URL’ye kaydet</Button>
      <Button id="drawing-export" variant="secondary" disabled={disabled || !state.active} onClick={() => run(() => pageAction("draw:export"))}>PNG indir</Button>
    </div>
    <div className="field"><label htmlFor="drawing-name">URL’den bağımsız kayıt</label>
      <input id="drawing-name" type="text" maxLength="80" value={name} placeholder="Kayıt adı" onChange={event => setName(event.target.value)} />
      <Button id="drawing-custom-save" variant="secondary" disabled={disabled || !state.active || !name.trim()} onClick={() => run(async () => { await pageAction("draw:save-custom", { name }); await library(); setName(""); setMessage("Özel kayıt oluşturuldu."); })}>Özel kaydet</Button>
    </div>
    <div className="field"><label htmlFor="drawing-saved">Kayıtlı çizimler</label>
      <select id="drawing-saved" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Bir kayıt seç</option>{items.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select>
      <div className="button-row">
        <Button id="drawing-custom-load" variant="secondary" disabled={disabled || !selected} onClick={() => run(() => start(selected))}>Sayfaya yükle</Button>
        <Button id="drawing-custom-delete" variant="secondary" disabled={disabled || !selected} onClick={() => run(async () => { await request("draw:delete-custom", { key: selected }); setSelected(""); await library(); })}>Kaydı sil</Button>
      </div>
    </div>
    <div className="field-heading"><span>Çizilmiş sayfalarda otomatik göster</span><Toggle id="drawing-automatic" checked={automatic} disabled={disabled} onChange={changeAutomatic} aria-label="Çizimleri otomatik geri yükle" /></div>
    {message && <p id="drawing-message" className="muted" role="status">{message}</p>}
  </section>;
}
