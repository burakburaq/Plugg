import { t } from "../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import Button from "../../Button.jsx";
import Toggle from "../../Toggle.jsx";
import Slider from "../../Slider.jsx";
import { DARK_DEFAULTS } from "./dark-settings.js";
export default function DarkMode() {
  const [settings, setSettings] = useState(DARK_DEFAULTS), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [host, setHost] = useState("");
  const mounted = useRef(false);
  async function send(patch) {
    const reply = await chrome.runtime.sendMessage({ target: "dark-background", type: "dark:set", patch });
    if (!reply?.ok) throw new Error(reply?.error || t("dark_mode_could_not_save_dark_mode"));
    return reply.state;
  }
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const reply = await chrome.runtime.sendMessage({ target: "dark-background", type: "dark:get" });
        if (!reply?.ok) throw new Error(reply?.error || t("dark_mode_could_not_read_settings"));
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        let hostname = ""; try { const url = new URL(tab.url); if (["http:", "https:"].includes(url.protocol)) hostname = url.hostname; } catch {}
        if (mounted.current) { setSettings(reply.state); setHost(hostname); setError(reply.state.warning || ""); setReady(true); }
      } catch (error) { if (mounted.current) setError(error.message); }
    })();
    return () => { mounted.current = false; };
  }, []);
  function update(patch) {
    setSettings(current => ({ ...current, ...patch })); setError("");
    // Persist before popup destruction; debounce expensive page rendering in the content script.
    void send(patch).catch(error => { if (mounted.current) setError(error.message); });
  }
  async function toggle(enabled) {
    const permission = enabled ? chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] }) : Promise.resolve(true);
    setBusy(true); setError("");
    try {
      if (!await permission) throw new Error(t("dark_mode_access_to_all_sites_was_not_granted"));
      const next = await send({ enabled }); if (mounted.current) setSettings(next);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const disabled = !ready || busy;
  return <section id="dark-view" className="tool-content">
    <div className="module-status"><div><strong>{"" + t("dark_mode_dark_mode_on_all_sites") + ""}</strong><p className="muted">{settings.enabled ? t("dark_mode_on") : t("dark_mode_off")}</p></div><Toggle checked={settings.enabled} disabled={disabled} onChange={toggle} aria-label={t("dark_mode_dark_mode_on_all_sites")} /></div>
    {host && <div className="field-heading"><span className="muted">{host}</span><Toggle checked={!settings.excluded.includes(host)} disabled={disabled || !settings.enabled} aria-label={t("dark_mode_dark_mode_on_this_site")} onChange={value => update({ excluded: value ? settings.excluded.filter(item => item !== host) : [...settings.excluded, host] })} /></div>}
    {[ ["brightness", t("common_brightness"), 50, 150], ["contrast", t("common_contrast"), 50, 150], ["sepia", t("dark_mode_warmth"), 0, 100] ].map(([key, label, min, max]) => <div className="field" key={key}><div className="field-heading"><label htmlFor={`dark-${key}`}>{label}</label><output className="muted">{settings[key]}</output></div><Slider id={`dark-${key}`} min={min} max={max} value={settings[key]} disabled={disabled} onChange={value => update({ [key]: value })} /></div>)}
    <div className="field-grid">{[["background", t("common_background")], ["text", t("dark_mode_text_color")]].map(([key, label]) => <div className="color-field" key={key}><label htmlFor={`dark-${key}`}>{label}</label><input id={`dark-${key}`} type="color" value={settings[key]} disabled={disabled} onChange={event => update({ [key]: event.target.value })} /></div>)}</div>
    <Button variant="secondary" disabled={disabled} onClick={() => { const { enabled, excluded, ...appearance } = DARK_DEFAULTS; update(appearance); }}>{"" + t("dark_mode_reset_appearance") + ""}</Button>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
