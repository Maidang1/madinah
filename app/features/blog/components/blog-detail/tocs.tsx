import { NavLink } from "@remix-run/react";
import { cn } from "~/core/utils";
import { TocItem } from "~/types";

interface TocsProps {
  tocs: TocItem[];
  activeId: string;
  progress: number;
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, url: string) => void;
}

export const Tocs = ({ tocs, activeId, progress, onLinkClick }: TocsProps) => {

  return <>
    <nav className='space-y-1'>
      {tocs.map((toc) => {
        const isActive = activeId === toc.url.slice(1);

        return (
          <NavLink
            key={toc.url}
            to={toc.url}
            onClick={(e) => onLinkClick(e, toc.url)}
            className={cn(
              'block text-sm py-2 px-3 rounded-md transition-all duration-200 hover:bg-none',
              'text-muted-foreground hover:text-gray-700',
              'border-l-2 border-transparent relative group ml-0',
              isActive && ['text-gray-700 font-medium'],
            )}
          >
            <div className='flex items-center gap-2'>
              <span className={cn(
                'truncate',
                isActive && 'font-medium'
              )}>
                {toc.value}
              </span>
            </div>
          </NavLink>
        );
      })}
    </nav>

    <div className='inline-flex items-center justify-between gap-1 text-xs mt-4 ml-2 text-gray-700'>
      {/* @ts-ignore */}
      <div className="radial-progress text-gray-700 text-xs" style={{ "--value": progress, "--size": "1rem" } as React.CSSProperties} aria-valuenow={progress} role="progressbar" />
      <div>{Math.round(progress)}%</div>
    </div>
  </>
}
