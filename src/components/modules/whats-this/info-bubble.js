// Installs the shared indicator in the active tab's isolated world.
export function installInfoBubble() {
  const t = (key, ...values) => chrome.i18n?.getMessage?.(key, values.map(String)) || key;
  globalThis.__pluggWhatsThisBubble = ({ anchor, clientX, clientY, copyValue, displayText = copyValue, background, foreground, kind }) => {
    const anchorRect = anchor.getBoundingClientRect();
    const offsetX = clientX - anchorRect.left;
    const offsetY = clientY - anchorRect.top;
      const notice = document.createElement("div");
      notice.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;isolation:isolate;color:${foreground};width:max-content;white-space:nowrap;box-sizing:border-box;padding:13px 17px;font:600 13px 'Plugg Bebas',sans-serif;transform-origin:bottom center;display:flex;align-items:center;gap:12px`;
      const copy = document.createElement("button");
      copy.textContent = `${displayText} ⧉`;
      copy.title = t("common_copy_value", copyValue);
      copy.setAttribute("aria-label", t("common_copy_value", copyValue));
      copy.style.cssText = "all:unset;cursor:pointer;color:inherit;font:inherit;white-space:nowrap";
      copy.addEventListener("pointerenter", () => { copy.style.textDecoration = "underline"; });
      copy.addEventListener("pointerleave", () => { copy.style.textDecoration = "none"; });
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(copyValue); copy.textContent = t("color_picker_copied"); }
        catch { copy.textContent = t("color_picker_could_not_copy"); }
        setTimeout(() => { copy.textContent = `${displayText} ⧉`; }, 1500);
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
      const bubble = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bubble.setAttribute("aria-hidden", "true");
      bubble.style.cssText = "position:absolute;left:-10px;top:-10px;width:calc(100% + 20px);height:calc(100% + 20px);overflow:visible;pointer-events:none;z-index:-1;filter:drop-shadow(0 4px 9px #0008)";
      const bubblePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bubblePath.setAttribute("fill", background);
      bubblePath.setAttribute("stroke", foreground);
      bubblePath.setAttribute("stroke-width", "1");
      bubblePath.setAttribute("stroke-linejoin", "round");
      bubble.append(bubblePath);
      let bubbleGeometry = "";
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
      notice.append(bubble, copy, close);
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
        const l = 10.5, t = 10.5, r = width + 9.5, b = height + 9.5;
        const radius = Math.min(10, (r - l) / 2, (b - t) / 2);
        const halfArrow = 8, arrowHeight = 9;
        const ax = Math.max(l + radius + halfArrow, Math.min(r - radius - halfArrow, x - left + 10));
        const ay = Math.max(t + radius + halfArrow, Math.min(b - radius - halfArrow, y - top + 10));
        const geometry = [width, height, direction, ax, ay].join(":");
        if (geometry !== bubbleGeometry) {
          bubbleGeometry = geometry;
          bubble.setAttribute("viewBox", `0 0 ${width + 20} ${height + 20}`);
          const topArrow = direction === "top" ? `H${ax - halfArrow} L${ax} ${t - arrowHeight} L${ax + halfArrow} ${t}` : "";
          const rightArrow = direction === "right" ? `V${ay - halfArrow} L${r + arrowHeight} ${ay} L${r} ${ay + halfArrow}` : "";
          const bottomArrow = direction === "bottom" ? `H${ax + halfArrow} L${ax} ${b + arrowHeight} L${ax - halfArrow} ${b}` : "";
          const leftArrow = direction === "left" ? `V${ay + halfArrow} L${l - arrowHeight} ${ay} L${l} ${ay - halfArrow}` : "";
          bubblePath.setAttribute("d", `M${l + radius} ${t} ${topArrow} H${r - radius} Q${r} ${t} ${r} ${t + radius} ${rightArrow} V${b - radius} Q${r} ${b} ${r - radius} ${b} ${bottomArrow} H${l + radius} Q${l} ${b} ${l} ${b - radius} ${leftArrow} V${t + radius} Q${l} ${t} ${l + radius} ${t} Z`);
        }
        positionFrame = requestAnimationFrame(positionNotice);
      }
      positionNotice();
      notice.animate([{ opacity: 0, transform: "translateY(20px) scale(.8)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 220, easing: "ease-out" });
      const setting = kind === "color" ? "keepColorIndicators" : "keepFontIndicators";
      chrome.storage.local.get(setting).then(result => {
        if (!closing && result[setting] !== true) noticeTimer = setTimeout(dismiss, 10000);
      }).catch(() => { if (!closing) noticeTimer = setTimeout(dismiss, 10000); });
  };
}
