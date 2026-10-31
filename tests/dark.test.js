import test from "node:test";
import assert from "node:assert/strict";
import { DARK_DEFAULTS, DARK_KEY, normalizeDark } from "../components/modules/dark-mode/dark-settings.js";
import { handleDarkMode, darkPageContext } from "../components/modules/dark-mode/dark-background.js";

function mockDark(initial) {
  const data = { [DARK_KEY]: structuredClone(initial) };
  const state = { registered: true, main: false, child: true, injected: 0, applied: 0, failRegister: false, failInject: false };
  globalThis.chrome = {
    storage: { local: {
      async get(key) { return { [key]: structuredClone(data[key]) }; },
      async set(values) { Object.assign(data, structuredClone(values)); }
    } },
    permissions: { contains: async () => true },
    tabs: {
      async query() { return [{ id: 1, url: "https://example.com" }]; },
      async sendMessage(id, message, options) {
        if (message.type === "dark:stop") { state.main = false; state.child = false; return { ok: true }; }
        assert.equal(options?.frameId, 0, "A child-frame reply must not hide a missing main-page controller");
        if (!state.main) throw new Error("Missing main receiver");
        if (message.type === "dark:apply") state.applied++;
        return { ok: true, active: true };
      }
    },
    scripting: {
      async getRegisteredContentScripts() { return state.registered ? [{ id: "extension-manager-dark" }] : []; },
      async registerContentScripts() { if (state.failRegister) throw new Error("Register failed"); state.registered = true; },
      async unregisterContentScripts() { state.registered = false; },
      async executeScript(options) {
        assert.deepEqual(options.files, ["vendor/darkreader.js", "dark-mode-content.js"]);
        if (state.failInject) throw new Error("Inject failed");
        state.injected++; state.main = true; return [];
      }
    }
  };
  return { data, state };
}

test("already-enabled dark mode restores a missing main receiver despite a live iframe", async () => {
  const { state } = mockDark({ ...DARK_DEFAULTS, enabled: true });
  try {
    const result = await handleDarkMode({ type: "dark:get" });
    assert.equal(result.enabled, true); assert.equal(state.injected, 1); assert.equal(state.applied, 1);
    await handleDarkMode({ type: "dark:set", patch: { background: "#222222" } });
    assert.equal(state.injected, 1); // Reuse the existing engine rather than constructing another instance.
    state.main = false;
    await handleDarkMode({ type: "dark:set", patch: { contrast: 90 } });
    assert.equal(state.injected, 2);
  } finally { delete globalThis.chrome; }
});

test("registration and injection failures do not leave dark mode falsely enabled", async () => {
  const { data, state } = mockDark(DARK_DEFAULTS);
  try {
    state.registered = false; state.failRegister = true;
    await assert.rejects(handleDarkMode({ type: "dark:set", patch: { enabled: true } }), /Register failed/);
    assert.equal(data[DARK_KEY].enabled, false); assert.equal(state.registered, false);
    state.failRegister = false; state.failInject = true;
    await assert.rejects(handleDarkMode({ type: "dark:set", patch: { enabled: true } }), /Could not apply dark mode/);
    assert.equal(data[DARK_KEY].enabled, false); assert.equal(state.registered, false);
  } finally { delete globalThis.chrome; }
});

test("appearance patches retain newer enabled/site choices and disabled mode clears stale registration", async () => {
  const { data, state } = mockDark({ ...DARK_DEFAULTS, enabled: true, excluded: ["example.com"] });
  state.main = true;
  try {
    await handleDarkMode({ type: "dark:set", patch: { enabled: false } });
    await handleDarkMode({ type: "dark:set", patch: { brightness: 80 } });
    assert.equal(data[DARK_KEY].enabled, false); assert.equal(data[DARK_KEY].brightness, 80);
    assert.deepEqual(data[DARK_KEY].excluded, ["example.com"]); assert.equal(state.injected, 0);
    state.registered = true;
    await handleDarkMode({ type: "dark:set", patch: { enabled: false } });
    assert.equal(state.registered, false);
  } finally { delete globalThis.chrome; }
});

test("iframe context resolves exclusions from its parent tab, and damaged settings fall back safely", async () => {
  mockDark({ ...DARK_DEFAULTS, enabled: true, excluded: ["example.com"] });
  try {
    const context = await darkPageContext({ tab: { id: 1, url: "https://example.com/page" }, url: "https://other.example/frame", frameId: 3 });
    assert.equal(context.hostname, "example.com"); assert.equal(context.settings.excluded.includes(context.hostname), true);
    assert.deepEqual(normalizeDark(null), DARK_DEFAULTS);
  } finally { delete globalThis.chrome; }
});

test("a page recovery failure stays visible and leaves the off control usable", async () => {
  const { state, data } = mockDark({ ...DARK_DEFAULTS, enabled: true });
  state.failInject = true;
  try {
    const result = await handleDarkMode({ type: "dark:get" });
    assert.equal(result.enabled, true); assert.match(result.warning, /Could not apply dark mode/);
    await handleDarkMode({ type: "dark:set", patch: { enabled: false } });
    assert.equal(data[DARK_KEY].enabled, false);
  } finally { delete globalThis.chrome; }
});
