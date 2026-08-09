import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
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

function waitFor(path) {
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(path)) return;
    Atomics.wait(waiter, 0, 0, 10);
  }
  throw new Error(`timed out waiting for ${path}`);
}

function runTransition(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'baci-cron-transition-'));
  const binDirectory = join(directory, 'bin');
  const crontabMarker = join(directory, 'installed-crontab');
  const lockMarker = join(directory, 'legacy-locks');
  const remoteDirectory = join(directory, 'remote');
  const jobsDirectory = join(remoteDirectory, 'jobs');
  const directReady = join(directory, 'direct-ready');
  mkdirSync(binDirectory);
  mkdirSync(remoteDirectory);
  mkdirSync(jobsDirectory);
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
if [ "$TEST_SCENARIO" = "direct-exit" ] && kill -0 "$DIRECT_PROCESS_PID" 2>/dev/null; then
  echo "legacy direct process was still active at crontab rewrite" >&2
  exit 89
fi
cp "$1" "$CRONTAB_MARKER"
`
  );

  let directProcess;
  let directProcessPid;
  try {
    if (
      scenario === 'direct-exit' ||
      scenario === 'direct-timeout' ||
      scenario === 'unrelated-process'
    ) {
      const job = join(
        jobsDirectory,
        scenario === 'unrelated-process'
          ? 'unrelated-worker.mjs'
          : 'vercel-error-remediator.mjs'
      );
      writeFileSync(
        job,
        `import { writeFileSync } from 'node:fs'; writeFileSync(process.env.DIRECT_READY, String(process.pid)); setTimeout(() => {}, ${scenario === 'direct-exit' ? 2_500 : 5_000});`
      );
      directProcess = spawn(
        'bash',
        ['-c', '"$1" "$2" & wait', '--', process.execPath, job],
        {
          env: { ...process.env, DIRECT_READY: directReady },
          stdio: 'ignore',
        }
      );
      directProcess.unref();
      waitFor(directReady);
      directProcessPid = readFileSync(directReady, 'utf8').trim();
    }
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
          DIRECT_PROCESS_PID: directProcessPid ?? '',
          LOCK_MARKER: lockMarker,
          NODE_BIN: process.execPath,
          PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
          REMOTE_DIR: remoteDirectory,
          BACI_REMEDIATION_LEGACY_DRAIN_TIMEOUT_SECONDS:
            scenario === 'direct-exit' ? '5' : '1',
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
    if (directProcessPid) {
      try {
        process.kill(Number(directProcessPid));
      } catch {
        // The drained child has already exited.
      }
    }
    directProcess?.kill();
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

  it('waits for an active legacy direct job before rewriting the crontab', () => {
    const outcome = runTransition('direct-exit');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.crontab, /vercel-error-remediator/);
  });

  it('aborts without rewriting the crontab when a direct job will not drain', () => {
    const outcome = runTransition('direct-timeout');

    assert.notEqual(outcome.result.status, 0);
    assert.match(outcome.result.stderr, /legacy direct remediation processes/i);
    assert.equal(outcome.crontab, '');
  });

  it('does not wait for an unrelated Node process', () => {
    const outcome = runTransition('unrelated-process');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.crontab, /vercel-error-remediator/);
  });
});
