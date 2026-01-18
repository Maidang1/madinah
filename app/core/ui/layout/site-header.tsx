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
    <header className="bg-surface-raised-base/80 fixed top-0 right-0 left-0 z-[60] w-full backdrop-blur-sm transition-all duration-300">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="font-display text-text-strong text-lg font-bold tracking-tight transition-opacity hover:opacity-60"
          >
            {t('header.brand')}
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'transition-all hover:opacity-60',
                    isActive
                      ? 'text-text-strong font-semibold'
                      : 'text-text-weak',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {languageOptions.map((option) => {
              const isActive = option.code === locale;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setLocale(option.code)}
                  className={cn(
                    'text-[10px] font-bold tracking-widest uppercase transition-all hover:opacity-60',
                    isActive ? 'text-text-strong' : 'text-text-weak',
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
            className="text-text-strong transition-opacity hover:opacity-60"
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
