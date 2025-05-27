"use client";

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { PostInfo } from '~/types';
import { TableOfContents } from './table-of-contents';
import { MobileTableOfContents } from './mobile-table-of-contents';
import { BlogContent } from './blog-content';
import { ScrollToTopButton } from './scroll-to-top-button';
import { motion } from 'motion/react';


interface BlogsDetailProps {
  list: PostInfo[];
}

export default function BlogsDetail({ list }: BlogsDetailProps) {
  const { pathname } = useLocation();
  const listItem = list.find((listItem) => listItem.url === pathname);
  const tocs = listItem?.toc ?? [];
  const title = listItem?.title;
  const summary = listItem?.summary;
  const readingTime = listItem?.readingTime;

  return (
    <div className='container mx-auto mt-4 pt-6 sm:pt-12 px-4 sm:px-6'>
      <ScrollRestoration />
      {/* 移动端目录 */}
      <MobileTableOfContents tocs={tocs} />
      <div className='flex flex-col lg:flex-row gap-8 relative'>
        {/* 左侧边栏 - 目录和文章信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className='lg:w-64 xl:w-80 shrink-0 hidden lg:block mt-[64px]'>
          <div className='sticky top-24 space-y-6 max-h-[calc(100vh-6rem)] overflow-y-auto'>
            {/* 目录 */}
            <div className='pb-6 border-b border-border/50'>
              <TableOfContents tocs={tocs} className="w-full" />
            </div>
            {/* 文章信息 */}
            <div className='flex items-center justify-start text-sm text-muted-foreground'>
              {
                readingTime && (
                  <span>
                    共有 {readingTime.words} 词, 预计需要阅读 {Math.ceil(readingTime.minutes)} 分钟
                  </span>
                )
              }
            </div>

          </div>
        </motion.div>

        {/* 主内容 - 占用更多宽度 */}
        <BlogContent title={title} summary={summary} readingTime={listItem?.readingTime} tags={listItem?.tags} />

        {/* 滚动到顶部按钮 */}
        <ScrollToTopButton />
      </div>
    </div>
  );
}
