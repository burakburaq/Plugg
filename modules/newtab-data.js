export const TODO_KEY = "newtabTodos";
export const NOTES_KEY = "newtabNotes";
export const FOCUS_KEY = "newtabFocus";
export const LINKS_KEY = "newtabLinks";
export const WEATHER_KEY = "newtabWeather";
export const WEATHER_ORIGINS = ["https://geocoding-api.open-meteo.com/*", "https://api.open-meteo.com/*"];
export const DEFAULT_LINKS = [
  { id: "youtube", title: "YouTube", url: "https://www.youtube.com/", icon: "youtube" },
  { id: "gmail", title: "Gmail", url: "https://mail.google.com/", icon: "gmail" },
  { id: "notion", title: "Notion", url: "https://www.notion.so/", icon: "notion" },
  { id: "github", title: "GitHub", url: "https://github.com/", icon: "github" }
];
export const DEFAULT_FOCUS = { duration: 25, remaining: 25 * 60, endsAt: null };

export function safeLink(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Geçerli bir web adresi gir.");
  value = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:/i.test(value)) throw new Error("Geçerli bir web adresi gir.");
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Geçerli bir web adresi gir.");
  return url.href;
}
export function normalizeLinks(value) {
  if (!Array.isArray(value)) return DEFAULT_LINKS;
  const seen = new Set();
  return value.slice(0, 12).flatMap(item => {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) return [];
    seen.add(item.id);
    try { return item && typeof item.title === "string" && item.title.trim() ? [{ id: String(item.id), title: item.title.slice(0, 40), url: safeLink(item.url), icon: ["youtube", "gmail", "notion", "github"].includes(item.icon) ? item.icon : "link" }] : []; }
    catch { return []; }
  });
}
export function normalizeTodos(value) {
  const seen = new Set();
  return Array.isArray(value) ? value.filter(item => item && typeof item.id === "string" && !seen.has(item.id) && seen.add(item.id) && typeof item.text === "string" && item.text.trim()).slice(0, 100).map(item => ({ id: item.id, text: item.text.slice(0, 300), done: item.done === true, ...(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.time) ? { time: item.time } : {}) })) : [];
}
export function normalizeFocus(value) {
  const duration = [5, 15, 25, 50].includes(value?.duration) ? value.duration : 25;
  return { duration, remaining: Number.isFinite(value?.remaining) ? Math.max(0, Math.min(duration * 60, value.remaining)) : duration * 60, endsAt: Number.isFinite(value?.endsAt) ? value.endsAt : null };
}
export function focusRemaining(value, now = Date.now()) {
  return value.endsAt === null ? value.remaining : Math.max(0, Math.min(value.duration * 60, Math.ceil((value.endsAt - now) / 1000)));
}
export function normalizeWeather(value) {
  const city = value?.city;
  if (!city || !Number.isFinite(city.latitude) || Math.abs(city.latitude) > 90 || !Number.isFinite(city.longitude) || Math.abs(city.longitude) > 180 || typeof city.name !== "string") return { city: null, snapshot: null };
  const s = value.snapshot;
  return { city: { name: city.name.slice(0, 100), country: typeof city.country === "string" ? city.country.slice(0, 100) : "", latitude: city.latitude, longitude: city.longitude }, snapshot: s && Number.isFinite(s.temperature) && Number.isFinite(s.code) && Number.isFinite(s.at) ? s : null };
}
export function weatherDescription(code) {
  if (code === 0) return "Açık";
  if (code <= 3) return "Parçalı bulutlu";
  if (code <= 48) return "Sisli";
  if (code <= 57) return "Çiseleyen";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Yağmurlu";
  if (code <= 86) return "Karlı";
  return "Gök gürültülü";
}
