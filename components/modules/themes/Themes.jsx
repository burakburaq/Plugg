import { useEffect, useRef, useState } from "react";
import Toggle from "../../Toggle.jsx";
import Button from "../../Button.jsx";
import { t } from "../../../modules/i18n.js";
import { radiusEditor } from "./radius-editor.js";
import { hasRadiusChanges, loadRadiusEntries, mergeRadiusEntries } from "./radius-storage.js";
import { textEditor } from "./text-editor.js";
import { hasTextChanges, loadTextEntries, mergeTextEntries } from "./text-storage.js";
import { installThemesControl } from "./themes-control.js";

const tools = {
  radius: { editor: radiusEditor, load: loadRadiusEntries, merge: mergeRadiusEntries, changed: hasRadiusChanges, label: "themes_radius_editor" },
  text: { editor: textEditor, load: loadTextEntries, merge: mergeTextEntries, changed: hasTextChanges, label: "themes_text_content" }
};

export default function Themes() {
  const tabId = useRef(null), pageUrl = useRef("");
  const [state, setState] = useState({ radius: { active: false, dirty: false, busy: false }, text: { active: false, dirty: false, busy: false } });
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  function update(kind, patch) { setState(current => ({ ...current, [kind]: { ...current[kind], ...patch } })); }
  async function run(kind, action, id = tabId.current) {
    await chrome.scripting.executeScript({ target: { tabId: id }, func: installThemesControl });
    const results = await chrome.scripting.executeScript({ target: { tabId: id }, func: tools[kind].editor, args: [action] });
    return results[0]?.result;
  }
  async function refresh(kind) {
    const [status, snapshot, saved] = await Promise.all([run(kind, "status"), run(kind, "snapshot"), tools[kind].load(pageUrl.current)]);
    return { active: !!status?.active, dirty: tools[kind].changed(snapshot.entries, saved.entries) };
  }
  useEffect(() => {
    let mounted = true;
    const listener = (message, sender) => {
      if (sender.id !== chrome.runtime.id || sender.tab?.id !== tabId.current || message?.target !== "themes-popup") return;
      const kind = message.type === "radius:changed" ? "radius" : message.type === "text:changed" ? "text" : null;
      if (kind) refresh(kind).then(result => { if (mounted) update(kind, result); }).catch(() => {});
    };
    chrome.runtime.onMessage.addListener(listener);
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!Number.isInteger(tab?.id)) throw new Error();
        tabId.current = tab.id; pageUrl.current = tab.url;
        const [radius, text] = await Promise.all([refresh("radius"), refresh("text")]);
        if (mounted) { update("radius", radius); update("text", text); setReady(true); }
      } catch { if (mounted) setError(t("themes_unavailable")); }
    })();
    return () => { mounted = false; chrome.runtime.onMessage.removeListener(listener); };
  }, []);
  async function toggle(kind, enabled) {
    update(kind, { busy: true }); setError("");
    try { update(kind, { active: !!(await run(kind, enabled ? "start" : "stop"))?.active }); }
    catch { setError(t("themes_unavailable")); }
    finally { update(kind, { busy: false }); }
  }
  async function save(kind) {
    const url = new URL(pageUrl.current);
    const permission = chrome.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] });
    update(kind, { busy: true }); setError("");
    try {
      if (!await permission) throw new Error(t("themes_permission_required"));
      const tab = await chrome.tabs.get(tabId.current);
      if (tab.url !== pageUrl.current) throw new Error(t("themes_page_changed"));
      const { key, entries } = await tools[kind].load(pageUrl.current);
      const snapshot = await run(kind, "snapshot");
      await chrome.storage.local.set({ [key]: tools[kind].merge(entries, snapshot.entries) });
      update(kind, { dirty: false });
    } catch (failure) { setError(failure.message || t("themes_unavailable")); }
    finally { update(kind, { busy: false }); }
  }
  async function reset(kind) {
    update(kind, { busy: true }); setError("");
    try {
      const tab = await chrome.tabs.get(tabId.current);
      if (tab.url !== pageUrl.current) throw new Error(t("themes_page_changed"));
      const { key } = await tools[kind].load(pageUrl.current);
      await run(kind, "reset");
      await chrome.storage.local.remove(key);
      update(kind, { dirty: false });
    } catch (failure) { setError(failure.message || t("themes_unavailable")); }
    finally { update(kind, { busy: false }); }
  }
  return <section id="themes-view" className="tool-content">
    {Object.entries(tools).map(([kind, config]) => <div className="themes-radius-toggle" key={kind}>
      <span>{t(config.label)}</span>
      <Toggle checked={state[kind].active} onChange={enabled => toggle(kind, enabled)} disabled={!ready || state[kind].busy} aria-label={t(config.label)} />
      <Button variant="secondary" className="themes-save" onClick={() => save(kind)} disabled={!ready || state[kind].busy || !state[kind].dirty}>{t("themes_save")}</Button>
      <Button variant="secondary" onClick={() => reset(kind)} disabled={!ready || state[kind].busy}>{t("themes_reset")}</Button>
    </div>)}
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
