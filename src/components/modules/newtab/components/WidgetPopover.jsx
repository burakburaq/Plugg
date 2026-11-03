import { t } from "../../../../modules/i18n.js";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

export default function WidgetPopover({ anchor, title, onClose, children, className = "", header = true, pointed = false }) {
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [position, setPosition] = useState({ visibility: "hidden" });
  const [placement, setPlacement] = useState("bottom");
  useLayoutEffect(() => {
    function place() {
      if (!anchor.current || !panel.current) return;
      const a = anchor.current.getBoundingClientRect(), p = panel.current.getBoundingClientRect();
      const left = Math.max(16, Math.min(a.left + (a.width - p.width) / 2, innerWidth - p.width - 16));
      const below = a.bottom + 10;
      const belowFits = below + p.height <= innerHeight - 16;
      const top = Math.max(16, Math.min(belowFits ? below : a.top - p.height - 10, innerHeight - p.height - 16));
      setPlacement(belowFits ? "bottom" : "top");
      setPosition({ left, top, "--nt-anchor": `${Math.max(20, Math.min(p.width - 20, a.left + a.width / 2 - left))}px` });
    }
    function outside(event) { if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) close.current(); }
    function escape(event) { if (event.key === "Escape") { event.stopPropagation(); close.current(); (anchor.current?.matches("button") ? anchor.current : anchor.current?.querySelector("button"))?.focus(); } }
    const observer = new ResizeObserver(place); observer.observe(panel.current);
    place(); window.addEventListener("resize", place); document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [anchor]);
  const content = <section className={`nt-popover ${className}`.trim()} ref={panel} style={pointed ? undefined : position} role="dialog" aria-label={title}>{header && <header><h2>{title}</h2><button className="nt-icon-button" aria-label={t("widgets_close_value1_window", title)} onClick={onClose}><Icon name="close" /></button></header>}{children}</section>;
  return createPortal(pointed ? <div className="nt-popover-shell" style={position} data-placement={placement}>{content}</div> : content, document.body);
}
