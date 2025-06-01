import { LoaderFunction } from '@remix-run/cloudflare';

export const loader: LoaderFunction = async () => {
  const code = `
  (()=>{const e=localStorage.getItem("madinah_blog_theme")||"",a=window.matchMedia("(prefers-color-scheme: dark)").matches;(e==="true")&&document.documentElement.classList.add("dark")})();
  `;
  return new Response(code, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
