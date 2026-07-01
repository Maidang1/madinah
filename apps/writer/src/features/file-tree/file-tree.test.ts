import { describe, expect, it } from "vitest";
import {
  addFileTreeRoot,
  buildPublishFilePath,
  buildFileTreeRootNodes,
  filterFileTreeDrafts,
  findFileTreeRootForPath,
  flattenVisibleFileTree,
  getActiveFileTreeRoot,
  getArboristOpenState,
  getContextMenuPosition,
  getFileTreeStatus,
  getFileTreeDraftMenuItems,
  getFileTreeMenuItems,
  getPublishTargetLabel,
  pathContains,
  parseFileTreeRoots,
  resolvePublishTarget,
  serializeFileTreeRoots,
  toRelativePath,
  type FileTreeNode,
} from "./file-tree";

describe("file tree view helpers", () => {
  const tree: FileTreeNode[] = [
    {
      kind: "directory",
      name: "docs",
      path: "/workspace/docs",
      childrenCount: 2,
      children: [
        {
          kind: "file",
          name: "intro.md",
          path: "/workspace/docs/intro.md",
          childrenCount: 0,
          children: [],
        },
        {
          kind: "directory",
          name: "nested",
          path: "/workspace/docs/nested",
          childrenCount: 1,
          children: [
            {
              kind: "file",
              name: "deep.mdx",
              path: "/workspace/docs/nested/deep.mdx",
              childrenCount: 0,
              children: [],
            },
          ],
        },
      ],
    },
    {
      kind: "file",
      name: "readme.markdown",
      path: "/workspace/readme.markdown",
      childrenCount: 0,
      children: [],
    },
  ];

  it("flattens only expanded directory descendants", () => {
    const rows = flattenVisibleFileTree({
      activePath: "/workspace/docs/nested/deep.mdx",
      expandedPaths: new Set(["/workspace/docs", "/workspace/docs/nested"]),
      nodes: tree,
    });

    expect(rows.map((row) => [row.depth, row.name, row.isExpanded, row.isActive])).toEqual([
      [0, "docs", true, false],
      [1, "intro.md", false, false],
      [1, "nested", true, false],
      [2, "deep.mdx", false, true],
      [0, "readme.markdown", false, false],
    ]);
  });

  it("keeps context menus inside the viewport", () => {
    expect(
      getContextMenuPosition(
        { clientX: 790, clientY: 590 },
        { width: 220, height: 180 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 572, y: 412 });
  });

  it("returns file and directory menu actions", () => {
    expect(getFileTreeMenuItems(tree[0]).map((item) => item.id)).toEqual([
      "new-file",
      "new-folder",
      "toggle",
      "set-publish-target",
      "copy-relative-path",
      "copy-path",
      "reveal-in-finder",
      "rename",
      "move-to-trash",
    ]);
    expect(getFileTreeMenuItems(tree[0].children[0]).map((item) => item.id)).toEqual([
      "open",
      "duplicate",
      "copy-relative-path",
      "copy-path",
      "reveal-in-finder",
      "rename",
      "move-to-trash",
    ]);
    expect(getFileTreeMenuItems(tree[0].children[0]).map((item) => item.label)).toEqual([
      "Open",
      "Duplicate",
      "Copy relative path",
      "Copy absolute path",
      "Reveal in Finder",
      "Rename...",
      "Delete",
    ]);
  });

  it("builds react-arborist open state from expanded paths", () => {
    expect(
      getArboristOpenState(tree, new Set(["/workspace/docs"])),
    ).toEqual({
      "/workspace/docs": true,
      "/workspace/docs/nested": false,
    });
  });

  it("wraps added folders as visible root groups", () => {
    const nodes = buildFileTreeRootNodes([
      {
        path: "/workspace/blog",
        nodes: [
          {
            kind: "file",
            name: "post.md",
            path: "/workspace/blog/post.md",
            childrenCount: 0,
            children: [],
          },
        ],
      },
      {
        path: "/workspace/notes",
        nodes: [],
      },
    ]);

    expect(nodes.map((node) => [node.name, node.path, node.kind, node.isRoot])).toEqual([
      ["blog", "/workspace/blog", "directory", true],
      ["notes", "/workspace/notes", "directory", true],
    ]);
    expect(nodes[0].children.map((node) => node.name)).toEqual(["post.md"]);
    expect(nodes[1].childrenCount).toBe(0);
  });

  it("deduplicates stored roots and chooses the containing root", () => {
    expect(addFileTreeRoot(["/workspace/blog"], "/workspace/notes")).toEqual([
      "/workspace/blog",
      "/workspace/notes",
    ]);
    expect(addFileTreeRoot(["/workspace/blog"], "/workspace/blog")).toEqual([
      "/workspace/blog",
    ]);
    expect(parseFileTreeRoots(JSON.stringify(["/workspace/blog", "", "/workspace/blog"]))).toEqual([
      "/workspace/blog",
    ]);
    expect(parseFileTreeRoots(null, "/legacy/root")).toEqual(["/legacy/root"]);
    expect(serializeFileTreeRoots(["/workspace/blog", "/workspace/notes"])).toBe(
      JSON.stringify(["/workspace/blog", "/workspace/notes"]),
    );
    expect(
      findFileTreeRootForPath(
        ["/workspace", "/workspace/blog"],
        "/workspace/blog/post.md",
      ),
    ).toBe("/workspace/blog");
    expect(getActiveFileTreeRoot(["/workspace/blog", "/workspace/notes"], null)).toBe(
      "/workspace/notes",
    );
  });

  it("summarizes multi-root loading, empty, ready, and failure states", () => {
    expect(getFileTreeStatus([], {}, true)).toBe("Open a folder");
    expect(getFileTreeStatus(["/workspace"], {}, false)).toBe(
      "使用桌面版打开文件夹",
    );
    expect(getFileTreeStatus(["/workspace"], { "/workspace": "Loading" }, true)).toBe(
      "Loading",
    );
    expect(
      getFileTreeStatus(
        ["/workspace/blog", "/workspace/notes"],
        {
          "/workspace/blog": "Ready",
          "/workspace/notes": "No Markdown files",
        },
        true,
      ),
    ).toBe("Ready");
    expect(
      getFileTreeStatus(
        ["/workspace/blog", "/workspace/notes"],
        {
          "/workspace/blog": "Permission denied",
          "/workspace/notes": "No Markdown files",
        },
        true,
      ),
    ).toBe("Permission denied");
  });

  it("shares path containment and relative path helpers", () => {
    expect(pathContains("/workspace/blog", "/workspace/blog/post.md")).toBe(true);
    expect(pathContains("/workspace/blog", "/workspace/blogger/post.md")).toBe(
      false,
    );
    expect(toRelativePath("/workspace/blog", "/workspace/blog/post.md")).toBe(
      "post.md",
    );
    expect(toRelativePath(null, "/workspace/blog/post.md")).toBe(
      "/workspace/blog/post.md",
    );
  });

  it("resolves publish targets from explicit choice, active file, then active root", () => {
    expect(
      resolvePublishTarget({
        explicitTargetPath: "/workspace/src/blogs",
        activePath: "/workspace/notes/current.md",
        activeRoot: "/workspace",
      }),
    ).toMatchObject({
      path: "/workspace/src/blogs",
      label: "blogs",
      extension: "mdx",
    });
    expect(
      resolvePublishTarget({
        activePath: "/workspace/notes/current.md",
        activeRoot: "/workspace",
      })?.path,
    ).toBe("/workspace/notes");
    expect(
      resolvePublishTarget({
        activePath: null,
        activeRoot: "/workspace",
      })?.path,
    ).toBe("/workspace");
    expect(resolvePublishTarget({})).toBeNull();
  });

  it("builds publish file paths with blog-aware extensions", () => {
    expect(
      buildPublishFilePath({
        targetPath: "/workspace/src/blogs",
        slug: "hello-world",
      }),
    ).toBe("/workspace/src/blogs/hello-world.mdx");
    expect(
      buildPublishFilePath({
        targetPath: "/workspace/notes",
        slug: "Hello World",
      }),
    ).toBe("/workspace/notes/hello-world.md");
    expect(getPublishTargetLabel("/workspace/src/blogs")).toBe("blogs");
  });

  it("filters draft entries by title and detail", () => {
    const drafts = [
      { id: "prompt", title: "Prompt 学习笔记", detail: "draft / 今天", status: "draft" },
      { id: "async", title: "Async Notes", detail: "WIP / 昨天", status: "WIP" },
    ];

    expect(filterFileTreeDrafts(drafts, "prompt").map((draft) => draft.id)).toEqual([
      "prompt",
    ]);
    expect(filterFileTreeDrafts(drafts, "昨天").map((draft) => draft.id)).toEqual([
      "async",
    ]);
    expect(filterFileTreeDrafts(drafts, "").map((draft) => draft.id)).toEqual([
      "prompt",
      "async",
    ]);
  });

  it("returns draft context menu actions for publishing and deletion", () => {
    expect(
      getFileTreeDraftMenuItems({
        id: "prompt",
        title: "Prompt",
        detail: "draft / 今天",
        status: "draft",
      }, "blogs").map((item) => [item.id, item.label]),
    ).toEqual([
      ["open", "Open"],
      ["publish", "Publish to blogs"],
      ["archive", "Archive"],
      ["delete", "Delete"],
    ]);

    expect(
      getFileTreeDraftMenuItems({
        id: "published",
        title: "Published",
        detail: "published / 今天",
        status: "published",
      }).map((item) => item.id),
    ).toEqual(["open", "mark-wip", "archive", "delete"]);
  });
});
