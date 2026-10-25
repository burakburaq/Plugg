export const SHORTCUTS_KEY = "keyboardShortcuts";
export const SHORTCUT_CONDITIONS_KEY = "keyboardShortcutConditions";
export const TAB_HISTORY_KEY = "shortcutTabHistory";
export const CUSTOM_COMMANDS = Array.from({ length: 8 }, (_, index) => `custom-${index + 1}`);
export const BUILTIN_COMMANDS = ["previous-tab", "tab-left", "tab-right"];
export const SHORTCUT_COMMANDS = [...BUILTIN_COMMANDS, ...CUSTOM_COMMANDS];
export const SHORTCUT_CONDITIONS = {
  always: "Her zaman çalışsın",
  "not-typing": "Metin alanı aktifken çalışmasın",
  typing: "Sadece metin alanı aktifken çalışsın"
};
export const SHORTCUT_ACTIONS = {
  "previous-tab": "Önceki kullanılan sekmeye dön",
  "tab-left": "Sekme çubuğunda sola git",
  "tab-right": "Sekme çubuğunda sağa git",
  "new-tab": "Yeni sekme aç",
  "duplicate-tab": "Sekmeyi çoğalt",
  "open-url": "Bağlantı aç"
};

export function validateShortcut(value) {
  if (!CUSTOM_COMMANDS.includes(value?.command)) throw new Error("Geçersiz kısayol yuvası.");
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 60) throw new Error("1–60 karakterlik bir ad yaz.");
  if (!Object.hasOwn(SHORTCUT_ACTIONS, value.action)) throw new Error("Geçerli bir işlem seç.");
  let url = "";
  if (value.action === "open-url") {
    try {
      const parsed = new URL(value.url);
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      url = parsed.href;
    } catch { throw new Error("http:// veya https:// ile başlayan bir bağlantı yaz."); }
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
