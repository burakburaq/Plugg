export const MODULE_IDS = ["manager", "volume", "qr", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow", "themes"];
export const DEFAULT_LAYOUT = { active: ["manager", "volume", "themes"], passive: ["qr", "font", "color", "drawing", "newtab", "shortcuts", "screenshot", "dark", "groups", "video", "gestureflow"] };
export const LAYOUT_KEY = "moduleLayout";

export function normalizeLayout(value) {
  if (!value || !Array.isArray(value.active) || !Array.isArray(value.passive)) {
    return { active: [...DEFAULT_LAYOUT.active], passive: [...DEFAULT_LAYOUT.passive] };
  }
  const seen = new Set();
  const unique = ids => ids.filter(id => {
    if (!MODULE_IDS.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const active = unique(value.active.map(id => id === "editor" ? "themes" : id));
  const passive = unique(value.passive);
  // New modules remain passive until the user enables them.
  passive.push(...MODULE_IDS.filter(id => !seen.has(id)));
  return { active, passive };
}

export function moveModule(layout, id, group, position) {
  const next = normalizeLayout(layout);
  if (!MODULE_IDS.includes(id) || !["active", "passive"].includes(group)) return next;
  const sourceGroup = next.active.includes(id) ? "active" : "passive";
  const sourceIndex = next[sourceGroup].indexOf(id);
  let index = Math.max(0, Math.min(next[group].length, position));
  if (sourceGroup === group && sourceIndex < index) index--;
  next[sourceGroup].splice(sourceIndex, 1);
  next[group].splice(index, 0, id);
  return next;
}
