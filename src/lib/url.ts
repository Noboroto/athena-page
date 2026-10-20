const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefix an absolute site path ("/images/a.webp", "/en/news/") with the configured base. */
export function withBase(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  return `${BASE}/${path.replace(/^\/+/, '')}`;
}
