import { t } from "../../modules/i18n.js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import PageHeader from "../PageHeader.jsx";
import ExtensionMenu from "../ExtensionMenu.jsx";
import Settings from "../settings/Settings.jsx";
import { MENU_THEMES, normalizeMenuTheme } from "../menuThemes.js";
import gestureflowPicture from "../../assets/tile-pictures/gesture-flow.png";
import { DEFAULT_LAYOUT, LAYOUT_KEY, normalizeLayout } from "../../modules/module-layout.js";
import { loadModule, preloadModule, recentModules, normalizeSortOrder, RECENT_MODULES_KEY, SORT_ORDER_KEY } from "../../modules/module-loading.js";

const ExtensionManager = lazy(() => loadModule("manager"));
const QrCreator = lazy(() => loadModule("qr"));
const VolumeBooster = lazy(() => loadModule("volume"));
const FontFinder = lazy(() => loadModule("font"));
const ColorPicker = lazy(() => loadModule("color"));
const PageDrawing = lazy(() => loadModule("drawing"));
const NewTabCustomizer = lazy(() => loadModule("newtab"));
const KeyboardShortcuts = lazy(() => loadModule("shortcuts"));
const FullPageCapture = lazy(() => loadModule("screenshot"));
const DarkMode = lazy(() => loadModule("dark"));
const DomainGroups = lazy(() => loadModule("groups"));
const PageEditor = lazy(() => loadModule("editor"));
const VideoTools = lazy(() => loadModule("video"));
const GestureFlow = lazy(() => loadModule("gestureflow"));
const Themes = lazy(() => loadModule("themes"));

const modules = [
  { id: "manager", title: t("modules_extension_manager"), description: t("modules_enable_and_disable_extensions"), Component: ExtensionManager,
    icon: <path fill="currentColor" d="M10 3a2 2 0 0 1 4 0v2h4a1 1 0 0 1 1 1v4h2a2 2 0 0 1 0 4h-2v4a1 1 0 0 1-1 1h-4v-2a2 2 0 0 0-4 0v2H6a1 1 0 0 1-1-1v-4H3a2 2 0 0 1 0-4h2V6a1 1 0 0 1 1-1h4V3Z" /> },
  { id: "qr", title: t("modules_qr_creator"), description: t("modules_qr_designs_for_text_and_links"), Component: QrCreator,
    icon: <><path fill="currentColor" fillRule="evenodd" d="M2 2h8v8H2V2Zm2 2v4h4V4H4Zm10-2h8v8h-8V2Zm2 2v4h4V4h-4ZM2 14h8v8H2v-8Zm2 2v4h4v-4H4Z" /><path fill="currentColor" d="M14 14h3v3h-3zm5 0h3v5h-3zm-5 5h5v3h-5zm6 1h2v2h-2z" /></> },
  { id: "volume", title: t("modules_volume_booster"), description: t("modules_tab_audio_equalizer_and_presets"), Component: VolumeBooster,
    icon: <><path d="m12 4-6 5H2v6h4l6 5V4Z" fill="currentColor" /><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></> },
  { id: "font", title: t("modules_font_finder"), description: t("modules_find_font_under_pointer"), Component: FontFinder,
    icon: <path d="m2 20 6-16 6 16M4 15h8m5-2c1-2 5-2 5 1v6m0-4c-5-2-7 4-3 4 2 0 3-2 3-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> },
  { id: "color", title: t("modules_color_picker"), description: t("modules_pick_and_copy_color_from_screen"), Component: ColorPicker,
    icon: <path d="m14 4 6 6m-4-8 6 6-3 3-2-2-9 9-5 1 1-5 9-9-2-2 3-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /> },
  { id: "drawing", title: t("modules_draw_on_page"), description: t("modules_draw_on_page_save_and_download_png"), Component: PageDrawing,
    icon: <><path d="m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4M3 23h18" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></> },
  { id: "newtab", title: t("common_new_tab"), description: t("modules_search_filters_and_customizable_layout"), Component: NewTabCustomizer,
    icon: <><rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M2 8h20M12 11v7m-3.5-3.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></> },
  { id: "shortcuts", title: t("modules_keyboard_shortcuts"), description: t("modules_custom_shortcuts_and_previous_tab_navigation"), Component: KeyboardShortcuts,
    icon: <><rect x="1" y="5" width="22" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M5 9h1m4 0h1m4 0h1m3 0h1M5 13h1m4 0h1m4 0h1m3 0h1M7 16h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></> },
  { id: "screenshot", title: t("modules_page_capture"), description: t("modules_download_entire_page_as_one_png"), Component: FullPageCapture,
    icon: <><path d="M3 7h5l2-3h4l2 3h5v13H3V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" /></> },
  { id: "dark", title: t("modules_dark_mode"), description: t("modules_customizable_dark_appearance_for_sites"), Component: DarkMode,
    icon: <path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /> },
  { id: "groups", title: t("modules_tab_groups"), description: t("modules_group_tabs_by_domain"), Component: DomainGroups,
    icon: <><rect x="2" y="3" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" /><rect x="14" y="3" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" /><path d="M6 13v3h12v-3m-6 3v5M8 21h8" stroke="currentColor" strokeWidth="1.8" /></> },
  { id: "editor", title: t("modules_page_editor"), description: t("modules_click_and_edit_page_text"), Component: PageEditor,
    icon: <><path d="M3 4h12M9 4v16M5 20h6m2-4 6-6 3 3-6 6-4 1 1-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></> },
  { id: "video", title: t("modules_video_tools"), description: t("modules_video_zoom_and_image_settings"), Component: VideoTools,
    icon: <><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="m10 8 6 4-6 4V8Z" fill="currentColor" /></> },
  { id: "gestureflow", title: t("modules_gestureflow"), description: t("modules_gestureflow"), Component: GestureFlow, picture: gestureflowPicture,
    icon: <path d="M8 12V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v7c0 5-3 8-8 8H9c-2 0-4-1-5-3l-2-4a2 2 0 0 1 3-2l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> },
  { id: "themes", title: t("modules_themes"), description: t("modules_themes"), Component: Themes,
    icon: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.6-3.2 1.5 1.5 0 0 1 1.2-2.4h1.7a3.5 3.5 0 0 0 3.5-3.5C21 7 17 3 12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7.5" r="1" fill="currentColor" /><circle cx="14" cy="7.5" r="1" fill="currentColor" /><circle cx="17" cy="11" r="1" fill="currentColor" /></> }
];

export default function App() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [theme, setTheme] = useState("dull");
  const [language, setLanguage] = useState("en");
  const [settingsError, setSettingsError] = useState("");
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [running, setRunning] = useState({ volume: false, font: false, drawing: false, dark: false, editor: false, video: false });
  const [lastModule, setLastModule] = useState(null);
  const [sortOrder, setSortOrder] = useState("enabled");
  const recentOpens = useRef({});
  const [qrDraft, setQrDraft] = useState({ type: "url", text: "", size: "512 × 512", correction: "M", foreground: "#000000", background: "#ffffff" });
  useEffect(() => {
    let mounted = true;
    chrome.storage.local.get(["menuTheme", "language"]).then(async settings => {
      if (!mounted) return;
      const normalized = normalizeMenuTheme(settings.menuTheme);
      setTheme(normalized);
      if (settings.menuTheme === "theme-1" || settings.menuTheme === "theme-2") {
        await chrome.storage.local.set({ menuTheme: normalized });
      }
      if (mounted) setLanguage(settings.language === "en" ? settings.language : "en");
    }).catch(() => { if (mounted) setSettingsError(t("settings_save_error")); })
      .finally(() => { if (mounted) setSettingsReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => { document.body.dataset.theme = theme; }, [theme]);

  async function changeSetting(key, value) {
    if (settingsSaving) return;
    setSettingsSaving(true);
    try {
      await chrome.storage.local.set({ [key]: value });
      if (key === "menuTheme") setTheme(value);
      if (key === "language") setLanguage(value);
      setSettingsError("");
    } catch { setSettingsError(t("settings_save_error")); }
    finally { setSettingsSaving(false); }
  }
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [layoutResult, sortResult, recentResult] = await Promise.allSettled([
          chrome.runtime.sendMessage({ target: "modules-background", type: "modules:get" }),
          chrome.storage.local.get(SORT_ORDER_KEY),
          chrome.storage.session.get(RECENT_MODULES_KEY)
        ]);
        if (!mounted) return;
        if (sortResult.status === "fulfilled") setSortOrder(normalizeSortOrder(sortResult.value[SORT_ORDER_KEY]));
        if (recentResult.status === "fulfilled") recentOpens.current = recentModules(recentResult.value[RECENT_MODULES_KEY]);
        const response = layoutResult.status === "fulfilled" ? layoutResult.value : null;
        if (!response?.ok) throw new Error();
        if (mounted) { setLayout(normalizeLayout(response.layout)); setReady(true); }
      } catch { if (mounted) setError(t("modules_could_not_read_module_layout")); }
    })();
    const listener = (changes, area) => {
      if (area !== "local" || !changes[LAYOUT_KEY]) return;
      const next = normalizeLayout(changes[LAYOUT_KEY].newValue);
      setLayout(next);
      setSelected(current => current === "settings" || next.active.includes(current) ? current : null);
    };
    globalThis.chrome?.storage?.onChanged?.addListener(listener);
    return () => { mounted = false; globalThis.chrome?.storage?.onChanged?.removeListener(listener); };
  }, []);

  useEffect(() => {
    let mounted = true;
    const revision = { volume: 0, font: 0, drawing: 0, dark: 0, editor: 0, video: 0 };
    const listener = (message, sender) => {
      if (sender.id !== chrome.runtime.id) return;
      if (message?.target === "audio-popup" && Number.isInteger(message.activeCount)) {
        revision.volume++;
        setRunning(current => ({ ...current, volume: message.activeCount > 0 }));
      }
      if (message?.target === "modules-popup" && message.type === "modules:running" && ["font", "drawing", "dark", "editor", "video"].includes(message.module)) {
        revision[message.module]++;
        setRunning(current => ({ ...current, [message.module]: !!message.active }));
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    if (selected === null) {
      const currentRevision = { ...revision };
      chrome.runtime.sendMessage({ target: "modules-background", type: "modules:status" }).then(response => {
        if (mounted && response?.ok) setRunning(current => ({
          volume: revision.volume === currentRevision.volume ? !!response.state?.volume : current.volume,
          font: revision.font === currentRevision.font ? !!response.state?.font : current.font,
          drawing: revision.drawing === currentRevision.drawing ? !!response.state?.drawing : current.drawing,
          dark: revision.dark === currentRevision.dark ? !!response.state?.dark : current.dark,
          editor: revision.editor === currentRevision.editor ? !!response.state?.editor : current.editor,
          video: revision.video === currentRevision.video ? !!response.state?.video : current.video
        }));
      }).catch(() => {});
    }
    return () => { mounted = false; chrome.runtime.onMessage.removeListener(listener); };
  }, [selected]);

  useEffect(() => {
    if (!ready) return;
    const recent = recentModules(recentOpens.current);
    layout.active.forEach(id => { if (id in recent) preloadModule(id); });
  }, [ready, layout]);

  function selectModule(id) {
    if (!ready || saving || !layout.active.includes(id)) return;
    recentOpens.current = { ...recentModules(recentOpens.current), [id]: Date.now() };
    void chrome.storage.session.set({ [RECENT_MODULES_KEY]: recentOpens.current }).catch(error => console.warn("Modül geçmişi kaydedilemedi.", error));
    setSelected(id);
    setLastModule(id);
  }

  function changeSortOrder(value) {
    const next = normalizeSortOrder(value);
    setSortOrder(next);
    void chrome.storage.local.set({ [SORT_ORDER_KEY]: next }).catch(error => console.warn("Sıralama kaydedilemedi.", error));
  }

  async function saveLayout(next) {
    if (saving || !ready) return;
    setSaving(true);
    setError("");
    try {
      const response = await chrome.runtime.sendMessage({ target: "modules-background", type: "modules:set", layout: next });
      if (!response?.ok) throw new Error(response?.error || t("modules_could_not_save_module_layout"));
      setLayout(normalizeLayout(response.layout));
    } catch (error) { setError(error.message || t("modules_could_not_save_module_layout")); }
    finally { setSaving(false); }
  }

  if (selected === "settings") return <>
    <main className="module-content" aria-labelledby="settings-title">
      <Settings theme={theme} language={language} error={settingsError} disabled={!settingsReady || settingsSaving} onThemeChange={value => changeSetting("menuTheme", value)} onLanguageChange={value => changeSetting("language", value)} />
    </main>
    <PageHeader title={t("settings_title")} titleId="settings-title" onBack={() => setSelected(null)} />
  </>;
  const module = layout.active.includes(selected) && modules.find(item => item.id === selected);
  if (!module) return <ExtensionMenu theme={theme} themeConfig={MENU_THEMES[theme]} modules={modules} layout={layout} ready={ready} saving={saving} error={error} onLayoutChange={saveLayout}
    lastModule={lastModule} onSelect={selectModule} onOpenSettings={() => { setSelected("settings"); setLastModule(null); }} onPreload={preloadModule} running={running} />;
  const SelectedModule = module.Component;
  const titleId = `${module.id}-title`;
  return <>
    <main className="module-content" aria-labelledby={titleId} key={module.id}>
      <Suspense fallback={<p className="module-loading muted">{"" + t("common_loading") + ""}</p>}>
        <SelectedModule sortOrder={sortOrder} onSortChange={changeSortOrder} draft={qrDraft} onDraftChange={setQrDraft} />
      </Suspense>
    </main>
    <PageHeader title={module.title} titleId={titleId} onBack={() => setSelected(null)} />
  </>;
}
