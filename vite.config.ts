import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import virtual from 'vite-plugin-virtual';
import path from 'path';
import { generatePostsMetadata } from './utils/post';
import rehypeRaw from "rehype-raw"
import { nodeTypes } from "@mdx-js/mdx"
import remarkShikiTwoslash from 'remark-shiki-twoslash';
import rehypeSlug from 'rehype-slug'
import rehypeAutoLinkHeadings from 'rehype-autolink-headings'
import fs from "fs"
import type { Plugin } from 'vite'
import commonjs from "vite-plugin-commonjs"


const root = process.cwd();
const appDir = path.join(root, 'app');
const routeDir = path.join(appDir, 'routes');

function excalidraw(): Plugin {
  return {
    name: "excalidraw",
    resolveId(id: string) {
      if (id.endsWith(".excalidraw")) {
        return id
      }
    },
    load(id) {
      if (!id.endsWith(".excalidraw")) {
        return null

      }
      const content = fs.readFileSync(id, {
        encoding: 'utf-8'
      })

      return `const data = ${content}; export default data`;
    },
  }
}


export default defineConfig(async () => {
  return {
    plugins: [
      remixCloudflareDevProxy(),
      excalidraw(),
      commonjs(),
      mdx({
        providerImportSource: "@mdx-js/react",
        rehypePlugins: [[rehypeRaw, { passThrough: nodeTypes }], rehypeSlug,
        [
          rehypeAutoLinkHeadings,
          {
            behavior: 'append',
            properties: { class: 'header-anchor' },
          },
        ],],
        remarkPlugins: [
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'matter' }],
          [
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            remarkShikiTwoslash.default,
            {
              disableImplicitReactImport: true,
              includeJSDocInHover: true,
              themes: ["vitesse-light", "vitesse-dark"],
              defaultOptions: {
                lib: ["dom", "es2015"],
              }
            },
          ],
        ]
      }),
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
      virtual({
        'virtual:blog-list': `const list = ${await generatePostsMetadata(
          routeDir,
          ['blogs.']
        )}; export { list }`,
      }),
      tsconfigPaths(),
    ],
    // fixed react-use commonjs issue link https://github.com/streamich/react-use/issues/2353
    ssr: {
      noExternal: ['react-use'],
    },
    optimizeDeps: {
      include: ['react-use'],
    },
    define: {
      "process.env.IS_PREACT": JSON.stringify("true"),
    },
    server: {
      warmup: {
        clientFiles: ['app/**/*.tsx'],
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      }
    }
  };
});
