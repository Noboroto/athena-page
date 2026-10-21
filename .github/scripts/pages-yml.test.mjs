import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { COLLECTIONS, listTemplates } from './collections.mjs';
import { ACTIONS as CLONE_ACTIONS } from './clone-entry.mjs';
import { ACTIONS as BIBTEX_ACTIONS } from './from-bibtex.mjs';
import { ACTIONS as OPTIMIZE_ACTIONS } from './optimize-images.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readYaml = (rel) => parse(readFileSync(path.join(REPO, rel), 'utf8'));
const config = readYaml('.pages.yml');
const WORKFLOWS_DIR = path.join(REPO, '.github/workflows');
const workflows = Object.fromEntries(
  readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => [f, readYaml(`.github/workflows/${f}`)]),
);
const HANDLED = {
  'clone-entry.yml': CLONE_ACTIONS,
  'from-bibtex.yml': BIBTEX_ACTIONS,
  'optimize-images.yml': OPTIMIZE_ACTIONS,
};

const flatten = (items) => items.flatMap((i) => (i.type === 'group' ? flatten(i.items) : [i]));
const collections = Object.fromEntries(flatten(config.content).map((c) => [c.name, c]));
const allActions = [
  ...config.media.flatMap((m) =>
    (m.actions ?? []).map((a) => ({ ...a, owner: `media:${m.name}` })),
  ),
  ...Object.values(collections).flatMap((c) =>
    (c.actions ?? []).map((a) => ({ ...a, owner: c.name, collection: c })),
  ),
];

/** Field as the CMS sees it once `component:` references are merged in. */
const resolve = (field) => {
  if (!field.component) return field;
  const { component, ...own } = field;
  const base = config.components[component];
  assert.ok(base, `component ${component} is defined`);
  return { ...base, ...own, options: { ...base.options, ...own.options } };
};
const fieldsOf = (collection) => collection.fields.map(resolve);

describe('.pages.yml actions', () => {
  it('every action points at a workflow that exists and handles that action name', () => {
    assert.ok(allActions.length >= 11, `expected the full button matrix, got ${allActions.length}`);
    for (const action of allActions) {
      assert.ok(
        workflows[action.workflow],
        `${action.owner}/${action.name}: ${action.workflow} exists`,
      );
      assert.ok(
        HANDLED[action.workflow]?.includes(action.name),
        `${action.owner}/${action.name}: handled by ${action.workflow}`,
      );
      assert.equal(action.ref, 'main', `${action.owner}/${action.name} runs on main`);
    }
  });

  it('every workflow has the dispatch inputs the CMS sends', () => {
    for (const file of Object.keys(HANDLED)) {
      const inputs = workflows[file].on.workflow_dispatch.inputs;
      assert.equal(inputs.payload.required, true);
      assert.equal(inputs.dry_run.default, false);
    }
  });

  it('buttons match what each collection allows in collections.mjs', () => {
    for (const [name, config_] of Object.entries(COLLECTIONS)) {
      const names = (collections[name].actions ?? []).map((a) => a.name).sort();
      const expected = [
        config_.templateDir ? 'from-template' : null,
        config_.duplicate ? 'duplicate' : null,
        config_.translateTo ? 'translate-en' : null,
        config_.fromBibtex ? 'from-bibtex' : null,
      ]
        .filter(Boolean)
        .sort();
      assert.deepEqual(names, expected, name);
      assert.equal(collections[name].path, config_.dir, `${name} path`);
    }
    const media = config.media.find((m) => m.name === 'members');
    assert.deepEqual(
      media.actions.map((a) => a.name),
      ['optimize-images'],
    );
  });

  it('downloadable templates are exactly the template files of that collection', () => {
    for (const [name, c] of Object.entries(collections).filter(([, v]) => v.templates)) {
      const paths = c.templates.map((t) => t.path).sort();
      const own = listTemplates({ templateDir: COLLECTIONS[name]?.templateDir }, REPO);
      assert.ok(own.length > 0, `${name} has a template directory`);
      assert.deepEqual(paths, own, name);
    }
  });

  it('entry-level buttons use scope entry; list-level buttons use scope collection', () => {
    const LIST_LEVEL = ['from-template', 'from-bibtex'];
    for (const a of allActions.filter((x) => x.collection)) {
      assert.equal(
        a.scope,
        LIST_LEVEL.includes(a.name) ? 'collection' : 'entry',
        `${a.owner}/${a.name}`,
      );
    }
  });

  it('template options are exactly the template files of that collection', () => {
    for (const [name, c] of Object.entries(COLLECTIONS).filter(([, v]) => v.templateDir)) {
      const action = collections[name].actions.find((a) => a.name === 'from-template');
      const select = action.fields.find((f) => f.name === 'template');
      const options = select.options.map((o) => o.value).sort();
      assert.deepEqual(options, listTemplates({ templateDir: c.templateDir }, REPO), name);
      for (const value of options) assert.ok(existsSync(path.join(REPO, value)), value);
      assert.ok(
        action.fields.find((f) => f.name === 'title')?.required,
        `${name} asks for a title`,
      );
    }
  });

  it('every Vietnamese-side template is reachable from a button (English templates are reference only)', () => {
    const offered = new Set(
      allActions
        .filter((a) => a.name === 'from-template')
        .flatMap((a) => a.fields[0].options.map((o) => o.value)),
    );
    const onDisk = readdirSync(path.join(REPO, 'templates'), { recursive: true })
      .map((f) => f.split(path.sep).join('/'))
      .filter((f) => f.endsWith('.md') && f !== 'README.md' && !f.includes('/en/'))
      .map((f) => `templates/${f}`);
    assert.ok(onDisk.length >= 16);
    assert.deepEqual(
      onDisk.filter((f) => !offered.has(f)),
      [],
    );
  });
});

describe('.pages.yml forms', () => {
  it('every content collection has draft defaulting to true', () => {
    for (const name of Object.keys(COLLECTIONS)) {
      const draft = fieldsOf(collections[name]).find((f) => f.name === 'draft');
      assert.equal(draft?.type, 'boolean', name);
      assert.equal(draft.default, true, name);
    }
  });

  it('news and projects English forms have the same fields as the Vietnamese ones', () => {
    assert.deepEqual(collections['news-en'].fields, collections['news-vi'].fields);
    assert.deepEqual(collections['projects-en'].fields, collections['projects-vi'].fields);
  });

  it('English collections cannot create or rename entries', () => {
    for (const name of ['news-en', 'projects-en']) {
      assert.equal(collections[name].operations.create, false, name);
      assert.equal(collections[name].operations.rename, false, name);
    }
  });

  it("a member's name and file name, which form the page URL, cannot change after creation", () => {
    assert.equal(collections.members.operations.rename, false);
    const name = fieldsOf(collections.members).find((f) => f.name === 'name');
    assert.equal(name.readonly, 'edit');
    assert.equal(collections.members.filename, '{primary}.md');
  });

  it('references store the file name and point at real collections', () => {
    for (const name of Object.keys(COLLECTIONS)) {
      for (const f of fieldsOf(collections[name]).filter((x) => x.type === 'reference')) {
        assert.ok(
          collections[f.options.collection],
          `${name}.${f.name} -> ${f.options.collection}`,
        );
        assert.equal(f.options.value, '{name}', `${name}.${f.name}`);
      }
    }
  });

  it('links expose every key of the content schema and URLs are validated', () => {
    const links = config.components.links.fields.map((f) => f.name).sort();
    assert.deepEqual(links, [
      'arxiv',
      'code',
      'doi',
      'github',
      'linkedin',
      'orcid',
      'pdf',
      'scholar',
      'slides',
      'video',
      'website',
    ]);
    for (const key of ['url', 'href', 'email']) {
      const { regex } = config.components[key].pattern;
      assert.ok(new RegExp(regex).test(''), `${key} accepts an empty optional value`);
    }
    assert.ok(!new RegExp(config.components.url.pattern.regex).test('javascript:alert(1)'));
    assert.ok(!new RegExp(config.components.url.pattern.regex).test('scholar.google.com/x'));
    assert.ok(new RegExp(config.components.href.pattern.regex).test('/files/a.pdf'));
    assert.ok(!new RegExp(config.components.href.pattern.regex).test('javascript:alert(1)'));
    assert.ok(!new RegExp(config.components.href.pattern.regex).test('ftp://host/file'));
  });

  it('media sources used by fields exist and map public/ to the URL the site serves', () => {
    const media = Object.fromEntries(config.media.map((m) => [m.name, m]));
    for (const m of Object.values(media)) {
      assert.equal(`/${m.input.replace(/^public\//, '')}`, m.output, m.name);
    }
    for (const name of Object.keys(COLLECTIONS)) {
      for (const f of fieldsOf(collections[name])) {
        if (f.options?.media)
          assert.ok(media[f.options.media], `${name}.${f.name} -> ${f.options.media}`);
      }
    }
  });

  it('site settings expose the keys of src/data/site.yml', () => {
    const site = readYaml('src/data/site.yml');
    const names = collections.site.fields.map((f) => f.name);
    for (const key of Object.keys(site)) assert.ok(names.includes(key), `site.yml key ${key}`);
  });
});

describe('workflows', () => {
  const steps = Object.entries(workflows).flatMap(([file, wf]) =>
    Object.entries(wf.jobs).flatMap(([job, j]) =>
      (j.steps ?? []).map((s, i) => ({ file, job, i, step: s, j })),
    ),
  );

  it('never interpolate expressions into a shell script', () => {
    for (const { file, job, i, step } of steps.filter((s) => s.step.run)) {
      assert.ok(
        !step.run.includes('${{'),
        `${file} ${job}[${i}] passes values through env: instead`,
      );
    }
  });

  it('pin every third-party action to a commit SHA', () => {
    for (const { file, job, i, step } of steps.filter((s) => s.step.uses)) {
      assert.match(step.uses, /@[0-9a-f]{40}$/, `${file} ${job}[${i}] ${step.uses}`);
    }
  });

  it('write-capable and dispatchable workflows only run on main with explicit permissions', () => {
    for (const file of [...Object.keys(HANDLED), 'health.yml']) {
      const wf = workflows[file];
      assert.deepEqual(wf.permissions, {}, `${file} grants nothing at workflow level`);
      for (const [name, job] of Object.entries(wf.jobs)) {
        assert.equal(job.if, "github.ref == 'refs/heads/main'", `${file}/${name}`);
        assert.ok(job.permissions, `${file}/${name} declares permissions`);
      }
    }
    for (const file of Object.keys(HANDLED)) {
      assert.equal(workflows[file].concurrency.group, 'content-writes');
      assert.equal(workflows[file].concurrency['cancel-in-progress'], false);
    }
  });

  it('keep the write token out of checkout and dependency install', () => {
    for (const file of Object.keys(HANDLED)) {
      const job = Object.values(workflows[file].jobs)[0];
      const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout@'));
      assert.equal(checkout.with['persist-credentials'], false, file);
      const install = job.steps.find((s) => s.run?.includes('install'));
      assert.match(install.run, /--frozen-lockfile/);
      assert.equal(install.env?.GH_TOKEN, undefined, `${file} install step has no token`);
    }
  });

  it('can dispatch the deploy workflow (it keeps workflow_dispatch)', () => {
    assert.ok('workflow_dispatch' in workflows['deploy.yml'].on);
  });
});
