import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import manifest from "./manifest.json" with { type: "json" };
import { copyFileSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

// Chrome loads these files directly, including in the unpacked dev build.
const offscreenDevFile = {
  name: "offscreen-dev-file",
  generateBundle() {
    for (const [fileName, source] of distributionNotices()) {
      this.emitFile({ type: "asset", fileName, source });
    }
    this.emitFile({ type: "asset", fileName: "vendor/darkreader.js", source: darkReaderBundle() });
    this.emitFile({ type: "asset", fileName: "vendor/darkreader-LICENSE.txt", source: readFileSync(resolve("node_modules/darkreader/LICENSE")) });
  },
  configureServer(server) {
    const source = resolve(server.config.root, "offscreen.html");
    const output = resolve(server.config.root, server.config.build.outDir);
    const copy = () => {
      mkdirSync(resolve(output, "vendor"), { recursive: true });
      mkdirSync(resolve(output, "LICENSES"), { recursive: true });
      for (const [fileName, content] of distributionNotices()) {
        writeFileSync(resolve(output, fileName), content);
      }
      copyFileSync(source, resolve(output, "offscreen.html"));
      cpSync(resolve(server.config.root, "public"), output, { recursive: true });
      writeFileSync(resolve(output, "vendor/darkreader.js"), darkReaderBundle());
      copyFileSync(resolve("node_modules/darkreader/LICENSE"), resolve(output, "vendor/darkreader-LICENSE.txt"));
    };
    server.httpServer?.once("listening", copy);
    server.watcher.on("change", file => { if (resolve(file) === source || resolve(file).startsWith(resolve(server.config.root, "public") + "/") || file.includes("dark-mode-content.js")) copy(); });
  }
};

export default defineConfig(({ command }) => ({
  plugins: [react(), crx({ manifest }), offscreenDevFile],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    cors: { origin: [/^chrome-extension:\/\/[a-p]{32}$/] }
  },
  build: {
    outDir: command === "serve" ? "dist-chrome.dev" : "dist-chrome",
    rolldownOptions: { input: { offscreen: "offscreen.html" } }
  }
}));
