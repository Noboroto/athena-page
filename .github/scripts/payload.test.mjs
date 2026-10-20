import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePayload, parseTitle } from './payload.mjs';

const make = (overrides = {}) =>
  JSON.stringify({
    source: 'pages-cms',
    action: { name: 'duplicate', label: 'Nhân bản' },
    context: {
      type: 'entry',
      name: 'news-vi',
      path: 'src/content/news/vi/a.md',
      data: { big: 'x' },
    },
    inputs: { title: 'Tiêu đề', n: 3, flag: true },
    ...overrides,
  });

describe('parsePayload', () => {
  it('returns the checked parts and drops everything else', () => {
    assert.deepEqual(parsePayload(make(), ['duplicate']), {
      action: 'duplicate',
      context: { type: 'entry', name: 'news-vi', path: 'src/content/news/vi/a.md' },
      inputs: { title: 'Tiêu đề', n: 3, flag: true },
    });
  });

  it('defaults a missing inputs object and a null path/name', () => {
    const raw = make({ context: { type: 'media', name: null, path: null }, inputs: undefined });
    assert.deepEqual(parsePayload(raw, ['duplicate']).inputs, {});
    assert.equal(parsePayload(raw, ['duplicate']).context.path, null);
  });

  it('rejects an action the workflow does not handle', () => {
    assert.throws(
      () => parsePayload(make({ action: { name: 'x' } }), ['duplicate']),
      /không được hỗ trợ/,
    );
    assert.throws(() => parsePayload(make({ action: {} }), ['duplicate']));
    assert.throws(() => parsePayload(make({ action: { name: 'duplicate' } }), ['optimize-images']));
  });

  it('rejects bad JSON, non-objects, empty and oversized payloads', () => {
    assert.throws(() => parsePayload('{', ['duplicate']), /JSON/);
    assert.throws(() => parsePayload('[]', ['duplicate']), /đối tượng/);
    assert.throws(() => parsePayload('', ['duplicate']), /Thiếu/);
    assert.throws(() => parsePayload(undefined, ['duplicate']), /Thiếu/);
    assert.throws(() => parsePayload(make({ pad: 'x'.repeat(300_000) }), ['duplicate']), /quá lớn/);
  });

  it('rejects an unknown context type or a malformed name/path', () => {
    assert.throws(
      () => parsePayload(make({ context: { type: 'root' } }), ['duplicate']),
      /context.type/,
    );
    assert.throws(
      () => parsePayload(make({ context: { type: 'entry', name: '../x' } }), ['duplicate']),
      /context.name/,
    );
    assert.throws(
      () => parsePayload(make({ context: { type: 'entry', name: 'a', path: 5 } }), ['duplicate']),
      /context.path/,
    );
  });

  it('rejects inputs that are not scalars or have odd keys', () => {
    assert.throws(() => parsePayload(make({ inputs: { a: { b: 1 } } }), ['duplicate']), /Input a/);
    assert.throws(() => parsePayload(make({ inputs: { a: ['x'] } }), ['duplicate']), /Input a/);
    assert.throws(() => parsePayload(make({ inputs: { 'a b': 'x' } }), ['duplicate']), /Tên input/);
  });
});

describe('parseTitle', () => {
  it('trims and returns the title', () => {
    assert.equal(parseTitle('  Xin chào  '), 'Xin chào');
  });

  it('rejects empty, too long, non-string and control characters', () => {
    assert.throws(() => parseTitle('   '), /1–200/);
    assert.throws(() => parseTitle('a'.repeat(201)), /1–200/);
    assert.equal(parseTitle('a'.repeat(200)).length, 200);
    assert.throws(() => parseTitle('line1\nline2'), /điều khiển/);
    assert.throws(() => parseTitle('tab\there'), /điều khiển/);
    assert.throws(() => parseTitle(undefined), /Thiếu/);
    assert.throws(() => parseTitle(5), /Thiếu/);
  });
});
