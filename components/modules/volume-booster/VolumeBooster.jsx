import { t } from "../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import { BANDS, PRESETS, normalizeSettings } from "./audio-settings.js";
import Button from "../../Button.jsx";
import Toggle from "../../Toggle.jsx";
import Slider from "../../Slider.jsx";

const defaults = normalizeSettings({ gain: 1, eq: PRESETS.flat, preset: "flat" });
const decibels = value => `${value > 0 ? "+" : ""}${value} dB`;

async function request(type, tabId, settings) {
  const response = await chrome.runtime.sendMessage({ target: "audio-background", type, tabId, settings });
  if (!response?.ok) throw new Error(response?.error || t("common_could_not_connect_to_audio_engine"));
  return response.state;
}

export default function VolumeBooster() {
  const [settings, setSettings] = useState(defaults);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(t("volume_booster_active_tab"));
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
        setTitle(tab.title || t("volume_booster_active_tab"));
        applyState(state);
        current.ready = true;
        setReady(true);
      } catch {
        if (current.mounted) setError(t("volume_booster_could_not_connect_to_audio_engine"));
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
        if (current.mounted && revision === current.revision) setError(t("volume_booster_could_not_apply_audio_settings"));
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
      if (current.mounted) setError(wasActive ? t("volume_booster_could_not_stop_audio_processing") : t("volume_booster_could_not_start_audio"));
    } finally { current.busy = false; if (current.mounted) setBusy(false); }
  }

  const disabled = busy || !ready;
  return <section id="volume-view" className="tool-content">
    <div className="module-toolbar"><Button id="volume-reset" disabled={disabled} onClick={() => updateSettings(defaults)}>{"" + t("common_reset") + ""}</Button></div>
    <div className="module-status"><div><strong id="audio-tab-title">{title}</strong><p id="audio-status" className="muted">{!ready ? error ? t("volume_booster_could_not_connect_to_tab_audio") : t("volume_booster_reading_tab") : active ? t("volume_booster_active_in_this_tab") : t("volume_booster_turn_on_switch_to_enable")}</p></div>
      <Toggle id="audio-toggle" checked={active} onChange={toggle} disabled={disabled} aria-label={active ? t("volume_booster_stop_processing_tab_audio") : t("volume_booster_enable_tab_audio_processing")} />
    </div>
    <div className="field gain-field"><div className="field-heading"><label htmlFor="volume-gain">{"" + t("volume_booster_volume") + ""}</label><output id="volume-value" htmlFor="volume-gain">{settings.gain.toFixed(1)}</output></div>
      <Slider id="volume-gain" min={0} max={6} step={0.1} value={settings.gain} disabled={disabled} aria-valuetext={settings.gain.toFixed(1)} onChange={gain => updateSettings({ gain })} />
      <div className="range-labels"><span>0.0</span><span>{"" + t("volume_booster_1") + ""}</span><span>6.0</span></div>
    </div>
    <div className="field"><label htmlFor="eq-preset">{"" + t("volume_booster_eq_preset") + ""}</label><select id="eq-preset" disabled={disabled} value={settings.preset} onChange={event => { const preset = event.target.value; updateSettings({ preset, ...(PRESETS[preset] && { eq: PRESETS[preset] }) }); }}>
      <option value="flat">{"" + t("volume_booster_flat") + ""}</option><option value="bass">{"" + t("volume_booster_bass") + ""}</option><option value="vocal">{"" + t("volume_booster_vocal") + ""}</option><option value="rock">{"" + t("volume_booster_rock") + ""}</option><option value="electronic">{"" + t("volume_booster_electronic") + ""}</option><option value="custom">{"" + t("volume_booster_custom") + ""}</option>
    </select></div>
    <div className="eq-heading"><strong>{"" + t("volume_booster_equalizer") + ""}</strong><span className="muted">{"" + t("volume_booster_12_12_db") + ""}</span></div>
    <div id="eq-controls" className="eq-controls">{BANDS.map((frequency, index) => <div className="eq-row" key={frequency}>
      <label htmlFor={`eq-${index}`}>{frequency >= 1000 ? `${frequency / 1000}k Hz` : `${frequency} Hz`}</label>
      <Slider id={`eq-${index}`} vertical min={-12} max={12} step={1} value={settings.eq[index]} disabled={disabled} aria-valuetext={decibels(settings.eq[index])}
        onChange={value => updateSettings({ eq: settings.eq.map((band, i) => i === index ? value : band), preset: "custom" })} />
      <output htmlFor={`eq-${index}`}>{decibels(settings.eq[index])}</output>
    </div>)}</div>
    {error && <p id="audio-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
