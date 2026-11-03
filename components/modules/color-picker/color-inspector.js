// This function runs in the active tab through chrome.scripting.
export function startColorInspector(imageUrl) {
  const t = (key, ...values) => chrome.i18n?.getMessage?.(key, values.map(String)) || key;
  // Load the extension font without changing the site's own styles.
  fetch(chrome.runtime.getURL("fonts/BebasNeue-Regular.ttf"))
    .then(response => { if (!response.ok) throw new Error("Font okunamadı"); return response.arrayBuffer(); })
    .then(bytes => new FontFace("Plugg Bebas", bytes).load())
    .then(font => document.fonts.add(font)).catch(error => console.warn("Bebas Neue yüklenemedi:", error));

  const key = "__pluggColorInspector";
  globalThis[key]?.();
  let cancelled = false;
  const receive = (message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.target !== "plugg-feature-control" || message.module !== "color") return;
    globalThis[key]?.(); reply({ ok: true });
  };
  chrome.runtime.onMessage.addListener(receive);
  const cancelPending = () => { cancelled = true; chrome.runtime.onMessage.removeListener(receive); if (globalThis[key] === cancelPending) delete globalThis[key]; };
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
      chrome.runtime.onMessage.removeListener(receive);
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
        const response = await chrome.runtime.sendMessage({ target: "color-background", type: "color:capture" });
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
      const anchorRect = anchor.getBoundingClientRect();
      const offsetX = event.clientX - anchorRect.left;
      const offsetY = event.clientY - anchorRect.top;
      stop();
      chrome.runtime.sendMessage({ target: "color-background", type: "color:save", color: selected }).catch(() => {});
      const notice = document.createElement("div");
      notice.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;background:${selected};color:${foreground};width:max-content;white-space:nowrap;box-sizing:border-box;border:1px solid currentColor;padding:12px 16px;border-radius:10px;font:600 13px 'Plugg Bebas',sans-serif;box-shadow:0 4px 18px #0008;transform-origin:bottom center;display:flex;align-items:center;gap:12px`;
      const copy = document.createElement("button");
      copy.textContent = `${selected.toUpperCase()} ⧉`;
      copy.title = t("color_picker_copy_hex");
      copy.setAttribute("aria-label", t("common_copy_value", selected.toUpperCase()));
      copy.style.cssText = "all:unset;cursor:pointer;color:inherit;font:inherit;white-space:nowrap";
      copy.addEventListener("pointerenter", () => { copy.style.textDecoration = "underline"; });
      copy.addEventListener("pointerleave", () => { copy.style.textDecoration = "none"; });
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(selected.toUpperCase()); copy.textContent = t("color_picker_copied"); }
        catch { copy.textContent = t("color_picker_could_not_copy"); }
        setTimeout(() => { copy.textContent = `${selected.toUpperCase()} ⧉`; }, 1500);
      });
      const close = document.createElement("button");
      close.setAttribute("aria-label", t("common_close"));
      close.style.cssText = "all:unset;display:flex;flex-shrink:0;align-items:center;justify-content:center;width:20px;height:20px;cursor:pointer;color:inherit";
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("width", "16");
      icon.setAttribute("height", "16");
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "2");
      icon.setAttribute("stroke-linecap", "round");
      const cross = document.createElementNS("http://www.w3.org/2000/svg", "path");
      cross.setAttribute("d", "M6 6l12 12M18 6L6 18");
      icon.append(cross);
      close.append(icon);
      const arrow = document.createElement("span");
      arrow.style.cssText = `position:absolute;width:16px;height:9px;background:${selected};pointer-events:none`;
      let closing = false;
      let positionFrame;
      let noticeTimer;
      const dismiss = () => {
        if (closing) return;
        closing = true;
        clearTimeout(noticeTimer);
        cancelAnimationFrame(positionFrame);
        notice.animate([{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(20px) scale(.8)" }], { duration: 220, easing: "ease-in", fill: "forwards" }).onfinish = () => notice.remove();
      };
      close.addEventListener("click", dismiss);
      notice.append(copy, close, arrow);
      document.documentElement.append(notice);
      function positionNotice() {
        if (!anchor.isConnected) { dismiss(); return; }
        const rect = anchor.getBoundingClientRect();
        const x = rect.left + offsetX;
        const y = rect.top + offsetY;
        notice.style.visibility = x < 0 || x > innerWidth || y < 0 || y > innerHeight ? "hidden" : "visible";
        const width = notice.offsetWidth;
        const height = notice.offsetHeight;
        const margin = 8;
        const gap = 12;
        const hitsLeft = x - width / 2 < margin;
        const hitsRight = x + width / 2 > innerWidth - margin;
        const hitsTop = y - height - gap < margin;
        const hitsBottom = (hitsLeft || hitsRight) && y + height / 2 > innerHeight - margin;
        const horizontalHits = Number(hitsLeft) + Number(hitsRight);
        const verticalHits = Number(hitsTop) + Number(hitsBottom);
        let left = x - width / 2;
        let top = y - height - gap;
        let direction = "bottom";
        if (horizontalHits + verticalHits > 1) {
          direction = "none";
          left = hitsRight && !hitsLeft ? innerWidth - width - margin : margin;
          top = hitsBottom && !hitsTop ? innerHeight - height - margin : margin;
        } else if (hitsLeft) {
          direction = "left";
          left = x + gap;
          top = y - height / 2;
        } else if (hitsRight) {
          direction = "right";
          left = x - width - gap;
          top = y - height / 2;
        } else if (hitsTop) {
          direction = "top";
          top = y + gap;
        }
        left = Math.max(margin, Math.min(Math.max(margin, innerWidth - width - margin), left));
        top = Math.max(margin, Math.min(Math.max(margin, innerHeight - height - margin), top));
        notice.style.left = `${left}px`;
        notice.style.top = `${top}px`;
        arrow.style.display = direction === "none" ? "none" : "block";
        arrow.style.left = "";
        arrow.style.right = "";
        arrow.style.top = "";
        arrow.style.bottom = "";
        if (direction === "bottom" || direction === "top") {
          arrow.style.width = "16px";
          arrow.style.height = "9px";
          arrow.style.left = `${Math.max(8, Math.min(width - 24, x - left - 8))}px`;
          arrow.style[direction] = "-9px";
          arrow.style.clipPath = direction === "bottom" ? "polygon(0 0, 100% 0, 50% 100%)" : "polygon(50% 0, 100% 100%, 0 100%)";
        } else if (direction === "left" || direction === "right") {
          arrow.style.width = "9px";
          arrow.style.height = "16px";
          arrow.style.top = `${Math.max(8, Math.min(height - 24, y - top - 8))}px`;
          arrow.style[direction] = "-9px";
          arrow.style.clipPath = direction === "left" ? "polygon(0 50%, 100% 0, 100% 100%)" : "polygon(0 0, 100% 50%, 0 100%)";
        }
        positionFrame = requestAnimationFrame(positionNotice);
      }
      positionNotice();
      notice.animate([{ opacity: 0, transform: "translateY(20px) scale(.8)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 220, easing: "ease-out" });
      chrome.storage.local.get("keepColorIndicators").then(({ keepColorIndicators }) => {
        if (!closing && !keepColorIndicators) noticeTimer = setTimeout(dismiss, 10000);
      }).catch(() => { if (!closing) noticeTimer = setTimeout(dismiss, 10000); });
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
