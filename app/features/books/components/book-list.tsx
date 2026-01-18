import { Link } from '@remix-run/react';
import { cn } from '~/core/utils';
import type { BookSummaryInfo } from '~/types';
import { useTranslation } from '~/core/i18n';
import { Time } from '~/core/ui/common/time';

interface BookListProps {
  books: BookSummaryInfo[];
}

export function BookList({ books }: BookListProps) {
  const { t } = useTranslation();

  if (!books.length) {
    return (
      <div className="text-text-weak flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-text-strong text-lg font-semibold">
          {t('books.list.emptyTitle')}
        </p>
        <p className="text-sm">{t('books.list.emptyMessage')}</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute top-0 left-5 h-full w-0.5 bg-gradient-to-b from-gray-400/40 via-gray-700/60 to-gray-400/40" />

      <div className="space-y-8">
        {books.map((book) => (
          <div key={book.id} className="relative pl-14">
            <div className="absolute top-3.5 left-3">
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-gradient-to-br from-gray-600 to-black shadow-lg shadow-gray-900/40" />
              </div>
            </div>

            <div className="group border-border-weak/50 bg-surface-raised-base/80 relative overflow-hidden rounded-xl border backdrop-blur-xl transition-all duration-300">
              <div className="relative flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-text-strong mb-1.5 text-xl font-bold transition-colors">
                      {book.title}
                    </h2>
                    <div className="text-text-weak flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                      {book.author && (
                        <span className="flex items-center gap-1.5">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-700/10">
                            <svg
                              className="h-2.5 w-2.5 text-gray-700"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                          </div>
                          <span className="truncate">{book.author}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-700/10">
                          <svg
                            className="h-2.5 w-2.5 text-gray-700"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <Time time={new Date(book.timestamp).toISOString()} />
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-700/10">
                          <svg
                            className="h-2.5 w-2.5 text-gray-700"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                        </div>
                        <span>
                          {t('books.list.chapterCount', {
                            replace: { count: book.chapterCount },
                          })}
                        </span>
                      </span>
                    </div>
                  </div>

                  {book.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {book.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="dark:text-main-400 inline-flex items-center gap-1 rounded-md border border-gray-700/20 bg-gray-700/10 px-2 py-0.5 text-[10px] font-medium text-gray-800"
                        >
                          <span className="h-1 w-1 rounded-full bg-gray-700" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-text-weak line-clamp-2 border-l-2 border-gray-700/20 pl-4 text-sm leading-relaxed transition-colors">
                  {book.description}
                </p>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-text-weak/70 text-[11px] font-medium">
                    <Time time={new Date(book.timestamp).toISOString()} />
                  </div>
                  <Link
                    to={`/books/${book.id}`}
                    className={cn(
                      'group/btn inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95',
                    )}
                  >
                    {t('books.list.startReading')}
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
