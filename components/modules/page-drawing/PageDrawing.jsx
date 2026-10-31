import { t } from "../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import Button from "../../Button.jsx";
import Toggle from "../../Toggle.jsx";

async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ target: "drawing-background", type, ...extra });
  if (!response?.ok) throw new Error(response?.error || t("drawing_could_not_connect_to_drawing_module"));
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
        if (!Number.isInteger(tab?.id) || !/^https?:\/\//.test(tab.url || "")) throw new Error(t("common_try_again_on_regular_web_page"));
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
    if (!response?.ok) throw new Error(response?.error || t("drawing_turn_on_drawing_mode_first"));
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
      if (!await permission) throw new Error(t("drawing_site_access_was_not_granted"));
      const result = await request("draw:automatic", { enabled: !automatic });
      if (mounted.current) setAutomatic(result.automatic);
    });
  }
  const disabled = !ready || busy;
  return <section id="drawing-view" className="tool-content">
    <div className="button-row">
      <Button id="drawing-start" variant="primary" disabled={disabled} onClick={() => run(() => start())}>{state.editing ? t("drawing_continue_drawing") : t("drawing_turn_on_drawing_mode")}</Button>
      <Button id="drawing-stop" variant="secondary" disabled={disabled || !state.active} onClick={() => run(async () => setState(await request("draw:stop", { tabId: tabId.current })))}>{"" + t("common_close") + ""}</Button>
    </div>
    <p className="muted">{state.active ? t("drawing_value1_strokes_value2", state.strokeCount, state.editing ? t("drawing_drawing_on") : t("drawing_viewing")) : t("drawing_drawing_off")}{"" + t("drawing_symbol") + ""}</p>
    <div className="button-row">
      <Button id="drawing-save-url" variant="secondary" disabled={disabled || !state.active} onClick={() => run(async () => { await pageAction("draw:save-url"); setMessage(t("drawing_saved_for_this_url")); })}>{"" + t("drawing_save_to_url") + ""}</Button>
      <Button id="drawing-export" variant="secondary" disabled={disabled || !state.active} onClick={() => run(() => pageAction("draw:export"))}>{"" + t("common_download_png") + ""}</Button>
    </div>
    <div className="field"><label htmlFor="drawing-name">{"" + t("drawing_save_independently_of_url") + ""}</label>
      <input id="drawing-name" type="text" maxLength="80" value={name} placeholder={t("drawing_save_name")} onChange={event => setName(event.target.value)} />
      <Button id="drawing-custom-save" variant="secondary" disabled={disabled || !state.active || !name.trim()} onClick={() => run(async () => { await pageAction("draw:save-custom", { name }); await library(); setName(""); setMessage(t("drawing_custom_save_created")); })}>{"" + t("drawing_save_as_custom") + ""}</Button>
    </div>
    <div className="field"><label htmlFor="drawing-saved">{"" + t("drawing_saved_drawings") + ""}</label>
      <select id="drawing-saved" value={selected} onChange={event => setSelected(event.target.value)}><option value="">{"" + t("drawing_select_save") + ""}</option>{items.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select>
      <div className="button-row">
        <Button id="drawing-custom-load" variant="secondary" disabled={disabled || !selected} onClick={() => run(() => start(selected))}>{"" + t("drawing_load_on_page") + ""}</Button>
        <Button id="drawing-custom-delete" variant="secondary" disabled={disabled || !selected} onClick={() => run(async () => { await request("draw:delete-custom", { key: selected }); setSelected(""); await library(); })}>{"" + t("drawing_delete_save") + ""}</Button>
      </div>
    </div>
    <div className="field-heading"><span>{"" + t("drawing_show_automatically_on_pages_with_drawings") + ""}</span><Toggle id="drawing-automatic" checked={automatic} disabled={disabled} onChange={changeAutomatic} aria-label={t("drawing_restore_drawings_automatically")} /></div>
    {message && <p id="drawing-message" className="muted" role="status">{message}</p>}
  </section>;
}
