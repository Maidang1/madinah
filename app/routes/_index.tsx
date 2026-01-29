// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';
import BaseBlogList from '~/features/blog/components/blog-list/list';
import { Hero } from '~/core/ui/layout/hero';
import { useTranslation } from '~/core/i18n';

export default function Index() {
  const { t } = useTranslation();
  return (
    <div>
      <Hero />
      <BaseBlogList list={list} />
    </div>
  );
}
