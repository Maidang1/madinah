import type { ReadTimeResults } from "reading-time"

export interface PostInfo {
  title: string,
  tags: string[]
  summary: string
  time: string,
  readingTime: ReadTimeResults,
  filename: string
  url: string
}