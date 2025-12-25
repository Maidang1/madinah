import { Link, NavLink } from '@remix-run/react';
import { MoonIcon, SunIcon, RssIcon } from 'lucide-react';
import { useMemo } from 'react';
import { motion } from 'motion/react';
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
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-6 px-6 py-3 rounded-full border border-border bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/10 transition-all duration-300">
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight transition-all hover:scale-105"
        >
          {t('header.brand')}
        </Link>

        <div className="h-4 w-[1px] bg-border" />

        <nav className="flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              prefetch="intent"
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative py-1 transition-colors hover:text-foreground',
                  isActive ? 'text-foreground font-semibold' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute -bottom-1 left-0 right-0 h-[2px] bg-primary rounded-full"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="h-4 w-[1px] bg-border" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {languageOptions.map((option) => {
              const isActive = option.code === locale;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setLocale(option.code)}
                  className={cn(
                    'px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded-md transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
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
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label={t('header.themeToggle')}
          >
            {theme === 'dark' ? (
              <SunIcon className="w-4 h-4" />
            ) : (
              <MoonIcon className="w-4 h-4" />
            )}
          </button>

          <a
            href="/rss.xml"
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
            aria-label="RSS"
          >
            <RssIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </motion.header>
  );
}
