import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(workerRoot, '..');
const deployScript = join(workerRoot, 'deploy.sh');

function writeExecutable(path, source) {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function runDeployGuardScenario(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'baci-deploy-guards-'));
  const binDirectory = join(directory, 'bin');
  const rsyncMarker = join(directory, 'rsync-called');
  const sshMarker = join(directory, 'ssh-called');

  try {
    mkdirSync(binDirectory);
    writeExecutable(
      join(binDirectory, 'git'),
      `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  "rev-parse HEAD")
    echo "0123456789abcdef0123456789abcdef01234567"
    ;;
  "diff --quiet")
    [ "\${TEST_SCENARIO:-}" != "dirty-tracked" ]
    ;;
  "diff --cached --quiet")
    [ "\${TEST_SCENARIO:-}" != "dirty-staged" ]
    ;;
  "ls-files --others --exclude-standard")
    if [ "\${TEST_SCENARIO:-}" = "dirty-untracked" ]; then
      echo "untracked-file"
    fi
    ;;
  *)
    exit 0
    ;;
esac
`
    );
    writeExecutable(
      join(binDirectory, 'rsync'),
      `#!/usr/bin/env bash
touch "\${TEST_RSYNC_MARKER}"
exit 73
`
    );
    writeExecutable(
      join(binDirectory, 'ssh'),
      `#!/usr/bin/env bash
touch "\${TEST_SSH_MARKER}"
exit 74
`
    );

    const result = spawnSync('bash', [deployScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
        TEST_RSYNC_MARKER: rsyncMarker,
        TEST_SCENARIO: scenario,
        TEST_SSH_MARKER: sshMarker,
      },
    });

    return {
      result,
      rsyncCalled: existsSync(rsyncMarker),
      sshCalled: existsSync(sshMarker),
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe('deploy source guards', () => {
  for (const scenario of ['dirty-tracked', 'dirty-staged', 'dirty-untracked']) {
    it(`rejects ${scenario} source before rsync or SSH`, () => {
      const outcome = runDeployGuardScenario(scenario);

      assert.equal(outcome.result.status, 1);
      assert.match(
        outcome.result.stderr,
        /Refusing worker deployment (from a dirty tracked checkout|with untracked files)/
      );
      assert.equal(outcome.rsyncCalled, false);
      assert.equal(outcome.sshCalled, false);
    });
  }

  it('allows clean source to reach the worker sync step', () => {
    const outcome = runDeployGuardScenario('clean');

    assert.equal(outcome.result.status, 73);
    assert.equal(outcome.rsyncCalled, true);
    assert.equal(outcome.sshCalled, false);
  });
});
