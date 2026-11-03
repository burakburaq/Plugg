import { t } from "../../../../modules/i18n.js";
import { useRef, useState } from "react";
import { fitWidget, WIDGET_TITLES } from "../newtab-settings.js";
export default function WidgetFrame({ item, editing, viewport, onChange, onRemove, children }) {
  const [draft, setDraft] = useState(null);
  const gesture = useRef(null);
  const box = draft || fitWidget(item, viewport);

  function start(event, resize) {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { resize, startX: event.clientX, startY: event.clientY, original: box, preview: box };
  }
  function move(event) {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    const next = current.resize
      ? { ...current.original, width: Math.min(current.original.width + dx, viewport.width - current.original.x - 16),
        height: Math.min(current.original.height + dy, viewport.height - current.original.y - 16) }
      : { ...current.original, x: current.original.x + dx, y: current.original.y + dy };
    current.preview = fitWidget(next, viewport); setDraft(current.preview);
  }
  function finish() {
    const current = gesture.current;
    gesture.current = null; setDraft(null);
    if (current) onChange(current.preview);
  }
  function cancel() { gesture.current = null; setDraft(null); }
  function keyboard(event, resize) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    onChange(fitWidget(resize ? { ...box, width: Math.min(box.width + dx, viewport.width - box.x - 16),
      height: Math.min(box.height + dy, viewport.height - box.y - 16) } : { ...box, x: box.x + dx, y: box.y + dy }, viewport));
  }
  const pointerHandlers = { onPointerMove: move, onPointerUp: finish, onPointerCancel: cancel, onLostPointerCapture: cancel };
  return <section className={`nt-widget nt-widget-${item.type} ${editing ? "is-editing" : ""}`} data-widget={item.type}
    aria-label={WIDGET_TITLES[item.type]} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
    {editing && <div className="nt-widget-toolbar">
      <button className="nt-drag" aria-label={t("widgets_move_value1", WIDGET_TITLES[item.type])} title={t("widgets_drag_or_use_arrow_keys_to_move")}
        onPointerDown={event => start(event, false)} onKeyDown={event => keyboard(event, false)} {...pointerHandlers}>⠿ {WIDGET_TITLES[item.type]}</button>
      <button className="nt-remove" aria-label={t("widgets_remove_value1", WIDGET_TITLES[item.type])} onClick={onRemove}>×</button>
    </div>}
    <div className="nt-widget-content">{children}</div>
    {editing && <button className="nt-resize" aria-label={t("widgets_resize_value1", WIDGET_TITLES[item.type])} title={t("widgets_drag_or_use_arrow_keys_to_resize")}
      onPointerDown={event => start(event, true)} onKeyDown={event => keyboard(event, true)} {...pointerHandlers}>⤡</button>}
  </section>;
}
