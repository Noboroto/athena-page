import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileNameFor, getCollection, listTemplates, todayInVietnam } from './collections.mjs';
import { setFields } from './frontmatter.mjs';
import { parsePayload, parseTitle } from './payload.mjs';
import { safePath } from './safe-path.mjs';

export const ACTIONS = ['from-template', 'duplicate', 'translate-en'];
const ENTRY_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.md$/;

/** Validate an entry path from the payload: `<collection dir>/<file>.md`, no nesting, exists. */
function entrySource(collection, ctxPath, root) {
  const { rel, abs } = safePath(ctxPath, { allowPrefixes: [collection.dir], ext: ['.md'], root });
  const file = rel.slice(collection.dir.length + 1);
  if (!ENTRY_FILE.test(file)) throw new Error(`Không phải file bài của ${collection.name}: ${rel}`);
  if (!existsSync(abs)) throw new Error(`Không tìm thấy bài: ${rel}`);
  return { rel, file };
}

/**
 * Decide what to copy where, from an untrusted payload. Pure apart from reads under `root`;
 * nothing is written. Throws a Vietnamese error message for every rejected request.
 *
 * @param {ReturnType<typeof parsePayload>} payload
 * @param {{ root?: string, today?: string }} [options]
 * @returns {{ mode: string, src: string, dest: string, patch: Record<string, unknown>, message: string }}
 */
export function planClone(payload, { root = process.cwd(), today = todayInVietnam() } = {}) {
  const { action, context, inputs } = payload;
  const collection = getCollection(context.name);

  if (action === 'from-template') {
    if (context.type !== 'collection') throw new Error('"Tạo từ mẫu" chỉ dùng ở danh sách bài');
    if (!collection.templateDir) throw new Error(`${collection.name} không có mẫu`);
    if (context.path !== collection.dir) throw new Error('Thư mục đích không khớp collection');
    const templates = listTemplates(collection, root);
    if (typeof inputs.template !== 'string' || !templates.includes(inputs.template)) {
      throw new Error('Mẫu không thuộc collection này');
    }
    const src = safePath(inputs.template, {
      allowPrefixes: [collection.templateDir],
      ext: ['.md'],
      root,
    });
    return newEntry({ mode: action, collection, src: src.rel, title: inputs.title, today, root });
  }

  if (action === 'duplicate') {
    if (context.type !== 'entry') throw new Error('"Nhân bản" chỉ dùng trên một bài');
    if (!collection.duplicate) throw new Error(`${collection.name} không hỗ trợ nhân bản`);
    const src = entrySource(collection, context.path, root);
    return newEntry({ mode: action, collection, src: src.rel, title: inputs.title, today, root });
  }

  if (action === 'translate-en') {
    if (context.type !== 'entry') throw new Error('"Tạo bản tiếng Anh" chỉ dùng trên một bài');
    if (!collection.translateTo) throw new Error(`${collection.name} không có bản tiếng Anh`);
    const target = getCollection(collection.translateTo);
    const src = entrySource(collection, context.path, root);
    const dest = `${target.dir}/${src.file}`;
    safePath(dest, { allowPrefixes: [target.dir], ext: ['.md'], root });
    if (existsSync(path.resolve(root, dest))) throw new Error(`Bản tiếng Anh đã có: ${dest}`);
    return {
      mode: action,
      src: src.rel,
      dest,
      patch: { draft: true },
      message: `content: add English draft ${path.posix.basename(dest)}`,
    };
  }

  throw new Error(`Action không được hỗ trợ: ${action}`);
}

function newEntry({ mode, collection, src, title, today, root }) {
  const cleanTitle = parseTitle(title);
  const name = fileNameFor(collection, { title: cleanTitle, date: today }, (n) =>
    existsSync(path.resolve(root, collection.dir, n)),
  );
  const dest = `${collection.dir}/${name}`;
  safePath(dest, { allowPrefixes: [collection.dir], ext: ['.md'], root });
  const patch = { [collection.titleField]: cleanTitle, draft: true };
  if (collection.hasDate) patch.date = today;
  const verb = mode === 'duplicate' ? 'duplicate as' : 'add';
  return { mode, src, dest, patch, message: `content: ${verb} ${name} (draft)` };
}

/** Write the planned file (never overwriting) and return its repo-relative path. */
export function applyClone(plan, root = process.cwd()) {
  const raw = readFileSync(path.resolve(root, plan.src), 'utf8');
  writeFileSync(path.resolve(root, plan.dest), setFields(raw, plan.patch), { flag: 'wx' });
  return plan.dest;
}

function main() {
  const payload = parsePayload(process.env.PAYLOAD, ACTIONS);
  const plan = planClone(payload);
  applyClone(plan);
  console.log(`${plan.mode}: ${plan.src} -> ${plan.dest}`);
  if (process.env.COMMIT_MESSAGE_FILE)
    writeFileSync(process.env.COMMIT_MESSAGE_FILE, `${plan.message}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Đã tạo bài nháp\n\n- Hành động: \`${plan.mode}\`\n- Nguồn: \`${plan.src}\`\n- Bài mới: \`${plan.dest}\` (draft: true)\n`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const message = String(error.message).replace(/[\r\n]+/g, ' ');
    console.error(`::error::${message}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Không thực hiện được\n\n${message}\n`);
    }
    process.exit(1);
  }
}
