import { t, type Locale } from '../i18n';

type Key = Parameters<typeof t>[1];

/** Translate `${prefix}.${value}` for enum values coming from content (role, category, type...). */
export function label(locale: Locale, prefix: string, value: string): string {
  return t(locale, `${prefix}.${value}` as Key);
}
