import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import {
  parseCanonicalRegistrationRelease,
  registrationReleaseKeys,
} from './registration-release.mjs';

const policy = parseRunnerPolicy(
  JSON.parse(await readFile(new URL('./policy.json', import.meta.url), 'utf8'))
);

const d = 'a'.repeat(64);
const release = Object.fromEntries(
  registrationReleaseKeys.map((key) => [
    key,
    key.endsWith('Sha256') ? d : 'bound',
  ])
);
Object.assign(release, {
  createdMonotonicMilliseconds: 1_000,
  expiresMonotonicMilliseconds: 6_000,
  generation: 1,
  pid: 41,
  schemaVersion: 1,
});
const bytes = (value = release) => `${canonicalJson(value)}\n`;

test('accepts one canonical generation-one release bound to the Node identity', () => {
  const result = parseCanonicalRegistrationRelease(
    bytes(),
    {
      campaignId: 'bound',
      configureArgvSha256: d,
      nodeArgvSha256: d,
      nodeExecutableSha256: d,
      pid: 41,
      registrationNonce: 'bound',
    },
    2_000,
    policy
  );
  assert.match(result.digest, /^[0-9a-f]{64}$/);
  assert.equal(result.release.generation, 1);
});

test('uses one host-boot monotonic epoch and refuses future or expired releases', () => {
  assert.doesNotThrow(() =>
    parseCanonicalRegistrationRelease(bytes(), {}, 1_000, policy)
  );
  for (const patch of [
    {
      createdMonotonicMilliseconds: 1_001,
      expiresMonotonicMilliseconds: 6_001,
    },
    { createdMonotonicMilliseconds: 0, expiresMonotonicMilliseconds: 999 },
  ])
    assert.throws(
      () =>
        parseCanonicalRegistrationRelease(
          bytes({ ...release, ...patch }),
          {},
          1_000,
          policy
        ),
      /freshness/
    );
});

test('rejects noncanonical, stale, replay-generation, and drifted releases', () => {
  assert.throws(
    () =>
      parseCanonicalRegistrationRelease(
        ` ${JSON.stringify(release)}\n`,
        {},
        2_000,
        policy
      ),
    /canonical/
  );
  for (const patch of [
    { expiresMonotonicMilliseconds: 999 },
    { expiresMonotonicMilliseconds: 6_001 },
    { generation: 2 },
    { extra: true },
  ]) {
    const changed = { ...release, ...patch };
    assert.throws(
      () =>
        parseCanonicalRegistrationRelease(bytes(changed), {}, 2_000, policy),
      /release/
    );
  }
  assert.throws(
    () =>
      parseCanonicalRegistrationRelease(
        bytes(),
        { registrationNonce: 'wrong' },
        2_000,
        policy
      ),
    /binding/
  );
});

test('requires the sealed policy that owns the freshness window', () => {
  assert.throws(
    () => parseCanonicalRegistrationRelease(bytes(), {}, 2_000, {}),
    /invalid runner policy/
  );
});
