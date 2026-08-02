import assert from 'node:assert/strict';
import test from 'node:test';
import {
  controllerContext,
  observedAuthority,
  registrationExecutor,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  absenceReceipt,
  cleanupOperationReceipt,
} from './registration-cleanup-receipt.fixture.mjs';
import {
  registrationLayout,
  runRegistrationController,
} from './registration-controller.mjs';

const cleanup =
  'set-egress-default-drop unmount-token delete-token-layout stop-registration-container remove-registration-container unmount-release delete-release-layout unmount-staging delete-staging-layout remove-isolation remove-network stop-daemons restore-capture prove-registration-cleanup disarm-watchdog release-lock'.split(
    ' '
  );
const cleanupAfterPreSealRemoval = cleanup.filter(
  (operation) =>
    operation !== 'stop-registration-container' &&
    operation !== 'remove-registration-container'
);
const makeFixture = (options = {}) => {
  const fixture = registrationExecutor(
    registrationLayout(controllerContext),
    options
  );
  const execute = fixture.dependencies.execute;
  fixture.dependencies.execute = async (operation, payload) => {
    const result = await execute(operation, payload);
    if (operation === 'remove-registration-container')
      return (
        options.removalReceipt ?? {
          containerId: payload.containerId,
          removed: true,
          schemaVersion: 1,
        }
      );
    const cleanupReceipt = cleanupOperationReceipt(operation, options);
    if (cleanupReceipt) return cleanupReceipt;
    if (operation === 'prove-registration-cleanup')
      return options.cleanupReceipt ?? absenceReceipt(payload.containerId);
    return result;
  };
  return fixture;
};
const run = (fixture) =>
  runRegistrationController(
    controllerContext,
    resourceContract,
    fixture.dependencies
  );
test('runs one durable registration and publishes one release after token deletion', async () => {
  const fixture = makeFixture();
  const receipt = await run(fixture);
  const calls = fixture.calls;
  assert.ok(calls.indexOf('probe-public-tls') < calls.indexOf('read-token'));
  assert.ok(calls.indexOf('verify-default-drop') < calls.indexOf('read-token'));
  assert.ok(
    calls.indexOf('set-egress-default-drop') <
      calls.indexOf('create-registration-container')
  );
  assert.ok(
    calls.indexOf('create-registration-container') <
      calls.indexOf('inspect-registration-config') &&
      calls.indexOf('inspect-registration-config') <
        calls.indexOf('start-registration-container')
  );
  assert.deepEqual(
    fixture.payloads.find(
      ([operation]) => operation === 'start-registration-container'
    )?.[1],
    { containerId: observedAuthority.containerId }
  );
  const observedAt = fixture.payloads.findIndex(
    ([operation, payload]) =>
      operation === 'inspect-registration' && payload.phase === 'node-started'
  );
  const startedAt = fixture.payloads.findIndex(
    ([operation]) => operation === 'start-registration-container'
  );
  const readyAt = fixture.payloads.findIndex(
    ([operation]) => operation === 'wait-registration-ready'
  );
  assert.ok(startedAt < observedAt && observedAt < readyAt);
  assert.ok(
    calls.indexOf('delete-token-layout') <
      calls.indexOf('activate-registration-egress')
  );
  assert.ok(
    calls.indexOf('verify-release-file') <
      calls.lastIndexOf('inspect-registration')
  );
  assert.ok(
    calls.indexOf('delete-release-file') <
      calls.indexOf('prove-release-absence')
  );
  assert.ok(
    calls.indexOf('activate-registration-egress') <
      calls.indexOf('publish-release-once')
  );
  assert.ok(
    calls.indexOf('publish-release-once') <
      calls.indexOf('wait-release-read-once')
  );
  assert.equal(
    calls.filter((value) => value === 'publish-release-once').length,
    1
  );
  assert.deepEqual(fixture.boundaries, [
    'before-token-parent',
    'token-created',
    'before-policy-mount',
    'before-staging-mount',
    'before-token-mount',
    'before-release-mount',
    'registration-ready',
    'registration-ready',
    'token-absent',
    'before-release-publication',
    'release-consumed',
    'before-exec-verification',
    'after-exec-verification',
    'before-seal',
  ]);
  assert.deepEqual(
    calls.slice(-cleanupAfterPreSealRemoval.length),
    cleanupAfterPreSealRemoval
  );
  const removalAt = calls.indexOf('remove-registration-container');
  assert.deepEqual(
    fixture.payloads.find(
      ([operation]) => operation === 'remove-registration-container'
    ),
    [
      'remove-registration-container',
      { containerId: observedAuthority.containerId },
    ]
  );
  assert.equal(
    calls.filter((operation) => operation === 'remove-registration-container')
      .length,
    1
  );
  assert.ok(removalAt < calls.indexOf('guard-registration', removalAt));
  assert.equal(fixture.published.mode, 0o440);
  assert.equal(fixture.published.path.endsWith('/handoff/release.json'), true);
  const releaseProof = fixture.payloads.find(
    ([operation]) => operation === 'verify-release-file'
  )?.[1];
  assert.deepEqual(releaseProof, {
    gid: 10001,
    mode: 0o440,
    path: fixture.published.path,
    sha256: fixture.published.sha256,
    uid: 0,
  });
  const release = JSON.parse(fixture.published.bytes);
  assert.equal(release.generation, 1);
  assert.equal(release.containerId, observedAuthority.containerId);
  assert.equal(release.pid, observedAuthority.listenerPid);
  assert.equal(release.cgroupNamespace, observedAuthority.cgroupNamespace);
  assert.deepEqual(
    fixture.payloads.find(
      ([operation, payload]) =>
        operation === 'guard-registration' &&
        payload.boundary === 'registration-ready'
    )?.[1].authority,
    observedAuthority
  );
  assert.equal(fixture.tokenClearedBeforeStart, true);
  assert.doesNotMatch(
    JSON.stringify({ receipt, published: fixture.published }),
    /A{20}/
  );
  assert.deepEqual(Object.keys(receipt), [
    'captureSha256',
    'imageDigest',
    'registrationReleaseSha256',
    'runnerIdentitySha256',
    'schemaVersion',
    'sealedRunnerSha256',
    'cleanupSha256',
  ]);
});

test('refuses create identity and immutable-config drift before start', async () => {
  for (const options of [
    { createdContainerId: 'short' },
    { configContainerId: 'f'.repeat(64) },
    { configArgvSha256: 'f'.repeat(64) },
    { configImageDigest: `sha256:${'f'.repeat(64)}` },
  ]) {
    const fixture = makeFixture(options);
    await assert.rejects(run(fixture), /registration transaction failed/);
    assert.equal(fixture.calls.includes('start-registration-container'), false);
    const removed = fixture.payloads.find(
      ([operation]) => operation === 'remove-registration-container'
    )?.[1];
    assert.deepEqual(
      removed,
      options.createdContainerId
        ? undefined
        : { containerId: observedAuthority.containerId }
    );
    assert.equal(fixture.calls.includes('prove-registration-cleanup'), true);
  }
});
test('retains watchdog and lock when emergency stop, isolation removal, or restore cannot complete', async () => {
  for (const failAt of [
    'set-egress-default-drop',
    'remove-isolation',
    'restore-capture',
  ]) {
    const fixture = makeFixture({
      failAt,
      failAtOccurrence: failAt === 'set-egress-default-drop' ? 2 : 1,
    });
    await assert.rejects(
      run(fixture),
      /registration cleanup failed|registration transaction failed/
    );
    assert.ok(
      fixture.calls.indexOf('delete-token-layout') <
        Math.max(
          fixture.calls.indexOf('stop-registration-container'),
          fixture.calls.indexOf('remove-registration-container')
        ),
      failAt
    );
    assert.equal(fixture.calls.includes('disarm-watchdog'), false, failAt);
    assert.equal(fixture.calls.includes('release-lock'), false, failAt);
  }
});
test('does not consume stdin or create token state on a pre-token refusal', async () => {
  const fixture = makeFixture({
    failAt: 'probe-public-tls',
  });
  await assert.rejects(run(fixture), /registration transaction failed/);
  assert.equal(fixture.calls.includes('read-token'), false);
  assert.equal(fixture.calls.includes('create-token-layout'), false);
  assert.deepEqual(
    fixture.calls.slice(-(cleanup.length - 2)),
    cleanup.filter(
      (operation) =>
        operation !== 'stop-registration-container' &&
        operation !== 'remove-registration-container'
    )
  );
});
test('performs the same token-first cleanup for every terminal boundary', async () => {
  for (const failAt of [
    'write-registration-token',
    'mount-token',
    'wait-registration-ready',
    'activate-registration-egress',
    'publish-release-once',
    'wait-release-read-once',
    'wait-registration-exit',
    'seal-runner',
  ]) {
    const fixture = makeFixture({ failAt });
    await assert.rejects(run(fixture), /registration transaction failed/);
    const expected = fixture.calls.includes('create-registration-container')
      ? failAt === 'seal-runner'
        ? [...cleanupAfterPreSealRemoval]
        : [...cleanup]
      : cleanup.filter(
          (operation) =>
            operation !== 'stop-registration-container' &&
            operation !== 'remove-registration-container'
        );
    if (fixture.calls.includes('mark-registration-ambiguous'))
      expected.splice(-1, 0, 'mark-registration-ambiguous');
    assert.deepEqual(fixture.calls.slice(-expected.length), expected, failAt);
    if (failAt === 'publish-release-once') {
      const tokenReads = fixture.calls.filter(
        (value) => value === 'read-token'
      ).length;
      await assert.rejects(run(fixture), /registration transaction failed/);
      assert.equal(
        fixture.calls.filter((value) => value === 'read-token').length,
        tokenReads
      );
    }
  }
});
test('attempts every cleanup action and rejects when cleanup itself fails', async () => {
  const fixture = makeFixture({
    failAt: 'unmount-staging',
  });
  await assert.rejects(run(fixture), /registration cleanup failed/);
  for (const operation of cleanupAfterPreSealRemoval)
    assert.ok(fixture.calls.includes(operation));
  assert.equal(fixture.calls.at(-1), 'release-lock');
});
