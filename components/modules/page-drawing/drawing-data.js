import { t } from "../../../modules/i18n.js";
export const DRAWING_AUTO_KEY = "drawingAutoRestore";
export const DRAWING_INDEX_KEY = "drawingCustomIndex";

export async function drawingUrlKey(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(t("common_try_again_on_regular_web_page"));
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parsed.href));
  return `drawing:url:${[...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeDrawing(value) {
  if (!value || !Array.isArray(value.strokes) || value.strokes.length > 2000) throw new Error(t("drawing_invalid_drawing"));
  let count = 0;
  const strokes = value.strokes.map(stroke => {
    if (!Array.isArray(stroke.points) || !stroke.points.length || (count += stroke.points.length) > 100000) throw new Error(t("drawing_drawing_is_too_large"));
    if (!/^#[\da-f]{6}$/i.test(stroke.color) || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 64) throw new Error(t("drawing_invalid_drawing_setting"));
    const points = stroke.points.map(point => {
      if (!Array.isArray(point) || point.length !== 2 || point.some(number => !Number.isFinite(number) || number < 0 || number > 1000000)) throw new Error(t("drawing_invalid_drawing_point"));
      return [...point];
    });
    return { color: stroke.color, width: stroke.width, tool: stroke.tool === "eraser" ? "eraser" : "pen", points };
  });
  return { strokes, width: Math.max(1, Math.min(1000000, Number(value.width) || 1)), height: Math.max(1, Math.min(1000000, Number(value.height) || 1)) };
}
