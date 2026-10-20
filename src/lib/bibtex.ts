import type { CollectionEntry } from 'astro:content';

type Paper = CollectionEntry<'papers'>;

const ENTRY_TYPE: Record<Paper['data']['type'], { type: string; venueField: string }> = {
  conference: { type: 'inproceedings', venueField: 'booktitle' },
  workshop: { type: 'inproceedings', venueField: 'booktitle' },
  journal: { type: 'article', venueField: 'journal' },
  'book-chapter': { type: 'incollection', venueField: 'booktitle' },
  thesis: { type: 'phdthesis', venueField: 'school' },
  preprint: { type: 'misc', venueField: 'howpublished' },
};

const ascii = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '');

// Escape the characters that break a BibTeX field but keep `$`, `_`, `^` so inline math survives.
const escapeField = (s: string) => s.replace(/([&%#])/g, '\\$1').replace(/[{}]/g, '');

function citeKey(paper: Paper, authors: string[]): string {
  const first = authors[0] ?? 'anon';
  const family = ascii(first.trim().split(/\s+/).at(-1) ?? 'anon').toLowerCase() || 'anon';
  const word = ascii(
    paper.data.title.split(/\s+/).find((w) => ascii(w).length > 3) ?? '',
  ).toLowerCase();
  return `${family}${paper.data.date.getUTCFullYear()}${word}`;
}

/**
 * Minimal BibTeX entry for papers whose `bibtex` field is empty.
 * `authorNames` are display names (members resolved), in author order.
 */
export function toBibtex(paper: Paper, authorNames: string[] = paper.data.authors): string {
  const { title, venue, date, type, links } = paper.data;
  const { type: entryType, venueField } = ENTRY_TYPE[type];
  const url = links.doi ?? links.arxiv ?? links.pdf;
  const fields: [string, string][] = [
    ['title', escapeField(title)],
    ['author', escapeField(authorNames.join(' and '))],
    [venueField, escapeField(venue)],
    ['year', String(date.getUTCFullYear())],
  ];
  if (url && /^https?:\/\//i.test(url)) fields.push(['url', url]);
  const body = fields.map(([k, v]) => `  ${k} = {${v}}`).join(',\n');
  return `@${entryType}{${citeKey(paper, authorNames)},\n${body}\n}`;
}

/** The author-supplied BibTeX when present, otherwise a generated minimal entry. */
export function bibtexFor(paper: Paper, authorNames?: string[]): string {
  return paper.data.bibtex?.trim() || toBibtex(paper, authorNames);
}
