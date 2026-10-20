import type { CollectionEntry } from 'astro:content';
import { toSlug } from '../../scripts/lib/slug.mjs';
import { getPublished } from './content';
import { localizedItems, type LocalizedItem } from './localized';
import type { Locale } from '../i18n';

export type Member = CollectionEntry<'members'>;
export type Author = { member: Member } | { name: string };

let members: Promise<Map<string, Member>> | undefined;

/** Published members keyed by slug. */
export function memberMap(): Promise<Map<string, Member>> {
  members ??= getPublished('members').then((list) => new Map(list.map((m) => [m.id, m])));
  return members;
}

/** Paper authors: a member slug becomes the member, anything else stays a plain name. */
export async function resolveAuthors(list: string[]): Promise<Author[]> {
  const map = await memberMap();
  return list.map((raw) => {
    const member = map.get(toSlug(raw));
    return member ? { member } : { name: raw };
  });
}

export const authorName = (a: Author) => ('member' in a ? a.member.data.name : a.name);

export interface MemberItems {
  papers: CollectionEntry<'papers'>[];
  projects: LocalizedItem<'projects'>[];
  news: LocalizedItem<'news'>[];
}

/** Everything that references a member: papers (authors), projects (members), news (members/author). */
export async function itemsForMember(slug: string, locale: Locale): Promise<MemberItems> {
  const [papers, projects, news] = await Promise.all([
    getPublished('papers'),
    localizedItems('projects', locale),
    localizedItems('news', locale),
  ]);
  return {
    papers: papers.filter((p) => p.data.authors.some((a) => toSlug(a) === slug)),
    projects: projects.filter((p) => p.entry.data.members.includes(slug)),
    news: news.filter((n) => n.entry.data.members.includes(slug) || n.entry.data.author === slug),
  };
}

/** Sort key used inside role groups: `order`, then name. */
export function byOrderThenName(locale: Locale) {
  return (a: Member, b: Member) =>
    a.data.order - b.data.order || a.data.name.localeCompare(b.data.name, locale);
}
