import { lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Single source of truth for what the CMS buttons may read and write.
 * `name` is the Pages CMS collection name in `.pages.yml`.
 *  - namePrefix: how a new file is named: `day` = YYYY-MM-DD-<slug>, `year` = YYYY-<slug>, `none` = <slug>
 *  - templateDir: where "Tạo từ mẫu" may copy from (absent = button not offered)
 *  - duplicate: "Nhân bản" allowed on entries
 *  - translateTo: "Tạo bản tiếng Anh" allowed; value is the target collection
 *  - fromBibtex: "Tạo từ BibTeX" offered on the list (from-bibtex.mjs only knows the paper schema)
 */
export const COLLECTIONS = {
  'news-vi': {
    dir: 'src/content/news/vi',
    titleField: 'title',
    hasDate: true,
    namePrefix: 'day',
    templateDir: 'templates/news/vi',
    duplicate: true,
    translateTo: 'news-en',
  },
  'news-en': {
    dir: 'src/content/news/en',
    titleField: 'title',
    hasDate: true,
    namePrefix: 'day',
  },
  'projects-vi': {
    dir: 'src/content/projects/vi',
    titleField: 'title',
    hasDate: false,
    namePrefix: 'none',
    templateDir: 'templates/projects/vi',
    duplicate: true,
    translateTo: 'projects-en',
  },
  'projects-en': {
    dir: 'src/content/projects/en',
    titleField: 'title',
    hasDate: false,
    namePrefix: 'none',
  },
  papers: {
    dir: 'src/content/papers',
    titleField: 'title',
    hasDate: true,
    namePrefix: 'year',
    templateDir: 'templates/papers',
    duplicate: true,
    fromBibtex: true,
  },
  members: {
    dir: 'src/content/members',
    titleField: 'name',
    hasDate: false,
    namePrefix: 'none',
    templateDir: 'templates/members',
    duplicate: true,
  },
};

export const SLUG = /^[a-z0-9-]{1,80}$/;
const MAX_SUFFIX = 99;

/** Collection config by name, or an error when the name is not a known collection. */
export function getCollection(name) {
  if (typeof name !== 'string' || !Object.hasOwn(COLLECTIONS, name)) {
    throw new Error(`Collection không được hỗ trợ: ${JSON.stringify(name)}`);
  }
  return { name, ...COLLECTIONS[name] };
}

/** ASCII slug ([a-z0-9-], at most 80 chars) of a Vietnamese or English title. */
export function slugify(text) {
  const slug = String(text)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  if (!SLUG.test(slug))
    throw new Error('Không tạo được tên file từ tiêu đề (cần ít nhất một chữ cái hoặc số)');
  return slug;
}

/** Today as YYYY-MM-DD in Asia/Ho_Chi_Minh, the site's calendar. */
export function todayInVietnam(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * New file name for `title` in `collection`; appends -2, -3, ... until `exists(name)` is false.
 * @param {{ namePrefix: string }} collection
 * @param {{ title: string, date: string }} entry
 * @param {(fileName: string) => boolean} exists
 */
export function fileNameFor(collection, { title, date }, exists) {
  const slug = slugify(title);
  const prefix =
    collection.namePrefix === 'day'
      ? `${date}-`
      : collection.namePrefix === 'year'
        ? `${date.slice(0, 4)}-`
        : '';
  const base = `${prefix}${slug}`;
  for (let n = 1; n <= MAX_SUFFIX; n += 1) {
    const name = `${n === 1 ? base : `${base}-${n}`}.md`;
    if (!exists(name)) return name;
  }
  throw new Error(`Quá nhiều file trùng tên ${base}`);
}

/** Template files a collection may copy from: every `.md` in its template dir except README.md. */
export function listTemplates(collection, root = process.cwd()) {
  if (!collection.templateDir) return [];
  const dir = path.resolve(root, collection.templateDir);
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .filter((e) => !lstatSync(path.join(dir, e.name)).isSymbolicLink())
    .map((e) => `${collection.templateDir}/${e.name}`)
    .sort();
}
