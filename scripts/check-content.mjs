import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { splitFrontmatter } from './lib/frontmatter.mjs';
import { toSlug } from './lib/slug.mjs';

const CONTENT_DIR = 'src/content';
const QUARANTINE_JSON = 'src/.quarantine.json';
const QUARANTINE_MD = 'quarantine.md';
// `[[`, and every variant the rich-text editor produces by escaping brackets (`\[\[`, `\[[`, `[\[`).
const PLACEHOLDER = /\\?\[\\?\[/;
const KEBAB_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_FIELDS = ['avatar', 'cover'];
// field -> which slug set it must resolve in
const REFERENCES = {
  author: 'memberSlugs',
  members: 'memberSlugs',
  projects: 'projectSlugs',
  papers: 'paperSlugs',
};

const posix = (p) => p.split(path.sep).join('/');

/**
 * File names a member called `name` can have, as either generator spells them: the CMS drops `'` and
 * `.` ("O'Brien" -> obrien), the clone scripts turn them into a hyphen (o-brien).
 */
const memberSlugsFor = (name) => {
  const ascii = name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
  const slug = (text) =>
    text
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .join('-');
  return new Set([slug(ascii), slug(ascii.replace(/['’.]/g, ''))]);
};

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

const isMarkdown = (name) => name.endsWith('.md');

// Only published (non-draft) entries are valid reference targets: a published item must not
// point at a draft that never reaches the site. Unreadable frontmatter is reported elsewhere.
function slugsIn(root, sub) {
  const files = walk(path.join(root, CONTENT_DIR, sub), isMarkdown);
  const published = files.filter((f) => {
    const { data, error } = splitFrontmatter(readFileSync(f, 'utf8'));
    return !error && data.draft !== true;
  });
  return new Set(published.map((f) => toSlug(f)));
}

/** Lookup tables built once per run and shared by every `checkFile` call. */
export function buildContext(root) {
  const publicDir = path.join(root, 'public');
  return {
    memberSlugs: slugsIn(root, 'members'),
    projectSlugs: slugsIn(root, 'projects'),
    paperSlugs: slugsIn(root, 'papers'),
    publicFiles: new Set(
      walk(publicDir, () => true).map((f) => posix(path.relative(publicDir, f))),
    ),
  };
}

function asList(value) {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string' && v.trim());
}

/**
 * Check one content file.
 * `structuralErrors`: unreadable frontmatter (always fatal). `contentErrors`: leftovers and
 * dangling links in a published file (fatal locally, quarantined in CI). Drafts get no content errors.
 */
export function checkFile(relPath, raw, ctx) {
  const contentErrors = [];
  const { data, error } = splitFrontmatter(raw);
  if (error) return { contentErrors, structuralErrors: [error] };
  if (data.draft === true) return { contentErrors, structuralErrors: [] };

  // Content ids come from the file name (see generateId in content.config.ts), so it must be a clean slug.
  if (!KEBAB_NAME.test(toSlug(relPath))) {
    contentErrors.push(
      `tên file "${path.posix.basename(relPath)}" phải là kebab-case (a-z, 0-9, dấu gạch ngang)`,
    );
  }

  // A member's page URL and every reference to it use the file name, and the name is locked in the
  // CMS once the entry exists. A name that no longer spells the file name was changed around that
  // lock, most likely by typing someone else's profile over this entry.
  if (relPath.startsWith(`${CONTENT_DIR}/members/`) && typeof data.name === 'string') {
    // Duplicate names get a numeric suffix; older CMS file names spell Đ/đ as "dj" (slugify's default).
    const file = toSlug(relPath).replace(/dj/g, 'd');
    const slugs = memberSlugsFor(data.name);
    if (!slugs.has(file) && !slugs.has(file.replace(/-\d+$/, ''))) {
      contentErrors.push(
        `Họ tên "${data.name}" không khớp tên file "${path.posix.basename(relPath)}": Họ tên quyết định đường dẫn trang nên không được đổi. Nếu hồ sơ một người khác đã được gõ đè lên bài này, sửa lại về đúng người cũ rồi tạo bài mới cho người mới; nếu đúng là người này đổi tên, báo admin`,
      );
    }
  }

  raw.split(/\r?\n/).forEach((line, i) => {
    if (PLACEHOLDER.test(line)) {
      contentErrors.push(
        `dòng ${i + 1}: còn placeholder [[…]] – điền nội dung hoặc đặt draft: true`,
      );
    }
  });

  for (const field of IMAGE_FIELDS) {
    const value = data[field];
    if (typeof value !== 'string' || !value.startsWith('/')) continue;
    if (!ctx.publicFiles.has(value.replace(/^\/+/, '').split(/[?#]/)[0])) {
      contentErrors.push(`${field}: không tìm thấy ảnh "${value}" trong public/`);
    }
  }

  for (const [field, setName] of Object.entries(REFERENCES)) {
    for (const ref of asList(data[field])) {
      if (!ctx[setName].has(toSlug(ref))) {
        contentErrors.push(`${field}: "${ref}" không trỏ tới bản ghi nào`);
      }
    }
  }
  return { contentErrors, structuralErrors: [] };
}

/** Placeholder values must not ship: `example.com` addresses in site.yml are errors. */
export function checkSiteData(raw) {
  let data;
  try {
    data = parseYaml(raw);
  } catch (err) {
    return [`không đọc được site.yml: ${err.message}`];
  }
  const email = data?.contact_email;
  if (typeof email === 'string' && /@(?:[\w-]+\.)*example\.(?:com|org|net)$/i.test(email.trim())) {
    return [`contact_email: "${email}" là email mẫu (example.com) – điền email thật hoặc để trống`];
  }
  return [];
}

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** Messages for keys present in one dictionary but not the other. */
export function checkI18nKeys(vi, en) {
  const viKeys = new Set(flatten(vi));
  const enKeys = new Set(flatten(en));
  return [
    ...[...viKeys].filter((k) => !enKeys.has(k)).map((k) => `thiếu key "${k}" trong en.json`),
    ...[...enKeys].filter((k) => !viKeys.has(k)).map((k) => `thiếu key "${k}" trong vi.json`),
  ];
}

/** Scan every content file plus the i18n dictionaries. Errors are `{ file, message }`. */
export function checkAll(root) {
  const ctx = buildContext(root);
  const contentErrors = [];
  const structuralErrors = [];
  const files = walk(path.join(root, CONTENT_DIR), isMarkdown);

  for (const full of files) {
    const rel = posix(path.relative(root, full));
    const result = checkFile(rel, readFileSync(full, 'utf8'), ctx);
    for (const message of result.contentErrors) contentErrors.push({ file: rel, message });
    for (const message of result.structuralErrors) structuralErrors.push({ file: rel, message });
  }

  const i18n = (lang) => path.join(root, 'src/i18n', `${lang}.json`);
  try {
    const vi = JSON.parse(readFileSync(i18n('vi'), 'utf8'));
    const en = JSON.parse(readFileSync(i18n('en'), 'utf8'));
    for (const message of checkI18nKeys(vi, en)) {
      structuralErrors.push({ file: 'src/i18n', message });
    }
  } catch (err) {
    structuralErrors.push({ file: 'src/i18n', message: `không đọc được từ điển: ${err.message}` });
  }
  const siteFile = path.join(root, 'src/data/site.yml');
  if (existsSync(siteFile)) {
    for (const message of checkSiteData(readFileSync(siteFile, 'utf8'))) {
      structuralErrors.push({ file: 'src/data/site.yml', message });
    }
  }
  return { files: files.length, contentErrors, structuralErrors };
}

const format = (errors) => errors.map((e) => `${e.file}: ${e.message}`);

function quarantineReport(errors) {
  const byFile = new Map();
  for (const e of errors) byFile.set(e.file, [...(byFile.get(e.file) ?? []), e.message]);
  const lines = ['## Bài bị cách ly (không lên site)', ''];
  for (const [file, messages] of byFile) {
    lines.push(`- \`${file}\``, ...messages.map((m) => `  - ${m}`));
  }
  lines.push('', 'Sửa các lỗi trên (hoặc đặt `draft: true`) rồi lưu lại để bài lên site.', '');
  return { files: [...byFile.keys()], markdown: lines.join('\n') };
}

/** Entry point. Returns the process exit code; all I/O goes through `log`/`env`. */
export function run({ root, quarantine = false, env = process.env, log = console.error }) {
  const { files, contentErrors, structuralErrors } = checkAll(root);
  const jsonPath = path.join(root, QUARANTINE_JSON);
  const mdPath = path.join(root, QUARANTINE_MD);

  if (structuralErrors.length > 0) {
    for (const line of format(structuralErrors)) log(line);
    log(`check-content: ${structuralErrors.length} lỗi cấu trúc – dừng.`);
    return 1;
  }

  // A stale quarantine list from an earlier run must never hide posts.
  rmSync(jsonPath, { force: true });
  rmSync(mdPath, { force: true });

  if (contentErrors.length === 0) {
    if (quarantine) writeFileSync(jsonPath, '[]\n');
    log(`check-content: ${files} file ổn.`);
    return 0;
  }
  if (!quarantine) {
    for (const line of format(contentErrors)) log(line);
    log(`check-content: ${contentErrors.length} lỗi nội dung.`);
    return 1;
  }

  const { files: bad, markdown } = quarantineReport(contentErrors);
  writeFileSync(jsonPath, `${JSON.stringify(bad, null, 2)}\n`);
  writeFileSync(mdPath, markdown);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  for (const line of format(contentErrors)) log(line);
  log(`check-content: cách ly ${bad.length} file, phần còn lại vẫn build.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.exit(run({ root, quarantine: process.argv.includes('--quarantine') }));
}
