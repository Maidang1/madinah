// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:rust-list';
import BlogsDetail from '~/components/blog-detail/detail';

export default function Rusts() {
  return <BlogsDetail list={list} />;
}
