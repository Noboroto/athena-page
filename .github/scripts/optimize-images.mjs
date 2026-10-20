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
import { readFields } from './frontmatter.mjs';
import { parsePayload } from './payload.mjs';
import { safePath } from './safe-path.mjs';

export const ACTIONS = ['optimize-images'];
export const MEMBERS_DIR = 'src/content/members';
export const IMAGE_DIR = 'public/images/members';
export const IMAGE_URL_PREFIX = '/images/members/';
const SOURCE_EXT = ['.jpg', '.jpeg', '.png'];
const SCAN_DIRS = ['src/content', 'src/data'];
const SCAN_EXT = new Set(['.md', '.mdx', '.yml', '.yaml', '.json']);
const SIZE = 400;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/**
 * Members whose `avatar:` points at a convertible image under public/images/members.
 * @returns {Map<string, { url: string, members: string[] }>} keyed by repo-relative image path
 */
export function findAvatarImages(root = process.cwd()) {
  const found = new Map();
  const dir = path.resolve(root, MEMBERS_DIR);
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.md')) continue;
    const member = `${MEMBERS_DIR}/${name}`;
    let avatar;
    try {
      avatar = readFields(readFileSync(path.join(dir, name), 'utf8')).avatar;
    } catch {
      continue; // a broken member file is check-content's problem, not ours
    }
    if (typeof avatar !== 'string' || !avatar.startsWith(IMAGE_URL_PREFIX)) continue;
    let image;
    try {
      image = safePath(`public${avatar}`, { allowPrefixes: [IMAGE_DIR], ext: SOURCE_EXT, root });
    } catch {
      continue;
    }
    if (!existsSync(image.abs)) continue;
    const entry = found.get(image.rel) ?? { url: avatar, members: [] };
    entry.members.push(member);
    found.set(image.rel, entry);
  }
  return found;
}

/** Replace only the `avatar:` line of the frontmatter; the body and every other line stay as is. */
export function rewriteAvatarLine(text, oldUrl, newUrl) {
  const fence = /^(﻿?---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(text);
  if (!fence) throw new Error('Thiếu frontmatter');
  const line = new RegExp(
    `^(avatar:[ \\t]*)(["']?)${escapeRegExp(oldUrl)}\\2([ \\t]*(?:#.*)?)$`,
    'm',
  );
  if (!line.test(fence[2])) throw new Error(`Không thấy dòng avatar: ${oldUrl}`);
  const head = fence[2].replace(
    line,
    (_all, key, quote, tail) => `${key}${quote}${newUrl}${quote}${tail}`,
  );
  return fence[1] + head + text.slice(fence[1].length + fence[2].length);
}

/** True when any content or data file still mentions `url` (so the original image must stay). */
export function isReferencedElsewhere(url, root = process.cwd()) {
  for (const base of SCAN_DIRS) {
    for (const file of walk(path.resolve(root, base))) {
      if (!SCAN_EXT.has(path.extname(file).toLowerCase())) continue;
      if (readFileSync(file, 'utf8').includes(url)) return true;
    }
  }
  return false;
}

/** 400x400 WebP, EXIF-oriented, cropped around the most salient region. */
export async function convertImage(from, to) {
  const { default: sharp } = await import('sharp');
  await sharp(from)
    .rotate()
    .resize(SIZE, SIZE, { fit: 'cover', position: 'attention', withoutEnlargement: false })
    .webp({ quality: 80 })
    .toFile(to);
}

/**
 * Convert every avatar image, repoint `avatar:` lines, delete originals nobody else uses.
 * @returns {Promise<{ converted: string[], skipped: { image: string, reason: string }[], kept: string[], changed: string[] }>}
 */
export async function optimizeAvatars(root = process.cwd()) {
  const result = { converted: [], skipped: [], kept: [], changed: [] };
  for (const [rel, { url, members }] of findAvatarImages(root)) {
    const ext = path.posix.extname(rel);
    const webpRel = `${rel.slice(0, -ext.length)}.webp`;
    const webpAbs = path.resolve(root, webpRel);
    if (existsSync(webpAbs)) {
      result.skipped.push({ image: rel, reason: `${webpRel} đã tồn tại` });
      continue;
    }
    try {
      await convertImage(path.resolve(root, rel), webpAbs);
    } catch (error) {
      rmSync(webpAbs, { force: true });
      result.skipped.push({
        image: rel,
        reason: `không đọc được ảnh (${error.message.split('\n')[0]})`,
      });
      continue;
    }
    const webpUrl = `/${webpRel.replace(/^public\//, '')}`;
    for (const member of members) {
      const file = path.resolve(root, member);
      writeFileSync(file, rewriteAvatarLine(readFileSync(file, 'utf8'), url, webpUrl));
      result.changed.push(member);
    }
    result.changed.push(webpRel);
    result.converted.push(rel);
    if (isReferencedElsewhere(url, root)) {
      result.kept.push(rel);
    } else {
      rmSync(path.resolve(root, rel));
      result.changed.push(rel);
    }
  }
  return result;
}

function summarize({ converted, skipped, kept }) {
  const lines = ['### Tối ưu ảnh đại diện', ''];
  lines.push(`- Đã chuyển sang WebP 400×400: ${converted.length}`);
  for (const image of converted) lines.push(`  - \`${image}\``);
  if (kept.length > 0) {
    lines.push('- Giữ lại ảnh gốc vì vẫn còn bài khác dùng:');
    for (const image of kept) lines.push(`  - \`${image}\``);
  }
  if (skipped.length > 0) {
    lines.push('- Bỏ qua:');
    for (const { image, reason } of skipped) lines.push(`  - \`${image}\`: ${reason}`);
  }
  if (converted.length === 0 && skipped.length === 0)
    lines.push('- Không có ảnh đại diện JPG/PNG nào cần chuyển.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const payload = parsePayload(process.env.PAYLOAD, ACTIONS);
  if (payload.context.type !== 'media' || payload.context.name !== 'members') {
    throw new Error('"Tối ưu ảnh" chỉ dùng ở kho ảnh thành viên');
  }
  // The folder being browsed is informational only, but it must still be inside the members folder.
  const browsed = payload.context.path ?? IMAGE_DIR;
  if (browsed !== IMAGE_DIR) safePath(browsed, { allowPrefixes: [IMAGE_DIR] });
  const result = await optimizeAvatars();
  console.log(summarize(result));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summarize(result));
  if (process.env.COMMIT_MESSAGE_FILE && result.converted.length > 0) {
    writeFileSync(
      process.env.COMMIT_MESSAGE_FILE,
      'chore: optimize member avatars (webp 400x400)\n',
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = String(error.message).replace(/[\r\n]+/g, ' ');
    console.error(`::error::${message}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Không thực hiện được\n\n${message}\n`);
    }
    process.exit(1);
  });
}
