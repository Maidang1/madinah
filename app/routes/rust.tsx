// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:rust-list';
import BaseBlogList from '~/components/blog-list/list';

export default function BlogList() {
  return <BaseBlogList list={list} />;
}
