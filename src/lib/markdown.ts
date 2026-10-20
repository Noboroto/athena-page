import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkPlugins, rehypePlugins, syntaxHighlight } from './markdown-options.mjs';

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

/** Renders a Markdown string (site.yml intro, bio_en) with the same sanitizing pipeline as content files. */
export async function renderMarkdown(source: string): Promise<string> {
  processor ??= createMarkdownProcessor({ remarkPlugins, rehypePlugins, syntaxHighlight });
  const { code } = await (await processor).render(source);
  return code;
}
