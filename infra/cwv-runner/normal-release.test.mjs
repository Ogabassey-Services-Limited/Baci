import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  createCanonicalNormalRelease,
  normalContainerIdentity,
  parseCanonicalNormalRelease,
} from './normal-release.mjs';

const release = {
  campaignId: 'campaign',
  captureSha256: 'a'.repeat(64),
  classifierSha256: 'b'.repeat(64),
  containerId: 'c'.repeat(64),
  containerPrefix: 'c'.repeat(12),
  createdMonotonicSeconds: 10,
  egressIdentity: 'external:eth0:2',
  expiresMonotonicSeconds: 20,
  liveSampleSha256: 'd'.repeat(64),
  peerIdentity: 'veth:veth0:3',
  policyFileSha256: 'e'.repeat(64),
  runnerIp: '192.0.2.2',
  vethIdentity: 'veth0',
};
const bytes = (value = release) => `${canonicalJson(value)}\n`;

test('accepts only a fresh canonical exact-identity normal release', () => {
  const result = parseCanonicalNormalRelease(
    bytes(),
    { campaignId: 'campaign', containerId: 'c'.repeat(64) },
    15,
    30
  );
  assert.match(result.digest, /^[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(result.release), true);
});

test('refuses noncanonical, expired, over-deadline, and drifted releases', () => {
  assert.throws(
    () =>
      parseCanonicalNormalRelease(` ${JSON.stringify(release)}\n`, {}, 15, 30),
    /canonical/
  );
  for (const changed of [
    { ...release, expiresMonotonicSeconds: 14 },
    { ...release, expiresMonotonicSeconds: 31 },
    { ...release, extra: true },
  ])
    assert.throws(
      () => parseCanonicalNormalRelease(bytes(changed), {}, 15, 30),
      /normal release/
    );
  assert.throws(
    () => parseCanonicalNormalRelease(bytes(), { campaignId: 'wrong' }, 15, 30),
    /binding/
  );
});

test('requires the release creation time to be within the root-provided hold window', () => {
  assert.throws(
    () => parseCanonicalNormalRelease(bytes(), {}, 15, 30, 11),
    /freshness/
  );
  for (const args of [
    [15.5, 30],
    [15, Number.POSITIVE_INFINITY],
    [15, 30, Number.MAX_SAFE_INTEGER + 1],
  ])
    assert.throws(
      () => parseCanonicalNormalRelease(bytes(), {}, ...args),
      /freshness/
    );
});

test('binds the release to the exact Docker hostname and a full container ID', () => {
  assert.deepEqual(
    normalContainerIdentity(`${'c'.repeat(12)}\n`, 'c'.repeat(64)),
    { containerId: 'c'.repeat(64), containerPrefix: 'c'.repeat(12) }
  );
  for (const [hostname, containerId] of [
    [`${'C'.repeat(12)}\n`, 'c'.repeat(64)],
    ['c'.repeat(12), 'c'.repeat(64)],
    [`${'c'.repeat(12)}\n`, 'd'.repeat(64)],
  ])
    assert.throws(
      () => normalContainerIdentity(hostname, containerId),
      /container identity/
    );
  assert.throws(
    () =>
      parseCanonicalNormalRelease(
        bytes({
          ...release,
          containerId: 'container',
          containerPrefix: 'container',
        }),
        { containerId: 'container', containerPrefix: 'container' },
        15,
        30
      ),
    /container/
  );
});

test('builds the one canonical 13-key normal release from verified host facts', () => {
  const raw = createCanonicalNormalRelease(release);
  assert.equal(raw, bytes());
  for (const changed of [
    { ...release, classifierSha256: 'invalid' },
    { ...release, liveSampleSha256: 'invalid' },
    { ...release, runnerIp: 'not-an-ip' },
    { ...release, runnerIp: '192.168.001.1' },
    { ...release, vethIdentity: 'too:many:parts' },
    { ...release, peerIdentity: 'veth:veth0' },
    { ...release, egressIdentity: 'external:eth0' },
    { ...release, egressIdentity: 'external:eth0:9007199254740992' },
  ])
    assert.throws(
      () => createCanonicalNormalRelease(changed),
      /normal release/
    );
});
