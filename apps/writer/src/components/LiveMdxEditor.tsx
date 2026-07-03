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
  useEffect,
  useRef,
} from "react";
import {
  CODE_BLOCK_EDITOR_EXTENSIONS,
  CODE_BLOCK_LANGUAGES,
} from "../features/engine/codeBlockLanguages";
import { WriterLinkDialog } from "../features/editor/WriterLinkDialog";

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
  linkDialogPlugin({ LinkDialog: WriterLinkDialog }),
  imagePlugin(),
  jsxPlugin({ jsxComponentDescriptors }),
  codeBlockPlugin({ defaultCodeBlockLanguage: "typescript" }),
  codeMirrorPlugin({
    codeBlockLanguages: CODE_BLOCK_LANGUAGES,
    codeMirrorExtensions: CODE_BLOCK_EDITOR_EXTENSIONS,
    autoLoadLanguageSupport: false,
  }),
  markdownShortcutPlugin(),
];

export function LiveMdxEditor({ value, onChange, onError }: LiveMdxEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() =>
      editorRef.current?.focus(undefined, {
        defaultSelection: "rootEnd",
        preventScroll: true,
      }),
    );
  }, []);

  return (
    <div className="live-mdx-shell" ref={shellRef}>
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
        placeholder={null}
        spellCheck
      />
    </div>
  );
}

function cleanEmptyBlockMarkers(markdown: string): string {
  return markdown.replaceAll(EMPTY_BLOCK_MARKER, "");
}
