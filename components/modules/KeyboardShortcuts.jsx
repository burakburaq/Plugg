import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import { CUSTOM_COMMANDS, SHORTCUT_ACTIONS, SHORTCUT_CONDITIONS } from "../../modules/shortcut-settings.js";

function ShortcutIcon({ action, settings = false }) {
  const paths = {
    "previous-tab": "M19 4v5a4 4 0 0 1-4 4H4m5-5-5 5 5 5",
    "tab-left": "M20 12H4m7-7-7 7 7 7",
    "tab-right": "M4 12h16m-7-7 7 7-7 7",
    "new-tab": "M12 4v16M4 12h16",
    "duplicate-tab": "M8 8h12v12H8V8ZM4 16V4h12",
    "open-url": "M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={settings ? "M3 6h5m4 0h9M3 12h10m4 0h4M3 18h3m4 0h11M10 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-7 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" : paths[action]} /></svg>;
}
function Condition({ name, value, disabled, onChange }) {
  return <label className="shortcut-condition"><span>Koşul</span><select aria-label={`${name} koşulu`} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
    {Object.entries(SHORTCUT_CONDITIONS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
  </select></label>;
}
const BUILTINS = [
  { command: "previous-tab", name: "Önceki sekmeye dön", action: "previous-tab", description: "Son kullanılan iki sekme arasında geçiş" },
  { command: "tab-left", name: "Sekme çubuğunda sola git", action: "tab-left" },
  { command: "tab-right", name: "Sekme çubuğunda sağa git", action: "tab-right" }
];
const keyLabel = value => (value || "Atanmamış").replaceAll("+", " + ");
const DRAFT_KEY = "shortcutFormDraft";

export default function KeyboardShortcuts() {
  const [state, setState] = useState(null);
  const [name, setName] = useState("");
  const [action, setAction] = useState("previous-tab");
  const [url, setUrl] = useState("");
  const [newCondition, setNewCondition] = useState("not-typing");
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const refresh = () => chrome.runtime.sendMessage({ target: "shortcuts-background", type: "shortcuts:get" }).then(response => {
      if (!mounted) return;
      if (response?.ok) setState(response.state);
      else setError(response?.error || "Kısayollar okunamadı.");
    }).catch(() => { if (mounted) setError("Eklentiyi Chrome'da yenileyip tekrar dene."); });
    refresh();
    chrome.storage.session.get(DRAFT_KEY).then(saved => {
      const draft = saved[DRAFT_KEY];
      if (!mounted || !draft) return;
      if (typeof draft.name === "string") setName(draft.name.slice(0, 60));
      if (Object.hasOwn(SHORTCUT_ACTIONS, draft.action)) setAction(draft.action);
      if (typeof draft.url === "string") setUrl(draft.url);
      if (Object.hasOwn(SHORTCUT_CONDITIONS, draft.condition)) setNewCondition(draft.condition);
    }).catch(() => {});
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { mounted = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, []);
  async function change(type, extra) {
    setBusy(true); setError("");
    try {
      const response = await chrome.runtime.sendMessage({ target: "shortcuts-background", type, ...extra });
      if (!response?.ok) throw new Error(response?.error || "Kısayol kaydedilemedi.");
      setState(response.state);
      if (type === "shortcuts:add") { setName(""); setUrl(""); setExpanded(null); await chrome.storage.session.remove(DRAFT_KEY); }
      if (type === "shortcuts:remove") setExpanded(null);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const available = CUSTOM_COMMANDS.find(command => !state?.shortcuts.some(item => item.command === command));
  async function openBindings() {
    try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); }
    catch { setError("Chrome kısayol ekranı açılamadı."); }
  }
  async function editNewBinding() {
    try {
      await chrome.storage.session.set({ [DRAFT_KEY]: { name, action, url, condition: newCondition } });
      await openBindings();
    } catch { setError("Form bilgileri korunamadı. Tekrar dene."); }
  }
  function settingsButton(id, title) {
    return <Button variant="control" className="shortcut-settings" aria-label={`${title} ayarları`} aria-expanded={expanded === id} aria-controls={`shortcut-settings-${id}`} onClick={() => setExpanded(expanded === id ? null : id)}><ShortcutIcon settings /></Button>;
  }
  function row(item, custom = false) {
    const condition = state.conditions[item.command];
    const description = condition === "always" ? item.description || SHORTCUT_ACTIONS[item.action] : SHORTCUT_CONDITIONS[condition];
    return <article className="shortcut-row" key={item.command}>
      <div className="shortcut-row-heading">
        <span className="shortcut-grip" aria-hidden="true"><svg viewBox="0 0 10 18">{[3, 9, 15].flatMap(y => [2, 8].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />))}</svg></span>
        <span className="shortcut-action-icon"><ShortcutIcon action={item.action} /></span>
        <div className="shortcut-info"><strong title={item.name}>{item.name}</strong><p title={description}>{description}</p></div>
        <Button className="shortcut-binding" disabled={busy} aria-label={`${item.name} tuşlarını değiştir`} title={custom ? `Özel kısayol ${item.command.split("-")[1]} tuşlarını Chrome'da değiştir` : "Tuşları Chrome'da değiştir"} onClick={openBindings}><kbd>{keyLabel(state.bindings[item.command])}</kbd></Button>
        {settingsButton(item.command, item.name)}
      </div>
      {expanded === item.command && <div className="shortcut-options" id={`shortcut-settings-${item.command}`}>
        <Condition name={item.name} value={condition} disabled={busy} onChange={condition => change("shortcuts:condition", { command: item.command, condition })} />
        {custom && <Button className="shortcut-delete" disabled={busy} aria-label={`${item.name} kısayolunu sil`} onClick={() => change("shortcuts:remove", { command: item.command })}>Kısayolu sil</Button>}
      </div>}
    </article>;
  }
  return <section id="shortcuts-view" className="tool-content">
    {state && <>
      <div className="shortcut-list">{BUILTINS.map(item => row(item))}{state.shortcuts.map(item => row(item, true))}</div>
      {available && <form className="shortcut-form" onSubmit={event => { event.preventDefault(); change("shortcuts:add", { shortcut: { command: available, name, action, url }, condition: newCondition }); }}>
        <div className="field"><div className="field-heading"><label htmlFor="shortcut-name">Kısayol adı</label>{settingsButton("new", "Yeni kısayol")}</div><input id="shortcut-name" type="text" placeholder="Örn. Sekmeye dön" maxLength={60} required value={name} onChange={event => setName(event.target.value)} /></div>
        <div className="shortcut-form-grid">
          <div className="field"><label htmlFor="shortcut-action">İşlem</label><select id="shortcut-action" value={action} onChange={event => setAction(event.target.value)}>{Object.entries(SHORTCUT_ACTIONS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></div>
          <div className="field"><span>Kısayol</span><Button variant="control" className="shortcut-key-field" aria-label={`Özel kısayol ${available.split("-")[1]} tuşlarını ayarla`} title={`Chrome ekranında Özel kısayol ${available.split("-")[1]} atamasını düzenle`} onClick={editNewBinding}><span>Chrome'da ayarla</span><kbd>{keyLabel(state.bindings[available])}</kbd></Button></div>
        </div>
        {action === "open-url" && <div className="field"><label htmlFor="shortcut-url">Bağlantı</label><input id="shortcut-url" type="text" placeholder="https://…" required value={url} onChange={event => setUrl(event.target.value)} /></div>}
        {expanded === "new" && <div className="shortcut-options" id="shortcut-settings-new"><Condition name="Yeni kısayol" value={newCondition} disabled={busy} onChange={setNewCondition} /></div>}
        <Button type="submit" variant="secondary" className="shortcut-add" disabled={busy || !name.trim()}>Kısayol ekle</Button>
      </form>}
      <Button variant="secondary" onClick={openBindings}>Tuşları Chrome'da ayarla ↗</Button>
    </>}
    {!state && !error && <p className="muted">Yükleniyor…</p>}
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
