import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import type { Locale } from '../i18n';

const httpUrl = z
  .string()
  .trim()
  .refine((u) => /^https?:\/\//i.test(u), 'Cần bắt đầu bằng http:// hoặc https://');

export const siteSchema = z.object({
  name_vi: z.string().min(1),
  name_en: z.string().min(1),
  tagline_vi: z.string().default(''),
  tagline_en: z.string().default(''),
  intro_vi: z.string().default(''),
  intro_en: z.string().default(''),
  // Empty string = no public contact address yet.
  contact_email: z.union([z.email(), z.literal('')]).default(''),
  links: z.record(z.string(), httpUrl).default({}),
});

type Site = z.infer<typeof siteSchema>;

let cached: Site | undefined;

/** Reads and validates src/data/site.yml (a flat YAML file so Pages CMS can edit it as a form). */
export function getSite(): Site {
  if (!cached) {
    const file = path.resolve(process.cwd(), 'src/data/site.yml');
    cached = siteSchema.parse(parse(readFileSync(file, 'utf8')));
  }
  return cached;
}

export function siteText(site: Site, locale: Locale) {
  return {
    name: site[`name_${locale}`],
    tagline: site[`tagline_${locale}`],
    intro: site[`intro_${locale}`],
  };
}
