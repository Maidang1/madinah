import { useTableOfContents } from "~/hooks/use-table-of-contents";
import { TocItem } from "~/types";
import { Tocs } from "./tocs";

interface TableOfContentsProps {
  tocs: TocItem[];
  className?: string;
}

export function TableOfContentsPC({
  tocs,
  className,
}: TableOfContentsProps) {
  const { activeId, handleClick } = useTableOfContents({ tocs });

  if (tocs.length === 0) {
    return null;
  }

  const activeIndex = tocs.findIndex((toc) => toc.url.slice(1) === activeId);
  const progress =
    activeIndex >= 0 ? ((activeIndex + 1) / tocs.length) * 100 : 0;

  return (
    <div className={className}>
      <Tocs
        tocs={tocs}
        activeId={activeId}
        progress={progress}
        onLinkClick={handleClick}
      />
    </div>
  );
}
