export const VIDEO_SITES_KEY = "videoSiteSettings";
export const VIDEO_DEFAULTS = { enabled: false, fill: true, zoom: 1, stretchX: 1, stretchY: 1, offsetX: 0, offsetY: 0, brightness: 1, contrast: 1, saturation: 1, sharpness: 0 };
export function normalizeVideoSettings(value = {}) {
  const next = { ...VIDEO_DEFAULTS };
  const limits = { zoom: [1, 4], stretchX: [.5, 2], stretchY: [.5, 2], offsetX: [-100, 100], offsetY: [-100, 100], brightness: [.25, 2], contrast: [.25, 2], saturation: [0, 2], sharpness: [0, 1] };
  for (const [key, [min, max]] of Object.entries(limits)) if (Number.isFinite(value?.[key])) next[key] = Math.min(max, Math.max(min, value[key]));
  for (const key of ["enabled", "fill"]) if (typeof value?.[key] === "boolean") next[key] = value[key];
  return next;
}
