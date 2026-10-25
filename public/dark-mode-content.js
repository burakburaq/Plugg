(() => {
  if (globalThis.__extensionManagerDarkMode?.version === 2) return;
  try { globalThis.__extensionManagerDarkMode?.stop(); } catch {}
  const engine = globalThis.DarkReader;
  if (!engine || !globalThis.chrome?.runtime?.id) return;
  const runtime = chrome.runtime, storage = chrome.storage;
  let disposed = false, revision = 0, timer;
  // Site stylesheets/images may live on a different origin; the worker has the granted host access.
  engine.setFetchMethod(async url => {
    if (!/^https?:/i.test(String(url))) return fetch(url);
    const reply = await runtime.sendMessage({ target: "dark-background", type: "dark:fetch", url: String(url) });
    if (!reply?.ok) throw new Error(reply?.error || "Stil kaynağı yüklenemedi.");
    const bytes = Uint8Array.from(atob(reply.state.data), char => char.charCodeAt(0));
    return new Response(bytes, { headers: { "Content-Type": reply.state.contentType } });
  });
  async function apply() {
    clearTimeout(timer);
    const current = ++revision;
    const reply = await runtime.sendMessage({ target: "dark-background", type: "dark:context" });
    if (disposed || current !== revision) return;
    if (!reply?.ok) throw new Error(reply?.error || "Koyu mod ayarları okunamadı.");
    const settings = reply.state.settings;
    if (!settings.enabled) { stop(); return; }
    // A site's exception includes its embedded cross-origin frames.
    if (settings.excluded.includes(reply.state.hostname || location.hostname.toLowerCase())) { engine.disable(); return; }
    engine.enable({ mode: 1, brightness: settings.brightness, contrast: settings.contrast, sepia: settings.sepia,
      darkSchemeBackgroundColor: settings.background, darkSchemeTextColor: settings.text }, { disableStyleSheetsProxy: true, disableCustomElementRegistryProxy: true });
  }
  function change(changes, area) {
    if (area !== "local" || !(changes.moduleLayout || changes.darkModeSettings)) return;
    if (changes.darkModeSettings?.newValue?.enabled === false || (changes.moduleLayout && !changes.moduleLayout.newValue?.active?.includes("dark"))) { stop(); return; }
    revision++; clearTimeout(timer);
    timer = setTimeout(() => void apply().catch(stop), 100);
  }
  function receive(message, sender, reply) {
    if (sender.id !== runtime.id || message.target !== "dark-page") return;
    if (message.type === "dark:stop") { stop(); reply({ ok: true }); }
    if (message.type === "dark:status") reply({ ok: true, active: !disposed && engine.isEnabled() });
    if (message.type === "dark:apply") {
      apply().then(() => reply({ ok: true, active: !disposed && engine.isEnabled() })).catch(error => { stop(); reply({ ok: false, error: error.message }); });
      return true;
    }
  }
  function stop() {
    if (disposed) return;
    disposed = true; revision++; clearTimeout(timer); engine.disable();
    storage.onChanged.removeListener(change); runtime.onMessage.removeListener(receive);
    removeEventListener("pagehide", hide); removeEventListener("pageshow", show); delete globalThis.__extensionManagerDarkMode;
  }
  globalThis.__extensionManagerDarkMode = { stop, version: 2 };
  storage.onChanged.addListener(change); runtime.onMessage.addListener(receive);
  function hide(event) { if (event.persisted) engine.disable(); else stop(); }
  function show(event) { if (event.persisted) void apply().catch(stop); }
  addEventListener("pagehide", hide); addEventListener("pageshow", show);
  void apply().catch(stop);
})();
