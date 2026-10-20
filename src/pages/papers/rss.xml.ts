import type { APIContext } from 'astro';
import { papersFeed } from '../../lib/feed';

export const GET = (ctx: APIContext) => papersFeed(ctx);
