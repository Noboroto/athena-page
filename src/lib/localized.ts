import type { CollectionEntry } from 'astro:content';
import { getPublished } from './content';
import { LOCALES, localePath, type Locale } from '../i18n';

type LocalizedName = 'news' | 'projects';

export interface LocalizedItem<C extends LocalizedName> {
  entry: CollectionEntry<C>;
  slug: string;
  /** Language of the entry itself (a Vietnamese item on the English list keeps `vi`). */
  lang: Locale;
  /** Entry only exists in the other language and stands in for the missing translation. */
  fallback: boolean;
  href: string;
}

/**
 * Items for a list page. Each list also carries entries that only exist in the other
 * language: flagged `fallback`, linking to that language's URL (no fallback pages are built).
 */
export async function localizedItems<C extends LocalizedName>(
  name: C,
  locale: Locale,
): Promise<LocalizedItem<C>[]> {
  const other = LOCALES.find((l) => l !== locale)!;
  const [own, rest] = await Promise.all([
    getPublished(name, { locale }),
    getPublished(name, { locale: other }),
  ]);
  const slugOf = (id: string) => id.slice(id.indexOf('/') + 1);
  const make = (entry: CollectionEntry<C>, lang: Locale, fallback: boolean): LocalizedItem<C> => {
    const slug = slugOf(entry.id);
    return { entry, slug, lang, fallback, href: localePath(lang, `/${name}/${slug}/`) };
  };
  const items = own.map((e) => make(e, locale, false));
  const have = new Set(items.map((i) => i.slug));
  for (const e of rest) if (!have.has(slugOf(e.id))) items.push(make(e, other, true));
  const key = (i: LocalizedItem<C>) => {
    const d = (i.entry.data as { date?: Date }).date;
    return d ? d.valueOf() : 0;
  };
  const order = (i: LocalizedItem<C>) => (i.entry.data as { order?: number }).order ?? 0;
  return items.sort((a, b) =>
    name === 'news'
      ? key(b) - key(a) || a.slug.localeCompare(b.slug)
      : order(a) - order(b) || a.slug.localeCompare(b.slug),
  );
}
