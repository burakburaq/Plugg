import { t } from "./i18n.js";
const loaders = {
  manager: () => import("../components/modules/extension-manager/ExtensionManager.jsx"),
  qr: () => import("../components/modules/qr-creator/QrCreator.jsx"),
  volume: () => import("../components/modules/volume-booster/VolumeBooster.jsx"),
  font: () => import("../components/modules/font-finder/FontFinder.jsx"),
  color: () => import("../components/modules/color-picker/ColorPicker.jsx"),
  drawing: () => import("../components/modules/page-drawing/PageDrawing.jsx"),
  newtab: () => import("../components/modules/newtab/NewTabCustomizer.jsx"),
  shortcuts: () => import("../components/modules/keyboard-shortcuts/KeyboardShortcuts.jsx"),
  screenshot: () => import("../components/modules/page-capture/FullPageCapture.jsx"),
  dark: () => import("../components/modules/dark-mode/DarkMode.jsx"),
  groups: () => import("../components/modules/tab-groups/DomainGroups.jsx"),
  video: () => import("../components/modules/video-tools/VideoTools.jsx"),
  gestureflow: () => import("../components/modules/gestureflow/GestureFlow.jsx"),
  themes: () => import("../components/modules/themes/Themes.jsx")
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
  if (!Object.hasOwn(loaders, id)) return Promise.reject(new Error(t("common_unknown_module")));
  if (!pending.has(id)) {
    pending.set(id, loaders[id]().catch(error => { pending.delete(id); throw error; }));
  }
  return pending.get(id);
}

export function preloadModule(id) {
  // Importing prepares code only; component effects run when the user opens it.
  void loadModule(id).catch(() => {});
}
