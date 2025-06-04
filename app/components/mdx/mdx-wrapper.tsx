import { ReactNode } from 'react';
import { cn } from '~/utils';

interface MDXWrapperProps {
  children: ReactNode;
  className?: string;
}

export function MDXWrapper({ children, className }: MDXWrapperProps) {
  return (
    <div
      className={cn(
        'mdx-content prose-none max-w-none',
        'text-zinc-700 dark:text-zinc-300',
        'scroll-smooth',
        'mx-auto',
        'px-4 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
