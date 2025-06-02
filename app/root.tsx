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
  ActionFunctionArgs
} from '@remix-run/cloudflare';
import { MDXProvider } from '@mdx-js/react';
import { ClientOnly } from 'remix-utils/client-only';
import { cn } from './utils';
import { AnimatedGridPattern } from '~/components/magicui/animated-grid-pattern';
// import { FirefliesBackground } from '~/components/magicui/fireflies-background';
import { Menu } from '~/components/blog-list/menu';
import { mdxComponents } from '~/components/mdx/mdx-components';
import { userTheme } from './cookies.server';
import { useTheme } from './hooks/use-theme';
import { useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';
import './styles/tailwind.css';
import './styles/theme.less';
import './styles/mdx.css';
import { Theme } from './types';

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
  const cookieHeader = request.headers.get("Cookie");
  const theme = (await userTheme.parse(cookieHeader)) as Theme || "light";

  return json({ theme });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const theme = formData.get("theme") as Theme;

  if (!theme || !["light", "dark", "system"].includes(theme)) {
    return json({ error: "Invalid theme" }, { status: 400 });
  }

  return json(
    { success: true },
    {
      headers: {
        "Set-Cookie": await userTheme.serialize(theme),
      },
    }
  );
}

export function Layout(props: { children: React.ReactNode }) {
  const { children } = props;
  const { theme: serverTheme } = useLoaderData<typeof loader>();
  const [initTheme, setInitTheme] = useState(false);

  const {
    setTheme,
    toggleTheme,
    theme,
  } = useTheme(serverTheme);

  useEffectOnce(() => {
    setTheme(serverTheme);
    setInitTheme(true);
  });

  const actualTheme = useMemo(() => {
    if (serverTheme === 'system' || theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return initTheme ? theme : serverTheme;
  }, [serverTheme, theme, initTheme]);

  return (
    <html lang='en' className={cn("h-full", actualTheme)}>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <Meta />
        <Links />
        <title>Madinah</title>
      </head>
      <body className='min-h-screen flex flex-col'>
        <div className="flex-1 relative">
          <AnimatedGridPattern
            numSquares={30}
            maxOpacity={0.1}
            duration={3}
            repeatDelay={1}
            className={cn(
              "fixed inset-0 z-[9999] [mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
            )}
          />
          {/* <FirefliesBackground
            count={60}
            className="fixed inset-0 z-[10000]"
            color={
              theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'transparent'
            }
          /> */}
          <main className="container mx-auto px-4 py-20">
            {children}
            <ScrollRestoration />
            <Scripts />
          </main>
        </div>
        <Menu
          onThemeToggle={toggleTheme}
          theme={actualTheme}
        />

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
