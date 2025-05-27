import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { MDXProvider } from '@mdx-js/react';
import { ClientOnly } from 'remix-utils/client-only';
import './font.css';
import './base.css';
import './tailwind.css';
import './theme-dark.less';
import './theme-light.less';
import { cn } from './lib/utils';
import { AnimatedGridPattern } from '@components/magicui/animated-grid-pattern';
import { Menu } from '~/layout/menu';

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

export function Layout(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <html lang='en' className='h-full'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <Meta />
        <Links />
        <title>Madinah</title>
        <script src='/dark-check'></script>
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
          <main className="container mx-auto px-4 py-20">
            {children}
            <ScrollRestoration />
            <Scripts />
          </main>
        </div>
        <Menu />

      </body>
    </html>
  );
}

export default function App() {
  return (
    <MDXProvider
      components={{
        ClientOnly,
        // ExcalidrawComponent
      }}
    >
      <Outlet />
    </MDXProvider>
  );
}
