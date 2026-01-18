import { Link, useParams } from '@remix-run/react';
import { cn } from '~/core/utils';
import type { BookSummaryInfo } from '~/types';
import { useTranslation } from '~/core/i18n';

interface BookChapterSidebarProps {
  book: BookSummaryInfo;
  activeChapterId?: string | null;
  onNavigate?: () => void;
}

export function BookChapterSidebar({
  book,
  activeChapterId,
  onNavigate,
}: BookChapterSidebarProps) {
  const { t } = useTranslation();
  const params = useParams<{ chapterId?: string }>();
  const currentChapter =
    activeChapterId ?? params.chapterId ?? book.defaultChapterId ?? null;

  return (
    <nav className="border-border-weak/60 bg-surface-raised-base/80 dark:bg-surface-raised-base/60 flex flex-col gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur">
      <header className="space-y-1">
        <p className="text-text-weak text-xs tracking-wide uppercase">
          {t('books.sidebar.sectionLabel')}
        </p>
        <h2 className="text-text-strong text-base font-semibold">
          {book.title}
        </h2>
        {book.description ? (
          <p className="text-text-weak mt-2 text-xs leading-relaxed">
            {book.description}
          </p>
        ) : null}
      </header>

      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {book.chapters.map((chapter, index) => {
          const isActive = currentChapter === chapter.id;

          return (
            <li key={chapter.id}>
              <Link
                to={`/books/${book.id}/${chapter.id}`}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition',
                  isActive
                    ? 'dark:text-main-400 border-gray-700 bg-gray-500/10 text-gray-700'
                    : 'text-text-weak hover:border-gray-700/40 hover:bg-gray-500/5',
                )}
                prefetch="intent"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-500/10 text-xs font-semibold text-gray-700">
                  {index + 1}
                </span>
                <span className="text-text-strong flex-1 text-sm leading-snug">
                  {chapter.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
