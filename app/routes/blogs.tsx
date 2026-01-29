import { Outlet, useLocation } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';
import { BlogNavigation } from '~/features/blog/components/blog-detail/blog-navigation';
import { DetailHeader } from '~/features/blog/components/blog-detail/detail-header';
import { HistoryVersions } from '~/features/blog/components/blog-detail/history-version';
// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';

export default function BlogsLayout() {
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
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.dispatchEvent(
        new CustomEvent('blog-sticky-header-change', { detail: false }),
      );
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('blog-sticky-header-change', {
        detail: showStickyHeader,
      }),
    );
  }, [showStickyHeader]);

  return (
    <>
      <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        {listItem && (
          <div
            className={`bg-surface-raised-base/80 border-border-weak/60 fixed inset-x-0 top-[56px] z-50 border-b backdrop-blur-md transition-opacity ${
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
        )}

        <div className="blog-detail-content blog-detail-scroll-container min-w-0">
          {listItem && <DetailHeader ref={headerRef} post={listItem} />}

          <div className="mt-8 mb-16">
            <Outlet />
          </div>

          {listItem && (
            <div className="my-4">
              <div className="my-4">
                {(listItem?.gitInfo?.commits?.length ?? 0) > 0 && (
                  <HistoryVersions gitInfo={listItem?.gitInfo} />
                )}
              </div>
              <BlogNavigation list={list} />
            </div>
          )}
        </div>

      </div>
    </>
  );
}
