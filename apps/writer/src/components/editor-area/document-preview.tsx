import { useEffect, useMemo, useState, type ComponentType } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useFileContent } from "@/hooks/use-tabs";
import "./preview-content.css";

// Debounce window for re-rendering the preview after content changes. Typing
// in the TipTap editor updates the store on every keystroke; without
// debouncing, react-markdown would re-parse the whole document each time.
const PREVIEW_DEBOUNCE_MS = 180;

interface DocumentPreviewProps {
  filePath: string;
}

// Anchor target for relative links in the preview. The web site renders these
// as real navigations; in the editor we keep them inert (the writing pane is
// the navigation surface). External http(s) links still open normally.
function previewLink(props: React.ComponentPropsWithoutRef<"a">): React.ReactElement | null {
  const { href, children, ...rest } = props;
  const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} onClick={(e) => e.preventDefault()} {...rest}>
      {children}
    </a>
  );
}

export const DocumentPreview = (() => {
  const Memoized: ComponentType<DocumentPreviewProps> = ({ filePath }) => {
    const content = useFileContent(filePath);
    const [debounced, setDebounced] = useState(content);

    useEffect(() => {
      if (content === debounced) return;
      const id = window.setTimeout(() => setDebounced(content), PREVIEW_DEBOUNCE_MS);
      return () => window.clearTimeout(id);
    }, [content, debounced]);

    const remarkPlugins = useMemo(() => [remarkGfm], []);

    return (
      <div className="writer-preview h-full overflow-y-auto">
        <div className="mx-auto w-full" style={{ maxWidth: "var(--reader-content-width)" }}>
          <ReactMarkdown remarkPlugins={remarkPlugins} components={{ a: previewLink }}>
            {debounced}
          </ReactMarkdown>
        </div>
      </div>
    );
  };
  return Memoized;
})();
