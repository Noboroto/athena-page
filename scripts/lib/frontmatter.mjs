import { parseDocument } from 'yaml';

// Opening fence, optional YAML block, closing fence. The body is everything after the closing line.
const FENCE = /^﻿?---[ \t]*(\r?\n)(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/**
 * Split a Markdown file into YAML frontmatter and body.
 * `doc` is a yaml Document (comments preserved); `body` is returned byte-for-byte.
 * `error` is a message when the frontmatter is missing or is not valid YAML.
 */
export function splitFrontmatter(raw) {
  const match = FENCE.exec(raw);
  if (!match) {
    return { data: {}, doc: null, body: raw, eol: '\n', error: 'Thiếu frontmatter (---)' };
  }
  const eol = match[1];
  const body = raw.slice(match[0].length);
  const doc = parseDocument(match[2] ?? '', { prettyErrors: true });
  if (doc.errors.length > 0) {
    return { data: {}, doc, body, eol, error: `YAML lỗi: ${doc.errors[0].message.split('\n')[0]}` };
  }
  const data = doc.toJS() ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { data: {}, doc, body, eol, error: 'Frontmatter phải là một đối tượng key: value' };
  }
  return { data, doc, body, eol, error: null };
}

/** Inverse of `splitFrontmatter`: re-serialise the (possibly edited) document and the untouched body. */
export function joinFrontmatter(doc, body, eol = '\n') {
  const yaml = doc.toString({ lineWidth: 0 }).replace(/\n$/, '');
  const block = yaml.length > 0 ? `${yaml}\n` : '';
  const text = `---\n${block}---\n`;
  return (eol === '\n' ? text : text.replace(/\n/g, eol)) + body;
}
