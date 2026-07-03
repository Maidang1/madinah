import { mainPlugin } from "@electron-rsbuild/plugin-main";
import { preloadPlugin } from "@electron-rsbuild/plugin-preload";
import { rendererPlugin } from "@electron-rsbuild/plugin-renderer";
import { defineConfig, type RsbuildPlugin } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = `${dirname(fileURLToPath(import.meta.url))}/`;

const electronRsbuildPreloadDevMarker: RsbuildPlugin = {
  // electron-rsbuild 0.0.12 checks this plugin name in the preload environment
  // before appending its default preload entry during `dev`.
  name: "electron-rsbuild:main",
  setup() {},
};

const mainConfig = {
  source: {
    entry: {
      index: "./electron/main/index.ts",
    },
  },
  output: {
    target: "node" as const,
    distPath: {
      root: "out/main",
      js: ".",
    },
  },
  tools: {
    rspack: {
      target: "electron-main" as const,
      output: {
        filename: "[name].cjs",
        chunkFilename: "[id].cjs",
      },
    },
  },
};

const preloadConfig = {
  source: {
    entry: {
      index: "./electron/preload/index.ts",
    },
  },
  output: {
    target: "node" as const,
    distPath: {
      root: "out/preload",
      js: ".",
    },
  },
  tools: {
    rspack: {
      target: "electron-preload" as const,
      output: {
        filename: "[name].cjs",
        chunkFilename: "[id].cjs",
      },
    },
  },
};

const rendererConfig = {
  html: {
    template: "./index.html",
    title: "Madinah Writer",
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
  output: {
    assetPrefix: "auto",
    distPath: {
      root: "out/renderer",
    },
  },
};

export default defineConfig({
  root,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  environments: {
    main: {
      plugins: [mainPlugin(mainConfig)],
    },
    preload: {
      plugins: [preloadPlugin(preloadConfig), electronRsbuildPreloadDevMarker],
    },
    renderer: {
      plugins: [pluginReact(), rendererPlugin(rendererConfig)],
    },
  },
});
