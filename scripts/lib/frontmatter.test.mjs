import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinFrontmatter, splitFrontmatter } from './frontmatter.mjs';

const body = '\n# Tiêu đề\n\nĐoạn  văn\twith   spacing.\n\n\n';

test('splits data and returns the body untouched', () => {
  const r = splitFrontmatter(`---\ntitle: "A"\ndraft: true\n---\n${body}`);
  assert.equal(r.error, null);
  assert.deepEqual(r.data, { title: 'A', draft: true });
  assert.equal(r.body, body);
});

test('round trip keeps YAML comments and the body byte-identical', () => {
  const raw = `---\n# ghi chú\ntitle: "A"\ntags: [x, y] # inline\n---\n${body}`;
  const r = splitFrontmatter(raw);
  r.doc.set('draft', false);
  const out = joinFrontmatter(r.doc, r.body, r.eol);
  assert.match(out, /# ghi chú/);
  assert.match(out, /# inline/);
  assert.match(out, /draft: false/);
  assert.ok(out.endsWith(`---\n${body}`));
});

test('handles CRLF files', () => {
  const crlfBody = '\r\nline1\r\nline2\r\n';
  const raw = `---\r\ntitle: "A"\r\n---\r\n${crlfBody}`;
  const r = splitFrontmatter(raw);
  assert.equal(r.error, null);
  assert.equal(r.eol, '\r\n');
  assert.equal(r.body, crlfBody);
  assert.equal(joinFrontmatter(r.doc, r.body, r.eol), raw);
});

test('empty frontmatter is an empty object', () => {
  const r = splitFrontmatter('---\n---\nbody');
  assert.equal(r.error, null);
  assert.deepEqual(r.data, {});
  assert.equal(r.body, 'body');
});

test('reports missing and broken frontmatter', () => {
  assert.match(splitFrontmatter('no fence').error, /Thiếu frontmatter/);
  assert.match(splitFrontmatter('---\ntitle: "a\n---\nx').error, /YAML lỗi/);
  assert.match(splitFrontmatter('---\n- a\n- b\n---\nx').error, /đối tượng/);
});

test('"---" inside the body is not mistaken for the closing fence', () => {
  const r = splitFrontmatter('---\ntitle: A\n---\ntext\n---\nmore\n');
  assert.equal(r.body, 'text\n---\nmore\n');
});
