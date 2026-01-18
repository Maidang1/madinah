import type { ReactNode } from 'react';
import type { BookSummaryInfo } from '~/types';
import { useTranslation } from '~/core/i18n';

interface BookOverviewCardProps {
  book: BookSummaryInfo;
  overviewSlot?: ReactNode;
}

export function BookOverviewCard({
  book,
  overviewSlot,
}: BookOverviewCardProps) {
  const { t } = useTranslation();
  return (
    <section className="border-border-weak/60 bg-surface-raised-base/80 dark:bg-surface-raised-base/60 rounded-2xl border p-6 shadow-sm backdrop-blur transition">
      <header className="mb-3 space-y-1">
        <p className="text-xs tracking-wide text-gray-700 uppercase">
          {t('books.overview.sectionLabel')}
        </p>
        <h1 className="text-text-strong text-xl font-semibold">{book.title}</h1>
        {book.author ? (
          <p className="text-text-weak text-xs">
            {t('books.overview.author', { replace: { name: book.author } })}
          </p>
        ) : null}
      </header>
      <p className="text-text-weak text-sm leading-relaxed">
        {book.description}
      </p>
      {overviewSlot ? (
        <div className="text-text-strong/80 mt-4 text-sm leading-relaxed">
          {overviewSlot}
        </div>
      ) : null}
      {book.tags.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-700">
          {book.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-gray-700/40 px-2 py-1"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
