import { useEffect, useRef, useState } from "react";
import { FOCUS_KEY, normalizeFocus, focusRemaining } from "../../modules/newtab-data.js";
import useStoredState from "./useStoredState.js";
import Icon from "./Icon.jsx";
import WidgetPopover from "./WidgetPopover.jsx";
export default function FocusTimer() {
  const [state, update, ready, error] = useStoredState(FOCUS_KEY, normalizeFocus);
  const [now, setNow] = useState(Date.now);
  const [expanded, setExpanded] = useState(false);
  const anchor = useRef(null);
  useEffect(() => { setNow(Date.now()); if (!state.endsAt || state.endsAt <= Date.now()) return; const id = setInterval(() => { const time = Date.now(); setNow(time); if (time >= state.endsAt) clearInterval(id); }, 1000); return () => clearInterval(id); }, [state.endsAt]);
  const remaining = focusRemaining(state, now), running = state.endsAt !== null && remaining > 0;
  const progress = 1 - remaining / (state.duration * 60);
  const display = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  function toggle() { const time = Date.now(); update(before => before.endsAt !== null && focusRemaining(before, time) > 0 ? { ...before, remaining: focusRemaining(before, time), endsAt: null } : { ...before, remaining: focusRemaining(before, time) || before.duration * 60, endsAt: time + (focusRemaining(before, time) || before.duration * 60) * 1000 }); }
  return <div ref={anchor} className={`nt-focus ${running ? "is-running" : ""}`}>
    <button className="nt-focus-pill" aria-label="Odak süresi kontrolleri" aria-expanded={expanded} disabled={!ready} onClick={() => setExpanded(!expanded)}><Icon name="clock" /><span>Odak süresi</span><time>{display}</time><Icon className="nt-chevron" name="chevron" /></button>
    {expanded && <WidgetPopover anchor={anchor} title="Odak süresi" onClose={() => setExpanded(false)}><div className="nt-focus-presets" aria-label="Süre">{[5, 15, 25, 50].map(minutes => <button key={minutes} aria-pressed={state.duration === minutes} disabled={!ready || running} onClick={() => update({ duration: minutes, remaining: minutes * 60, endsAt: null })}>{minutes} dk</button>)}</div><div className="nt-focus-readout"><time>{display}</time><p>{remaining === 0 ? "Süre doldu" : running ? "Bir işe odaklan" : "Kendine zaman ayır"}</p><div className="nt-focus-progress" role="progressbar" aria-label="Odak süresi ilerlemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div></div><div className="nt-focus-actions"><button className="nt-primary" disabled={!ready} onClick={toggle}><Icon name={running ? "pause" : "play"} />{running ? "Duraklat" : remaining === 0 ? "Yeniden başlat" : "Başlat"}</button><button className="nt-icon-button" aria-label="Süreyi sıfırla" title="Sıfırla" disabled={!ready} onClick={() => update(before => ({ ...before, remaining: before.duration * 60, endsAt: null }))}><Icon name="reset" /></button></div>{error && <p role="alert" className="nt-error">{error}</p>}</WidgetPopover>}
    {error && !expanded && <span className="nt-status-error" role="alert" title={error}>!</span>}
  </div>;
}
