import { parseDocument } from 'yaml';

// Opening fence, optional YAML block, closing fence. The body is everything after it.
const FENCE = /^﻿?---[ \t]*(\r?\n)(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/**
 * Split a Markdown file into a YAML document (comments kept) and a byte-exact body.
 * Same contract as scripts/lib/frontmatter.mjs; duplicated because workflow dependencies are
 * installed in `.github/scripts` only and the site's copy would resolve `yaml` from the repo root.
 */
export function splitFrontmatter(raw) {
  const match = FENCE.exec(raw);
  if (!match) throw new Error('Thiếu frontmatter (---)');
  const doc = parseDocument(match[2] ?? '', { prettyErrors: true });
  if (doc.errors.length > 0) throw new Error(`YAML lỗi: ${doc.errors[0].message.split('\n')[0]}`);
  const data = doc.toJS() ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Frontmatter phải là một đối tượng key: value');
  }
  return { doc, body: raw.slice(match[0].length), eol: match[1], head: match[2] ?? '' };
}

export function joinFrontmatter(doc, body, eol = '\n') {
  const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '');
  const text = `---\n${yaml.length > 0 ? `${yaml}\n` : ''}---\n`;
  return (eol === '\n' ? text : text.replace(/\n/g, eol)) + body;
}

/** Set top-level frontmatter keys (strings/booleans) and keep every other byte of the file. */
export function setFields(raw, patch) {
  const { doc, body, eol } = splitFrontmatter(raw);
  for (const [key, value] of Object.entries(patch)) doc.set(key, value);
  return joinFrontmatter(doc, body, eol);
}

/** Top-level frontmatter values as plain JS. */
export function readFields(raw) {
  return splitFrontmatter(raw).doc.toJS() ?? {};
}
