import { Link, NavLink, useLocation } from '@remix-run/react';
import { MoonIcon, SunIcon, Menu, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
    <header className="bg-surface-gray-50/95 sticky top-0 z-[60] w-full backdrop-blur-sm transition-all duration-200">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-text-primary font-sans text-xl font-bold tracking-tight transition-opacity hover:opacity-70"
          >
            {t('header.brand')}
          </Link>

          <button
            type="button"
            onClick={onThemeToggle}
            className="text-text-primary transition-opacity hover:opacity-70"
            aria-label={t('header.themeToggle')}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </button>

          <span className="text-text-muted">|</span>

          <div className="flex items-center gap-2">
            {languageOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setLocale(option.code)}
                className={cn(
                  'hover:text-text-primary text-sm font-medium transition-colors',
                  option.code === locale
                    ? 'text-text-primary'
                    : 'text-text-muted',
                )}
              >
                {option.code === 'zh' ? '中' : 'En'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'hover:text-text-primary transition-colors',
                    isActive
                      ? 'text-text-primary underline decoration-2 underline-offset-4'
                      : 'text-text-secondary',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-text-primary cursor-pointer sm:hidden"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="border-border-default bg-surface-gray-50/95 border-t backdrop-blur-sm sm:hidden">
          <nav className="flex flex-col space-y-2 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-surface-gray-100 text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-gray-100 hover:text-text-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
