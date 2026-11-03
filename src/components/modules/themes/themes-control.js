// Remains reachable after activeTab access expires and preserves saved edits.
export function installThemesControl() {
  if (globalThis.__pluggThemesControl) return;
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.target !== "plugg-feature-control" || message.module !== "themes") return;
    globalThis.__pluggRadiusEditor?.stop();
    globalThis.__pluggTextEditor?.stop();
    for (const key of ["__pluggRadiusChanges", "__pluggTextChanges"]) {
      const state = globalThis[key];
      state?.observer?.disconnect();
      if (state) state.observer = null;
    }
    reply({ ok: true });
  });
  globalThis.__pluggThemesControl = true;
}
