import { isLocale, type Locale } from '../i18n';

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Splits a request pathname into its locale and the locale-independent rest ("/news/x/"). */
export function splitPath(pathname: string): { locale: Locale; rest: string } {
  let p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  p = p.startsWith('/') ? p : `/${p}`;
  const [, first, ...tail] = p.split('/');
  if (isLocale(first) && first === 'en') return { locale: 'en', rest: `/${tail.join('/')}` };
  return { locale: 'vi', rest: p };
}
