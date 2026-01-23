import { Link, NavLink } from '@remix-run/react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '~/core/utils';
import type { Theme, Locale } from '~/types';
import { useTranslation } from '~/core/i18n';

interface SiteHeaderProps {
  theme: Theme;
  onThemeToggle?: () => void;
}

export function SiteHeader({ theme, onThemeToggle }: SiteHeaderProps) {
  const { t, locale, setLocale, availableLocales } = useTranslation();
  const [isBlogHeaderActive, setIsBlogHeaderActive] = useState(false);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      setIsBlogHeaderActive((e as CustomEvent).detail);
    };
    window.addEventListener('blog-sticky-header-change', handleToggle);
    return () =>
      window.removeEventListener('blog-sticky-header-change', handleToggle);
  }, []);

  const navItems: { to: string; label: string; end?: boolean }[] = useMemo(
    () => [
      { to: '/', label: t('header.navigation.blog'), end: true },
      { to: '/projects', label: t('header.navigation.projects') },
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

  return (
    <header className="bg-surface-gray-50/80 border-border-default fixed top-4 right-4 left-4 z-[60] rounded-lg border backdrop-blur-sm transition-all duration-200">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="font-display text-text-primary cursor-pointer text-lg font-semibold tracking-tight transition-all duration-200 hover:opacity-70"
          >
            {t('header.brand')}
          </Link>

          <nav className="hidden items-center gap-6 text-sm sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'cursor-pointer transition-all duration-200',
                    isActive
                      ? 'text-text-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {languageOptions.map((option) => {
              const isActive = option.code === locale;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setLocale(option.code)}
                  className={cn(
                    'cursor-pointer text-xs font-medium transition-all duration-200',
                    isActive
                      ? 'text-text-primary'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {option.code}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onThemeToggle}
            className="text-text-primary cursor-pointer transition-all duration-200 hover:opacity-70"
            aria-label={t('header.themeToggle')}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
