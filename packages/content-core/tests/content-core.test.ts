import { describe, expect, test } from "vite-plus/test";
import {
  BLOG_POST_STATUS_OPTIONS,
  calculateReadingTime,
  getBlogPostRouteId,
  getBlogPostUrlPath,
  getFrontmatterDisplayDate,
  inferTitle,
  isBlogPostStatus,
  isPublishedBlogPostStatus,
  isSupportedBlogPostPath,
  parseDocument,
  parseFrontmatter,
  serializeDocument,
  serializeFile,
} from "../src";

describe("blog post status", () => {
  test("keeps published as the public post status", () => {
    expect(BLOG_POST_STATUS_OPTIONS).toEqual(["draft", "published", "archived", "WIP"]);
    expect(isPublishedBlogPostStatus("published")).toBe(true);
    expect(isPublishedBlogPostStatus("draft")).toBe(false);
    expect(isBlogPostStatus("archived")).toBe(true);
    expect(isBlogPostStatus("scheduled")).toBe(false);
  });
});

describe("blog file identity", () => {
  test("uses file path as the route identity", () => {
    expect(getBlogPostRouteId("src/blogs/hello-world.mdx")).toBe("hello-world");
    expect(getBlogPostRouteId("/Users/me/project/src/blogs/nested/hello.mdx")).toBe(
      "nested/hello",
    );
    expect(getBlogPostRouteId("notes/hello.md")).toBe("notes/hello");
    expect(getBlogPostUrlPath("hello-world.mdx")).toBe("/blog/hello-world");
  });

  test("recognizes supported markdown file paths", () => {
    expect(isSupportedBlogPostPath("hello.mdx")).toBe(true);
    expect(isSupportedBlogPostPath("nested/hello.md")).toBe(true);
    expect(isSupportedBlogPostPath("hello.txt")).toBe(false);
  });
});

describe("frontmatter parsing", () => {
  test("extracts frontmatter and body", () => {
    const raw = "---\ntitle: Hello\ndate: 2024-01-01\n---\n# Content";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toBe("title: Hello\ndate: 2024-01-01");
    expect(result.body).toBe("# Content");
  });

  test("round-trips an empty frontmatter block", () => {
    const original = "---\n\n---\nBody";
    const { frontmatter, body } = parseFrontmatter(original);
    expect(serializeFile(frontmatter, body)).toBe(original);
  });
});

describe("document metadata", () => {
  test("frontmatter title wins and body is preserved", () => {
    const result = parseDocument("---\ntitle: Hello\ntags: [a]\n---\n\n# Heading\n\nBody");
    expect(result.title).toBe("Hello");
    expect(result.titleSource).toBe("frontmatter");
    expect(result.body).toBe("\n# Heading\n\nBody");
  });

  test("leading H1 becomes title when frontmatter title is absent", () => {
    expect(inferTitle("\n# Project Plan\n\nBody", null)).toEqual({
      title: "Project Plan",
      titleSource: "h1",
    });
  });

  test("serializes the full document", () => {
    expect(serializeDocument("title: Hello", "Body")).toBe("---\ntitle: Hello\n---\nBody");
  });

  test("formats pubDate for display", () => {
    expect(getFrontmatterDisplayDate("pubDate: 2026-07-01")).toContain("2026");
  });
});

describe("reading time", () => {
  test("calculates reading time from markdown content", () => {
    const result = calculateReadingTime("Hello [World](https://example.com) `code`");
    expect(result.words).toBe(2);
    expect(result.minutes).toBe(1);
    expect(result.text).toBe("1 min read");
  });
});
