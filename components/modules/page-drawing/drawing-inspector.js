// Self-contained: Chrome copies this function into the page's isolated world.
export function inspectDrawing(options = {}) {
  const t = (key, ...values) => chrome.i18n?.getMessage?.(key, values.map(String)) || key;
  // Load the extension font without changing the site's own styles.
  fetch(chrome.runtime.getURL("fonts/BebasNeue-Regular.ttf"))
    .then(response => { if (!response.ok) throw new Error("Font okunamadı"); return response.arrayBuffer(); })
    .then(bytes => new FontFace("Plugg Bebas", bytes).load())
    .then(font => document.fonts.add(font)).catch(error => console.warn("Bebas Neue yüklenemedi:", error));
  const key = "__extensionManagerDrawing";
  if (options.url && options.url !== location.href) return { active: false, editing: false };
  if (globalThis[key]) {
    if (options.replace) globalThis[key].replace(options.data);
    globalThis[key].edit(!!options.editing);
    return globalThis[key].state();
  }
  const runtime = chrome.runtime;
  let strokes = structuredClone(options.data?.strokes || []);
  let editing = !!options.editing;
  let tool = "pen", color = "#ff4d4d", width = 4;
  let pointCount = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  let current, frame, stopped = false;
  const listeners = new AbortController();
  const host = document.createElement("div");
  host.dataset.pageDrawing = "";
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = ":host{all:initial}*{box-sizing:border-box}canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}.bar{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px);display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px;background:#171c26;color:#fff;border:1px solid #343d4d;border-radius:8px;pointer-events:auto;font:12px/1.4 'Plugg Bebas',sans-serif;box-shadow:0 4px 20px #0005}button,input{font:inherit;color:inherit}button{border:1px solid #343d4d;border-radius:5px;padding:6px 8px;background:#232a36;cursor:pointer}button[aria-pressed=true]{background:#fff;color:#0d1017}input[type=color]{width:28px;height:28px;padding:0;border:0;background:none}input[type=range]{width:60px;accent-color:#fff}.status{flex-basis:100%;color:#a1a7b2} [hidden]{display:none!important}";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const bar = document.createElement("div"); bar.className = "bar"; bar.setAttribute("aria-label", t("drawing_drawing_tools"));
  const status = document.createElement("span"); status.className = "status"; status.hidden = true;
  const controls = document.createElement("span"); controls.style.cssText = "display:contents";
  function button(label, action, parent = controls) {
    const element = document.createElement("button"); element.textContent = label; element.type = "button"; element.dataset.action = action;
    parent.append(element); return element;
  }
  const editButton = button(t("drawing_edit"), "edit", bar);
  const pen = button(t("drawing_pen"), "pen"), eraser = button(t("drawing_eraser"), "eraser");
  const colorInput = document.createElement("input"); colorInput.type = "color"; colorInput.value = color; colorInput.setAttribute("aria-label", t("drawing_pen_color")); controls.append(colorInput);
  const sizeInput = document.createElement("input"); sizeInput.type = "range"; sizeInput.min = "1"; sizeInput.max = "32"; sizeInput.value = width; sizeInput.setAttribute("aria-label", t("drawing_pen_width")); controls.append(sizeInput);
  button(t("drawing_undo"), "undo"); button(t("common_clear"), "clear"); button(t("drawing_save"), "save-url"); button("PNG", "export"); button(t("common_finish"), "view");
  bar.append(controls); button("✕", "stop", bar).setAttribute("aria-label", t("drawing_close_drawing")); bar.append(status);
  shadow.append(style, canvas, bar); document.documentElement.append(host);

  function state() { return { active: !stopped, editing: !stopped && editing, strokeCount: strokes.length }; }
  function announce() {
    runtime.sendMessage({ target: "drawing-background", type: "draw:state", editing: !stopped && editing, active: !stopped }).catch(() => {});
    runtime.sendMessage({ target: "drawing-popup", type: "draw:state", state: state() }).catch(() => {});
  }
  function snapshot() {
    return { strokes: structuredClone(strokes), width: Math.max(innerWidth, document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      height: Math.max(innerHeight, document.documentElement.scrollHeight, document.body?.scrollHeight || 0) };
  }
  function showMessage(message) { if (stopped) return; status.textContent = message; status.hidden = false; }
  async function save(name) {
    const response = await runtime.sendMessage({ target: "drawing-background", type: name ? "draw:save-custom" : "draw:save-url", name, data: snapshot(), url: location.href });
    if (!response?.ok) throw new Error(response?.error || t("drawing_could_not_save_drawing"));
    showMessage(name ? t("drawing_custom_save_created") : t("drawing_saved_to_page"));
    return response.state;
  }
  function savePage() { void save().catch(error => showMessage(error.message)); }
  function paint(context, items) {
    for (const stroke of items) {
      context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.width; context.lineCap = "round"; context.lineJoin = "round";
      context.beginPath();
      if (stroke.points.length === 1) {
        context.arc(stroke.points[0][0], stroke.points[0][1], stroke.width / 2, 0, Math.PI * 2); context.fill();
      } else {
        context.moveTo(...stroke.points[0]); stroke.points.slice(1).forEach(point => context.lineTo(...point)); context.stroke();
      }
    }
    context.globalCompositeOperation = "source-over";
  }
  function render() {
    frame = undefined;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * ratio), h = Math.round(innerHeight * ratio);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, -scrollX * ratio, -scrollY * ratio); paint(ctx, strokes);
  }
  function redraw() { if (!stopped && frame === undefined) frame = requestAnimationFrame(render); }
  function finish() { if (!current) return; current = undefined; savePage(); }
  function edit(value) {
    finish(); editing = value;
    canvas.style.pointerEvents = value ? "auto" : "none"; canvas.style.cursor = value ? "crosshair" : "default";
    controls.hidden = !value; editButton.hidden = value;
    pen.setAttribute("aria-pressed", String(tool === "pen")); eraser.setAttribute("aria-pressed", String(tool === "eraser"));
    announce();
  }
  async function exportPng() {
    finish();
    const data = snapshot(), output = document.createElement("canvas");
    const scale = Math.min(1, 4096 / Math.max(data.width, data.height));
    output.width = Math.max(1, Math.round(data.width * scale)); output.height = Math.max(1, Math.round(data.height * scale));
    const context = output.getContext("2d"); context.scale(scale, scale); paint(context, data.strokes);
    const blob = await new Promise(resolve => output.toBlob(resolve, "image/png"));
    if (!blob) throw new Error(t("drawing_could_not_create_png"));
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "sayfa-cizimi.png"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { exported: true };
  }
  function stop() {
    if (stopped) return;
    finish(); stopped = true; editing = false; listeners.abort(); cancelAnimationFrame(frame); host.remove();
    runtime.onMessage.removeListener(receiver); delete globalThis[key]; announce();
  }
  async function action(message) {
    if (message.type === "draw:status") return state();
    if (message.type === "draw:stop") { stop(); return state(); }
    if (message.type === "draw:save-url") return save();
    if (message.type === "draw:save-custom") return save(message.name);
    if (message.type === "draw:export") return exportPng();
    throw new Error(t("drawing_unknown_drawing_operation"));
  }
  const receiver = (message, sender, reply) => {
    if (message?.target !== "drawing-page" || sender.id !== runtime.id) return;
    action(message).then(state => reply({ ok: true, state })).catch(error => reply({ ok: false, error: error.message })); return true;
  };
  runtime.onMessage.addListener(receiver);
  canvas.addEventListener("pointerdown", event => {
    if (!editing || event.button !== 0 || current) return;
    if (strokes.length >= 2000 || pointCount >= 100000) { showMessage(t("drawing_drawing_limit_reached")); return; }
    current = { tool, color, width, points: [[event.clientX + scrollX, event.clientY + scrollY]] };
    strokes.push(current); pointCount++; canvas.setPointerCapture(event.pointerId); event.preventDefault(); redraw();
  }, { signal: listeners.signal });
  canvas.addEventListener("pointermove", event => {
    if (!current) return;
    const point = [event.clientX + scrollX, event.clientY + scrollY], previous = current.points.at(-1);
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 1) return;
    if (pointCount < 100000 && current.points.length < 10000) { current.points.push(point); pointCount++; } redraw();
  }, { signal: listeners.signal });
  canvas.addEventListener("pointerup", finish, { signal: listeners.signal });
  canvas.addEventListener("pointercancel", finish, { signal: listeners.signal });
  colorInput.addEventListener("input", () => { color = colorInput.value; }, { signal: listeners.signal });
  sizeInput.addEventListener("input", () => { width = Number(sizeInput.value); }, { signal: listeners.signal });
  bar.addEventListener("click", event => {
    const selected = event.target.closest("button")?.dataset.action;
    if (selected === "pen" || selected === "eraser") { tool = selected; edit(true); }
    if (selected === "edit" || selected === "view") edit(selected === "edit");
    if (selected === "undo" || selected === "clear") { finish(); if (selected === "undo") strokes.pop(); else strokes = []; pointCount = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0); redraw(); savePage(); }
    if (selected === "save-url") savePage();
    if (selected === "export") exportPng().catch(error => showMessage(error.message));
    if (selected === "stop") stop();
  }, { signal: listeners.signal });
  window.addEventListener("scroll", redraw, { passive: true, signal: listeners.signal });
  window.addEventListener("resize", redraw, { passive: true, signal: listeners.signal });
  window.addEventListener("pagehide", stop, { once: true, signal: listeners.signal });
  document.addEventListener("keydown", event => { if (event.key === "Escape") edit(false); }, { signal: listeners.signal });
  globalThis[key] = { state, edit, replace(data) { finish(); strokes = structuredClone(data.strokes); pointCount = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0); redraw(); }, stop };
  edit(editing); redraw(); return state();
}
