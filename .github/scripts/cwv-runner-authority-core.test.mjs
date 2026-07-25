import assert from 'node:assert/strict';
import test from 'node:test';

import { DIGEST_KEYS, FAILURE_KEYS, RESOURCE_KEYS, canonicalJson, projectPublicAttestation, verifyPublicArtifact, verifyRunnerAuthority } from './cwv-runner-authority-core.mjs';

const sha = 'a'.repeat(64);
function privateInput() {
  const input = {
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    workflow: { runId: 12, attempt: 1, publicRunUrl: 'https://github.com/ogabasseyy/Baci/actions/runs/12', headSha: 'b'.repeat(40), ref: 'refs/heads/main', job: 'attest' },
    runner: { id: 7, name: 'baci-cwv-measurement-01', generation: 1 },
    resources: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 1])),
    retention: { repositoryDays: 90, maximumAllowedDays: 90, workflowDays: 90, artifactLifetimeSeconds: 90 * 86400 },
    digests: Object.fromEntries(DIGEST_KEYS.map((key) => [key, sha])), failureMatrix: Object.fromEntries(FAILURE_KEYS.map((key) => [key, true])),
  };
  return input;
}
function member(value) { return { bytes: Buffer.from(value), mode: 0o644, name: 'h0-runner-attestation.json', type: 'file' }; }

test('requires the exact canonical public run URL and integer retention ceiling', () => {
  const input = privateInput();
  assert.throws(() => projectPublicAttestation({ ...input, workflow: { ...input.workflow, publicRunUrl: 'https://github.com/ogabasseyy/Baci/actions/runs/12?attempt=1' } }), /public value/);
  assert.throws(() => projectPublicAttestation({ ...input, retention: { ...input.retention, maximumAllowedDays: 90.5 } }), /retention/);
  const projected = projectPublicAttestation(input);
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson({ ...projected, workflow: { ...projected.workflow, publicRunUrl: 'https://github.com/ogabasseyy/Baci/actions/runs/12?attempt=1' } }))] }), /public value/);
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson({ ...projected, retention: { ...projected.retention, maximumAllowedDays: 90.5 } }))] }), /retention/);
  assert.equal(verifyRunnerAuthority({ artifactLifetimeSeconds: 90 * 86400, policy: { artifactRetentionDays: 90 }, repositoryRetention: { days: 90, maximum_allowed_days: 90.5 }, workflowRetentionDays: 90 }).some(({ code }) => code === 'RETENTION'), true);
});

test('rejects secret content, a noncanonical newline, and a retention timestamp independently', () => {
  const projected = projectPublicAttestation(privateInput());
  assert.throws(() => verifyPublicArtifact({ members: [member(`${canonicalJson(projected)}\n`)] }), /noncanonical/);
  const secret = { ...projected, repository: { ...projected.repository, name: 'secret' }, workflow: { ...projected.workflow, publicRunUrl: 'https://github.com/secret/actions/runs/12' } };
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson(secret))] }), /secret-shaped/);
  const timestamp = { ...projected, retention: { ...projected.retention, observedAt: '2026-07-22T00:00:00.000Z' } };
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson(timestamp))] }), /retention has forbidden/);
});

test('requires the exact public runner and rejects credential-shaped values', () => {
  const projected = projectPublicAttestation(privateInput());
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson({ ...projected, runner: { ...projected.runner, name: 'other-runner' } }))] }), /public value/);
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson({ ...projected, runner: { ...projected.runner, name: 'api-key' } }))] }), /(public value|secret-shaped)/);
});

test('projects exactly the approved sixteen public digests and refuses public identity expansion', () => {
  const input = privateInput();
  input.digests.runnerIdentitySha256 = sha;
  const projected = projectPublicAttestation(input);
  assert.equal(DIGEST_KEYS.length, 16);
  assert.equal(DIGEST_KEYS.includes('runnerIdentitySha256'), false);
  assert.equal('runnerIdentitySha256' in projected.digests, false);
  for (const digests of [
    Object.fromEntries(Object.entries(projected.digests).filter(([key]) => key !== 'restoreSha256')),
    { ...projected.digests, runnerIdentitySha256: sha },
    { ...projected.digests, runnerIdentitySha256: `sha256:${sha}` },
    { ...projected.digests, unexpectedSha256: sha },
  ])
    assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson({ ...projected, digests }))] }), /digest|forbidden|missing/);
});

test('rejects delimiter-colliding public object keys', () => {
  const projected = projectPublicAttestation(privateInput());
  const collision = { ...projected, 'digests,failureMatrix': {}, digests: undefined, failureMatrix: undefined };
  delete collision.digests;
  delete collision.failureMatrix;
  assert.throws(() => verifyPublicArtifact({ members: [member(canonicalJson(collision))] }), /attestation has forbidden/);
});
