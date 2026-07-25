import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  awaitNormalRelease,
  runListenerOnce,
  validateSealedRunnerFileMetadata,
} from './entrypoint.mjs';
import { readSealedRunnerFile } from './sealed-runner.mjs';

test('normal mode requires the inert registration staging mount point', () => {
  const source = readFileSync(
    new URL('entrypoint.mjs', import.meta.url),
    'utf8'
  );
  const invariant =
    /stagingInfo\.uid !== 10001[\s\S]{0,80}stagingInfo\.gid !== 10001[\s\S]{0,80}stagingInfo\.mode & 0o777\) !== 0o700/g;
  assert.equal(source.match(invariant)?.length, 2);
});

test('normal mode derives only its release prefix from the container hostname file', () => {
  const source = readFileSync(
    new URL('normal-release.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /const hostname = readFileSync\('\/etc\/hostname', 'utf8'\)/
  );
  const entrypoint = readFileSync(
    new URL('entrypoint.mjs', import.meta.url),
    'utf8'
  );
  const normal = entrypoint.slice(entrypoint.indexOf('function normalCli'));
  assert.doesNotMatch(normal, /BACI_CWV_CONTAINER_ID/);
  assert.doesNotMatch(source, /\/proc\/self\/cgroup/);
});

test('normal lifecycle launches direct Listener run --once and forwards once', async () => {
  const child = new EventEmitter();
  const killed = [];
  child.kill = (signal) => killed.push(signal);
  const processObject = new EventEmitter();
  processObject.off = processObject.removeListener;
  const pending = runListenerOnce('/opt/runner/bin/Runner.Listener', {
    process: processObject,
    spawn: (file, argv, options) => {
      assert.equal(file, '/opt/runner/bin/Runner.Listener');
      assert.deepEqual(argv, ['run', '--once']);
      assert.equal(options.cwd, '/opt/runner');
      assert.equal(options.shell, false);
      assert.equal(
        options.env.ACTIONS_RUNNER_HOOK_JOB_STARTED,
        '/run/baci-cwv-hooks/job-start-hook.sh'
      );
      assert.equal(options.env.DISABLE_RUNNER_UPDATE, '1');
      assert.equal(options.env.TMPDIR, '/tmp/baci-cwv');
      return child;
    },
  });
  processObject.emit('SIGTERM');
  processObject.emit('SIGTERM');
  child.emit('exit', 0, null);
  await pending;
  assert.deepEqual(killed, ['SIGTERM']);
});

test('normal lifecycle bounds a Listener that ignores its forwarded signal', async () => {
  const child = new EventEmitter();
  const killed = [];
  const timer = {};
  let expireGrace;
  let settled = false;
  child.kill = (signal) => killed.push(signal);
  const processObject = Object.assign(new EventEmitter(), {
    off: EventEmitter.prototype.removeListener,
  });
  const pending = runListenerOnce('/opt/runner/bin/Runner.Listener', {
    clearTimeout: (received) => assert.equal(received, timer),
    process: processObject,
    setTimeout: (callback, milliseconds) => {
      assert.equal(milliseconds, 5_000);
      expireGrace = callback;
      return timer;
    },
    spawn: () => child,
  });
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  try {
    processObject.emit('SIGTERM');
    assert.deepEqual(killed, ['SIGTERM']);
    expireGrace();
    assert.deepEqual(killed, ['SIGTERM', 'SIGKILL']);
    await Promise.resolve();
    assert.equal(settled, false);
    child.emit('exit', null, 'SIGKILL');
    await assert.rejects(pending, (error) => error.exitStatus === 137);
    assert.equal(processObject.listenerCount('SIGINT'), 0);
    assert.equal(processObject.listenerCount('SIGTERM'), 0);
  } finally {
    child.emit('exit', 0, null);
    await pending.catch(() => undefined);
  }
});

test('normal lifecycle preserves Listener nonzero and signal terminal statuses', async () => {
  for (const [code, signal, expected] of [
    [23, null, 23],
    [null, 'SIGINT', 130],
    [null, 'SIGTERM', 143],
  ]) {
    const child = new EventEmitter();
    child.kill = () => undefined;
    const pending = runListenerOnce('/opt/runner/bin/Runner.Listener', {
      process: Object.assign(new EventEmitter(), {
        off: EventEmitter.prototype.removeListener,
      }),
      spawn: () => child,
    });
    child.emit('exit', code, signal);
    await assert.rejects(pending, (error) => error.exitStatus === expected);
  }
});

test('sealed normal runner state is root-owned, group-readable, nonwritable regular files', () => {
  const sealed = { gid: 10001, isFile: () => true, mode: 0o100440, uid: 0 };
  assert.doesNotThrow(() => validateSealedRunnerFileMetadata(sealed));
  for (const changed of [
    { ...sealed, uid: 10001 },
    { ...sealed, mode: 0o100640 },
    { ...sealed, mode: 0o100444 },
    { ...sealed, isFile: () => false },
  ])
    assert.throws(
      () => validateSealedRunnerFileMetadata(changed),
      /sealed runner file refused/
    );
});

test('sealed runner reads without following links and closes on refusal', () => {
  const calls = [];
  const filesystem = {
    close: (descriptor) => calls.push(['close', descriptor]),
    fstat: () => ({
      gid: 10001,
      isFile: () => false,
      mode: 0o100440,
      uid: 0,
    }),
    open: (path, flags) => {
      calls.push(['open', path, flags]);
      return 41;
    },
    read: () => 'sealed',
  };
  assert.throws(
    () => readSealedRunnerFile('/opt/runner/.runner', filesystem),
    /sealed runner file refused/
  );
  assert.equal(calls[0][1], '/opt/runner/.runner');
  assert.deepEqual(calls.at(-1), ['close', 41]);
});

test('normal listener cannot start before one valid release and timeout is terminal', async () => {
  const release = {
    campaignId: 'campaign',
    captureSha256: 'a'.repeat(64),
    classifierSha256: 'b'.repeat(64),
    containerId: 'c'.repeat(64),
    containerPrefix: 'c'.repeat(12),
    createdMonotonicSeconds: 1,
    egressIdentity: 'external:eth0:2',
    expiresMonotonicSeconds: 5,
    liveSampleSha256: 'd'.repeat(64),
    peerIdentity: 'veth:veth0:3',
    policyFileSha256: 'e'.repeat(64),
    runnerIp: '192.0.2.2',
    vethIdentity: 'veth0',
  };
  let now = 1;
  let reads = 0;
  let starts = 0;
  await awaitNormalRelease(
    {
      bindings: {
        campaignId: 'campaign',
        captureSha256: 'a'.repeat(64),
        containerId: 'c'.repeat(64),
        containerPrefix: 'c'.repeat(12),
        policyFileSha256: 'e'.repeat(64),
      },
      deadline: 5,
      holdTimeoutSeconds: 120,
      notBefore: 1,
    },
    {
      delay: () => {
        now += 1;
      },
      monotonicSeconds: () => now,
      readReleaseIfPresent: () => {
        reads += 1;
        return reads === 2 ? `${canonicalJson(release)}\n` : undefined;
      },
      startListenerOnce: () => {
        starts += 1;
      },
    }
  );
  assert.equal(starts, 1);
  now = 5;
  await assert.rejects(
    awaitNormalRelease(
      { bindings: {}, deadline: 5, holdTimeoutSeconds: 120, notBefore: 1 },
      {
        delay: () => {
          now += 1;
        },
        monotonicSeconds: () => now,
        readReleaseIfPresent: () => undefined,
        startListenerOnce: () => {
          starts += 1;
        },
      }
    ),
    /release timeout/
  );
  assert.equal(starts, 1);
});

test('normal hold is bounded from the current trusted monotonic time', async () => {
  let polled = false;
  await assert.rejects(
    awaitNormalRelease(
      {
        bindings: {},
        deadline: 10_120,
        holdTimeoutSeconds: 120,
        notBefore: 10_000,
      },
      {
        delay: () => {
          polled = true;
          throw new Error('must not poll');
        },
        monotonicSeconds: () => 1_000,
        readReleaseIfPresent: () => undefined,
        startListenerOnce: () => undefined,
      }
    ),
    /normal release deadline refused/
  );
  assert.equal(polled, false);
});
