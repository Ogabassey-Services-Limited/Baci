import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseRunnerPolicy } from './policy.schema.mjs';

const policy = JSON.parse(
  readFileSync(new URL('./policy.json', import.meta.url), 'utf8')
);

test('freezes a provenance-derived artifact cap above the pinned runner archive', () => {
  assert.doesNotThrow(() => parseRunnerPolicy(policy));
  assert.equal(policy.supplyChainProvenance.artifactMaxBytes, 268435456);
  assert.ok(
    policy.supplyChainProvenance.artifactMaxBytes >=
      policy.supplyChainProvenance.runner.assetSize
  );
  const drifted = structuredClone(policy);
  drifted.supplyChainProvenance.artifactMaxBytes = 268435457;
  assert.throws(() => parseRunnerPolicy(drifted), /invalid runner policy/);
});
