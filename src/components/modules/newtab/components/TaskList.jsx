import { t } from "../../../../modules/i18n.js";
import { useRef, useState } from "react";
import { normalizeTodos } from "../newtab-data.js";
import useStoredState from "./useStoredState.js";
import Icon from "./Icon.jsx";
import WidgetPopover from "./WidgetPopover.jsx";

export default function TaskList({ storageKey, notes = false }) {
  const [items, update, ready, error] = useStoredState(storageKey, normalizeTodos);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const anchor = useRef(null);
  const label = notes ? t("tasks_note") : t("tasks_task");
  function add(event) {
    event.preventDefault(); if (!text.trim() || items.length >= 100) return;
    update(before => [...before, { id: crypto.randomUUID(), text: text.trim(), done: false, ...(!notes && time ? { time } : {}) }]);
    setText(""); setTime(""); setAdding(false);
  }
  return <div ref={anchor} className={`nt-tool nt-task-list ${notes ? "nt-notes" : "nt-todo"}`}>
    <header><h2>{notes ? t("common_quick_notes") : t("tasks_today")}</h2><button className="nt-icon-button" title={t("tasks_add_value1", label)} aria-label={t("tasks_add_value1", label)} aria-expanded={adding} disabled={!ready || items.length >= 100} onClick={() => setAdding(!adding)}><Icon name={notes ? "plus" : "chevron"} /></button></header>
    <ul className="nt-tasks">{items.map(item => <li key={item.id} className={item.done ? "is-done" : ""}><label><input type="checkbox" checked={item.done} onChange={() => update(before => before.map(task => task.id === item.id ? { ...task, done: !task.done } : task))} />{!notes && <i className="nt-task-dot" aria-hidden="true" />}<span title={item.text}>{item.text}</span></label>{!notes && item.time && <time>{item.time}</time>}<button className="nt-task-delete nt-icon-button" title={t("tasks_delete_value1", label)} aria-label={t("tasks_delete_value2_value1", item.text, notes ? t("tasks_note_2") : t("tasks_task_2"))} onClick={() => update(before => before.filter(task => task.id !== item.id))}><Icon name="close" /></button></li>)}</ul>
    {!items.length && <p className="nt-hint">{notes ? t("tasks_write_down_whats_on_your_mind") : t("tasks_add_small_step_for_today")}</p>}
    {adding && <WidgetPopover anchor={anchor} title={t("tasks_new_value1", notes ? t("tasks_note_3") : t("tasks_task_3"))} onClose={() => setAdding(false)}><form className="nt-entry-form" onSubmit={add}><input aria-label={t("tasks_new_value1", notes ? t("tasks_note_3") : t("tasks_task_3"))} placeholder={notes ? t("tasks_whats_on_your_mind") : t("tasks_what_would_you_like_to_do")} maxLength="300" value={text} onChange={event => setText(event.target.value)} autoFocus required />{!notes && <label className="nt-entry-time">{"" + t("tasks_time") + " "}<span>{"" + t("tasks_optional") + ""}</span><input type="time" aria-label={t("tasks_task_time")} value={time} onChange={event => setTime(event.target.value)} /></label>}<button className="nt-primary" disabled={!text.trim()}>{"" + t("common_add") + ""}</button></form></WidgetPopover>}
    {error && <p role="alert" className="nt-error">{error}</p>}
  </div>;
}
