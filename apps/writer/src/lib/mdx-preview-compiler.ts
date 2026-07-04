import { compile } from "@mdx-js/mdx";
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

let highlighterPromise: ReturnType<typeof createPreviewHighlighter> | null = null;

export interface CompileMdxPreviewCodeOptions {
  profile?: Pick<EngineProfile, "remarkPlugins" | "rehypePlugins"> | null;
}

export async function compileMdxPreviewCode(
  source: string,
  options: CompileMdxPreviewCodeOptions = {},
): Promise<string> {
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

  return String(
    await compile(source, {
      outputFormat: "function-body",
      baseUrl: import.meta.url,
      remarkPlugins: remarkPlugins as never,
      rehypePlugins: rehypePlugins as never,
    }),
  );
}

export function createBuiltinPreviewCompileProfile(
  profileId: string,
): Pick<EngineProfile, "remarkPlugins" | "rehypePlugins"> | null {
  if (profileId === "commonmark") {
    return {
      remarkPlugins: [],
      rehypePlugins: [],
    };
  }
  if (profileId === "gfm" || profileId === "mdx") {
    return {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [],
    };
  }
  if (profileId === "blog-mdx") {
    return {
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [],
    };
  }
  return null;
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
