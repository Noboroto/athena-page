import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  findAvatarImages,
  isReferencedElsewhere,
  optimizeAvatars,
  rewriteAvatarLine,
} from './optimize-images.mjs';

// sharp is a workflow-only dependency (.github/scripts/package.json). Where it is not installed
// (the site's root `pnpm test`) the image tests are skipped instead of failing on the import.
const sharp = await import('sharp').then(
  (m) => m.default,
  () => null,
);
const needsSharp = { skip: sharp ? false : 'sharp chưa được cài trong .github/scripts' };

let root;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'optimize-images-'));
  for (const dir of [
    'src/content/members',
    'src/content/news/vi',
    'src/data',
    'public/images/members',
  ]) {
    mkdirSync(path.join(root, dir), { recursive: true });
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (rel, text) => writeFileSync(path.join(root, rel), text);
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const member = (name, avatar, extra = '') =>
  write(
    `src/content/members/${name}.md`,
    `---\nname: ${name}\nrole: phd\n${avatar ? `avatar: ${avatar}\n` : ''}${extra}---\n\nBody mentions nothing.\n`,
  );

async function png(rel, { width = 200, height = 100, orientation } = {}) {
  // left half red, right half blue
  const left = await sharp({
    create: { width: width / 2, height, channels: 3, background: '#ff0000' },
  })
    .png()
    .toBuffer();
  let image = sharp({ create: { width, height, channels: 3, background: '#0000ff' } }).composite([
    { input: left, left: 0, top: 0 },
  ]);
  image = orientation ? image.withMetadata({ orientation }).png() : image.png();
  await image.toFile(path.join(root, rel));
}

describe('rewriteAvatarLine', () => {
  it('changes only the avatar line', () => {
    const text =
      '---\nname: A\navatar: /images/members/a.jpg\nbio_en: see /images/members/a.jpg\n---\n\nBody /images/members/a.jpg\n';
    const out = rewriteAvatarLine(text, '/images/members/a.jpg', '/images/members/a.webp');
    assert.equal(
      out,
      '---\nname: A\navatar: /images/members/a.webp\nbio_en: see /images/members/a.jpg\n---\n\nBody /images/members/a.jpg\n',
    );
  });

  it('keeps quotes, trailing comments and CRLF line endings', () => {
    const crlf = '---\r\nname: A\r\navatar: "/images/members/a.png" # photo\r\n---\r\nBody\r\n';
    assert.equal(
      rewriteAvatarLine(crlf, '/images/members/a.png', '/images/members/a.webp'),
      '---\r\nname: A\r\navatar: "/images/members/a.webp" # photo\r\n---\r\nBody\r\n',
    );
  });

  it('throws when the line is absent or the file has no frontmatter', () => {
    assert.throws(
      () => rewriteAvatarLine('---\nname: A\n---\n', '/images/members/a.jpg', 'x'),
      /Không thấy/,
    );
    assert.throws(
      () => rewriteAvatarLine('no frontmatter', '/images/members/a.jpg', 'x'),
      /frontmatter/,
    );
  });
});

describe('findAvatarImages', () => {
  it('returns only avatar images that exist, are jpg/jpeg/png and live in the members folder', () => {
    for (const f of ['a.JPG', 'b.png', 'c.webp', 'group.jpg'])
      write(`public/images/members/${f}`, 'x');
    member('m-a', '/images/members/a.JPG');
    member('m-b', '/images/members/b.png');
    member('m-c', '/images/members/c.webp');
    member('m-missing', '/images/members/missing.jpg');
    member('m-elsewhere', '/images/news/cover.jpg');
    member('m-escape', '/images/members/../../../etc/x.jpg');
    member('m-none', null);
    member('m-b2', '/images/members/b.png');
    const found = findAvatarImages(root);
    assert.deepEqual([...found.keys()].sort(), [
      'public/images/members/a.JPG',
      'public/images/members/b.png',
    ]);
    assert.deepEqual(found.get('public/images/members/b.png').members, [
      'src/content/members/m-b.md',
      'src/content/members/m-b2.md',
    ]);
  });
});

describe('isReferencedElsewhere', () => {
  it('finds the URL in news, data and members files', () => {
    assert.equal(isReferencedElsewhere('/images/members/a.jpg', root), false);
    write('src/content/news/vi/n.md', '---\ntitle: x\n---\n![](/images/members/a.jpg)\n');
    assert.equal(isReferencedElsewhere('/images/members/a.jpg', root), true);
    assert.equal(isReferencedElsewhere('/images/members/b.jpg', root), false);
    write('src/data/site.yml', 'links: {}\nlogo: /images/members/b.jpg\n');
    assert.equal(isReferencedElsewhere('/images/members/b.jpg', root), true);
  });
});

describe('optimizeAvatars', needsSharp, () => {
  it('converts only avatar images; a non-avatar jpg is untouched', async () => {
    await png('public/images/members/a.png');
    write('public/images/members/group.jpg', 'not an avatar');
    member('m-a', '/images/members/a.png');
    const result = await optimizeAvatars(root);

    assert.deepEqual(result.converted, ['public/images/members/a.png']);
    assert.ok(existsSync(path.join(root, 'public/images/members/a.webp')));
    assert.ok(
      !existsSync(path.join(root, 'public/images/members/a.png')),
      'original removed, nothing else used it',
    );
    assert.equal(read('public/images/members/group.jpg'), 'not an avatar');
    assert.match(read('src/content/members/m-a.md'), /^avatar: \/images\/members\/a\.webp$/m);
    const meta = await sharp(path.join(root, 'public/images/members/a.webp')).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 400, 400]);
  });

  it('upscales a small image to exactly 400x400', async () => {
    await png('public/images/members/tiny.png', { width: 40, height: 20 });
    member('m-t', '/images/members/tiny.png');
    await optimizeAvatars(root);
    const meta = await sharp(path.join(root, 'public/images/members/tiny.webp')).metadata();
    assert.deepEqual([meta.width, meta.height], [400, 400]);
  });

  it('keeps the original when another file still references it', async () => {
    await png('public/images/members/a.png');
    member('m-a', '/images/members/a.png');
    write('src/content/news/vi/n.md', '---\ntitle: x\n---\n![](/images/members/a.png)\n');
    const result = await optimizeAvatars(root);
    assert.deepEqual(result.kept, ['public/images/members/a.png']);
    assert.ok(existsSync(path.join(root, 'public/images/members/a.png')));
    assert.ok(existsSync(path.join(root, 'public/images/members/a.webp')));
    assert.match(read('src/content/members/m-a.md'), /avatar: \/images\/members\/a\.webp/);
  });

  it('applies the EXIF orientation before cropping', async () => {
    // 200x100, red left / blue right, orientation 6 = rotate 90 degrees clockwise: red ends up on top.
    await png('public/images/members/r.png', { orientation: 6 });
    member('m-r', '/images/members/r.png');
    await optimizeAvatars(root);
    const { data, info } = await sharp(path.join(root, 'public/images/members/r.webp'))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels).subarray(0, 3)];
    const [r1, , b1] = pixel(200, 40);
    const [r2, , b2] = pixel(200, 360);
    assert.ok(r1 > 200 && b1 < 60, 'top is red');
    assert.ok(b2 > 200 && r2 < 60, 'bottom is blue');
  });

  it('skips when the .webp already exists and does not delete the original', async () => {
    await png('public/images/members/a.png');
    write('public/images/members/a.webp', 'existing');
    member('m-a', '/images/members/a.png');
    const result = await optimizeAvatars(root);
    assert.equal(result.converted.length, 0);
    assert.match(result.skipped[0].reason, /đã tồn tại/);
    assert.equal(read('public/images/members/a.webp'), 'existing');
    assert.ok(existsSync(path.join(root, 'public/images/members/a.png')));
    assert.match(read('src/content/members/m-a.md'), /avatar: \/images\/members\/a\.png/);
  });

  it('skips a corrupt image without leaving a partial file', async () => {
    write('public/images/members/bad.jpg', 'definitely not a jpeg');
    member('m-bad', '/images/members/bad.jpg');
    const result = await optimizeAvatars(root);
    assert.equal(result.converted.length, 0);
    assert.match(result.skipped[0].reason, /không đọc được ảnh/);
    assert.ok(!existsSync(path.join(root, 'public/images/members/bad.webp')));
  });

  it('is a no-op when there is nothing to convert, and idempotent on a second run', async () => {
    assert.deepEqual((await optimizeAvatars(root)).changed, []);
    await png('public/images/members/a.png');
    member('m-a', '/images/members/a.png');
    await optimizeAvatars(root);
    assert.deepEqual((await optimizeAvatars(root)).changed, []);
  });

  it('repoints every member that shares one image', async () => {
    await png('public/images/members/shared.png');
    member('m-1', '/images/members/shared.png');
    member('m-2', '/images/members/shared.png');
    const result = await optimizeAvatars(root);
    assert.deepEqual(result.converted, ['public/images/members/shared.png']);
    for (const m of ['m-1', 'm-2'])
      assert.match(read(`src/content/members/${m}.md`), /avatar: \/images\/members\/shared\.webp/);
    assert.ok(!existsSync(path.join(root, 'public/images/members/shared.png')));
  });
});
