import { lstatSync } from 'node:fs';
import path from 'node:path';

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Validate a repo-relative path that came from an untrusted workflow payload.
 * Rejects absolute paths, `..`, backslashes, NUL, paths outside `allowPrefixes`, a wrong
 * extension, and any existing path component that is a symlink. Returns the normalised
 * posix-relative path and its absolute location under `root`.
 *
 * @param {unknown} rel
 * @param {{ allowPrefixes: string[], ext?: string[], root?: string }} options
 */
export function safePath(rel, { allowPrefixes, ext, root = process.cwd() }) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 400) {
    throw new Error('Đường dẫn không hợp lệ');
  }
  if (rel.includes('\0') || rel.includes('\\') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
    throw new Error(`Đường dẫn không hợp lệ: ${JSON.stringify(rel)}`);
  }
  const segments = rel.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error(`Đường dẫn không hợp lệ: ${JSON.stringify(rel)}`);
  }
  const clean = segments.join('/');
  const prefixes = allowPrefixes.map((p) => (p.endsWith('/') ? p : `${p}/`));
  if (!prefixes.some((p) => clean.startsWith(p))) {
    throw new Error(`Đường dẫn ngoài vùng cho phép: ${clean}`);
  }
  if (ext) {
    const actual = path.posix.extname(clean).toLowerCase();
    if (!ext.includes(actual)) throw new Error(`Sai đuôi file (${actual || 'không có'}): ${clean}`);
  }

  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, clean);
  if (toPosix(path.relative(rootAbs, abs)) !== clean) {
    throw new Error(`Đường dẫn thoát khỏi repo: ${clean}`);
  }

  let current = rootAbs;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Không chấp nhận symlink: ${clean}`);
  }
  return { rel: clean, abs };
}
