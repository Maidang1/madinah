import { LoaderFunction } from '@remix-run/cloudflare';

import { generateRssFeed } from '../../utils/rss';
import { list } from 'virtual:blog-list';

export const loader: LoaderFunction = async ({ request }) => {
  const rss = generateRssFeed(list);

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
