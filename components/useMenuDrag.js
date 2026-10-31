import { useEffect, useRef, useState } from "react";
import { moveModule } from "../modules/module-layout.js";

export default function useMenuDrag({ menu, enabled, layout, onLayoutChange }) {
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const session = useRef(null);
  useEffect(() => () => session.current?.dispose(), []);
  useEffect(() => { if (!enabled) session.current?.cancel(); }, [enabled]);

  function start(event, id) {
    if (!enabled || event.button !== 0 || !event.isPrimary || session.current) return;
    event.preventDefault();
    const source = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX, startY = event.clientY;
    const rect = source.getBoundingClientRect();
    const anchorX = startX - rect.left, anchorY = startY - rect.top;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { angle: 0, scale: 1 }, target = { angle: 0, scale: 1.15 }, velocity = { angle: 0, scale: 0 };
    let x = startX, y = startY, previousX = x, previousY = y, lastMove = performance.now();
    let sway = 0, frame, previousTime, preview, destination, finished = false;
    const listeners = new AbortController();
    source.setPointerCapture(pointerId);

    function findTarget() {
      const hit = document.elementFromPoint(x, y);
      const grid = hit?.closest('nav[data-group="active"], nav[data-group="passive"]');
      if (!grid || !menu.current?.contains(grid)) return null;
      const group = grid.dataset.group;
      const tile = hit.closest("[data-module-id]");
      let index = layout[group].length;
      if (tile && grid.contains(tile)) {
        const bounds = tile.getBoundingClientRect();
        index = layout[group].indexOf(tile.dataset.moduleId) + (x > bounds.left + bounds.width / 2 ? 1 : 0);
      }
      return { group, index };
    }
    function paint() {
      if (!preview) return;
      preview.style.left = `${x - anchorX}px`;
      preview.style.top = `${y - anchorY}px`;
      preview.style.transform = `rotate(${state.angle}deg) scale(${state.scale})`;
    }
    function tick(time) {
      if (finished) return;
      let remaining = Math.min((time - (previousTime ?? time - 16)) / 1000, .032);
      previousTime = time;
      target.angle = reduced ? 0 : sway * Math.exp(-Math.max(0, time - lastMove - 32) / 120);
      if (reduced) { state.angle = 0; state.scale = 1; }
      else while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 120);
        for (const key of ["angle", "scale"]) {
          velocity[key] += (380 * (target[key] - state[key]) - 26 * velocity[key]) * dt;
          state[key] += velocity[key] * dt;
        }
        remaining -= dt;
      }
      const bounds = menu.current?.getBoundingClientRect();
      if (bounds && y >= bounds.top && y <= bounds.bottom && x >= bounds.left && x <= bounds.right) {
        const direction = y < bounds.top + 28 ? -1 : y > bounds.bottom - 28 ? 1 : 0;
        menu.current.scrollTop += direction * 6;
      }
      destination = findTarget();
      setDropTarget(current => current?.group === destination?.group && current?.index === destination?.index ? current : destination);
      paint();
      frame = requestAnimationFrame(tick);
    }
    function dispose() {
      finished = true;
      listeners.abort();
      cancelAnimationFrame(frame);
      preview?.remove();
      if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
      if (session.current?.dispose === dispose) session.current = null;
    }
    function finish(accept) {
      if (finished) return;
      destination = accept && preview ? findTarget() : null;
      const next = destination ? moveModule(layout, id, destination.group, destination.index) : null;
      const ghost = preview;
      const original = source.getBoundingClientRect();
      const from = ghost ? { left: ghost.style.left, top: ghost.style.top, transform: ghost.style.transform, opacity: 1 } : null;
      // Detach the visual before cleanup so the completion animation can finish.
      preview = null;
      dispose();
      setDragging(null); setDropTarget(null);
      if (next && JSON.stringify(next) !== JSON.stringify(layout)) onLayoutChange(next);
      if (ghost) {
        if (reduced) ghost.remove();
        else {
          const to = destination ? { transform: "rotate(0deg) scale(.85)", opacity: 0 } : { left: `${original.left}px`, top: `${original.top}px`, transform: "rotate(0deg) scale(1)", opacity: 0 };
          const animation = ghost.animate([from, to], { duration: 200, easing: "ease-out", fill: "forwards" });
          animation.onfinish = animation.oncancel = () => ghost.remove();
        }
      }
    }
    const options = { signal: listeners.signal };
    source.addEventListener("pointermove", move, options);
    source.addEventListener("pointerup", event => {
      if (event.pointerId !== pointerId) return;
      x = event.clientX; y = event.clientY; paint(); finish(true);
    }, options);
    source.addEventListener("pointercancel", event => { if (event.pointerId === pointerId) finish(false); }, options);
    source.addEventListener("lostpointercapture", () => finish(false), options);
    window.addEventListener("blur", () => finish(false), options);
    window.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); finish(false); } }, options);
    function move(event) {
      if (event.pointerId !== pointerId) return;
      x = event.clientX; y = event.clientY;
      if (!preview) {
        if (Math.hypot(x - startX, y - startY) < 4) return;
        preview = source.cloneNode(true);
        preview.removeAttribute("id"); preview.removeAttribute("data-module-id");
        preview.setAttribute("aria-hidden", "true"); preview.tabIndex = -1;
        preview.classList.remove("is-dragging", "drop-before");
        preview.classList.add("menu-drag-preview");
        Object.assign(preview.style, { position: "fixed", width: `${rect.width}px`, height: `${rect.height}px`, margin: "0", zIndex: "1000", pointerEvents: "none", transformOrigin: `${anchorX}px ${anchorY}px`, opacity: "1" });
        document.body.append(preview);
        setDragging(id);
        frame = requestAnimationFrame(tick);
      }
      const now = performance.now();
      const dt = Math.max((now - lastMove) / 1000, 1 / 240);
      const vx = (x - previousX) / dt, vy = (y - previousY) / dt;
      const torque = (vx * (rect.height / 2 - anchorY) - vy * (rect.width / 2 - anchorX)) / (rect.width / 2);
      sway = Math.max(-18, Math.min(18, torque * ((.012 * 32) / 17)));
      previousX = x; previousY = y; lastMove = now;
      paint();
    }
    session.current = { dispose, cancel: () => finish(false) };
  }
  return { dragging, dropTarget, start, cancel: () => session.current?.cancel() };
}
