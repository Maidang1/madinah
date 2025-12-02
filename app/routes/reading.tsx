import { json } from '@remix-run/cloudflare';
import type { MetaFunction } from '@remix-run/cloudflare';
import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from '@remix-run/react';
import { ErrorState } from '~/core/ui/common/error-state';
import { jsonError } from '~/core/utils';
import { DEFAULT_LOCALE, getT } from '~/core/i18n';
import { useTranslation } from '~/core/i18n';

export async function loader() {
  try {
    // TODO: Implement reading data loading
    // For now, we'll return an empty array
    return json({ readingList: [] });
  } catch (error) {
    console.error('Failed to load reading data', error);
    throw jsonError('Failed to load reading data', { status: 500 });
  }
}

export const meta: MetaFunction = ({ matches }) => {
  const rootData = matches.find((m) => m.id === 'root')?.data as any;
  const locale = (rootData?.locale ?? DEFAULT_LOCALE) as typeof DEFAULT_LOCALE;
  const t = getT(locale);
  const metaDict = t('reading.meta') as any;
  return [
    { title: metaDict?.title ?? 'Reading • Madinah' },
    { name: 'description', content: metaDict?.description ?? 'Books I have read and reflections on them.' },
  ];
};

export default function ReadingRoute() {
  const { readingList } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  // TODO: Implement reading list display
  // For now, we'll show a placeholder message
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-foreground text-3xl font-bold">
          {t('header.navigation.reading')}
        </h1>
        <p className="text-muted-foreground">{t('reading.description')}</p>
      </header>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-muted-foreground text-lg">
          {t('reading.emptyState')}
        </p>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title={t('reading.errors.loadTitle')}
        message={
          typeof error.data === 'string'
            ? error.data
            : (error.data?.error ?? error.statusText)
        }
        action={
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            {t('reading.goHome')}
          </Link>
        }
      />
    );
  }

  return (
    <ErrorState
      title={t('reading.errors.renderTitle')}
      message={
        error instanceof Error
          ? error.message
          : t('reading.errors.renderMessage')
      }
      action={
        <Link
          to="/"
          className="inline-flex items-center rounded-full bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
        >
          {t('reading.goHome')}
        </Link>
      }
    />
  );
}
