import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  registrationContainerArgv,
  registrationLayout,
} from './registration-controller.mjs';
import {
  canonicalRegistrationJson,
  registrationRootOperationNames,
} from './registration-root-contract.mjs';
import { createRegistrationBackendClient } from './root-registration-backend-client.mjs';

const CONTAINER = /^[a-f0-9]{64}$/;
const SHA256 = /^[a-f0-9]{64}$/;
// biome-ignore format: closed phase inventory makes RPC routing auditable
const PHASES = new Set(['listener-configure', 'node-ready', 'node-started', 'node-token-absent', 'post-container', 'pre-start']);
// biome-ignore format: closed guard boundary inventory makes RPC routing auditable
const BOUNDARIES = new Set(['after-exec-verification', 'before-exec-verification', 'before-policy-mount', 'before-release-publication', 'before-release-mount', 'before-seal', 'before-staging-mount', 'before-token-mount', 'before-token-parent', 'registration-ready', 'release-consumed', 'token-absent', 'token-created']);
const fixedOperations = new Set([
  'wait-registration-ready',
  'unmount-token',
  'delete-token-layout',
  'prove-token-absence',
  'activate-registration-egress',
  'monotonic-milliseconds',
  'wait-release-read-once',
  'delete-release-file',
  'prove-release-absence',
  'unmount-release',
  'wait-registration-exit',
  'validate-registration-output',
  'seal-runner',
  'delete-release-layout',
  'unmount-staging',
  'delete-staging-layout',
  'remove-isolation',
  'remove-network',
  'stop-daemons',
  'restore-capture',
  'disarm-watchdog',
  'release-lock',
]);
const campaignOperations = new Set(
  'verify-prepared-transaction verify-retained-image start-daemons create-network install-isolation probe-isolation probe-cross-uid probe-public-tls remove-probe-allow'.split(
    ' '
  )
);
const optionalCampaignOperations = new Set([
  'set-egress-default-drop',
  'verify-default-drop',
]);
const operationSet = new Set(registrationRootOperationNames);
export const registrationOperationNames = registrationRootOperationNames;
const fail = () => {
  throw new TypeError('root operation refused');
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort(),
    [...keys].sort()
  );
function parseOutput(value) {
  if (typeof value !== 'string' || !value.endsWith('\n')) fail();
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail();
  }
  if (`${canonicalRegistrationJson(parsed)}\n` !== value) fail();
  return parsed;
}
function authority(value) {
  if (
    !exactKeys(value, [
      'cgroupNamespace',
      'containerId',
      'listenerPid',
      'mountNamespace',
      'parentIdentitySha256',
      'runtimeIdentity',
      'userNamespace',
    ]) ||
    !CONTAINER.test(value.containerId) ||
    !Number.isSafeInteger(value.listenerPid) ||
    value.listenerPid < 2 ||
    !SHA256.test(value.parentIdentitySha256) ||
    !/^cgroup:\[\d+\]$/.test(value.cgroupNamespace) ||
    !/^mnt:\[\d+\]$/.test(value.mountNamespace) ||
    !/^user:\[\d+\]$/.test(value.userNamespace) ||
    !value.runtimeIdentity ||
    typeof value.runtimeIdentity !== 'object'
  )
    fail();
  return value;
}
function operationContext(operation, payload, context, resources, layout) {
  if (campaignOperations.has(operation)) {
    if (payload !== undefined && !exactKeys(payload, ['campaignId'])) fail();
    return { campaignId: context.campaignId };
  }
  if (optionalCampaignOperations.has(operation)) {
    if (payload === undefined || exactKeys(payload, [])) return {};
    if (!exactKeys(payload, ['campaignId'])) fail();
    return { campaignId: context.campaignId };
  }
  if (operation === 'inspect-registration') {
    if (!exactKeys(payload, ['phase']) || !PHASES.has(payload.phase)) fail();
    return { phase: payload.phase };
  }
  if (operation === 'mark-registration-ambiguous') {
    if (
      !exactKeys(payload, ['cleanupSha256', 'egressReleaseSha256']) ||
      !SHA256.test(payload.cleanupSha256) ||
      !SHA256.test(payload.egressReleaseSha256)
    )
      fail();
    return payload;
  }
  if (operation === 'guard-registration') {
    if (
      (!exactKeys(payload, ['boundary']) &&
        !exactKeys(payload, ['authority', 'boundary'])) ||
      !BOUNDARIES.has(payload.boundary)
    )
      fail();
    return payload.authority === undefined
      ? { boundary: payload.boundary }
      : { authority: authority(payload.authority), boundary: payload.boundary };
  }
  if (operation === 'create-token-layout') {
    if (
      !exactKeys(payload, ['tokenParent']) ||
      !isDeepStrictEqual(payload.tokenParent, layout.tokenParent)
    )
      fail();
    return {};
  }
  if (operation === 'write-registration-token') {
    const bytes = payload?.bytes;
    if (
      !exactKeys(payload, ['bytes', 'token']) ||
      !isDeepStrictEqual(payload.token, layout.token) ||
      !Buffer.isBuffer(bytes) ||
      bytes.length < 21 ||
      bytes.length > 129 ||
      bytes.at(-1) !== 10 ||
      bytes
        .subarray(0, -1)
        .some(
          (byte) =>
            !(
              (byte >= 48 && byte <= 57) ||
              (byte >= 65 && byte <= 90) ||
              (byte >= 97 && byte <= 122)
            )
        )
    )
      fail();
    return {};
  }
  if (operation === 'create-staging-layout') {
    if (
      !exactKeys(payload, ['staging']) ||
      !isDeepStrictEqual(payload.staging, layout.staging)
    )
      fail();
    return {};
  }
  if (operation === 'create-release-layout') {
    if (
      !exactKeys(payload, ['handoff', 'releaseParent']) ||
      !isDeepStrictEqual(payload.handoff, layout.handoff) ||
      !isDeepStrictEqual(payload.releaseParent, layout.releaseParent)
    )
      fail();
    return {};
  }
  if (
    ['mount-policy', 'mount-staging', 'mount-token', 'mount-release'].includes(
      operation
    )
  ) {
    if (
      !exactKeys(payload, ['layout']) ||
      !isDeepStrictEqual(payload.layout, layout)
    )
      fail();
    return {};
  }
  if (operation === 'create-registration-container') {
    if (
      !exactKeys(payload, ['argv']) ||
      !isDeepStrictEqual(
        payload.argv,
        registrationContainerArgv(context, resources)
      )
    )
      fail();
    return {};
  }
  if (
    [
      'inspect-registration-config',
      'classify-registration-recovery-container',
      'start-registration-container',
      'stop-registration-container',
      'remove-registration-container',
    ].includes(operation)
  ) {
    if (
      !exactKeys(payload, ['containerId']) ||
      !CONTAINER.test(payload.containerId)
    )
      fail();
    return { containerId: payload.containerId };
  }
  if (operation === 'publish-release-once') {
    if (
      !exactKeys(payload, ['bytes', 'gid', 'mode', 'path', 'sha256', 'uid']) ||
      typeof payload.bytes !== 'string' ||
      payload.gid !== 10001 ||
      payload.mode !== 0o440 ||
      payload.path !== `${layout.handoff.path}/release.json` ||
      payload.uid !== 0 ||
      !SHA256.test(payload.sha256) ||
      digest(payload.bytes) !== payload.sha256
    )
      fail();
    return { bytes: payload.bytes, sha256: payload.sha256 };
  }
  if (operation === 'verify-release-file') {
    if (
      !exactKeys(payload, ['gid', 'mode', 'path', 'sha256', 'uid']) ||
      payload.gid !== 10001 ||
      payload.mode !== 0o440 ||
      payload.path !== `${layout.handoff.path}/release.json` ||
      payload.uid !== 0 ||
      !SHA256.test(payload.sha256)
    )
      fail();
    return { sha256: payload.sha256 };
  }
  if (operation === 'prove-registration-cleanup') {
    if (
      !exactKeys(payload, ['containerId']) ||
      !(payload.containerId === null || CONTAINER.test(payload.containerId))
    )
      fail();
    return { containerId: payload.containerId };
  }
  if (fixedOperations.has(operation) && exactKeys(payload ?? {}, [])) return {};
  fail();
}

export function rootOperationExecutor(context, resources, dependencies = {}) {
  const createBackend =
    dependencies.createBackend ??
    (dependencies.executeBackend
      ? () => ({
          close: () => undefined,
          execute: dependencies.executeBackend,
        })
      : createRegistrationBackendClient);
  if (typeof createBackend !== 'function') fail();
  const layout = registrationLayout(context);
  registrationContainerArgv(context, resources);
  const backend = createBackend();
  if (
    !backend ||
    typeof backend.execute !== 'function' ||
    typeof backend.close !== 'function'
  )
    fail();
  const execute = async (operation, payload) => {
    if (!operationSet.has(operation)) fail();
    const secret =
      operation === 'write-registration-token' ? payload?.bytes : undefined;
    const request = canonicalRegistrationJson({
      context: operationContext(operation, payload, context, resources, layout),
      operation,
      schemaVersion: 1,
    });
    try {
      return parseOutput(
        await backend.execute(request, secret ? { secret } : {})
      );
    } finally {
      secret?.fill(0);
    }
  };
  execute.close = () => backend.close();
  return execute;
}
