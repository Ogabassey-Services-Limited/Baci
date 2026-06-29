import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptPath = fileURLToPath(new URL('deploy-with-retry.sh', import.meta.url));

function makeFakeCommand(mode) {
  const tempDir = mkdtempSync(join(tmpdir(), 'baci-deploy-retry-'));
  const binDir = join(tempDir, 'bin');
  const attemptsFile = join(tempDir, 'attempts');
  const promotedFile = join(tempDir, 'promoted');
  mkdirSync(binDir, { recursive: true });

  writeFileSync(
    join(binDir, 'fake-vercel'),
    `#!/usr/bin/env bash
set -euo pipefail
command="\${1:-}"
if [ "$command" = "promote" ]; then
  echo "\${2:-}" > "${promotedFile}"
  echo "promoted \${2:-}"
  exit 0
fi
attempt=0
if [ -f "${attemptsFile}" ]; then
  attempt="$(cat "${attemptsFile}")"
fi
attempt=$((attempt + 1))
echo "$attempt" > "${attemptsFile}"
case "${mode}" in
  success)
    echo "fake deploy ok"
    exit 0
    ;;
  retry-success)
    if [ "$attempt" -eq 1 ]; then
      echo "temporary network failure" >&2
      exit 1
    fi
    echo "fake deploy ok after retry"
    exit 0
    ;;
  duplicate-id)
    echo "Error: custom deployment id already exists for this project" >&2
    exit 1
    ;;
  duplicate-id-after-created)
    if [ "$attempt" -eq 1 ]; then
      echo "Production: https://baci-recovered.vercel.app"
      echo "network failed after deployment creation" >&2
      exit 1
    fi
    echo "Error: custom deployment id already exists for this project" >&2
    exit 1
    ;;
  fatal)
    echo "fatal deploy failure" >&2
    exit 1
    ;;
esac
`,
    { mode: 0o755 }
  );

  return { attemptsFile, binDir, promotedFile, tempDir };
}

function runScript(fakeCommand) {
  return spawnSync('bash', [scriptPath, 'fake-vercel', 'deploy'], {
    cwd: fakeCommand.tempDir,
    env: {
      ...process.env,
      BACKOFF_SECONDS: '0',
      MAX_ATTEMPTS: '2',
      PATH: `${fakeCommand.binDir}:${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8',
  });
}

test('exits successfully when deploy succeeds first try', () => {
  const fakeCommand = makeFakeCommand('success');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Deploy succeeded on attempt 1/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '1');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('retries transient deploy failures', () => {
  const fakeCommand = makeFakeCommand('retry-success');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Deploy failed, retrying/);
    assert.match(result.stdout, /Deploy succeeded on attempt 2/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('promotes the observed deployment before recovering duplicate custom ids', () => {
  const fakeCommand = makeFakeCommand('duplicate-id-after-created');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /custom deployment id already exists/);
    assert.match(result.stdout, /promoting existing deployment/);
    assert.match(result.stdout, /recovered success/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-recovered.vercel.app'
    );
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('refuses duplicate custom id recovery without an observed deployment target', () => {
  const fakeCommand = makeFakeCommand('duplicate-id');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /no deployment URL or ID was observed/);
    assert.match(result.stdout, /Deploy failed after 2 attempts/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('fails after max attempts for unrelated deploy errors', () => {
  const fakeCommand = makeFakeCommand('fatal');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /fatal deploy failure/);
    assert.match(result.stdout, /Deploy failed after 2 attempts/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});
