// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import partytown from "@astrojs/partytown";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";

// MDX plugins
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

// https://astro.build/config
export default defineConfig({
  site: "https://madinah.felixwliu.cn",
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
    react(),
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
