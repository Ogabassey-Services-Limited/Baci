import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  controllerContext,
  observedAuthority,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { runInstalledRootRuntimeController } from './root-runtime-executor.mjs';
import { recoverPostEgressRegistration } from './root-runtime-post-egress-recovery.mjs';

const absent = (containerId) => ({
  bridgeAbsent: true,
  captureRestored: true,
  cgroupAbsent: true,
  containerId,
  containerdInactive: true,
  containers: [],
  dockerInactive: true,
  dockerSocketAbsent: true,
  firewallAbsent: true,
  networkAbsent: true,
  processAbsent: true,
  releaseArtifacts: [],
  schemaVersion: 2,
  stagingArtifacts: [],
  tokenArtifacts: [],
});
const output = (value) => `${canonicalJson(value)}\n`;

test('installed restart cleans a journal-bound released container before sentinel archive refusal', async () => {
  const calls = [];
  const events = [];
  let stdin = false;
  const command = Buffer.from(
    canonicalJson({
      context: { campaignId: controllerContext.campaignId },
      resources: {},
      schemaVersion: 2,
    })
  );
  const evidence = {
    activeEgressRuleSha256: 'a'.repeat(64),
    campaignId: controllerContext.campaignId,
    captureSha256: controllerContext.captureSha256,
    containerId: observedAuthority.containerId,
    egressReleaseSha256: 'b'.repeat(64),
    imageDigest: controllerContext.imageDigest,
    name: `baci-cwv-registration-${controllerContext.registrationNonce}`,
    schemaVersion: 1,
  };
  await assert.rejects(
    runInstalledRootRuntimeController(['register-token-stdin'], {
      executeBackend: (request) => {
        const { operation } = JSON.parse(request);
        calls.push(operation);
        if (operation === 'classify-registration-recovery-container')
          return output({ present: true });
        if (operation === 'remove-registration-container')
          return output({
            containerId: observedAuthority.containerId,
            removed: true,
            schemaVersion: 1,
          });
        if (['remove-isolation', 'remove-network'].includes(operation))
          return output({ schemaVersion: 1, status: 'removed' });
        if (operation === 'stop-daemons')
          return output({
            containerd: 'stopped',
            docker: 'stopped',
            schemaVersion: 1,
          });
        if (operation === 'restore-capture')
          return output({ capture: 'restored', schemaVersion: 1 });
        if (operation === 'prove-registration-cleanup')
          return output(absent(observedAuthority.containerId));
        return output({});
      },
      prepareRegistrationCommand: async (mode, dependencies) => {
        events.push(mode);
        if (mode === 'begin') return;
        assert.equal(mode, 'recover');
        const recovery = JSON.parse(
          (await dependencies.readPostEgressRecovery()).toString('utf8')
        );
        assert.equal(recovery.campaignId, controllerContext.campaignId);
        assert.equal(
          recovery.egressReleaseSha256,
          evidence.egressReleaseSha256
        );
        assert.match(recovery.cleanupSha256, /^[a-f0-9]{64}$/);
        throw new Error('owner row deletion required');
      },
      readActiveRegistrationCommand: async () => command,
      readConfiguration: async () => ({
        context: controllerContext,
        resources: resourceContract,
      }),
      readPostEgressRelease: (input) => {
        assert.deepEqual(input, {
          campaignId: controllerContext.campaignId,
          imageDigest: controllerContext.imageDigest,
          registrationNonce: controllerContext.registrationNonce,
        });
        return evidence;
      },
      readRegistrationTerminalState: async () => ({
        registrationComplete: false,
        runnerIdentitySha256: null,
      }),
      readStdin: () => {
        stdin = true;
        return Buffer.alloc(0);
      },
    }),
    /owner row deletion required/
  );
  assert.deepEqual(events, ['begin', 'recover']);
  for (const operation of [
    'stop-registration-container',
    'remove-registration-container',
    'prove-registration-cleanup',
  ])
    assert.equal(calls.includes(operation), true, operation);
  assert.equal(stdin, false);
});

test('installed restart publishes exact restored terminal evidence before releasing the retained lease', async () => {
  const calls = [];
  const events = [];
  const published = [];
  const terminal = {
    captureSha256: controllerContext.captureSha256,
    imageDigest: controllerContext.imageDigest,
    registrationReleaseSha256: 'c'.repeat(64),
    runnerIdentitySha256: 'd'.repeat(64),
    sealedRunnerSha256: 'e'.repeat(64),
  };
  const evidence = {
    activeEgressRuleSha256: 'a'.repeat(64),
    campaignId: controllerContext.campaignId,
    captureSha256: controllerContext.captureSha256,
    containerId: observedAuthority.containerId,
    egressReleaseSha256: 'b'.repeat(64),
    imageDigest: controllerContext.imageDigest,
    name: `baci-cwv-registration-${controllerContext.registrationNonce}`,
    schemaVersion: 1,
  };
  const result = await runInstalledRootRuntimeController(
    ['register-token-stdin'],
    {
      executeBackend: (request) => {
        const { operation } = JSON.parse(request);
        calls.push(operation);
        if (operation === 'classify-registration-recovery-container')
          return output({ present: false });
        if (['remove-isolation', 'remove-network'].includes(operation))
          return output({ schemaVersion: 1, status: 'removed' });
        if (operation === 'stop-daemons')
          return output({
            containerd: 'stopped',
            docker: 'stopped',
            schemaVersion: 1,
          });
        if (operation === 'restore-capture')
          return output({ capture: 'restored', schemaVersion: 1 });
        if (operation === 'prove-registration-cleanup')
          return output(absent(observedAuthority.containerId));
        return output({});
      },
      prepareRegistrationCommand: (mode) => {
        events.push(mode);
        return { disposition: 'registered', schemaVersion: 1 };
      },
      publishRegistrationTerminalReceipt: (receipt) => {
        published.push({
          releaseSeen: calls.includes('release-lock'),
          receipt,
        });
        return { receipt };
      },
      readConfiguration: async () => ({
        context: controllerContext,
        resources: resourceContract,
      }),
      readPostEgressRelease: async () => evidence,
      readRegistrationTerminalState: () => {
        throw new TypeError('registration terminal receipt refused');
      },
      readRestoredRegistration: async () => terminal,
      readStdin: () => assert.fail('restart must not replay stdin'),
    }
  );

  assert.deepEqual(events, ['finalize']);
  assert.equal(published.length, 1);
  assert.equal(published[0].releaseSeen, false);
  assert.match(published[0].receipt.cleanupSha256, /^[a-f0-9]{64}$/);
  assert.equal(calls.at(-1), 'release-lock');
  assert.deepEqual(result, {
    registrationComplete: true,
    runnerIdentitySha256: terminal.runnerIdentitySha256,
  });
});

test('restored-state recovery fails closed before cleanup when terminal evidence mismatches', async () => {
  let executed = false;
  await assert.rejects(
    recoverPostEgressRegistration(
      { context: controllerContext },
      () => {
        executed = true;
        return {};
      },
      {
        readPostEgressRelease: async () => ({
          captureSha256: controllerContext.captureSha256,
          containerId: observedAuthority.containerId,
        }),
        readRestoredRegistration: async () => ({
          captureSha256: controllerContext.captureSha256,
          imageDigest: `sha256:${'f'.repeat(64)}`,
          registrationReleaseSha256: 'a'.repeat(64),
          runnerIdentitySha256: 'b'.repeat(64),
          sealedRunnerSha256: 'c'.repeat(64),
        }),
      },
      async () => undefined,
      async () => undefined
    ),
    /root controller refused/
  );
  assert.equal(executed, false);
});

test('installed restart refuses incoherent terminal state before stdin replay', async () => {
  let stdin = false;
  await assert.rejects(
    runInstalledRootRuntimeController(['register-token-stdin'], {
      readConfiguration: async () => ({
        context: controllerContext,
        resources: resourceContract,
      }),
      readRegistrationTerminalState: () => {
        throw new TypeError('registration terminal receipt refused');
      },
      readStdin: () => {
        stdin = true;
        return Buffer.alloc(0);
      },
    }),
    /registration terminal receipt refused/
  );
  assert.equal(stdin, false);
});
