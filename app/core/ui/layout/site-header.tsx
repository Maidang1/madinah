import { Link, NavLink } from '@remix-run/react';
import { MoonIcon, SunIcon, RssIcon } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '~/core/utils';
import type { Theme, Locale } from '~/types';
import { useTranslation } from '~/core/i18n';

interface SiteHeaderProps {
  theme: Theme;
  onThemeToggle?: () => void;
}

export function SiteHeader({ theme, onThemeToggle }: SiteHeaderProps) {
  const { t, locale, setLocale, availableLocales } = useTranslation();

  const navItems: { to: string; label: string; end?: boolean }[] = useMemo(
    () => [
      { to: '/', label: t('header.navigation.blog'), end: true },
      { to: '/projects', label: t('header.navigation.projects') },
      // { to: '/reading', label: t('header.navigation.reading') },
    ],
    [t],
  );

  const languageOptions: { code: Locale; label: string }[] = useMemo(
    () =>
      availableLocales.map((code) => ({
        code,
        label: t(`common.language.localeName.${code}`),
      })),
    [availableLocales, t],
  );

  const handleToggle = () => {
    onThemeToggle?.();
  };

  const handleLocaleChange = (value: Locale) => {
    setLocale(value);
  };

  return (
    <header className="border-border bg-background border-b">
      <a
        href="#main-content"
        className="focus:bg-background focus:text-accent sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:rounded-md focus:px-3 focus:py-2 focus:shadow-lg"
      >
        {t('header.skipToContent')}
      </a>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/"
          className="text-foreground text-lg font-medium tracking-tight transition-colors hover:opacity-65"
        >
          {t('header.brand')}
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
                    'transition-colors hover:opacity-65',
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
              className="border-border text-muted-foreground focus-visible:outline-ring inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <RssIcon className="h-4 w-4" aria-hidden />
              {t('header.rssLabel')}
            </a>
            <div
              role="group"
              aria-label={t('header.languageToggle')}
              className="border-border text-muted-foreground flex items-center rounded-full border p-1 text-xs font-medium"
            >
              {languageOptions.map((option) => {
                const isActive = option.code === locale;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => handleLocaleChange(option.code)}
                    className={cn(
                      'rounded-full px-2.5 py-1 transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:opacity-65',
                    )}
                    disabled={isActive}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="border-border text-muted-foreground focus-visible:outline-ring relative flex h-9 w-9 items-center justify-center rounded-full border transition hover:opacity-65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={t('header.themeToggle')}
            >
              <SunIcon
                className={cn(
                  'h-5 w-5 transition-all duration-200',
                  theme === 'dark'
                    ? 'scale-0 -rotate-90 opacity-0'
                    : 'scale-100 rotate-0 opacity-100',
                )}
                aria-hidden={theme === 'dark'}
              />
              <MoonIcon
                className={cn(
                  'absolute h-5 w-5 transition-all duration-200',
                  theme === 'dark'
                    ? 'scale-100 rotate-0 opacity-100'
                    : 'scale-0 rotate-90 opacity-0',
                )}
                aria-hidden={theme !== 'dark'}
              />
              <span className="sr-only">{t('header.themeToggle')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
