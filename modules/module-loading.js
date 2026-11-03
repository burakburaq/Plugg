import { t } from "./i18n.js";
export const MODULE_VERSION_LOADERS = {
  manager: {
    1: () => import("../components/modules/extension-manager/ExtensionManager.jsx"),
  },
  qr: {
    1: () => import("../components/modules/qr-creator/QrCreator.jsx"),
  },
  volume: {
    1: () => import("../components/modules/volume-booster/VolumeBooster.jsx"),
  },
  font: {
    1: () => import("../components/modules/font-finder/FontFinder.jsx"),
  },
  color: {
    1: () => import("../components/modules/color-picker/ColorPicker.jsx"),
  },
  drawing: {
    1: () => import("../components/modules/page-drawing/PageDrawing.jsx"),
  },
  newtab: {
    1: () => import("../components/modules/newtab/NewTabCustomizer.jsx"),
  },
  shortcuts: {
    1: () => import("../components/modules/keyboard-shortcuts/KeyboardShortcuts.jsx"),
  },
  screenshot: {
    1: () => import("../components/modules/page-capture/FullPageCapture.jsx"),
  },
  dark: {
    1: () => import("../components/modules/dark-mode/DarkMode.jsx"),
  },
  groups: {
    1: () => import("../components/modules/tab-groups/DomainGroups.jsx"),
  },
  video: {
    1: () => import("../components/modules/video-tools/VideoTools.jsx"),
  },
  gestureflow: {
    1: () => import("../components/modules/gestureflow/GestureFlow.jsx"),
  },
  themes: {
    1: () => import("../components/modules/themes/Themes.jsx"),
  },
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
    .filter(([id, time]) => Object.hasOwn(MODULE_VERSION_LOADERS, id) && Number.isFinite(time) && time <= now && now - time < RECENT_WINDOW));
}

export function loadModule(id, version = 1) {
  const loader = MODULE_VERSION_LOADERS[id]?.[version];
  if (!loader) return Promise.reject(new Error(t("common_unknown_module")));
  const key = `${id}:${version}`;
  if (!pending.has(key)) {
    pending.set(key, loader().catch(error => { pending.delete(key); throw error; }));
  }
  return pending.get(key);
}

export function preloadModule(id, version = 1) {
  // Importing prepares code only; component effects run when the user opens it.
  void loadModule(id, version).catch(() => {});
}
