/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import fs from 'fs/promises'
import path from 'path'
import { unified } from "unified"
import remarkParse from 'remark-parse'
import remarkFrontmatter from "remark-frontmatter"
import remarkStringify from "remark-stringify"
import remarkHTML from "remark-html"
import { matter } from 'vfile-matter'
import readingTime from 'reading-time'
import remarkMdx from "remark-mdx"
import { PostInfo } from '~/types'
import { toc } from 'mdast-util-toc'
import { extractTocItems } from './toc'
import { getFileGitHistory, loadGitConfig } from './git'

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

  // Load Git configuration once at the start
  const gitConfig = loadGitConfig()

  const filteredPosts = allFiles.filter(
    (fileName) =>
      fileName.endsWith('.mdx') &&
      normalizedPrefix.some((prefix) => fileName.startsWith(prefix)),
  )
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
    const htmlContent = await unified().use(remarkParse).use(remarkHTML).process(processedFile.toString())

    // Extract Git history for this blog post file
    let gitInfo = null
    try {
      gitInfo = getFileGitHistory(fullPath, gitConfig)
    } catch (error) {
      console.warn(`Failed to extract Git history for ${fullPath}:`, error)
      // Continue build process even if Git extraction fails
    }

    // Determine publication date: Git creation time > frontmatter time/date
    // @ts-expect-error
    const frontmatterTime = processedFile.data.matter?.time || processedFile.data.matter?.date
    const publicationDate = gitInfo?.createdAt || frontmatterTime

    return {
      filename: baseName,
      // @ts-expect-error
      ...processedFile.data.matter,
      readingTime: readingTime(processedFile.toString()),
      url: postUrl,
      toc: processedFile.data.toc,
      content: htmlContent.toString(),
      // @ts-expect-error
      title: processedFile?.data?.matter.title ?? '',
      time: publicationDate, // Use Git creation time or fall back to frontmatter
      date: publicationDate, // For backward compatibility
      gitInfo, // Add Git-derived metadata
    }
  })) as PostInfo[]


  const publishedPosts = postMetadataList.filter(post => post.status !== 'WIP')

  // Sort by Git update time if available, otherwise use publication date
  publishedPosts.sort((a, b) => {
    const aDate = new Date(a.gitInfo?.updatedAt || a.time)
    const bDate = new Date(b.gitInfo?.updatedAt || b.time)
    return bDate.getTime() - aDate.getTime()
  })

  return JSON.stringify(publishedPosts)
}
