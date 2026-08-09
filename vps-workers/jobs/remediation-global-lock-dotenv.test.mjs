import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const workerRoot = join(import.meta.dirname, '..');
const jobNames = [
  'vercel-error-remediator.mjs',
  'sentry-mobile-error-remediator.mjs',
  'remediation-codex-canary.mjs',
];

function quoteShellArgument(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function readFlockLockPath({ command, args, env, flockArgsPath }) {
  rmSync(flockArgsPath, { force: true });
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(flockArgsPath, 'utf8')
    .split('\n')
    .find((argument) => argument.endsWith('.lock'));
}

describe('remediation job global lock configuration', () => {
  for (const jobName of jobNames) {
    it(`uses the dotenv lock path before flock for direct and shell ${jobName} invocation`, (t) => {
      const directory = mkdtempSync(join(tmpdir(), 'baci-remediation-dotenv-'));
      t.after(() => rmSync(directory, { force: true, recursive: true }));
      const fixtureRoot = join(directory, 'workers');
      const jobsDirectory = join(fixtureRoot, 'jobs');
      const fakeBinDirectory = join(directory, 'bin');
      const customLockPath = join(directory, 'configured-global.lock');
      const flockArgsPath = join(directory, 'flock-args');
      mkdirSync(jobsDirectory, { recursive: true });
      mkdirSync(fakeBinDirectory);
      copyFileSync(
        join(workerRoot, 'jobs', jobName),
        join(jobsDirectory, jobName)
      );
      symlinkSync(join(workerRoot, 'lib'), join(fixtureRoot, 'lib'), 'dir');
      symlinkSync(
        join(workerRoot, '..', 'node_modules'),
        join(fixtureRoot, 'node_modules'),
        'dir'
      );
      writeFileSync(
        join(fixtureRoot, '.env'),
        `BACI_REMEDIATION_GLOBAL_LOCK_PATH=${customLockPath}\n`
      );
      const flockPath = join(fakeBinDirectory, 'flock');
      writeFileSync(
        flockPath,
        '#!/bin/sh\nprintf "%s\\n" "$@" > "$BACI_TEST_FLOCK_ARGS_PATH"\n'
      );
      chmodSync(flockPath, 0o700);
      const jobPath = realpathSync(join(jobsDirectory, jobName));
      const env = {
        ...process.env,
        BACI_TEST_FLOCK_ARGS_PATH: flockArgsPath,
        PATH: `${fakeBinDirectory}:${process.env.PATH || '/usr/bin:/bin'}`,
      };

      const directLockPath = readFlockLockPath({
        args: [jobPath],
        command: process.execPath,
        env,
        flockArgsPath,
      });
      const shellLockPath = readFlockLockPath({
        args: [
          '-c',
          `${quoteShellArgument(process.execPath)} ${quoteShellArgument(jobPath)}`,
        ],
        command: 'sh',
        env: { ...env, BACI_REMEDIATION_GLOBAL_LOCK_PATH: customLockPath },
        flockArgsPath,
      });

      assert.equal(directLockPath, customLockPath);
      assert.equal(shellLockPath, customLockPath);
    });
  }
});
