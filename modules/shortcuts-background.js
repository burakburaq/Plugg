import { SHORTCUTS_KEY, SHORTCUT_CONDITIONS_KEY, SHORTCUT_CONDITIONS, TAB_HISTORY_KEY, CUSTOM_COMMANDS, BUILTIN_COMMANDS, normalizeShortcuts, normalizeShortcutConditions, validateShortcut, recordActivation } from "./shortcut-settings.js";
import { shortcutConditionMet, shortcutCondition } from "./shortcut-focus.js";

async function history() {
  const stored = await chrome.storage.session.get(TAB_HISTORY_KEY);
  return stored[TAB_HISTORY_KEY] || {};
}

export async function trackShortcutTab(info) {
  const before = await history();
  const next = recordActivation(before, info);
  if (next !== before) await chrome.storage.session.set({ [TAB_HISTORY_KEY]: next });
}

export async function resetShortcutTabs(active) {
  const next = {};
  if (active) for (const tab of await chrome.tabs.query({ active: true })) next[tab.windowId] = { current: tab.id, previous: null };
  await chrome.storage.session.set({ [TAB_HISTORY_KEY]: next });
}

export async function forgetShortcutTab(tabId, info) {
  const next = await history();
  let changed = false;
  for (const [windowId, pair] of Object.entries(next)) {
    if (info?.isWindowClosing && Number(windowId) === info.windowId) { delete next[windowId]; changed = true; continue; }
    for (const key of ["current", "previous"]) if (pair[key] === tabId) { pair[key] = null; changed = true; }
  }
  if (changed) await chrome.storage.session.set({ [TAB_HISTORY_KEY]: next });
}

export async function replaceShortcutTab(added, removed) {
  const next = await history();
  let changed = false;
  for (const pair of Object.values(next)) for (const key of ["current", "previous"]) {
    if (pair[key] === removed) { pair[key] = added; changed = true; }
  }
  if (changed) await chrome.storage.session.set({ [TAB_HISTORY_KEY]: next });
}

export async function runShortcut(command, commandTab) {
  let action = command;
  let url;
  if (CUSTOM_COMMANDS.includes(command)) {
    const stored = await chrome.storage.local.get(SHORTCUTS_KEY);
    const shortcut = normalizeShortcuts(stored[SHORTCUTS_KEY]).find(item => item.command === command);
    if (!shortcut) return;
    ({ action, url } = shortcut);
  } else if (!BUILTIN_COMMANDS.includes(command)) return;
  const tab = commandTab?.id !== undefined ? await chrome.tabs.get(commandTab.id) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab) return;
  const [bindings, storedConditions] = await Promise.all([chrome.commands.getAll(), chrome.storage.local.get(SHORTCUT_CONDITIONS_KEY)]);
  const binding = bindings.find(item => item.name === command)?.shortcut || "";
  const conditions = normalizeShortcutConditions(storedConditions[SHORTCUT_CONDITIONS_KEY]);
  if (!await shortcutConditionMet(tab.id, shortcutCondition(command, binding, conditions))) return;
  if (action === "new-tab" || action === "open-url") {
    await chrome.tabs.create({ windowId: tab.windowId, ...(url ? { url } : {}) });
  } else if (action === "duplicate-tab") {
    await chrome.tabs.duplicate(tab.id);
  } else if (["tab-left", "tab-right"].includes(action)) {
    const tabs = (await chrome.tabs.query({ windowId: tab.windowId })).sort((a, b) => a.index - b.index);
    const index = tabs.findIndex(item => item.id === tab.id);
    const next = tabs[index + (action === "tab-left" ? -1 : 1)];
    if (next) {
      await chrome.tabs.update(next.id, { active: true });
      await trackShortcutTab({ tabId: next.id, windowId: next.windowId });
    }
  } else {
    await trackShortcutTab({ tabId: tab.id, windowId: tab.windowId });
    const recent = await history();
    const pair = recent[tab.windowId];
    if (!Number.isInteger(pair?.previous)) return;
    let previous;
    try { previous = await chrome.tabs.get(pair.previous); }
    catch { await forgetShortcutTab(pair.previous); return; }
    if (previous.windowId !== tab.windowId) { await forgetShortcutTab(previous.id); return; }
    await chrome.tabs.update(previous.id, { active: true });
    // Store immediately, so even rapid presses and worker suspension preserve the toggle.
    await trackShortcutTab({ tabId: previous.id, windowId: previous.windowId });
  }
}

function messageCondition(message) {
  if (message.condition !== undefined) {
    if (typeof message.condition !== "string" || !Object.hasOwn(SHORTCUT_CONDITIONS, message.condition)) throw new Error("Geçersiz kısayol koşulu.");
    return message.condition;
  }
  // Older open popups may still send the boolean condition.
  if (message.skipWhenTyping !== undefined) {
    if (typeof message.skipWhenTyping !== "boolean") throw new Error("Geçersiz kısayol koşulu.");
    return message.skipWhenTyping ? "not-typing" : "always";
  }
}

export async function handleShortcuts(message) {
  const [stored, storedConditions] = await Promise.all([chrome.storage.local.get(SHORTCUTS_KEY), chrome.storage.local.get(SHORTCUT_CONDITIONS_KEY)]);
  let shortcuts = normalizeShortcuts(stored[SHORTCUTS_KEY]);
  const conditions = normalizeShortcutConditions(storedConditions[SHORTCUT_CONDITIONS_KEY]);
  if (message.type === "shortcuts:add") {
    const item = validateShortcut(message.shortcut);
    if (shortcuts.some(existing => existing.command === item.command)) throw new Error("Bu kısayol yuvası dolu.");
    const condition = messageCondition(message);
    shortcuts = [...shortcuts, item];
    delete conditions[item.command];
    if (condition) conditions[item.command] = condition;
    await chrome.storage.local.set({ [SHORTCUTS_KEY]: shortcuts, [SHORTCUT_CONDITIONS_KEY]: conditions });
  } else if (message.type === "shortcuts:remove") {
    if (!CUSTOM_COMMANDS.includes(message.command)) throw new Error("Geçersiz kısayol.");
    shortcuts = shortcuts.filter(item => item.command !== message.command);
    delete conditions[message.command];
    await chrome.storage.local.set({ [SHORTCUTS_KEY]: shortcuts, [SHORTCUT_CONDITIONS_KEY]: conditions });
  } else if (message.type === "shortcuts:condition") {
    if (!BUILTIN_COMMANDS.includes(message.command) && !shortcuts.some(item => item.command === message.command)) throw new Error("Geçersiz kısayol.");
    const condition = messageCondition(message);
    if (!condition) throw new Error("Geçersiz kısayol koşulu.");
    conditions[message.command] = condition;
    await chrome.storage.local.set({ [SHORTCUT_CONDITIONS_KEY]: conditions });
  } else if (message.type !== "shortcuts:get") throw new Error("Bilinmeyen kısayol işlemi.");
  const bindings = await chrome.commands.getAll();
  const bindingMap = Object.fromEntries(bindings.map(item => [item.name, item.shortcut || ""]));
  return { shortcuts, bindings: bindingMap, conditions: Object.fromEntries([...BUILTIN_COMMANDS, ...shortcuts.map(item => item.command)].map(command => [command, shortcutCondition(command, bindingMap[command] || "", conditions)])) };
}
