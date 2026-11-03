export const DARK_KEY = "darkModeSettings";
export const DARK_DEFAULTS = { enabled: false, brightness: 100, contrast: 100, sepia: 0, background: "#0d1017", text: "#ffffff", excluded: [] };
export function normalizeDark(value = {}) {
  if (!value || typeof value !== "object") value = {};
  const bound = (key, min, max) => Number.isFinite(value[key]) ? Math.min(max, Math.max(min, value[key])) : DARK_DEFAULTS[key];
  const color = key => /^#[0-9a-f]{6}$/i.test(value[key] || "") ? value[key] : DARK_DEFAULTS[key];
  return { enabled: value.enabled === true, brightness: bound("brightness", 50, 150), contrast: bound("contrast", 50, 150), sepia: bound("sepia", 0, 100), background: color("background"), text: color("text"),
    excluded: [...new Set((Array.isArray(value.excluded) ? value.excluded : []).filter(host => typeof host === "string" && /^[a-z0-9.-]+$/i.test(host)).map(host => host.toLowerCase()))].slice(0, 200) };
}
