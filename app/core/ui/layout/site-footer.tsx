import { Link } from '@remix-run/react';
import { useMemo } from 'react';
import { useTranslation } from '~/core/i18n';

export function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const footerLinks: { label: string; to: string; external: boolean }[] =
    useMemo(
      () => [
        { label: t('footer.links.blog'), to: '/blog', external: false },
        // { label: t('footer.links.books'), to: '/books', external: false },
        // { label: t('footer.links.reading'), to: '/reading', external: false },
        {
          label: t('footer.links.github'),
          to: 'https://github.com/Maidang1',
          external: true,
        },
        { label: t('footer.links.rss'), to: '/rss.xml', external: false },
      ],
      [t],
    );

  return (
    <footer className="bg-surface-white">
      <div className="border-border-default mx-auto flex w-full max-w-3xl flex-col gap-4 border-t px-4 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:py-12">
        <p className="text-text-secondary font-medium">
          {t('footer.message', { replace: { year } })}
        </p>
        <nav className="flex flex-wrap items-center gap-6">
          {footerLinks.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.to}
                target="_blank"
                rel="noreferrer"
                className="text-text-secondary hover:text-text-primary cursor-pointer font-medium transition-all duration-200"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className="text-text-secondary hover:text-text-primary cursor-pointer font-medium transition-all duration-200"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
