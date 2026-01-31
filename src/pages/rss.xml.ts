import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = await getCollection("blog");

  // Filter WIP posts and sort by date
  const publishedPosts = posts
    .filter((post) => post.data.status !== "WIP")
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, 10);

  return rss({
    title: "Madinah",
    description: "A blog about programming, technology, and life.",
    site: context.site || "https://madinah.felixwliu.cn",
    items: publishedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description || "",
      link: `/blog/${post.id}/`,
      content: post.body,
    })),
    customData: `<language>en-us</language>`,
  });
}
