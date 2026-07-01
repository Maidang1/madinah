import { describe, expect, it, vi } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import type {
  DocumentStore,
  FileStore,
  RecentStore,
  WindowAdapter,
} from "../../platform/ports";
import {
  confirmPublishOverwrite,
  publishStoredDocumentToFile,
} from "./publish-document";

describe("publishStoredDocumentToFile", () => {
  it("publishes the active local draft without re-reading it from storage", async () => {
    const activeDocument = documentFixture({
      id: "doc-active",
      body: "# Active dirty draft",
      slug: "active-draft",
      status: "draft",
    });
    const documentStore = createDocumentStore();
    const fileStore = createFileStore();
    const recentStore = createRecentStore();

    const result = await publishStoredDocumentToFile({
      id: activeDocument.id,
      targetPath: "/workspace/blogs/active-draft.mdx",
      activeDocument,
      activeFilePath: null,
      documentStore,
      fileStore,
      recentStore,
      now: () => "2026-06-30T10:00:00.000Z",
    });

    expect(documentStore.get).not.toHaveBeenCalled();
    expect(fileStore.writeMarkdownFile).toHaveBeenCalledWith(
      "/workspace/blogs/active-draft.mdx",
      expect.stringContaining("status: published"),
    );
    expect(fileStore.writeMarkdownFile).toHaveBeenCalledWith(
      "/workspace/blogs/active-draft.mdx",
      expect.stringContaining("# Active dirty draft"),
    );
    expect(documentStore.delete).toHaveBeenCalledWith("doc-active");
    expect(recentStore.add).toHaveBeenCalledWith(
      "/workspace/blogs/active-draft.mdx",
    );
    expect(result).toMatchObject({
      filePath: "/workspace/blogs/active-draft.mdx",
      document: {
        id: "doc-active",
        status: "published",
        updatedAt: "2026-06-30T10:00:00.000Z",
      },
    });
  });

  it("loads an inactive local draft before publishing it", async () => {
    const inactiveDocument = documentFixture({
      id: "doc-inactive",
      body: "# Inactive draft",
      slug: "inactive-draft",
      status: "WIP",
    });
    const documentStore = createDocumentStore(inactiveDocument);
    const fileStore = createFileStore();
    const recentStore = createRecentStore();

    const result = await publishStoredDocumentToFile({
      id: inactiveDocument.id,
      targetPath: "/workspace/notes/inactive-draft.md",
      activeDocument: documentFixture({ id: "doc-active" }),
      activeFilePath: null,
      documentStore,
      fileStore,
      recentStore,
      now: () => "2026-06-30T11:00:00.000Z",
    });

    expect(documentStore.get).toHaveBeenCalledWith("doc-inactive");
    expect(fileStore.writeMarkdownFile).toHaveBeenCalledWith(
      "/workspace/notes/inactive-draft.md",
      expect.stringContaining("# Inactive draft"),
    );
    expect(documentStore.delete).toHaveBeenCalledWith("doc-inactive");
    expect(result.document.status).toBe("published");
  });
});

describe("confirmPublishOverwrite", () => {
  it("asks before overwriting an existing publish path", async () => {
    const fileStore = createFileStore({
      readMarkdownFile: vi.fn(async (path) => ({ path, source: "# Existing" })),
    });
    const windowAdapter = createWindowAdapter({
      confirm: vi.fn(async () => false),
    });

    await expect(
      confirmPublishOverwrite({
        targetPath: "/workspace/blogs/post.mdx",
        fileStore,
        windowAdapter,
      }),
    ).resolves.toBe(false);
    expect(windowAdapter.confirm).toHaveBeenCalledWith(
      "post.mdx already exists. Overwrite it?",
      { title: "Publish draft" },
    );
  });

  it("allows writing when the publish path does not exist", async () => {
    const fileStore = createFileStore({
      readMarkdownFile: vi.fn(async () => {
        throw new Error("not found");
      }),
    });
    const windowAdapter = createWindowAdapter();

    await expect(
      confirmPublishOverwrite({
        targetPath: "/workspace/blogs/post.mdx",
        fileStore,
        windowAdapter,
      }),
    ).resolves.toBe(true);
    expect(windowAdapter.confirm).not.toHaveBeenCalled();
  });
});

function documentFixture(
  patch: Partial<MarkdownDocument> = {},
): MarkdownDocument {
  return {
    id: "doc-1",
    slug: "draft",
    title: "Draft",
    description: "",
    author: "Madinah",
    tags: [],
    status: "draft",
    pubDate: "2026-06-30",
    body: "# Draft",
    createdAt: "2026-06-30T09:00:00.000Z",
    updatedAt: "2026-06-30T09:00:00.000Z",
    ...patch,
  };
}

function createDocumentStore(document?: MarkdownDocument): DocumentStore {
  return {
    list: vi.fn(async () => (document ? [document] : [])),
    get: vi.fn(async (id) => {
      if (!document || document.id !== id) {
        throw new Error(`Document ${id} not found`);
      }
      return document;
    }),
    save: vi.fn(async (nextDocument) => nextDocument),
    delete: vi.fn(async () => {}),
  };
}

function createFileStore(patch: Partial<FileStore> = {}): FileStore {
  return {
    readMarkdownFile: vi.fn(async (path) => ({ path, source: "" })),
    writeMarkdownFile: vi.fn(async (path, source) => ({ path, source })),
    ...patch,
  };
}

function createRecentStore(): RecentStore {
  return {
    list: vi.fn(async () => []),
    add: vi.fn(async () => {}),
  };
}

function createWindowAdapter(patch: Partial<WindowAdapter> = {}): WindowAdapter {
  return {
    confirm: vi.fn(async () => true),
    openDirectory: vi.fn(async () => null),
    openMarkdownFile: vi.fn(async () => null),
    saveMarkdownFile: vi.fn(async () => null),
    showContextMenu: vi.fn(async () => null),
    ...patch,
  };
}
