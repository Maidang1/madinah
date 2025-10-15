// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';
import BlogsDetail from '~/features/blog/components/blog-detail/detail';

export default function blogs() {
  return <BlogsDetail list={list} />;
}
