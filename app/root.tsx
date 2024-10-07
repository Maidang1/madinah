import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import Header from "./layout/header";

import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout(props: { children: React.ReactNode }) {

  const { children } = props;
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>Madinah</title>
      </head>
      <body className="h-full">
        <Header />
        <div className="overflow-y-auto overflow-x-hidden bg-gradient-radial pt-[56px] h-full bg-[rgb(24,23,23)] text-white">
          <main className="m-auto mx-auto  min-h-full h-full">
            <div className="w-full min-h-full h-full flex-1">
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
  return <Outlet />;
}
