import { createHash } from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/;
const captureFields = Object.freeze([
  'expectedEgressPlan',
  'externalIfindex',
  'externalInterface',
  'hostIpv4Addresses',
  'nonrootServiceUids',
  'productionDockerSubnets',
]);

export function validateRegistrationCapture({ bytes, canonical, fail, parse }) {
  const value = parse(bytes, 'capture');
  const missing = captureFields.filter((key) => !Object.hasOwn(value, key));
  if (missing.length)
    fail(`capture missing required authority: ${missing.join(', ')}`);
  if (canonical(value) !== bytes.toString('utf8')) fail('capture canonical');
  return value;
}

export function validateRegistrationCaptureDigest({
  bytes,
  captureBytes,
  fail,
}) {
  const digest = createHash('sha256').update(captureBytes).digest('hex');
  if (
    !Buffer.isBuffer(bytes) ||
    !/^[a-f0-9]{64}\n$/.test(bytes.toString('utf8')) ||
    bytes.toString('utf8').slice(0, -1) !== digest
  )
    fail('capture digest');
}

export function validateRegistrationCaptureReceipt({
  bytes,
  campaignId,
  canonical,
  captureSha256,
  fail,
  name,
}) {
  const value = canonical(bytes, name);
  if (
    value.transactionId !== campaignId ||
    value.mode !== 'registration' ||
    value.captureSha256 !== captureSha256 ||
    value.lockHeld !== true
  )
    fail(`${name} captureSha256 mismatch`);
}

export function readRegistrationRetryBlockReceipt({
  bytes,
  campaignId,
  canonical,
  commandSha256,
  fail,
  isObject,
}) {
  const value = canonical(bytes, 'post-egress recovery');
  if (
    !isObject(value) ||
    Object.keys(value).sort().join(',') !==
      'campaignId,cleanupSha256,commandSha256,disposition,egressReleaseSha256,schemaVersion' ||
    value.schemaVersion !== 1 ||
    value.campaignId !== campaignId ||
    value.commandSha256 !== commandSha256 ||
    !SHA256.test(value.cleanupSha256) ||
    !SHA256.test(value.egressReleaseSha256) ||
    value.disposition !== 'owner-row-deletion-required'
  )
    fail('post-egress recovery binding');
  return Object.freeze(value);
}
