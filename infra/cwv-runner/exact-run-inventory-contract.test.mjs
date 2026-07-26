import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChallenge,
  validateInventoryReceipt,
} from './exact-run-contract.mjs';

const sha = (character) => character.repeat(64);
const bootId = '11111111-1111-4111-8111-111111111111';
const binding = {
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
};
const dedicated = {
  architecture: 'X64',
  busy: false,
  id: 99,
  labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'],
  name: 'baci-cwv-measurement-01',
  os: 'linux',
  status: 'offline',
};
const unrelated = {
  architecture: 'ARM64',
  busy: true,
  id: 100,
  labels: ['ARM64', 'Linux', 'deploy', 'self-hosted'],
  name: 'deploy-runner-01',
  os: 'linux',
  status: 'online',
};
const requiredRunner = {
  generation: 1,
  id: dedicated.id,
  name: dedicated.name,
};

function receipt(challenge, rows) {
  return {
    schemaVersion: 1,
    kind: 'runner-inventory',
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    challengeNonce: challenge.nonce,
    holdDigest: sha('e'),
    ownerAudit: { capturedAt: '2026-07-21T20:00:03Z' },
    pages: [{ next: null, number: 1, runners: rows, totalCount: rows.length }],
    policyFileSha256: binding.policyFileSha256,
    repository: binding.repository,
    run: binding.run,
  };
}

function validate(rows) {
  const challenge = createChallenge({
    binding,
    bootId,
    kind: 'inventory',
    nonce: sha('2'),
    nowMonotonicSeconds: 200,
    ttlSeconds: 5,
  });
  return validateInventoryReceipt({
    binding,
    bootId,
    challenge,
    document: receipt(challenge, rows),
    holdDigest: sha('e'),
    nowMonotonicSeconds: 201,
    requiredRunner,
    ttlSeconds: 5,
  });
}

test('allows a canonical unrelated runner beside the one dedicated runner', () => {
  assert.equal(validate([dedicated, unrelated]).runner.id, dedicated.id);
});

test('keeps the dedicated projection closed while validating unrelated rows generically', () => {
  assert.throws(
    () =>
      validate([
        { ...dedicated, labels: ['Linux', 'X64', 'baci-cwv-measurement'] },
      ]),
    /runner labels/
  );
  assert.throws(
    () =>
      validate([
        { ...unrelated, labels: ['ARM64', 'Linux', 'ARM64', 'self-hosted'] },
        dedicated,
      ]),
    /runner labels/
  );
  assert.throws(() => validate([unrelated]), /dedicated label/);
  assert.throws(
    () => validate([dedicated, { ...dedicated, id: 101 }]),
    /dedicated label/
  );
});
