import {
  useCallback,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type {
  AiDocumentReviewState,
  AiOperationState,
} from "../../domain/ai-polish";
import {
  serializeMdxDocument,
  type DocumentMetadataPatch,
  type MarkdownDocument,
} from "../../domain/document";
import type {
  EngineProfile,
  WriterCommand,
  WriterEditor,
  WorkspaceInfo,
} from "../../domain/engine";
import type { BlogDocumentFile, PlatformAdapters } from "../../platform/ports";
import { createAiCommands } from "../ai-polish/command";
import type { AcpSettings } from "../ai-polish/settings";
import { createFormattingCommands } from "../editor/formatting-commands";
import { CommandRegistry } from "../engine/CommandRegistry";
import { createDocumentCommands } from "../session/document-commands";
import { createWorkbenchCommands } from "../workbench/workbench-commands";
import type { WorkbenchAction } from "../workbench/workbench-state";

interface UseWriterCommandsOptions {
  profile: EngineProfile;
  platform: PlatformAdapters;
  acpSettings: AcpSettings;
  activeEditorRef: RefObject<WriterEditor | null>;
  sessionDocumentRef: RefObject<MarkdownDocument | null>;
  sessionWorkspaceRef: RefObject<WorkspaceInfo | null>;
  setStatus: (status: string) => void;
  changeMetadata: (patch: DocumentMetadataPatch) => void;
  importBlogDocuments: (files: BlogDocumentFile[]) => Promise<MarkdownDocument[]>;
  saveCurrentVersion: (reason?: string) => void;
  setAiOperationState: (state: AiOperationState) => void;
  setAiReviewState: (state: AiDocumentReviewState) => void;
  showAiReview: () => void;
  dispatchWorkbenchState: (action: WorkbenchAction) => void;
  openDocumentSearch: () => void;
  openCommandPalette: () => void;
  openQuickOpen: () => void;
  showWorkspaceDiagnostics: () => void;
  createNewDocument: () => void | Promise<void>;
  openDocument: () => void | Promise<void>;
  revertDocument: () => void | Promise<void>;
  closeDocument: () => void | Promise<void>;
}

export function useWriterCommands({
  profile,
  platform,
  acpSettings,
  activeEditorRef,
  sessionDocumentRef,
  sessionWorkspaceRef,
  setStatus,
  changeMetadata,
  importBlogDocuments,
  saveCurrentVersion,
  setAiOperationState,
  setAiReviewState,
  showAiReview,
  dispatchWorkbenchState,
  openDocumentSearch,
  openCommandPalette,
  openQuickOpen,
  showWorkspaceDiagnostics,
  createNewDocument,
  openDocument,
  revertDocument,
  closeDocument,
}: UseWriterCommandsOptions) {
  const aiCommands = useMemo(
    () =>
      createAiCommands({
        ai: platform.ai,
        settings: acpSettings,
        setStatus,
        setOperationState: setAiOperationState,
        changeMetadata,
        saveVersion: saveCurrentVersion,
        setReviewState: setAiReviewState,
        showReview: showAiReview,
      }),
    [
      acpSettings,
      changeMetadata,
      platform.ai,
      saveCurrentVersion,
      setAiOperationState,
      setAiReviewState,
      setStatus,
      showAiReview,
    ],
  );
  const formattingCommands = useMemo(() => createFormattingCommands(), []);
  const workbenchCommands = useMemo(
    () =>
      createWorkbenchCommands({
        dispatch: dispatchWorkbenchState,
        openDocumentSearch,
        openCommandPalette,
        openQuickOpen,
        showWorkspaceDiagnostics,
      }),
    [
      dispatchWorkbenchState,
      openCommandPalette,
      openDocumentSearch,
      openQuickOpen,
      showWorkspaceDiagnostics,
    ],
  );
  const importBlogDirectoryCommand = useStableCallback(async () => {
    if (!platform.blogStore.isAvailable) {
      setStatus("Blog import requires the desktop app");
      return;
    }

    const blogDir = await platform.windowAdapter.openDirectory({
      title: "Import Blog Directory",
    });
    if (!blogDir) return;

    setStatus("Importing blog");
    const files = await platform.blogStore.importDirectory(blogDir);
    await importBlogDocuments(files);
  });
  const exportCurrentDocumentToBlogCommand = useStableCallback(async () => {
    const document = sessionDocumentRef.current;
    if (!document) {
      setStatus("Open a document before exporting");
      return;
    }
    if (!platform.blogStore.isAvailable) {
      setStatus("Blog export requires the desktop app");
      return;
    }

    const blogDir = await platform.windowAdapter.openDirectory({
      title: "Export to Blog Directory",
    });
    if (!blogDir) return;

    const input = {
      blogDir,
      slug: document.slug || "untitled",
      source: serializeMdxDocument(document),
      overwrite: false,
    };

    try {
      setStatus("Exporting blog");
      const result = await platform.blogStore.exportDocument(input);
      setStatus(`Exported to ${result.path}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("already exists")) {
        setStatus(message);
        return;
      }

      const overwrite = await platform.windowAdapter.confirm(
        `${input.slug}.mdx already exists. Overwrite it?`,
        { title: "Export to Blog" },
      );
      if (!overwrite) {
        setStatus("Export cancelled");
        return;
      }

      const result = await platform.blogStore.exportDocument({
        ...input,
        overwrite: true,
      });
      setStatus(`Exported to ${result.path}`);
    }
  });
  const blogCommands = useMemo<WriterCommand[]>(
    () => [
      {
        id: "blog.importDirectory",
        label: "Import Blog Directory",
        group: "File",
        keywords: ["blog", "mdx", "directory"],
        scope: "file",
        surfaces: ["palette", "menu"],
        priority: 70,
        run: importBlogDirectoryCommand,
      },
      {
        id: "blog.exportDocument",
        label: "Export to Blog",
        group: "File",
        keywords: ["blog", "mdx", "publish"],
        scope: "file",
        surfaces: ["palette", "menu"],
        priority: 68,
        run: exportCurrentDocumentToBlogCommand,
      },
    ],
    [exportCurrentDocumentToBlogCommand, importBlogDirectoryCommand],
  );
  const createNewDocumentCommand = useStableCallback(createNewDocument);
  const openDocumentCommand = useStableCallback(openDocument);
  const revertDocumentCommand = useStableCallback(revertDocument);
  const closeDocumentCommand = useStableCallback(closeDocument);
  const commandRegistry = useMemo(
    () =>
      new CommandRegistry([
        ...(profile.commands ?? []),
        ...formattingCommands,
        ...aiCommands,
        ...blogCommands,
        ...workbenchCommands,
        ...createDocumentCommands({
          newDocument: createNewDocumentCommand,
          open: openDocumentCommand,
          revert: revertDocumentCommand,
          close: closeDocumentCommand,
        }),
      ]),
    [
      aiCommands,
      blogCommands,
      closeDocumentCommand,
      createNewDocumentCommand,
      formattingCommands,
      openDocumentCommand,
      profile.commands,
      revertDocumentCommand,
      workbenchCommands,
    ],
  );
  const runCommand = useCallback(
    (commandId: string) => {
      return commandRegistry
        .execute(commandId, {
          document: sessionDocumentRef.current,
          editor: activeEditorRef.current,
          workspace: sessionWorkspaceRef.current,
        })
        .catch((error: unknown) => setStatus(String(error)));
    },
    [activeEditorRef, commandRegistry, sessionDocumentRef, sessionWorkspaceRef, setStatus],
  );

  return {
    commandRegistry,
    runCommand,
  };
}

function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Args) => callbackRef.current(...args), []);
}
