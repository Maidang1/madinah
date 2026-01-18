import { NavLink } from '@remix-run/react';
import { cn } from '~/core/utils';
import { TocItem } from '~/types';

interface TocsProps {
  tocs: TocItem[];
  activeId: string;
  progress: number;
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, url: string) => void;
}

export const Tocs = ({ tocs, activeId, progress, onLinkClick }: TocsProps) => {
  // Calculate the minimum level to normalize indentation
  const minLevel = Math.min(...tocs.map((toc) => toc.level ?? 2));

  return (
    <>
      <nav className="space-y-0.5">
        {tocs.map((toc) => {
          const isActive = activeId === toc.url.slice(1);
          // Normalize level and calculate indentation (0.5rem per level)
          const normalizedLevel = (toc.level ?? 2) - minLevel;
          const indentStyle = {
            paddingLeft: `${normalizedLevel * 0.5 + 0.5}rem`,
          };

          return (
            <NavLink
              key={toc.url}
              to={toc.url}
              onClick={(e) => onLinkClick(e, toc.url)}
              style={indentStyle}
              className={cn(
                'block rounded py-1.5 pr-2 text-xs transition-all duration-200',
                'text-text-weak hover:opacity-65',
                'dark:text-white dark:opacity-75 dark:hover:opacity-40',
                'group relative',
                isActive && ['text-text-strong font-medium'],
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'truncate leading-relaxed',
                    isActive && 'font-medium',
                  )}
                >
                  {toc.value}
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="text-text-weak mt-3 ml-2 inline-flex items-center justify-between gap-1.5 text-[10px]">
        <div
          className="radial-progress text-text-weak"
          style={
            { '--value': progress, '--size': '0.875rem' } as React.CSSProperties
          }
          aria-valuenow={progress}
          role="progressbar"
        />
        <div>{Math.round(progress)}%</div>
      </div>
    </>
  );
};
