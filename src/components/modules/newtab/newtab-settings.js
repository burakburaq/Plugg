import { t } from "../../../modules/i18n.js";
export const NEWTAB_KEY = "newtabSettings";
export const FILE_TYPES = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "json", "image"];
export const TIME_RANGES = ["", "day", "week", "month", "year"];
export const WIDGET_TYPES = ["clock", "search", "links", "todo", "notes", "weather", "focus", "filters"];
export const WIDGET_TITLES = { clock: t("new_tab_clock"), search: t("new_tab_search"), links: t("new_tab_shortcuts"), todo: t("new_tab_tasks"), notes: t("common_quick_notes"), weather: t("common_weather"), focus: t("common_focus_timer"), filters: t("new_tab_advanced_filters") };
const minimum = { clock: { width: 260, height: 148 }, search: { width: 300, height: 76 }, links: { width: 300, height: 128 }, todo: { width: 260, height: 152 }, notes: { width: 260, height: 136 }, weather: { width: 180, height: 76 }, focus: { width: 200, height: 42 }, filters: { width: 280, height: 190 } };
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export function fitWidget(item, viewport) {
  const min = minimum[item.type];
  const top = item.type === "weather" ? 32 : 72;
  const width = Math.max(Math.min(min.width, viewport.width - 32), Math.min(finite(item.width, min.width), viewport.width - 32));
  const height = Math.max(min.height, Math.min(finite(item.height, min.height), viewport.height - 88));
  return { ...item, width, height,
    x: Math.max(16, Math.min(finite(item.x, 16), viewport.width - width - 16)),
    y: Math.max(top, Math.min(finite(item.y, top), viewport.height - height - 16)) };
}

export function newWidget(type, viewport) {
  const width = ["clock", "search", "links"].includes(type) ? Math.min(620, viewport.width - 48) : ({ todo: 352, notes: 352, weather: 190, focus: 200, filters: 320 })[type];
  const heroY = Math.max(72, (viewport.height - 350) * .22);
  const positions = { clock: [(viewport.width - width) / 2, heroY, 160], search: [(viewport.width - width) / 2, heroY + 170, 76], links: [(viewport.width - width) / 2, heroY + 284, 128], todo: [48, heroY + 322, 192], notes: [viewport.width - width - 48, heroY + 322, 156], weather: [viewport.width - width - 32, 32, 76], focus: [(viewport.width - width) / 2, heroY + 416, 42], filters: [48, viewport.height - 240, 200] };
  const [x, y, height] = positions[type];
  return fitWidget({ id: type, type, x, y, width, height }, viewport);
}

export function defaultNewTab(viewport = { width: 1280, height: 720 }) {
  return { version: 3, site: "", fileType: "", timeRange: "", customSites: [], items: ["clock", "search", "links"].map(type => newWidget(type, viewport)) };
}

export function normalizeNewTab(value, viewport = { width: 1280, height: 720 }) {
  if (!value || !Array.isArray(value.items)) return defaultNewTab(viewport);
  const seen = new Set();
  // Old filter fields move into the search bar; existing filter values are retained.
  // The compact preset replaces old card geometry without enabling removed widgets.
  const source = value.version === 3 || !value.items.length ? value.items : value.version === 2 ? value.items.map(item => WIDGET_TYPES.includes(item?.type) ? newWidget(item.type, viewport) : item) : [newWidget("clock", viewport), ...value.items.filter(item => item?.type !== "filters").map(item => WIDGET_TYPES.includes(item?.type) ? newWidget(item.type, viewport) : item), newWidget("links", viewport)];
  const items = source.filter(item => item && WIDGET_TYPES.includes(item.type) && !seen.has(item.type) && seen.add(item.type))
    .map(item => ({ id: item.type, type: item.type, x: finite(item.x, 16), y: finite(item.y, 72),
      width: Math.max(minimum[item.type].width, finite(item.width, minimum[item.type].width)),
      height: Math.max(minimum[item.type].height, finite(item.height, minimum[item.type].height)) }));
  const customSites = [...new Set((Array.isArray(value.customSites) ? value.customSites : []).flatMap(site => {
    try { return typeof site === "string" && site.trim() ? [normalizeSearchSite(site)] : []; } catch { return []; }
  }))].slice(0, 6);
  return { version: 3, items, site: typeof value.site === "string" ? value.site.slice(0, 300) : "", fileType: FILE_TYPES.includes(value.fileType) ? value.fileType : "", timeRange: TIME_RANGES.includes(value.timeRange) ? value.timeRange : "", customSites };
}

export function normalizeSearchSite(site) {
  const value = site.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!/^[a-z\d\u0080-\uffff.-]+(?::\d+)?(?:\/[^\s?#]*)?$/i.test(value)) throw new Error(t("new_tab_enter_example"));
  return value;
}

export function searchQuery(text, site, fileType, timeRange = "", now = new Date()) {
  const parts = [text.trim()];
  if (site.trim()) parts.push(`site:${normalizeSearchSite(site)}`);
  if (fileType === "image") parts.push("(filetype:png OR filetype:jpg OR filetype:jpeg OR filetype:webp OR filetype:gif OR filetype:svg)");
  else if (FILE_TYPES.includes(fileType)) parts.push(`filetype:${fileType}`);
  if (["week", "month", "year"].includes(timeRange)) {
    const start = new Date(now);
    if (timeRange === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    else if (timeRange === "month") start.setDate(1);
    else start.setMonth(0, 1);
    parts.push(`after:${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`);
  }
  return parts.filter(Boolean).join(" ");
}

export function searchUrl(text, site, fileType, timeRange = "", now = new Date()) {
  const query = searchQuery(text, site, fileType, timeRange, now);
  if (!query) throw new Error(t("new_tab_enter_search_term_or_filter"));
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  if (timeRange === "day") url.searchParams.set("as_qdr", "d");
  return url.href;
}
