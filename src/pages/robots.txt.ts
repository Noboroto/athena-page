import type { APIRoute } from 'astro';
import { withBase } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('http://localhost');
  const sitemap = new URL(withBase('/sitemap-index.xml'), origin).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
