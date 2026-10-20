import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { toSlug } from '../scripts/lib/slug.mjs';

const httpUrl = z
  .string()
  .trim()
  .refine((u) => /^https?:\/\//i.test(u), 'Cần bắt đầu bằng http:// hoặc https://');
const hrefOrPath = z
  .string()
  .trim()
  .refine(
    (u) => /^(https?:\/\/|\/(?![\/\\]))/i.test(u),
    'Cần là URL http(s) hoặc đường dẫn bắt đầu bằng /',
  );
// Ids come from the file path only (same rule as toSlug), so a frontmatter `slug:` can never rename an entry.
const generateId = ({ entry }: { entry: string }) => entry.replace(/\.md$/i, '');
// Pages CMS saves references as "x.md"; normalise every member/project reference to "x".
const slugRef = z.string().transform(toSlug);
const links = z
  .object({
    website: httpUrl,
    scholar: httpUrl,
    github: httpUrl,
    orcid: httpUrl,
    linkedin: httpUrl,
    doi: httpUrl,
    arxiv: httpUrl,
    code: httpUrl,
    video: httpUrl,
    pdf: hrefOrPath,
    slides: hrefOrPath,
  })
  .partial()
  .default({});

const members = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/members', generateId }),
  schema: z.object({
    name: z.string().min(1),
    role: z.enum(['professor', 'lecturer', 'postdoc', 'phd', 'master', 'undergrad', 'staff']),
    status: z.enum(['current', 'alumni']).default('current'),
    position_vi: z.string().optional(),
    position_en: z.string().optional(),
    avatar: z.string().startsWith('/images/').optional(),
    interests: z.array(z.string()).default([]),
    email_public: z.email().optional(),
    links,
    joined: z.number().int().optional(),
    graduated: z.number().int().optional(),
    now_at: z.string().optional(),
    bio_en: z.string().optional(),
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

const papers = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/papers', generateId }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    // member slug or an external author's display name
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string(),
    venue_short: z.string().optional(),
    type: z.enum(['conference', 'journal', 'workshop', 'preprint', 'thesis', 'book-chapter']),
    status: z.enum(['published', 'accepted', 'preprint']).default('published'),
    links,
    bibtex: z.string().optional(),
    tags: z.array(z.string()).default([]),
    projects: z.array(slugRef).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const localized = <T extends z.ZodRawShape>(dir: string, extra: T) =>
  defineCollection({
    loader: glob({ pattern: '{vi,en}/*.md', base: `./src/content/${dir}`, generateId }),
    schema: z.object({
      title: z.string().min(1),
      summary: z.string().optional(),
      cover: z.string().startsWith('/images/').optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      ...extra,
    }),
  });

const projects = localized('projects', {
  status: z.enum(['active', 'completed']).default('active'),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  members: z.array(slugRef).default([]),
  funding: z.string().optional(),
  links,
  order: z.number().default(100),
});

const news = localized('news', {
  date: z.coerce.date(),
  category: z.enum([
    'paper',
    'award',
    'defense',
    'graduation',
    'member',
    'seminar',
    'talk',
    'grant',
    'recruitment',
    'event',
    'other',
  ]),
  author: slugRef.optional(),
  members: z.array(slugRef).default([]),
  papers: z.array(slugRef).default([]),
});

export const collections = { members, papers, projects, news };
