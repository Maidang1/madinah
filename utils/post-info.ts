/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import fs from 'fs/promises'
import path from 'path'
import { unified } from "unified"
import remarkParse from 'remark-parse'
import remarkFrontmatter from "remark-frontmatter";
import remarkStringify from "remark-stringify"
import { matter } from 'vfile-matter'
import readingTime from 'reading-time';
import remarkMdx from "remark-mdx"
import { PostInfo } from '~/types';
import { toc } from 'mdast-util-toc'
import { extractTocItems } from './toc';
import { getSummary } from "./ollama"


function myUnifiedPluginHandlingYamlMatter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_: unknown, file: any) => {
    matter(file)
  }
}


function unifiedPluginToc() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any, file: any) => {
    const result = toc(tree)
    file.data.toc = extractTocItems(result.map?.children ?? [])
  }
}


export const getListInfo = async (listPath: string, prefix: string | string[]) => {
  const result = await fs.readdir(listPath, { encoding: "utf-8" })
  if (!Array.isArray(prefix)) {
    prefix = [prefix];
  }
  const aiBogsSummaryJsonPath = path.join(process.cwd(), 'app/summary/blogs-summary.json')
  const summaryJson = (JSON.parse(await fs.readFile(aiBogsSummaryJsonPath, { encoding: "utf8" })) ?? {}) as Record<string, string>
  const formatList = result.filter(list => prefix.some(p => list.startsWith(p)))
  const parsedContent = await Promise.all(formatList.map(async list => {
    const fullPath = path.join(listPath, list);
    const content = await fs.readFile(fullPath, "utf8");
    const file = await unified()
      .use(remarkMdx)
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkFrontmatter)
      .use(myUnifiedPluginHandlingYamlMatter)
      .use(unifiedPluginToc)
      .process(content);

    const targetPrefix = prefix.find(p => list.startsWith(p)) ?? '';
    const filename = list.replace(targetPrefix, '').split(".")[0];

    const url = `/${targetPrefix.replace('.', '')}/${filename}`
    const summary = summaryJson[url] as string;
    if (!summary) {
      const summary = await getSummary(content);
      if (summary.isOk()) {
        summaryJson[url] = summary.unwrap();

      }
    }

    return {
      filename,
      // @ts-expect-error
      ...file.data.matter,
      readingTime: readingTime(file.toString()),
      url,
      toc: file.data.toc,
      summary,
      content: file.toString(),
      // @ts-expect-error
      title: file?.data?.matter.title ?? '',
    };
  })) as PostInfo[];

  await fs.writeFile(aiBogsSummaryJsonPath, JSON.stringify(summaryJson))

  const readyPosts = parsedContent
    .filter(post => post.status !== 'WIP');
  readyPosts.sort((a, b) => new Date(a.time).getSeconds() - new Date(b.time).getSeconds())
  return JSON.stringify(readyPosts);
}