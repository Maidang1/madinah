import { Outlet } from '@remix-run/react';
import type { ReadTimeResults } from 'reading-time';
import { forwardRef, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  FileText,
  Tag,
  UserRound,
} from 'lucide-react';
import { MDXWrapper } from '~/core/mdx/mdx-wrapper';
import { LicenseNotice } from '~/core/ui/common/license-notice';
import { cn } from '~/core/utils';
import { useTranslation } from '~/core/i18n';
import { usePrefersReducedMotion } from '~/core/hooks/use-prefers-reduced-motion';

interface BlogContentProps {
  title?: string;
  summary?: string;
  className?: string;
  readingTime?: ReadTimeResults;
  date?: string;
  tags?: string[];
  author?: string;
}

export const DetailHeader = forwardRef<HTMLElement, BlogContentProps>(
  function DetailHeader(
    { title, summary, className, readingTime, date, tags, author },
    ref,
  ) {
    const { t, locale } = useTranslation();
    const prefersReducedMotion = usePrefersReducedMotion();
    const parsedDate = useMemo(() => {
      if (!date) {
        return null;
      }
      const candidate = new Date(date);
      if (Number.isNaN(candidate.getTime())) {
        return null;
      }
      return candidate;
    }, [date]);

    const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

    const formattedDate = useMemo(() => {
      if (!parsedDate) {
        return date ?? null;
      }
      return new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedDate);
    }, [parsedDate, date, localeCode]);

    const readingMinutes = useMemo(() => {
      if (!readingTime) return null;
      return Math.max(1, Math.ceil(readingTime.minutes));
    }, [readingTime]);

    const readingWords = readingTime?.words;
    const numberFormatter = useMemo(
      () => new Intl.NumberFormat(localeCode),
      [localeCode],
    );

    const readingMinutesLabel =
      readingMinutes !== null
        ? t('blog.detail.readTime', {
            replace: { count: numberFormatter.format(readingMinutes) },
          })
        : null;

    const readingWordsLabel = readingWords
      ? t('blog.detail.readWords', {
          replace: { count: numberFormatter.format(readingWords) },
        })
      : null;

    const tagList = tags?.filter(Boolean) ?? [];

    return (
      <div className={cn('min-w-0 flex-1', className)}>
        <article className="flex flex-col gap-stack-lg">
          {(title || summary) && (
            <header ref={ref} className="flex flex-col gap-stack-md">
              {title && (
                <h1 className="text-balance text-3xl font-bold tracking-tight text-blue-600 sm:text-[length:var(--font-size-heading-lg)] dark:text-blue-400">
                  {title}
                </h1>
              )}

              {(author || formattedDate || readingMinutes || editUrl) && (
                <div className="border-border/60 flex flex-col gap-stack-sm border-b pb-stack-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-inline-md text-sm">
                    {author && (
                      <span className="inline-flex items-center gap-inline-sm">
                        <UserRound className="h-4 w-4" />
                        {author}
                      </span>
                    )}
                    {formattedDate && (
                      <time
                        dateTime={parsedDate?.toISOString() ?? undefined}
                        className="inline-flex items-center gap-inline-sm"
                      >
                        <CalendarDays className="h-4 w-4" />
                        {formattedDate}
                      </time>
                    )}
                    {readingMinutesLabel && (
                      <span className="inline-flex items-center gap-inline-sm">
                        <Clock className="h-4 w-4" />
                        {readingMinutesLabel}
                      </span>
                    )}
                    {readingWordsLabel && (
                      <span className="inline-flex items-center gap-inline-sm">
                        <FileText className="h-4 w-4" />
                        {readingWordsLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {tagList.length > 0 && (
                <div className="text-muted-foreground flex flex-wrap gap-inline-sm text-xs font-medium tracking-wide uppercase">
                  {tagList.map((tag) => (
                    <span
                      key={tag}
                      className="bg-muted/30 inline-flex items-center gap-inline-sm rounded-full border border-border/60 px-3 py-1"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {summary && (
                <div
                  className={cn(
                    'relative overflow-hidden rounded-2xl border border-border/60 bg-muted/30 p-inset-md shadow-sm',
                    prefersReducedMotion
                      ? 'transition-none'
                      : 'transition-transform transition-opacity duration-fast ease-standard hover:shadow-lg',
                  )}
                >
                  <div className="mb-stack-sm flex items-center gap-inline-sm text-sm font-semibold text-blue-600 dark:text-blue-400">
                    <span className="i-simple-icons-openai block h-5 w-5" />
                    {t('blog.detail.aiSummary')}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}
            </header>
          )}

          <MDXWrapper>
            <Outlet />
          </MDXWrapper>
          <LicenseNotice />
        </article>
      </div>
    );
  },
);
