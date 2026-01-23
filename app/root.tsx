import {
  json,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from '@remix-run/react';
import type {
  LinksFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from '@remix-run/cloudflare';
import { MDXProvider } from '@mdx-js/react';
import { CH } from '@code-hike/mdx/components';
import { ClientOnly } from 'remix-utils/client-only';
import { cn } from '~/core/utils';
import { mdxComponents } from '~/core/mdx/mdx-components';
import { userTheme, userLocale } from './cookies.server';
import { useTheme } from '~/core/hooks/use-theme';
import { useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';
import './styles/tailwind.css';
import './styles/theme.less';
import './styles/mdx.css';
import '@code-hike/mdx/styles.css';
import type { Theme, Locale } from './types';
import { SiteHeader } from '~/core/ui/layout/site-header';
import { SiteFooter } from '~/core/ui/layout/site-footer';
import { I18nProvider } from '~/core/i18n/i18n-provider';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '~/core/i18n/translations';

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap',
  },
];

const isValidLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);

const resolvePreferredLocale = (headerValue: string | null) => {
  if (!headerValue) {
    return DEFAULT_LOCALE;
  }

  const firstEntry = headerValue.split(',')[0]?.trim();
  if (!firstEntry) {
    return DEFAULT_LOCALE;
  }

  const base = firstEntry.split(';')[0]?.trim().toLowerCase();
  if (!base) {
    return DEFAULT_LOCALE;
  }

  const normalized = base.split('-')[0] as Locale;
  return isValidLocale(normalized) ? normalized : DEFAULT_LOCALE;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const theme = ((await userTheme.parse(cookieHeader)) as Theme) || 'light';
  const localeCookie = (await userLocale.parse(cookieHeader)) as
    | Locale
    | undefined;
  const preferredLocale = resolvePreferredLocale(
    request.headers.get('Accept-Language'),
  );
  const locale = isValidLocale(localeCookie)
    ? localeCookie
    : (preferredLocale ?? DEFAULT_LOCALE);

  return json({ theme, locale });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const themeValue = formData.get('theme');
  const localeValue = formData.get('locale');

  const headers = new Headers();

  if (
    typeof themeValue === 'string' &&
    ['light', 'dark', 'system'].includes(themeValue)
  ) {
    headers.append(
      'Set-Cookie',
      await userTheme.serialize(themeValue as Theme),
    );
  }

  if (typeof localeValue === 'string' && isValidLocale(localeValue)) {
    headers.append(
      'Set-Cookie',
      await userLocale.serialize(localeValue as Locale),
    );
  }

  if (!headers.has('Set-Cookie')) {
    return json({ error: 'Invalid submission' }, { status: 400 });
  }

  return json(
    { success: true },
    {
      headers,
    },
  );
}

export function Layout(props: { children: React.ReactNode }) {
  const { children } = props;
  const { theme: serverTheme, locale } = useLoaderData<typeof loader>();
  const [initTheme, setInitTheme] = useState(false);

  const { setTheme, toggleTheme, theme } = useTheme(serverTheme);

  useEffectOnce(() => {
    setTheme(serverTheme);
    setInitTheme(true);
  });

  const actualTheme = useMemo<Theme>(() => {
    const candidate = initTheme ? theme : serverTheme;

    if (candidate === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      }
      return 'light';
    }

    return candidate ?? 'light';
  }, [serverTheme, theme, initTheme]);

  return (
    <html lang={locale} className={cn('h-full', actualTheme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>Madinah</title>
      </head>
      <body className="bg-surface-gray-50 text-text-primary min-h-screen antialiased">
        <I18nProvider initialLocale={locale}>
          <div className="flex min-h-screen flex-col">
            <SiteHeader theme={actualTheme} onThemeToggle={toggleTheme} />
            <main
              id="main-content"
              className="mx-auto w-full max-w-3xl flex-1 px-4 pt-20 pb-12 sm:pt-24 sm:pb-16"
            >
              <div className="space-y-12">{children}</div>
            </main>
            <SiteFooter />
          </div>
        </I18nProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <MDXProvider
      components={{
        ...mdxComponents,
        CH,
        ClientOnly,
        // ExcalidrawComponent
      }}
    >
      <Outlet />
    </MDXProvider>
  );
}
