import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import * as editorApi from "../src/hooks/editor-api";
import * as workspaceApi from "../src/hooks/workspace-api";
import * as workspaceTurnLifecycle from "../src/hooks/workspace-turn-lifecycle";
import { useEditorStore } from "../src/stores/editor-store";
import { useWorkspaceStore } from "../src/stores/workspace-store";

const mockedInvoke = vi.mocked(invoke);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function openDocument(path: string, content: string, isDirty = true) {
  return {
    instanceId: 1,
    path,
    frontmatter: null,
    content,
    title: "",
    titleSource: "none" as const,
    diskContent: isDirty ? "before" : content,
    isDirty,
    isLoading: false,
    saveError: null,
    reloadVersion: 0,
    scrollPos: 0,
    cursorPos: 0,
    displayDate: null,
    stats: { words: 0, characters: 0, paragraphs: 0 },
  };
}

describe("Workspace Turn Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      openFiles: new Map(),
      tabs: [],
      activeTabId: null,
      activeFilePath: null,
    });
    useWorkspaceStore.setState({
      root: "/workspace",
      generation: 1,
      readOnlyLease: null,
      directoryCache: new Map(),
      expandedDirs: new Set(),
    });
  });

  test("exposes a public Workspace Document flush contract", () => {
    expect(
      (editorApi as typeof editorApi & { flushWorkspaceDocuments?: unknown })
        .flushWorkspaceDocuments,
    ).toBeTypeOf("function");
  });

  test("reports every failed Workspace Document flush by path", async () => {
    useEditorStore.setState({
      openFiles: new Map([
        ["/workspace/a.md", openDocument("/workspace/a.md", "saved")],
        ["/workspace/b.md", openDocument("/workspace/b.md", "failed")],
      ]),
    });
    mockedInvoke.mockImplementation(async (command, payload) => {
      if (command !== "write_file") return null;
      const { path } = payload as { path: string };
      if (path === "/workspace/b.md") throw new Error("disk full");
      return { path, modified_at: 2 };
    });

    await expect(editorApi.flushWorkspaceDocuments("/workspace")).rejects.toMatchObject({
      name: "WorkspaceDocumentFlushError",
      failures: [{ path: "/workspace/b.md", message: "disk full" }],
    });

    const writtenPaths = mockedInvoke.mock.calls
      .filter(([command]) => command === "write_file")
      .map(([, payload]) => (payload as { path: string }).path);
    expect(writtenPaths).toEqual(["/workspace/a.md", "/workspace/b.md"]);
  });

  test("flushes only Documents associated with the exact canonical Workspace", async () => {
    useEditorStore.setState({
      openFiles: new Map([
        ["/workspace/a.md", openDocument("/workspace/a.md", "inside")],
        ["/workspace-copy/b.md", openDocument("/workspace-copy/b.md", "outside")],
      ]),
    });
    mockedInvoke.mockImplementation(async (command, payload) => {
      if (command !== "write_file") return null;
      return { path: (payload as { path: string }).path, modified_at: 2 };
    });

    await (
      editorApi.flushWorkspaceDocuments as unknown as (workspaceRoot: string) => Promise<void>
    )("/workspace");

    const writtenPaths = mockedInvoke.mock.calls
      .filter(([command]) => command === "write_file")
      .map(([, payload]) => (payload as { path: string }).path);
    expect(writtenPaths).toEqual(["/workspace/a.md"]);
    expect(editorApi.getOpenFile("/workspace-copy/b.md")?.isDirty).toBe(true);
  });

  test("exposes lease-scoped Workspace read-only control", () => {
    const publicApi = editorApi as typeof editorApi & {
      acquireWorkspaceReadOnly?: unknown;
      releaseWorkspaceReadOnly?: unknown;
      isWorkspaceReadOnly?: unknown;
    };
    expect(publicApi.acquireWorkspaceReadOnly).toBeTypeOf("function");
    expect(publicApi.releaseWorkspaceReadOnly).toBeTypeOf("function");
    expect(publicApi.isWorkspaceReadOnly).toBeTypeOf("function");
  });

  test("rejects Document mutations while leased and restores editing for the owning lease", () => {
    useEditorStore.setState({
      openFiles: new Map([["/workspace/a.md", openDocument("/workspace/a.md", "before", false)]]),
    });

    const lease = editorApi.acquireWorkspaceReadOnly("/workspace");
    expect(editorApi.isWorkspaceReadOnly()).toBe(true);

    editorApi.updateContent("/workspace/a.md", "blocked body");
    editorApi.updateFrontmatter("/workspace/a.md", "title: blocked");
    expect(editorApi.getOpenFile("/workspace/a.md")).toMatchObject({
      content: "before",
      frontmatter: null,
      isDirty: false,
    });

    expect(editorApi.releaseWorkspaceReadOnly(lease)).toBe(true);
    expect(editorApi.isWorkspaceReadOnly()).toBe(false);
    editorApi.updateContent("/workspace/a.md", "after");
    editorApi.updateFrontmatter("/workspace/a.md", "title: allowed");
    expect(editorApi.getOpenFile("/workspace/a.md")).toMatchObject({
      content: "after",
      frontmatter: "title: allowed",
      isDirty: true,
    });

    expect(editorApi.releaseWorkspaceReadOnly(lease)).toBe(false);
  });

  test("exposes an explicit Workspace reconciliation contract", () => {
    expect(
      (workspaceApi as typeof workspaceApi & { reconcileWorkspace?: unknown }).reconcileWorkspace,
    ).toBeTypeOf("function");
  });

  test("explicitly rescans the Workspace and reloads open Documents without watcher delivery", async () => {
    useEditorStore.setState({
      openFiles: new Map([["/workspace/a.md", openDocument("/workspace/a.md", "before", false)]]),
    });
    useWorkspaceStore.setState({
      directoryCache: new Map([
        ["/workspace", []],
        ["/workspace/stale", []],
      ]),
    });
    mockedInvoke.mockImplementation(async (command) => {
      if (command === "index_workspace") return { file_count: 2, duration_ms: 1 };
      if (command === "read_directory") {
        return [{ name: "a.md", path: "/workspace/a.md", is_dir: false }];
      }
      if (command === "read_file") {
        return { path: "/workspace/a.md", content: "after", modified_at: 2 };
      }
      return null;
    });
    const lease = editorApi.acquireWorkspaceReadOnly("/workspace");

    await expect(workspaceApi.reconcileWorkspace(lease)).resolves.toEqual({
      status: "completed",
      fileCount: 2,
      failures: [],
    });
    expect(editorApi.getOpenFile("/workspace/a.md")).toMatchObject({
      content: "after",
      diskContent: "after",
      isDirty: false,
      reloadVersion: 1,
    });
    const calls = mockedInvoke.mock.calls;
    expect(calls[0]?.[0]).toBe("index_workspace");
    expect(
      calls
        .filter(([command]) => command === "read_directory")
        .map(([, payload]) => (payload as { path: string }).path),
    ).toEqual(["/workspace", "/workspace/stale"]);
    expect(calls.some(([command]) => command === "read_file")).toBe(true);
  });

  test("applies successful reloads, removes confirmed deletions, and reports other read failures", async () => {
    useEditorStore.setState({
      openFiles: new Map([
        ["/workspace/a.md", openDocument("/workspace/a.md", "before a", false)],
        ["/workspace/b.md", openDocument("/workspace/b.md", "before b", false)],
        ["/workspace/c.md", openDocument("/workspace/c.md", "before c", false)],
      ]),
    });
    mockedInvoke.mockImplementation(async (command, payload) => {
      if (command === "index_workspace") return { file_count: 2, duration_ms: 1 };
      if (command === "read_directory") return [];
      if (command === "read_file") {
        const { path } = payload as { path: string };
        if (path === "/workspace/a.md") {
          return { path, content: "after a", modified_at: 2 };
        }
        if (path === "/workspace/b.md") throw new Error("Not found: /workspace/b.md");
        throw new Error("permission denied");
      }
      if (command === "file_exists") {
        return (payload as { path: string }).path !== "/workspace/b.md";
      }
      return null;
    });
    const lease = editorApi.acquireWorkspaceReadOnly("/workspace");

    await expect(workspaceApi.reconcileWorkspace(lease)).resolves.toEqual({
      status: "completed-with-errors",
      fileCount: 2,
      failures: [
        {
          phase: "document",
          path: "/workspace/c.md",
          message: "permission denied",
        },
      ],
    });
    expect(editorApi.getOpenFile("/workspace/a.md")?.content).toBe("after a");
    expect(editorApi.getOpenFile("/workspace/b.md")).toBeNull();
    expect(editorApi.getOpenFile("/workspace/c.md")?.content).toBe("before c");
  });

  test("does not reconcile a stale read into a Document reopened at the same path", async () => {
    const staleRead = deferred<{ path: string; content: string; modified_at: number }>();
    const reconciliationReadStarted = deferred<void>();
    let readCount = 0;
    mockedInvoke.mockImplementation((command, payload) => {
      if (command === "index_workspace") {
        return Promise.resolve({ file_count: 1, duration_ms: 1 });
      }
      if (command === "read_directory") return Promise.resolve([]);
      if (command === "read_file") {
        readCount += 1;
        const path = (payload as { path: string }).path;
        if (readCount === 1) {
          return Promise.resolve({ path, content: "original", modified_at: 1 });
        }
        if (readCount === 2) {
          reconciliationReadStarted.resolve();
          return staleRead.promise;
        }
        return Promise.resolve({ path, content: "reopened", modified_at: 3 });
      }
      return Promise.resolve(null);
    });

    await editorApi.openFile("/workspace/a.md");
    const lease = editorApi.acquireWorkspaceReadOnly("/workspace");
    const reconciling = workspaceApi.reconcileWorkspace(lease);
    await reconciliationReadStarted.promise;

    editorApi.closeFile("/workspace/a.md");
    await editorApi.openFile("/workspace/a.md");
    staleRead.resolve({ path: "/workspace/a.md", content: "stale", modified_at: 2 });

    await reconciling;
    expect(editorApi.getOpenFile("/workspace/a.md")).toMatchObject({
      content: "reopened",
      diskContent: "reopened",
      reloadVersion: 0,
    });
  });

  test("exposes one reusable Workspace Turn Lifecycle seam", () => {
    expect(workspaceTurnLifecycle.prepareWorkspaceTurn).toBeTypeOf("function");
    expect(workspaceTurnLifecycle.reconcileWorkspaceTurn).toBeTypeOf("function");
  });

  test("locks before flushing, rejects overlap, and unlocks after successful reconciliation", async () => {
    const write = deferred<{ path: string; modified_at: number }>();
    useEditorStore.setState({
      openFiles: new Map([["/workspace/a.md", openDocument("/workspace/a.md", "latest")]]),
    });
    mockedInvoke.mockImplementation((command, payload) => {
      if (command === "write_file") return write.promise;
      if (command === "index_workspace") {
        return Promise.resolve({ file_count: 1, duration_ms: 1 });
      }
      if (command === "read_directory") return Promise.resolve([]);
      if (command === "read_file") {
        const path = (payload as { path: string }).path;
        return Promise.resolve({ path, content: "from runtime", modified_at: 3 });
      }
      return Promise.resolve(null);
    });

    const preparing = workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace");
    expect(editorApi.isWorkspaceReadOnly()).toBe(true);
    await expect(workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace")).rejects.toThrow(
      "already read-only",
    );

    write.resolve({ path: "/workspace/a.md", modified_at: 2 });
    const lease = await preparing;
    expect(editorApi.getOpenFile("/workspace/a.md")?.isDirty).toBe(false);
    expect(editorApi.isWorkspaceReadOnly(lease)).toBe(true);

    await expect(workspaceTurnLifecycle.reconcileWorkspaceTurn(lease)).resolves.toMatchObject({
      status: "completed",
      failures: [],
    });
    expect(editorApi.getOpenFile("/workspace/a.md")?.content).toBe("from runtime");
    expect(editorApi.isWorkspaceReadOnly()).toBe(false);
  });

  test("surfaces save failure and rolls back its transient read-only lease", async () => {
    useEditorStore.setState({
      openFiles: new Map([["/workspace/a.md", openDocument("/workspace/a.md", "latest")]]),
    });
    mockedInvoke.mockRejectedValue(new Error("disk full"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace")).rejects.toMatchObject({
      name: "WorkspaceDocumentFlushError",
      failures: [{ path: "/workspace/a.md", message: "disk full" }],
    });
    expect(editorApi.isWorkspaceReadOnly()).toBe(false);
    consoleError.mockRestore();
  });

  test("surfaces a blocking reconciliation outcome before guaranteed unlock", async () => {
    mockedInvoke.mockImplementation(async (command) => {
      if (command === "index_workspace") throw new Error("rescan failed");
      return null;
    });
    const lease = await workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace");

    await expect(workspaceTurnLifecycle.reconcileWorkspaceTurn(lease)).resolves.toEqual({
      status: "failed",
      failures: [{ phase: "index", message: "rescan failed" }],
    });
    expect(editorApi.isWorkspaceReadOnly()).toBe(false);
  });

  test("a stale reconciliation cannot apply or unlock a reopened same-root Workspace", async () => {
    const index = deferred<{ file_count: number; duration_ms: number }>();
    mockedInvoke.mockImplementation((command) => {
      if (command === "index_workspace") return index.promise;
      return Promise.resolve(null);
    });
    const oldLease = await workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace");
    const reconciling = workspaceTurnLifecycle.reconcileWorkspaceTurn(oldLease);

    useWorkspaceStore.setState({
      root: "/workspace",
      generation: 2,
      readOnlyLease: null,
    });
    const currentLease = editorApi.acquireWorkspaceReadOnly("/workspace");
    index.resolve({ file_count: 1, duration_ms: 1 });

    await expect(reconciling).resolves.toEqual({
      status: "stale-workspace",
      failures: [],
    });
    expect(editorApi.isWorkspaceReadOnly(currentLease)).toBe(true);
    expect(editorApi.releaseWorkspaceReadOnly(currentLease)).toBe(true);
  });

  test("a failed stale rescan reports staleness and preserves the current lease", async () => {
    const index = deferred<{ file_count: number; duration_ms: number }>();
    mockedInvoke.mockImplementation((command) => {
      if (command === "index_workspace") return index.promise;
      return Promise.resolve(null);
    });
    const oldLease = await workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace");
    const reconciling = workspaceTurnLifecycle.reconcileWorkspaceTurn(oldLease);

    useWorkspaceStore.setState({
      root: "/workspace",
      generation: 2,
      readOnlyLease: null,
    });
    const currentLease = editorApi.acquireWorkspaceReadOnly("/workspace");
    index.reject(new Error("obsolete rescan failed"));

    await expect(reconciling).resolves.toEqual({
      status: "stale-workspace",
      failures: [],
    });
    expect(editorApi.isWorkspaceReadOnly(currentLease)).toBe(true);
    expect(editorApi.releaseWorkspaceReadOnly(currentLease)).toBe(true);
  });

  test("a stale preparation cannot acknowledge or unlock a reopened same-root Workspace", async () => {
    const write = deferred<{ path: string; modified_at: number }>();
    useEditorStore.setState({
      openFiles: new Map([["/workspace/a.md", openDocument("/workspace/a.md", "latest")]]),
    });
    mockedInvoke.mockImplementation((command) => {
      if (command === "write_file") return write.promise;
      return Promise.resolve(null);
    });
    const preparing = workspaceTurnLifecycle.prepareWorkspaceTurn("/workspace");

    useWorkspaceStore.setState({
      root: "/workspace",
      generation: 2,
      readOnlyLease: null,
    });
    const currentLease = editorApi.acquireWorkspaceReadOnly("/workspace");
    write.resolve({ path: "/workspace/a.md", modified_at: 2 });

    await expect(preparing).rejects.toThrow("Workspace changed during preparation");
    expect(editorApi.isWorkspaceReadOnly(currentLease)).toBe(true);
    expect(editorApi.releaseWorkspaceReadOnly(currentLease)).toBe(true);
  });
});
