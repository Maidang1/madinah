'use client';

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { PostInfo } from '~/types';
import { TableOfContentsPC } from './table-contents-pc';
import { TableOfContentsMobile } from './table-contents-mobile';
import { DetailHeader } from './detail-header';
import { ScrollToTopButton } from './scroll-to-top';
import { BlogNavigation } from './blog-navigation';
import { motion } from 'motion/react';
import { CaseSensitive, Hourglass } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !headerRef.current) return;

    const handleScroll = () => {
      const headerRect = headerRef.current?.getBoundingClientRect();
      if (headerRect) {
        // Show sticky header when original header is scrolled out of view
        setShowStickyHeader(headerRect.bottom < 0);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="container mx-auto mt-4 h-full max-h-full overflow-hidden px-4 pt-6 sm:px-6 sm:pt-12">
      <ScrollRestoration />
      <TableOfContentsMobile tocs={tocs} />
      
      {/* Sticky Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ 
          opacity: showStickyHeader ? 1 : 0,
          y: showStickyHeader ? 0 : -20
        }}
        transition={{ duration: 0.2 }}
        className={`fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-700 ${
          showStickyHeader ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div className="container mx-auto px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {title}
          </h1>
        </div>
      </motion.div>

      <div className="relative flex h-full flex-col gap-8 lg:flex-row">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-[64px] hidden shrink-0 lg:block lg:w-64 xl:w-80"
        >
          <div className="sticky top-24 max-h-[calc(100vh-6rem)] space-y-6 overflow-y-auto opacity-50 transition-opacity duration-400 hover:opacity-100">
            <div className="border-border/50 border-b pb-6">
              <TableOfContentsPC tocs={tocs} className="w-full" />
            </div>
            <div className="text-muted-foreground flex items-center justify-start text-sm">
              {readingTime && (
                <div className="flex items-center gap-2">
                  <CaseSensitive /> {readingTime.words} ,{' '}
                  <Hourglass className="h-4 w-4 text-xs" />{' '}
                  {Math.ceil(readingTime.minutes)} min
                </div>
              )}
            </div>
          </div>
        </motion.div>
        <div 
          ref={scrollContainerRef}
          className="blog-detail-scroll-container h-full max-h-full min-w-0 flex-1 overflow-auto"
        >
          <DetailHeader ref={headerRef} title={title} summary={summary} />

          {/* 博客导航组件 */}
          <div className="mt-16 mb-8">
            <BlogNavigation list={list} />
          </div>
        </div>
        <ScrollToTopButton />
      </div>
    </div>
  );
}
