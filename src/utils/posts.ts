import { getCollection } from "astro:content";
import { calculateReadingTime, isPublishedBlogPostStatus } from "@madinah/content-core";

export function getPostBody(post: { body?: string | null }) {
  return post.body ?? "";
}

export async function getAllPosts() {
  const posts = await getCollection("blog");
  return posts
    .map((p) => ({ ...p, readingTime: calculateReadingTime(getPostBody(p)) }))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getPublishedPosts() {
  const posts = await getAllPosts();
  return posts.filter((post) => isPublishedBlogPostStatus(post.data.status));
}
