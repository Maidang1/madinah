import { atom, useAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useFetcher } from '@remix-run/react';
import { useCallback, useEffect, useRef } from 'react';
import type { Locale } from '~/types';

export const localeAtom = atom<Locale>('en');

const isValidLocale = (value: unknown): value is Locale =>
  value === 'en' || value === 'zh';

export function useLocale(initialLocale: Locale) {
  useHydrateAtoms([[localeAtom, initialLocale]]);

  const [locale, setLocale] = useAtom(localeAtom);
  const fetcher = useFetcher();
  const previousLocale = useRef<Locale>(initialLocale);

  useEffect(() => {
    if (!isValidLocale(locale)) {
      return;
    }

    if (previousLocale.current === locale) {
      return;
    }

    previousLocale.current = locale;
    fetcher.submit(
      { locale },
      {
        method: 'post',
        action: '/',
      },
    );
  }, [fetcher, locale]);

  const updateLocale = useCallback(
    (value: Locale) => {
      if (!isValidLocale(value) || value === locale) {
        return;
      }
      setLocale(value);
    },
    [locale, setLocale],
  );

  return {
    locale,
    setLocale: updateLocale,
    isSubmitting: fetcher.state !== 'idle',
  };
}
