'use client';

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CaseSensitive, Hourglass } from 'lucide-react';
import { BlogNavigation } from './blog-navigation';
import { DetailHeader } from './detail-header';
import { ScrollToTopButton } from './scroll-to-top';
import { TableOfContentsMobile } from './table-contents-mobile';
import { TableOfContentsPC } from './table-contents-pc';
import { PostInfo } from '~/types';
import { useTranslation } from '~/core/i18n';
import { usePrefersReducedMotion } from '~/core/hooks/use-prefers-reduced-motion';
import { cn } from '~/core/utils';

interface BlogsDetailProps {
  list: PostInfo[];
}

export default function Detail({ list }: BlogsDetailProps) {
  const { pathname } = useLocation();
  const listItem = list.find((listItem) => listItem.url === pathname);
  const tocs = listItem?.toc ?? [];
  const title = listItem?.title;
  const summary = listItem?.summary;
  const readingTime = listItem?.readingTime;
  const publishedAt = listItem?.time;
  const tags = listItem?.tags ?? [];
  const author = listItem?.author;

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { t, locale } = useTranslation();
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(localeCode),
    [localeCode],
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const stickyHeaderVisibility = showStickyHeader
    ? 'pointer-events-auto opacity-100 translate-y-0'
    : 'pointer-events-none opacity-0 -translate-y-6';

  const stickyHeaderClasses = cn(
    'fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur',
    prefersReducedMotion
      ? 'transition-none'
      : 'transition-transform transition-opacity duration-fast ease-standard',
    stickyHeaderVisibility,
  );

  const sidebarClasses = cn(
    'sticky top-28 flex max-h-[calc(100vh-7rem)] flex-col gap-stack-md',
    prefersReducedMotion ? 'transition-none' : 'transition-opacity duration-fast ease-standard',
  );

  useEffect(() => {
    if (!headerRef.current) return;
    const handleScroll = () => {
      const headerRect = headerRef.current?.getBoundingClientRect();
      if (headerRect) {
        setShowStickyHeader(headerRect.bottom < 80);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-5xl px-inline-sm pt-stack-md sm:px-inline-md lg:px-inline-md lg:pt-stack-lg">
      <ScrollRestoration />
      <TableOfContentsMobile tocs={tocs} />

      <div data-testid="blog-detail-sticky-header" className={stickyHeaderClasses}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-inline-sm py-stack-sm sm:px-inline-md">
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h1>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-stack-lg lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="blog-detail-content flex min-w-0 flex-col gap-stack-lg">
          <DetailHeader
            ref={headerRef}
            title={title}
            summary={summary}
            readingTime={readingTime}
            date={publishedAt}
            tags={tags}
            author={author}
          />

          <div className="mt-stack-lg">
            <BlogNavigation list={list} />
          </div>
        </div>

        <div className="relative hidden xl:block">
          <div
            data-testid="blog-detail-sidebar"
            className={sidebarClasses}
          >
            <div className="rounded-2xl border border-border/60 bg-background/80 p-inset-md shadow-sm backdrop-blur">
              <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">
                {t('blog.detail.tableOfContents')}
              </h3>
              <div className="mt-stack-sm max-h-[60vh] overflow-y-auto pr-1">
                <TableOfContentsPC tocs={tocs} className="w-full" />
              </div>
            </div>

            {readingTime && (
              <div className="rounded-2xl border border-border/60 bg-background/80 p-inset-md shadow-sm backdrop-blur">
                <div className="flex items-center gap-inline-sm text-sm text-muted-foreground">
                  <CaseSensitive className="h-4 w-4 shrink-0" />
                  <span>
                    {t('blog.detail.readWords', {
                      replace: {
                        count: numberFormatter.format(readingTime.words),
                      },
                    })}
                  </span>
                </div>
                <div className="mt-stack-sm flex items-center gap-inline-sm text-sm text-muted-foreground">
                  <Hourglass className="h-4 w-4 shrink-0" />
                  <span>
                    {t('blog.detail.readTime', {
                      replace: {
                        count: numberFormatter.format(
                          Math.max(1, Math.ceil(readingTime.minutes)),
                        ),
                      },
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <ScrollToTopButton />
      </div>
    </div>
  );
}
