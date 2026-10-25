// Self-contained because Chrome serializes this function for injection.
export function editPage(action = "start") {
  const key = "__extensionManagerEditor";
  if (action === "stop") { globalThis[key]?.stop(); return { active: false }; }
  if (globalThis[key]) return { active: true };
  const runtime = chrome.runtime;
  const listeners = new AbortController();
  let selected, original, stopped = false;
  const host = document.createElement("div");
  host.dataset.pageEditor = "";
  host.style.cssText = "all:initial!important;position:fixed!important;top:12px!important;right:12px!important;z-index:2147483647!important";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = ":host{all:initial}.bar{display:flex;align-items:center;gap:10px;padding:10px;background:#171c26;color:#fff;border:1px solid #343d4d;border-radius:8px;font:12px system-ui,sans-serif;box-shadow:0 4px 20px #0005}button{padding:6px 9px;background:#232a36;color:#fff;border:1px solid #343d4d;border-radius:5px;cursor:pointer;font:inherit}";
  const bar = document.createElement("div"); bar.className = "bar";
  const text = document.createElement("span"); text.textContent = "Düzenlemek için metne tıkla · Esc ile bitir";
  const finish = document.createElement("button"); finish.type = "button"; finish.textContent = "Bitir";
  bar.append(text, finish); shadow.append(style, bar); document.documentElement.append(host);
  function restore() {
    if (!selected) return;
    for (const [name, value] of Object.entries(original)) {
      if (value === null) selected.removeAttribute(name); else selected.setAttribute(name, value);
    }
    selected = null;
  }
  function notify(active) { runtime.sendMessage({ target: "editor-background", type: "editor:state", active }).catch(() => {}); }
  function stop() {
    if (stopped) return;
    stopped = true; restore(); listeners.abort(); host.remove();
    runtime.onMessage.removeListener(receive); delete globalThis[key]; notify(false);
  }
  function toolbar(event) { return event.composedPath().includes(host); }
  function receive(message, sender, reply) {
    if (sender.id !== runtime.id || message.target !== "editor-page") return;
    if (message.type === "editor:stop") stop();
    else if (message.type !== "editor:status") return;
    reply({ active: !stopped });
  }
  window.addEventListener("click", event => {
    if (toolbar(event) || event.button !== 0) return;
    // Cancel navigation and page click handlers only while editing is enabled.
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target || target.closest("input,textarea,select,button,video,audio,canvas,svg,[data-page-drawing],[data-font-inspector]")) return;
    if (selected?.contains(target)) { selected.focus(); return; }
    let element = target;
    if (!element.textContent?.trim() || ["HTML", "BODY"].includes(element.tagName)) return;
    // Do not expose entire layout containers as editable areas.
    if (element.children.length && !["P", "SPAN", "A", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH", "LABEL", "B", "STRONG", "EM", "I"].includes(element.tagName)) {
      element = [...element.children].find(child => child.textContent?.trim() && !child.children.length);
      if (!element) return;
    }
    restore(); selected = element;
    original = { contenteditable: element.getAttribute("contenteditable"), tabindex: element.getAttribute("tabindex") };
    element.setAttribute("contenteditable", "plaintext-only"); element.setAttribute("tabindex", "0"); element.focus();
    const selection = getSelection(), range = document.createRange(); range.selectNodeContents(element);
    selection.removeAllRanges(); selection.addRange(range);
  }, { capture: true, signal: listeners.signal });
  window.addEventListener("pointerdown", event => {
    if (!toolbar(event) && event.button === 0 && event.target.closest?.("a[href]")) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true, signal: listeners.signal });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); stop(); }
  }, { capture: true, signal: listeners.signal });
  finish.addEventListener("click", stop, { signal: listeners.signal });
  window.addEventListener("pagehide", stop, { once: true, signal: listeners.signal });
  runtime.onMessage.addListener(receive); globalThis[key] = { stop }; notify(true);
  return { active: true };
}
