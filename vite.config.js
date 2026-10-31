import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import manifest from "./manifest.json" with { type: "json" };
import { copyFileSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

function darkReaderBundle() {
  const source = readFileSync(resolve("node_modules/darkreader/darkreader.js"), "utf8").replace(/\r\n/g, "\n");
  const proxy = '{\n            const proxyScript = createOrUpdateScript("darkreader--proxy");';
  if (!source.includes(proxy)) throw new Error("Dark Reader proxy uyarlaması güncellenmeli.");
  // The website API patches chrome.runtime; keep its transport private to the engine.
  // Both page proxies are disabled by our options, so no inline script is needed under MV3 CSP.
  return `(() => { if (globalThis.DarkReader) return; const chrome = { runtime: {} };\n${source.replace(proxy, 'if (enableStyleSheetsProxy || enableCustomElementRegistryProxy) {\n            const proxyScript = createOrUpdateScript("darkreader--proxy");')}\n})();`;
}

// Carry runtime licenses with every unpacked distribution.
function distributionNotices() {
  return [
    ["LICENSE", readFileSync(resolve("LICENSE"))],
    ["THIRD_PARTY_NOTICES.md", readFileSync(resolve("THIRD_PARTY_NOTICES.md"))],
    ...["react", "react-dom", "scheduler", "darkreader"].map(name => [
      `LICENSES/${name}.txt`, readFileSync(resolve(`node_modules/${name}/LICENSE`))
    ])
  ];
}

function localeCatalogs() {
  const content = readFileSync(resolve("locales/en.json"), "utf8");
  const messages = JSON.parse(content);
  for (const [key, entry] of Object.entries(messages)) {
    if (typeof entry?.message !== "string" || !entry.message) throw new Error(`Missing translation: ${key}`);
  }
  return { en: content };
}

// Chrome loads these files directly, including in the unpacked dev build.
const offscreenDevFile = {
  name: "offscreen-dev-file",
  generateBundle() {
    for (const [locale, source] of Object.entries(localeCatalogs())) {
      this.emitFile({ type: "asset", fileName: `_locales/${locale}/messages.json`, source });
    }
    for (const [fileName, source] of distributionNotices()) {
      this.emitFile({ type: "asset", fileName, source });
    }
    this.emitFile({ type: "asset", fileName: "vendor/darkreader.js", source: darkReaderBundle() });
    this.emitFile({ type: "asset", fileName: "vendor/darkreader-LICENSE.txt", source: readFileSync(resolve("node_modules/darkreader/LICENSE")) });
  },
  configureServer(server) {
    const source = resolve(server.config.root, "components/modules/volume-booster/offscreen.html");
    const output = resolve(server.config.root, server.config.build.outDir);
    const copy = () => {
      mkdirSync(resolve(output, "vendor"), { recursive: true });
      mkdirSync(resolve(output, "LICENSES"), { recursive: true });
      for (const [locale, content] of Object.entries(localeCatalogs())) {
        mkdirSync(resolve(output, `_locales/${locale}`), { recursive: true });
        writeFileSync(resolve(output, `_locales/${locale}/messages.json`), content);
      }
      for (const [fileName, content] of distributionNotices()) {
        writeFileSync(resolve(output, fileName), content);
      }
      const offscreenOutput = resolve(output, "components/modules/volume-booster");
      mkdirSync(offscreenOutput, { recursive: true });
      copyFileSync(source, resolve(offscreenOutput, "offscreen.html"));
      cpSync(resolve(server.config.root, "public"), output, { recursive: true });
      writeFileSync(resolve(output, "vendor/darkreader.js"), darkReaderBundle());
      copyFileSync(resolve("node_modules/darkreader/LICENSE"), resolve(output, "vendor/darkreader-LICENSE.txt"));
    };
    server.httpServer?.once("listening", copy);
    const publicPath = resolve(server.config.root, "public") + sep;
    const localePath = resolve(server.config.root, "locales") + sep;
    const syncPublicFile = file => { if (resolve(file) === source || resolve(file).startsWith(localePath) || resolve(file).startsWith(publicPath) || file.includes("dark-mode-content.js")) copy(); };
    server.watcher.on("change", syncPublicFile);
    server.watcher.on("add", syncPublicFile);
  }
};

export default defineConfig(({ command }) => ({
  plugins: [react(), crx({ manifest }), offscreenDevFile],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    cors: { origin: [/^chrome-extension:\/\/[a-p]{32}$/] }
  },
  build: {
    outDir: command === "serve" ? "dist-chrome.dev" : "dist-chrome",
    rolldownOptions: { input: { offscreen: "components/modules/volume-booster/offscreen.html" } }
  }
}));
