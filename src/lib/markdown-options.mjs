// Single definition of the Markdown pipeline, shared by astro.config.mjs (content
// collections) and src/lib/markdown.ts (strings from site.yml / bio_en).
// Sanitize runs BEFORE KaTeX: it strips raw HTML typed by authors but keeps the
// math-* classes rehype-katex looks for. KaTeX output is generated afterwards,
// so its inline styles and MathML are not filtered.
// Syntax highlighting is OFF on purpose: Astro runs Shiki before user rehype plugins, and the
// sanitizer then strips Shiki's inline styles, leaving unstyled spans. Plain <pre><code> is the
// simplest correct output; a class-based highlighter can be added later with a matching allowlist.
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', 'language-math', 'math-inline', 'math-display'],
    ],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'math-inline', 'math-display']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math-display']],
  },
};

/** @type {NonNullable<import('@astrojs/markdown-remark').AstroMarkdownOptions['remarkPlugins']>} */
export const remarkPlugins = [remarkMath];
/** @type {NonNullable<import('@astrojs/markdown-remark').AstroMarkdownOptions['rehypePlugins']>} */
export const rehypePlugins = [
  [rehypeSanitize, sanitizeSchema],
  [rehypeKatex, { trust: false, strict: 'warn', throwOnError: false }],
];

/** @type {false} */
export const syntaxHighlight = false;
