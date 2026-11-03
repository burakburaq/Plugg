// Serialized by scripting.executeScript; keep every helper inside this function.
export function videoTools(initial = {}, rememberInitial = false) {
  const t = (key, ...values) => chrome.i18n?.getMessage?.(key, values.map(String)) || key;
  // Load the extension font without changing the site's own styles.
  fetch(chrome.runtime.getURL("fonts/BebasNeue-Regular.ttf"))
    .then(response => { if (!response.ok) throw new Error("Font okunamadı"); return response.arrayBuffer(); })
    .then(bytes => new FontFace("Plugg Bebas", bytes).load())
    .then(font => document.fonts.add(font)).catch(error => console.warn("Bebas Neue yüklenemedi:", error));
  const KEY = "__extensionManagerVideo";
  if (globalThis[KEY]) { globalThis[KEY].reveal(); return { active: true }; }
  const runtime = (globalThis.browser || globalThis.chrome)?.runtime;
  const defaults = { enabled: false, fill: true, zoom: 1, stretchX: 1, stretchY: 1, offsetX: 0, offsetY: 0, brightness: 1, contrast: 1, saturation: 1, sharpness: 0 };
  let settings = { ...defaults, ...initial }, remember = rememberInitial;
  let video, original, computed, panelOpen = false, page = "aspect", stopped = false, raf = 0, hideTimer, saveTimer;
  const signal = new AbortController();
  function visibleRect(element) {
    const r = element.getBoundingClientRect();
    return r.width >= 100 && r.height >= 60 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
  }
  function candidate() {
    return [...document.querySelectorAll("video")].filter(visibleRect).sort((a, b) => {
      const playing = Number(!b.paused && !b.ended) - Number(!a.paused && !a.ended);
      return playing || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight;
    })[0];
  }
  if (!candidate()) return { active: false, error: t("video_tools_no_visible_video_was_found_on_this") };
  const host = document.createElement("div"); host.dataset.videoTools = "";
  host.setAttribute("popover", "manual");
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;margin:0!important;padding:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;border:0!important;background:transparent!important;overflow:visible!important;pointer-events:none!important;z-index:2147483647!important;color-scheme:dark!important";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box} [hidden]{display:none!important}
    .anchor{position:fixed;pointer-events:none;font:12px "Plugg Bebas",sans-serif;color:#fff;opacity:0;transition:opacity 140ms}
    .anchor.visible,.anchor:focus-within{opacity:1}.anchor:not(.visible):not(:focus-within) .bar{pointer-events:none}
    .bar{display:flex;width:124px;height:34px;align-items:center;position:relative;left:50%;transform:translateX(-50%);border:1px solid #3c4c60;border-radius:10px;background:#111923ed;box-shadow:0 4px 20px #0005;pointer-events:auto}
    button,input,select{font:inherit;color:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid white;outline-offset:2px}
    button{border:0;background:transparent} .zoom{flex:1;height:100%;font-weight:600;letter-spacing:.8px;border-radius:9px 0 0 9px}
    .zoom[aria-pressed=true]{background:#fff;color:#111923}.gear{display:grid;place-items:center;width:34px;height:100%;border-radius:0 9px 9px 0}.gear:hover,.gear[aria-expanded=true]{background:#2a3747}
    svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .panel{position:fixed;pointer-events:auto;background:#111923f5;border:1px solid #3c4c60;border-radius:12px;padding:12px;box-shadow:0 10px 32px #0007;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#495c74 transparent}
    .tabs{display:flex;align-items:center;gap:0;margin-bottom:12px;border-bottom:1px solid #2a384a;padding-bottom:9px}.tab{padding:6px 12px;color:#a3b5cd;border-radius:6px}.tab[aria-selected=true]{background:#263548;color:white}.tab+.tab{margin-left:8px}.close{margin-left:auto;font-size:18px;width:26px;height:26px;color:#a3b5cd}
    .field{display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:12px}.field input{grid-column:1/-1;accent-color:white;width:100%;height:16px;padding:0;margin:0;cursor:pointer}.field output{color:#a3b5cd;font-variant-numeric:tabular-nums}.check{display:flex;align-items:center;gap:8px;color:#b5c4d8;margin:8px 0 12px}.check input{accent-color:white;margin:0}
    .footer{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #2a384a;padding-top:10px}.footer button{color:#b5c4d8;padding:4px 0}.footer button:hover{color:white}.footer .check{margin:0}.error{color:#ffd2c4;font-size:11px;line-height:1.5;margin:8px 0 0}
    @media(prefers-reduced-motion:reduce){.anchor{transition:none}}
  `;
  shadow.append(style);
  function element(tag, attrs = {}, text) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  const anchor = element("div", { class: "anchor visible" });
  const bar = element("div", { class: "bar" });
  const zoom = element("button", { class: "zoom", type: "button", "aria-label": t("video_tools_toggle_zoom"), "aria-pressed": String(settings.enabled) }, "ZOOM");
  const gear = element("button", { class: "gear", type: "button", "aria-label": t("video_tools_video_settings"), "aria-expanded": "false", "aria-controls": "video-settings-panel" });
  gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-2 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="12" cy="11" r="3"/></svg>';
  bar.append(zoom, gear); anchor.append(bar); shadow.append(anchor);
  const panel = element("section", { class: "panel", id: "video-settings-panel", role: "dialog", "aria-label": t("video_tools_video_settings"), hidden: "" });
  const tabs = element("div", { class: "tabs", role: "tablist", "aria-label": t("video_tools_video_settings_pages") });
  const aspectTab = element("button", { class: "tab", type: "button", role: "tab", id: "video-aspect-tab", "aria-controls": "video-aspect" }, t("video_tools_aspect_ratio"));
  const imageTab = element("button", { class: "tab", type: "button", role: "tab", id: "video-image-tab", "aria-controls": "video-image" }, t("video_tools_image"));
  const close = element("button", { type: "button", class: "close", "aria-label": t("video_tools_close_menu") }, "×"); tabs.append(aspectTab, imageTab, close);
  const aspect = element("div", { role: "tabpanel", id: "video-aspect", "aria-labelledby": "video-aspect-tab" });
  const image = element("div", { role: "tabpanel", id: "video-image", "aria-labelledby": "video-image-tab" });
  const controls = new Map();
  const format = (key, value) => ["zoom", "stretchX", "stretchY"].includes(key) ? `${value.toFixed(2)}×` : `${Math.round(["brightness", "contrast", "saturation", "sharpness"].includes(key) ? value * 100 : value)}%`;
  function range(parent, key, title, min, max, step) {
    const label = element("label", { class: "field" });
    const text = element("span", {}, title), output = element("output", { for: `video-${key}` }, format(key, settings[key]));
    const input = element("input", { id: `video-${key}`, "aria-label": title, type: "range", min, max, step }); input.value = settings[key];
    label.append(text, output, input); parent.append(label); controls.set(key, { input, output });
    input.addEventListener("input", () => { settings[key] = Number(input.value); if (parent === aspect) settings.enabled = true; updateControls(); schedule(); persistSoon(); }, { signal: signal.signal });
  }
  const fillLabel = element("label", { class: "check" }), fill = element("input", { type: "checkbox" });
  fill.checked = settings.fill; fillLabel.append(fill, document.createTextNode(t("video_tools_fill_screen"))); aspect.append(fillLabel);
  range(aspect, "zoom", t("video_tools_zoom"), 1, 4, .01);
  range(aspect, "stretchX", t("video_tools_horizontal_stretch"), .5, 2, .01);
  range(aspect, "stretchY", t("video_tools_vertical_stretch"), .5, 2, .01);
  range(aspect, "offsetX", t("video_tools_horizontal_position"), -100, 100, 1);
  range(aspect, "offsetY", t("video_tools_vertical_position"), -100, 100, 1);
  range(image, "brightness", t("common_brightness"), .25, 2, .01);
  range(image, "contrast", t("common_contrast"), .25, 2, .01);
  range(image, "saturation", t("video_tools_saturation"), 0, 2, .01);
  range(image, "sharpness", t("video_tools_sharpness"), 0, 1, .01);
  const footer = element("div", { class: "footer" });
  const reset = element("button", { type: "button" }, t("common_reset"));
  const rememberLabel = element("label", { class: "check" }), rememberBox = element("input", { type: "checkbox" }); rememberBox.checked = remember;
  rememberLabel.append(rememberBox, document.createTextNode(t("video_tools_remember_for_this_site")));
  const finish = element("button", { type: "button", "aria-label": t("video_tools_close_video_tools") }, t("common_close")); footer.append(reset, rememberLabel, finish);
  const fullscreen = element("button", { type: "button", "aria-label": t("video_tools_toggle_player_fullscreen"), title: t("video_tools_open_player_and_controls_in_fullscreen") }, t("video_tools_fullscreen"));
  footer.insertBefore(fullscreen, finish);
  const error = element("p", { class: "error", role: "status", hidden: "" });
  panel.append(tabs, aspect, image, footer, error); anchor.append(panel);
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
  svg.dataset.videoFilters = ""; svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  const filterId = `video-filter-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, defs = document.createElementNS(ns, "defs"), filter = document.createElementNS(ns, "filter");
  filter.id = filterId; filter.setAttribute("color-interpolation-filters", "sRGB");
  const sharpen = document.createElementNS(ns, "feConvolveMatrix"); sharpen.setAttribute("order", "3"); sharpen.setAttribute("divisor", "1"); sharpen.setAttribute("edgeMode", "duplicate"); sharpen.setAttribute("preserveAlpha", "true");
  filter.append(sharpen); defs.append(filter); svg.append(defs);
  document.documentElement.append(svg, host);
  const observer = new ResizeObserver(schedule);
  const mutations = new MutationObserver(schedule); mutations.observe(document.documentElement, { childList: true, subtree: true });
  const props = ["transform", "transform-origin", "filter", "clip-path"];
  function restoreProperty(key) {
    const saved = original[key];
    if (saved.value) video.style.setProperty(key, saved.value, saved.priority); else video.style.removeProperty(key);
  }
  function restore() { if (video && original) for (const key of props) restoreProperty(key); }
  function viewport() {
    if (document.fullscreenElement?.contains(video)) return document.fullscreenElement.getBoundingClientRect();
    let parent = video.parentElement;
    for (let i = 0; i < 3 && parent && !["BODY", "HTML"].includes(parent.tagName); i++, parent = parent.parentElement) {
      const r = parent.getBoundingClientRect(); if (r.width >= 100 && r.height >= 60 && r.width * r.height < video.clientWidth * video.clientHeight * 5) return r;
    }
    return video.getBoundingClientRect();
  }
  function apply() {
    if (!video || !video.isConnected) return;
    // A browser-owned fullscreen <video> cannot render an interactive HTML overlay.
    // Keep native playback intact there; the menu offers container fullscreen instead.
    if (document.fullscreenElement === video) { restore(); anchor.hidden = true; return; }
    for (const key of ["transform", "transform-origin", "clip-path"]) restoreProperty(key);
    const box = video.getBoundingClientRect(), view = viewport();
    if (settings.enabled && box.width && box.height) {
      const ratio = video.videoWidth / video.videoHeight;
      let contentWidth = box.width, contentHeight = box.height;
      if (ratio > 0 && ["contain", "scale-down"].includes(computed.objectFit)) {
        contentWidth = Math.min(box.width, box.height * ratio); contentHeight = Math.min(box.height, box.width / ratio);
      }
      const cover = settings.fill ? Math.max(view.width / contentWidth, view.height / contentHeight) : 1;
      const x = cover * settings.zoom * settings.stretchX, y = cover * settings.zoom * settings.stretchY;
      video.style.setProperty("transform-origin", "50% 50%", "important");
      const base = computed.transform === "none" ? "" : computed.transform;
      video.style.setProperty("transform", `${base} translate(${settings.offsetX}%, ${settings.offsetY}%) scale(${x}, ${y})`, "important");
      const after = video.getBoundingClientRect(), sx = after.width / video.offsetWidth, sy = after.height / video.offsetHeight;
      if (sx > 0 && sy > 0) {
        const inset = [Math.max(0, (view.top - after.top) / sy), Math.max(0, (after.right - view.right) / sx), Math.max(0, (after.bottom - view.bottom) / sy), Math.max(0, (view.left - after.left) / sx)];
        video.style.setProperty("clip-path", `inset(${inset.map(v => `${v}px`).join(" ")})`, "important");
      }
    }
    const changed = ["brightness", "contrast", "saturation", "sharpness"].some(key => settings[key] !== defaults[key]);
    if (changed) {
      const a = settings.sharpness * .7;
      sharpen.setAttribute("kernelMatrix", `0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`);
      const svgFilter = settings.sharpness ? `url(${JSON.stringify(location.href.split("#")[0] + "#" + filterId)})` : "";
      video.style.setProperty("filter", `${computed.filter === "none" ? "" : computed.filter} brightness(${settings.brightness}) contrast(${settings.contrast}) saturate(${settings.saturation}) ${svgFilter}`, "important");
    } else restoreProperty("filter");
    position(view);
  }
  function position(view) {
    const visible = view.width > 0 && view.height > 0 && view.bottom > 0 && view.top < innerHeight && !document.hidden;
    anchor.hidden = !visible;
    const center = Math.max(78, Math.min(innerWidth - 78, view.left + view.width / 2));
    const top = Math.max(12, Math.min(innerHeight - 48, view.top + 12));
    anchor.style.left = `${center}px`; anchor.style.top = `${top}px`; anchor.style.width = "0px";
    const width = Math.min(360, innerWidth - 24);
    panel.style.width = `${width}px`; panel.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, center - width / 2))}px`;
    panel.style.top = `${top + 42}px`; panel.style.maxHeight = `${Math.max(60, Math.min(390, innerHeight - top - 54))}px`;
  }
  function update() {
    raf = 0; if (stopped) return;
    restore(); // Candidate visibility and player bounds must use the original geometry.
    const next = candidate();
    if (next !== video) {
      restore(); observer.disconnect(); video = next; original = null;
      if (video) {
        original = Object.fromEntries(props.map(key => [key, { value: video.style.getPropertyValue(key), priority: video.style.getPropertyPriority(key) }]));
        const css = getComputedStyle(video); computed = { transform: css.transform, filter: css.filter, objectFit: css.objectFit };
        observer.observe(video); if (video.parentElement) observer.observe(video.parentElement);
      }
    }
    if (!video) { anchor.hidden = true; return; }
    apply();
  }
  function schedule() { if (!raf && !stopped) raf = requestAnimationFrame(update); }
  function showHost() {
    const parent = document.fullscreenElement && document.fullscreenElement !== video ? document.fullscreenElement : document.documentElement;
    if (host.parentElement !== parent) parent.append(host);
    try { if (host.showPopover && !host.matches(":popover-open")) host.showPopover(); } catch {}
  }
  function reveal() {
    anchor.classList.add("visible"); clearTimeout(hideTimer);
    if (!panelOpen) hideTimer = setTimeout(() => anchor.classList.remove("visible"), 2200);
  }
  function open(value) { panelOpen = value; panel.hidden = !value; gear.setAttribute("aria-expanded", String(value)); reveal(); schedule(); }
  function setPage(value) {
    page = value; aspect.hidden = value !== "aspect"; image.hidden = value !== "image";
    aspectTab.setAttribute("aria-selected", String(value === "aspect")); imageTab.setAttribute("aria-selected", String(value === "image"));
    aspectTab.tabIndex = value === "aspect" ? 0 : -1; imageTab.tabIndex = value === "image" ? 0 : -1;
  }
  function updateControls() {
    zoom.setAttribute("aria-pressed", String(settings.enabled)); fill.checked = settings.fill;
    for (const [key, control] of controls) { control.input.value = settings[key]; control.output.textContent = format(key, settings[key]); }
  }
  function persist() {
    clearTimeout(saveTimer);
    runtime?.sendMessage({ target: "video-background", type: "video:save", remember, settings: { ...settings } }).then(response => {
      if (stopped) return;
      error.hidden = !!response?.ok;
      error.textContent = response?.ok ? "" : response?.error || t("video_tools_could_not_save_site_settings");
    }).catch(() => { if (!stopped) { error.textContent = t("video_tools_reopen_extension_to_save_settings"); error.hidden = false; } });
  }
  function persistSoon() { clearTimeout(saveTimer); if (remember) saveTimer = setTimeout(persist, 180); }
  function notify(active) { runtime?.sendMessage({ target: "video-background", type: "video:state", active }).catch(() => {}); }
  function stop() {
    if (stopped) return;
    if (saveTimer) persist();
    stopped = true; signal.abort(); observer.disconnect(); mutations.disconnect(); cancelAnimationFrame(raf); clearTimeout(hideTimer); clearTimeout(saveTimer);
    restore(); host.remove(); svg.remove(); runtime?.onMessage.removeListener(receive); delete globalThis[KEY]; notify(false);
  }
  function receive(message, sender, reply) {
    if (sender.id !== runtime.id || message.target !== "video-page") return;
    if (message.type === "video:stop") stop(); else if (message.type !== "video:status") return;
    reply({ active: !stopped });
  }
  zoom.addEventListener("click", () => { settings.enabled = !settings.enabled; updateControls(); schedule(); persistSoon(); reveal(); }, { signal: signal.signal });
  gear.addEventListener("click", () => open(!panelOpen), { signal: signal.signal });
  close.addEventListener("click", () => { open(false); gear.focus(); }, { signal: signal.signal });
  finish.addEventListener("click", stop, { signal: signal.signal });
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await (video.parentElement || document.documentElement).requestFullscreen();
    } catch { error.textContent = t("video_tools_could_not_enter_fullscreen_for_this_player"); error.hidden = false; }
  }, { signal: signal.signal });
  aspectTab.addEventListener("click", () => setPage("aspect"), { signal: signal.signal }); imageTab.addEventListener("click", () => setPage("image"), { signal: signal.signal });
  tabs.addEventListener("keydown", event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setPage(page === "aspect" ? "image" : "aspect"); (page === "aspect" ? aspectTab : imageTab).focus(); } }, { signal: signal.signal });
  fill.addEventListener("change", () => { settings.fill = fill.checked; settings.enabled = true; updateControls(); schedule(); persistSoon(); }, { signal: signal.signal });
  rememberBox.addEventListener("change", () => { remember = rememberBox.checked; persist(); }, { signal: signal.signal });
  reset.addEventListener("click", () => {
    const keys = page === "aspect" ? ["enabled", "fill", "zoom", "stretchX", "stretchY", "offsetX", "offsetY"] : ["brightness", "contrast", "saturation", "sharpness"];
    for (const key of keys) settings[key] = defaults[key]; updateControls(); schedule(); persistSoon();
  }, { signal: signal.signal });
  anchor.addEventListener("pointerenter", reveal, { signal: signal.signal });
  document.addEventListener("pointermove", event => {
    if (!video) return;
    const r = viewport(); if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) reveal();
  }, { passive: true, signal: signal.signal });
  document.addEventListener("pointerdown", event => { if (panelOpen && !event.composedPath().includes(host)) open(false); }, { capture: true, signal: signal.signal });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && panelOpen) { event.preventDefault(); event.stopPropagation(); open(false); gear.focus(); } }, { capture: true, signal: signal.signal });
  document.addEventListener("fullscreenchange", () => { try { if (host.matches(":popover-open")) host.hidePopover(); } catch {} showHost(); reveal(); schedule(); }, { signal: signal.signal });
  for (const event of ["play", "loadedmetadata", "emptied"]) document.addEventListener(event, schedule, { capture: true, signal: signal.signal });
  document.addEventListener("visibilitychange", schedule, { signal: signal.signal });
  window.addEventListener("resize", schedule, { passive: true, signal: signal.signal });
  window.addEventListener("scroll", schedule, { capture: true, passive: true, signal: signal.signal });
  window.addEventListener("pagehide", stop, { once: true, signal: signal.signal });
  runtime?.onMessage.addListener(receive);
  globalThis[KEY] = { stop, reveal };
  setPage("aspect"); showHost(); update(); reveal();
  return { active: true };
}
