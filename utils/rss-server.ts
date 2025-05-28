/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Rss from "rss";

export function generateRssFeed(posts: any[]) {
  const feed = new Rss.default({
    title: "Madinah",
    description: "A blog about programming, technology, and life. feedId:71423989551395840+userId:41703785056535552",
    language: "en",
    copyright: "All rights reserved 2024, Madinah",
    generator: "madinah",
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