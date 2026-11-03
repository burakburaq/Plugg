// This function is copied by chrome.scripting into the selected page.
export function inspectFonts(action, connectionName) {
  // Load the extension font without changing the site's own styles.
  fetch(chrome.runtime.getURL("fonts/BebasNeue-Regular.ttf"))
    .then(response => { if (!response.ok) throw new Error("Font okunamadı"); return response.arrayBuffer(); })
    .then(bytes => new FontFace("Plugg Bebas", bytes).load())
    .then(font => document.fonts.add(font)).catch(error => console.warn("Bebas Neue yüklenemedi:", error));

  const key = "__pluggWhatsThisFontInspector";
  if (action === "prepare") {
    globalThis[key]?.stop();
    const runtime = chrome.runtime;
    const cancel = () => { clearTimeout(timer); runtime.onConnect.removeListener(connect); };
    const connect = port => {
      if (port.name !== connectionName || port.sender?.id !== runtime.id) return;
      cancel();
      const state = inspectFonts("start");
      const inspector = globalThis[key];
      port.onDisconnect.addListener(() => inspector?.stop());
      inspector.onStop = () => { try { port.postMessage({ active: false }); } catch {} };
      port.postMessage(state);
    };
    // If the popup closes before connecting, no inspector is ever started.
    const timer = setTimeout(cancel, 5000);
    runtime.onConnect.addListener(connect);
    return { active: false };
  }
  if (action === "status") return { active: !!globalThis[key] };
  if (action === "stop") {
    globalThis[key]?.stop();
    return { active: false };
  }
  if (globalThis[key]) return { active: true };

  const host = document.createElement("div");
  host.dataset.fontInspector = "";
  for (const [property, value] of Object.entries({ position: "fixed", inset: "0", "pointer-events": "none", "z-index": "2147483647" })) host.style.setProperty(property, value, "important");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = ":host{all:initial}.tip{position:fixed;box-sizing:border-box;max-width:calc(100vw - 16px);padding:9px 12px;background:#171c26;color:#ffffff;border:1px solid #343d4d;border-radius:10px;box-shadow:0 4px 18px #0005;font:12px/1.5 'Plugg Bebas',sans-serif;pointer-events:none}.tip[hidden]{display:none}.name{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.details{color:#ffffff}";
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  const name = document.createElement("span");
  name.className = "name";
  const details = document.createElement("span");
  details.className = "details";
  tip.append(name, details);
  shadow.append(style, tip);
  document.documentElement.append(host);
  const listeners = new AbortController();
  const runtime = globalThis.chrome?.runtime;
  const receiver = (message, sender, reply) => {
    if (message?.target !== "whats-this-font-inspector" || sender.id !== runtime.id) return;
    if (message.type === "font:stop") { stop(); reply({ active: false }); }
    if (message.type === "font:status") reply({ active: !!globalThis[key] });
  };
  runtime?.onMessage.addListener(receiver);
  let frame;
  let hovered;
  let x = 0;
  let y = 0;
  let stopped = false;

  function stop() {
    if (stopped) return;
    stopped = true;
    listeners.abort();
    cancelAnimationFrame(frame);
    host.remove();
    runtime?.onMessage.removeListener(receiver);
    globalThis[key]?.onStop?.();
    delete globalThis[key];
  }

  function draw() {
    frame = undefined;
    if (!hovered?.isConnected || (!hovered.textContent?.trim() && !hovered.matches("input,textarea"))) { tip.hidden = true; return; }
    const font = getComputedStyle(hovered);
    name.textContent = font.fontFamily.replaceAll('"', "");
    details.textContent = `${font.fontSize} · ${font.fontWeight}${font.fontStyle !== "normal" ? ` · ${font.fontStyle}` : ""}`;
    tip.hidden = false;
    const bounds = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - bounds.width - 8))}px`;
    tip.style.top = `${Math.max(8, Math.min(y + 18, innerHeight - bounds.height - 8))}px`;
  }

  document.addEventListener("pointermove", event => {
    hovered = event.composedPath().find(node => node instanceof Element);
    x = event.clientX;
    y = event.clientY;
    if (frame === undefined) frame = requestAnimationFrame(draw);
  }, { capture: true, passive: true, signal: listeners.signal });
  document.addEventListener("click", event => {
    if (event.button !== 0) return;
    const target = event.composedPath().find(node => node instanceof Element);
    if (!target?.isConnected || (!target.textContent?.trim() && !target.matches("input,textarea"))) return;
    const font = getComputedStyle(target);
    const family = font.fontFamily.replaceAll('"', "");
    const description = `${family} · ${font.fontSize} · ${font.fontWeight}${font.fontStyle !== "normal" ? ` · ${font.fontStyle}` : ""}`;
    event.preventDefault(); event.stopImmediatePropagation();
    stop();
    globalThis.__pluggWhatsThisBubble?.({ anchor: target, clientX: event.clientX, clientY: event.clientY, copyValue: family, displayText: description, background: "#171c26", foreground: "#ffffff", kind: "font" });
  }, { capture: true, signal: listeners.signal });
  document.addEventListener("pointerleave", () => { tip.hidden = true; hovered = null; }, { signal: listeners.signal });
  document.addEventListener("scroll", () => { tip.hidden = true; }, { capture: true, passive: true, signal: listeners.signal });
  document.addEventListener("keydown", event => { if (event.key === "Escape") stop(); }, { capture: true, signal: listeners.signal });
  window.addEventListener("pagehide", stop, { once: true, signal: listeners.signal });
  globalThis[key] = { stop };
  return { active: true };
}
