// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';
import BaseBlogList from '~/components/blog-list';

export default function BlogList() {
  return <BaseBlogList list={list} />;
}
