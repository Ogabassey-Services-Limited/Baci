import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { requireRunnerPolicy } from './policy.schema.mjs';

const digest = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const text = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;

export const registrationReleaseKeys = Object.freeze([
  'activeEgressRuleSha256',
  'campaignId',
  'captureSha256',
  'cgroupNamespace',
  'configureArgvSha256',
  'containerId',
  'createdMonotonicMilliseconds',
  'expiresMonotonicMilliseconds',
  'generation',
  'imageDigest',
  'mountNamespace',
  'nodeArgvSha256',
  'nodeExecutableSha256',
  'pid',
  'policyFileSha256',
  'registrationNonce',
  'registrationReadySha256',
  'schemaVersion',
  'tokenAbsenceSha256',
  'tokenDeleteSha256',
  'tokenUnmountSha256',
  'userNamespace',
  'zeroCountersSha256',
]);

export function parseCanonicalRegistrationRelease(raw, context, now, value) {
  const policy = requireRunnerPolicy(value);
  if (typeof raw !== 'string') throw new TypeError('release bytes refused');
  let release;
  try {
    release = JSON.parse(raw);
  } catch {
    throw new TypeError('release JSON refused');
  }
  if (`${canonicalJson(release)}\n` !== raw)
    throw new TypeError('release must be canonical');
  if (
    canonicalJson(Object.keys(release).sort()) !==
    canonicalJson([...registrationReleaseKeys].sort())
  )
    throw new TypeError('release schema refused');
  if (release.schemaVersion !== 1 || release.generation !== 1)
    throw new TypeError('release generation refused');
  if (!Number.isSafeInteger(release.pid) || release.pid <= 0)
    throw new TypeError('release pid refused');
  if (
    !Number.isSafeInteger(release.createdMonotonicMilliseconds) ||
    !Number.isSafeInteger(release.expiresMonotonicMilliseconds) ||
    !Number.isSafeInteger(now) ||
    release.createdMonotonicMilliseconds > now ||
    release.expiresMonotonicMilliseconds < now ||
    release.expiresMonotonicMilliseconds -
      release.createdMonotonicMilliseconds >
      policy.repositoryAuthority.inventoryReceiptTtlSeconds * 1_000
  )
    throw new TypeError('release freshness refused');
  const digests = registrationReleaseKeys.filter((key) =>
    key.endsWith('Sha256')
  );
  if (!digests.every((key) => digest(release[key])))
    throw new TypeError('release digest refused');
  for (const key of [
    'campaignId',
    'cgroupNamespace',
    'containerId',
    'imageDigest',
    'mountNamespace',
    'registrationNonce',
    'userNamespace',
  ])
    if (!text(release[key])) throw new TypeError('release identity refused');
  for (const [key, expected] of Object.entries(context))
    if (release[key] !== expected)
      throw new TypeError(`release binding refused: ${key}`);
  return Object.freeze({
    digest: canonicalSha256(release),
    release: Object.freeze(release),
  });
}
