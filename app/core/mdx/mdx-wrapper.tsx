import { ReactNode } from 'react';
import { cn } from '~/core/utils';

interface MDXWrapperProps {
  children: ReactNode;
  className?: string;
}

export function MDXWrapper({ children, className }: MDXWrapperProps) {
  return (
    <div
      className={cn(
        'mdx-content prose-none mx-auto w-full max-w-[--reading-measure]',
        'text-[length:var(--font-size-body)] leading-[var(--line-height-body)] text-zinc-700 dark:text-zinc-300',
        'flex flex-col gap-stack-md md:gap-stack-lg',
        'scroll-smooth',
        className,
      )}
    >
      {children}
    </div>
  );
}
