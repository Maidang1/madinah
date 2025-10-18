import { LoaderFunction } from '@remix-run/cloudflare';

import { generateRssFeed } from '../../utils/rss';
// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';
import { isPostInfoList } from '~/features/blog/utils/validators';

export const loader: LoaderFunction = async () => {
  try {
    const rss = generateRssFeed(list);

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/rss+xml',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    console.error('Failed to generate RSS feed', error);
    return new Response('Failed to generate RSS feed', { status: 500 });
  }
};
