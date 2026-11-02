// Chrome serializes this function into the active tab's isolated world.
export function textEditor(action, saved = [], expectedUrl = "") {
  const key = "__pluggTextEditor", stateKey = "__pluggTextChanges";
  const state = globalThis[stateKey] ||= { changes: new Map(), observer: null };
  function selectorFor(element) {
    const parts = [];
    for (let node = element; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
      const tag = node.localName;
      const siblings = node.parentElement ? [...node.parentElement.children].filter(child => child.localName === tag) : [node];
      parts.unshift(`${CSS.escape(tag)}:nth-of-type(${siblings.indexOf(node) + 1})`);
    }
    return parts.join(" > ");
  }
  function remember(element, selector, original = element.textContent) {
    let entry = state.changes.get(element);
    if (!entry) { entry = { element, selector, original }; state.changes.set(element, entry); }
    return entry;
  }
  if (action === "snapshot") return { entries: [...state.changes.values()].filter(item => item.element.isConnected).map(item => ({ selector: item.selector, original: item.original, text: item.element.textContent })) };
  if (action === "reset") {
    state.observer?.disconnect(); state.observer = null;
    for (const entry of state.changes.values()) if (entry.element.isConnected) entry.element.textContent = entry.original;
    state.changes.clear();
    return { active: !!globalThis[key] };
  }
  if (action === "restore") {
    if (expectedUrl !== location.href || !Array.isArray(saved)) return { restored: false };
    state.observer?.disconnect();
    const entries = saved.filter(item => typeof item?.selector === "string" && item.selector.length <= 2048 && typeof item.original === "string" && typeof item.text === "string" && item.original.length <= 20000 && item.text.length <= 20000).slice(0, 1000);
    function apply() {
      if (location.href !== expectedUrl) { state.observer?.disconnect(); state.observer = null; return; }
      for (const item of entries) {
        let element;
        try { element = document.querySelector(item.selector); } catch { continue; }
        if (!element || element.children.length || state.changes.has(element) || element.textContent !== item.original) continue;
        remember(element, item.selector, item.original); element.textContent = item.text;
      }
    }
    apply();
    state.observer = new MutationObserver(apply);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    return { restored: true };
  }
  if (action === "status") return { active: !!globalThis[key] };
  if (action === "stop") { globalThis[key]?.stop(); return { active: false }; }
  if (globalThis[key]) return { active: true };
  const controller = new AbortController();
  let selected = null, attributes = null;
  function restoreAttributes() {
    if (!selected) return;
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) selected.removeAttribute(name); else selected.setAttribute(name, value);
    }
    selected = attributes = null;
  }
  function stop() { restoreAttributes(); controller.abort(); delete globalThis[key]; notify(); }
  function notify() { chrome.runtime.sendMessage({ target: "themes-popup", type: "text:changed" }).catch(() => {}); }
  window.addEventListener("click", event => {
    if (event.button !== 0 || event.composedPath().some(node => node?.dataset?.pageEditor !== undefined)) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || target.closest("input,textarea,select,button,video,audio,canvas,svg,[contenteditable],[data-page-drawing],[data-font-inspector]") && !selected?.contains(target)) return;
    if (selected?.contains(target)) { if (target.closest("a[href]")) event.preventDefault(); return; }
    let element = target;
    if (["HTML", "BODY"].includes(element.tagName)) return;
    while (element.children.length === 1 && element.children[0].textContent?.trim()) element = element.children[0];
    if (element.children.length || !element.textContent?.trim()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    restoreAttributes();
    selected = element; attributes = { contenteditable: element.getAttribute("contenteditable"), tabindex: element.getAttribute("tabindex") };
    remember(element, selectorFor(element));
    element.setAttribute("contenteditable", "plaintext-only"); element.setAttribute("tabindex", "0"); element.focus();
    const selection = getSelection(), range = document.createRange(); range.selectNodeContents(element); selection.removeAllRanges(); selection.addRange(range);
  }, { capture: true, signal: controller.signal });
  window.addEventListener("input", event => { if (selected?.contains(event.target)) notify(); }, { capture: true, signal: controller.signal });
  window.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); stop(); } }, { capture: true, signal: controller.signal });
  globalThis[key] = { stop };
  return { active: true };
}
