/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import fs from 'fs/promises'
import path from 'path'
import { unified } from "unified"
import remarkParse from 'remark-parse'
import remarkFrontmatter from "remark-frontmatter"
import remarkStringify from "remark-stringify"
import { matter } from 'vfile-matter'
import readingTime from 'reading-time'
import remarkMdx from "remark-mdx"
import { PostInfo } from '~/types'
import { toc } from 'mdast-util-toc'
import { extractTocItems } from './toc'
import { generatePostAiSummary } from "./ollama"

function unifiedPluginMatter() {
  return (_: unknown, vfile: any) => {
    matter(vfile)
  }
}

function unifiedPluginToc() {
  return (syntaxTree: any, vfile: any) => {
    const tocResult = toc(syntaxTree)
    vfile.data.toc = extractTocItems(tocResult.map?.children ?? [])
  }
}

export const generatePostsMetadata = async (postsDirectory: string, filePrefix: string | string[]) => {
  const allFiles = await fs.readdir(postsDirectory, { encoding: "utf-8" })
  const normalizedPrefix = Array.isArray(filePrefix) ? filePrefix : [filePrefix]

  const summaryFilePath = path.join(process.cwd(), 'app/summary/blogs-summary.json')
  const existingSummaries = (JSON.parse(await fs.readFile(summaryFilePath, { encoding: "utf8" })) ?? {}) as Record<string, string>

  const filteredPosts = allFiles.filter(fileName => normalizedPrefix.some(prefix => fileName.startsWith(prefix)))
  const postMetadataList = await Promise.all(filteredPosts.map(async fileName => {
    const fullPath = path.join(postsDirectory, fileName)
    const postContent = await fs.readFile(fullPath, "utf8")

    const processedFile = await unified()
      .use(remarkMdx)
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkFrontmatter)
      .use(unifiedPluginMatter)
      .use(unifiedPluginToc)
      .process(postContent)

    const matchedPrefix = normalizedPrefix.find(prefix => fileName.startsWith(prefix)) ?? ''
    const baseName = fileName.replace(matchedPrefix, '').split(".")[0]

    const postUrl = `/${matchedPrefix.replace('.', '')}/${baseName}`
    let postSummary = existingSummaries[postUrl] as string

    if (!postSummary) {
      const summaryResult = await generatePostAiSummary(postContent)
      if (summaryResult.isOk()) {
        postSummary = summaryResult.unwrap()
        existingSummaries[postUrl] = postSummary
      }
    }

    return {
      filename: baseName,
      // @ts-expect-error
      ...processedFile.data.matter,
      readingTime: readingTime(processedFile.toString()),
      url: postUrl,
      toc: processedFile.data.toc,
      summary: postSummary,
      content: processedFile.toString(),
      // @ts-expect-error
      title: processedFile?.data?.matter.title ?? '',
    }
  })) as PostInfo[]

  await fs.writeFile(summaryFilePath, JSON.stringify(existingSummaries))

  const publishedPosts = postMetadataList.filter(post => post.status !== 'WIP')
  publishedPosts.sort((a, b) => new Date(a.time).getSeconds() - new Date(b.time).getSeconds())
  return JSON.stringify(publishedPosts)
}
