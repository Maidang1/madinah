import { AlertTriangle } from "lucide-react";
import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { MarkdownDocument } from "../../domain/document";
import type { PreviewComponentMap } from "../../domain/engine";
import { useEngine } from "../engine/EngineProvider";
import type { MdxPreviewContent } from "../../lib/mdx-preview";
import { calculateReadingTime } from "../../lib/reading-time";
import { buildToc } from "../../lib/toc";

interface PreviewPaneProps {
  document: MarkdownDocument;
}

export function PreviewPane({ document }: PreviewPaneProps) {
  const engine = useEngine();
  const [Content, setContent] = useState<MdxPreviewContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const tocItems = useMemo(() => buildToc(document.body), [document.body]);
  const readingTime = useMemo(
    () => calculateReadingTime(document.body),
    [document.body],
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      engine
        .compilePreview(document.body)
        .then((component) => {
          if (cancelled) return;
          setContent(() => component);
          setError(null);
        })
        .catch((compileError: unknown) => {
          if (cancelled) return;
          setError(String(compileError));
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [document.body, engine]);

  useEffect(() => {
    if (!previewRef.current || !window.MathJax?.typesetPromise) return;

    window.MathJax.typesetClear?.([previewRef.current]);
    window.MathJax.typesetPromise([previewRef.current])
      .then(markMathJaxParents)
      .catch(() => {});
  }, [Content, document.body]);

  return (
    <section className="writer-preview" aria-label="Rendered preview">
      <article className="post-shell writer-preview-article">
        <header className="post-header">
          <h1 className="post-title">{document.title || "Untitled"}</h1>
          <div className="post-meta">
            <span>{document.pubDate}</span>
            <span>/</span>
            <span>{readingTime.minutes} min read</span>
            {document.author ? (
              <>
                <span>/</span>
                <span>{document.author}</span>
              </>
            ) : null}
          </div>
        </header>

        {tocItems.length > 0 ? (
          <div className="toc">
            <details open>
              <summary>
                <span className="details">Table of Contents</span>
              </summary>
              <div className="inner">
                <ul>
                  {tocItems.map((item) => (
                    <li
                      key={`${item.id}-${item.depth}`}
                      className={item.depth > 1 ? "toc-depth-3" : undefined}
                    >
                      <a href={`#${item.id}`} aria-label={item.text}>
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        ) : null}

        <div className="post-content" ref={previewRef}>
          {error ? (
            <div className="preview-error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : Content ? (
            renderPreviewContent(Content, engine.profile.previewComponents ?? {})
          ) : null}
        </div>
      </article>
    </section>
  );
}

export function renderPreviewContent(
  Content: MdxPreviewContent,
  components: PreviewComponentMap,
): ReactElement {
  return createElement(Content, { components });
}

function markMathJaxParents() {
  document.querySelectorAll("mjx-container").forEach((container) => {
    container.parentElement?.classList.add("has-jax");
  });
}
