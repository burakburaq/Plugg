import { t } from "../modules/i18n.js";
import { useEffect, useMemo, useRef, useState } from "react";
import useMenuDrag from "./useMenuDrag.js";
import useMenuHighlight from "./useMenuHighlight.js";
import Button from "./Button.jsx";
import ExtensionMenuTile, { hashModuleTitle } from "./ExtensionMenuTile.jsx";

export default function ExtensionMenu({ theme, themeConfig, modules, layout, onLayoutChange, onSelect, onOpenSettings, onPreload, lastModule, ready, saving, error, running }) {
  const [editing, setEditing] = useState(false);
  const menu = useRef(null);
  const hoverTimer = useRef(null);
  const { dragging, dropTarget, start: startDrag, consumeClick, cancel: clearDrag } = useMenuDrag({ menu, enabled: editing && ready && !saving, layout, onLayoutChange });
  const highlight = useMenuHighlight(menu, theme === "dull" && !dragging);
  const hues = useMemo(() => {
    if (!themeConfig.colorFromTitle) return {};
    const ranked = [...modules].sort((a, b) => hashModuleTitle(a.title) - hashModuleTitle(b.title) || a.id.localeCompare(b.id));
    return Object.fromEntries(ranked.map((module, index) => [module.id, (17 + index * 360 / ranked.length) % 360]));
  }, [modules, themeConfig.colorFromTitle]);
  useEffect(() => { if (lastModule) menu.current.querySelector(`#open-${lastModule}`)?.focus(); }, [lastModule]);
  useEffect(() => cancelPreload, [editing, ready, saving, layout]);

  function cancelPreload() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  function schedulePreload(id, group) {
    cancelPreload();
    if (!ready || saving) return;
    hoverTimer.current = setTimeout(() => { hoverTimer.current = null; onPreload(id); }, 200);
  }

  function renderGroup(group) {
    return <nav className={`module-grid ${editing ? "is-editing" : ""} ${dropTarget?.group === group ? "is-drop-target" : ""}`}
      data-group={group} id={`${group}-modules`} aria-label={group === "active" ? t("module_menu_active_modules") : t("module_menu_inactive_modules")}
      >
      {layout[group].map((id, index) => {
        const module = modules.find(item => item.id === id);
        return <ExtensionMenuTile key={id} id={module.id} title={module.title} description={module.description} icon={module.icon} variant={module.variant} picture={module.picture} allowPictures={themeConfig.allowPictures} colorFromTitle={themeConfig.colorFromTitle} theme={theme} hue={hues[module.id]} running={group === "active" && !!running?.[id]} disabled={!ready} draggable={false}
          className={`${dragging === id ? "is-dragging" : ""} ${dropTarget?.group === group && dropTarget.index === index ? "drop-before" : ""}`}
          onPointerDown={event => { cancelPreload(); startDrag(event, id); }}
          onMouseEnter={() => schedulePreload(id, group)} onMouseLeave={cancelPreload}
          onSelect={event => { cancelPreload(); if (!saving && !consumeClick(event)) onSelect(id); }} />;
      })}
      {!layout[group].length && <p className="empty-module-group muted">{group === "active" ? t("module_menu_no_active_modules") : t("module_menu_no_inactive_modules")}</p>}
    </nav>;
  }

  return <main ref={menu} id="menu-view" className="main-menu" data-theme={theme} aria-busy={saving}
    onPointerOver={highlight.onPointerOver} onPointerOut={highlight.onPointerOut} onFocus={highlight.onFocus} onBlur={highlight.onBlur}>
    {theme === "dull" && <div ref={highlight.indicator} className="menu-hover-indicator" aria-hidden="true" />}
    <Button id="edit-modules" variant="control" className="menu-gear" disabled={!ready || saving} aria-label={editing ? t("module_menu_stop_editing_modules") : t("module_menu_edit_modules")}
      aria-expanded={editing} aria-controls="settings-modules passive-modules" onClick={() => { clearDrag(); setEditing(!editing); }}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3.4-1.2 1.8V13l1.2 1.8-2 3.4-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3.4L4.2 13V9l-1.2-1.8L5 3.8l2 .2 2-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
    </Button>
    <div className="passive-expansion" data-open={editing} inert={!editing} aria-hidden={!editing}>
      <div className="passive-clip">
        <nav id="settings-modules" className="module-grid settings-grid" aria-label={t("settings_title")}>
          <ExtensionMenuTile id="settings" title={t("settings_title")} description={t("settings_title")} variant="icon-tiny" colorFromTitle={themeConfig.colorFromTitle} theme={theme} onSelect={onOpenSettings}
            icon={<><path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3.4-1.2 1.8V13l1.2 1.8-2 3.4-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3.4L4.2 13V9l-1.2-1.8L5 3.8l2 .2 2-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" /></>} />
        </nav>
        <hr className="module-divider" />
      </div>
    </div>
    {renderGroup("active")}
    <div className="passive-expansion" data-open={editing} inert={!editing} aria-hidden={!editing}>
      <div className="passive-clip"><hr className="module-divider" />{renderGroup("passive")}</div>
    </div>
    {error && <p className="menu-error tool-error" role="alert">{error}</p>}
  </main>;
}
