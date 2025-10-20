'use client';

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CaseSensitive, Hourglass } from 'lucide-react';
import { BlogNavigation } from './blog-navigation';
import { DetailHeader } from './detail-header';
import { ScrollToTopButton } from './scroll-to-top';
import { TableOfContentsMobile } from './table-contents-mobile';
import { TableOfContentsPC } from './table-contents-pc';
import { PostInfo } from '~/types';

const GITHUB_EDIT_BASE_URL =
  'https://github.com/Maidang1/madinah/edit/main/app/routes';

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

  const editUrl = useMemo(() => {
    if (!listItem?.filename) {
      return undefined;
    }
    return `${GITHUB_EDIT_BASE_URL}/blogs.${listItem.filename}.mdx`;
  }, [listItem?.filename]);

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

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
    <div className="relative mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      <ScrollRestoration />
      <TableOfContentsMobile tocs={tocs} />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{
          opacity: showStickyHeader ? 1 : 0,
          y: showStickyHeader ? 0 : -20,
        }}
        transition={{ duration: 0.2 }}
        className={`fixed inset-x-0 top-0 z-50 border-b border-zinc-200/60 bg-background/80 backdrop-blur-md transition ${
          showStickyHeader ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h1>
        </div>
      </motion.div>

      <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="blog-detail-content min-w-0">
          <DetailHeader
            ref={headerRef}
            title={title}
            summary={summary}
            readingTime={readingTime}
            date={publishedAt}
            tags={tags}
            author={author}
            editUrl={editUrl}
          />

          <div className="mt-16 mb-8">
            <BlogNavigation list={list} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative hidden xl:block"
        >
          <div className="sticky top-28 flex max-h-[calc(100vh-7rem)] flex-col gap-6">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur">
              <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">
                目录
              </h3>
              <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
                <TableOfContentsPC tocs={tocs} className="w-full" />
              </div>
            </div>

            {readingTime && (
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CaseSensitive className="h-4 w-4 shrink-0" />
                  <span>{readingTime.words} words</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <Hourglass className="h-4 w-4 shrink-0" />
                  <span>{Math.max(1, Math.ceil(readingTime.minutes))} min read</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        <ScrollToTopButton />
      </div>
    </div>
  );
}
