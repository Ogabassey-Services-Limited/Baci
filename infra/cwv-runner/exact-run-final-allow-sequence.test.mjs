import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createChallenge,
  createFinalAllow,
  validateAdmission,
  validateHookContext,
  validateInventoryReceipt,
  validateRelease,
} from './exact-run-contract.mjs';

const sha = (character) => character.repeat(64);
const bootId = '11111111-1111-4111-8111-111111111111';
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
const requiredRunner = Object.freeze({
  generation: 1,
  id: 99,
  name: 'baci-cwv-measurement-01',
});
const runner = Object.freeze({
  architecture: 'X64',
  busy: false,
  id: requiredRunner.id,
  labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'],
  name: requiredRunner.name,
  os: 'linux',
  status: 'offline',
});

function admission(challenge) {
  return {
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    challengeNonce: challenge.nonce,
    kind: 'admission',
    ownerAudit: { capturedAt: '2026-07-21T20:00:00Z' },
    policyFileSha256: binding.policyFileSha256,
    reconciliation: {
      activeRunCount: 1,
      digest: sha('d'),
      stateGeneration: 3,
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

test('builds the first executable allow only after sealed generation-one inventory', () => {
  const admissionChallenge = createChallenge({
    binding,
    bootId,
    kind: 'admission',
    nonce: sha('1'),
    nowMonotonicSeconds: 100,
    ttlSeconds: 30,
  });
  const validated = validateAdmission({
    binding,
    bootId,
    challenge: admissionChallenge,
    document: admission(admissionChallenge),
    nowMonotonicSeconds: 101,
  });
  assert.equal(validated.kind, 'admission-validated');
  assert.equal('runner' in validated, false);

  const inventoryChallenge = createChallenge({
    binding,
    bootId,
    kind: 'inventory',
    nonce: sha('2'),
    nowMonotonicSeconds: 102,
    ttlSeconds: 5,
  });
  const inventoryReceipt = validateInventoryReceipt({
    binding,
    bootId,
    challenge: inventoryChallenge,
    document: {
      admissionId: binding.admissionId,
      campaignId: binding.campaignId,
      challengeNonce: inventoryChallenge.nonce,
      holdDigest: sha('e'),
      kind: 'runner-inventory',
      ownerAudit: { capturedAt: '2026-07-21T20:00:03Z' },
      pages: [{ next: null, number: 1, runners: [runner], totalCount: 1 }],
      policyFileSha256: binding.policyFileSha256,
      repository: binding.repository,
      run: binding.run,
      schemaVersion: 1,
    },
    holdDigest: sha('e'),
    nowMonotonicSeconds: 103,
    requiredRunner,
    ttlSeconds: 5,
  });
  const allow = createFinalAllow({
    binding,
    inventoryReceipt,
    nowMonotonicSeconds: 104,
  });
  assert.deepEqual(allow.runner, requiredRunner);
  assert.equal(allow.expiresMonotonicSeconds, 108);
  assert.equal(allow.kind, 'allow');
});

test('rejects an allow construction from an unbound or future runner generation', () => {
  const receipt = {
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    expiresMonotonicSeconds: 108,
    holdDigest: sha('e'),
    policyFileSha256: binding.policyFileSha256,
    runner: requiredRunner,
    schemaVersion: 1,
  };
  assert.throws(
    () =>
      createFinalAllow({
        binding,
        inventoryReceipt: {
          ...receipt,
          runner: { ...requiredRunner, generation: 2 },
        },
        nowMonotonicSeconds: 104,
      }),
    /runner generation/
  );
  assert.throws(
    () =>
      createFinalAllow({
        binding,
        inventoryReceipt: { ...receipt, campaignId: 'other' },
        nowMonotonicSeconds: 104,
      }),
    /binding/
  );
});

function receiptWithExpiry(expiresMonotonicSeconds) {
  return {
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    expiresMonotonicSeconds,
    holdDigest: sha('e'),
    policyFileSha256: binding.policyFileSha256,
    runner: requiredRunner,
    schemaVersion: 1,
  };
}

const malformedExpiryValues = [
  1e100,
  108.5,
  -1,
  '108',
  Number.NaN,
  Number.POSITIVE_INFINITY,
];

test('createFinalAllow rejects malformed inventory receipt expiry', () => {
  for (const expiresMonotonicSeconds of malformedExpiryValues) {
    const inventoryReceipt = receiptWithExpiry(expiresMonotonicSeconds);
    assert.throws(
      () =>
        createFinalAllow({
          binding,
          inventoryReceipt,
          nowMonotonicSeconds: 104,
        }),
      /expiry.*integer/
    );
  }
});

test('validateRelease rejects malformed inventory receipt expiry', () => {
  for (const expiresMonotonicSeconds of malformedExpiryValues) {
    const inventoryReceipt = receiptWithExpiry(expiresMonotonicSeconds);
    assert.throws(
      () =>
        validateRelease({
          binding,
          classifierDigest: sha('3'),
          holdDigest: sha('e'),
          inventoryReceipt,
          liveSampleDigest: sha('4'),
          nowMonotonicSeconds: 104,
        }),
      /expiry.*integer/
    );
  }
});

test('the first job consumes the final nested allow, never the preliminary binding', () => {
  const allow = {
    ...binding,
    expiresMonotonicSeconds: 108,
    kind: 'allow',
    runner: requiredRunner,
    schemaVersion: 1,
  };
  const environment = {
    GITHUB_JOB: binding.workflow.job,
    GITHUB_REF: binding.workflow.ref,
    GITHUB_REPOSITORY: binding.repository.name,
    GITHUB_REPOSITORY_ID: String(binding.repository.id),
    GITHUB_RUN_ATTEMPT: String(binding.run.attempt),
    GITHUB_RUN_ID: String(binding.run.id),
    GITHUB_SHA: binding.expectedSha,
    GITHUB_WORKFLOW_REF: `${binding.repository.name}/${binding.workflow.path}@${binding.workflow.ref}`,
    GITHUB_WORKFLOW_SHA: binding.expectedSha,
  };
  assert.deepEqual(
    validateHookContext({
      allow,
      environment,
      event: { inputs: { admission_id: binding.admissionId } },
      nowMonotonicSeconds: 107,
    }),
    { ok: true }
  );
  assert.throws(
    () =>
      validateHookContext({
        allow: binding,
        environment,
        event: { inputs: { admission_id: binding.admissionId } },
        nowMonotonicSeconds: 107,
      }),
    /allow/
  );
});

test('controller installs no allow during admission and installs the final allow before release', async () => {
  const controller = await readFile(
    new URL('./exact-run-controller.sh', import.meta.url),
    'utf8'
  );
  const admit = controller.slice(
    controller.indexOf('\nadmit()'),
    controller.indexOf('\nrelease()')
  );
  const release = controller.slice(
    controller.indexOf('\nrelease()'),
    controller.indexOf('\ncomplete_run()')
  );
  assert.doesNotMatch(admit, /bind_artifact "\$directory" allow|ALLOW_ROOT/);
  assert.match(
    release,
    /validate-inventory[\s\S]*create-final-allow[\s\S]*bind_artifact "\$directory" allow[\s\S]*install_json "\$directory\/allow\.json"[\s\S]*create-normal-release/
  );
});
