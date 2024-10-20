import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import Header from './layout/header';
import type { LinksFunction } from '@remix-run/cloudflare';
import { MDXProvider } from '@mdx-js/react';
import { ClientOnly } from 'remix-utils/client-only';
import './font.css';
import './base.css';
import './tailwind.css';
import './theme-dark.less';
import './theme-light.less';
// import ExcalidrawComponent from './components/ExcalidrawComponent';

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
      </head>
      <body className='h-full'>
        <Header />
        <div className='overflow-y-auto bg-gradient-radial pt-[56px] h-full dark:bg-[rgb(24,23,23)] bg-white text-[#3c3c43] dark:text-[#fffffff2] scroll-container max-w-full'>
          <main className='mx-auto min-h-full h-full max-w-full'>
            <div className='w-full min-h-full h-full flex-1 mx-auto max-w-full'>
              {children}
              <ScrollRestoration />
              <Scripts />
            </div>
          </main>
        </div>
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
