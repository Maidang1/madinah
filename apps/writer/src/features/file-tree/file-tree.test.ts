import { describe, expect, it } from "vitest";
import {
  flattenVisibleFileTree,
  getArboristOpenState,
  getContextMenuPosition,
  getFileTreeMenuItems,
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
      "rename",
      "reveal-in-finder",
      "copy-path",
      "copy-relative-path",
      "move-to-trash",
    ]);
    expect(getFileTreeMenuItems(tree[0].children[0]).map((item) => item.id)).toEqual([
      "open",
      "rename",
      "duplicate",
      "save-as",
      "reveal-in-finder",
      "copy-path",
      "copy-relative-path",
      "move-to-trash",
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
});
