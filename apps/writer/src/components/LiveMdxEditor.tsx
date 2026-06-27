import {
  GenericJsxEditor,
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type JsxComponentDescriptor,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface LiveMdxEditorProps {
  value: string;
  onChange: (value: string) => void;
  onError: (error: string) => void;
}

const EMPTY_BLOCK_MARKER = "\u200b";

const jsxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    name: "Callout",
    kind: "flow",
    props: [
      { name: "type", type: "string" },
      { name: "title", type: "string" },
    ],
    hasChildren: true,
    Editor: GenericJsxEditor,
  },
];

const editorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  tablePlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  imagePlugin(),
  jsxPlugin({ jsxComponentDescriptors }),
  codeBlockPlugin({ defaultCodeBlockLanguage: "typescript" }),
  codeMirrorPlugin({
    codeBlockLanguages: {
      plaintext: "Plain text",
      typescript: "TypeScript",
      javascript: "JavaScript",
      tsx: "TSX",
      jsx: "JSX",
      rust: "Rust",
      yaml: "YAML",
      bash: "Bash",
      shell: "Shell",
      json: "JSON",
      jsonc: "JSONC",
      markdown: "Markdown",
    },
    autoLoadLanguageSupport: false,
  }),
  markdownShortcutPlugin(),
];

export function LiveMdxEditor({ value, onChange, onError }: LiveMdxEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<SlashMenuPosition | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const closeMenu = useCallback(() => {
    setPosition(null);
    setSelectedIndex(0);
  }, []);

  const commands = useMemo<SlashCommand[]>(
    () => [
      {
        id: "paragraph",
        label: "Text",
        hint: "Plain paragraph",
        markdown: `${EMPTY_BLOCK_MARKER}\n`,
      },
      {
        id: "h1",
        label: "Heading 1",
        hint: "Large section title",
        markdown: `# ${EMPTY_BLOCK_MARKER}\n\n`,
      },
      {
        id: "h2",
        label: "Heading 2",
        hint: "Medium section title",
        markdown: `## ${EMPTY_BLOCK_MARKER}\n\n`,
      },
      {
        id: "h3",
        label: "Heading 3",
        hint: "Small section title",
        markdown: `### ${EMPTY_BLOCK_MARKER}\n\n`,
      },
      {
        id: "bullet",
        label: "Bulleted list",
        hint: "Simple unordered list",
        markdown: `- ${EMPTY_BLOCK_MARKER}\n`,
      },
      {
        id: "number",
        label: "Numbered list",
        hint: "Ordered list",
        markdown: `1. ${EMPTY_BLOCK_MARKER}\n`,
      },
      {
        id: "quote",
        label: "Quote",
        hint: "Block quote",
        markdown: `> ${EMPTY_BLOCK_MARKER}\n\n`,
      },
      {
        id: "code",
        label: "Code block",
        hint: "Fenced TypeScript block",
        markdown: "```typescript\n\n```\n\n",
      },
      {
        id: "table",
        label: "Table",
        hint: "3 x 3 table",
        markdown:
          "|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n",
      },
      {
        id: "divider",
        label: "Divider",
        hint: "Horizontal rule",
        markdown: "\n---\n\n",
      },
      {
        id: "callout",
        label: "Callout",
        hint: "Madinah callout block",
        markdown:
          `<Callout type="info">\n\n${EMPTY_BLOCK_MARKER}\n\n</Callout>\n\n`,
      },
    ],
    [],
  );

  const runCommand = useCallback(
    (command: SlashCommand) => {
      editorRef.current?.insertMarkdown(command.markdown);
      closeMenu();
      requestAnimationFrame(() =>
        editorRef.current?.focus(undefined, {
          defaultSelection: "rootEnd",
          preventScroll: true,
        }),
      );
      requestAnimationFrame(() => focusInsertedMarker(shellRef.current));
    },
    [closeMenu],
  );

  useEffect(() => {
    requestAnimationFrame(() =>
      editorRef.current?.focus(undefined, {
        defaultSelection: "rootEnd",
        preventScroll: true,
      }),
    );
  }, []);

  useEffect(() => {
    if (!position) return;

    const handleMenuKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((current) => (current + 1) % commands.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex(
          (current) => (current - 1 + commands.length) % commands.length,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        runCommand(commands[selectedIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }

      if (event.key.length === 1) {
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleMenuKey, true);
    return () => window.removeEventListener("keydown", handleMenuKey, true);
  }, [closeMenu, commands, position, runCommand, selectedIndex]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        !isCollapsedSelectionInside(shellRef.current)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPosition(getSlashMenuPosition(shellRef.current));
      setSelectedIndex(0);
    },
    [],
  );

  return (
    <div
      className="live-mdx-shell"
      ref={shellRef}
      onKeyDownCapture={handleKeyDown}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={(markdown, initialMarkdownNormalize) => {
          if (initialMarkdownNormalize) return;
          onChange(cleanEmptyBlockMarkers(markdown));
        }}
        onError={(payload) => onError(payload.error)}
        plugins={editorPlugins}
        contentEditableClassName="post-content live-mdx-content"
        className="live-mdx-editor"
        autoFocus={{ defaultSelection: "rootEnd", preventScroll: true }}
        placeholder={
          <span className="live-mdx-placeholder">Start writing...</span>
        }
        spellCheck
      />
      {position ? (
        <SlashCommandMenu
          commands={commands}
          position={position}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onRun={runCommand}
        />
      ) : null}
    </div>
  );
}

function cleanEmptyBlockMarkers(markdown: string): string {
  return markdown.replaceAll(EMPTY_BLOCK_MARKER, "");
}

function focusInsertedMarker(element: HTMLElement | null): boolean {
  if (!element) return false;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let markerNode: Text | null = null;
  let markerIndex = -1;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue ?? "";
    const index = value.lastIndexOf(EMPTY_BLOCK_MARKER);
    if (index >= 0 && node instanceof Text) {
      markerNode = node;
      markerIndex = index;
    }
  }

  if (!markerNode || markerIndex < 0) return false;

  const range = document.createRange();
  range.setStart(markerNode, markerIndex + EMPTY_BLOCK_MARKER.length);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  return true;
}

interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  markdown: string;
}

interface SlashMenuPosition {
  left: number;
  top: number;
}

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  position: SlashMenuPosition;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRun: (command: SlashCommand) => void;
}

function SlashCommandMenu({
  commands,
  position,
  selectedIndex,
  onSelect,
  onRun,
}: SlashCommandMenuProps) {
  return (
    <div
      className="slash-command-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
      aria-label="Slash commands"
    >
      {commands.map((command, index) => (
        <button
          type="button"
          key={command.id}
          className={index === selectedIndex ? "is-selected" : undefined}
          onMouseEnter={() => onSelect(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onRun(command);
          }}
          role="menuitem"
        >
          <span>{command.label}</span>
          <small>{command.hint}</small>
        </button>
      ))}
    </div>
  );
}

function isCollapsedSelectionInside(element: HTMLElement | null): boolean {
  if (!element) return false;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  return anchorNode ? element.contains(anchorNode) : false;
}

function getSlashMenuPosition(element: HTMLElement | null): SlashMenuPosition {
  const selection = window.getSelection();
  const elementRect = element?.getBoundingClientRect();
  if (!elementRect) {
    return { left: 16, top: 16 };
  }

  let left = elementRect.left + 8;
  let top = elementRect.top + 36;

  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height) {
      left = rect.left;
      top = rect.bottom + 10;
    }
  }

  return {
    left: Math.max(16, Math.min(left, window.innerWidth - 292)),
    top: Math.max(16, Math.min(top, window.innerHeight - 380)),
  };
}
