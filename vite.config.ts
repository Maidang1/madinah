import {
  vitePlugin as remix, cloudflareDevProxyVitePlugin as remixCloudflareDevProxy
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mdx from '@mdx-js/rollup'
import remarkGfm from "remark-gfm"
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import virtual from "vite-plugin-virtual"
import fs from 'fs'
import path from 'path'

const root = process.cwd();
const appDir = path.join(root, 'app');
const blogDir = path.join(appDir, 'routes/blog')

const getBlogList = () => {
  const result = fs.readdirSync(blogDir, { encoding: "utf-8" })
  return JSON.stringify(result)
}

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
    virtual({
      "virtual:blog-list": `const list = ${getBlogList()}; export { list }`
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
