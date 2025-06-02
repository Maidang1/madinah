"use client";

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { PostInfo } from '~/types';
import { TableOfContentsPC } from './table-contents-pc';
import { TableOfContentsMobile } from './table-contents-mobile';
import { DetailHeader } from './detail-header';
import { ScrollToTopButton } from './scroll-to-top-button';
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
    <div className='container mx-auto mt-4 pt-6 sm:pt-12 px-4 sm:px-6'>
      <ScrollRestoration />
      <TableOfContentsMobile tocs={tocs} />

      <div className='flex flex-col lg:flex-row gap-8 relative'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className='lg:w-64 xl:w-80 shrink-0 hidden lg:block mt-[64px]'>
          <div className='sticky top-24 space-y-6 max-h-[calc(100vh-6rem)] overflow-y-auto opacity-50 hover:opacity-100 transition-opacity duration-400'>
            <div className='pb-6 border-b border-border/50'>
              <TableOfContentsPC tocs={tocs} className="w-full" />
            </div>
            <div className='flex items-center justify-start text-sm text-muted-foreground'>
              {
                readingTime && (
                  <div className='flex items-center gap-2'>
                    <CaseSensitive /> {readingTime.words} , <Hourglass className='text-xs w-4 h-4' /> {Math.ceil(readingTime.minutes)} min
                  </div>
                )
              }
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
