import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'health-check.sh');

// Fake curl: prints the status configured per URL in FAKE_STATUS ("url=code;url=code").
const FAKE_CURL = `#!/usr/bin/env bash
url="\${@: -1}"
IFS=';' read -ra pairs <<<"$FAKE_STATUS"
for pair in "\${pairs[@]}"; do
  if [[ "\${pair%%=*}" == "$url" ]]; then printf '%s' "\${pair#*=}"; exit 0; fi
done
printf '000'
`;

// Fake gh: logs calls (plus body files) and answers `issue list` per label from FAKE_OPEN ("label=number;...").
const FAKE_GH = `#!/usr/bin/env bash
{
  echo "gh $*"
  prev=""
  for a in "$@"; do
    if [[ "$prev" == "--body-file" ]]; then sed 's/^/  | /' "$a"; fi
    prev="$a"
  done
} >>"$GH_LOG"
if [[ "$1 $2" == "issue list" ]]; then
  label=""
  prev=""
  for a in "$@"; do [[ "$prev" == "--label" ]] && label="$a"; prev="$a"; done
  IFS=';' read -ra pairs <<<"\${FAKE_OPEN:-}"
  for pair in "\${pairs[@]}"; do [[ "\${pair%%=*}" == "$label" ]] && printf '%s' "\${pair#*=}"; done
fi
exit 0
`;

const CMS = 'https://editor.example.test/';
const SITE = 'https://site.example.test/';
let dir;
before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'health-check-'));
  for (const [name, body] of [
    ['curl', FAKE_CURL],
    ['gh', FAKE_GH],
  ]) {
    writeFileSync(path.join(dir, name), body);
    chmodSync(path.join(dir, name), 0o755);
  }
});
after(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
function run({ status, open = '' }) {
  n += 1;
  const log = path.join(dir, `gh-${n}.log`);
  writeFileSync(log, '');
  const result = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}${path.delimiter}${process.env.PATH}`,
      GH_TOKEN: 'x',
      REPO: 'o/r',
      RUN_URL: 'https://github.com/o/r/actions/runs/1',
      CMS_URL: CMS,
      SITE_URL: SITE,
      RETRY_SLEEP: '0',
      GH_LOG: log,
      FAKE_STATUS: status,
      FAKE_OPEN: open,
    },
  });
  return { ...result, log: readFileSync(log, 'utf8') };
}

describe('health-check.sh', () => {
  it('healthy: exits 0 and only opens the monthly maintenance reminder', () => {
    const r = run({ status: `${CMS}=200;${SITE}=200` });
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.log, /incident/);
    assert.match(r.log, /issue create .*--label maintenance/);
    assert.match(r.log, /Brevo/);
  });

  it('CMS returns 500: opens an incident issue naming the CMS and exits 1', () => {
    const r = run({ status: `${CMS}=500;${SITE}=200` });
    assert.equal(r.status, 1);
    assert.match(r.log, /issue create .*--label incident/);
    assert.match(r.log, /CMS: `https:\/\/editor\.example\.test\/` trả về `500`/);
    assert.doesNotMatch(r.log, /Site:/);
  });

  it('site unreachable: reported as an incident', () => {
    const r = run({ status: `${CMS}=200` });
    assert.equal(r.status, 1);
    assert.match(r.log, /Site: .* trả về `000`/);
  });

  it('comments on an existing open issue instead of opening another', () => {
    const r = run({ status: `${CMS}=503;${SITE}=200`, open: 'incident=7;maintenance=9' });
    assert.equal(r.status, 1);
    assert.match(r.log, /issue comment 7 /);
    assert.match(r.log, /issue comment 9 /);
    assert.doesNotMatch(r.log, /issue create/);
  });
});
