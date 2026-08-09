import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensureRemediationGlobalLock } from './remediation-global-lock.mjs';

describe('remediation global lock', () => {
  it('wraps every direct remediation job before it can call main', () => {
    const jobDirectory = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'jobs'
    );
    for (const job of [
      'remediation-codex-canary.mjs',
      'sentry-mobile-error-remediator.mjs',
      'vercel-error-remediator.mjs',
    ]) {
      const source = readFileSync(join(jobDirectory, job), 'utf8');
      assert.match(source, /ensureRemediationGlobalLock/);
      assert.match(
        source,
        /if \(!ensureRemediationGlobalLock\(\{ scriptPath: process\.argv\[1\] \}\)\) \{\s+await main\(\);/
      );
    }
  });

  it('re-execs a direct entrypoint through flock with its held marker', () => {
    let invocation;
    const reexecuted = ensureRemediationGlobalLock({
      env: {},
      runner(command, arguments_, options) {
        invocation = { arguments_, command, options };
        return { status: 0 };
      },
      scriptPath: '/srv/baci/vps-workers/jobs/vercel-error-remediator.mjs',
    });

    assert.equal(reexecuted, true);
    assert.deepEqual(invocation, {
      arguments_: [
        '-n',
        '/srv/baci/vps-workers/locks/error-remediator-global.lock',
        'env',
        'BACI_REMEDIATION_GLOBAL_FLOCK_HELD=1',
        process.execPath,
        '/srv/baci/vps-workers/jobs/vercel-error-remediator.mjs',
      ],
      command: 'flock',
      options: { env: {}, stdio: 'inherit' },
    });
  });

  it('does not reacquire the global lock in the marked child process', () => {
    assert.equal(
      ensureRemediationGlobalLock({
        env: { BACI_REMEDIATION_GLOBAL_FLOCK_HELD: '1' },
        runner() {
          throw new Error('runner must not execute');
        },
        scriptPath: '/srv/baci/vps-workers/jobs/vercel-error-remediator.mjs',
      }),
      false
    );
  });

  it('skips a direct run while another process owns the kernel lock, then recovers after it is killed', {
    skip: process.platform !== 'linux',
  }, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-flock-'));
    const lockPath = join(directory, 'global.lock');
    const workerPath = join(directory, 'holder.mjs');
    writeFileSync(
      workerPath,
      "process.stdout.write(process.argv[2] + '\\n'); if (process.argv[2] === 'holder') setInterval(() => {}, 1_000);"
    );
    const holder = spawn(
      'flock',
      ['-n', '-F', lockPath, process.execPath, workerPath, 'holder'],
      {
        stdio: ['ignore', 'pipe', 'inherit'],
      }
    );
    try {
      const [output] = await once(holder.stdout, 'data');
      assert.equal(output.toString(), 'holder\n');
      const contender = spawnSync(
        'flock',
        ['-n', lockPath, process.execPath, workerPath, 'contender'],
        { encoding: 'utf8' }
      );
      assert.equal(contender.status, 1);
      holder.kill('SIGKILL');
      await once(holder, 'exit');
      const recovered = spawnSync(
        'flock',
        ['-n', lockPath, process.execPath, workerPath, 'recovered'],
        { encoding: 'utf8' }
      );
      assert.equal(recovered.status, 0);
      assert.equal(recovered.stdout, 'recovered\n');
    } finally {
      holder.kill('SIGKILL');
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
