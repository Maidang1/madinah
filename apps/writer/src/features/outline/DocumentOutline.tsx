import { ListTree } from "lucide-react";
import { useMemo } from "react";
import { buildToc, type TocItem } from "../../lib/toc";

interface DocumentOutlineProps {
  source: string;
  onJump: (item: TocItem) => void;
}

export function DocumentOutline({ source, onJump }: DocumentOutlineProps) {
  const toc = useMemo(() => buildToc(source), [source]);

  return (
    <section className="inspector-section document-outline">
      <div className="inspector-section-header">
        <span>Outline</span>
      </div>
      {toc.length > 0 ? (
        <nav className="outline-list" aria-label="Document outline">
          {toc.map((item) => (
            <button
              key={`${item.id}-${item.depth}-${item.text}`}
              type="button"
              className={`outline-row depth-${item.depth}`}
              onClick={() => onJump(item)}
            >
              <ListTree size={13} aria-hidden="true" />
              <span>{item.text}</span>
            </button>
          ))}
        </nav>
      ) : (
        <div className="outline-empty">No headings</div>
      )}
    </section>
  );
}
