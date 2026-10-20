import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COLLECTIONS,
  fileNameFor,
  getCollection,
  listTemplates,
  slugify,
  todayInVietnam,
} from './collections.mjs';

describe('slugify', () => {
  it('strips Vietnamese diacritics including đ', () => {
    assert.equal(
      slugify('Đặng Thị Hương – Buổi Seminar số 1!'),
      'dang-thi-huong-buoi-seminar-so-1',
    );
  });

  it('keeps a-z0-9, caps at 80 chars with no trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} bbb`);
    assert.equal(slug.length, 79);
    assert.match(slug, /^[a-z0-9-]{1,80}$/);
  });

  it('throws when nothing usable is left', () => {
    assert.throws(() => slugify('!!! ???'), /tên file/);
    assert.throws(() => slugify('日本語'), /tên file/);
  });
});

describe('fileNameFor', () => {
  const entry = { title: 'Chào mừng', date: '2026-10-20' };

  it('follows the naming rule of each collection', () => {
    assert.equal(
      fileNameFor(COLLECTIONS['news-vi'], entry, () => false),
      '2026-10-20-chao-mung.md',
    );
    assert.equal(
      fileNameFor(COLLECTIONS.papers, entry, () => false),
      '2026-chao-mung.md',
    );
    assert.equal(
      fileNameFor(COLLECTIONS['projects-vi'], entry, () => false),
      'chao-mung.md',
    );
    assert.equal(
      fileNameFor(COLLECTIONS.members, entry, () => false),
      'chao-mung.md',
    );
  });

  it('adds -2, -3 when the name is taken', () => {
    const taken = new Set(['chao-mung.md', 'chao-mung-2.md']);
    assert.equal(
      fileNameFor(COLLECTIONS.members, entry, (n) => taken.has(n)),
      'chao-mung-3.md',
    );
  });

  it('gives up after too many collisions', () => {
    assert.throws(() => fileNameFor(COLLECTIONS.members, entry, () => true), /trùng/);
  });
});

describe('getCollection', () => {
  it('returns config with its name and rejects anything else, including prototype keys', () => {
    assert.equal(getCollection('members').name, 'members');
    for (const bad of ['nope', '__proto__', 'constructor', 'toString', undefined, 5]) {
      assert.throws(() => getCollection(bad), /không được hỗ trợ/);
    }
  });
});

describe('listTemplates', () => {
  it('lists the real templates of each collection, without README.md', () => {
    const news = listTemplates(getCollection('news-vi'));
    assert.equal(news.length, 9);
    assert.ok(news.every((t) => t.startsWith('templates/news/vi/') && t.endsWith('.md')));
    assert.deepEqual(listTemplates(getCollection('news-en')), []);
  });
});

describe('todayInVietnam', () => {
  it('uses the Asia/Ho_Chi_Minh calendar day', () => {
    assert.equal(todayInVietnam(new Date('2026-10-20T20:00:00Z')), '2026-10-21');
    assert.equal(todayInVietnam(new Date('2026-10-20T16:59:00Z')), '2026-10-20');
  });
});
