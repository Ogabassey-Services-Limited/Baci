import { isDeepStrictEqual } from 'node:util';

const CAMPAIGN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const CONTAINER = /^[a-f0-9]{64}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const PHASES = new Set([
  'pre-start',
  'node-started',
  'node-ready',
  'node-token-absent',
  'listener-configure',
  'post-container',
]);
const BOUNDARIES = new Set([
  'before-token-parent',
  'token-created',
  'before-policy-mount',
  'before-staging-mount',
  'before-token-mount',
  'before-release-mount',
  'registration-ready',
  'token-absent',
  'before-release-publication',
  'release-consumed',
  'before-exec-verification',
  'after-exec-verification',
  'before-seal',
]);

export const registrationRootOperationNames = Object.freeze([
  'verify-prepared-transaction',
  'mark-registration-ambiguous',
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
  'inspect-registration',
  'guard-registration',
  'create-token-layout',
  'write-registration-token',
  'create-staging-layout',
  'create-release-layout',
  'mount-policy',
  'mount-staging',
  'mount-token',
  'mount-release',
  'create-registration-container',
  'inspect-registration-config',
  'classify-registration-recovery-container',
  'start-registration-container',
  'wait-registration-ready',
  'unmount-token',
  'delete-token-layout',
  'prove-token-absence',
  'activate-registration-egress',
  'monotonic-milliseconds',
  'publish-release-once',
  'wait-release-read-once',
  'verify-release-file',
  'delete-release-file',
  'prove-release-absence',
  'unmount-release',
  'wait-registration-exit',
  'validate-registration-output',
  'seal-runner',
  'stop-registration-container',
  'remove-registration-container',
  'delete-release-layout',
  'unmount-staging',
  'delete-staging-layout',
  'remove-isolation',
  'remove-network',
  'stop-daemons',
  'restore-capture',
  'prove-registration-cleanup',
  'disarm-watchdog',
  'release-lock',
]);

const operationSet = new Set(registrationRootOperationNames);
const campaignOperations = new Set([
  'verify-prepared-transaction',
  'verify-retained-image',
  'start-daemons',
  'create-network',
  'install-isolation',
  'probe-isolation',
  'probe-cross-uid',
  'probe-public-tls',
  'remove-probe-allow',
]);
const optionalCampaignOperations = new Set([
  'set-egress-default-drop',
  'verify-default-drop',
]);
const containerOperations = new Set([
  'classify-registration-recovery-container',
  'inspect-registration-config',
  'start-registration-container',
  'stop-registration-container',
  'remove-registration-container',
]);
const emptyOperations = new Set(
  registrationRootOperationNames.filter(
    (name) =>
      !campaignOperations.has(name) &&
      !optionalCampaignOperations.has(name) &&
      !containerOperations.has(name) &&
      ![
        'mark-registration-ambiguous',
        'inspect-registration',
        'guard-registration',
        'publish-release-once',
        'verify-release-file',
        'prove-registration-cleanup',
      ].includes(name)
  )
);

const fail = () => {
  throw new TypeError('registration root operation refused');
};
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());

export function canonicalRegistrationJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalRegistrationJson).join(',')}]`;
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) fail();
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${canonicalRegistrationJson(value[key])}`
    )
    .join(',')}}`;
}

function validAuthority(value) {
  return (
    exact(value, [
      'cgroupNamespace',
      'containerId',
      'listenerPid',
      'mountNamespace',
      'parentIdentitySha256',
      'runtimeIdentity',
      'userNamespace',
    ]) &&
    CONTAINER.test(value.containerId) &&
    Number.isSafeInteger(value.listenerPid) &&
    value.listenerPid > 1 &&
    SHA256.test(value.parentIdentitySha256) &&
    typeof value.cgroupNamespace === 'string' &&
    typeof value.mountNamespace === 'string' &&
    typeof value.userNamespace === 'string' &&
    value.runtimeIdentity !== null &&
    typeof value.runtimeIdentity === 'object' &&
    !Array.isArray(value.runtimeIdentity)
  );
}

export function validateRegistrationRootContext(operation, context) {
  if (
    !operationSet.has(operation) ||
    !exact(context, Object.keys(context ?? {}))
  )
    fail();
  if (emptyOperations.has(operation)) {
    if (!exact(context, [])) fail();
  } else if (campaignOperations.has(operation)) {
    if (!exact(context, ['campaignId']) || !CAMPAIGN.test(context.campaignId))
      fail();
  } else if (optionalCampaignOperations.has(operation)) {
    if (
      !exact(context, []) &&
      (!exact(context, ['campaignId']) || !CAMPAIGN.test(context.campaignId))
    )
      fail();
  } else if (containerOperations.has(operation)) {
    if (
      !exact(context, ['containerId']) ||
      !CONTAINER.test(context.containerId)
    )
      fail();
  } else if (operation === 'inspect-registration') {
    if (!exact(context, ['phase']) || !PHASES.has(context.phase)) fail();
  } else if (operation === 'guard-registration') {
    if (
      (!exact(context, ['boundary']) &&
        !exact(context, ['authority', 'boundary'])) ||
      !BOUNDARIES.has(context.boundary) ||
      ('authority' in context && !validAuthority(context.authority))
    )
      fail();
  } else if (operation === 'mark-registration-ambiguous') {
    if (
      !exact(context, ['cleanupSha256', 'egressReleaseSha256']) ||
      !SHA256.test(context.cleanupSha256) ||
      !SHA256.test(context.egressReleaseSha256)
    )
      fail();
  } else if (operation === 'publish-release-once') {
    if (
      !exact(context, ['bytes', 'sha256']) ||
      typeof context.bytes !== 'string' ||
      !context.bytes.endsWith('\n') ||
      !SHA256.test(context.sha256)
    )
      fail();
  } else if (operation === 'verify-release-file') {
    if (!exact(context, ['sha256']) || !SHA256.test(context.sha256)) fail();
  } else if (operation === 'prove-registration-cleanup') {
    if (
      !exact(context, ['containerId']) ||
      (context.containerId !== null && !CONTAINER.test(context.containerId))
    )
      fail();
  } else fail();
  return context;
}

export function parseRegistrationRootRequest(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > 16_384)
    fail();
  const text = bytes.toString('utf8');
  if (!text.endsWith('\n') || text.slice(0, -1).includes('\n')) fail();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail();
  }
  if (
    !exact(value, ['context', 'operation', 'schemaVersion']) ||
    value.schemaVersion !== 1 ||
    `${canonicalRegistrationJson(value)}\n` !== text
  )
    fail();
  validateRegistrationRootContext(value.operation, value.context);
  return value;
}
