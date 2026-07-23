// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import partytown from "@astrojs/partytown";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import { MADINAH_SITE_URL } from "@madinah/content-core";

// MDX plugins
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkMdxHandwritten from "@madinah/mdx-handwritten-remark";

// https://astro.build/config
export default defineConfig({
  site: MADINAH_SITE_URL,
  vite: {
    plugins: [
      tailwindcss({
        optimize: {
          minify: true,
        },
      }),
    ],
  },
  integrations: [
    partytown(),
    mdx({
      syntaxHighlight: "shiki",
      shikiConfig: {
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
        defaultColor: false,
        wrap: false,
      },
      remarkPlugins: [
        remarkFrontmatter,
        remarkGfm,
        // remark-directive must run before the handwritten transformer.
        remarkDirective,
        [
          remarkMdxHandwritten,
          {
            // Astro has no React component map; emit semantic HTML + data-hw*.
            output: "element",
            diagnostics: "strict",
          },
        ],
      ],
      rehypePlugins: [
        rehypeRaw,
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "append",
            properties: {
              class: "header-anchor",
              ariaLabel: "Link to section",
            },
          },
        ],
      ],
      optimize: {
        ignoreElementNames: [
          "h1",
          "h2",
          "h3",
          "p",
          "a",
          "ul",
          "ol",
          "li",
          "blockquote",
          "code",
          "hr",
          "img",
          "table",
          "th",
          "td",
        ],
      },
    }),
  ],
  adapter: cloudflare(),
});
