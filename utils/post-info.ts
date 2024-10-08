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

function myUnifiedPluginHandlingYamlMatter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_: unknown, file: any) => {
    matter(file)
  }
}

export const getListInfo = async (listPath: string, prefix: string) => {
  const result = await fs.readdir(listPath, { encoding: "utf-8" })
  console.log({ result })
  const formatList = result.filter(list => list.startsWith(prefix))
  const parsedContent = await Promise.all(formatList.map(async list => {
    const fullPath = path.join(listPath, list);
    const content = await fs.readFile(fullPath, "utf8");
    const file = await unified()
      .use(remarkMdx)
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkFrontmatter)
      .use(myUnifiedPluginHandlingYamlMatter)
      .process(content);
    const filename = list.replace(prefix, '').split(".")[0];
    return {
      filename,
      // @ts-expect-error
      ...file.data.matter,
      readingTime: readingTime(file.toString()),
      url: `/blogs/${filename}`
    };
  })) as PostInfo[];

  parsedContent.sort((a, b) => new Date(a.time).getSeconds() - new Date(b.time).getSeconds())
  return JSON.stringify(parsedContent);
}