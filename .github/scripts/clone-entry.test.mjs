import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyClone, planClone } from './clone-entry.mjs';
import { readFields } from './frontmatter.mjs';
import { parsePayload } from './payload.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TODAY = '2026-10-20';
const ACTIONS = ['from-template', 'duplicate', 'translate-en'];

let root;
before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'clone-entry-'));
  cpSync(path.join(REPO, 'templates'), path.join(root, 'templates'), { recursive: true });
  cpSync(path.join(REPO, 'src/content'), path.join(root, 'src/content'), { recursive: true });
});
after(() => rmSync(root, { recursive: true, force: true }));

const payload = (action, context, inputs = {}) =>
  parsePayload(JSON.stringify({ action: { name: action }, context, inputs }), ACTIONS);
const plan = (p) => planClone(p, { root, today: TODAY });
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const collectionCtx = (name, dir) => ({ type: 'collection', name, path: dir });
const entryCtx = (name, file) => ({ type: 'entry', name, path: file });

describe('from-template', () => {
  const news = collectionCtx('news-vi', 'src/content/news/vi');

  it('plans a dated news file with the title, date and draft set', () => {
    const result = plan(
      payload('from-template', news, {
        template: 'templates/news/vi/seminar.md',
        title: 'Seminar: Học máy',
      }),
    );
    assert.equal(result.dest, 'src/content/news/vi/2026-10-20-seminar-hoc-may.md');
    assert.deepEqual(result.patch, { title: 'Seminar: Học máy', draft: true, date: TODAY });
    assert.equal(result.message, 'content: add 2026-10-20-seminar-hoc-may.md (draft)');
  });

  it('writes the file: placeholders and body stay, only the three keys change', () => {
    const result = plan(
      payload('from-template', news, {
        template: 'templates/news/vi/seminar.md',
        title: 'Seminar: Học máy',
      }),
    );
    applyClone(result, root);
    const out = read(result.dest);
    const fields = readFields(out);
    assert.equal(fields.title, 'Seminar: Học máy');
    assert.equal(fields.date, TODAY);
    assert.equal(fields.draft, true);
    const tpl = read('templates/news/vi/seminar.md');
    assert.equal(
      out.slice(out.indexOf('---\n', 4)),
      tpl.slice(tpl.indexOf('---\n', 4)),
      'body is byte-identical',
    );
    assert.match(out, /\[\[/, 'placeholders remain so check-content keeps it out of the site');
    assert.throws(() => applyClone(result, root), { code: 'EEXIST' }, 'never overwrites');
  });

  it('adds -2 when the same title is created twice', () => {
    const input = { template: 'templates/news/vi/seminar.md', title: 'Trùng tên' };
    const first = plan(payload('from-template', news, input));
    applyClone(first, root);
    assert.equal(
      plan(payload('from-template', news, input)).dest,
      first.dest.replace('.md', '-2.md'),
    );
  });

  it('names members by name, papers by year, projects by slug; members use the name field', () => {
    const member = plan(
      payload('from-template', collectionCtx('members', 'src/content/members'), {
        template: 'templates/members/ncs.md',
        title: 'Trần Thị B',
      }),
    );
    assert.equal(member.dest, 'src/content/members/tran-thi-b.md');
    assert.deepEqual(member.patch, { name: 'Trần Thị B', draft: true });

    const paper = plan(
      payload('from-template', collectionCtx('papers', 'src/content/papers'), {
        template: 'templates/papers/journal.md',
        title: 'Học sâu',
      }),
    );
    assert.equal(paper.dest, 'src/content/papers/2026-hoc-sau.md');
    assert.equal(paper.patch.date, TODAY);

    const project = plan(
      payload('from-template', collectionCtx('projects-vi', 'src/content/projects/vi'), {
        template: 'templates/projects/vi/du-an.md',
        title: 'Dự án X',
      }),
    );
    assert.equal(project.dest, 'src/content/projects/vi/du-an-x.md');
    assert.equal('date' in project.patch, false);
  });

  it('rejects a template of another collection, a traversal, or a README', () => {
    const run = (template) => () => plan(payload('from-template', news, { template, title: 'X' }));
    assert.throws(run('templates/news/en/seminar.md'), /không thuộc collection/);
    assert.throws(run('templates/members/ncs.md'), /không thuộc collection/);
    assert.throws(run('../../.github/workflows/deploy.yml'), /không thuộc collection/);
    assert.throws(run('templates/news/vi/../../../package.json'), /không thuộc collection/);
    assert.throws(run('templates/README.md'), /không thuộc collection/);
    assert.throws(run(undefined), /không thuộc collection/);
  });

  it('rejects a destination that is not the collection folder, or a context of the wrong kind', () => {
    const input = { template: 'templates/news/vi/seminar.md', title: 'X' };
    assert.throws(
      () => plan(payload('from-template', collectionCtx('news-vi', 'src/content/news/en'), input)),
      /không khớp/,
    );
    assert.throws(
      () => plan(payload('from-template', collectionCtx('news-vi', '.github/workflows'), input)),
      /không khớp/,
    );
    assert.throws(
      () =>
        plan(
          payload(
            'from-template',
            entryCtx('news-vi', 'src/content/news/vi/2026-10-05-seminar-toi-uu-khong-loi.md'),
            input,
          ),
        ),
      /danh sách bài/,
    );
    assert.throws(
      () => plan(payload('from-template', collectionCtx('news-en', 'src/content/news/en'), input)),
      /không có mẫu/,
    );
    assert.throws(
      () => plan(payload('from-template', collectionCtx('site', 'src/data'), input)),
      /không được hỗ trợ/,
    );
  });

  it('rejects bad titles', () => {
    const run = (title) => () =>
      plan(payload('from-template', news, { template: 'templates/news/vi/seminar.md', title }));
    assert.throws(run('x'.repeat(300)), /1–200/);
    assert.throws(run('a\nb'), /điều khiển/);
    assert.throws(run(''), /1–200/);
    assert.throws(run('???'), /tên file/);
    assert.throws(run(undefined), /Thiếu/);
  });
});

describe('duplicate', () => {
  it('copies a member under a new name', () => {
    const result = plan(
      payload('duplicate', entryCtx('members', 'src/content/members/pham-quoc-anh.md'), {
        title: 'Trần Thị B',
      }),
    );
    assert.equal(result.dest, 'src/content/members/tran-thi-b.md');
    applyClone(result, root);
    const fields = readFields(read(result.dest));
    assert.equal(fields.name, 'Trần Thị B');
    assert.equal(fields.draft, true);
    assert.equal(fields.role, 'phd', 'other fields are kept');
    const again = plan(
      payload('duplicate', entryCtx('members', 'src/content/members/pham-quoc-anh.md'), {
        title: 'Trần Thị B',
      }),
    );
    assert.equal(again.dest, 'src/content/members/tran-thi-b-2.md');
  });

  it('rejects other collections, paths outside the collection, nesting, missing files and symlink-like names', () => {
    const run = (name, file) => () =>
      plan(payload('duplicate', entryCtx(name, file), { title: 'X' }));
    assert.throws(
      run('news-en', 'src/content/news/en/2026-10-05-seminar-toi-uu-khong-loi.md'),
      /không hỗ trợ nhân bản/,
    );
    assert.throws(
      run('members', 'src/content/papers/convergence-local-sgd-heterogeneous-data.md'),
      /ngoài vùng/,
    );
    assert.throws(run('members', '../package.json'), /không hợp lệ/);
    assert.throws(run('members', 'src/content/members/sub/a.md'), /Không phải file bài/);
    assert.throws(run('members', 'src/content/members/missing.md'), /Không tìm thấy/);
    assert.throws(run('members', 'src/content/members/tran-minh-khoa.txt'), /đuôi/);
    assert.throws(
      () =>
        plan(payload('duplicate', collectionCtx('members', 'src/content/members'), { title: 'X' })),
      /trên một bài/,
    );
  });
});

describe('translate-en', () => {
  it('creates the English draft with the same file name and untouched content', () => {
    writeFileSync(
      path.join(root, 'src/content/news/vi/2026-10-01-chi-vi.md'),
      '---\ntitle: Chỉ có bản Việt\ndate: 2026-10-01\ncategory: other\ndraft: false\n---\n\nNội dung $a_i$ dài.\n',
    );
    const result = plan(
      payload('translate-en', entryCtx('news-vi', 'src/content/news/vi/2026-10-01-chi-vi.md')),
    );
    assert.equal(result.dest, 'src/content/news/en/2026-10-01-chi-vi.md');
    assert.deepEqual(result.patch, { draft: true });
    applyClone(result, root);
    const out = read(result.dest);
    assert.equal(readFields(out).draft, true);
    assert.equal(readFields(out).title, 'Chỉ có bản Việt');
    assert.ok(out.endsWith('\n\nNội dung $a_i$ dài.\n'));
  });

  it('refuses when the English file already exists', () => {
    assert.throws(
      () =>
        plan(
          payload(
            'translate-en',
            entryCtx('news-vi', 'src/content/news/vi/2026-10-05-seminar-toi-uu-khong-loi.md'),
          ),
        ),
      /đã có/,
    );
  });

  it('is only offered for news-vi and projects-vi', () => {
    for (const [name, file] of [
      ['members', 'src/content/members/tran-minh-khoa.md'],
      ['papers', 'src/content/papers/convergence-local-sgd-heterogeneous-data.md'],
      ['news-en', 'src/content/news/en/2026-10-05-seminar-toi-uu-khong-loi.md'],
    ]) {
      assert.throws(
        () => plan(payload('translate-en', entryCtx(name, file))),
        /không có bản tiếng Anh/,
      );
    }
    assert.ok(!existsSync(path.join(root, 'src/content/members/tran-minh-khoa-en.md')));
  });

  it('rejects an unknown action', () => {
    assert.throws(
      () =>
        parsePayload(
          JSON.stringify({ action: { name: 'rm-rf' }, context: { type: 'entry' } }),
          ACTIONS,
        ),
      /không được hỗ trợ/,
    );
  });
});
