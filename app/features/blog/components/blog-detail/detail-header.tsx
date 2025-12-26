import { Outlet } from '@remix-run/react';
import { forwardRef } from 'react';
import { MDXWrapper } from '~/core/mdx/mdx-wrapper';
import { LicenseNotice } from '~/core/ui/common/license-notice';
import { cn } from '~/core/utils';

interface BlogContentProps {
  title?: string;
  className?: string;
}

export const DetailHeader = forwardRef<HTMLElement, BlogContentProps>(
  function DetailHeader({ title, className }, ref) {
    return (
      <div className={cn('min-w-0 flex-1', className)}>
        <article className="max-w-none">
          {title && (
            <header ref={ref} className="mb-10 space-y-6">
                {title && (
                  <h1 className="text-left text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
                    {title}
                  </h1>
                )}
            </header>
          )}

          <MDXWrapper className="mt-8">
            <Outlet />
          </MDXWrapper>
          <LicenseNotice />
        </article>
      </div>
    );
  },
);
