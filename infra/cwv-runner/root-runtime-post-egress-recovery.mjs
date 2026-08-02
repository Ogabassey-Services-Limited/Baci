import { createHash } from 'node:crypto';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { readRegistrationCommand } from './registration-command-store.mjs';
import { cleanupRegistration } from './registration-controller-cleanup.mjs';
import { readPostEgressRelease } from './registration-post-egress-recovery.mjs';
import {
  readRestoredRegistration,
  releaseRetainedTerminalLease,
} from './registration-terminal-lease-recovery.mjs';

const fail = () => {
  throw new TypeError('root controller refused');
};

export async function recoverPostEgressRegistration(
  configuration,
  execute,
  dependencies,
  prepare,
  publishTerminal
) {
  const context = configuration.context;
  const readRelease =
    dependencies.readPostEgressRelease ?? readPostEgressRelease;
  if (typeof readRelease !== 'function') fail();
  const release = await readRelease(
    {
      campaignId: context.campaignId,
      imageDigest: context.imageDigest,
      registrationNonce: context.registrationNonce,
    },
    dependencies.postEgressDependencies
  );
  if (release === undefined) return false;
  if (release.captureSha256 !== context.captureSha256) fail();
  const restored = await (
    dependencies.readRestoredRegistration ?? readRestoredRegistration
  )(
    {
      campaignId: context.campaignId,
      captureSha256: context.captureSha256,
      imageDigest: context.imageDigest,
    },
    dependencies.postEgressDependencies ?? dependencies
  );
  if (restored !== undefined) {
    if (
      restored === null ||
      typeof restored !== 'object' ||
      Array.isArray(restored) ||
      Object.keys(restored).sort().join(',') !==
        'captureSha256,imageDigest,registrationReleaseSha256,runnerIdentitySha256,sealedRunnerSha256' ||
      restored.captureSha256 !== context.captureSha256 ||
      restored.imageDigest !== context.imageDigest ||
      ![
        'registrationReleaseSha256',
        'runnerIdentitySha256',
        'sealedRunnerSha256',
      ].every((key) => /^[a-f0-9]{64}$/.test(restored[key])) ||
      typeof publishTerminal !== 'function'
    )
      fail();
  }
  const presence = await execute('classify-registration-recovery-container', {
    containerId: release.containerId,
  });
  if (presence?.present !== true && presence?.present !== false) fail();
  let cleanupSha256;
  const failed = await cleanupRegistration(execute, false, {
    containerId: release.containerId,
    captureRestored: restored !== undefined,
    containerRemoved: !presence.present,
    onCleanupReceipt: async (receipt) => {
      cleanupSha256 = canonicalSha256(receipt);
      if (restored)
        await publishTerminal({
          ...restored,
          cleanupSha256,
          schemaVersion: 1,
        });
    },
    started: presence.present,
  });
  if (failed || !cleanupSha256) fail();
  if (restored)
    return Object.freeze({
      registrationComplete: true,
      runnerIdentitySha256: restored.runnerIdentitySha256,
    });
  const command = await (
    dependencies.readActiveRegistrationCommand ?? readRegistrationCommand
  )();
  if (!Buffer.isBuffer(command)) fail();
  const recovery = Buffer.from(
    canonicalJson({
      campaignId: context.campaignId,
      cleanupSha256,
      commandSha256: createHash('sha256').update(command).digest('hex'),
      disposition: 'owner-row-deletion-required',
      egressReleaseSha256: release.egressReleaseSha256,
      schemaVersion: 1,
    })
  );
  await prepare('recover', {
    ...dependencies.prepareDependencies,
    readPostEgressRecovery: async () => recovery,
  });
  fail();
}

export async function resumeInstalledRegistration(
  configuration,
  execute,
  dependencies,
  prepare,
  publishTerminal,
  readTerminal
) {
  if (typeof readTerminal !== 'function') fail();
  let terminal;
  let terminalError;
  try {
    terminal = await readTerminal(dependencies.terminalReceiptDependencies);
  } catch (error) {
    terminalError = error;
  }
  if (terminal?.registrationComplete === true) {
    if (typeof prepare !== 'function') fail();
    await releaseRetainedTerminalLease(
      configuration,
      execute,
      dependencies,
      terminal
    );
    await prepare('finalize');
    return terminal;
  }
  if (
    terminalError &&
    (typeof prepare !== 'function' ||
      dependencies.readPostEgressRelease === undefined)
  )
    throw terminalError;
  if (terminalError) {
    const recovered = await recoverPostEgressRegistration(
      configuration,
      execute,
      dependencies,
      prepare,
      publishTerminal
    );
    if (recovered) {
      await prepare('finalize');
      return recovered;
    }
    throw terminalError;
  }
  if (terminal.registrationComplete !== false || typeof prepare !== 'function')
    fail();
  await prepare('begin');
  return undefined;
}
