import { t } from "../../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import { FOCUS_KEY, normalizeFocus, focusRemaining } from "../newtab-data.js";
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
    <button className="nt-focus-pill" aria-label={t("focus_timer_focus_timer_controls")} aria-expanded={expanded} disabled={!ready} onClick={() => setExpanded(!expanded)}><Icon name="clock" /><span>{"" + t("common_focus_timer") + ""}</span><time>{display}</time><Icon className="nt-chevron" name="chevron" /></button>
    {expanded && <WidgetPopover anchor={anchor} title={t("common_focus_timer")} onClose={() => setExpanded(false)}><div className="nt-focus-presets" aria-label={t("focus_timer_duration")}>{[5, 15, 25, 50].map(minutes => <button key={minutes} aria-pressed={state.duration === minutes} disabled={!ready || running} onClick={() => update({ duration: minutes, remaining: minutes * 60, endsAt: null })}>{minutes} {"" + t("focus_timer_min") + ""}</button>)}</div><div className="nt-focus-readout"><time>{display}</time><p>{remaining === 0 ? t("focus_timer_time_is_up") : running ? t("focus_timer_focus_on_task") : t("focus_timer_take_time_for_yourself")}</p><div className="nt-focus-progress" role="progressbar" aria-label={t("focus_timer_focus_timer_progress")} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div></div><div className="nt-focus-actions"><button className="nt-primary" disabled={!ready} onClick={toggle}><Icon name={running ? "pause" : "play"} />{running ? t("focus_timer_pause") : remaining === 0 ? t("focus_timer_restart") : t("focus_timer_start")}</button><button className="nt-icon-button" aria-label={t("focus_timer_reset_timer")} title={t("common_reset")} disabled={!ready} onClick={() => update(before => ({ ...before, remaining: before.duration * 60, endsAt: null }))}><Icon name="reset" /></button></div>{error && <p role="alert" className="nt-error">{error}</p>}</WidgetPopover>}
    {error && !expanded && <span className="nt-status-error" role="alert" title={error}>!</span>}
  </div>;
}
