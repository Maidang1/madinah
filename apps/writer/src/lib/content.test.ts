import { describe, expect, it } from "vitest";
import {
  createDocumentId,
  createSlug,
  parseMdxDocument,
  serializeMdxDocument,
} from "./content";

describe("content model", () => {
  it("parses blog frontmatter into a writer document", () => {
    const source = `---
title: Rust 异步编程
author: Madinah
description: Rust 异步编程学习笔记
tags:
  - rust
  - async
pubDate: 2024-10-20 22:48:00
status: draft
---

# Future

正文`;

    const doc = parseMdxDocument(source, {
      id: "doc-1",
      slug: "async-rust",
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z",
    });

    expect(doc).toMatchObject({
      id: "doc-1",
      slug: "async-rust",
      title: "Rust 异步编程",
      author: "Madinah",
      description: "Rust 异步编程学习笔记",
      tags: ["rust", "async"],
      status: "draft",
      pubDate: "2024-10-20 22:48:00",
      body: "# Future\n\n正文",
    });
  });

  it("serializes a writer document back to publishable MDX", () => {
    const source = serializeMdxDocument({
      id: "doc-1",
      slug: "async-rust",
      title: "Rust 异步编程",
      description: "Rust 异步编程学习笔记",
      author: "Madinah",
      tags: ["rust", "async"],
      status: "published",
      pubDate: "2024-10-20 22:48:00",
      body: "# Future\n\n正文",
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z",
    });

    expect(source).toContain("title: Rust 异步编程");
    expect(source).toContain("description: Rust 异步编程学习笔记");
    expect(source).toContain("pubDate: 2024-10-20 22:48:00");
    expect(source).toContain("status: published");
    expect(source).toContain("# Future\n\n正文");
  });

  it("creates readable filesystem slugs", () => {
    expect(createSlug("Mini Kode: Coding Agent 学习记录!")).toBe(
      "mini-kode-coding-agent-学习记录",
    );
    expect(createSlug("   ")).toBe("untitled");
  });

  it("creates stable unique document ids", () => {
    expect(createDocumentId("hello-world")).toMatch(/^doc-hello-world-[a-z0-9]+$/);
  });
});
