import assert from 'node:assert/strict';
import test from 'node:test';
import {
  controllerContext,
  observedAuthority,
  registrationSnapshot,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  readRegistrationToken,
  registrationContainerArgv,
  registrationLayout,
  validateRegistrationContainerArgv,
  validateRegistrationSnapshot,
} from './registration-controller.mjs';
import { observeRegistrationIdentity } from './registration-controller-state.mjs';

test('defines exact root-only token, staging, and release layouts', () => {
  assert.deepEqual(registrationLayout(controllerContext), {
    handoff: {
      gid: 10001,
      mode: 0o750,
      path: `/run/baci-cwv-registration-release/${controllerContext.releaseNonce}/handoff`,
      type: 'directory',
      uid: 0,
    },
    releaseParent: {
      gid: 0,
      mode: 0o700,
      path: `/run/baci-cwv-registration-release/${controllerContext.releaseNonce}`,
      type: 'directory',
      uid: 0,
    },
    staging: {
      gid: 10001,
      mode: 0o700,
      path: `/srv/baci-cwv/registration-staging/${controllerContext.stagingNonce}`,
      type: 'directory',
      uid: 10001,
    },
    token: {
      gid: 10001,
      mode: 0o440,
      path: `/run/baci-cwv-registration/${controllerContext.registrationNonce}/token`,
      tmpfs: true,
      type: 'file',
      uid: 0,
    },
    tokenParent: {
      gid: 0,
      mode: 0o700,
      path: `/run/baci-cwv-registration/${controllerContext.registrationNonce}`,
      tmpfs: true,
      type: 'directory',
      uid: 0,
    },
  });
});
test('reads one bounded token line only after the caller invokes the reader', async () => {
  const calls = [];
  const source = Buffer.from(`${'A'.repeat(29)}\n`);
  const token = await readRegistrationToken((contract) => {
    calls.push(contract);
    return source;
  });
  assert.strictEqual(token, source);
  assert.equal(
    source.every((byte) => byte === 0),
    false
  );
  token.fill(0);
  assert.ok(source.every((byte) => byte === 0));
  assert.deepEqual(
    calls.map(({ maximumBytes, timeoutMilliseconds }) => ({
      maximumBytes,
      timeoutMilliseconds,
    })),
    [{ maximumBytes: 129, timeoutMilliseconds: 10_000 }]
  );
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.from('A'.repeat(29)),
    Buffer.from(`${'A'.repeat(19)}\n`),
    Buffer.from(`${'A'.repeat(129)}\n`),
    Buffer.from(`${'A'.repeat(29)}\nextra`),
    Buffer.from(`${'A'.repeat(28)}!\n`),
  ]) {
    await assert.rejects(
      readRegistrationToken(() => bytes),
      /token refused/
    );
    assert.ok(bytes.every((byte) => byte === 0));
  }
});

test('owns the exact token deadline and cancels it after settlement', async () => {
  let cleared;
  let scheduled;
  await assert.rejects(
    readRegistrationToken(() => new Promise(() => undefined), {
      clearTimeout: (handle) => {
        cleared = handle;
      },
      setTimeout: (callback, milliseconds) => {
        scheduled = milliseconds;
        queueMicrotask(callback);
        return 41;
      },
    }),
    /registration token refused/
  );
  assert.equal(scheduled, 10_000);
  assert.equal(cleared, 41);
});

test('aborts a timed-out token read and wipes a buffer that resolves late', async () => {
  let resolve;
  let signal;
  const late = Buffer.from(`${'A'.repeat(29)}\n`);
  const pending = new Promise((done) => {
    resolve = done;
  });
  await assert.rejects(
    readRegistrationToken(
      (contract) => {
        signal = contract.signal;
        return pending;
      },
      {
        clearTimeout: () => undefined,
        setTimeout(callback) {
          queueMicrotask(callback);
          return 41;
        },
      }
    ),
    /registration token refused/
  );
  assert.equal(signal.aborted, true);
  resolve(late);
  await new Promise((done) => setImmediate(done));
  assert.equal(
    late.every((byte) => byte === 0),
    true
  );
});

test('freezes pre-create argv without accepting caller-supplied runtime identity', () => {
  const argv = registrationContainerArgv(controllerContext, resourceContract);
  for (const value of [
    '--memory-swap=8589934592b',
    '--entrypoint=/opt/node/bin/node',
    '/opt/baci-cwv/entrypoint.mjs',
    'registration',
  ])
    assert.ok(argv.includes(value), value);
  assert.equal(
    argv.indexOf('--entrypoint=/opt/node/bin/node') <
      argv.indexOf(controllerContext.imageDigest),
    true
  );
  assert.equal(argv.at(-4), controllerContext.imageDigest);
  assert.deepEqual(argv.slice(-3), [
    '/opt/baci-cwv/entrypoint.mjs',
    '--mode',
    'registration',
  ]);
  assert.doesNotMatch(
    argv.join('\n'),
    /BACI_CWV_(?:CONTAINER_ID|CGROUP_NAMESPACE|MOUNT_NAMESPACE|USER_NAMESPACE)|ACTIONS_RUNNER_INPUT_TOKEN|\.runner/i
  );
  assert.deepEqual(
    validateRegistrationContainerArgv(
      argv,
      controllerContext,
      resourceContract
    ),
    argv
  );
  assert.doesNotMatch(
    Object.keys(controllerContext).join('\n'),
    /^(?:cgroupNamespace|containerId|listenerPid|mountNamespace|runtimeIdentity|userNamespace)$/m
  );
  for (const injected of [
    { containerId: 'f'.repeat(64) },
    { listenerPid: 1 },
    {
      cgroupNamespace: 'cgroup:[1]',
      mountNamespace: 'mnt:[2]',
      userNamespace: 'user:[3]',
    },
    { runtimeIdentity: observedAuthority.runtimeIdentity },
  ]) {
    const malicious = { ...controllerContext, ...injected };
    assert.throws(
      () => registrationContainerArgv(malicious, resourceContract),
      /registration identity refused/
    );
  }
});

test('guards the one-PID same-namespace Node to Listener transition', () => {
  const layout = registrationLayout(controllerContext);
  for (const phase of [
    'pre-start',
    'node-started',
    'node-ready',
    'node-token-absent',
    'listener-configure',
    'post-container',
  ])
    assert.doesNotThrow(() =>
      validateRegistrationSnapshot(
        registrationSnapshot(phase, layout),
        phase,
        controllerContext,
        observedAuthority
      )
    );
  const extra = registrationSnapshot('node-ready', layout);
  extra.containers[0].processes.push({
    ...extra.containers[0].processes[0],
    pid: 999,
  });
  assert.throws(
    () =>
      validateRegistrationSnapshot(
        extra,
        'node-ready',
        controllerContext,
        observedAuthority
      ),
    /registration inventory refused/
  );
  for (const path of [
    '/sys/fs/cgroup/cwv-measurement.slice/unrelated.scope',
    `/sys/fs/cgroup/cwv-measurement.slice/docker-${'f'.repeat(64)}.scope`,
  ]) {
    const drift = registrationSnapshot('node-started', layout);
    drift.identity = {
      ...drift.identity,
      cgroupAncestry: [
        '/sys/fs/cgroup',
        '/sys/fs/cgroup/cwv-measurement.slice',
        path,
      ],
      cgroupPath: path,
    };
    assert.throws(
      () => observeRegistrationIdentity(drift, observedAuthority.containerId),
      /registration inventory refused/
    );
  }
  const mountDrift = registrationSnapshot('node-ready', layout);
  mountDrift.containers[0].mounts[1].source = '/run/substituted';
  assert.throws(
    () =>
      validateRegistrationSnapshot(
        mountDrift,
        'node-ready',
        controllerContext,
        observedAuthority
      ),
    /registration inventory refused/
  );
  for (const mutate of [
    (snapshot) => {
      snapshot.identity = {
        ...snapshot.identity,
        credentials: { ...snapshot.identity.credentials, savedUid: 0 },
      };
    },
    (snapshot) => {
      snapshot.environmentSha256 = 'not-a-live-digest';
    },
  ]) {
    const drift = registrationSnapshot('node-ready', layout);
    mutate(drift);
    assert.throws(
      () =>
        validateRegistrationSnapshot(
          drift,
          'node-ready',
          controllerContext,
          observedAuthority
        ),
      /registration inventory refused/
    );
  }
  const active = registrationSnapshot('listener-configure', layout);
  active.egress = { bytes: 1024, mode: 'active', packets: 2 };
  assert.doesNotThrow(() =>
    validateRegistrationSnapshot(
      active,
      'listener-configure',
      controllerContext,
      observedAuthority
    )
  );
});
