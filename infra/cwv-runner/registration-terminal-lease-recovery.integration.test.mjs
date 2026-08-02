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
import { createRegistrationSystemOperations } from './registration-root-system.mjs';
import { releaseRetainedTerminalLease } from './registration-terminal-lease-recovery.mjs';

const candidate = {
  captureSha256: controllerContext.captureSha256,
  imageDigest: controllerContext.imageDigest,
  registrationReleaseSha256: '4'.repeat(64),
  runnerIdentitySha256: '5'.repeat(64),
  sealedRunnerSha256: '6'.repeat(64),
};
const restored = {
  captureSha256: controllerContext.captureSha256,
  mode: 'registration',
  policyFileSha256: '1'.repeat(64),
  progress: {},
  reconciled: true,
  registrationTerminal: candidate,
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
};
const terminal = {
  captureSha256: controllerContext.captureSha256,
  cleanupSha256: '7'.repeat(64),
  imageDigest: controllerContext.imageDigest,
  registrationComplete: true,
  registrationReleaseSha256: candidate.registrationReleaseSha256,
  runnerIdentitySha256: candidate.runnerIdentitySha256,
};

async function rootOwnedFileStat(target) {
  const handle = await open(target, 'r');
  try {
    const stat = await handle.stat();
    return {
      ...stat,
      gid: 0,
      isFile: () => true,
      isSymbolicLink: () => false,
      mode: (stat.mode & ~0o777) | 0o600,
      nlink: 1,
      uid: 0,
    };
  } finally {
    await handle.close();
  }
}

test('reuses a durable success candidate through the real restore operation before lease release', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-retained-success-'));
  const directory = join(root, controllerContext.campaignId);
  const capture = `/srv/baci-cwv/campaigns/${controllerContext.campaignId}/capture.json`;
  const calls = [];
  await mkdir(directory);
  await writeFile(
    join(directory, 'restored.json'),
    `${canonicalJson(restored)}\n`,
    { mode: 0o600 }
  );
  const lstat = async (target) =>
    target === capture ? {} : rootOwnedFileStat(target);
  const system = createRegistrationSystemOperations(
    { context: controllerContext, resources: resourceContract },
    {
      campaignRoot: root,
      executeFile: (file, args) => {
        calls.push({ args, file });
        return { stderr: '', stdout: '' };
      },
      files: { paths: {} },
      guard: async () => ({}),
      lstat,
      network: {},
      receipts: {},
      sealer: {},
      verifyAuthority: async () => undefined,
    }
  );
  const release = {
    activeEgressRuleSha256: 'a'.repeat(64),
    campaignId: controllerContext.campaignId,
    captureSha256: controllerContext.captureSha256,
    containerId: observedAuthority.containerId,
    egressReleaseSha256: 'b'.repeat(64),
    imageDigest: controllerContext.imageDigest,
    name: `baci-cwv-registration-${controllerContext.registrationNonce}`,
    schemaVersion: 1,
  };

  try {
    await releaseRetainedTerminalLease(
      { context: controllerContext },
      system,
      { campaignRoot: root, lstat, readPostEgressRelease: async () => release },
      terminal
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }

  assert.deepEqual(calls, [
    {
      args: [
        controllerContext.campaignId,
        controllerContext.captureSha256,
        '--defer-lease-release',
        canonicalJson(candidate),
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
