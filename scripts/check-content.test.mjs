import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFile, checkI18nKeys, checkSiteData, checkAll, run } from './check-content.mjs';
import { splitFrontmatter } from './lib/frontmatter.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {
  memberSlugs: new Set(['nguyen-van-a']),
  projectSlugs: new Set(['du-an-1']),
  paperSlugs: new Set(['paper-1']),
  publicFiles: new Set(['images/members/a.webp']),
};
const doc = (front, body = 'Nội dung') => `---\n${front}\n---\n\n${body}\n`;
const check = (raw) => checkFile('src/content/news/vi/x.md', raw, ctx);

test('placeholder in body of a published file is a content error', () => {
  const r = check(doc('title: "ok"\ndraft: false', 'Chúc mừng [[Họ tên]]'));
  assert.equal(r.contentErrors.length, 1);
  assert.match(r.contentErrors[0], /dòng 6/);
});

test('Tiptap-escaped placeholder is caught', () => {
  for (const text of ['\\[\\[Họ tên\\]\\]', '\\[[Họ tên]]', '[\\[Họ tên]]']) {
    assert.equal(check(doc('title: "ok"', text)).contentErrors.length, 1, text);
  }
});

test('draft: true skips content checks, missing draft does not', () => {
  assert.equal(
    check(doc('title: "[[x]]"\ndraft: true\navatar: /images/none.png')).contentErrors.length,
    0,
  );
  assert.equal(check(doc('title: "[[Họ tên]] tốt nghiệp"')).contentErrors.length, 1);
});

test('missing avatar/cover image is an error, existing one is fine', () => {
  assert.equal(check(doc('title: a\navatar: /images/members/a.webp')).contentErrors.length, 0);
  assert.match(check(doc('title: a\navatar: /images/members/x.webp')).contentErrors[0], /avatar/);
  assert.match(check(doc('title: a\ncover: /images/news/x.png')).contentErrors[0], /cover/);
});

test('references are normalised with toSlug before lookup', () => {
  const ok = check(
    doc(
      'title: a\nauthor: nguyen-van-a.md\nmembers: [nguyen-van-a.md]\nprojects: [du-an-1]\npapers: [paper-1.md]',
    ),
  );
  assert.deepEqual(ok.contentErrors, []);
  const bad = check(doc('title: a\nmembers: [khong-ton-tai.md]\nauthor: ghost'));
  assert.equal(bad.contentErrors.length, 2);
});

test('paper authors may be outside names', () => {
  const r = checkFile(
    'src/content/papers/p.md',
    doc('title: a\nauthors: ["J. Smith", "nguyen-van-a"]'),
    ctx,
  );
  assert.deepEqual(r, { contentErrors: [], structuralErrors: [] });
});

test('non-kebab file names are a content error for published files only', () => {
  const run1 = (file, front) => checkFile(file, doc(front), ctx).contentErrors;
  assert.match(run1('src/content/news/vi/Tin Moi.md', 'title: a')[0], /kebab-case/);
  assert.match(run1('src/content/members/Nguyen_A.md', 'name: A')[0], /kebab-case/);
  assert.deepEqual(run1('src/content/news/vi/tin-moi-2.md', 'title: a'), []);
  assert.deepEqual(run1('src/content/news/vi/Tin Moi.md', 'title: a\ndraft: true'), []);
});

test('a published item referencing a draft member is a content error', () => {
  const files = {
    'src/content/members/ban-nhap.md': doc('name: A\nrole: phd\ndraft: true'),
    'src/content/members/da-dang.md': doc('name: B\nrole: phd'),
    'src/content/news/vi/n.md': doc(
      'title: a\ndate: 2026-01-01\ncategory: other\nmembers: [ban-nhap, da-dang]',
    ),
  };
  const r = checkAll(project(files));
  assert.equal(r.contentErrors.length, 1);
  assert.match(r.contentErrors[0].message, /ban-nhap/);
});

test('example.com contact_email in site.yml is rejected', () => {
  assert.equal(checkSiteData('contact_email: athena@example.com\n').length, 1);
  assert.deepEqual(checkSiteData('contact_email: ""\n'), []);
  assert.deepEqual(checkSiteData('contact_email: lab@hust.edu.vn\n'), []);
  const root = project({ ...GOOD, 'src/data/site.yml': 'contact_email: a@example.com\n' });
  assert.equal(exec(root).code, 1);
});

test('broken frontmatter is structural, even for drafts', () => {
  const r = check('---\ntitle: "a\ndraft: true\n---\nbody');
  assert.equal(r.structuralErrors.length, 1);
  assert.equal(r.contentErrors.length, 0);
});

test('checkI18nKeys reports both directions', () => {
  assert.deepEqual(checkI18nKeys({ a: '1' }, { a: '1' }), []);
  const errs = checkI18nKeys({ a: '1', x: '2' }, { a: '1', y: '3' });
  assert.equal(errs.length, 2);
  assert.match(errs.join('|'), /"x" trong en\.json/);
  assert.match(errs.join('|'), /"y" trong vi\.json/);
});

// ---- filesystem scenarios through run()
function project(files, i18n = true) {
  const root = mkdtempSync(path.join(tmpdir(), 'check-content-'));
  const all = { ...files };
  if (i18n) {
    all['src/i18n/vi.json'] = '{"a":"1","x":"2"}';
    all['src/i18n/en.json'] = '{"a":"1","x":"2"}';
  }
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const exec = (root, opts = {}) => {
  const lines = [];
  const code = run({ root, log: (l) => lines.push(l), env: {}, ...opts });
  return { code, out: lines.join('\n') };
};
const GOOD = { 'src/content/members/nguyen-van-a.md': doc('name: A\nrole: phd') };
const BAD = {
  'src/content/news/vi/bad.md': doc(
    'title: "[[Họ tên]] tốt nghiệp"\ndate: 2026-01-01\ncategory: graduation\ndraft: false',
  ),
};

test('local mode: content error exits 1 and names the file', () => {
  const root = project({ ...GOOD, ...BAD });
  const r = exec(root);
  assert.equal(r.code, 1);
  assert.match(r.out, /src\/content\/news\/vi\/bad\.md: dòng/);
  assert.ok(!existsSync(path.join(root, 'src/.quarantine.json')));
});

test('quarantine mode: lists the file, writes summary, exits 0', () => {
  const root = project({ ...GOOD, ...BAD });
  const summary = path.join(root, 'summary.md');
  const r = exec(root, { quarantine: true, env: { GITHUB_STEP_SUMMARY: summary } });
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, 'src/.quarantine.json'), 'utf8')), [
    'src/content/news/vi/bad.md',
  ]);
  assert.match(readFileSync(path.join(root, 'quarantine.md'), 'utf8'), /bad\.md/);
  assert.match(readFileSync(summary, 'utf8'), /bad\.md/);
});

test('quarantine mode with a clean tree writes an empty list and removes stale report', () => {
  const root = project({ ...GOOD, quarantine_placeholder: '' });
  writeFileSync(path.join(root, 'quarantine.md'), 'stale');
  assert.equal(exec(root, { quarantine: true }).code, 0);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, 'src/.quarantine.json'), 'utf8')), []);
  assert.ok(!existsSync(path.join(root, 'quarantine.md')));
});

test('structural errors exit 1 in both modes', () => {
  const root = project({ ...GOOD, 'src/content/news/vi/broken.md': '---\ntitle: "a\n---\nx' });
  assert.equal(exec(root).code, 1);
  assert.equal(exec(root, { quarantine: true }).code, 1);
  const i18n = project(GOOD, false);
  writeFileSync(path.join(i18n, 'x'), '');
  mkdirSync(path.join(i18n, 'src/i18n'), { recursive: true });
  writeFileSync(path.join(i18n, 'src/i18n/vi.json'), '{"a":"1","x":"2"}');
  writeFileSync(path.join(i18n, 'src/i18n/en.json'), '{"a":"1"}');
  const r = exec(i18n, { quarantine: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /"x" trong en\.json/);
});

test('avatar existence is read from public/', () => {
  const files = {
    ...GOOD,
    'public/images/members/a.webp': 'x',
    'src/content/members/b.md': doc('name: B\nrole: phd\navatar: /images/members/a.webp'),
  };
  assert.equal(exec(project(files)).code, 0);
  delete files['public/images/members/a.webp'];
  assert.equal(exec(project(files)).code, 1);
});

test('500 files check in under 2 seconds', () => {
  const files = { ...GOOD };
  for (let i = 0; i < 500; i++) {
    files[`src/content/news/vi/n${i}.md`] = doc(
      `title: "Tin ${i}"\ndate: 2026-01-01\ncategory: other\nauthor: nguyen-van-a`,
      'Nội dung '.repeat(200),
    );
  }
  const root = project(files);
  const t = performance.now();
  const r = checkAll(root);
  assert.ok(performance.now() - t < 2000);
  assert.equal(r.files, 501);
  assert.deepEqual(r.contentErrors, []);
});

// ---- repository content
test('the repository content passes the guard', () => {
  const r = checkAll(REPO);
  assert.deepEqual([...r.structuralErrors, ...r.contentErrors], []);
});

// ---- templates: 26 files, valid once placeholders are filled
const REQUIRED = {
  members: ['name', 'role'],
  papers: ['title', 'date', 'authors', 'venue', 'type'],
  projects: ['title'],
  news: ['title', 'date', 'category'],
};
const ROLES = ['professor', 'lecturer', 'postdoc', 'phd', 'master', 'undergrad', 'staff'];
const PAPER_TYPES = ['conference', 'journal', 'workshop', 'preprint', 'thesis', 'book-chapter'];
const CATEGORIES = [
  'paper',
  'award',
  'defense',
  'graduation',
  'member',
  'seminar',
  'talk',
  'grant',
  'recruitment',
  'event',
  'other',
];

function templateFiles() {
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
  return walk(path.join(REPO, 'templates')).filter(
    (f) => f.endsWith('.md') && !f.endsWith('README.md'),
  );
}

test('there are 26 templates', () => {
  assert.equal(templateFiles().length, 26);
});

for (const file of templateFiles()) {
  const rel = path.relative(path.join(REPO, 'templates'), file).split(path.sep).join('/');
  test(`template ${rel} is valid once filled`, () => {
    const raw = readFileSync(file, 'utf8');
    const { data, error } = splitFrontmatter(raw);
    assert.equal(error, null);
    assert.equal(data.draft, true, 'template must be draft: true');
    assert.match(raw, /\[\[/, 'template must contain placeholders');

    const collection = rel.split('/')[0];
    for (const key of REQUIRED[collection]) {
      assert.ok(data[key] !== undefined && data[key] !== '', `missing ${key}`);
    }
    if (collection === 'members') assert.ok(ROLES.includes(data.role));
    if (collection === 'papers') {
      assert.ok(PAPER_TYPES.includes(data.type));
      assert.ok(Array.isArray(data.authors) && data.authors.length > 0);
    }
    if (collection === 'news') assert.ok(CATEGORIES.includes(data.category));

    // Every placeholder must sit inside a quoted YAML string (never parse to a nested array).
    for (const [key, value] of Object.entries(data)) {
      assert.ok(
        !(Array.isArray(value) && value.some(Array.isArray)),
        `${key}: unquoted placeholder became a nested array`,
      );
    }

    const filled = raw
      .replace(/\[\[[^\]]*\]\]/g, 'giatri')
      .replace(/^draft: true$/m, 'draft: false');
    const filledCtx = {
      memberSlugs: new Set(['giatri']),
      projectSlugs: new Set(['giatri']),
      paperSlugs: new Set(['giatri']),
      publicFiles: new Set(),
    };
    const r = checkFile(`templates/${rel}`, filled, filledCtx);
    assert.deepEqual(r, { contentErrors: [], structuralErrors: [] });
  });
}
