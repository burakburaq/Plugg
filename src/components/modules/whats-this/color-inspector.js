// This function runs in the active tab through chrome.scripting.
export function startColorInspector(imageUrl) {
  const t = (key, ...values) => chrome.i18n?.getMessage?.(key, values.map(String)) || key;
  // Load the extension font without changing the site's own styles.
  fetch(chrome.runtime.getURL("fonts/BebasNeue-Regular.ttf"))
    .then(response => { if (!response.ok) throw new Error("Font okunamadı"); return response.arrayBuffer(); })
    .then(bytes => new FontFace("Plugg Bebas", bytes).load())
    .then(font => document.fonts.add(font)).catch(error => console.warn("Bebas Neue yüklenemedi:", error));

  const key = "__pluggWhatsThisColorInspector";
  globalThis[key]?.();
  let cancelled = false;
  const cancelPending = () => { cancelled = true; if (globalThis[key] === cancelPending) delete globalThis[key]; };
  globalThis[key] = cancelPending;
  const image = new Image();
  image.onload = () => {
    if (cancelled) return;
    const source = document.createElement("canvas");
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const context = source.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const cursorStyle = document.createElement("style");
    cursorStyle.textContent = "*, *::before, *::after { cursor: crosshair !important; }";
    document.documentElement.append(cursorStyle);
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = ":host{all:initial}.tip{position:fixed;pointer-events:none;background:#171c26;color:#fff;border:1px solid #485366;border-radius:10px;padding:6px;box-shadow:0 4px 18px #0008;font:600 12px 'Plugg Bebas',sans-serif;text-align:center}.tip[hidden]{display:none}canvas{display:block;width:110px;height:110px;image-rendering:pixelated;border-radius:5px}.hex{display:block;padding:6px 0 1px}";
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.hidden = true;
    const zoom = document.createElement("canvas");
    zoom.width = zoom.height = 110;
    const label = document.createElement("span");
    label.className = "hex";
    tip.append(zoom, label);
    shadow.append(style, tip);
    document.documentElement.append(host);
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    let color = null;
    let foreground = "#fff";
    let pointer = null;
    let refreshTimer;
    let refreshing = false;
    let refreshAgain = false;
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearTimeout(refreshTimer);
      listeners.abort();
      host.remove();
      cursorStyle.remove();
      if (globalThis[key] === stop) delete globalThis[key];
    };
    globalThis[key] = stop;
    function update(x, y) {
      const px = Math.max(0, Math.min(source.width - 1, Math.floor(x * source.width / innerWidth)));
      const py = Math.max(0, Math.min(source.height - 1, Math.floor(y * source.height / innerHeight)));
      const pixel = context.getImageData(px, py, 1, 1).data;
      color = `#${[...pixel.slice(0, 3)].map(value => value.toString(16).padStart(2, "0")).join("")}`;
      label.textContent = color.toUpperCase();
      const linear = [...pixel.slice(0, 3)].map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      tip.style.backgroundColor = color;
      foreground = luminance > 0.179 ? "#000" : "#fff";
      tip.style.color = foreground;
      const zoomContext = zoom.getContext("2d");
      zoomContext.imageSmoothingEnabled = false;
      zoomContext.clearRect(0, 0, 110, 110);
      zoomContext.drawImage(source, px - 5, py - 5, 11, 11, 0, 0, 110, 110);
      zoomContext.strokeStyle = "white";
      zoomContext.lineWidth = 1;
      zoomContext.strokeRect(50.5, 50.5, 9, 9);
      tip.hidden = false;
      tip.style.left = `${Math.max(0, Math.min(innerWidth - 124, x + 18))}px`;
      tip.style.top = `${Math.max(0, Math.min(innerHeight - 145, y + 18))}px`;
    }
    document.addEventListener("pointermove", event => {
      pointer = { x: event.clientX, y: event.clientY };
      update(pointer.x, pointer.y);
    }, options);
    document.addEventListener("pointerout", event => {
      if (!event.relatedTarget) { pointer = null; tip.hidden = true; }
    }, options);
    async function refresh() {
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      tip.style.visibility = "hidden";
      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const response = await chrome.runtime.sendMessage({ target: "whats-this-color-background", type: "color:capture" });
        if (!response?.ok) throw new Error(response?.error);
        const updated = new Image();
        await new Promise((resolve, reject) => { updated.onload = resolve; updated.onerror = reject; updated.src = response.state; });
        if (!stopped) {
          source.width = updated.naturalWidth;
          source.height = updated.naturalHeight;
          context.drawImage(updated, 0, 0);
          if (pointer) update(pointer.x, pointer.y);
        }
      } catch (error) { console.warn("Renk seçici görüntüyü yenileyemedi:", error); }
      finally {
        if (!stopped) tip.style.visibility = "";
        refreshing = false;
        if (refreshAgain && !stopped) { refreshAgain = false; scheduleRefresh(); }
      }
    }
    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 600);
    }
    document.addEventListener("click", event => {
      event.preventDefault(); event.stopImmediatePropagation();
      update(event.clientX, event.clientY);
      const selected = color;
      const anchor = event.target instanceof Element ? event.target : document.documentElement;
      stop();
      chrome.runtime.sendMessage({ target: "whats-this-color-background", type: "color:save", color: selected }).catch(() => {});
      globalThis.__pluggWhatsThisBubble?.({ anchor, clientX: event.clientX, clientY: event.clientY, copyValue: selected.toUpperCase(), background: selected, foreground, kind: "color" });
    }, options);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); stop(); }
    }, options);
    addEventListener("scroll", scheduleRefresh, options);
    addEventListener("resize", scheduleRefresh, options);
  };
  image.onerror = cancelPending;
  image.src = imageUrl;
}
