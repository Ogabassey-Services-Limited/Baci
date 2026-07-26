import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { canonicalSha256 } from './canonical-json.mjs';
import { buildReceipt } from './install-prepare-acceptance.fixture.mjs';
import { validateBuildProvenance } from './install-prepare-provenance.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
);

test('accepts the exact provenance receipt contract emitted by the build fixture', () => {
  assert.doesNotThrow(() =>
    validateBuildProvenance(buildReceipt.provenance, policy)
  );
});

test('rejects a canonical digest that does not bind the receipt object', () => {
  const provenance = structuredClone(buildReceipt.provenance);
  provenance.node.sha256 = '0'.repeat(64);

  assert.throws(
    () => validateBuildProvenance(provenance, policy),
    /invalid build provenance/
  );
});

test('rejects coercible base-tool roles and malformed nested Ubuntu digests', () => {
  const role = structuredClone(buildReceipt.provenance);
  role.baseTools.receipt.tools.find((row) =>
    row.role.startsWith('interpreter:')
  ).role = 7;
  role.baseTools.sha256 = canonicalSha256(role.baseTools.receipt);
  const ubuntu = structuredClone(buildReceipt.provenance);
  ubuntu.ubuntu.receipt.indexes[0].sha256 = 7;
  ubuntu.ubuntu.sha256 = canonicalSha256(ubuntu.ubuntu.receipt);

  for (const provenance of [role, ubuntu])
    assert.throws(
      () => validateBuildProvenance(provenance, policy),
      /invalid build provenance/
    );
});

test('binds Ubuntu snapshot, base-tool receipt, and keyring to trusted inputs', () => {
  const mutations = [
    (receipt) => {
      receipt.snapshotId = '20260101T000000Z';
    },
    (receipt) => {
      receipt.baseToolReceiptSha256 = '0'.repeat(64);
    },
    (receipt) => {
      receipt.keyringSha256 = '0'.repeat(64);
    },
  ];

  for (const mutate of mutations) {
    const provenance = structuredClone(buildReceipt.provenance);
    mutate(provenance.ubuntu.receipt);
    provenance.ubuntu.sha256 = canonicalSha256(provenance.ubuntu.receipt);

    assert.throws(
      () => validateBuildProvenance(provenance, policy),
      /invalid build provenance/
    );
  }
});
