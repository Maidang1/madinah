import { ListTree } from "lucide-react";
import { useMemo } from "react";
import { buildToc, type TocItem } from "../../lib/toc";
import { useDebouncedValue } from "../../lib/use-debounced-value";

interface DocumentOutlineProps {
  source: string;
  onJump: (item: TocItem) => void;
}

export function DocumentOutline({ source, onJump }: DocumentOutlineProps) {
  // Headings rarely change per keystroke; trail the source so the outline
  // doesn't re-scan the whole document while the user types.
  const debouncedSource = useDebouncedValue(source, 300);
  const toc = useMemo(() => buildToc(debouncedSource), [debouncedSource]);

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
