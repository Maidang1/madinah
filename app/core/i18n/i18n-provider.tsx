import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import type { Locale } from '~/types';
import { useLocale } from '~/core/hooks/use-locale';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  translations,
  type TranslationValue,
} from './translations';

interface TranslateOptions<T> {
  fallback?: T;
  replace?: Record<string, string | number>;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: readonly Locale[];
  isSubmitting: boolean;
  t: <T = string>(key: string, options?: TranslateOptions<T>) => T;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const resolveKey = (
  dictionary: TranslationValue,
  key: string,
): TranslationValue | undefined => {
  if (dictionary === undefined || dictionary === null) {
    return undefined;
  }

  return key.split('.').reduce<TranslationValue | undefined>((acc, part) => {
    if (
      acc === undefined ||
      acc === null ||
      typeof acc !== 'object' ||
      Array.isArray(acc)
    ) {
      return undefined;
    }

    return (acc as Record<string, TranslationValue>)[part];
  }, dictionary);
};

const applyReplacements = (
  value: string,
  replacements?: Record<string, string | number>,
) => {
  if (!replacements) {
    return value;
  }

  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
    if (token in replacements) {
      return String(replacements[token]);
    }
    return match;
  });
};

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const {
    locale,
    setLocale,
    isSubmitting,
  } = useLocale(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const translate = useCallback(
    <T,>(key: string, options?: TranslateOptions<T>) => {
      const targetLocale = translations[locale] ?? translations[DEFAULT_LOCALE];
      const fallbackLocale =
        translations[FALLBACK_LOCALE] ?? translations[DEFAULT_LOCALE];

      const resolved =
        resolveKey(targetLocale, key) ?? resolveKey(fallbackLocale, key);

      if (resolved === undefined) {
        return (options?.fallback ?? (key as unknown)) as T;
      }

      if (typeof resolved === 'string') {
        return applyReplacements(resolved, options?.replace) as unknown as T;
      }

      return resolved as T;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      availableLocales: SUPPORTED_LOCALES,
      isSubmitting,
      t: translate,
    }),
    [locale, setLocale, translate, isSubmitting],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(namespace?: string) {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider.');
  }

  const prefix = namespace ? `${namespace}.` : '';

  const namespacedTranslate = useCallback(
    <T,>(key: string, options?: TranslateOptions<T>) =>
      context.t<T>(`${prefix}${key}`, options),
    [context, prefix],
  );

  return useMemo(
    () => ({
      locale: context.locale,
      setLocale: context.setLocale,
      availableLocales: context.availableLocales,
      isSubmitting: context.isSubmitting,
      t: namespacedTranslate,
    }),
    [context.availableLocales, context.isSubmitting, context.locale, context.setLocale, namespacedTranslate],
  );
}
