import { useEffect, useRef, useState } from "react";
import Button from "../Button.jsx";
import Toggle from "../Toggle.jsx";
import Slider from "../Slider.jsx";
import { DARK_DEFAULTS } from "../../modules/dark-settings.js";
export default function DarkMode() {
  const [settings, setSettings] = useState(DARK_DEFAULTS), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [host, setHost] = useState("");
  const mounted = useRef(false);
  async function send(patch) {
    const reply = await chrome.runtime.sendMessage({ target: "dark-background", type: "dark:set", patch });
    if (!reply?.ok) throw new Error(reply?.error || "Koyu mod kaydedilemedi.");
    return reply.state;
  }
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const reply = await chrome.runtime.sendMessage({ target: "dark-background", type: "dark:get" });
        if (!reply?.ok) throw new Error(reply?.error || "Ayarlar okunamadı.");
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
      if (!await permission) throw new Error("Tüm siteler için erişim izni verilmedi.");
      const next = await send({ enabled }); if (mounted.current) setSettings(next);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const disabled = !ready || busy;
  return <section id="dark-view" className="tool-content">
    <div className="module-status"><div><strong>Tüm sitelerde koyu mod</strong><p className="muted">{settings.enabled ? "Açık" : "Kapalı"}</p></div><Toggle checked={settings.enabled} disabled={disabled} onChange={toggle} aria-label="Tüm sitelerde koyu mod" /></div>
    {host && <div className="field-heading"><span className="muted">{host}</span><Toggle checked={!settings.excluded.includes(host)} disabled={disabled || !settings.enabled} aria-label="Bu sitede koyu mod" onChange={value => update({ excluded: value ? settings.excluded.filter(item => item !== host) : [...settings.excluded, host] })} /></div>}
    {[ ["brightness", "Parlaklık", 50, 150], ["contrast", "Kontrast", 50, 150], ["sepia", "Sıcaklık", 0, 100] ].map(([key, label, min, max]) => <div className="field" key={key}><div className="field-heading"><label htmlFor={`dark-${key}`}>{label}</label><output className="muted">{settings[key]}</output></div><Slider id={`dark-${key}`} min={min} max={max} value={settings[key]} disabled={disabled} onChange={value => update({ [key]: value })} /></div>)}
    <div className="field-grid">{[["background", "Arka plan"], ["text", "Yazı rengi"]].map(([key, label]) => <div className="color-field" key={key}><label htmlFor={`dark-${key}`}>{label}</label><input id={`dark-${key}`} type="color" value={settings[key]} disabled={disabled} onChange={event => update({ [key]: event.target.value })} /></div>)}</div>
    <Button variant="secondary" disabled={disabled} onClick={() => { const { enabled, excluded, ...appearance } = DARK_DEFAULTS; update(appearance); }}>Görünümü sıfırla</Button>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
