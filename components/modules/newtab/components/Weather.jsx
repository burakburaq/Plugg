import { t, uiLocale } from "../../../../modules/i18n.js";
import { useEffect, useRef, useState } from "react";
import { WEATHER_KEY, WEATHER_ORIGINS, normalizeWeather, weatherDescription } from "../newtab-data.js";
import useStoredState from "./useStoredState.js";
import Icon from "./Icon.jsx";
import WidgetPopover from "./WidgetPopover.jsx";
import WeatherSymbol from "./WeatherSymbol.jsx";

async function json(url, signal) {
  const response = await fetch(url, { credentials: "omit", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  if (!response.ok) throw new Error(t("weather_could_not_reach_weather_service"));
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
      if (!await chrome.permissions.contains({ origins: WEATHER_ORIGINS })) throw new Error(t("weather_choose_city_to_allow_weather_access"));
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({ latitude: state.city.latitude, longitude: state.city.longitude, current: "temperature_2m,apparent_temperature,weather_code,is_day", daily: "temperature_2m_max,temperature_2m_min", timezone: "auto", forecast_days: 1 }).toString();
      const data = await json(url, controller.signal);
      if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code)) throw new Error(t("weather_could_not_get_weather_data"));
      if (!controller.signal.aborted) update({ city: state.city, snapshot: { temperature: data.current.temperature_2m, feelsLike: data.current.apparent_temperature, code: data.current.weather_code, high: data.daily?.temperature_2m_max?.[0], low: data.daily?.temperature_2m_min?.[0], at: Date.now() } });
    })().catch(err => { if (!controller.signal.aborted) setError(err.name === "TimeoutError" ? t("weather_connection_timed_out") : err.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [ready, state.city?.latitude, state.city?.longitude, refresh]);
  async function search(event) {
    event.preventDefault(); if (query.trim().length < 2) return;
    searchController.current?.abort(); const controller = new AbortController(); searchController.current = controller;
    setBusy(true); setError(""); setResults([]);
    try {
      if (!await chrome.permissions.request({ origins: WEATHER_ORIGINS })) throw new Error(t("weather_weather_access_permission_is_required"));
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search"); url.search = new URLSearchParams({ name: query.trim(), count: 5, language: uiLocale().split(/[-_]/)[0], format: "json" }).toString();
      const data = await json(url, controller.signal);
      if (!controller.signal.aborted) { setResults(data.results || []); if (!data.results?.length) setError(t("weather_city_not_found")); }
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const snapshot = state.snapshot;
  return <div ref={anchor} className="nt-weather">
    <button className={`nt-weather-card ${state.city ? "" : "needs-city"}`} aria-label={t("weather_weather_details")} aria-expanded={expanded} disabled={!ready} onClick={() => setExpanded(!expanded)}><WeatherSymbol code={snapshot?.code} /><span className="nt-weather-summary"><strong>{snapshot ? `${Math.round(snapshot.temperature)}°` : state.city ? "—" : t("weather_select_city")}</strong><span>{state.city?.name || t("common_weather")}</span></span><Icon className="nt-chevron" name="chevron" /></button>
    {expanded && <WidgetPopover anchor={anchor} title={t("common_weather")} onClose={() => setExpanded(false)}>
    {state.city && <button className="nt-subtle nt-change-city" onClick={() => setChoosing(!choosing)}>{"" + t("weather_change_city") + ""}</button>}
    {(!state.city || choosing) ? <div className="nt-city-picker"><p className="nt-hint">{"" + t("weather_check_weather_in_your_city") + ""}</p><form className="nt-inline-form" onSubmit={search}><input aria-label={t("weather_search_city")} placeholder={t("weather_city_name")} value={query} maxLength="100" onChange={event => setQuery(event.target.value)} disabled={!ready} /><button className="nt-icon-button" aria-label={t("weather_search_city")} disabled={!ready || busy || query.trim().length < 2}><Icon name="search" /></button></form><div className="nt-city-results">{results.map(city => <button key={city.id} onClick={() => { update({ city, snapshot: null }); setChoosing(false); setExpanded(false); setResults([]); setRefresh(n => n + 1); }}>{city.name}<small>{[city.admin1, city.country].filter(Boolean).join(", ")}</small></button>)}</div></div> : <>
      <div className="nt-weather-main"><div><p className="nt-city-name">{state.city.name}</p><strong>{snapshot ? `${Math.round(snapshot.temperature)}°` : "—"}</strong><p>{snapshot ? weatherDescription(snapshot.code) : busy ? t("common_loading") : t("weather_waiting_for_data")}</p></div><Icon className="nt-weather-symbol" name={snapshot?.code === 0 ? "sun" : "cloud"} /></div>
      {snapshot && <p className="nt-weather-details">{"" + t("weather_feels_like") + " "}{Math.round(snapshot.feelsLike ?? snapshot.temperature)}° <span>↑ {Math.round(snapshot.high ?? snapshot.temperature)}° · ↓ {Math.round(snapshot.low ?? snapshot.temperature)}°</span></p>}
    </>}
    {(error || storageError) && <p className="nt-error" role="alert">{error || storageError}</p>}<footer className="nt-weather-footer"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{"" + t("weather_open_meteo") + ""}</a>{state.city && !choosing && <button className="nt-icon-button" title={t("weather_refresh_weather")} aria-label={t("weather_refresh_weather")} disabled={busy} onClick={() => setRefresh(n => n + 1)}><Icon name="reset" /></button>}</footer></WidgetPopover>}
    {(error || storageError) && !expanded && <span className="nt-status-error" role="alert" title={error || storageError}>!</span>}
  </div>;
}
