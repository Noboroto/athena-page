import type { CollectionEntry } from 'astro:content';
import { getPublished } from './content';
import { localePath, type Locale } from '../i18n';

type LocalizedName = 'news' | 'projects';

export interface LocalizedItem<C extends LocalizedName> {
  entry: CollectionEntry<C>;
  slug: string;
  /** Language of the entry itself (a Vietnamese item on the English list keeps `vi`). */
  lang: Locale;
  viOnly: boolean;
  href: string;
}

/**
 * Items for a list page. The English list also carries entries that only exist in
 * Vietnamese: flagged `viOnly`, linking to the Vietnamese URL (no fallback pages are built).
 */
export async function localizedItems<C extends LocalizedName>(
  name: C,
  locale: Locale,
): Promise<LocalizedItem<C>[]> {
  const [own, vi] = await Promise.all([
    getPublished(name, { locale }),
    locale === 'en' ? getPublished(name, { locale: 'vi' }) : Promise.resolve([]),
  ]);
  const slugOf = (id: string) => id.slice(id.indexOf('/') + 1);
  const make = (entry: CollectionEntry<C>, lang: Locale, viOnly: boolean): LocalizedItem<C> => {
    const slug = slugOf(entry.id);
    return { entry, slug, lang, viOnly, href: localePath(lang, `/${name}/${slug}/`) };
  };
  const items = own.map((e) => make(e, locale, false));
  if (locale === 'en') {
    const have = new Set(items.map((i) => i.slug));
    for (const e of vi) if (!have.has(slugOf(e.id))) items.push(make(e, 'vi', true));
  }
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
