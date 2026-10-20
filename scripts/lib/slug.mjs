// Pages CMS stores references as "x.md"; content ids are bare slugs.
export function toSlug(value) {
  return String(value)
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/\.md$/i, '');
}
