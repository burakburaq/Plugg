import { useRef, useState } from "react";
import { normalizeTodos } from "../../modules/newtab-data.js";
import useStoredState from "./useStoredState.js";
import Icon from "./Icon.jsx";
import WidgetPopover from "./WidgetPopover.jsx";

export default function TaskList({ storageKey, notes = false }) {
  const [items, update, ready, error] = useStoredState(storageKey, normalizeTodos);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const anchor = useRef(null);
  const label = notes ? "Not" : "Görev";
  function add(event) {
    event.preventDefault(); if (!text.trim() || items.length >= 100) return;
    update(before => [...before, { id: crypto.randomUUID(), text: text.trim(), done: false, ...(!notes && time ? { time } : {}) }]);
    setText(""); setTime(""); setAdding(false);
  }
  return <div ref={anchor} className={`nt-tool nt-task-list ${notes ? "nt-notes" : "nt-todo"}`}>
    <header><h2>{notes ? "Hızlı notlar" : "Bugün"}</h2><button className="nt-icon-button" title={`${label} ekle`} aria-label={`${label} ekle`} aria-expanded={adding} disabled={!ready || items.length >= 100} onClick={() => setAdding(!adding)}><Icon name={notes ? "plus" : "chevron"} /></button></header>
    <ul className="nt-tasks">{items.map(item => <li key={item.id} className={item.done ? "is-done" : ""}><label><input type="checkbox" checked={item.done} onChange={() => update(before => before.map(task => task.id === item.id ? { ...task, done: !task.done } : task))} />{!notes && <i className="nt-task-dot" aria-hidden="true" />}<span title={item.text}>{item.text}</span></label>{!notes && item.time && <time>{item.time}</time>}<button className="nt-task-delete nt-icon-button" title={`${label} sil`} aria-label={`${item.text} ${notes ? "notunu" : "görevini"} sil`} onClick={() => update(before => before.filter(task => task.id !== item.id))}><Icon name="close" /></button></li>)}</ul>
    {!items.length && <p className="nt-hint">{notes ? "Aklındaki bir şeyi not al." : "Bugün için küçük bir adım ekle."}</p>}
    {adding && <WidgetPopover anchor={anchor} title={`Yeni ${notes ? "not" : "görev"}`} onClose={() => setAdding(false)}><form className="nt-entry-form" onSubmit={add}><input aria-label={`Yeni ${notes ? "not" : "görev"}`} placeholder={notes ? "Aklında ne var?" : "Ne yapmak istiyorsun?"} maxLength="300" value={text} onChange={event => setText(event.target.value)} autoFocus required />{!notes && <label className="nt-entry-time">Saat <span>isteğe bağlı</span><input type="time" aria-label="Görev saati" value={time} onChange={event => setTime(event.target.value)} /></label>}<button className="nt-primary" disabled={!text.trim()}>Ekle</button></form></WidgetPopover>}
    {error && <p role="alert" className="nt-error">{error}</p>}
  </div>;
}
