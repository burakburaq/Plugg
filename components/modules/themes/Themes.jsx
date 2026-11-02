import { useEffect, useRef, useState } from "react";
import Toggle from "../../Toggle.jsx";
import Button from "../../Button.jsx";
import { t } from "../../../modules/i18n.js";
import { radiusEditor } from "./radius-editor.js";
import { hasRadiusChanges, loadRadiusEntries, mergeRadiusEntries } from "./radius-storage.js";

export default function Themes() {
  const tabId = useRef(null);
  const pageUrl = useRef("");
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  async function run(action, id) {
    const results = await chrome.scripting.executeScript({ target: { tabId: id }, func: radiusEditor, args: [action] });
    return results[0]?.result;
  }

  useEffect(() => {
    let mounted = true;
    const listener = (message, sender) => {
      if (sender.id !== chrome.runtime.id || sender.tab?.id !== tabId.current || message?.target !== "themes-popup" || message.type !== "radius:changed") return;
      Promise.all([run("snapshot", tabId.current), loadRadiusEntries(pageUrl.current)])
        .then(([snapshot, saved]) => { if (mounted) setDirty(hasRadiusChanges(snapshot.entries, saved.entries)); })
        .catch(() => {});
    };
    chrome.runtime.onMessage.addListener(listener);
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!Number.isInteger(tab?.id)) throw new Error();
        tabId.current = tab.id;
        pageUrl.current = tab.url;
        const [status, snapshot, saved] = await Promise.all([run("status", tab.id), run("snapshot", tab.id), loadRadiusEntries(tab.url)]);
        if (mounted) { setActive(!!status?.active); setDirty(hasRadiusChanges(snapshot.entries, saved.entries)); setReady(true); }
      } catch { if (mounted) setError(t("themes_unavailable")); }
    })();
    return () => { mounted = false; chrome.runtime.onMessage.removeListener(listener); };
  }, []);

  async function toggle(enabled) {
    setBusy(true); setError("");
    try { setActive(!!(await run(enabled ? "start" : "stop", tabId.current))?.active); }
    catch { setError(t("themes_unavailable")); }
    finally { setBusy(false); }
  }

  async function save() {
    const url = new URL(pageUrl.current);
    // Permission requests must start synchronously in the button's click handler.
    const permission = chrome.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] });
    setBusy(true); setError("");
    try {
      if (!await permission) throw new Error(t("themes_permission_required"));
      const tab = await chrome.tabs.get(tabId.current);
      if (tab.url !== pageUrl.current) throw new Error(t("themes_page_changed"));
      const { key, entries } = await loadRadiusEntries(pageUrl.current);
      const snapshot = await run("snapshot", tabId.current);
      await chrome.storage.local.set({ [key]: mergeRadiusEntries(entries, snapshot.entries) });
      setDirty(false);
    } catch (failure) { setError(failure.message || t("themes_unavailable")); }
    finally { setBusy(false); }
  }

  async function reset() {
    setBusy(true); setError("");
    try {
      const tab = await chrome.tabs.get(tabId.current);
      if (tab.url !== pageUrl.current) throw new Error(t("themes_page_changed"));
      const { key } = await loadRadiusEntries(pageUrl.current);
      await run("reset", tabId.current);
      await chrome.storage.local.remove(key);
      setDirty(false);
    } catch (failure) { setError(failure.message || t("themes_unavailable")); }
    finally { setBusy(false); }
  }

  return <section id="themes-view" className="tool-content">
    <div className="themes-radius-toggle">
      <span>{t("themes_radius_editor")}</span>
      <Toggle checked={active} onChange={toggle} disabled={!ready || busy} aria-label={t("themes_radius_editor")} />
      <Button variant="secondary" className="themes-save" onClick={save} disabled={!ready || busy || !dirty}>{t("themes_save")}</Button>
      <Button variant="secondary" onClick={reset} disabled={!ready || busy}>{t("themes_reset")}</Button>
    </div>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
