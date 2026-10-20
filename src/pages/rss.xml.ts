import type { APIContext } from 'astro';
import { newsAndPapersFeed } from '../lib/feed';

export const GET = (ctx: APIContext) => newsAndPapersFeed(ctx, 'vi');
