import type { ReactNode } from 'react';
import type { BookSummaryInfo } from '~/types';

interface BookOverviewCardProps {
  book: BookSummaryInfo;
  overviewSlot?: ReactNode;
}

export function BookOverviewCard({
  book,
  overviewSlot,
}: BookOverviewCardProps) {
  return (
    <section className="border-border/60 bg-background/80 dark:bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur transition">
      <header className="mb-3 space-y-1">
        <p className="text-main-500 text-xs tracking-wide uppercase">Book</p>
        <h1 className="text-foreground text-xl font-semibold">{book.title}</h1>
        {book.author ? (
          <p className="text-muted-foreground text-xs">作者：{book.author}</p>
        ) : null}
      </header>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {book.description}
      </p>
      {overviewSlot ? (
        <div className="text-foreground/80 mt-4 text-sm leading-relaxed">
          {overviewSlot}
        </div>
      ) : null}
      {book.tags.length ? (
        <div className="text-main-500 mt-4 flex flex-wrap gap-2 text-xs">
          {book.tags.map((tag) => (
            <span
              key={tag}
              className="border-main-500/40 rounded-full border px-2 py-1"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
