const loaders = {
  manager: () => import("../components/modules/ExtensionManager.jsx"),
  qr: () => import("../components/modules/QrCreator.jsx"),
  volume: () => import("../components/modules/VolumeBooster.jsx"),
  font: () => import("../components/modules/FontFinder.jsx"),
  color: () => import("../components/modules/ColorPicker.jsx"),
  drawing: () => import("../components/modules/PageDrawing.jsx"),
  newtab: () => import("../components/modules/NewTabCustomizer.jsx"),
  shortcuts: () => import("../components/modules/KeyboardShortcuts.jsx"),
  screenshot: () => import("../components/modules/FullPageCapture.jsx"),
  dark: () => import("../components/modules/DarkMode.jsx"),
  groups: () => import("../components/modules/DomainGroups.jsx"),
  editor: () => import("../components/modules/PageEditor.jsx"),
  video: () => import("../components/modules/VideoTools.jsx")
};
const pending = new Map();

export const RECENT_MODULES_KEY = "recentModuleOpens";
export const SORT_ORDER_KEY = "extensionManagerSortOrder";
export const RECENT_WINDOW = 10 * 60 * 1000;

export function normalizeSortOrder(value) {
  return ["enabled", "disabled", "alphabetical"].includes(value) ? value : "enabled";
}

export function recentModules(value, now = Date.now()) {
  return Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {})
    .filter(([id, time]) => Object.hasOwn(loaders, id) && Number.isFinite(time) && time <= now && now - time < RECENT_WINDOW));
}

export function loadModule(id) {
  if (!Object.hasOwn(loaders, id)) return Promise.reject(new Error("Bilinmeyen modül"));
  if (!pending.has(id)) {
    pending.set(id, loaders[id]().catch(error => { pending.delete(id); throw error; }));
  }
  return pending.get(id);
}

export function preloadModule(id) {
  // Importing prepares code only; component effects run when the user opens it.
  void loadModule(id).catch(() => {});
}
