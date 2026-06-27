import type { ComponentType } from "react";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { evaluate } from "@mdx-js/mdx";
import bash from "@shikijs/langs/bash";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsonc from "@shikijs/langs/jsonc";
import jsxLang from "@shikijs/langs/jsx";
import markdown from "@shikijs/langs/markdown";
import rust from "@shikijs/langs/rust";
import shellscript from "@shikijs/langs/shellscript";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { EngineProfile } from "../domain/engine";

export type MdxPreviewContent = ComponentType<{
  components?: Record<string, ComponentType<Record<string, unknown>>>;
}>;

let highlighterPromise: ReturnType<typeof createPreviewHighlighter> | null = null;

interface CompileMdxPreviewOptions {
  profile?: EngineProfile;
}

export async function compileMdxPreview(
  source: string,
  options: CompileMdxPreviewOptions = {},
): Promise<MdxPreviewContent> {
  const highlighter = await getPreviewHighlighter();
  const remarkPlugins = options.profile?.remarkPlugins ?? [
    remarkFrontmatter,
    remarkGfm,
  ];
  const rehypePlugins = [
    [
      rehypeRaw,
      {
        passThrough: [
          "mdxjsEsm",
          "mdxFlowExpression",
          "mdxJsxFlowElement",
          "mdxJsxTextElement",
          "mdxTextExpression",
        ],
      },
    ],
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: "append",
        properties: {
          className: ["header-anchor"],
          ariaLabel: "Link to section",
        },
      },
    ],
    [
      rehypeShikiFromHighlighter,
      highlighter,
      {
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
        defaultColor: false,
      },
    ],
    ...(options.profile?.rehypePlugins ?? []),
  ];

  const mod = await evaluate(source, {
    Fragment,
    jsx,
    jsxs,
    baseUrl: import.meta.url,
    remarkPlugins: remarkPlugins as never,
    rehypePlugins: rehypePlugins as never,
  });

  return mod.default as MdxPreviewContent;
}

function getPreviewHighlighter() {
  highlighterPromise ??= createPreviewHighlighter();
  return highlighterPromise;
}

function createPreviewHighlighter() {
  return createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [
      typescript,
      javascript,
      tsx,
      jsxLang,
      rust,
      yaml,
      bash,
      shellscript,
      json,
      jsonc,
      markdown,
    ],
    langAlias: {
      shell: "shellscript",
      sh: "shellscript",
    },
    engine: createJavaScriptRegexEngine(),
  });
}
