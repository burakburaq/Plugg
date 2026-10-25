import { useEffect, useRef, useState } from "react";
import { BANDS, PRESETS, normalizeSettings } from "../../modules/audio-settings.js";
import Button from "../Button.jsx";
import Toggle from "../Toggle.jsx";
import Slider from "../Slider.jsx";

const defaults = normalizeSettings({ gain: 1, eq: PRESETS.flat, preset: "flat" });
const decibels = value => `${value > 0 ? "+" : ""}${value} dB`;

async function request(type, tabId, settings) {
  const response = await chrome.runtime.sendMessage({ target: "audio-background", type, tabId, settings });
  if (!response?.ok) throw new Error(response?.error || "Ses motoruna bağlanılamadı.");
  return response.state;
}

export default function VolumeBooster() {
  const [settings, setSettings] = useState(defaults);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Aktif sekme");
  const [error, setError] = useState("");
  const live = useRef({ mounted: false, tabId: undefined, active: false, busy: false, ready: false, settings: defaults, revision: 0, timer: undefined });

  function applyState(state, includeSettings = true) {
    if (!live.current.mounted) return;
    live.current.active = !!state.active;
    setActive(!!state.active);
    if (includeSettings) {
      live.current.settings = normalizeSettings(state);
      setSettings(live.current.settings);
    }
  }

  useEffect(() => {
    const current = live.current;
    current.mounted = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!Number.isInteger(tab?.id)) throw new Error();
        current.tabId = tab.id;
        const state = await request("audio:get", tab.id);
        if (!current.mounted) return;
        setTitle(tab.title || "Aktif sekme");
        applyState(state);
        current.ready = true;
        setReady(true);
      } catch {
        if (current.mounted) setError("Ses motoruna bağlanılamadı. Eklentiyi Chrome'da yenileyip tekrar dene.");
      }
    })();
    const listener = message => {
      if (message?.target === "audio-popup" && message.state?.tabId === current.tabId && !current.busy) applyState(message.state, false);
    };
    const messages = globalThis.chrome?.runtime?.onMessage;
    messages?.addListener(listener);
    return () => {
      current.mounted = false;
      messages?.removeListener(listener);
      // Apply the last slider change even if the user immediately returns to the menu.
      if (current.timer) {
        clearTimeout(current.timer);
        current.timer = undefined;
        if (current.active) request("audio:set", current.tabId, current.settings).catch(() => {});
      }
    };
  }, []);

  function updateSettings(patch) {
    const current = live.current;
    const next = normalizeSettings({ ...current.settings, ...patch });
    current.settings = next;
    setSettings(next);
    clearTimeout(current.timer);
    current.timer = undefined;
    const revision = ++current.revision;
    if (!current.active) return;
    current.timer = setTimeout(async () => {
      current.timer = undefined;
      try {
        const state = await request("audio:set", current.tabId, next);
        if (current.mounted && revision === current.revision) { applyState(state, false); setError(""); }
      } catch {
        if (current.mounted && revision === current.revision) setError("Ses ayarı uygulanamadı. Tekrar deneyebilirsin.");
      }
    }, 70);
  }

  async function toggle() {
    const current = live.current;
    if (!current.ready || current.busy) return;
    clearTimeout(current.timer);
    current.timer = undefined;
    ++current.revision;
    const wasActive = current.active;
    current.busy = true;
    setBusy(true);
    setError("");
    try { applyState(await request(wasActive ? "audio:stop" : "audio:start", current.tabId, current.settings)); }
    catch {
      if (current.mounted) setError(wasActive ? "Ses işleme kapatılamadı. Tekrar dene." : "Ses başlatılamadı. Bu sekmede bir medya oynatıp tekrar dene.");
    } finally { current.busy = false; if (current.mounted) setBusy(false); }
  }

  const disabled = busy || !ready;
  return <section id="volume-view" className="tool-content">
    <div className="module-toolbar"><Button id="volume-reset" disabled={disabled} onClick={() => updateSettings(defaults)}>Sıfırla</Button></div>
    <div className="module-status"><div><strong id="audio-tab-title">{title}</strong><p id="audio-status" className="muted">{!ready ? error ? "Sekme sesine bağlanılamadı" : "Sekme okunuyor…" : active ? "Bu sekmede etkin" : "Etkinleştirmek için anahtarı aç"}</p></div>
      <Toggle id="audio-toggle" checked={active} onChange={toggle} disabled={disabled} aria-label={active ? "Sekme sesini işlemeyi kapat" : "Sekme sesini işlemeyi etkinleştir"} />
    </div>
    <div className="field gain-field"><div className="field-heading"><label htmlFor="volume-gain">Ses seviyesi</label><output id="volume-value" htmlFor="volume-gain">{settings.gain.toFixed(1)}</output></div>
      <Slider id="volume-gain" min={0} max={6} step={0.1} value={settings.gain} disabled={disabled} aria-valuetext={settings.gain.toFixed(1)} onChange={gain => updateSettings({ gain })} />
      <div className="range-labels"><span>0.0</span><span>1.0 normal</span><span>6.0</span></div>
    </div>
    <div className="field"><label htmlFor="eq-preset">EQ preseti</label><select id="eq-preset" disabled={disabled} value={settings.preset} onChange={event => { const preset = event.target.value; updateSettings({ preset, ...(PRESETS[preset] && { eq: PRESETS[preset] }) }); }}>
      <option value="flat">Düz</option><option value="bass">Bas</option><option value="vocal">Vokal</option><option value="rock">Rock</option><option value="electronic">Elektronik</option><option value="custom">Özel</option>
    </select></div>
    <div className="eq-heading"><strong>Ekolayzır</strong><span className="muted">−12 / +12 dB</span></div>
    <div id="eq-controls" className="eq-controls">{BANDS.map((frequency, index) => <div className="eq-row" key={frequency}>
      <label htmlFor={`eq-${index}`}>{frequency >= 1000 ? `${frequency / 1000}k Hz` : `${frequency} Hz`}</label>
      <Slider id={`eq-${index}`} vertical min={-12} max={12} step={1} value={settings.eq[index]} disabled={disabled} aria-valuetext={decibels(settings.eq[index])}
        onChange={value => updateSettings({ eq: settings.eq.map((band, i) => i === index ? value : band), preset: "custom" })} />
      <output htmlFor={`eq-${index}`}>{decibels(settings.eq[index])}</output>
    </div>)}</div>
    {error && <p id="audio-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
