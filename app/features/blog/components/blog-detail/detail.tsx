'use client';

import { ScrollRestoration, useLocation } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';
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

    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Throttle the scroll handler
      timeoutId = setTimeout(() => {
        const headerRect = headerRef.current?.getBoundingClientRect();
        if (headerRect) {
          setShowStickyHeader(headerRect.bottom < 80);
        }
      }, 16); // ~60fps
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <>
      <TableOfContentsMobile tocs={tocs} />

      <div
        className={`fixed top-30 left-4 z-40 hidden max-h-[calc(100vh-8rem)] w-56 pb-8 xl:block 2xl:w-64`}
      >
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
          <TableOfContentsPC tocs={tocs} className="w-full" />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <div
          className={`bg-surface-raised-base/80 border-border-weak fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md transition-opacity ${
            showStickyHeader
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
            <h1 className="text-text-strong truncate text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h1>
          </div>
        </div>

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
