import assert from 'node:assert/strict';
import test from 'node:test';

import { controllerContext } from './controller-contract.fixture.mjs';
import { createRegistrationCaptureRestoration } from './registration-root-restoration.mjs';

const configuration = {
  context: controllerContext,
};

test('leaves an absent capture unleased and does not invoke restore commands', async () => {
  const calls = [];
  const restoration = createRegistrationCaptureRestoration(
    configuration,
    {
      lstat: () => {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
    },
    async (...args) => calls.push(args),
    { sealRunner: async () => ({}) }
  );

  assert.deepEqual(await restoration.restoreCapture(), {
    capture: 'absent',
    schemaVersion: 1,
  });
  await restoration.releaseLock();
  assert.equal(restoration.restored(), true);
  assert.deepEqual(calls, []);
});

test('defers release until terminal publication and then releases the real lease', async () => {
  const calls = [];
  const terminalEvidence = {
    captureSha256: controllerContext.captureSha256,
    imageDigest: controllerContext.imageDigest,
    registrationReleaseSha256: 'a'.repeat(64),
  };
  const restoration = createRegistrationCaptureRestoration(
    configuration,
    {
      lstat: async () => ({}),
      readRegistrationTerminalEvidence: async () => terminalEvidence,
      readRestoredRegistration: async () => undefined,
    },
    async (file, args) => calls.push({ args, file }),
    {
      sealRunner: async () => ({
        runnerIdentitySha256: 'b'.repeat(64),
        sealedRunnerSha256: 'c'.repeat(64),
      }),
    }
  );

  await restoration.sealRunner();
  await restoration.restoreCapture();
  assert.equal(restoration.restored(), true);
  assert.deepEqual(calls[0], {
    args: [
      controllerContext.campaignId,
      controllerContext.captureSha256,
      '--defer-lease-release',
      JSON.stringify({
        ...terminalEvidence,
        runnerIdentitySha256: 'b'.repeat(64),
        sealedRunnerSha256: 'c'.repeat(64),
      }),
    ],
    file: '/srv/baci-cwv/sealed/campaign-restore.sh',
  });

  await restoration.releaseLock();
  assert.deepEqual(calls[1], {
    args: [
      controllerContext.campaignId,
      controllerContext.captureSha256,
      '--release-lease',
    ],
    file: '/srv/baci-cwv/sealed/campaign-restore.sh',
  });
});

test('binds a pre-seal restoration to the durable retry terminal', async () => {
  const calls = [];
  const restoration = createRegistrationCaptureRestoration(
    configuration,
    {
      lstat: async () => ({}),
      readRestoredRegistration: async () => undefined,
    },
    async (file, args) => calls.push({ args, file }),
    { sealRunner: async () => assert.fail('unreachable') }
  );

  await restoration.restoreCapture();
  assert.deepEqual(calls, [
    {
      args: [
        controllerContext.campaignId,
        controllerContext.captureSha256,
        '--defer-lease-release',
        JSON.stringify({
          captureSha256: controllerContext.captureSha256,
          disposition: 'retry-block',
          schemaVersion: 1,
        }),
      ],
      file: '/srv/baci-cwv/sealed/campaign-restore.sh',
    },
  ]);
});

test('reuses the durable deferred success candidate after an installed restart', async () => {
  const calls = [];
  const terminal = {
    captureSha256: controllerContext.captureSha256,
    imageDigest: controllerContext.imageDigest,
    registrationReleaseSha256: 'a'.repeat(64),
    runnerIdentitySha256: 'b'.repeat(64),
    sealedRunnerSha256: 'c'.repeat(64),
  };
  const restoration = createRegistrationCaptureRestoration(
    configuration,
    {
      lstat: async () => ({}),
      readRestoredRegistration: async () => terminal,
    },
    async (file, args) => calls.push({ args, file }),
    {
      sealRunner: async () => assert.fail('restart must not reseal the runner'),
    }
  );

  await restoration.restoreCapture();
  await restoration.releaseLock();

  assert.deepEqual(calls, [
    {
      args: [
        controllerContext.campaignId,
        controllerContext.captureSha256,
        '--defer-lease-release',
        JSON.stringify(terminal),
      ],
      file: '/srv/baci-cwv/sealed/campaign-restore.sh',
    },
    {
      args: [
        controllerContext.campaignId,
        controllerContext.captureSha256,
        '--release-lease',
      ],
      file: '/srv/baci-cwv/sealed/campaign-restore.sh',
    },
  ]);
});

test('fails closed before restore when sealed runner evidence is malformed', async () => {
  const restoration = createRegistrationCaptureRestoration(
    configuration,
    {
      lstat: async () => ({}),
      readRegistrationTerminalEvidence: async () => assert.fail('unreachable'),
      readRestoredRegistration: async () => undefined,
    },
    async () => assert.fail('unreachable'),
    { sealRunner: async () => ({ runnerIdentitySha256: 'invalid' }) }
  );

  await restoration.sealRunner();
  await assert.rejects(
    restoration.restoreCapture(),
    /registration root system refused/
  );
});
