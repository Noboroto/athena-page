import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'commit-loop.sh');
const ISOLATED = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const SEED_IDENTITY = {
  GIT_AUTHOR_NAME: 'seed',
  GIT_AUTHOR_EMAIL: 'seed@example.com',
  GIT_COMMITTER_NAME: 'seed',
  GIT_COMMITTER_EMAIL: 'seed@example.com',
};

const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...ISOLATED, ...SEED_IDENTITY },
  }).trim();

// Fake `gh`: records its arguments; exits 1 when FAKE_GH_FAIL is set.
const FAKE_GH = `#!/usr/bin/env bash
echo "gh $*" >>"$GH_LOG"
[ -z "\${FAKE_GH_FAIL:-}" ]
`;

// Script under test: writes src/content/new.md (unless NO_CHANGE) and a commit message; counts runs.
const EMIT = `import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
appendFileSync(process.env.RUN_LOG, 'run\\n');
if (process.env.EMIT_FAIL) { console.error('rejected'); process.exit(1); }
if (!process.env.NO_CHANGE) {
  mkdirSync('src/content', { recursive: true });
  writeFileSync('src/content/new.md', 'new\\n');
  writeFileSync(process.env.COMMIT_MESSAGE_FILE, 'content: add new.md\\n');
}
if (process.env.GH_TOKEN) { console.error('token leaked to the script'); process.exit(1); }
`;

let base;
let origin;
let work;
let binDir;

before(() => {
  base = mkdtempSync(path.join(tmpdir(), 'commit-loop-'));
  binDir = path.join(base, 'bin');
  mkdirSync(binDir);
  writeFileSync(path.join(binDir, 'gh'), FAKE_GH);
  chmodSync(path.join(binDir, 'gh'), 0o755);
  writeFileSync(path.join(base, 'emit.mjs'), EMIT);
});
after(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
beforeEach(() => {
  n += 1;
  origin = path.join(base, `origin-${n}.git`);
  work = path.join(base, `work-${n}`);
  git(base, 'init', '--bare', '--initial-branch=main', origin);
  git(base, 'clone', '--quiet', origin, work);
  mkdirSync(path.join(work, 'src/content'), { recursive: true });
  writeFileSync(path.join(work, 'src/content/old.md'), 'old\n');
  git(work, 'add', '-A');
  git(work, 'commit', '--quiet', '-m', 'seed');
  git(work, 'push', '--quiet', 'origin', 'HEAD:main');
});

function run(env = {}) {
  const runLog = path.join(base, `run-${n}.log`);
  const ghLog = path.join(base, `gh-${n}.log`);
  writeFileSync(runLog, '');
  writeFileSync(ghLog, '');
  const result = spawnSync('bash', [SCRIPT, path.join(base, 'emit.mjs')], {
    cwd: work,
    encoding: 'utf8',
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      ...ISOLATED,
      GH_TOKEN: 'secret-token',
      GITHUB_REPOSITORY: 'o/r',
      RUN_LOG: runLog,
      GH_LOG: ghLog,
      RETRY_SLEEP: '0',
      ...env,
    },
  });
  return {
    ...result,
    runs: readFileSync(runLog, 'utf8').split('\n').filter(Boolean).length,
    gh: readFileSync(ghLog, 'utf8').split('\n').filter(Boolean),
  };
}

const originFiles = () => git(origin, 'ls-tree', '-r', '--name-only', 'main').split('\n');
const originCount = () => Number(git(origin, 'rev-list', '--count', 'main'));

describe('commit-loop.sh', () => {
  it('commits the change as the bot, pushes to main and dispatches the deploy', () => {
    const r = run();
    assert.equal(r.status, 0, r.stderr);
    assert.ok(originFiles().includes('src/content/new.md'));
    assert.equal(
      git(origin, 'log', '-1', '--format=%s|%an', 'main'),
      'content: add new.md|github-actions[bot]',
    );
    assert.deepEqual(r.gh, ['gh workflow run deploy.yml --ref main --repo o/r']);
    assert.equal(r.runs, 1);
  });

  it('does not hand the token to the script', () => {
    assert.equal(run().status, 0); // EMIT exits 1 when GH_TOKEN is visible
  });

  it('commits nothing but still dispatches the deploy when the script changes nothing', () => {
    const r = run({ NO_CHANGE: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(originCount(), 1);
    assert.deepEqual(r.gh, ['gh workflow run deploy.yml --ref main --repo o/r']);
  });

  it('dry_run shows the diff, pushes nothing and dispatches nothing', () => {
    const r = run({ DRY_RUN: 'true' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(originCount(), 1);
    assert.deepEqual(r.gh, []);
    assert.match(r.stdout, /new\.md/);
  });

  it('aborts without pushing or dispatching when the script rejects the request', () => {
    const r = run({ EMIT_FAIL: '1' });
    assert.notEqual(r.status, 0);
    assert.equal(r.runs, 1, 'a rejected request is not retried');
    assert.equal(originCount(), 1);
    assert.deepEqual(r.gh, []);
  });

  it('re-runs the script from origin/main when the push is rejected', () => {
    // The first push loses a race: a hook commits to origin from another clone just before it lands.
    const hook = path.join(work, '.git/hooks/pre-push');
    writeFileSync(
      hook,
      `#!/usr/bin/env bash
set -e
[ -e "${base}/raced-${n}" ] && exit 0
touch "${base}/raced-${n}"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
other="$(mktemp -d)"
git clone --quiet "${origin}" "$other"
cd "$other"
mkdir -p src/content && echo cms > src/content/cms.md
git add -A && git -c user.name=cms -c user.email=cms@example.com commit --quiet -m "cms commit" && git push --quiet origin HEAD:main
`,
    );
    chmodSync(hook, 0o755);
    const r = run();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.runs, 2, 'script re-ran after the rejected push');
    assert.ok(existsSync(path.join(base, `raced-${n}`)));
    assert.deepEqual(originFiles().sort(), [
      'src/content/cms.md',
      'src/content/new.md',
      'src/content/old.md',
    ]);
    assert.equal(originCount(), 3);
    assert.equal(r.gh.length, 1);
  });

  it('fails after three rejected pushes without dispatching', () => {
    const hook = path.join(work, '.git/hooks/pre-push');
    writeFileSync(hook, '#!/usr/bin/env bash\nexit 1\n');
    chmodSync(hook, 0o755);
    const r = run();
    assert.notEqual(r.status, 0);
    assert.equal(r.runs, 3);
    assert.equal(originCount(), 1);
    assert.deepEqual(r.gh, []);
  });

  it('fails when the deploy cannot be dispatched, after the content is already pushed', () => {
    const r = run({ FAKE_GH_FAIL: '1' });
    assert.notEqual(r.status, 0);
    assert.equal(r.gh.length, 3);
    assert.ok(originFiles().includes('src/content/new.md'));
  });

  it('only stages the configured paths', () => {
    const r = run({ STAGE_PATHS: 'docs' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!originFiles().includes('src/content/new.md'));
  });
});
