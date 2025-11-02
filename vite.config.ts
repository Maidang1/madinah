import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import path from 'path';
import { generatePostsMetadata } from './utils/post';
import { booksVirtualPlugin } from './utils/book';
import rehypeRaw from 'rehype-raw';
import { nodeTypes } from '@mdx-js/mdx';
import remarkShikiTwoslash from 'remark-shiki-twoslash';
import rehypeSlug from 'rehype-slug';
import rehypeAutoLinkHeadings from 'rehype-autolink-headings';
import fs from 'fs';
import type { Plugin, ViteDevServer } from 'vite';
import commonjs from 'vite-plugin-commonjs';


const root = process.cwd();
const appDir = path.join(root, 'app');
const routeDir = path.join(appDir, 'routes');
const BLOG_LIST_MODULE_ID = 'virtual:blog-list';

const isMdxFile = (file: string) => file.endsWith('.mdx');

const isBlogPostMdx = (file: string) => {
  const relativePath = path.relative(routeDir, file);
  if (relativePath.startsWith('..')) return false;
  return relativePath.startsWith('blogs.') && relativePath.endsWith('.mdx');
};

async function createBlogListModuleCode() {
  const metadata = await generatePostsMetadata(routeDir, ['blogs.']);
  return `const list = ${metadata}; export { list }`;
}

function blogListVirtualPlugin(): Plugin {
  const virtualModuleId = BLOG_LIST_MODULE_ID;
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;
  let moduleCodePromise: Promise<string> | null = null;

  const ensureModuleCode = () => {
    if (!moduleCodePromise) {
      moduleCodePromise = createBlogListModuleCode().catch((error) => {
        moduleCodePromise = null;
        throw error;
      });
    }
    return moduleCodePromise;
  };

  const invalidateBlogListModule = (server: ViteDevServer) => {
    const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
    if (mod) {
      server.moduleGraph.invalidateModule(mod);
    }
  };

  return {
    name: 'blog-list-virtual-module',
    async buildStart() {
      this.addWatchFile(routeDir);
      await ensureModuleCode();
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return null;
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return ensureModuleCode();
      }
      return null;
    },
    configureServer(server) {
      const refresh = async () => {
        moduleCodePromise = null;
        try {
          await ensureModuleCode();
          invalidateBlogListModule(server);
          server.ws.send({ type: 'full-reload' });
        } catch (error) {
          console.error('[MDX] Failed to regenerate blog metadata:', error);
        }
      };

      const onFileMutation = (file: string) => {
        if (!isBlogPostMdx(file)) return;
        void refresh();
      };

      server.watcher.on('add', onFileMutation);
      server.watcher.on('unlink', onFileMutation);
    },
    async handleHotUpdate(context) {
      if (isBlogPostMdx(context.file)) {
        moduleCodePromise = null;
        try {
          await ensureModuleCode();
        } catch (error) {
          console.error('[MDX] Failed to regenerate blog metadata on hot update:', error);
          return [];
        }
        const mod = context.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
        if (mod) {
          context.server.moduleGraph.invalidateModule(mod);
          return [mod];
        }
      }
      return undefined;
    },
  };
}

function resolveExcalidrawId(id: string, importer: string | undefined) {
  if (id.startsWith('~/')) {
    return path.resolve(appDir, id.slice(2));
  }
  if (path.isAbsolute(id)) {
    return id;
  }
  if (!importer) {
    return path.resolve(root, id);
  }
  return path.resolve(path.dirname(importer), id);
}

function excalidraw(): Plugin {
  const componentAbsolutePath = path.resolve(appDir, 'core/ui/common/excalidraw.tsx');

  const toPosixPath = (target: string) => target.split(path.sep).join(path.posix.sep);

  return {
    name: "excalidraw",
    resolveId(id: string, importer) {
      if (id.endsWith(".excalidraw")) {
        return resolveExcalidrawId(id, importer);
      }
    },
    load(id) {
      if (!id.endsWith(".excalidraw")) {
        return null;
      }
      const content = fs.readFileSync(id, {
        encoding: 'utf-8',
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error(`[excalidraw] Failed to parse ${id} as JSON.`);
      }
      const importerDir = path.dirname(id);
      const relativeImportPath = path.relative(importerDir, componentAbsolutePath);
      const normalizedImportPath = toPosixPath(
        relativeImportPath.startsWith('.')
          ? relativeImportPath
          : `./${relativeImportPath}`,
      );

      const serialized = JSON.stringify(parsed);

      return `
import { createElement } from "react";
import ExcalidrawComponent from "${normalizedImportPath}";
const data = ${serialized};
export const excalidrawData = data;
function ExcalidrawWrapper(props) {
  return createElement(ExcalidrawComponent, { ...props, data });
}
ExcalidrawWrapper.displayName = "ExcalidrawDiagram";
export default ExcalidrawWrapper;
`;
    },
  };
}

function mdxHotReload(): Plugin {
  return {
    name: 'mdx-hot-reload',
    handleHotUpdate({ file, server }) {
      if (isMdxFile(file)) {
        const modules = server.moduleGraph.getModulesByFile(file);
        if (modules) {
          return Array.from(modules);
        }
        return [];
      }

      return undefined;
    },
  };
}


export default defineConfig(async () => {

  return {
    plugins: [
      remixCloudflareDevProxy(),
      excalidraw(),
      mdxHotReload(),
      commonjs(),
      mdx({
        providerImportSource: '@mdx-js/react',
        rehypePlugins: [
          [rehypeRaw, { passThrough: nodeTypes }],
          rehypeSlug,
          [
            rehypeAutoLinkHeadings,
            {
              behavior: 'append',
              properties: { class: 'header-anchor' },
            },
          ],
        ],
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
          v3_lazyRouteDiscovery: true,
          v3_singleFetch: true,
        },
      }),
      booksVirtualPlugin(),
      blogListVirtualPlugin(),
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
      },
    }
  };
});
