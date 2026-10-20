// Single owner of the public origin and base path. astro.config.mjs and every
// URL helper read from here; override with ATHENA_SITE / ATHENA_BASE when the host changes.
export const SITE = process.env.ATHENA_SITE ?? 'https://athena.noboroto.id.vn';
export const BASE = process.env.ATHENA_BASE ?? '/';
