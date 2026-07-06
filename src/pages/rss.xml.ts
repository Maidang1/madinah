import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPostBody, getPublishedPosts } from "../utils/posts";

export async function GET(context: APIContext) {
  const publishedPosts = (await getPublishedPosts()).slice(0, 10);

  return rss({
    title: "Madinah",
    description: "A blog about programming, technology, and life.",
    site: context.site || "https://madinah.felixwliu.cn",
    items: publishedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description || "",
      link: `/blog/${post.id}/`,
      content: getPostBody(post),
    })),
    customData: `<language>en-us</language>`,
  });
}
