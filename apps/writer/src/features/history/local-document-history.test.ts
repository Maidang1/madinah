import { describe, expect, it } from "vitest";
import type { DocumentVersion } from "./document-history";
import { createLocalDocumentHistoryStore } from "./local-document-history";

describe("local document history store", () => {
  it("stores and lists versions by target id", () => {
    const storage = createMemoryStorage();
    const store = createLocalDocumentHistoryStore(storage);
    const first = versionFixture({ id: "doc-1:v1", targetId: "doc-1" });
    const second = versionFixture({ id: "doc-2:v1", targetId: "doc-2" });

    store.save(first);
    store.save(second);

    expect(store.list("doc-1")).toEqual([first]);
  });

  it("replaces adjacent duplicate snapshots for the same target", () => {
    const storage = createMemoryStorage();
    const store = createLocalDocumentHistoryStore(storage);
    const first = versionFixture({ id: "doc-1:v1", targetId: "doc-1" });
    const duplicate = versionFixture({
      id: "doc-1:v2",
      targetId: "doc-1",
      createdAt: "2026-06-28T10:05:00.000Z",
    });

    store.save(first);
    store.save(duplicate);

    expect(store.list("doc-1")).toEqual([first]);
  });

  it("clears one target without touching other version history", () => {
    const storage = createMemoryStorage();
    const store = createLocalDocumentHistoryStore(storage);
    const first = versionFixture({ id: "doc-1:v1", targetId: "doc-1" });
    const second = versionFixture({ id: "doc-2:v1", targetId: "doc-2" });

    store.save(first);
    store.save(second);
    store.clear("doc-1");

    expect(store.list("doc-1")).toEqual([]);
    expect(store.list("doc-2")).toEqual([second]);
  });
});

function versionFixture(
  overrides: Partial<DocumentVersion> = {},
): DocumentVersion {
  return {
    id: "doc-1:v1",
    targetId: "doc-1",
    title: "Document",
    description: "",
    author: "Madinah",
    tags: [],
    status: "draft",
    pubDate: "2026-06-27 10:00:00",
    body: "# Document",
    reason: "Manual snapshot",
    createdAt: "2026-06-28T10:00:00.000Z",
    ...overrides,
  };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
