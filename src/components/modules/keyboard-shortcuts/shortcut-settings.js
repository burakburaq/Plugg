import { t } from "../../../modules/i18n.js";
export const SHORTCUTS_KEY = "keyboardShortcuts";
export const SHORTCUT_CONDITIONS_KEY = "keyboardShortcutConditions";
export const TAB_HISTORY_KEY = "shortcutTabHistory";
export const CUSTOM_COMMANDS = Array.from({ length: 8 }, (_, index) => `custom-${index + 1}`);
export const BUILTIN_COMMANDS = ["previous-tab", "tab-left", "tab-right"];
export const SHORTCUT_COMMANDS = [...BUILTIN_COMMANDS, ...CUSTOM_COMMANDS];
export const SHORTCUT_CONDITIONS = {
  always: t("shortcuts_always_active"),
  "not-typing": t("shortcuts_inactive_while_typing"),
  typing: t("shortcuts_only_while_typing")
};
export const SHORTCUT_ACTIONS = {
  "previous-tab": t("shortcuts_return_to_previous_tab_2"),
  "tab-left": t("shortcuts_move_left_in_tab_bar"),
  "tab-right": t("shortcuts_move_right_in_tab_bar"),
  "new-tab": t("shortcuts_open_new_tab"),
  "duplicate-tab": t("shortcuts_duplicate_tab"),
  "open-url": t("shortcuts_open_link")
};

export function validateShortcut(value) {
  if (!CUSTOM_COMMANDS.includes(value?.command)) throw new Error(t("shortcuts_invalid_shortcut_slot"));
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 60) throw new Error(t("shortcuts_enter_name_of_1_60_characters"));
  if (!Object.hasOwn(SHORTCUT_ACTIONS, value.action)) throw new Error(t("shortcuts_choose_valid_action"));
  let url = "";
  if (value.action === "open-url") {
    try {
      const parsed = new URL(value.url);
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      url = parsed.href;
    } catch { throw new Error(t("shortcuts_enter_url_starting_with_http_or_https")); }
  }
  return { command: value.command, name, action: value.action, url };
}

export function normalizeShortcuts(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).flatMap(item => {
    try {
      const shortcut = validateShortcut(item);
      if (seen.has(shortcut.command)) return [];
      seen.add(shortcut.command);
      return [shortcut];
    } catch { return []; }
  });
}

// Missing entries keep the previous default: arrow bindings are protected while typing.
export function normalizeShortcutConditions(value) {
  return Object.fromEntries(SHORTCUT_COMMANDS.flatMap(command => {
    const condition = value?.[command];
    if (typeof condition === "boolean") return [[command, condition ? "not-typing" : "always"]];
    return typeof condition === "string" && Object.hasOwn(SHORTCUT_CONDITIONS, condition) ? [[command, condition]] : [];
  }));
}

// Each window has its own last two tabs; repeated activation is idempotent.
export function recordActivation(history, { tabId, windowId }) {
  const last = history[windowId];
  if (last?.current === tabId) return history;
  return { ...history, [windowId]: { current: tabId, previous: last?.current ?? (last?.previous !== tabId ? last?.previous : null) ?? null } };
}
