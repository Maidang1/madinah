import type { MetaFunction } from '@remix-run/cloudflare';
import { Link } from '@remix-run/react';
import { useMemo } from 'react';
// eslint-disable-next-line import/no-unresolved
import { list as blogList } from 'virtual:blog-list';

export const meta: MetaFunction = () => {
  return [
    { title: 'Madinah' },
    { name: 'description', content: 'Welcome to Madinah!' },
  ];
};

const Index = () => {
  const socialLinks = [
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
      label: 'RSS',
      href: '/rss.xml',
      external: false,
    },
    {
      label: 'X',
      href: 'https://x.com/felixwliu',
      external: true,
    },
  ];

  const focusAreas = [
    'Designing thoughtful front-end experiences with Remix & Tailwind.',
    'Exploring Rust and WebAssembly for developer tooling.',
    'Sketching AI-powered workflows that automate the boring parts.',
  ];

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

  const formatDate = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid gap-8 rounded-3xl border border-border/70 bg-background/80 p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:gap-10 sm:text-left">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-main-500/40 to-transparent blur-2xl" />
            <img
              src="https://avatars.githubusercontent.com/u/50993231?v=4"
              alt="Madinah avatar"
              className="relative border border-border/80 object-cover shadow-lg shadow-main-500/20 h-32 w-32 rounded-full sm:h-40 sm:w-40"
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-main-500 text-xs font-semibold uppercase tracking-widest">
                Frontend · Rust · AI
              </p>
              <h1 className="text-balance text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
                你好，我是 Madinah。
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                Frontend developer, Rust tinkerer, and AI enthusiast building in
                public.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {socialLinks.map((link) => {
                const linkProps = link.external
                  ? { target: '_blank', rel: 'noreferrer' }
                  : {};
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className="border-border/70 text-muted-foreground hover:border-main-500/70 hover:text-main-500 inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    {...linkProps}
                  >
                    {link.label}
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
              className="border-border/60 bg-muted/50 text-muted-foreground rounded-2xl border px-4 py-6 text-sm leading-relaxed shadow-sm dark:bg-background/60"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            快速导航
          </h2>
          <p className="text-muted-foreground text-sm">
            最新两篇博客，快速浏览最近的思考与笔记。
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {latestPosts.map((post) => {
            const postDate = formatDate(post.time ?? post.date);
            return (
              <Link
                key={post.url}
                to={post.url}
                className="border-border/70 hover:border-main-500/60 hover:shadow-main-500/10 group flex h-full flex-col gap-4 rounded-2xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                    {post.title}
                  </h3>
                  <span className="text-main-500 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
                {post.summary ? (
                  <p className="text-muted-foreground line-clamp-4 text-sm leading-relaxed">
                    {post.summary}
                  </p>
                ) : null}
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide">
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
