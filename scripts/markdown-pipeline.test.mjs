import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { rehypePlugins, remarkPlugins, syntaxHighlight } from '../src/lib/markdown-options.mjs';

let render;
before(async () => {
  const processor = await createMarkdownProcessor({
    remarkPlugins,
    rehypePlugins,
    syntaxHighlight,
  });
  render = async (md) => (await processor.render(md)).code;
});

describe('markdown pipeline (sanitize + KaTeX)', () => {
  it('strips raw script tags and event handlers', async () => {
    const html = await render(
      'ok\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<a href="/x" onclick="alert(1)">a</a>',
    );
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /onerror/i);
    assert.doesNotMatch(html, /onclick/i);
  });

  it('drops javascript: URLs from links and images', async () => {
    const html = await render(
      '[x](javascript:alert(1)) ![y](javascript:alert(2)) <a href="javascript:alert(3)">z</a>',
    );
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.doesNotMatch(html, /src="javascript:/i);
  });

  it('renders inline and display math with KaTeX', async () => {
    const html = await render('Inline $x^2$ here.\n\n$$\nE = mc^2\n$$\n');
    assert.match(html, /class="katex"/);
    assert.match(html, /katex-display/);
  });

  it('does not let \\href in math produce a link', async () => {
    const html = await render(
      '$\\href{javascript:alert(1)}{x}$\n\n$$\n\\href{javascript:alert(1)}{x}\n$$\n',
    );
    assert.doesNotMatch(html, /<a[\s>]/i);
    assert.doesNotMatch(html, /javascript:alert\(1\)}?"/);
  });

  it('keeps ordinary markdown intact', async () => {
    const html = await render(
      '# T\n\n**b** [ok](https://example.org)\n\n```js\nconst a = 1;\n```\n',
    );
    assert.match(html, /<h1[^>]*>T<\/h1>/);
    assert.match(html, /<strong>b<\/strong>/);
    assert.match(html, /href="https:\/\/example\.org"/);
    assert.match(html, /<pre><code[^>]*>const a = 1;/);
  });
});
