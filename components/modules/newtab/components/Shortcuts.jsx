import { t, uiLocale } from "../../../../modules/i18n.js";
import { useState } from "react";
import { LINKS_KEY, normalizeLinks, safeLink } from "../newtab-data.js";
import useStoredState from "./useStoredState.js";
import Icon from "./Icon.jsx";

export function BrandIcon({ item }) {
  if (item.icon === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="5" fill="#ff3028" /><path d="m10 8 6 4-6 4" fill="white" /></svg>;
  if (item.icon === "gmail") return <svg viewBox="0 0 24 24" fill="none" strokeWidth="4" strokeLinejoin="round" aria-hidden="true"><path d="M3 20V5l9 7" stroke="#4285f4" /><path d="M21 20V5l-9 7" stroke="#34a853" /><path d="m3 5 9 7 9-7" stroke="#ea4335" /></svg>;
  if (item.icon === "notion") return <span className="nt-notion">{"" + t("shortcuts_n") + ""}</span>;
  if (item.icon === "github") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3 19.5c.5.1.7-.2.7-.5v-2c-3 .7-3.6-1.3-3.6-1.3-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.5 1.2 3.1.9.1-.7.4-1.2.7-1.5-2.4-.3-4.9-1.2-4.9-5.4 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.4.1-3 0 0 .9-.3 3.1 1.1a10.5 10.5 0 0 1 5.6 0C17.8 4.4 18.7 4.7 18.7 4.7c.6 1.6.2 2.7.1 3 .7.8 1.1 1.8 1.1 3 0 4.2-2.5 5.1-4.9 5.4.4.4.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" /></svg>;
  return <span className="nt-link-letter">{item.title[0].toLocaleUpperCase(uiLocale())}</span>;
}
export default function Shortcuts({ editing }) {
  const [links, update, ready, error] = useStoredState(LINKS_KEY, normalizeLinks);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState("");
  function add(event) {
    event.preventDefault();
    try { if (!title.trim()) throw new Error(t("shortcuts_enter_name")); const link = { id: crypto.randomUUID(), title: title.trim(), url: safeLink(url), icon: "link" }; update(before => [...before, link]); setAdding(false); setTitle(""); setUrl(""); setFormError(""); }
    catch (err) { setFormError(err.message); }
  }
  return <div className="nt-links">
    <div className="nt-link-list">{links.map(item => <div className="nt-link-item" key={item.id}><a href={item.url} aria-label={item.title}><span className="nt-link-bubble" aria-hidden="true"><BrandIcon item={item} /></span><span className="nt-link-title">{item.title}</span></a>{editing && <button className="nt-link-remove nt-icon-button" aria-label={t("shortcuts_remove_value1_shortcut", item.title)} onClick={() => update(before => before.filter(link => link.id !== item.id))}><Icon name="close" /></button>}</div>)}
      {links.length < 12 && <button className="nt-add-link" disabled={!ready} aria-expanded={adding} onClick={() => setAdding(!adding)}><span className="nt-link-bubble"><Icon name="plus" /></span><span>{"" + t("common_add") + ""}</span></button>}</div>
    {adding && <form className="nt-floating-form" onSubmit={add}><header><h2>{"" + t("shortcuts_add_shortcut") + ""}</h2><button type="button" className="nt-icon-button" aria-label={t("common_close")} onClick={() => setAdding(false)}><Icon name="close" /></button></header><input aria-label={t("shortcuts_shortcut_name")} placeholder={t("shortcuts_name")} maxLength="40" value={title} onChange={event => setTitle(event.target.value)} autoFocus required /><input aria-label={t("shortcuts_shortcut_url")} placeholder="https://example.com" value={url} onChange={event => setUrl(event.target.value)} required /><button className="nt-primary">{"" + t("common_add") + ""}</button>{formError && <p className="nt-error" role="alert">{formError}</p>}</form>}
    {error && <p className="nt-error" role="alert">{error}</p>}
  </div>;
}
