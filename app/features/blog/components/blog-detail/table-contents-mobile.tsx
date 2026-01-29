import { useState } from 'react';
import { TocItem } from '~/types';
import { cn } from '~/core/utils/cn';

interface TableOfContentsMobileProps {
  tocs: TocItem[];
}

export function TableOfContentsMobile({ tocs }: TableOfContentsMobileProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!tocs || tocs.length === 0) return null;

  return (
    <div className="xl:hidden fixed top-20 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-surface-raised-base border-border-weak text-text-strong rounded-lg border p-3 shadow-lg backdrop-blur-sm hover:bg-surface-raised-hover"
        aria-label="Toggle table of contents"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="bg-surface-raised-base border-border-weak absolute right-0 top-14 max-h-[70vh] w-72 overflow-y-auto rounded-lg border p-4 shadow-xl">
            <h3 className="text-text-strong mb-3 text-sm font-semibold">
              Table of Contents
            </h3>
            <nav>
              <ul className="space-y-2">
                {tocs.map((item, index) => (
                  <li key={index}>
                    <a
                      href={item.url}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'text-text-base hover:text-text-strong block text-sm transition-colors',
                        item.level === 3 && 'pl-4',
                        item.level === 4 && 'pl-8'
                      )}
                    >
                      {item.value}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
