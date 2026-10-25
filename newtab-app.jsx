import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { defaultNewTab, newWidget, normalizeNewTab, NEWTAB_KEY, WIDGET_TYPES, WIDGET_TITLES } from "./modules/newtab-settings.js";
import WidgetFrame from "./components/newtab/WidgetFrame.jsx";
import Icon from "./components/newtab/Icon.jsx";
import Clock from "./components/newtab/Clock.jsx";
import Shortcuts from "./components/newtab/Shortcuts.jsx";
import TodoList from "./components/newtab/TodoList.jsx";
import QuickNotes from "./components/newtab/QuickNotes.jsx";
import FocusTimer from "./components/newtab/FocusTimer.jsx";
import Weather from "./components/newtab/Weather.jsx";
import Search, { Filters } from "./components/newtab/Search.jsx";
import "./newtab.css";

const viewportSize = () => ({ width: Math.max(innerWidth, 320), height: Math.max(innerHeight, 500) });
const icons = { clock: "clock", search: "search", links: "link", todo: "todo", notes: "note", weather: "sun", focus: "play", filters: "filter" };
const descriptions = { clock: "Saat ve günün selamı", search: "Google ve gelişmiş arama", links: "Favori sitelerine hızlı erişim", todo: "Gününü küçük adımlara ayır", notes: "Aklındakileri hemen not al", weather: "Şehrindeki güncel hava", focus: "Bir işe zaman ayır", filters: "Site ve dosya türü filtreleri" };

function NewTabPage() {
  const [viewport, setViewport] = useState(viewportSize);
  const [config, setConfig] = useState(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const currentConfig = useRef(null);
  const saves = useRef(Promise.resolve());
  const pending = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const resize = () => setViewport(viewportSize());
    const apply = raw => { const next = normalizeNewTab(raw, viewportSize()); currentConfig.current = next; setConfig(next); };
    const listener = (changes, area) => { if (area === "local" && changes[NEWTAB_KEY] && !pending.current) apply(changes[NEWTAB_KEY].newValue); };
    window.addEventListener("resize", resize); chrome.storage.onChanged.addListener(listener);
    chrome.storage.local.get(NEWTAB_KEY).then(saved => { if (mounted.current) apply(saved[NEWTAB_KEY]); }).catch(() => { if (mounted.current) setMessage("Yerleşim okunamadı. Sayfayı yenile."); });
    const escape = event => { if (event.key === "Escape") setEditing(false); };
    window.addEventListener("keydown", escape);
    return () => { mounted.current = false; window.removeEventListener("resize", resize); window.removeEventListener("keydown", escape); chrome.storage.onChanged.removeListener(listener); };
  }, []);
  function update(patch) {
    const next = { ...currentConfig.current, ...patch };
    currentConfig.current = next; setConfig(next); setMessage("");
    pending.current++;
    saves.current = saves.current.catch(() => {}).then(() => chrome.storage.local.set({ [NEWTAB_KEY]: next })).catch(() => { if (mounted.current) setMessage("Değişiklik kaydedilemedi. Tekrar dene."); }).finally(() => pending.current--);
  }
  function changeWidget(next) { update({ items: currentConfig.current.items.map(item => item.id === next.id ? next : item) }); }
  function toggle(type) {
    const items = currentConfig.current.items;
    update({ items: items.some(item => item.type === type) ? items.filter(item => item.type !== type) : [...items, newWidget(type, viewport)] });
  }
  const props = { config, query, setQuery, update, onError: setMessage };
  function content(type) {
    switch (type) {
      case "clock": return <Clock />;
      case "search": return <Search {...props} />;
      case "filters": return <Filters {...props} />;
      case "links": return <Shortcuts editing={editing} />;
      case "todo": return <TodoList />;
      case "notes": return <QuickNotes />;
      case "focus": return <FocusTimer />;
      case "weather": return <Weather />;
    }
  }
  return <main id="newtab-workspace" className={editing ? "is-editing" : ""} style={{ width: viewport.width, height: viewport.height }}>
    <div className="nt-scenery" aria-hidden="true" />
    {!config && !message && <p className="nt-empty">Hazırlanıyor…</p>}
    {config && !config.items.length && <p className="nt-empty">Kendine ait bir alan. Çarktan bileşen ekleyebilirsin.</p>}
    {config?.items.map(item => <WidgetFrame key={item.id} item={item} editing={editing} viewport={viewport} onChange={changeWidget} onRemove={() => toggle(item.type)}>{content(item.type)}</WidgetFrame>)}
    {editing && <aside className="nt-settings" aria-label="Yeni sekmeyi özelleştir"><header><div><span className="nt-eyebrow">SANA AİT BİR ALAN</span><h1>Yeni sekmeni düzenle</h1></div><button className="nt-icon-button" aria-label="Düzenlemeyi bitir" onClick={() => setEditing(false)}><Icon name="close" /></button></header>
      <p className="nt-settings-intro">Bileşenleri ekle. Sürükleyerek yerini, köşesinden boyutunu değiştir.</p>
      <div className="nt-widget-options">{WIDGET_TYPES.map(type => { const enabled = config?.items.some(item => item.type === type); return <button id={`nt-add-${type}`} key={type} aria-pressed={!!enabled} onClick={() => toggle(type)}><span className="nt-option-icon"><Icon name={icons[type]} /></span><span><strong>{WIDGET_TITLES[type]}</strong><small>{descriptions[type]}</small></span><Icon name={enabled ? "check" : "plus"} /></button>; })}</div>
      <footer><span>Değişiklikler otomatik kaydedilir.</span><button className="nt-subtle" onClick={() => update({ items: defaultNewTab(viewport).items })}>Düzeni sıfırla</button></footer>
    </aside>}
    <button id="nt-edit" className="nt-gear" disabled={!config} aria-label={editing ? "Düzenlemeyi bitir" : "Yeni sekmeyi düzenle"} title="Yeni sekmeyi düzenle" aria-pressed={editing} onClick={() => setEditing(!editing)}><Icon name={editing ? "close" : "settings"} /></button>
    {message && <p className="nt-message" role="alert">{message}<button className="nt-icon-button" aria-label="Mesajı kapat" onClick={() => setMessage("")}><Icon name="close" /></button></p>}
  </main>;
}
export function mountNewTab() { createRoot(document.getElementById("newtab-root")).render(<NewTabPage />); }
