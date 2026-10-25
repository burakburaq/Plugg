import { useCallback, useEffect, useRef, useState } from "react";
import Toggle from "../Toggle.jsx";

function restrictionFor(info) {
  if (info.enabled && info.mayDisable === false) return "Chrome tarafından kilitli";
  if (!info.enabled && info.mayEnable === false) return "Chrome etkinleştirmeye izin vermiyor";
  return "";
}

function ExtensionRow({ info, pending, onToggle }) {
  const icon = [...(info.icons || [])].sort((a, b) => b.size - a.size)[0];
  const [iconLoaded, setIconLoaded] = useState(false);
  useEffect(() => { setIconLoaded(false); }, [icon?.url]);
  const restriction = restrictionFor(info);
  return <article className={`extension-row ${info.enabled ? "is-enabled" : ""} ${pending ? "is-pending" : ""}`} data-id={info.id}>
    <div className="extension-icon">
      {!iconLoaded && <span className="icon-fallback" aria-hidden="true">{info.name.slice(0, 1).toLocaleUpperCase("tr")}</span>}
      {icon && <img src={icon.url} alt="" width="32" height="32" style={{ visibility: iconLoaded ? "visible" : "hidden" }} onLoad={() => setIconLoaded(true)} onError={() => setIconLoaded(false)} />}
    </div>
    <div className="extension-info">
      <div className="extension-title"><h3 className="extension-name" title={info.name}>{info.name}</h3><span className="extension-version">v{info.version}</span></div>
      <p className="extension-description">{info.description || "Bu eklenti için açıklama bulunmuyor."}</p>
      {restriction && <span className="restriction">{restriction}</span>}
    </div>
    <div className="extension-controls"><Toggle checked={info.enabled} onChange={() => onToggle(info)} disabled={!!restriction || pending}
      aria-label={`${info.name}: ${info.enabled ? "kapat" : "aç"}`} aria-busy={pending} title={restriction || (info.enabled ? "Eklentiyi kapat" : "Eklentiyi aç")} /></div>
  </article>;
}

export default function ExtensionManager({ sortOrder, onSortChange }) {
  const management = globalThis.chrome?.management;
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(new Set());
  const pendingIds = useRef(new Set());
  const version = useRef(0);
  const mounted = useRef(false);
  const noticeTimer = useRef();

  const load = useCallback(async () => {
    if (!management) {
      setLoading(false);
      setError("Bu sayfayı kullanmak için eklentiyi Chrome'un Uzantılar sayfasından ‘Paketlenmemiş öğe yükle’ ile yükle.");
      return;
    }
    const current = ++version.current;
    setLoading(true);
    try {
      const installed = await management.getAll();
      if (!mounted.current || current !== version.current) return;
      setExtensions(installed.filter(info => info.type === "extension" && info.id !== chrome.runtime.id));
      setLoaded(true);
      setError("");
    } catch {
      if (mounted.current && current === version.current) setError("Eklenti listesi alınamadı. Modülü kapatıp tekrar açabilirsin.");
    } finally {
      if (mounted.current && current === version.current) setLoading(false);
    }
  }, [management]);

  useEffect(() => {
    mounted.current = true;
    load();
    const events = management ? [management.onInstalled, management.onUninstalled, management.onEnabled, management.onDisabled] : [];
    events.forEach(event => event.addListener(load));
    return () => {
      mounted.current = false;
      ++version.current;
      clearTimeout(noticeTimer.current);
      events.forEach(event => event.removeListener(load));
    };
  }, [load, management]);

  async function toggle(info) {
    if (pendingIds.current.has(info.id) || restrictionFor(info)) return;
    pendingIds.current.add(info.id);
    setPending(new Set(pendingIds.current));
    setError("");
    let failure = "";
    try {
      // Keep the Chrome call in the user's click handler for native permission dialogs.
      await management.setEnabled(info.id, !info.enabled);
      if (mounted.current) {
        setNotice(`${info.name} ${info.enabled ? "kapatıldı" : "açıldı"}.`);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(""), 3200);
      }
    } catch { failure = `${info.name} ${info.enabled ? "kapatılamadı" : "açılamadı"}. Chrome işlemi engellemiş veya onay iptal edilmiş olabilir.`; }
    finally {
      pendingIds.current.delete(info.id);
      if (mounted.current) {
        setPending(new Set(pendingIds.current));
        await load();
        if (mounted.current && failure) setError(failure);
      }
    }
  }

  const sorted = [...extensions].sort((a, b) => {
    const stateOrder = sortOrder === "enabled" ? Number(b.enabled) - Number(a.enabled) : sortOrder === "disabled" ? Number(a.enabled) - Number(b.enabled) : 0;
    return stateOrder || a.name.localeCompare(b.name, "tr");
  });
  return <section id="manager-view">
    <section className="manager-panel" aria-label="Eklenti yönetimi">
      <div className="panel-heading"><h2>Yüklü eklentiler</h2>
        <span id="summary" className="summary" aria-live="polite">{!management ? "Chrome bağlantısı yok" : loading && !loaded ? "Yükleniyor…" : `${extensions.length} eklenti · ${extensions.filter(info => info.enabled).length} açık`}</span>
        <select id="sort-order" className="sort-select" aria-label="Eklenti sıralaması" value={sortOrder} disabled={!management} onChange={event => onSortChange(event.target.value)}>
          <option value="enabled">Aktif</option><option value="disabled">Pasif</option><option value="alphabetical">Alfabetik</option>
        </select>
      </div>
      {error && <div id="error" className="error-message" role="alert">{error}</div>}
      <div id="extension-list" className="extension-list" aria-busy={loading}>{sorted.map(info => <ExtensionRow key={info.id} info={info} pending={pending.has(info.id)} onToggle={toggle} />)}</div>
      {loaded && !extensions.length && <div id="empty-state" className="empty-state"><span className="empty-symbol" aria-hidden="true">☷</span><h3>Henüz başka eklenti yok</h3><p>Chrome'a eklediğin diğer eklentiler burada görünür.</p></div>}
    </section>
    {notice && <div id="notice" className="notice" role="status">{notice}</div>}
  </section>;
}
