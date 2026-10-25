import { useEffect, useRef, useState } from "react";
import { WEATHER_KEY, WEATHER_ORIGINS, normalizeWeather, weatherDescription } from "../../modules/newtab-data.js";
import useStoredState from "./useStoredState.js";
import Icon from "./Icon.jsx";
import WidgetPopover from "./WidgetPopover.jsx";
import WeatherSymbol from "./WeatherSymbol.jsx";

async function json(url, signal) {
  const response = await fetch(url, { credentials: "omit", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  if (!response.ok) throw new Error("Hava durumu servisine ulaşılamadı.");
  return response.json();
}
export default function Weather() {
  const [state, update, ready, storageError] = useStoredState(WEATHER_KEY, normalizeWeather);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [choosing, setChoosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const anchor = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const searchController = useRef(null);
  useEffect(() => () => searchController.current?.abort(), []);
  useEffect(() => {
    if (!ready || !state.city) return;
    if (!refresh && state.snapshot && Date.now() - state.snapshot.at < 30 * 60 * 1000 && state.snapshot.at <= Date.now()) return;
    const controller = new AbortController();
    (async () => {
      setBusy(true); setError("");
      if (!await chrome.permissions.contains({ origins: WEATHER_ORIGINS })) throw new Error("Şehir seçerek hava durumu erişimini aç.");
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({ latitude: state.city.latitude, longitude: state.city.longitude, current: "temperature_2m,apparent_temperature,weather_code,is_day", daily: "temperature_2m_max,temperature_2m_min", timezone: "auto", forecast_days: 1 }).toString();
      const data = await json(url, controller.signal);
      if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code)) throw new Error("Hava durumu verisi alınamadı.");
      if (!controller.signal.aborted) update({ city: state.city, snapshot: { temperature: data.current.temperature_2m, feelsLike: data.current.apparent_temperature, code: data.current.weather_code, high: data.daily?.temperature_2m_max?.[0], low: data.daily?.temperature_2m_min?.[0], at: Date.now() } });
    })().catch(err => { if (!controller.signal.aborted) setError(err.name === "TimeoutError" ? "Bağlantı zaman aşımına uğradı." : err.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [ready, state.city?.latitude, state.city?.longitude, refresh]);
  async function search(event) {
    event.preventDefault(); if (query.trim().length < 2) return;
    searchController.current?.abort(); const controller = new AbortController(); searchController.current = controller;
    setBusy(true); setError(""); setResults([]);
    try {
      if (!await chrome.permissions.request({ origins: WEATHER_ORIGINS })) throw new Error("Hava durumu için erişim izni gerekli.");
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search"); url.search = new URLSearchParams({ name: query.trim(), count: 5, language: "tr", format: "json" }).toString();
      const data = await json(url, controller.signal);
      if (!controller.signal.aborted) { setResults(data.results || []); if (!data.results?.length) setError("Şehir bulunamadı."); }
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const snapshot = state.snapshot;
  return <div ref={anchor} className="nt-weather">
    <button className={`nt-weather-card ${state.city ? "" : "needs-city"}`} aria-label="Hava durumu ayrıntıları" aria-expanded={expanded} disabled={!ready} onClick={() => setExpanded(!expanded)}><WeatherSymbol code={snapshot?.code} /><span className="nt-weather-summary"><strong>{snapshot ? `${Math.round(snapshot.temperature)}°` : state.city ? "—" : "Şehir seç"}</strong><span>{state.city?.name || "Hava durumu"}</span></span><Icon className="nt-chevron" name="chevron" /></button>
    {expanded && <WidgetPopover anchor={anchor} title="Hava durumu" onClose={() => setExpanded(false)}>
    {state.city && <button className="nt-subtle nt-change-city" onClick={() => setChoosing(!choosing)}>Şehir değiştir</button>}
    {(!state.city || choosing) ? <div className="nt-city-picker"><p className="nt-hint">Şehrindeki havaya bir bak.</p><form className="nt-inline-form" onSubmit={search}><input aria-label="Şehir ara" placeholder="Şehir adı" value={query} maxLength="100" onChange={event => setQuery(event.target.value)} disabled={!ready} /><button className="nt-icon-button" aria-label="Şehir ara" disabled={!ready || busy || query.trim().length < 2}><Icon name="search" /></button></form><div className="nt-city-results">{results.map(city => <button key={city.id} onClick={() => { update({ city, snapshot: null }); setChoosing(false); setExpanded(false); setResults([]); setRefresh(n => n + 1); }}>{city.name}<small>{[city.admin1, city.country].filter(Boolean).join(", ")}</small></button>)}</div></div> : <>
      <div className="nt-weather-main"><div><p className="nt-city-name">{state.city.name}</p><strong>{snapshot ? `${Math.round(snapshot.temperature)}°` : "—"}</strong><p>{snapshot ? weatherDescription(snapshot.code) : busy ? "Yükleniyor…" : "Veri bekleniyor"}</p></div><Icon className="nt-weather-symbol" name={snapshot?.code === 0 ? "sun" : "cloud"} /></div>
      {snapshot && <p className="nt-weather-details">Hissedilen {Math.round(snapshot.feelsLike ?? snapshot.temperature)}° <span>↑ {Math.round(snapshot.high ?? snapshot.temperature)}° · ↓ {Math.round(snapshot.low ?? snapshot.temperature)}°</span></p>}
    </>}
    {(error || storageError) && <p className="nt-error" role="alert">{error || storageError}</p>}<footer className="nt-weather-footer"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>{state.city && !choosing && <button className="nt-icon-button" title="Havayı yenile" aria-label="Havayı yenile" disabled={busy} onClick={() => setRefresh(n => n + 1)}><Icon name="reset" /></button>}</footer></WidgetPopover>}
    {(error || storageError) && !expanded && <span className="nt-status-error" role="alert" title={error || storageError}>!</span>}
  </div>;
}
