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
import { ClientOnly } from 'remix-utils/client-only';
import { cn } from '~/core/utils';
import { mdxComponents } from '~/core/mdx/mdx-components';
import { userTheme } from './cookies.server';
import { useTheme } from '~/core/hooks/use-theme';
import { useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';
import './styles/tailwind.css';
import './styles/theme.less';
import './styles/mdx.css';
import { Theme } from './types';
import { SiteHeader } from '~/core/ui/layout/site-header';
import { SiteFooter } from '~/core/ui/layout/site-footer';

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const theme = ((await userTheme.parse(cookieHeader)) as Theme) || 'light';

  return json({ theme });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const theme = formData.get('theme') as Theme;

  if (!theme || !['light', 'dark', 'system'].includes(theme)) {
    return json({ error: 'Invalid theme' }, { status: 400 });
  }

  return json(
    { success: true },
    {
      headers: {
        'Set-Cookie': await userTheme.serialize(theme),
      },
    },
  );
}

export function Layout(props: { children: React.ReactNode }) {
  const { children } = props;
  const { theme: serverTheme } = useLoaderData<typeof loader>();
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
    <html lang="en" className={cn('h-full', actualTheme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>Madinah</title>
      </head>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteHeader theme={actualTheme} onThemeToggle={toggleTheme} />
          <main
            id="main-content"
            className="mx-auto w-full flex-1 px-4 py-12 sm:py-16"
          >
            <div className="space-y-12">{children}</div>
          </main>
          <SiteFooter />
        </div>
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
        ClientOnly,
        // ExcalidrawComponent
      }}
    >
      <Outlet />
    </MDXProvider>
  );
}
