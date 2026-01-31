import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');
  
  // Sort by date
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'Madinah',
    description: 'A blog about programming, technology, and life.',
    site: context.site || 'https://madinah.felixwliu.cn',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description || '',
      link: `/blog/${post.id}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
