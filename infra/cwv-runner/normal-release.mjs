import { readFileSync } from 'node:fs';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

const keys = Object.freeze([
  'campaignId',
  'captureSha256',
  'classifierSha256',
  'containerId',
  'containerPrefix',
  'createdMonotonicSeconds',
  'egressIdentity',
  'expiresMonotonicSeconds',
  'liveSampleSha256',
  'peerIdentity',
  'policyFileSha256',
  'runnerIp',
  'vethIdentity',
]);
const digest = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const text = (value) => typeof value === 'string' && value.length > 0;
const interfaceName = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]{1,15}$/.test(value);
const ip = (value) =>
  typeof value === 'string' &&
  /^(?:0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])(?:\.(?:0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])){3}$/.test(
    value
  );
const identity = (value, prefix, name) => {
  const match = new RegExp(
    `^${prefix}:([A-Za-z0-9_.-]{1,15})(?::([1-9][0-9]*))?$`
  ).exec(value);
  if (
    !match ||
    !interfaceName(match[1]) ||
    !match[2] ||
    !Number.isSafeInteger(Number(match[2]))
  )
    throw new TypeError(`normal release ${name} refused`);
};

export function hostMonotonicMilliseconds() {
  const milliseconds = Math.trunc(
    Number.parseFloat(readFileSync('/proc/uptime', 'utf8').split(/\s+/, 1)[0]) *
      1_000
  );
  if (milliseconds < 0 || !Number.isSafeInteger(milliseconds))
    throw new TypeError('host monotonic clock refused');
  return milliseconds;
}

export function normalContainerIdentity(hostname, containerId) {
  if (
    typeof hostname !== 'string' ||
    !/^[0-9a-f]{12}\n$/.test(hostname) ||
    !digest(containerId) ||
    !containerId.startsWith(hostname.slice(0, -1))
  )
    throw new TypeError('normal container identity refused');
  return Object.freeze({
    containerId,
    containerPrefix: hostname.slice(0, -1),
  });
}

export function defaultNormalContainerIdentity() {
  const hostname = readFileSync('/etc/hostname', 'utf8');
  if (!/^[0-9a-f]{12}\n$/.test(hostname))
    throw new TypeError('normal container identity refused');
  return Object.freeze({ containerPrefix: hostname.slice(0, -1) });
}

export function parseCanonicalNormalRelease(
  raw,
  context,
  now,
  deadline,
  notBefore
) {
  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(deadline) ||
    (notBefore !== undefined && !Number.isSafeInteger(notBefore))
  )
    throw new TypeError('normal release freshness refused');
  let release;
  try {
    release = JSON.parse(raw);
  } catch {
    throw new TypeError('normal release JSON refused');
  }
  if (`${canonicalJson(release)}\n` !== raw)
    throw new TypeError('normal release canonical bytes refused');
  if (
    canonicalJson(Object.keys(release).sort()) !==
    canonicalJson([...keys].sort())
  )
    throw new TypeError('normal release schema refused');
  for (const key of [
    'captureSha256',
    'classifierSha256',
    'liveSampleSha256',
    'policyFileSha256',
  ])
    if (!digest(release[key]))
      throw new TypeError('normal release digest refused');
  for (const key of [
    'campaignId',
    'containerId',
    'containerPrefix',
    'egressIdentity',
    'peerIdentity',
    'runnerIp',
    'vethIdentity',
  ])
    if (!text(release[key]))
      throw new TypeError('normal release identity refused');
  if (!ip(release.runnerIp))
    throw new TypeError('normal release runner IP refused');
  identity(release.egressIdentity, 'external', 'egress identity');
  identity(release.peerIdentity, 'veth', 'peer identity');
  if (!interfaceName(release.vethIdentity))
    throw new TypeError('normal release veth identity refused');
  if (
    !digest(release.containerId) ||
    !/^[0-9a-f]{12}$/.test(release.containerPrefix) ||
    !release.containerId.startsWith(release.containerPrefix)
  )
    throw new TypeError('normal release container identity refused');
  if (
    !Number.isSafeInteger(release.createdMonotonicSeconds) ||
    !Number.isSafeInteger(release.expiresMonotonicSeconds) ||
    (notBefore !== undefined && release.createdMonotonicSeconds < notBefore) ||
    release.createdMonotonicSeconds > now ||
    release.expiresMonotonicSeconds < now ||
    release.expiresMonotonicSeconds > deadline
  )
    throw new TypeError('normal release freshness refused');
  for (const [key, expected] of Object.entries(context))
    if (release[key] !== expected)
      throw new TypeError(`normal release binding refused: ${key}`);
  return Object.freeze({
    digest: canonicalSha256(release),
    release: Object.freeze(release),
  });
}

export function createCanonicalNormalRelease(value) {
  const release = {
    campaignId: value.campaignId,
    captureSha256: value.captureSha256,
    classifierSha256: value.classifierSha256,
    containerId: value.containerId,
    containerPrefix: value.containerId?.slice(0, 12),
    createdMonotonicSeconds: value.createdMonotonicSeconds,
    egressIdentity: value.egressIdentity,
    expiresMonotonicSeconds: value.expiresMonotonicSeconds,
    liveSampleSha256: value.liveSampleSha256,
    peerIdentity: value.peerIdentity,
    policyFileSha256: value.policyFileSha256,
    runnerIp: value.runnerIp,
    vethIdentity: value.vethIdentity,
  };
  const raw = `${canonicalJson(release)}\n`;
  parseCanonicalNormalRelease(
    raw,
    {
      campaignId: release.campaignId,
      captureSha256: release.captureSha256,
      containerPrefix: release.containerPrefix,
      policyFileSha256: release.policyFileSha256,
    },
    release.createdMonotonicSeconds,
    release.expiresMonotonicSeconds,
    release.createdMonotonicSeconds
  );
  return raw;
}
