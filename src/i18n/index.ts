import vi from './vi.json';
import en from './en.json';
import { withBase } from '../lib/url';

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'vi';

type Key = keyof typeof vi;
const dictionaries: Record<Locale, Record<Key, string>> = { vi, en };

export function isLocale(value: unknown): value is Locale {
  return value === 'vi' || value === 'en';
}

/** Locale from the `[...locale]` route param; absent means the default locale. */
export function localeFromParam(param: string | undefined): Locale {
  return isLocale(param) ? param : DEFAULT_LOCALE;
}

export function t(locale: Locale, key: Key): string {
  return dictionaries[locale][key];
}

/** Site path for a locale, base included: localePath('en', '/news/') -> "/en/news/". */
export function localePath(locale: Locale, path = '/'): string {
  const clean = `/${path.replace(/^\/+/, '')}`;
  return withBase(locale === DEFAULT_LOCALE ? clean : `/${locale}${clean === '/' ? '/' : clean}`);
}
