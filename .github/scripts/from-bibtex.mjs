import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseBibtex } from '@retorquere/bibtex-parser';
import { stringify } from 'yaml';
import { fileNameFor, getCollection } from './collections.mjs';
import { readFields } from './frontmatter.mjs';
import { parsePayload } from './payload.mjs';
import { safePath } from './safe-path.mjs';

export const ACTIONS = ['from-bibtex'];
const MAX_BIBTEX = 20_000;
const HTTP = /^https?:\/\/\S+$/i;

// BibTeX entry type -> paper `type`; anything else is a preprint (misc, unpublished, techreport...).
const TYPES = {
  inproceedings: 'conference',
  conference: 'conference',
  proceedings: 'conference',
  article: 'journal',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  thesis: 'thesis',
  incollection: 'book-chapter',
  inbook: 'book-chapter',
};

/** Lowercase, single-spaced name; with `ascii`, also accent-free ("Lê Văn Tâm" -> "le van tam"). */
const nameKey = (text, { ascii = false } = {}) => {
  let key = String(text).normalize('NFC').toLowerCase();
  if (ascii)
    key = key
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .replace(/đ/g, 'd');
  return key.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
};

/**
 * Member slugs by exact name and by accent-free name. Two members can share an accent-free
 * name ("Lê Văn Tâm", "Lê Văn Tám"): such a key maps to null so nobody is linked by guesswork.
 */
function memberIndex(root) {
  const dir = path.resolve(root, getCollection('members').dir);
  const exact = new Map();
  const ascii = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const { name } = readFields(readFileSync(path.join(dir, file), 'utf8'));
    if (typeof name !== 'string' || !name.trim()) continue;
    const slug = file.slice(0, -3);
    exact.set(nameKey(name), exact.has(nameKey(name)) ? null : slug);
    const key = nameKey(name, { ascii: true });
    ascii.set(key, ascii.has(key) ? null : slug);
  }
  return { exact, ascii };
}

// The parser renders LaTeX markup ({\em x}, \href) as HTML; frontmatter fields are plain text.
const text = (value) =>
  typeof value === 'string'
    ? value
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

function authorOf(creator, members) {
  const first = text(creator.firstName);
  const prefix = text(creator.prefix);
  const last = text(creator.lastName ?? creator.name);
  const suffix = text(creator.suffix);
  const join = (...parts) => parts.filter(Boolean).join(' ');
  const western = [join(first, prefix, last), suffix].filter(Boolean).join(', ');
  const orders = [join(prefix, last, first), join(first, prefix, last)];
  // Accented input only matches an accented name; accent-free input ("Le, Van Tam") falls back
  // to the accent-free index, which refuses ambiguous keys.
  for (const order of orders) {
    const slug = members.exact.get(nameKey(order));
    if (slug !== undefined) return slug ?? western;
  }
  if (orders.every((order) => nameKey(order) === nameKey(order, { ascii: true }))) {
    for (const order of orders) {
      const slug = members.ascii.get(nameKey(order, { ascii: true }));
      if (slug !== undefined) return slug ?? western;
    }
  }
  return western;
}

// Verbatim fields (url, doi, eprint) keep the `\%` added before parsing; give them back their `%`.
const verbatim = (value) => text(value).replace(/\\%/g, '%');
const ARXIV_ID = /^[\w./-]+$/;

/** arXiv id from eprint fields, a Scholar-style `journal={arXiv preprint arXiv:…}`, a URL or a DataCite DOI. */
function arxivIdOf(fields) {
  const eprint = verbatim(fields.eprint);
  const kind = text(fields.archiveprefix) || text(fields.eprinttype);
  if (eprint && /^arxiv$/i.test(kind) && ARXIV_ID.test(eprint)) return eprint;
  const sources = [text(fields.journal), verbatim(fields.url), verbatim(fields.doi)];
  for (const source of sources) {
    const id =
      /arxiv[:.](\d{4}\.\d{4,5}(?:v\d+)?)/i.exec(source)?.[1] ??
      /arxiv\.org\/(?:abs|pdf)\/([\w./-]+?)(?:\.pdf)?$/i.exec(source)?.[1];
    if (id) return id;
  }
  return null;
}

function linksOf(fields, arxivId) {
  const links = {};
  const doi = verbatim(fields.doi).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '');
  if (doi && !/\s/.test(doi)) links.doi = `https://doi.org/${doi}`;
  if (arxivId) links.arxiv = `https://arxiv.org/abs/${arxivId}`;
  const url = verbatim(fields.url);
  if (HTTP.test(url) && !/arxiv\.org\//i.test(url)) {
    if (/\.pdf($|[?#])/i.test(url)) links.pdf = url;
    else if (!doi || !url.toLowerCase().includes(doi.toLowerCase())) links.website = url;
  }
  return links;
}

/** YYYY-MM-01 from `year` + `month`, or from a biblatex `date` (YYYY or YYYY-MM...). */
function dateOf(fields) {
  const [, dateYear, dateMonth] = /^(\d{4})(?:-(\d{2}))?/.exec(text(fields.date)) ?? [];
  const year = /^\d{4}$/.test(text(fields.year)) ? text(fields.year) : dateYear;
  if (!year) throw new Error('BibTeX thiếu year (4 chữ số)');
  const month = Number.parseInt(text(fields.month) || dateMonth, 10);
  return `${year}-${String(month >= 1 && month <= 12 ? month : 1).padStart(2, '0')}-01`;
}

/**
 * Build a draft paper from the BibTeX a writer pasted. Pure apart from reads under `root`;
 * nothing is written. Throws a Vietnamese error message for every rejected request.
 *
 * @param {ReturnType<typeof parsePayload>} payload
 * @param {{ root?: string }} [options]
 * @returns {{ dest: string, content: string, message: string }}
 */
export function planFromBibtex(payload, { root = process.cwd() } = {}) {
  const { context, inputs } = payload;
  if (context.type !== 'collection') throw new Error('"Tạo từ BibTeX" chỉ dùng ở danh sách Papers');
  const collection = getCollection(context.name);
  if (collection.name !== 'papers') throw new Error('"Tạo từ BibTeX" chỉ dùng cho Papers');
  if (context.path !== collection.dir) throw new Error('Thư mục đích không khớp collection');

  const source = typeof inputs.bibtex === 'string' ? inputs.bibtex.trim() : '';
  if (!source) throw new Error('Chưa dán BibTeX');
  if (source.length > MAX_BIBTEX) throw new Error(`BibTeX dài quá ${MAX_BIBTEX} ký tự`);

  // A bare `%` starts a TeX comment and silently cuts a field ("99% accuracy" -> "99"), but
  // pasted titles and abstracts use it as a percent sign.
  const escaped = source.replace(/(?<!\\)%/g, '\\%');
  const options = { sentenceCase: false, unsupported: 'ignore' };
  const parsed = parseBibtex(escaped, options);
  if (parsed.errors.length > 0) {
    throw new Error(
      `BibTeX lỗi: ${String(parsed.errors[0].error ?? parsed.errors[0]).split('\n')[0]}`,
    );
  }
  if (parsed.entries.length !== 1) {
    throw new Error(`Cần đúng một mục BibTeX, nhận được ${parsed.entries.length}`);
  }
  const [entry] = parsed.entries;
  const { fields } = entry;

  const title = text(fields.title);
  if (!title || title.length > 300) throw new Error('BibTeX thiếu title (hoặc title quá dài)');
  const date = dateOf(fields);

  const members = memberIndex(root);
  const authors = (fields.author ?? [])
    .filter((c) => text(c.lastName ?? c.name).toLowerCase() !== 'others')
    .map((c) => authorOf(c, members))
    .filter(Boolean);
  if (authors.length === 0) throw new Error('BibTeX thiếu author');

  const arxivId = arxivIdOf(fields);
  let venue =
    text(fields.booktitle) || text(fields.journal) || text(fields.school) || text(fields.publisher);
  let type = TYPES[entry.type.toLowerCase()] ?? 'preprint';
  if (type === 'conference' && /workshop/i.test(venue)) type = 'workshop';
  // Scholar and DBLP export arXiv preprints as @article in "arXiv preprint …" or "CoRR".
  if (type === 'journal' && /^(arxiv\b|corr$)/i.test(venue)) type = 'preprint';
  if (type === 'preprint' && arxivId && (!venue || /^(arxiv\b|corr$)/i.test(venue)))
    venue = 'arXiv';
  const links = linksOf(fields, arxivId);
  const tags = (Array.isArray(fields.keywords) ? fields.keywords : [])
    .map(text)
    .filter(Boolean)
    .slice(0, 10);

  const data = {
    title,
    date,
    authors,
    venue: venue || '[[Tên hội nghị/tạp chí]]',
    type,
    status: type === 'preprint' ? 'preprint' : 'published',
    draft: true,
    ...(Object.keys(links).length > 0 && { links }),
    projects: [],
    tags,
    featured: false,
    bibtex: source,
  };
  // The abstract keeps its TeX ($…$ math) for the site's KaTeX; the converted text mangles formulas.
  const rawAbstract = parseBibtex(escaped, { ...options, raw: true }).entries[0]?.fields.abstract;
  const abstract =
    typeof rawAbstract === 'string'
      ? rawAbstract.replace(/\\%/g, '%').replace(/\s+/g, ' ').trim()
      : '';
  const body = `**Tóm tắt.** ${abstract || '[[Abstract của paper]]'}\n`;
  const content = `---\n${stringify(data, { lineWidth: 0 })}---\n\n${body}`;

  const name = fileNameFor(collection, { title, date }, (n) =>
    existsSync(path.resolve(root, collection.dir, n)),
  );
  const dest = `${collection.dir}/${name}`;
  safePath(dest, { allowPrefixes: [collection.dir], ext: ['.md'], root });
  return { dest, content, message: `content: add ${name} from BibTeX (draft)` };
}

/** Write the planned file (never overwriting) and return its repo-relative path. */
export function applyPlan(plan, root = process.cwd()) {
  writeFileSync(path.resolve(root, plan.dest), plan.content, { flag: 'wx' });
  return plan.dest;
}

function main() {
  const payload = parsePayload(process.env.PAYLOAD, ACTIONS);
  const plan = planFromBibtex(payload);
  applyPlan(plan);
  console.log(`from-bibtex: ${plan.dest}`);
  if (process.env.COMMIT_MESSAGE_FILE)
    writeFileSync(process.env.COMMIT_MESSAGE_FILE, `${plan.message}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Đã tạo paper nháp từ BibTeX\n\n- Bài mới: \`${plan.dest}\` (draft: true)\n`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const message = String(error.message).replace(/[\r\n]+/g, ' ');
    console.error(`::error::${message}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Không thực hiện được\n\n${message}\n`);
    }
    process.exit(1);
  }
}
