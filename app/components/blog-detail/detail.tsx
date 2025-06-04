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

  return (
    <div className="container mx-auto mt-4 px-4 pt-6 sm:px-6 sm:pt-12">
      <ScrollRestoration />
      <TableOfContentsMobile tocs={tocs} />

      <div className="relative flex flex-col gap-8 lg:flex-row">
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
        <div className="min-w-0 flex-1">
          <DetailHeader title={title} summary={summary} />

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
