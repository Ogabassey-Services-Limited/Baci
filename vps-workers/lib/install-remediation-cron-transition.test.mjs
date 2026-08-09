import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const transitionScript = join(
  dirname(fileURLToPath(import.meta.url)),
  'install-remediation-cron-transition.sh'
);

function writeExecutable(path, source) {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function runTransition(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'baci-cron-transition-'));
  const binDirectory = join(directory, 'bin');
  const crontabMarker = join(directory, 'installed-crontab');
  const lockMarker = join(directory, 'legacy-locks');
  const remoteDirectory = join(directory, 'remote');
  mkdirSync(binDirectory);
  mkdirSync(remoteDirectory);
  writeExecutable(
    join(binDirectory, 'ssh'),
    `#!/usr/bin/env bash
set -euo pipefail
shift
bash -c "$1"
`
  );
  writeExecutable(
    join(binDirectory, 'flock'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "-x" ]; then
  printf '%s\\n' "$2" >> "$LOCK_MARKER"
fi
`
  );
  writeExecutable(
    join(binDirectory, 'crontab'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "-l" ]; then
  case "$TEST_SCENARIO" in
    no-crontab)
      echo "no crontab for test-user" >&2
      exit 1
      ;;
    read-error)
      echo "permission denied" >&2
      exit 2
      ;;
    *)
      echo "0 1 * * * /usr/local/bin/unrelated-worker"
      ;;
  esac
  exit 0
fi
if [ "$TEST_SCENARIO" = "interleaving" ] && [ "$(wc -l < "$LOCK_MARKER")" -ne 3 ]; then
  echo "legacy locks were not all held before the crontab rewrite" >&2
  exit 88
fi
cp "$1" "$CRONTAB_MARKER"
`
  );

  try {
    const result = spawnSync(
      'bash',
      [
        '-c',
        '. "$1"; install_remediation_cron_transition',
        '--',
        transitionScript,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          CODEX_CONTAINER_BIN: '/usr/local/bin/codex',
          CODEX_REMEDIATOR_IMAGE: 'baci/codex:test',
          CRONTAB_MARKER: crontabMarker,
          LOCK_MARKER: lockMarker,
          NODE_BIN: '/usr/bin/node',
          PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
          REMOTE_DIR: remoteDirectory,
          TEST_SCENARIO: scenario,
          VPS: 'test-vps',
        },
      }
    );
    return {
      crontab: existsSync(crontabMarker)
        ? readFileSync(crontabMarker, 'utf8')
        : '',
      locks: existsSync(lockMarker)
        ? readFileSync(lockMarker, 'utf8').trim().split('\n')
        : [],
      result,
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe('remediation cron transition', () => {
  it('holds every legacy job lock across the crontab handoff', () => {
    const outcome = runTransition('interleaving');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.equal(outcome.locks.length, 3);
    assert.match(outcome.crontab, /error-remediator-global\.lock/);
  });

  it('permits the genuine no-crontab response', () => {
    const outcome = runTransition('no-crontab');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.crontab, /vercel-error-remediator/);
  });

  it('aborts without replacing the crontab when listing it fails', () => {
    const outcome = runTransition('read-error');

    assert.notEqual(outcome.result.status, 0);
    assert.match(outcome.result.stderr, /unable to read existing crontab/i);
    assert.equal(outcome.crontab, '');
  });
});
