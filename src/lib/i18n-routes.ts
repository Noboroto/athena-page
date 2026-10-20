/** getStaticPaths result for pages under `src/pages/[...locale]/`: "/" for vi, "/en/" for en. */
export function localeStaticPaths() {
  return [{ params: { locale: undefined } }, { params: { locale: 'en' } }];
}
