import { AlertTriangle, LoaderCircle } from "lucide-react";
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
import { loadMathJax, sourceMayContainMath } from "../../lib/mathjax";
import { calculateReadingTime } from "../../lib/reading-time";
import { buildToc } from "../../lib/toc";
import { useDebouncedValue } from "../../lib/use-debounced-value";

const PREVIEW_COMPILE_DELAY_MS = 300;
const PREVIEW_LOADING_DELAY_MS = 120;

interface PreviewPaneProps {
  document: MarkdownDocument;
}

export function PreviewPane({ document }: PreviewPaneProps) {
  const engine = useEngine();
  const [Content, setContent] = useState<MdxPreviewContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  // Trail the body like the compile effect below so TOC/reading time stay off
  // the keystroke path.
  const debouncedBody = useDebouncedValue(document.body, 300);
  const tocItems = useMemo(() => buildToc(debouncedBody), [debouncedBody]);
  const readingTime = useMemo(
    () => calculateReadingTime(debouncedBody),
    [debouncedBody],
  );

  useEffect(() => {
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setIsCompiling(true);
    }, PREVIEW_LOADING_DELAY_MS);
    const compileTimer = window.setTimeout(() => {
      engine
        .compilePreview(document.body)
        .then((component) => {
          if (cancelled) return;
          window.clearTimeout(loadingTimer);
          setContent(() => component);
          setError(null);
          setIsCompiling(false);
        })
        .catch((compileError: unknown) => {
          if (cancelled) return;
          window.clearTimeout(loadingTimer);
          setError(String(compileError));
          setIsCompiling(false);
        });
    }, PREVIEW_COMPILE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
      window.clearTimeout(compileTimer);
    };
  }, [document.body, engine]);

  useEffect(() => {
    if (!previewRef.current || !sourceMayContainMath(document.body)) return;

    let cancelled = false;
    loadMathJax()
      .then(() => {
        const preview = previewRef.current;
        if (cancelled || !preview || !window.MathJax?.typesetPromise) return;

        window.MathJax.typesetClear?.([preview]);
        return window.MathJax.typesetPromise([preview]).then(markMathJaxParents);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
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
          {isCompiling ? renderPreviewLoading() : null}
          {error ? renderPreviewError(error) : null}
          {Content ? (
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

export function renderPreviewError(error: string): ReactElement {
  return (
    <div className="preview-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{error}</span>
    </div>
  );
}

export function renderPreviewLoading(): ReactElement {
  return (
    <div className="preview-loading" role="status">
      <LoaderCircle size={18} aria-hidden="true" />
      <span>Compiling preview</span>
    </div>
  );
}

function markMathJaxParents() {
  document.querySelectorAll("mjx-container").forEach((container) => {
    container.parentElement?.classList.add("has-jax");
  });
}
