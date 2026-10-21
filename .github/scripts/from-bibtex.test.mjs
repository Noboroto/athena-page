import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { applyPlan, planFromBibtex } from './from-bibtex.mjs';
import { readFields, splitFrontmatter } from './frontmatter.mjs';
import { parsePayload } from './payload.mjs';

// Own fixture members, so renaming real content never breaks these tests.
const MEMBERS = { 'tran-minh-khoa': 'Trần Minh Khoa', 'le-thanh-tung': 'Lê Thanh Tùng' };

let root;
before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'from-bibtex-'));
  mkdirSync(path.join(root, 'src/content/papers'), { recursive: true });
  mkdirSync(path.join(root, 'src/content/members'), { recursive: true });
  for (const [slug, name] of Object.entries(MEMBERS)) {
    writeFileSync(path.join(root, `src/content/members/${slug}.md`), `---\nname: ${name}\n---\n`);
  }
});
after(() => rmSync(root, { recursive: true, force: true }));

const PAPERS = { type: 'collection', name: 'papers', path: 'src/content/papers' };
const payload = (bibtex, context = PAPERS) =>
  parsePayload(JSON.stringify({ action: { name: 'from-bibtex' }, context, inputs: { bibtex } }), [
    'from-bibtex',
  ]);
const plan = (bibtex, context) => planFromBibtex(payload(bibtex, context), { root });

const AAAI = String.raw`@inproceedings{tran2026local,
  title={Local {SGD} Converges under Heterogeneous Data},
  author={Tr{\`{\^a}}n, Minh Khoa and Smith, John},
  booktitle={Proceedings of the AAAI Conference on Artificial Intelligence},
  year={2026}, month=feb,
  doi={https://doi.org/10.1609/aaai.v40i1.12345},
  eprint={2601.01234}, archivePrefix={arXiv},
  abstract={We study $\alpha$-smooth functions.},
  keywords={federated learning, optimization}
}`;

describe('from-bibtex', () => {
  it('maps a conference entry to a draft paper and keeps the original BibTeX', () => {
    const result = plan(AAAI);
    assert.equal(
      result.dest,
      'src/content/papers/2026-local-sgd-converges-under-heterogeneous-data.md',
    );
    const data = readFields(result.content);
    assert.equal(data.title, 'Local SGD Converges under Heterogeneous Data');
    assert.equal(data.date, '2026-02-01');
    assert.equal(data.type, 'conference');
    assert.equal(data.status, 'published');
    assert.equal(data.draft, true);
    assert.equal(data.venue, 'Proceedings of the AAAI Conference on Artificial Intelligence');
    assert.deepEqual(data.links, {
      doi: 'https://doi.org/10.1609/aaai.v40i1.12345',
      arxiv: 'https://arxiv.org/abs/2601.01234',
    });
    assert.deepEqual(data.tags, ['federated learning', 'optimization']);
    assert.equal(data.bibtex, AAAI);
    assert.equal(
      splitFrontmatter(result.content).body,
      '\n**Tóm tắt.** We study $\\alpha$-smooth functions.\n',
    );
  });

  it('uses the member slug when an author matches a member name in either order', () => {
    const { authors } = readFields(plan(AAAI).content);
    assert.deepEqual(authors, ['tran-minh-khoa', 'John Smith']);
    const unicode = readFields(
      plan('@misc{k, title={U}, author={Minh Khoa Trần and Doe, Jane}, year={2025}}').content,
    );
    assert.deepEqual(unicode.authors, ['tran-minh-khoa', 'Jane Doe']);
  });

  it('keeps name particles and suffixes of external authors', () => {
    const { authors } = readFields(
      plan('@misc{k, title={P}, author={van der Berg, Jan and King, Jr., Martin}, year={2025}}')
        .content,
    );
    assert.deepEqual(authors, ['Jan van der Berg', 'Martin King, Jr.']);
  });

  it('turns LaTeX markup into plain text in frontmatter fields', () => {
    const data = readFields(
      plan(
        String.raw`@inproceedings{k, title={A study of {\em processes} on $\mathcal{X}$}, author={Doe, Jane}, year={2025}, booktitle={Proc. of {\textit{X}}}}`,
      ).content,
    );
    assert.equal(data.title, 'A study of processes on X');
    assert.equal(data.venue, 'Proc. of X');
  });

  it('keeps percent signs and the abstract TeX for KaTeX', () => {
    const result = plan(
      String.raw`@misc{k, title={Getting 99% accuracy}, author={Doe, Jane}, year={2025},
        url={https://x.org/a%20b}, abstract={Up 5% when $p < 0.05$ and $x > y$, $\mathbb{R}^n$.}}`,
    );
    const data = readFields(result.content);
    assert.equal(data.title, 'Getting 99% accuracy');
    assert.equal(data.links.website, 'https://x.org/a%20b');
    assert.equal(
      splitFrontmatter(result.content).body,
      '\n**Tóm tắt.** Up 5% when $p < 0.05$ and $x > y$, $\\mathbb{R}^n$.\n',
    );
  });

  it('drops "and others" and matches Vietnamese names written with LaTeX accents', () => {
    const { authors } = readFields(
      plan(
        '@inproceedings{k, title={T}, author={L{\\^e}, Thanh T{\\`u}ng and Doe, Jane and others}, booktitle={ACL}, year={2025}}',
      ).content,
    );
    assert.deepEqual(authors, ['le-thanh-tung', 'Jane Doe']);
  });

  it('files arXiv exports from Scholar and DBLP as preprints with an arXiv link', () => {
    const scholar = readFields(
      plan(
        '@article{k, title={S}, author={Doe, Jane}, journal={arXiv preprint arXiv:2501.01234}, year={2025}}',
      ).content,
    );
    assert.equal(scholar.type, 'preprint');
    assert.equal(scholar.venue, 'arXiv');
    assert.deepEqual(scholar.links, { arxiv: 'https://arxiv.org/abs/2501.01234' });

    const dblp = readFields(
      plan(
        '@article{k, title={D}, author={Doe, Jane}, journal={CoRR}, volume={abs/2501.01234}, year={2025}, eprinttype={arXiv}, eprint={2501.01234}, doi={10.48550/ARXIV.2501.01234}, url={https://doi.org/10.48550/arXiv.2501.01234}}',
      ).content,
    );
    assert.equal(dblp.type, 'preprint');
    assert.equal(dblp.status, 'preprint');
    assert.deepEqual(dblp.links, {
      doi: 'https://doi.org/10.48550/ARXIV.2501.01234',
      arxiv: 'https://arxiv.org/abs/2501.01234',
    });
  });

  it('accepts doi: prefixes and a biblatex date instead of year', () => {
    const data = readFields(
      plan(
        '@article{k, title={B}, author={Doe, Jane}, journal={JMLR}, date={2024-07-15}, doi={doi:10.1000/xyz}}',
      ).content,
    );
    assert.equal(data.date, '2024-07-01');
    assert.deepEqual(data.links, { doi: 'https://doi.org/10.1000/xyz' });
  });

  it('maps journals, workshops and unknown types', () => {
    const entry = (type, extra) =>
      readFields(
        plan(`@${type}{k, title={T ${type}}, author={Doe, Jane}, year={2025}, ${extra}}`).content,
      );
    assert.equal(entry('article', 'journal={JMLR}').type, 'journal');
    assert.equal(entry('inproceedings', 'booktitle={ICML Workshop on X}').type, 'workshop');
    const misc = entry('misc', 'url={https://arxiv.org/abs/2501.00001}');
    assert.equal(misc.type, 'preprint');
    assert.equal(misc.status, 'preprint');
    assert.equal(misc.links.arxiv, 'https://arxiv.org/abs/2501.00001');
    assert.equal(misc.venue, 'arXiv');
  });

  it('only keeps http(s) URLs', () => {
    const data = readFields(
      plan('@misc{k, title={T}, author={Doe, Jane}, year={2025}, url={javascript:alert(1)}}')
        .content,
    );
    assert.equal(data.links, undefined);
    assert.match(data.venue, /^\[\[/, 'no venue leaves a placeholder for the writer');
  });

  it('rejects input it cannot turn into exactly one usable paper', () => {
    assert.throws(() => plan(''), /Chưa dán BibTeX/);
    assert.throws(
      () =>
        plan(
          '@misc{a, title={A}, author={X, Y}, year={2025}}\n@misc{b, title={B}, author={X, Y}, year={2025}}',
        ),
      /đúng một mục/,
    );
    assert.throws(() => plan('@misc{a, title={A}, author={X, Y}}'), /year/);
    assert.throws(() => plan('@misc{a, author={X, Y}, year={2025}}'), /title/);
    assert.throws(() => plan('@misc{a, title={A}, year={2025}}'), /author/);
    assert.throws(() => plan('x'.repeat(20_001)), /dài quá/);
  });

  it('only runs from the Papers list', () => {
    assert.throws(() => plan(AAAI, { ...PAPERS, type: 'entry' }), /danh sách Papers/);
    assert.throws(
      () => plan(AAAI, { type: 'collection', name: 'members', path: 'src/content/members' }),
      /Papers/,
    );
    assert.throws(() => plan(AAAI, { ...PAPERS, path: 'src/content/news/vi' }), /không khớp/);
  });

  it('writes a new file and never overwrites one', () => {
    const result = plan(AAAI);
    applyPlan(result, root);
    assert.equal(readFileSync(path.join(root, result.dest), 'utf8'), result.content);
    assert.throws(() => applyPlan(result, root), /EEXIST/);
    assert.match(plan(AAAI).dest, /-2\.md$/);
  });
});
