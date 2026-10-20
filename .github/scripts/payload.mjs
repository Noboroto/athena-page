const MAX_PAYLOAD_BYTES = 200_000;
const KINDS = new Set(['collection', 'entry', 'media', 'file']);
const NAME = /^[A-Za-z0-9_-]{1,64}$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Parse the JSON Pages CMS puts in `inputs.payload`. Everything in it is client-controlled,
 * so this only checks the shape and that the action is one the calling workflow handles;
 * collection, path and input checks happen in the scripts that use the values.
 *
 * @param {string | undefined} raw
 * @param {string[]} expectedActions
 */
export function parsePayload(raw, expectedActions) {
  if (typeof raw !== 'string' || raw.length === 0) throw new Error('Thiếu payload');
  if (Buffer.byteLength(raw) > MAX_PAYLOAD_BYTES) throw new Error('Payload quá lớn');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Payload không phải JSON hợp lệ');
  }
  if (!isPlainObject(data)) throw new Error('Payload phải là một đối tượng');

  const name = data.action?.name;
  if (typeof name !== 'string' || !expectedActions.includes(name)) {
    throw new Error(`Action không được hỗ trợ: ${JSON.stringify(name)}`);
  }

  const context = isPlainObject(data.context) ? data.context : {};
  const type = context.type;
  if (typeof type !== 'string' || !KINDS.has(type)) {
    throw new Error(`context.type không hợp lệ: ${JSON.stringify(type)}`);
  }
  const ctxName = context.name ?? null;
  if (ctxName !== null && (typeof ctxName !== 'string' || !NAME.test(ctxName))) {
    throw new Error('context.name không hợp lệ');
  }
  const ctxPath = context.path ?? null;
  if (ctxPath !== null && typeof ctxPath !== 'string') throw new Error('context.path không hợp lệ');

  const rawInputs = isPlainObject(data.inputs) ? data.inputs : {};
  const inputs = {};
  for (const [key, value] of Object.entries(rawInputs)) {
    if (!NAME.test(key)) throw new Error(`Tên input không hợp lệ: ${JSON.stringify(key)}`);
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`Input ${key} phải là chuỗi, số hoặc boolean`);
    }
    inputs[key] = value;
  }

  return { action: name, context: { type, name: ctxName, path: ctxPath }, inputs };
}

/** A title typed by a writer: 1-200 chars, no control characters, no leading/trailing space. */
export function parseTitle(value) {
  if (typeof value !== 'string') throw new Error('Thiếu tiêu đề');
  const title = value.trim();
  if (title.length < 1 || title.length > 200) throw new Error('Tiêu đề phải dài 1–200 ký tự');
  for (const char of title) {
    const code = char.codePointAt(0);
    if (code < 0x20 || code === 0x7f) throw new Error('Tiêu đề chứa ký tự điều khiển');
  }
  return title;
}
