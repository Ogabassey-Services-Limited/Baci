import assert from 'node:assert/strict';
import test from 'node:test';

import { createChallenge, validateAdmission } from './exact-run-contract.mjs';

const sha = (character) => character.repeat(64);
const BOOT_A = '11111111-1111-4111-8111-111111111111';
const BOOT_B = '22222222-2222-4222-8222-222222222222';
const binding = Object.freeze({
  admissionId: sha('a'),
  campaignId: 'campaign-001',
  expectedSha: 'b'.repeat(40),
  policyFileSha256: sha('c'),
  repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
  run: { attempt: 1, id: 42 },
  workflow: {
    id: 7,
    job: 'attest',
    path: '.github/workflows/cwv-runner-attestation.yml',
    ref: 'refs/heads/main',
  },
});

function challenge() {
  return createChallenge({
    binding,
    bootId: BOOT_A,
    kind: 'admission',
    nonce: sha('1'),
    nowMonotonicSeconds: 100,
    ttlSeconds: 30,
  });
}

function admission(value) {
  return {
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    challengeNonce: value.nonce,
    kind: 'admission',
    ownerAudit: { capturedAt: '2026-07-21T20:00:00Z' },
    policyFileSha256: binding.policyFileSha256,
    reconciliation: {
      activeRunCount: 1,
      digest: sha('d'),
      stateGeneration: 1,
    },
    repository: binding.repository,
    run: {
      actor: 'ogabasseyy',
      admissionId: binding.admissionId,
      attempt: binding.run.attempt,
      displayTitle: `CWV Runner Attestation ${binding.admissionId}`,
      event: 'workflow_dispatch',
      id: binding.run.id,
      status: 'queued',
    },
    schemaVersion: 1,
    workflow: { headSha: binding.expectedSha, ...binding.workflow },
  };
}

function validate(value, nowMonotonicSeconds, bootId = BOOT_A) {
  return validateAdmission({
    binding,
    bootId,
    challenge: value,
    document: admission(value),
    nowMonotonicSeconds,
  });
}

test('refuses a challenge observed before its monotonic creation time', () => {
  assert.throws(() => validate(challenge(), 99), /challenge not yet valid/);
});

test('bugfix: refuses a prior-boot challenge inside its old monotonic interval', () => {
  assert.throws(
    () => validate(challenge(), 101, BOOT_B),
    /challenge boot epoch binding mismatch/
  );
});

test('fails closed for noncanonical boot IDs', () => {
  assert.throws(
    () =>
      createChallenge({
        binding,
        bootId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
        kind: 'admission',
        nonce: sha('1'),
        nowMonotonicSeconds: 100,
        ttlSeconds: 30,
      }),
    /challenge boot id is invalid/
  );
  assert.throws(
    () => validate(challenge(), 101, 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),
    /challenge boot id is invalid/
  );
});

test('requires safe integer challenge and validation clocks', () => {
  const value = challenge();
  for (const [candidate, now] of [
    [{ ...value, createdMonotonicSeconds: 100.5 }, 101],
    [{ ...value, deadlineMonotonicSeconds: '130' }, 101],
    [value, Number.NaN],
  ])
    assert.throws(
      () => validate(candidate, now),
      /challenge (?:created |deadline )?time must be an integer/
    );
});

test('requires the exact monotonic TTL for the challenge kind', () => {
  const value = challenge();
  assert.throws(
    () => validate({ ...value, deadlineMonotonicSeconds: 131 }, 101),
    /challenge ttl binding mismatch/
  );
});
