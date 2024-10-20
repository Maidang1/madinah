/* eslint-disable @typescript-eslint/ban-ts-comment */
import { LoaderFunction } from '@remix-run/cloudflare';

import { generateRssFeed } from '../../utils/rss.server';
// eslint-disable-next-line import/no-unresolved
// @ts-expect-error
import { list } from 'virtual:blog-list';
import { list as rustList } from 'virtual:rust-list';

export const loader: LoaderFunction = async ({ request }) => {
  const rss = generateRssFeed(list.concat(rustList));

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
