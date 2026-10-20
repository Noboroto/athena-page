import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';

type Name = 'members' | 'papers' | 'projects' | 'news';
const LOCALIZED: ReadonlySet<Name> = new Set(['projects', 'news']);

let quarantined: Set<string> | undefined;

/** Files isolated by the CI content check (JSON array of repo-relative paths). */
function getQuarantine(): Set<string> {
  if (!quarantined) {
    const file = path.resolve(process.cwd(), 'src/.quarantine.json');
    const list: unknown = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    quarantined = new Set(Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []);
  }
  return quarantined;
}

/**
 * Published entries, newest first. Production hides drafts and quarantined files.
 * Future dates are intentionally NOT filtered: only `draft` decides visibility.
 */
export async function getPublished<C extends Name>(
  name: C,
  opts: { locale?: Locale } = {},
): Promise<CollectionEntry<C>[]> {
  const prod = import.meta.env.PROD;
  const quarantine = prod ? getQuarantine() : new Set<string>();
  const prefix = opts.locale && LOCALIZED.has(name) ? `${opts.locale}/` : undefined;

  const entries = await getCollection(name, (entry) => {
    if (prefix && !entry.id.startsWith(prefix)) return false;
    if (prod && (entry.data as { draft?: boolean }).draft) return false;
    return !(entry.filePath && quarantine.has(entry.filePath));
  });

  const time = (e: CollectionEntry<C>) => {
    const d = (e.data as { date?: Date }).date;
    return d ? d.valueOf() : 0;
  };
  return entries.sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id));
}

/** Which language versions of a localized entry exist (by slug, drafts excluded in production). */
export async function getTranslation(
  name: 'projects' | 'news',
  slug: string,
): Promise<{ vi?: CollectionEntry<typeof name>; en?: CollectionEntry<typeof name> }> {
  const [vi, en] = await Promise.all([
    getPublished(name, { locale: 'vi' }),
    getPublished(name, { locale: 'en' }),
  ]);
  return {
    vi: vi.find((e) => e.id === `vi/${slug}`),
    en: en.find((e) => e.id === `en/${slug}`),
  };
}
