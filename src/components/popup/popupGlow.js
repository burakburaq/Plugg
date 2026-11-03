export function startPopupGlow() {
  const root = document.documentElement;
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const position = { ...target };
  const velocity = { x: 0, y: 0 };
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = null;
  let previousTime;

  function paint() {
    root.style.setProperty("--popup-glow-x", `${position.x}px`);
    root.style.setProperty("--popup-glow-y", `${position.y}px`);
  }
  function tick(time) {
    let remaining = Math.min((time - (previousTime ?? time - 16)) / 1000, .032);
    previousTime = time;
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      for (const axis of ["x", "y"]) {
        velocity[axis] += (110 * (target[axis] - position[axis]) - 21 * velocity[axis]) * dt;
        position[axis] += velocity[axis] * dt;
      }
      remaining -= dt;
    }
    paint();
    if (["x", "y"].every(axis => Math.abs(target[axis] - position[axis]) < .05 && Math.abs(velocity[axis]) < .05)) {
      Object.assign(position, target); paint(); frame = null; previousTime = undefined;
    } else frame = requestAnimationFrame(tick);
  }
  function move(event) {
    target.x = event.clientX; target.y = event.clientY;
    root.style.setProperty("--outline-glow-x", `${target.x}px`);
    root.style.setProperty("--outline-glow-y", `${target.y}px`);
    if (motion.matches) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; previousTime = undefined;
      Object.assign(position, target); velocity.x = velocity.y = 0; paint();
    } else if (frame === null) frame = requestAnimationFrame(tick);
  }
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pagehide", () => {
    window.removeEventListener("pointermove", move);
    if (frame !== null) cancelAnimationFrame(frame);
  }, { once: true });
  paint();
}
