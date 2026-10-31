import { useEffect, useRef } from "react";

export default function useMenuHighlight(menu, enabled) {
  const indicator = useRef(null);
  const target = useRef(null);
  const animation = useRef(null);
  const position = useRef(null);
  const velocity = useRef({ x: 0, y: 0, width: 0, height: 0, scale: 0 });
  const last = useRef(null);

  function animate() {
    if (animation.current !== null) return;
    function tick(time) {
      const tile = target.current, parent = menu.current, element = indicator.current;
      if (!tile || !tile.isConnected || !parent || !element) { animation.current = null; last.current = null; return; }
      const rect = tile.getBoundingClientRect(), container = parent.getBoundingClientRect();
      const goal = { x: rect.left - container.left + parent.scrollLeft - parent.clientLeft, y: rect.top - container.top + parent.scrollTop - parent.clientTop, width: rect.width, height: rect.height };
      const state = position.current ?? { ...goal, scale: 1 };
      position.current = state;
      const distance = Math.hypot(goal.x - state.x, goal.y - state.y);
      goal.scale = Math.max(.82, 1 - distance / 900);
      let dt = Math.min((time - (last.current ?? time - 16)) / 1000, .032);
      last.current = time;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        Object.assign(state, goal);
        state.scale = 1;
        for (const key of Object.keys(velocity.current)) velocity.current[key] = 0;
      } else while (dt > 0) {
        const step = Math.min(dt, 1 / 120);
        for (const key of Object.keys(goal)) {
          velocity.current[key] += (260 * (goal[key] - state[key]) - 24 * velocity.current[key]) * step;
          state[key] += velocity.current[key] * step;
        }
        dt -= step;
      }
      element.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      element.style.width = `${state.width}px`;
      element.style.height = `${state.height}px`;
      animation.current = requestAnimationFrame(tick);
    }
    animation.current = requestAnimationFrame(tick);
  }
  function show(tile) {
    if (!enabled || !tile || !menu.current?.contains(tile) || tile.disabled) return;
    target.current = tile;
    indicator.current.dataset.visible = "true";
    animate();
  }
  function hide() {
    target.current = null;
    if (indicator.current) indicator.current.dataset.visible = "false";
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null; last.current = null;
    for (const key of Object.keys(velocity.current)) velocity.current[key] = 0;
  }
  useEffect(() => { if (!enabled) hide(); return hide; }, [enabled]);
  return {
    indicator,
    onPointerOver: event => show(event.target.closest?.(".page-link")),
    onPointerOut: event => { if (!event.relatedTarget?.closest?.(".page-link")) hide(); },
    onFocus: event => show(event.target.closest?.(".page-link")),
    onBlur: event => { if (!event.relatedTarget?.closest?.(".page-link")) hide(); }
  };
}
