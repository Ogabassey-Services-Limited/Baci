// biome-ignore-all format: focused test remains below the repository file limit
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { ARTIFACT_MEMBER, validateArtifactReadback } from './owner-api-transport.mjs';
import { canonical } from './owner-api-transport-primitives.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const policy = { allowedQueryKeys: ['sig'], hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$', maxBytes: 1024 * 1024, pathPrefix: '/actions-results/', timeoutsMs: { bodyInactivity: 10000, connect: 10000, headers: 10000, overall: 30000 } };
const publicBaseBytes = Buffer.from('{"digests":{"admissionSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","appPermissionsSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","holdSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","hostAttestationSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","imageSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","liveSampleSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","ollamaRetirementSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","policyCanonicalSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","policyFileSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","processMapSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","restoreSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","rulesetSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","runnerInventorySha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","scriptsSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","serviceSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourceManifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"failureMatrix":{"appPermissions":true,"artifactReadback":true,"concurrentJob":true,"cpuSet":true,"doubleRestore":true,"egressDnsLocaleTimezone":true,"hostedRunner":true,"labelUniqueness":true,"lease":true,"networkIsolation":true,"offlineRunner":true,"reboot":true,"retention":true,"retirementIdentity":true,"rollback":true,"ruleset":true,"serviceRestart":true,"softwareIdentity":true,"supplyChain":true,"thresholds":true},"noMeasurement":true,"repository":{"id":1100488586,"name":"ogabasseyy/Baci"},"resources":{"hostMemAvailableBytesAfter":0,"hostMemAvailableBytesBefore":0,"modelStoreAllocatedBytesBefore":0,"ollamaCgroupMemoryCurrentBytesAfter":0,"ollamaCgroupMemoryCurrentBytesBefore":0,"recoveredDiskBytes":0,"rootFreeBytesAfter":0,"rootFreeBytesBefore":0},"retention":{"artifactLifetimeSeconds":7776000,"maximumAllowedDays":90,"repositoryDays":90,"workflowDays":90},"runner":{"generation":0,"id":1,"name":"baci-cwv-measurement-01"},"schemaVersion":1,"workflow":{"attempt":1,"headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","job":"attest","publicRunUrl":"https://github.com/ogabasseyy/Baci/actions/runs/9","ref":"refs/heads/main","runId":9}}');
const publicValue = JSON.parse(publicBaseBytes);
const publicBytes = Buffer.from(canonical(publicValue));
const member = (bytes) => [{ name: ARTIFACT_MEMBER, type: 'file', mode: 0o644, bytes }];
const mutatedPublic = (mutate) => { const value = JSON.parse(publicBytes); mutate(value); return Buffer.from(canonical(value)); };

test('distinguishes ZIP metadata bytes from the sole canonical public projected member', () => {
  const archiveBytes = Buffer.from('zip bytes are not JSON bytes');
  const artifact = { id: 5, name: 'h0-runner-attestation-9-1', digest: `sha256:${sha(archiveBytes)}`, expiresAt: 'x' };
  assert.equal(validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes, members: member(publicBytes), policy }).public.workflow.runId, 9);
  assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes: publicBytes, members: member(publicBytes), policy }), /digest/);
  const incomplete = Buffer.from(publicBytes.toString().replace('"rootFreeBytesAfter":0,', ''));
  const incompleteArchive = Buffer.from('different zip');
  assert.throws(() => validateArtifactReadback({ artifact: { ...artifact, digest: `sha256:${sha(incompleteArchive)}` }, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes: incompleteArchive, members: member(incomplete), policy }), /public artifact/);
});

test('requires the workflow retention contract, true safety predicates, and a one MiB archive cap', () => {
  const archiveBytes = Buffer.from('zip');
  const artifact = { id: 5, name: 'h0-runner-attestation-9-1', digest: `sha256:${sha(archiveBytes)}` };
  const falseSafety = Buffer.from(publicBytes.toString().replace('"offlineRunner":true', '"offlineRunner":false'));
  assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes, members: member(falseSafety), policy }), /public artifact/);
  const invalidRetention = Buffer.from(publicBytes.toString().replace('"workflowDays":90', '"workflowDays":89'));
  assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes, members: member(invalidRetention), policy }), /public artifact/);
  assert.throws(() => validateArtifactReadback({ artifact: { ...artifact, digest: `sha256:${sha(Buffer.alloc(1024 * 1024 + 1))}` }, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes: Buffer.alloc(1024 * 1024 + 1), members: member(publicBytes), policy }), /artifact digest/);
  assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes, members: member(falseSafety), policy: { ...policy, maxBytes: archiveBytes.length - 1 } }), /artifact digest/);
});

test('rejects a canonical public artifact whose valid workflow SHA differs from durable state', () => {
  const archiveBytes = Buffer.from('zip');
  const artifact = { id: 5, name: 'h0-runner-attestation-9-1', digest: `sha256:${sha(archiveBytes)}` };
  assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'b'.repeat(40), archiveBytes, members: member(publicBytes), policy }), /public artifact/);
});

test('rejects a bare artifact metadata digest even when its lowercase hex is correct', () => {
  const archiveBytes = Buffer.from('zip');
  const artifact = { id: 5, name: 'h0-runner-attestation-9-1', digest: sha(archiveBytes) };
  assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes, members: member(publicBytes), policy }), /artifact digest/);
});

test('requires exactly sixteen approved public digests and rejects identity or extra digest fields', () => {
  const archiveBytes = Buffer.from('zip');
  const artifact = { id: 5, name: 'h0-runner-attestation-9-1', digest: `sha256:${sha(archiveBytes)}` };
  assert.equal(Object.keys(publicValue.digests).length, 16);
  for (const bytes of [
    mutatedPublic((value) => { delete value.digests.restoreSha256; }),
    mutatedPublic((value) => { value.digests.runnerIdentitySha256 = 'b'.repeat(64); }),
    mutatedPublic((value) => { value.digests.runnerIdentitySha256 = `sha256:${'b'.repeat(64)}`; }),
    mutatedPublic((value) => { value.digests.unexpectedSha256 = 'b'.repeat(64); }),
  ])
    assert.throws(() => validateArtifactReadback({ artifact, runId: 9, attempt: 1, expectedSha: 'a'.repeat(40), archiveBytes, members: member(bytes), policy }), /public artifact/);
});
