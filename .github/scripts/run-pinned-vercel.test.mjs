import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scriptPath = new URL('run-pinned-vercel.sh', import.meta.url);

function makeFakeRuntime() {
  const tempDir = mkdtempSync(join(tmpdir(), 'baci-vercel-cli-'));
  const binDir = join(tempDir, 'bin');
  const runnerTemp = join(tempDir, 'runner-temp');
  const callsFile = join(tempDir, 'pnpm-calls.log');
  mkdirSync(binDir, { recursive: true });
  mkdirSync(runnerTemp, { recursive: true });

  writeFileSync(
    join(binDir, 'pnpm'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${callsFile}"
cli_dir=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--dir" ]; then
    cli_dir="$2"
    shift 2
    continue
  fi
  shift
done
if [ -z "$cli_dir" ]; then
  echo 'missing --dir' >&2
  exit 64
fi
mkdir -p "$cli_dir/node_modules/.bin"
cat > "$cli_dir/node_modules/.bin/vercel" <<'VERCEL'
#!/usr/bin/env bash
set -euo pipefail
echo "fake vercel $*"
VERCEL
chmod +x "$cli_dir/node_modules/.bin/vercel"
`,
    { mode: 0o755 }
  );

  return { binDir, callsFile, runnerTemp, tempDir };
}

function runScript(runtime, args = ['pull', '--yes']) {
  return spawnSync(scriptPath.pathname, args, {
    cwd: runtime.tempDir,
    env: {
      ...process.env,
      PATH: `${runtime.binDir}:${process.env.PATH ?? ''}`,
      RUNNER_TEMP: runtime.runnerTemp,
      VERCEL_CLI_VERSION: '52.0.0',
    },
    encoding: 'utf8',
  });
}

test('installs pinned Vercel CLI into runner temp without pnpm dlx', () => {
  const runtime = makeFakeRuntime();

  try {
    const result = runScript(runtime, [
      'pull',
      '--yes',
      '--environment=production',
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fake vercel pull --yes --environment=production/);
    assert.equal(existsSync(runtime.callsFile), true);

    const pnpmArgs = readFileSync(runtime.callsFile, 'utf8');
    assert.match(pnpmArgs, /--dir/);
    assert.match(pnpmArgs, /add/);
    assert.match(pnpmArgs, /--allow-build=esbuild/);
    assert.match(pnpmArgs, /--store-dir/);
    assert.match(pnpmArgs, /vercel@52\.0\.0/);
    assert.doesNotMatch(pnpmArgs, /\bdlx\b/);
  } finally {
    rmSync(runtime.tempDir, { recursive: true, force: true });
  }
});

test('reuses the installed CLI for later invocations in the same runner temp', () => {
  const runtime = makeFakeRuntime();

  try {
    assert.equal(runScript(runtime, ['pull']).status, 0);
    assert.equal(runScript(runtime, ['build', '--prod']).status, 0);

    const pnpmCalls = readFileSync(runtime.callsFile, 'utf8')
      .trim()
      .split('\n');
    assert.equal(pnpmCalls.length, 1);
  } finally {
    rmSync(runtime.tempDir, { recursive: true, force: true });
  }
});
