import { t } from "../../../modules/i18n.js";
import { useEffect, useState } from "react";
import Button from "../../Button.jsx";
import { CUSTOM_COMMANDS, SHORTCUT_ACTIONS, SHORTCUT_CONDITIONS } from "./shortcut-settings.js";

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
  return <label className="shortcut-condition"><span>{"" + t("shortcuts_condition") + ""}</span><select aria-label={t("shortcuts_value1_condition", name)} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
    {Object.entries(SHORTCUT_CONDITIONS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
  </select></label>;
}
const BUILTINS = [
  { command: "previous-tab", name: t("shortcuts_return_to_previous_tab"), action: "previous-tab", description: t("shortcuts_switch_between_last_two_tabs") },
  { command: "tab-left", name: t("shortcuts_move_left_in_tab_bar"), action: "tab-left" },
  { command: "tab-right", name: t("shortcuts_move_right_in_tab_bar"), action: "tab-right" }
];
const keyLabel = value => (value || t("shortcuts_unassigned")).replaceAll("+", " + ");
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
      else setError(response?.error || t("shortcuts_could_not_read_shortcuts"));
    }).catch(() => { if (mounted) setError(t("shortcuts_reload_extension_in_chrome_and_try_again")); });
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
      if (!response?.ok) throw new Error(response?.error || t("shortcuts_could_not_save_shortcut"));
      setState(response.state);
      if (type === "shortcuts:add") { setName(""); setUrl(""); setExpanded(null); await chrome.storage.session.remove(DRAFT_KEY); }
      if (type === "shortcuts:remove") setExpanded(null);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const available = CUSTOM_COMMANDS.find(command => !state?.shortcuts.some(item => item.command === command));
  async function openBindings() {
    try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); }
    catch { setError(t("shortcuts_could_not_open_chrome_shortcuts")); }
  }
  async function editNewBinding() {
    try {
      await chrome.storage.session.set({ [DRAFT_KEY]: { name, action, url, condition: newCondition } });
      await openBindings();
    } catch { setError(t("shortcuts_could_not_preserve_form")); }
  }
  function settingsButton(id, title) {
    return <Button variant="control" className="shortcut-settings" aria-label={t("shortcuts_value1_settings", title)} aria-expanded={expanded === id} aria-controls={`shortcut-settings-${id}`} onClick={() => setExpanded(expanded === id ? null : id)}><ShortcutIcon settings /></Button>;
  }
  function row(item, custom = false) {
    const condition = state.conditions[item.command];
    const description = condition === "always" ? item.description || SHORTCUT_ACTIONS[item.action] : SHORTCUT_CONDITIONS[condition];
    return <article className="shortcut-row" key={item.command}>
      <div className="shortcut-row-heading">
        <span className="shortcut-grip" aria-hidden="true"><svg viewBox="0 0 10 18">{[3, 9, 15].flatMap(y => [2, 8].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />))}</svg></span>
        <span className="shortcut-action-icon"><ShortcutIcon action={item.action} /></span>
        <div className="shortcut-info"><strong title={item.name}>{item.name}</strong><p title={description}>{description}</p></div>
        <Button className="shortcut-binding" disabled={busy} aria-label={t("shortcuts_change_value1_keys", item.name)} title={custom ? t("shortcuts_change_custom_shortcut_value1_keys_in_chrome", item.command.split("-")[1]) : t("shortcuts_change_keys_in_chrome")} onClick={openBindings}><kbd>{keyLabel(state.bindings[item.command])}</kbd></Button>
        {settingsButton(item.command, item.name)}
      </div>
      {expanded === item.command && <div className="shortcut-options" id={`shortcut-settings-${item.command}`}>
        <Condition name={item.name} value={condition} disabled={busy} onChange={condition => change("shortcuts:condition", { command: item.command, condition })} />
        {custom && <Button className="shortcut-delete" disabled={busy} aria-label={t("shortcuts_delete_value1_shortcut", item.name)} onClick={() => change("shortcuts:remove", { command: item.command })}>{"" + t("shortcuts_delete_shortcut") + ""}</Button>}
      </div>}
    </article>;
  }
  return <section id="shortcuts-view" className="tool-content">
    {state && <>
      <div className="shortcut-list">{BUILTINS.map(item => row(item))}{state.shortcuts.map(item => row(item, true))}</div>
      {available && <form className="shortcut-form" onSubmit={event => { event.preventDefault(); change("shortcuts:add", { shortcut: { command: available, name, action, url }, condition: newCondition }); }}>
        <div className="field"><div className="field-heading"><label htmlFor="shortcut-name">{"" + t("shortcuts_shortcut_name") + ""}</label>{settingsButton("new", t("shortcuts_new_shortcut"))}</div><input id="shortcut-name" type="text" placeholder={t("shortcuts_e")} maxLength={60} required value={name} onChange={event => setName(event.target.value)} /></div>
        <div className="shortcut-form-grid">
          <div className="field"><label htmlFor="shortcut-action">{"" + t("shortcuts_action") + ""}</label><select id="shortcut-action" value={action} onChange={event => setAction(event.target.value)}>{Object.entries(SHORTCUT_ACTIONS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></div>
          <div className="field"><span>{"" + t("shortcuts_shortcut") + ""}</span><Button variant="control" className="shortcut-key-field" aria-label={t("shortcuts_set_custom_shortcut_value1_keys", available.split("-")[1])} title={t("shortcuts_edit_custom_shortcut_value1_in_chrome", available.split("-")[1])} onClick={editNewBinding}><span>{"" + t("shortcuts_set_in_chrome") + ""}</span><kbd>{keyLabel(state.bindings[available])}</kbd></Button></div>
        </div>
        {action === "open-url" && <div className="field"><label htmlFor="shortcut-url">{"" + t("common_link") + ""}</label><input id="shortcut-url" type="text" placeholder="https://…" required value={url} onChange={event => setUrl(event.target.value)} /></div>}
        {expanded === "new" && <div className="shortcut-options" id="shortcut-settings-new"><Condition name={t("shortcuts_new_shortcut")} value={newCondition} disabled={busy} onChange={setNewCondition} /></div>}
        <Button type="submit" variant="secondary" className="shortcut-add" disabled={busy || !name.trim()}>{"" + t("shortcuts_add_shortcut") + ""}</Button>
      </form>}
      <Button variant="secondary" onClick={openBindings}>{"" + t("shortcuts_set_keys_in_chrome") + ""}</Button>
    </>}
    {!state && !error && <p className="muted">{"" + t("common_loading") + ""}</p>}
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
