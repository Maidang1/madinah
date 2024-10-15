/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Rss from "rss";

export function generateRssFeed(posts: any[]) {
  const feed = new Rss.default({
    title: "Your Site Title",
    description: "Your Site Description",
    language: "en",
    copyright: "All rights reserved 2024, Madinah",
    generator: "Remix",
    feed_url: "https://madinah.felixwliu.cn/rss.xml",
    site_url: "https://madinah.felixwliu.cn",
  });

  posts.forEach(post => {
    feed.item({
      title: post.title,
      description: post.summary,
      date: new Date(post.date),
      url: `https://madinah.felixwliu.cn${post.url}`,
    });
  });

  return feed.xml();
}