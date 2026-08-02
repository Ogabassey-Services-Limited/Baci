import { isDeepStrictEqual } from 'node:util';

const cleanupOperations = Object.freeze([
  'set-egress-default-drop',
  'unmount-token',
  'delete-token-layout',
  'stop-registration-container',
  'remove-registration-container',
  'unmount-release',
  'delete-release-layout',
  'unmount-staging',
  'delete-staging-layout',
  'remove-isolation',
  'remove-network',
  'stop-daemons',
  'restore-capture',
]);

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());

export function validateRegistrationRemovalReceipt(receipt, containerId) {
  if (
    !exactKeys(receipt, ['containerId', 'removed', 'schemaVersion']) ||
    receipt.containerId !== containerId ||
    receipt.removed !== true ||
    receipt.schemaVersion !== 1
  )
    throw new TypeError('registration removal refused');
}

function validateAbsenceReceipt(receipt, containerId) {
  if (
    !exactKeys(receipt, [
      'bridgeAbsent',
      'captureRestored',
      'cgroupAbsent',
      'containerId',
      'containerdInactive',
      'containers',
      'dockerInactive',
      'dockerSocketAbsent',
      'firewallAbsent',
      'networkAbsent',
      'processAbsent',
      'releaseArtifacts',
      'schemaVersion',
      'stagingArtifacts',
      'tokenArtifacts',
    ]) ||
    receipt.containerId !== (containerId ?? null) ||
    receipt.schemaVersion !== 2 ||
    !isDeepStrictEqual(receipt.containers, []) ||
    !isDeepStrictEqual(receipt.releaseArtifacts, []) ||
    !isDeepStrictEqual(receipt.stagingArtifacts, []) ||
    !isDeepStrictEqual(receipt.tokenArtifacts, [])
  )
    throw new TypeError('registration cleanup refused');
  for (const key of [
    'bridgeAbsent',
    'captureRestored',
    'cgroupAbsent',
    'containerdInactive',
    'dockerInactive',
    'dockerSocketAbsent',
    'firewallAbsent',
    'networkAbsent',
    'processAbsent',
  ])
    if (receipt[key] !== true)
      throw new TypeError('registration cleanup refused');
}

function validateCriticalReceipt(operation, receipt) {
  const exact = (keys) => exactKeys(receipt, keys);
  if (
    ['remove-isolation', 'remove-network'].includes(operation) &&
    (!exact(['schemaVersion', 'status']) ||
      receipt.schemaVersion !== 1 ||
      !['absent', 'removed'].includes(receipt.status))
  )
    throw new TypeError('registration cleanup refused');
  if (
    operation === 'stop-daemons' &&
    (!exact(['containerd', 'docker', 'schemaVersion']) ||
      receipt.schemaVersion !== 1 ||
      !['absent', 'stopped'].includes(receipt.containerd) ||
      !['absent', 'stopped'].includes(receipt.docker))
  )
    throw new TypeError('registration cleanup refused');
  if (
    operation === 'restore-capture' &&
    (!exact(['capture', 'schemaVersion']) ||
      receipt.schemaVersion !== 1 ||
      !['absent', 'restored'].includes(receipt.capture))
  )
    throw new TypeError('registration cleanup refused');
}

export async function cleanupRegistration(
  execute,
  requireRetention = false,
  lifecycle = {}
) {
  let failed = false;
  let critical = requireRetention;
  let unsafeContainer = false;
  for (const operation of cleanupOperations) {
    if (unsafeContainer) break;
    if (
      operation === 'stop-registration-container' &&
      (!lifecycle.started || lifecycle.containerRemoved)
    )
      continue;
    if (
      operation === 'remove-registration-container' &&
      (!lifecycle.containerId || lifecycle.containerRemoved)
    )
      continue;
    try {
      const containerOperation = [
        'remove-registration-container',
        'stop-registration-container',
      ].includes(operation);
      const receipt = await execute(
        operation,
        containerOperation ? { containerId: lifecycle.containerId } : undefined
      );
      if (operation === 'remove-registration-container')
        validateRegistrationRemovalReceipt(receipt, lifecycle.containerId);
      validateCriticalReceipt(operation, receipt);
    } catch {
      failed = true;
      critical ||= [
        'set-egress-default-drop',
        'stop-registration-container',
        'remove-registration-container',
        'remove-isolation',
        'remove-network',
        'stop-daemons',
        'restore-capture',
      ].includes(operation);
      unsafeContainer = [
        'stop-registration-container',
        'remove-registration-container',
      ].includes(operation);
    }
  }
  if (!critical) {
    try {
      const receipt = await execute('prove-registration-cleanup', {
        containerId: lifecycle.containerId ?? null,
      });
      validateAbsenceReceipt(receipt, lifecycle.containerId);
      await execute('disarm-watchdog');
      await lifecycle.onCleanupReceipt?.(receipt);
      await execute('release-lock');
    } catch {
      failed = true;
    }
  }
  return failed;
}
