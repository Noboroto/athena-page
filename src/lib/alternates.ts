import type { Locale } from '../i18n';

export interface HreflangLink {
  hreflang: string;
  href: string;
}

const HREFLANG: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' };

/**
 * hreflang alternates for a page that exists in several languages. Only emitted when
 * BOTH versions exist, otherwise search engines get a dangling pointer.
 */
export function hreflangFor(
  pair: Partial<Record<Locale, string>>,
  origin: URL | string,
): HreflangLink[] {
  const { vi, en } = pair;
  if (!vi || !en) return [];
  const abs = (p: string) => new URL(p, origin).href;
  return [
    { hreflang: HREFLANG.vi, href: abs(vi) },
    { hreflang: HREFLANG.en, href: abs(en) },
    { hreflang: 'x-default', href: abs(vi) },
  ];
}
