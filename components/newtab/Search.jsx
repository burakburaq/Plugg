import { useEffect, useRef, useState } from "react";
import { FILE_TYPES, normalizeSearchSite, searchUrl } from "../../modules/newtab-settings.js";
import Icon from "./Icon.jsx";
import { BrandIcon } from "./Shortcuts.jsx";
import WidgetPopover from "./WidgetPopover.jsx";

const SITES = [
  { title: "Tümü", site: "", icon: "globe" },
  { title: "YouTube", site: "youtube.com", icon: "youtube" },
  { title: "GitHub", site: "github.com", icon: "github" },
  { title: "Notion", site: "notion.so", icon: "notion" },
  { title: "Gmail", site: "mail.google.com", icon: "gmail" }
];
const FILES = [
  { value: "pdf", title: "PDF", color: "#ee383b", letter: "PDF" },
  { value: "docx", title: "DOCX", color: "#1473d6", letter: "W" },
  { value: "ppt", title: "PPT", color: "#ed6229", letter: "P" },
  { value: "xls", title: "XLS", color: "#19985a", letter: "X" },
  { value: "image", title: "Görsel", color: "#8845ed" },
  { value: "other", title: "Diğer", color: "#87909e" }
];
const TIMES = [["", "Tümü"], ["day", "Son 24 saat"], ["week", "Bu hafta"], ["month", "Bu ay"], ["year", "Bu yıl"]];
const OTHER_FILES = FILE_TYPES.filter(type => !FILES.some(file => file.value === type));

function FileBadge({ file }) {
  return <svg className="nt-file-badge" viewBox="0 0 24 24" aria-hidden="true">
    {file.value === "image" ? <><rect x="2" y="3" width="20" height="18" rx="3" fill={file.color} /><circle cx="8" cy="8" r="2" fill="white" /><path d="m4 18 5-6 3 3 3-4 5 7Z" fill="white" /></> : <>
      <path d="M6 2h9l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" fill={file.color} />
      <path d="M15 2v5h5" fill="white" fillOpacity=".45" />
      {file.letter ? <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize={file.letter.length > 1 ? "6" : "10"} fontWeight="600">{file.letter}</text> : <path d="M8 11h8M8 14h8M8 17h5" stroke="white" strokeWidth="1.2" />}
    </>}
  </svg>;
}

export function Filters({ config, update, onApply }) {
  const [draft, setDraft] = useState(() => ({ site: config.site, fileType: config.fileType, timeRange: config.timeRange || "", customSites: config.customSites || [] }));
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [other, setOther] = useState(OTHER_FILES.includes(config.fileType));
  const domainInput = useRef(null);
  useEffect(() => {
    setDraft({ site: config.site, fileType: config.fileType, timeRange: config.timeRange || "", customSites: config.customSites || [] });
    setOther(OTHER_FILES.includes(config.fileType));
  }, [config.site, config.fileType, config.timeRange, config.customSites]);
  const customSites = draft.site && !SITES.some(item => item.site === draft.site) && !draft.customSites.includes(draft.site) ? [...draft.customSites, draft.site] : draft.customSites;
  const change = patch => { setDraft(before => ({ ...before, ...patch })); setError(""); };
  function withDomain() {
    if (!domain.trim()) return draft;
    const site = normalizeSearchSite(domain);
    const customSites = [...draft.customSites];
    if (!SITES.some(item => item.site === site) && !customSites.includes(site)) {
      if (customSites.length >= 6) throw new Error("En fazla 6 özel site ekleyebilirsin.");
      customSites.push(site);
    }
    return { ...draft, site, customSites };
  }
  function addDomain() {
    try { change(withDomain()); setDomain(""); }
    catch (err) { setError(err.message); domainInput.current?.focus(); }
  }
  function apply(event) {
    event.preventDefault();
    try { const next = withDomain(); if (next.site) normalizeSearchSite(next.site); update(next); setDraft(next); setDomain(""); setError(""); onApply?.(); }
    catch (err) { setError(err.message); }
  }
  return <form className="nt-filters" onSubmit={apply}>
    <section className="nt-filter-section" aria-label="Site filtresi">
      <header><h2>Site</h2><button type="button" className="nt-icon-button nt-filter-info" aria-label="Site filtresi hakkında" aria-expanded={info} onClick={() => setInfo(!info)}><Icon name="info" /></button></header>
      {info && <p className="nt-filter-hint">Seçilen sitenin Google’da görünen sayfalarında arama yapar.</p>}
      <div className="nt-filter-sites">
        {SITES.map(item => <button type="button" className="nt-filter-chip" key={item.site} aria-pressed={draft.site === item.site} onClick={() => change({ site: item.site })}>
          <span className="nt-filter-brand">{item.icon === "globe" ? <Icon name="globe" /> : <BrandIcon item={item} />}</span>{item.title}
        </button>)}
        <button type="button" className="nt-filter-chip" onClick={() => domainInput.current?.focus()}><Icon name="plus" />Ekle</button>
        {customSites.map(site => <button type="button" key={site} className="nt-filter-chip nt-custom-site" aria-pressed={draft.site === site} title={site} onClick={() => change({ site })}><Icon name="link" /><span>{site}</span></button>)}
      </div>
      <div className="nt-filter-domain">
        <label><Icon name="link" /><input ref={domainInput} aria-label="Alan adı" placeholder="Alan adı ekle (ör. example.com)" maxLength="300" value={domain} onChange={event => { setDomain(event.target.value); setError(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addDomain(); } }} /></label>
        <button type="button" aria-label="Alan adını ekle" onClick={addDomain}><Icon name="arrow" /></button>
      </div>
    </section>
    <section className="nt-filter-section" aria-label="Dosya türü filtresi"><h2>Dosya türü</h2>
      <div className="nt-filter-files">{FILES.map(file => <button type="button" className="nt-filter-chip" key={file.value} aria-pressed={file.value === "other" ? OTHER_FILES.includes(draft.fileType) : draft.fileType === file.value} onClick={() => { if (file.value === "other") setOther(!other); else { change({ fileType: draft.fileType === file.value ? "" : file.value }); setOther(false); } }}><FileBadge file={file} />{file.title}</button>)}</div>
      {other && <select aria-label="Diğer dosya türü" value={OTHER_FILES.includes(draft.fileType) ? draft.fileType : ""} onChange={event => change({ fileType: event.target.value })}><option value="">Dosya türü seç</option>{OTHER_FILES.map(type => <option key={type} value={type}>{type.toUpperCase()}</option>)}</select>}
    </section>
    <section className="nt-filter-section" aria-label="Zaman filtresi"><h2>Zaman</h2><div className="nt-filter-times">{TIMES.map(([value, title]) => <button type="button" className="nt-filter-chip" key={value} aria-pressed={draft.timeRange === value} onClick={() => change({ timeRange: value })}>{title}</button>)}</div></section>
    {error && <p className="nt-error" role="alert">{error}</p>}
    <footer className="nt-filter-actions"><button type="button" className="nt-filter-clear" onClick={() => { change({ site: "", fileType: "", timeRange: "" }); setDomain(""); setOther(false); }}><Icon name="reset" />Temizle</button><button className="nt-primary">Uygula</button></footer>
  </form>;
}

export default function Search(props) {
  const [expanded, setExpanded] = useState(false);
  const filterButton = useRef(null);
  const { config, query, setQuery, onError } = props;
  function search(event) { event.preventDefault(); try { location.assign(searchUrl(query, config.site, config.fileType, config.timeRange)); } catch (error) { onError(error.message); } }
  return <div className="nt-search-area"><form className="nt-search" onSubmit={search}>
    <Icon name="search" /><input id="nt-query" aria-label="Google’da ara" type="search" placeholder="Web’de ara…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
    <button ref={filterButton} type="button" className={`nt-icon-button ${config.site || config.fileType || config.timeRange ? "has-filters" : ""}`} aria-label="Gelişmiş arama filtreleri" aria-expanded={expanded} title="Site, dosya türü ve zaman filtreleri" onClick={() => setExpanded(!expanded)}><Icon name="filter" /></button>
  </form>{expanded && <WidgetPopover anchor={filterButton} title="Arama filtreleri" header={false} pointed className="nt-filter-popover" onClose={() => setExpanded(false)}><Filters {...props} onApply={() => { setExpanded(false); filterButton.current?.focus(); }} /></WidgetPopover>}</div>;
}
