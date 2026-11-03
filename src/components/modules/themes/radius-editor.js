// Chrome serializes this function into the active tab's isolated world.
export function radiusEditor(action, saved = [], expectedUrl = "") {
  const key = "__pluggRadiusEditor";
  const changesKey = "__pluggRadiusChanges";
  const state = globalThis[changesKey] ||= { changes: new Map(), observer: null };
  const names = ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"];
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
  function remember(element, selector) {
    let entry = state.changes.get(selector);
    if (!entry || entry.element !== element) {
      const original = names.map(name => ({ name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) }));
      entry = { element, selector, original, radius: "" };
      state.changes.set(selector, entry);
    }
    return entry;
  }
  if (action === "snapshot") return { entries: [...state.changes.values()].filter(entry => entry.element.isConnected && entry.radius).map(({ selector, radius }) => ({ selector, radius })) };
  if (action === "reset") {
    state.observer?.disconnect(); state.observer = null;
    for (const entry of state.changes.values()) if (entry.element.isConnected) {
      for (const item of entry.original) {
        if (item.value) entry.element.style.setProperty(item.name, item.value, item.priority);
        else entry.element.style.removeProperty(item.name);
      }
    }
    state.changes.clear(); globalThis[key]?.refresh();
    return { active: !!globalThis[key] };
  }
  if (action === "restore") {
    if (expectedUrl !== location.href || !Array.isArray(saved)) return { restored: false };
    state.observer?.disconnect();
    const entries = saved.filter(item => typeof item?.selector === "string" && item.selector.length <= 2048 && /^\d+(?:\.\d+)?px$/.test(item.radius)).slice(0, 1000);
    function apply() {
      if (location.href !== expectedUrl) { state.observer?.disconnect(); state.observer = null; return; }
      for (const item of entries) {
        let element;
        try { element = document.querySelector(item.selector); } catch { continue; }
        if (!element || state.changes.get(item.selector)?.element === element) continue;
        const entry = remember(element, item.selector); entry.radius = item.radius;
        element.style.setProperty("border-radius", item.radius, "important");
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
  const { signal } = controller;
  const host = document.createElement("div");
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = ":host{all:initial}.guides{position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.corner{fill:none;stroke:#7656ff;stroke-width:3;stroke-linecap:round}.dashed{fill:none;stroke:#7656ff;stroke-width:3;stroke-linecap:round;stroke-dasharray:7 7}.handle{position:fixed;display:none;width:16px;height:16px;box-sizing:border-box;border:2px solid white;border-radius:50%;background:#7656ff;box-shadow:0 1px 5px #0009;transform:translate(-50%,-50%);cursor:nesw-resize;pointer-events:auto;touch-action:none}";
  const svgNS = "http://www.w3.org/2000/svg";
  const guides = document.createElementNS(svgNS, "svg");
  guides.classList.add("guides");
  guides.setAttribute("aria-hidden", "true");
  const arcs = Array.from({ length: 4 }, () => {
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("class", "corner");
    guides.append(path);
    return path;
  });
  const dashed = document.createElementNS(svgNS, "path");
  dashed.setAttribute("class", "dashed");
  guides.append(dashed);
  const handle = document.createElement("div");
  handle.className = "handle";
  shadow.append(style, guides, handle);
  document.documentElement.append(host);
  let selected = null, corner = null, dragging = null;

  function radiusAt(element, name, rect) {
    const values = getComputedStyle(element)[name].trim().split(/\s+/);
    const length = (value, size) => Math.max(0, (parseFloat(value) || 0) * (value.endsWith("%") ? size / 100 : 1));
    return {
      x: Math.min(rect.width / 2, length(values[0], rect.width)),
      y: Math.min(rect.height / 2, length(values[1] || values[0], rect.height))
    };
  }

  function handlePoint(element, item, rect) {
    const radius = radiusAt(element, item.name, rect);
    return { x: item.x + item.sx * radius.x, y: item.y + item.sy * radius.y };
  }

  function locate(element, x, y) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16) return null;
    const corners = [
      { x: rect.left, y: rect.top, sx: 1, sy: 1, name: "borderTopLeftRadius" },
      { x: rect.right, y: rect.top, sx: -1, sy: 1, name: "borderTopRightRadius" },
      { x: rect.left, y: rect.bottom, sx: 1, sy: -1, name: "borderBottomLeftRadius" },
      { x: rect.right, y: rect.bottom, sx: -1, sy: -1, name: "borderBottomRightRadius" }
    ];
    return corners.find(item => {
      const point = handlePoint(element, item, rect);
      // Keep the handle available along the diagonal from the corner to its current radius.
      const dx = point.x - item.x, dy = point.y - item.y;
      const distanceSquared = dx * dx + dy * dy;
      const progress = distanceSquared ? Math.max(0, Math.min(1, ((x - item.x) * dx + (y - item.y) * dy) / distanceSquared)) : 0;
      return Math.hypot(x - item.x - dx * progress, y - item.y - dy * progress) <= 24;
    }) || null;
  }

  function position() {
    if (!selected?.isConnected || !corner) { handle.style.display = "none"; guides.style.display = "none"; selected = corner = null; return; }
    const rect = selected.getBoundingClientRect();
    guides.style.display = "block";
    const corners = [
      { x: rect.left, y: rect.top, sx: 1, sy: 1, name: "borderTopLeftRadius" },
      { x: rect.right, y: rect.top, sx: -1, sy: 1, name: "borderTopRightRadius" },
      { x: rect.left, y: rect.bottom, sx: 1, sy: -1, name: "borderBottomLeftRadius" },
      { x: rect.right, y: rect.bottom, sx: -1, sy: -1, name: "borderBottomRightRadius" }
    ];
    corners.forEach((item, index) => {
      const radius = radiusAt(selected, item.name, rect);
      if (!radius.x || !radius.y) { arcs[index].setAttribute("d", ""); return; }
      const sweep = item.sx === item.sy ? 1 : 0;
      arcs[index].setAttribute("d", `M ${item.x} ${item.y + item.sy * radius.y} A ${radius.x} ${radius.y} 0 0 ${sweep} ${item.x + item.sx * radius.x} ${item.y}`);
    });
    corner.x = corner.sx === 1 ? rect.left : rect.right;
    corner.y = corner.sy === 1 ? rect.top : rect.bottom;
    const point = handlePoint(selected, corner, rect);
    dashed.setAttribute("d", `M ${corner.x} ${point.y} L ${point.x} ${point.y} M ${point.x} ${corner.y} L ${point.x} ${point.y}`);
    handle.style.left = `${point.x}px`;
    handle.style.top = `${point.y}px`;
    handle.style.cursor = corner.sx === corner.sy ? "nwse-resize" : "nesw-resize";
    handle.style.display = "block";
  }

  function hasVisibleSurface(element, style) {
    if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0) return false;
    if (/^(IMG|VIDEO|CANVAS|SVG|IFRAME|INPUT|TEXTAREA|SELECT|BUTTON)$/.test(element.tagName.toUpperCase())) return true;
    const visibleColor = color => color && color !== "transparent" && !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(color);
    function painted(s) {
      if (s.display === "none" || s.visibility !== "visible" || Number(s.opacity) === 0) return false;
      if (s.backgroundImage !== "none" || visibleColor(s.backgroundColor) || s.boxShadow !== "none") return true;
      return ["Top", "Right", "Bottom", "Left"].some(side =>
        s[`border${side}Style`] !== "none" && s[`border${side}Style`] !== "hidden" &&
        parseFloat(s[`border${side}Width`]) > 0 && visibleColor(s[`border${side}Color`])
      );
    }
    if (painted(style)) return true;
    return ["::before", "::after"].some(pseudo => {
      const s = getComputedStyle(element, pseudo);
      return s.content !== "none" && s.content !== "normal" && painted(s);
    });
  }

  function inspect(x, y) {
    let element = document.elementFromPoint(x, y);
    if (element === host) return;
    while (element && element !== document.documentElement && element !== document.body) {
      const style = getComputedStyle(element);
      const isInlineText = style.display === "inline" && !/^(IMG|VIDEO|CANVAS|SVG|IFRAME|INPUT|TEXTAREA|SELECT|BUTTON)$/.test(element.tagName.toUpperCase());
      const isText = /^(P|SPAN|H[1-6]|LABEL|STRONG|B|EM|I|SMALL|CODE|PRE|Q|CITE|TIME|MARK|SUB|SUP|ABBR)$/.test(element.tagName) || isInlineText;
      const match = !isText && hasVisibleSurface(element, style) ? locate(element, x, y) : null;
      if (match) { selected = element; corner = match; position(); return; }
      element = element.parentElement;
    }
    selected = corner = null; handle.style.display = "none"; guides.style.display = "none";
  }

  window.addEventListener("pointermove", event => {
    if (dragging) {
      const rect = selected.getBoundingClientRect();
      const change = ((event.clientX - dragging.x) * corner.sx + (event.clientY - dragging.y) * corner.sy) / 2;
      const radius = Math.max(0, Math.min(Math.min(rect.width, rect.height) / 2, dragging.radius + change));
      const entry = remember(selected, selectorFor(selected));
      entry.radius = `${Math.round(radius)}px`;
      selected.style.setProperty("border-radius", entry.radius, "important");
      position();
      event.preventDefault(); event.stopImmediatePropagation();
    } else if (!event.composedPath().includes(host)) inspect(event.clientX, event.clientY);
  }, { capture: true, signal });
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !selected || !corner) return;
    const rect = selected.getBoundingClientRect();
    const radius = radiusAt(selected, corner.name, rect).x;
    dragging = { x: event.clientX, y: event.clientY, radius };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault(); event.stopPropagation();
  }, { signal });
  handle.addEventListener("pointerup", event => {
    dragging = null;
    chrome.runtime.sendMessage({ target: "themes-popup", type: "radius:changed" }).catch(() => {});
    event.preventDefault(); event.stopPropagation();
  }, { signal });
  handle.addEventListener("pointercancel", () => { dragging = null; }, { signal });
  handle.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); }, { signal });
  window.addEventListener("scroll", () => { if (selected) position(); }, { capture: true, passive: true, signal });
  window.addEventListener("resize", position, { passive: true, signal });
  document.addEventListener("pointerout", event => { if (!event.relatedTarget && !dragging) { handle.style.display = "none"; guides.style.display = "none"; } }, { signal });
  function stop() { controller.abort(); host.remove(); delete globalThis[key]; }
  globalThis[key] = { stop, refresh: position };
  return { active: true };
}
