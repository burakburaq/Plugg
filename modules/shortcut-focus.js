// Chrome serializes this function; do not reference module-scope helpers here.
export function inspectShortcutFocus() {
  if (!document.hasFocus()) return { focused: false, typing: false };
  let element = document.activeElement;
  const seen = new Set();
  while (element && !seen.has(element)) {
    seen.add(element);
    if (element.isContentEditable || element.ownerDocument.designMode?.toLowerCase() === "on") return { focused: true, typing: true };
    if (element.matches("textarea,select,[role='textbox'],[role='searchbox'],[role='combobox']")) return { focused: true, typing: true };
    if (element.tagName === "INPUT") return { focused: true, typing: !["button", "submit", "reset", "checkbox", "radio", "color", "file", "hidden", "image", "range"].includes(element.type) };
    const shadow = element.shadowRoot || globalThis.chrome?.dom?.openOrClosedShadowRoot?.(element);
    if (shadow?.activeElement) { element = shadow.activeElement; continue; }
    if (element.matches("iframe,frame")) {
      try {
        const inner = element.contentDocument?.activeElement;
        if (inner) { element = inner; continue; }
      } catch {}
      // Unknown focus must satisfy neither of the text-field conditions.
      return { focused: true, typing: null };
    }
    break;
  }
  return { focused: true, typing: false };
}

export function usesArrowKey(shortcut) {
  return /(?:^|\+)(?:Arrow)?(?:Left|Right|Up|Down|Sol Ok|Sağ Ok|Yukarı Ok|Aşağı Ok|←|→|↑|↓)$/i.test(shortcut.trim());
}

export function shortcutCondition(command, binding, conditions) {
  if (conditions[command]) return conditions[command];
  return usesArrowKey(binding) || (!binding && ["tab-left", "tab-right"].includes(command)) ? "not-typing" : "always";
}

export async function shortcutConditionMet(tabId, condition) {
  if (condition === "always") return true;
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: inspectShortcutFocus });
    const state = results.find(result => result.frameId === 0)?.result;
    // Browser chrome and unknown frames are not a confirmed text field or page focus.
    return state?.focused === true && (condition === "typing" ? state.typing === true : condition === "not-typing" && state.typing === false);
  } catch {
    // Chrome's own pages and unavailable documents cannot be inspected reliably.
    return false;
  }
}
