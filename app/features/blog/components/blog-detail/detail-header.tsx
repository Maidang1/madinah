import { Outlet } from '@remix-run/react';
import { forwardRef } from 'react';
import { MDXWrapper } from '~/core/mdx/mdx-wrapper';
import { LicenseNotice } from '~/core/ui/common/license-notice';
import { cn } from '~/core/utils';
import { PostInfo } from '~/types';
import { Time } from '~/core/ui/common/time';

interface BlogContentProps {
  post?: PostInfo;
  className?: string;
}

export const DetailHeader = forwardRef<HTMLElement, BlogContentProps>(
  function DetailHeader({ post, className }, ref) {
    return (
      <div className={cn('min-w-0 flex-1', className)}>
        <article className="max-w-none">
          {post && (
            <header ref={ref} className="mb-8 space-y-6">
              <h1 className="text-text-strong text-left text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
                {post.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary font-mono">
                <div className="flex items-center gap-2">
                  <span>Date:</span>
                  <Time time={post.date} />
                </div>
                
                <span className="text-text-muted">|</span>
                
                <div>
                  Estimated Reading Time: {Math.ceil(post.readingTime?.minutes || 5)} min
                </div>

                {post.author && (
                  <>
                    <span className="text-text-muted">|</span>
                    <div>Author: {post.author}</div>
                  </>
                )}
              </div>
            </header>
          )}

          <MDXWrapper className="mt-4">
            <Outlet />
          </MDXWrapper>
          <LicenseNotice />
        </article>
      </div>
    );
  },
);
