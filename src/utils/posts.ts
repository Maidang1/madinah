import { getCollection } from "astro:content";
import { calculateReadingTime } from "./reading-time";

export async function getPublishedPosts() {
  const posts = await getCollection("blog");
  return posts
    .filter((p) => p.data.status !== "WIP")
    .map((p) => ({ ...p, readingTime: calculateReadingTime(p.body) }))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
