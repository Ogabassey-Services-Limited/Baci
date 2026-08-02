import assert from 'node:assert/strict';
import { mkdir, mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  controllerContext,
  observedAuthority,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  readRestoredRegistration,
  releaseRetainedTerminalLease,
} from './registration-terminal-lease-recovery.mjs';
import { runInstalledRootRuntimeController } from './root-runtime-executor.mjs';

const output = (value) => `${canonicalJson(value)}\n`;

const restored = (terminal) => ({
  captureSha256: controllerContext.captureSha256,
  mode: 'registration',
  policyFileSha256: '1'.repeat(64),
  progress: {},
  reconciled: true,
  registrationTerminal: terminal,
  residualState: {
    accountingTablePresent: false,
    cronSha256: '2'.repeat(64),
    dedicatedNetworkPresent: false,
    dedicatedServicesActive: false,
    ownedFirewallPresent: false,
    samplerActive: false,
    transactionContainerCount: 0,
  },
  schemaVersion: 1,
  sourceDigest: '3'.repeat(64),
});

const retryTerminal = () => ({
  captureSha256: controllerContext.captureSha256,
  imageDigest: controllerContext.imageDigest,
  registrationReleaseSha256: '4'.repeat(64),
  runnerIdentitySha256: '5'.repeat(64),
  sealedRunnerSha256: '6'.repeat(64),
});

const successTerminal = () => ({
  captureSha256: controllerContext.captureSha256,
  cleanupSha256: '7'.repeat(64),
  imageDigest: controllerContext.imageDigest,
  registrationComplete: true,
  registrationReleaseSha256: '4'.repeat(64),
  runnerIdentitySha256: '5'.repeat(64),
});

async function readShellRestored(
  value,
  suffix = '\n',
  serialized = canonicalJson(value)
) {
  const root = await mkdtemp(join(tmpdir(), 'baci-restored-'));
  const directory = join(root, controllerContext.campaignId);
  const path = join(directory, 'restored.json');
  await mkdir(directory);
  await writeFile(path, `${serialized}${suffix}`, { mode: 0o600 });
  try {
    return await readRestoredRegistration(
      {
        campaignId: controllerContext.campaignId,
        captureSha256: controllerContext.captureSha256,
        imageDigest: controllerContext.imageDigest,
      },
      {
        campaignRoot: root,
        lstat: async (target) => {
          const handle = await open(target, 'r');
          const stat = await handle.stat();
          await handle.close();
          return {
            ...stat,
            gid: 0,
            isFile: () => true,
            isSymbolicLink: () => false,
            mode: (stat.mode & ~0o777) | 0o600,
            nlink: 1,
            uid: 0,
          };
        },
      }
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

test('reads exactly one shell newline for both durable retry and success terminal variants', async () => {
  const retry = retryTerminal();
  const complete = successTerminal();
  assert.deepEqual(await readShellRestored(restored(retry)), retry);
  assert.deepEqual(await readShellRestored(restored(complete)), complete);
});

test('refuses restored receipts without exactly one canonical shell newline', async () => {
  const value = restored(retryTerminal());
  for (const suffix of ['', '\n\n', '\ntrailing'])
    await assert.rejects(
      readShellRestored(value, suffix),
      /root controller refused/
    );
  await assert.rejects(
    readShellRestored(
      value,
      '\n',
      JSON.stringify(Object.fromEntries(Object.entries(value).reverse()))
    ),
    /root controller refused/
  );
});

test('releases the retained lease after durable terminal publication before finalizing', async () => {
  const calls = [];
  let stdin = false;
  const terminal = {
    captureSha256: controllerContext.captureSha256,
    cleanupSha256: 'a'.repeat(64),
    imageDigest: controllerContext.imageDigest,
    registrationComplete: true,
    registrationReleaseSha256: 'b'.repeat(64),
    runnerIdentitySha256: 'f'.repeat(64),
  };
  const release = {
    activeEgressRuleSha256: 'c'.repeat(64),
    campaignId: controllerContext.campaignId,
    captureSha256: controllerContext.captureSha256,
    containerId: observedAuthority.containerId,
    egressReleaseSha256: 'd'.repeat(64),
    imageDigest: controllerContext.imageDigest,
    name: `baci-cwv-registration-${controllerContext.registrationNonce}`,
    schemaVersion: 1,
  };
  const result = await runInstalledRootRuntimeController(
    ['register-token-stdin'],
    {
      createRegistrationPreparationAdapter: () => (command) => {
        calls.push(command);
        assert.equal(command, 'finalize');
        return { disposition: 'registered', schemaVersion: 1 };
      },
      executeBackend: (request) => {
        const { operation } = JSON.parse(request);
        calls.push(operation);
        if (operation === 'restore-capture')
          return output({ capture: 'restored', schemaVersion: 1 });
        return output({});
      },
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
        return release;
      },
      readRegistrationTerminalState: async () => terminal,
      readRestoredRegistration: async () => ({
        captureSha256: controllerContext.captureSha256,
        imageDigest: controllerContext.imageDigest,
        registrationReleaseSha256: terminal.registrationReleaseSha256,
        runnerIdentitySha256: terminal.runnerIdentitySha256,
        sealedRunnerSha256: 'e'.repeat(64),
      }),
      readStdin: () => {
        stdin = true;
        return Buffer.alloc(0);
      },
    }
  );
  assert.deepEqual(calls, ['restore-capture', 'release-lock', 'finalize']);
  assert.equal(stdin, false);
  assert.deepEqual(result, terminal);
});

test('refuses terminal lease release before touching the backend when terminal bindings drift', async () => {
  let called = false;
  await assert.rejects(
    releaseRetainedTerminalLease(
      { context: controllerContext },
      () => {
        called = true;
        return {};
      },
      {},
      {
        captureSha256: 'a'.repeat(64),
        cleanupSha256: 'b'.repeat(64),
        imageDigest: controllerContext.imageDigest,
        registrationComplete: true,
        registrationReleaseSha256: 'c'.repeat(64),
        runnerIdentitySha256: 'd'.repeat(64),
      }
    ),
    /root controller refused/
  );
  assert.equal(called, false);
});
