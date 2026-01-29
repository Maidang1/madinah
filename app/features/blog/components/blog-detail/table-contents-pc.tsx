import { useEffect, useState } from 'react';
import { TocItem } from '~/types';
import { cn } from '~/core/utils/cn';

interface TableOfContentsPCProps {
  tocs: TocItem[];
  className?: string;
}

export function TableOfContentsPC({ tocs, className }: TableOfContentsPCProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(`#${entry.target.id}`);
          }
        });
      },
      {
        rootMargin: '-80px 0px -80% 0px',
      }
    );

    // Observe all headings
    tocs.forEach((item) => {
      const id = item.url.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [tocs]);

  if (!tocs || tocs.length === 0) return null;

  return (
    <nav className={cn('space-y-1', className)}>
      <h3 className="text-text-strong mb-3 text-sm font-semibold">
        Table of Contents
      </h3>
      <ul className="space-y-2">
        {tocs.map((item, index) => {
          const isActive = activeId === item.url;
          return (
            <li key={index}>
              <a
                href={item.url}
                className={cn(
                  'block text-sm transition-colors',
                  isActive
                    ? 'text-text-strong font-medium'
                    : 'text-text-base hover:text-text-strong',
                  item.level === 3 && 'pl-4',
                  item.level === 4 && 'pl-8'
                )}
              >
                {item.value}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
