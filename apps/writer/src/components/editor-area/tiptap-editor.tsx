import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import type { Editor } from "@tiptap/react";
import * as editorApi from "@/hooks/editor-api";
import { useReloadVersion } from "@/hooks/use-tabs";
import "./tiptap-editor.css";

interface TiptapEditorProps {
  filePath: string;
  autoFocus?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

// Re-export so callers that previously depended on a CodeMirror EditorView
// can keep a stable handle shape. TipTap's Editor exposes the underlying
// ProseMirror view via `editor.view` when needed by future ports.
export type { Editor };

function buildExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: { HTMLAttributes: { class: "tiptap-code-block" } },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { class: "tiptap-link" },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: { class: "tiptap-image" },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") return "Heading";
        return "Start writing, or press / for commands…";
      },
      emptyEditorClass: "tiptap-is-empty",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Typography,
    Markdown.configure({
      html: true,
      breaks: false,
      linkify: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];
}

export function useTiptapEditor(
  filePath: string,
  autoFocus = false,
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>,
) {
  const filePathRef = useRef(filePath);
  const autoFocusRef = useRef(autoFocus);
  const prevPathRef = useRef<string | null>(null);
  const prevReloadVersionRef = useRef<number>(0);
  const suppressUpdateRef = useRef(false);
  filePathRef.current = filePath;
  autoFocusRef.current = autoFocus;

  const editor = useEditor({
    extensions: buildExtensions(),
    content: "",
    // setContent is our own write path; don't emit updates for it.
    editorProps: {
      attributes: {
        class: "tiptap-editor-content",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (suppressUpdateRef.current) return;
      const markdown = ed.storage.markdown?.getMarkdown?.() ?? "";
      editorApi.updateContent(filePathRef.current, markdown);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (suppressUpdateRef.current) return;
      editorApi.updateCursorPos(filePathRef.current, ed.state.selection.head);
    },
  });

  const reloadVersion = useReloadVersion(filePath);

  // Initial mount + path / reload-version swaps.
  useEffect(() => {
    if (!editor) return;

    const pathChanged = filePath !== prevPathRef.current;
    const reloaded = !pathChanged && reloadVersion !== prevReloadVersionRef.current;
    if (!pathChanged && !reloaded) return;

    prevPathRef.current = filePath;
    prevReloadVersionRef.current = reloadVersion;

    const file = editorApi.getOpenFile(filePath);
    const content = file?.content ?? "";

    suppressUpdateRef.current = true;
    // setContent parses the markdown string into ProseMirror nodes.
    // `emitUpdate: false` keeps onUpdate from firing, but we also guard with
    // the suppress flag for the selection update that follows.
    editor.commands.setContent(content, false);
    // Reset undo history per file so switching tabs doesn't merge histories.
    editor.commands.clearNodes();
    // Place caret at the start of the document for a fresh file.
    editor.commands.setTextSelection(0);
    suppressUpdateRef.current = false;

    if (pathChanged) {
      // Restore the saved scroll position for this file (pixel offset, stored
      // per-file in the editor store). Deferred so the layout settles first.
      const scroller = scrollContainerRef?.current ?? null;
      const scrollPos = file?.scrollPos ?? 0;
      if (scroller) {
        requestAnimationFrame(() => scroller.scrollTo({ top: scrollPos, behavior: "auto" }));
      }
      if (autoFocusRef.current) editor.commands.focus("start");
    }
  }, [editor, filePath, reloadVersion, scrollContainerRef]);

  // Track scroll position per file.
  useEffect(() => {
    const scroller = scrollContainerRef?.current;
    if (!scroller) return;
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        editorApi.updateScrollPos(filePathRef.current, scroller.scrollTop);
      });
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef]);

  // Focus the editor when it becomes the active pane (tab switch reveals it).
  useEffect(() => {
    if (!editor || !autoFocus) return;
    const view = editor.view;
    const dom = view.dom as HTMLElement;
    const pane = dom.closest<HTMLElement>("[data-pane]");
    if (!pane) {
      editor.commands.focus("start");
      return;
    }
    let wasHidden = pane.classList.contains("invisible");
    if (!wasHidden) {
      editor.commands.focus("start");
      return;
    }
    const mo = new MutationObserver(() => {
      const isHidden = pane.classList.contains("invisible");
      if (wasHidden && !isHidden) {
        editor.commands.focus("end");
      }
      wasHidden = isHidden;
    });
    mo.observe(pane, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [editor, autoFocus]);

  return editor;
}

export function TiptapEditor({ filePath, autoFocus, scrollContainerRef }: TiptapEditorProps) {
  const editor = useTiptapEditor(filePath, autoFocus, scrollContainerRef);
  return <EditorContent editor={editor} className="tiptap-editor-host" />;
}
