import { useEffect, useRef, useState } from "react";
import { moveModule } from "../../modules/module-layout.js";
import Button from "../Button.jsx";
import ModuleTile from "../ModuleTile.jsx";

export default function MainMenu({ modules, layout, onLayoutChange, onSelect, onPreload, lastModule, ready, saving, error, running }) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const menu = useRef(null);
  const draggedId = useRef(null);
  const hoverTimer = useRef(null);
  useEffect(() => { if (lastModule) menu.current.querySelector(`#open-${lastModule}`)?.focus(); }, [lastModule]);
  useEffect(() => cancelPreload, [editing, ready, saving, layout]);

  function cancelPreload() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  function schedulePreload(id, group) {
    cancelPreload();
    if (group !== "active" || editing || !ready || saving) return;
    hoverTimer.current = setTimeout(() => { hoverTimer.current = null; onPreload(id); }, 200);
  }

  function dragStart(event, id) {
    if (!editing || saving) { event.preventDefault(); return; }
    draggedId.current = id;
    setDragging(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-module-id", id);
  }

  function dragOver(event, group) {
    if (!draggedId.current || saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const tile = event.target.closest("[data-module-id]");
    let index = layout[group].length;
    if (tile) {
      const rect = tile.getBoundingClientRect();
      index = layout[group].indexOf(tile.dataset.moduleId) + (event.clientX > rect.x + rect.width / 2 ? 1 : 0);
    }
    setDropTarget(current => current?.group === group && current.index === index ? current : { group, index });
  }

  function clearDrag() {
    draggedId.current = null;
    setDragging(null);
    setDropTarget(null);
  }

  function drop(event, group) {
    if (!draggedId.current || !editing || saving) return;
    event.preventDefault();
    const next = moveModule(layout, draggedId.current, group, dropTarget?.group === group ? dropTarget.index : layout[group].length);
    clearDrag();
    if (JSON.stringify(next) !== JSON.stringify(layout)) onLayoutChange(next);
  }

  function renderGroup(group) {
    return <nav className={`module-grid ${editing ? "is-editing" : ""} ${dropTarget?.group === group ? "is-drop-target" : ""}`}
      data-group={group} id={`${group}-modules`} aria-label={group === "active" ? "Aktif modüller" : "Pasif modüller"}
      onDragOver={event => dragOver(event, group)} onDrop={event => drop(event, group)}>
      {layout[group].map((id, index) => {
        const module = modules.find(item => item.id === id);
        return <ModuleTile key={id} id={module.id} title={module.title} description={module.description} icon={module.icon} running={group === "active" && !!running?.[id]} disabled={!ready} draggable={editing && !saving}
          className={`${dragging === id ? "is-dragging" : ""} ${dropTarget?.group === group && dropTarget.index === index ? "drop-before" : ""}`}
          onDragStart={event => dragStart(event, id)} onDragEnd={clearDrag}
          onMouseEnter={() => schedulePreload(id, group)} onMouseLeave={cancelPreload}
          onSelect={() => { cancelPreload(); if (!editing && !saving) onSelect(id); }} />;
      })}
      {!layout[group].length && <p className="empty-module-group muted">{group === "active" ? "Aktif modül yok" : "Pasif modül yok"}</p>}
    </nav>;
  }

  return <main ref={menu} id="menu-view" className="main-menu" aria-busy={saving}>
    <Button id="edit-modules" variant="control" className="menu-gear" disabled={!ready || saving} aria-label={editing ? "Modül düzenlemeyi kapat" : "Modülleri düzenle"}
      aria-expanded={editing} aria-controls="passive-modules" onClick={() => { clearDrag(); setEditing(!editing); }}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3.4-1.2 1.8V13l1.2 1.8-2 3.4-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3.4L4.2 13V9l-1.2-1.8L5 3.8l2 .2 2-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
    </Button>
    {renderGroup("active")}
    <div className="passive-expansion" data-open={editing} inert={!editing} aria-hidden={!editing}>
      <div className="passive-clip"><hr className="module-divider" />{renderGroup("passive")}</div>
    </div>
    {error && <p className="menu-error tool-error" role="alert">{error}</p>}
  </main>;
}
