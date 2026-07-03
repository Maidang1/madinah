import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = `${dirname(fileURLToPath(import.meta.url))}/`;

// Standalone renderer-only build for browser-based verification (no Electron).
// The app falls back to browser adapters when window.madinahWriter is absent.
export default defineConfig({
  root,
  plugins: [pluginReact()],
  html: {
    template: "./index.html",
    title: "Madinah Writer (verify)",
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1517,
    strictPort: false,
  },
});
