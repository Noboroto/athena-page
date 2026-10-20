import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkPlugins, rehypePlugins, syntaxHighlight } from './src/lib/markdown-options.mjs';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import { SITE, BASE } from './site.config.mjs';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  i18n: { locales: ['vi', 'en'], defaultLocale: 'vi', routing: { prefixDefaultLocale: false } },
  markdown: {
    syntaxHighlight,
    processor: unified({ remarkPlugins, rehypePlugins }),
  },
  // Never inline scripts: the CSP meta tag only allows script-src 'self'.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [
    sitemap({
      // The search page is noindex-style (not in Pagefind); keep it out of the sitemap too.
      filter: (page) => !/\/search\/$/.test(page),
      i18n: { defaultLocale: 'vi', locales: { vi: 'vi-VN', en: 'en-US' } },
    }),
    pagefind(),
  ],
});
