import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublished } from './content';
import { getSite, siteText } from './site';
import { localizedItems } from './localized';
import { resolveAuthors, authorName } from './people';
import { localePath, type Locale } from '../i18n';

const site = (ctx: APIContext) => ctx.site ?? new URL(localePath('vi'), 'http://localhost');

/** Feed of news in one language plus every paper (papers have no language). */
export async function newsAndPapersFeed(ctx: APIContext, locale: Locale) {
  const { name, tagline } = siteText(getSite(), locale);
  const [news, papers] = await Promise.all([
    // Vietnamese-only news is not announced in the English feed.
    localizedItems('news', locale).then((l) => l.filter((i) => !i.viOnly)),
    getPublished('papers'),
  ]);
  const paperItems = await Promise.all(
    papers.map(async (p) => ({
      title: p.data.title,
      link: localePath(locale, `/papers/${p.id}/`),
      pubDate: p.data.date,
      description: `${(await resolveAuthors(p.data.authors)).map(authorName).join(', ')} - ${p.data.venue}`,
      categories: p.data.tags,
    })),
  );
  return rss({
    title: name,
    description: tagline,
    site: site(ctx),
    items: [
      ...news.map((n) => ({
        title: n.entry.data.title,
        link: n.href,
        pubDate: n.entry.data.date,
        description: n.entry.data.summary ?? '',
        categories: [n.entry.data.category, ...n.entry.data.tags],
      })),
      ...paperItems,
    ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()),
    customData: `<language>${locale === 'vi' ? 'vi-VN' : 'en-US'}</language>`,
  });
}

export async function papersFeed(ctx: APIContext) {
  const { name } = siteText(getSite(), 'vi');
  const papers = await getPublished('papers');
  const items = await Promise.all(
    papers.map(async (p) => ({
      title: p.data.title,
      link: localePath('vi', `/papers/${p.id}/`),
      pubDate: p.data.date,
      description: `${(await resolveAuthors(p.data.authors)).map(authorName).join(', ')} - ${p.data.venue}`,
      categories: p.data.tags,
    })),
  );
  return rss({
    title: `${name} - Papers`,
    description: `${name} publications`,
    site: site(ctx),
    items,
  });
}
