import { PostInfo } from "~/types";

const FEED_URL = "https://madinah.felixwliu.cn/rss.xml";
const SITE_URL = "https://madinah.felixwliu.cn";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapCdata(value: string) {
  const safeValue = value.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safeValue}]]>`;
}

export function generateRssFeed(posts: PostInfo[]) {
  const items = posts
    .map((post) => {
      const title = escapeXml(post.title ?? "");
      const url = `${SITE_URL}${post.url}`;
      const description = wrapCdata(`${post.summary ?? ""}${post.content ?? ""}`);
      const dateValue =
        post.date || post.time || post.gitInfo?.updatedAt || Date.now();
      const date = new Date(dateValue);
      const pubDate = Number.isNaN(date.getTime())
        ? new Date().toUTCString()
        : date.toUTCString();

      return [
        "<item>",
        `<title>${title}</title>`,
        `<link>${url}</link>`,
        `<guid>${url}</guid>`,
        `<pubDate>${pubDate}</pubDate>`,
        `<description>${description}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    "<title>Madinah</title>",
    "<description>A blog about programming, technology, and life. feedId:71423989551395840+userId:41703785056535552</description>",
    "<language>en</language>",
    "<copyright>All rights reserved 2024, Madinah</copyright>",
    "<generator>madinah</generator>",
    `<link>${SITE_URL}</link>`,
    `<atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />`,
    items,
    "</channel>",
    "</rss>",
  ].join("");
}
