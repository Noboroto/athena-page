import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'notify-deploy.sh');
const RUN_URL = 'https://github.com/o/r/actions/runs/1';

// Fake `gh`: logs every call (plus any --body-file content) and answers `issue list`.
const FAKE_GH = `#!/usr/bin/env bash
{
  echo "gh $*"
  prev=""
  for a in "$@"; do
    if [[ "$prev" == "--body-file" ]]; then sed 's/^/  | /' "$a"; fi
    prev="$a"
  done
} >>"$GH_LOG"
if [[ "$1 $2" == "issue list" ]]; then printf '%s' "$FAKE_OPEN_ISSUES"; fi
`;

let dir;
before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'notify-deploy-'));
  writeFileSync(path.join(dir, 'gh'), FAKE_GH);
  chmodSync(path.join(dir, 'gh'), 0o755);
});
after(() => rmSync(dir, { recursive: true, force: true }));

function run({ env = {}, quarantineMd, openIssues = '' }) {
  const cwd = mkdtempSync(path.join(dir, 'cwd-'));
  const log = path.join(cwd, 'gh.log');
  writeFileSync(log, '');
  if (quarantineMd !== undefined) writeFileSync(path.join(cwd, 'quarantine.md'), quarantineMd);
  const result = spawnSync('bash', [SCRIPT], {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: `${dir}${path.delimiter}${process.env.PATH}`,
      GH_TOKEN: 'x',
      REPO: 'o/r',
      RUN_URL,
      BUILD_RESULT: 'success',
      DEPLOY_RESULT: 'success',
      COUNT: '',
      GH_LOG: log,
      FAKE_OPEN_ISSUES: openIssues,
      ...env,
    },
  });
  const calls = readFileSync(log, 'utf8');
  return { status: result.status, stderr: result.stderr, calls };
}

describe('notify-deploy.sh', () => {
  it('clean run with no open issue does nothing besides listing', () => {
    const r = run({});
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /issue (create|close|comment)/);
  });

  it('clean run closes every open deploy-attention issue', () => {
    const r = run({ openIssues: '7\n3\n' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /gh issue close 7 --repo o\/r --comment/);
    assert.match(r.calls, /gh issue close 3 --repo o\/r --comment/);
  });

  it('quarantined posts open an issue (and ensure the label) when none is open', () => {
    const r = run({ env: { COUNT: '1' }, quarantineMd: '- `src/a.md`\n  - [[x]] còn lại\n' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /gh label create deploy-attention --repo o\/r .* --force/);
    assert.match(
      r.calls,
      /gh issue create --repo o\/r --title deploy: cần xử lý --label deploy-attention/,
    );
    assert.match(r.calls, /\| 1 bài bị cách ly/);
    assert.match(r.calls, /\| - `src\/a\.md`/);
    assert.ok(r.calls.includes(RUN_URL));
  });

  it('quarantine report is fenced so embedded markdown cannot break out', () => {
    const r = run({ env: { COUNT: '1' }, quarantineMd: '- x\n```\n@everyone ![i](http://e/x)\n' });
    assert.match(r.calls, /\| ```text\n  \| - x\n/);
    assert.equal(r.calls.match(/\| ```/g).length, 2);
    assert.match(r.calls, /\| ` ` `\n/);
  });

  it('comments on the newest open issue instead of opening a second one', () => {
    const r = run({ env: { COUNT: '2' }, quarantineMd: '- `a`\n- `b`\n', openIssues: '9\n4\n' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /gh issue comment 9 --repo o\/r --body-file/);
    assert.doesNotMatch(r.calls, /issue create|issue close|label create/);
  });

  it('failed build reports the results and links the run', () => {
    const r = run({ env: { BUILD_RESULT: 'failure', DEPLOY_RESULT: 'skipped' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /gh issue create/);
    assert.match(r.calls, /\| Build hoặc deploy thất bại \(build: failure, deploy: skipped\)/);
    assert.ok(r.calls.includes(RUN_URL));
  });

  it('failed deploy with an open issue comments and never closes it', () => {
    const r = run({ env: { DEPLOY_RESULT: 'failure' }, openIssues: '5\n' });
    assert.match(r.calls, /gh issue comment 5/);
    assert.doesNotMatch(r.calls, /issue close/);
  });

  it('cancelled run leaves issues untouched and never calls gh', () => {
    const r = run({ env: { BUILD_RESULT: 'cancelled' }, openIssues: '5\n' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.calls, '');
  });

  it('non-numeric COUNT is treated as zero', () => {
    const r = run({ env: { COUNT: 'abc' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /issue (create|comment)/);
  });

  it('fails fast when a required variable is missing', () => {
    const r = run({ env: { REPO: '' } });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /REPO is required/);
  });
});
