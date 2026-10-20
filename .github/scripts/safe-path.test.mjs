import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { safePath } from './safe-path.mjs';

let root;
before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'safe-path-'));
  mkdirSync(path.join(root, 'src/content/news'), { recursive: true });
  writeFileSync(path.join(root, 'src/content/news/a.md'), 'x');
  writeFileSync(path.join(root, 'secret.md'), 'x');
  symlinkSync(path.join(root, 'secret.md'), path.join(root, 'src/content/news/link.md'));
  symlinkSync(root, path.join(root, 'src/content/loop'));
});
after(() => rmSync(root, { recursive: true, force: true }));

const opts = (extra = {}) => ({ allowPrefixes: ['src/content'], ext: ['.md'], root, ...extra });

describe('safePath', () => {
  it('accepts a file inside an allowed prefix and returns rel + abs', () => {
    const result = safePath('src/content/news/a.md', opts());
    assert.equal(result.rel, 'src/content/news/a.md');
    assert.equal(result.abs, path.join(root, 'src/content/news/a.md'));
  });

  it('accepts a path that does not exist yet', () => {
    assert.equal(safePath('src/content/news/new.md', opts()).rel, 'src/content/news/new.md');
  });

  it('is case-insensitive about the extension', () => {
    assert.ok(safePath('src/content/news/A.MD', opts()));
  });

  for (const bad of [
    '../etc/passwd.md',
    'src/content/../../secret.md',
    'src/content/news/../../../x.md',
    '/etc/passwd.md',
    'C:/Windows/x.md',
    'src\\content\\news\\a.md',
    'src/content//a.md',
    './src/content/a.md',
    'src/content/a\0.md',
    '',
    'secret.md',
    'src/contentious/a.md',
    '.github/workflows/deploy.yml',
  ]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      assert.throws(() => safePath(bad, opts()));
    });
  }

  it('rejects non-strings', () => {
    for (const bad of [undefined, null, 3, {}, ['src/content/a.md']]) {
      assert.throws(() => safePath(bad, opts()));
    }
  });

  it('rejects a wrong extension', () => {
    assert.throws(() => safePath('src/content/news/a.yml', opts()), /đuôi/);
    assert.throws(() => safePath('src/content/news/a', opts()), /đuôi/);
  });

  it('skips the extension check when none is requested', () => {
    assert.ok(safePath('src/content/news/anything', { allowPrefixes: ['src/content'], root }));
  });

  it('rejects a symlinked file and a symlinked directory', () => {
    assert.throws(() => safePath('src/content/news/link.md', opts()), /symlink/);
    assert.throws(() => safePath('src/content/loop/secret.md', opts()), /symlink/);
  });
});
