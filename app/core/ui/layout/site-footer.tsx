import { Link } from '@remix-run/react';

const footerLinks = [
  { label: 'Blog', to: '/blog', external: false },
  { label: 'Books', to: '/books', external: false },
  {
    label: 'GitHub',
    to: 'https://github.com/Maidang1',
    external: true,
  },
  { label: 'RSS', to: '/rss.xml', external: false },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} Madinah. Built with curiosity and care.</p>
        <nav className="flex flex-wrap items-center gap-4">
          {footerLinks.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.to}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className="transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
