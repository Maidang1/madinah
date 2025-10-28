import type { MetaFunction } from '@remix-run/cloudflare';
import { Link } from '@remix-run/react';
import { useMemo } from 'react';
import { list as blogList } from 'virtual:blog-list';
import { useTranslation } from '~/core/i18n';
import { DEFAULT_LOCALE, translations } from '~/core/i18n';

export const meta: MetaFunction = () => {
  const homeMeta = translations[DEFAULT_LOCALE]?.home?.meta;
  return [
    { title: homeMeta?.title ?? 'Madinah' },
    {
      name: 'description',
      content: homeMeta?.description ?? 'Welcome to Madinah!',
    },
  ];
};

const Index = () => {
  const latestPosts = useMemo(() => {
    const sorted = [...blogList].sort((a, b) => {
      const getTime = (value?: string) => {
        if (!value) return 0;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      };
      return getTime(b.time ?? b.date) - getTime(a.time ?? a.date);
    });
    return sorted.slice(0, 2);
  }, []);

  const { t, locale } = useTranslation();
  const socialLinks = useMemo(
    () => [
      {
        label: 'Bilibili',
        href: 'https://space.bilibili.com/427444426',
        external: true,
      },
      {
        label: 'Telegram',
        href: 'https://t.me/maidang606',
        external: true,
      },
      {
        label: 'GitHub',
        href: 'https://github.com/Maidang1',
        external: true,
      },
      {
        label: t('header.rssLabel'),
        href: '/rss.xml',
        external: false,
      },
      {
        label: 'X',
        href: 'https://x.com/felixwliu',
        external: true,
      },
    ],
    [t],
  );
  const focusAreas = t<string[]>('home.hero.focusAreas');

  const formatDate = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    const formatter = new Intl.DateTimeFormat(
      locale === 'zh' ? 'zh-CN' : 'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      },
    );
    return formatter.format(parsed);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 sm:px-6 lg:px-8">
      <section className="border-border/70 bg-background/80 grid gap-8 rounded-3xl border p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:gap-10 sm:text-left">
          <div className="relative">
            <span className="from-gray-700/40 absolute inset-0 rounded-full bg-gradient-to-br to-transparent blur-2xl" />
            <img
              src="https://avatars.githubusercontent.com/u/50993231?v=4"
              alt={t('home.hero.avatarAlt')}
              className="border-border/80 shadow-gray-700/20 relative h-32 w-32 rounded-full border object-cover shadow-lg sm:h-40 sm:w-40"
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-gray-700 text-xs font-semibold tracking-widest uppercase">
                {t('home.hero.badge')}
              </p>
              <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {t('home.hero.title')}
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                {t('home.hero.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {socialLinks.map((link) => {
                const linkProps = link.external
                  ? { target: '_blank', rel: 'noreferrer' }
                  : {};
                return (
                  <a
                    key={link.label as string}
                    href={link.href}
                    className="border-border/70 text-muted-foreground hover:border-gray-700/70 hover:text-gray-700 inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    {...linkProps}
                  >
                    {link.label as string}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {focusAreas.map((item) => (
            <div
              key={item}
              className="border-border/60 bg-muted/50 text-muted-foreground dark:bg-background/60 rounded-2xl border px-4 py-6 text-sm leading-relaxed shadow-sm"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            {t('home.latestPosts.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('home.latestPosts.description')}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {latestPosts.map((post) => {
            const postDate = formatDate(post.time ?? post.date);
            return (
              <Link
                key={post.url}
                to={post.url}
                className="border-border/70 hover:border-gray-700/60 hover:shadow-gray-700/10 group flex h-full flex-col gap-4 rounded-2xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-foreground line-clamp-2 text-lg font-semibold">
                    {post.title}
                  </h3>
                  <span className="text-gray-700 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
                {post.summary ? (
                  <p className="text-muted-foreground line-clamp-4 text-sm leading-relaxed">
                    {post.summary}
                  </p>
                ) : null}
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs tracking-wide uppercase">
                  {postDate && <span>{postDate}</span>}
                  {post.tags?.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="border-border/60 bg-muted/40 text-muted-foreground/80 inline-flex items-center rounded-full border px-2 py-1"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Index;
