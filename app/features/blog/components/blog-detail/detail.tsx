'use client';

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BlogNavigation } from './blog-navigation';
import { DetailHeader } from './detail-header';
import { ScrollToTopButton } from './scroll-to-top';
import { TableOfContentsMobile } from './table-contents-mobile';
import { TableOfContentsPC } from './table-contents-pc';
import { PostInfo } from '~/types';
import { HistoryVersions } from './history-version';

interface BlogsDetailProps {
  list: PostInfo[];
}

export default function Detail({ list }: BlogsDetailProps) {
  const { pathname } = useLocation();
  const listItem = list.find((listItem) => listItem.url === pathname);
  const tocs = listItem?.toc ?? [];
  const title = listItem?.title;

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
    <>
      <TableOfContentsMobile tocs={tocs} />

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed top-30 left-4 z-40 hidden max-h-[calc(100vh-8rem)] w-56 pb-8 xl:block"
      >
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
          <TableOfContentsPC tocs={tocs} className="w-full" />
        </div>
      </motion.div>

      <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{
            opacity: showStickyHeader ? 1 : 0,
            y: showStickyHeader ? 0 : -20,
          }}
          transition={{ duration: 0.2 }}
          className={`bg-background/80 fixed inset-x-0 top-0 z-50 border-b border-zinc-200/60 backdrop-blur-md transition ${
            showStickyHeader ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h1>
          </div>
        </motion.div>

        <div className="blog-detail-content blog-detail-scroll-container min-w-0">
          <DetailHeader ref={headerRef} title={title} />

          <div className="mt-16 mb-8">
            <div className="my-4">
              {(listItem?.gitInfo?.commits?.length ?? 0) > 0 && (
                <HistoryVersions gitInfo={listItem?.gitInfo} />
              )}
            </div>

            <BlogNavigation list={list} />
          </div>
        </div>

        <ScrollToTopButton />
      </div>
    </>
  );
}
