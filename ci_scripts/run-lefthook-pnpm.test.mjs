import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const runner = new URL('./run-lefthook-pnpm.sh', import.meta.url);
const wrapper = new URL('./hook-bin/pnpm', import.meta.url);

test('routes sparse install commands through allowUnusedPatches', () => {
  const temp = mkdtempSync(join(tmpdir(), 'baci-hook-pnpm-'));
  const log = join(temp, 'pnpm.log');
  const fakePnpm = join(temp, 'real-pnpm');
  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${log}"
exit 0
`,
    { mode: 0o755 }
  );

  const result = spawnSync(
    '/bin/bash',
    [
      '-c',
      `export BACI_REAL_PNPM='${fakePnpm}'
exec '${wrapper.pathname}' install --frozen-lockfile`,
    ],
    {
      cwd: new URL('..', import.meta.url).pathname,
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin',
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(log, 'utf8').trim();
  assert.match(output, /^--config\.allowUnusedPatches=true install --frozen-lockfile$/);
});

test('run-lefthook-pnpm prepends the hook pnpm wrapper to PATH', () => {
  const source = readFileSync(runner, 'utf8');
  assert.match(source, /ci_scripts\/hook-bin:\$PATH/);
  assert.match(source, /BACI_REAL_PNPM/);
});
