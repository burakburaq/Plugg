import { t } from "../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import Toggle from "../../Toggle.jsx";
import { startColorInspector } from "./color-inspector.js";

const SIX_HOURS = 6 * 60 * 60 * 1000;
function recentColors(value) {
  const now = Date.now();
  return (Array.isArray(value) ? value : [])
    .filter(item => item && /^#[\da-f]{6}$/i.test(item.color) && Number.isFinite(item.time) && item.time > now - SIX_HOURS && item.time <= now)
    .sort((a, b) => b.time - a.time).slice(0, 5);
}

export default function ColorPicker() {
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [keepColorIndicators, setKeepColorIndicators] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    let mounted = true;
    chrome.storage.local.get(["colorHistory", "keepColorIndicators"]).then(result => {
      if (mounted) { setHistory(recentColors(result.colorHistory)); setKeepColorIndicators(result.keepColorIndicators === true); }
    }).catch(() => {});
    const listener = (changes, area) => {
      if (area === "local" && changes.colorHistory) setHistory(recentColors(changes.colorHistory.newValue));
      if (area === "local" && changes.keepColorIndicators) setKeepColorIndicators(changes.keepColorIndicators.newValue === true);
    };
    chrome.storage.onChanged.addListener(listener);
    if (!started.current) { started.current = true; void pick(); }
    return () => { mounted = false; chrome.storage.onChanged.removeListener(listener); };
  }, []);

  useEffect(() => {
    if (!history.length) return;
    const nextExpiry = Math.min(...history.map(item => item.time + SIX_HOURS));
    const timer = setTimeout(() => setHistory(current => recentColors(current)), Math.max(0, nextExpiry - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [history]);

  async function pick() {
    setMessage("");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!Number.isInteger(tab?.id)) throw new Error();
      const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: startColorInspector, args: [image] });
    } catch {
      setMessage(t("color_picker_start_error"));
    }
  }

  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setMessage(t("common_value_copied", value)); }
    catch { setMessage(t("common_clipboard_error")); }
  }

  return <section id="color-view" className="tool-content color-tool">
    <div className="color-indicator-setting">
      <span id="keep-color-indicators-label">{"" + t("color_picker_keep_indicators") + ""}</span>
      <Toggle aria-labelledby="keep-color-indicators-label" checked={keepColorIndicators} onChange={value => {
        setKeepColorIndicators(value);
        void chrome.storage.local.set({ keepColorIndicators: value }).catch(() => setKeepColorIndicators(!value));
      }} />
    </div>
    {history.length ? <ul className="color-history">
      {history.map((item, index) => {
        const hex = item.color.toUpperCase();
        const channels = [1, 3, 5].map(offset => parseInt(item.color.slice(offset, offset + 2), 16));
        const rgb = `rgb(${channels.join(", ")})`;
        const linear = channels.map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
        const foreground = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179 ? "#000" : "#fff";
        return <li className="color-history-row" style={{ backgroundColor: item.color, color: foreground }} key={`${item.time}-${index}`}>
          <button className="color-history-copy" type="button" onClick={() => copy(hex)} aria-label={t("common_copy_value", hex)} title={t("color_picker_copy_hex")}>{hex}</button>
          <button className="color-history-copy" type="button" onClick={() => copy(rgb)} aria-label={t("common_copy_value", rgb)} title={t("color_picker_copy_rgb")}>{rgb}</button>
        </li>;
      })}
    </ul> : <p className="color-history-empty muted">{"" + t("color_picker_no_recent_colors") + ""}</p>}
    {message && <p role="status" className="muted">{message}</p>}
  </section>;
}
