import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = new URL('../..', import.meta.url);
const scriptPath = new URL('pnpm-install-with-retry.sh', import.meta.url);

function makeFakePnpm({ retryable }) {
  const tempDir = mkdtempSync(join(tmpdir(), 'baci-pnpm-retry-'));
  const binDir = join(tempDir, 'bin');
  const attemptsFile = join(tempDir, 'attempts');
  const storeDir = join(tempDir, 'store');

  execFileSync('mkdir', ['-p', binDir, storeDir]);
  writeFileSync(join(tempDir, 'node_modules_marker'), 'keeps temp dir non-empty');

  const firstError = retryable
    ? 'Error: database disk image is malformed\\ncode: ERR_SQLITE_ERROR\\n'
    : 'Error: non-retryable install failure\\n';

  writeFileSync(
    join(binDir, 'pnpm'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "config" ]; then
  exit 0
fi
if [ "\${1:-}" != "install" ]; then
  echo "unexpected pnpm command: $*" >&2
  exit 64
fi
attempts_file="${attemptsFile}"
attempt=0
if [ -f "$attempts_file" ]; then
  attempt="$(cat "$attempts_file")"
fi
attempt=$((attempt + 1))
echo "$attempt" > "$attempts_file"
if [ "$attempt" -eq 1 ]; then
  printf '${firstError}' >&2
  exit 1
fi
echo "fake install succeeded"
`,
    { mode: 0o755 }
  );

  return { attemptsFile, binDir, storeDir, tempDir };
}

function runScript(fakePnpm) {
  return spawnSync('bash', [scriptPath.pathname, '--frozen-lockfile'], {
    cwd: repoRoot.pathname,
    env: {
      ...process.env,
      BACKOFF_SECONDS: '0',
      MAX_ATTEMPTS: '2',
      PATH: `${fakePnpm.binDir}:${process.env.PATH ?? ''}`,
      PNPM_STORE_DIR: fakePnpm.storeDir,
    },
    encoding: 'utf8',
  });
}

test('retries after pnpm sqlite store corruption and succeeds', () => {
  const fakePnpm = makeFakePnpm({ retryable: true });

  try {
    const result = runScript(fakePnpm);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Cleaning install artifacts before retry/);
    assert.match(result.stdout, /fake install succeeded/);
    assert.equal(readFileSync(fakePnpm.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakePnpm.tempDir, { recursive: true, force: true });
  }
});

test('does not retry unrelated install failures', () => {
  const fakePnpm = makeFakePnpm({ retryable: false });

  try {
    const result = runScript(fakePnpm);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /pnpm install failed after 1 attempt/);
    assert.equal(readFileSync(fakePnpm.attemptsFile, 'utf8').trim(), '1');
  } finally {
    rmSync(fakePnpm.tempDir, { recursive: true, force: true });
  }
});
