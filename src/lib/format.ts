import type { Locale } from '../i18n';

const INTL: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' };

/** Content dates are plain calendar dates stored as UTC midnight; format in UTC to avoid day shifts. */
export function formatDate(date: Date, locale: Locale, style: 'long' | 'month' = 'long'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { month: 'long', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(INTL[locale], opts).format(date);
}

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
