import { createHash } from 'node:crypto';
import { canonicalSha256 } from './canonical-json.mjs';
import {
  cleanupRegistration,
  validateRegistrationRemovalReceipt,
} from './registration-controller-cleanup.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const preflightOperations = Object.freeze([
  'verify-prepared-transaction',
  'verify-retained-image',
  'start-daemons',
  'create-network',
  'install-isolation',
  'probe-isolation',
  'probe-cross-uid',
  'probe-public-tls',
  'remove-probe-allow',
  'set-egress-default-drop',
  'verify-default-drop',
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function digestField(value, key) {
  if (!SHA256.test(value?.[key]))
    throw new TypeError('registration evidence refused');
  return value[key];
}

async function inspect(execute, validate, phase, authority) {
  const snapshot = await execute('inspect-registration', { phase });
  validate(snapshot, phase, authority);
  return snapshot;
}

async function guard(execute, boundary, authority) {
  await execute('guard-registration', { authority, boundary });
}

function releaseRecord(context, authority, evidence, created) {
  const value = {
    activeEgressRuleSha256: evidence.activeEgressRuleSha256,
    campaignId: context.campaignId,
    captureSha256: context.captureSha256,
    cgroupNamespace: authority.cgroupNamespace,
    configureArgvSha256: context.configureArgvSha256,
    containerId: authority.containerId,
    createdMonotonicMilliseconds: created,
    expiresMonotonicMilliseconds: created + 5_000,
    generation: 1,
    imageDigest: context.imageDigest,
    mountNamespace: authority.mountNamespace,
    nodeArgvSha256: context.nodeArgvSha256,
    nodeExecutableSha256: context.nodeExecutableSha256,
    pid: authority.listenerPid,
    policyFileSha256: context.policyFileSha256,
    processParentSha256: authority.parentIdentitySha256,
    registrationNonce: context.registrationNonce,
    registrationReadySha256: evidence.registrationReadySha256,
    schemaVersion: 1,
    tokenAbsenceSha256: evidence.tokenAbsenceSha256,
    tokenDeleteSha256: evidence.tokenDeleteSha256,
    tokenUnmountSha256: evidence.tokenUnmountSha256,
    userNamespace: authority.userNamespace,
    zeroCountersSha256: evidence.zeroCountersSha256,
  };
  return `${JSON.stringify(value)}\n`;
}

export async function runRegistrationFlow(context, dependencies, contract) {
  const { execute, readToken } = dependencies ?? {};
  if (typeof execute !== 'function' || typeof readToken !== 'function')
    throw new TypeError('registration executor refused');
  const validate = (snapshot, phase, authority) =>
    contract.validate(snapshot, phase, authority);
  let terminalFailure = false;
  let cleanupFailure = false;
  let defaultDropFailure = false;
  let egressReleased = false;
  let egressReleaseSha256;
  let cleanupSha256;
  let authority;
  const lifecycle = {
    containerId: undefined,
    containerRemoved: false,
    started: false,
    onCleanupReceipt: async (value) => {
      cleanupSha256 = canonicalSha256(value);
      if (terminalFailure && egressReleased) {
        await execute('mark-registration-ambiguous', {
          cleanupSha256,
          egressReleaseSha256,
        });
        return;
      }
      if (
        !terminalFailure &&
        receipt &&
        typeof dependencies?.publishTerminal === 'function'
      )
        await dependencies.publishTerminal(
          Object.freeze({ ...receipt, cleanupSha256 })
        );
    },
  };
  let token = Buffer.alloc(0);
  let receipt;
  try {
    for (const operation of preflightOperations) {
      try {
        await execute(operation, { campaignId: context.campaignId });
      } catch (error) {
        defaultDropFailure ||= operation === 'set-egress-default-drop';
        throw error;
      }
    }
    await inspect(execute, validate, 'pre-start');
    await guard(execute, 'before-token-parent');
    await execute('create-token-layout', {
      tokenParent: contract.layout.tokenParent,
    });
    token = await contract.readToken(readToken);
    await execute('write-registration-token', {
      bytes: token,
      token: contract.layout.token,
    });
    token.fill(0);
    await guard(execute, 'token-created');
    await execute('create-staging-layout', {
      staging: contract.layout.staging,
    });
    await execute('create-release-layout', {
      handoff: contract.layout.handoff,
      releaseParent: contract.layout.releaseParent,
    });
    for (const [operation, boundary] of [
      ['mount-policy', 'before-policy-mount'],
      ['mount-staging', 'before-staging-mount'],
      ['mount-token', 'before-token-mount'],
      ['mount-release', 'before-release-mount'],
    ]) {
      await guard(execute, boundary);
      await execute(operation, { layout: contract.layout });
    }
    const created = await execute('create-registration-container', {
      argv: contract.argv,
    });
    const containerId = contract.validateCreated(created);
    lifecycle.containerId = containerId;
    const config = await execute('inspect-registration-config', {
      containerId,
    });
    contract.validateCreatedConfig(config, containerId);
    await execute('start-registration-container', { containerId });
    lifecycle.started = true;
    const started = await execute('inspect-registration', {
      phase: 'node-started',
    });
    authority = contract.observe(started, containerId);
    validate(started, 'node-started', authority);
    await guard(execute, 'registration-ready', authority);
    const ready = await execute('wait-registration-ready');
    await guard(execute, 'registration-ready', authority);
    await inspect(execute, validate, 'node-ready', authority);
    const tokenUnmount = await execute('unmount-token');
    const tokenDelete = await execute('delete-token-layout');
    await inspect(execute, validate, 'node-token-absent', authority);
    const absent = await execute('prove-token-absence');
    await guard(execute, 'token-absent', authority);
    const zero = await execute('verify-default-drop');
    const active = await execute('activate-registration-egress');
    egressReleased = true;
    egressReleaseSha256 = digestField(active, 'egressReleaseSha256');
    const clock = await execute('monotonic-milliseconds');
    if (!Number.isSafeInteger(clock?.value) || clock.value < 0)
      throw new TypeError('registration clock refused');
    const releaseBytes = releaseRecord(
      context,
      authority,
      {
        activeEgressRuleSha256: digestField(active, 'activeEgressRuleSha256'),
        registrationReadySha256: digestField(ready, 'registrationReadySha256'),
        tokenAbsenceSha256: digestField(absent, 'tokenAbsenceSha256'),
        tokenDeleteSha256: digestField(tokenDelete, 'tokenDeleteSha256'),
        tokenUnmountSha256: digestField(tokenUnmount, 'tokenUnmountSha256'),
        zeroCountersSha256: digestField(zero, 'zeroCountersSha256'),
      },
      clock.value
    );
    const releaseSha256 = sha256(releaseBytes);
    await guard(execute, 'before-release-publication', authority);
    await execute('publish-release-once', {
      bytes: releaseBytes,
      gid: 10001,
      mode: 0o440,
      path: `${contract.layout.handoff.path}/release.json`,
      sha256: releaseSha256,
      uid: 0,
    });
    const consumed = await execute('wait-release-read-once');
    if (consumed?.reads !== 1 || consumed.sha256 !== releaseSha256)
      throw new TypeError('registration release consumption refused');
    await guard(execute, 'release-consumed', authority);
    await guard(execute, 'before-exec-verification', authority);
    await execute('verify-release-file', {
      gid: 10001,
      mode: 0o440,
      path: `${contract.layout.handoff.path}/release.json`,
      sha256: releaseSha256,
      uid: 0,
    });
    await inspect(execute, validate, 'listener-configure', authority);
    await guard(execute, 'after-exec-verification', authority);
    await execute('delete-release-file');
    await execute('prove-release-absence');
    await execute('unmount-release');
    await execute('wait-registration-exit');
    try {
      await execute('set-egress-default-drop');
    } catch (error) {
      defaultDropFailure = true;
      throw error;
    }
    const removal = await execute('remove-registration-container', {
      containerId: lifecycle.containerId,
    });
    validateRegistrationRemovalReceipt(removal, lifecycle.containerId);
    lifecycle.containerRemoved = true;
    await inspect(execute, validate, 'post-container', authority);
    await guard(execute, 'before-seal', authority);
    await execute('validate-registration-output');
    const sealed = await execute('seal-runner');
    receipt = Object.freeze({
      captureSha256: context.captureSha256,
      imageDigest: context.imageDigest,
      registrationReleaseSha256: releaseSha256,
      runnerIdentitySha256: digestField(sealed, 'runnerIdentitySha256'),
      schemaVersion: 1,
      sealedRunnerSha256: digestField(sealed, 'sealedRunnerSha256'),
    });
  } catch {
    terminalFailure = true;
  } finally {
    token.fill(0);
    try {
      cleanupFailure = await cleanupRegistration(
        execute,
        defaultDropFailure,
        lifecycle
      );
    } finally {
      await execute.close?.();
    }
  }
  if (cleanupFailure) throw new Error('registration cleanup failed');
  if (terminalFailure) throw new Error('registration transaction failed');
  if (!cleanupSha256) throw new Error('registration cleanup failed');
  return Object.freeze({ ...receipt, cleanupSha256 });
}
