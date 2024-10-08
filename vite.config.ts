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
import { getListInfo } from './utils/post-info';
import rehypeRaw from "rehype-raw"
import { nodeTypes } from "@mdx-js/mdx"
import remarkShikiTwoslash from 'remark-shiki-twoslash';

const root = process.cwd();
const appDir = path.join(root, 'app');
const routeDir = path.join(appDir, 'routes');

export default defineConfig(async () => {
  return {
    plugins: [
      remixCloudflareDevProxy(),
      mdx({
        rehypePlugins: [[rehypeRaw, { passThrough: nodeTypes }]],
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
              themes: ["github-light", "github-dark"],
              defaultOptions: {
                lib: ["dom", "es2015"],
              },
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
        'virtual:blog-list': `const list = ${await getListInfo(
          routeDir,
          'blogs.'
        )}; export { list }`,
        'virtual:note-list': `const list = ${await getListInfo(
          routeDir,
          'notes.'
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
  };
});
