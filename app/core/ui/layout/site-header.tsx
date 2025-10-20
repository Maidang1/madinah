import { Link, NavLink } from '@remix-run/react';
import { MoonIcon, SunIcon, RssIcon } from 'lucide-react';
import { cn } from '~/core/utils';
import type { Theme } from '~/types';

interface SiteHeaderProps {
  theme: Theme;
  onThemeToggle?: () => void;
}

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/blog', label: 'Blog' },
  { to: '/books', label: 'Books' },
  { to: '/projects', label: 'Projects' },
];

export function SiteHeader({ theme, onThemeToggle }: SiteHeaderProps) {
  const handleToggle = () => {
    onThemeToggle?.();
  };

  return (
    <header className="border-b border-border bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-accent focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/"
          className="text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-accent sm:text-3xl"
        >
          Madinah
        </Link>
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row sm:justify-end">
          <nav className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'transition-colors hover:text-accent',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="/rss.xml"
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <RssIcon className="h-4 w-4" aria-hidden />
              RSS
            </a>
            <button
              type="button"
              onClick={handleToggle}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Toggle theme"
            >
              <SunIcon
                className={cn(
                  'h-5 w-5 transition-all duration-200',
                  theme === 'dark' ? 'scale-0 opacity-0 -rotate-90' : 'scale-100 opacity-100 rotate-0',
                )}
                aria-hidden={theme === 'dark'}
              />
              <MoonIcon
                className={cn(
                  'absolute h-5 w-5 transition-all duration-200',
                  theme === 'dark' ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-90',
                )}
                aria-hidden={theme !== 'dark'}
              />
              <span className="sr-only">Toggle theme</span>
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4">
        <hr className="border-border" />
      </div>
    </header>
  );
}
