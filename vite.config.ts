import {
  vitePlugin as remix, cloudflareDevProxyVitePlugin as remixCloudflareDevProxy
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mdx from '@mdx-js/rollup'
import remarkGfm from "remark-gfm"
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter"

export default defineConfig({
  plugins: [
    remixCloudflareDevProxy(),
    mdx({
      remarkPlugins: [remarkGfm, remarkFrontmatter, [remarkMdxFrontmatter, { name: "matter" }]]
    }),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  // fixed react-use commonjs issue link https://github.com/streamich/react-use/issues/2353
  ssr: {
    noExternal: ['react-use']
  },
  optimizeDeps: {
    include: ['react-use']
  }
});
