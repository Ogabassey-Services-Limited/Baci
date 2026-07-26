// biome-ignore-all format: compact transition matrix remains below the repository file limit
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  beginOperation,
  bindArtifactReadback,
  completeArtifactReadback,
  consumeResponse,
  createOwnerState,
  OPERATIONS,
} from './owner-api-transport.mjs';
import { artifactEvidence } from './owner-api-transport-operation-evidence.mjs';
import { canonical } from './owner-api-transport-primitives.mjs';
import {
  TRANSPORT_ENTRY,
  TRANSPORT_SOURCE_FILES,
} from './owner-api-transport-source.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const reseal = (value, patch) => {
  const { stateDigest: _ignored, ...unsigned } = value;
  const next = { ...unsigned, ...patch };
  return Object.freeze({ ...next, stateDigest: hash(canonical(next)) });
};
function initial() {
  const authorization = {
    generation: 1,
    operationSet: OPERATIONS,
    operationSetDigest: hash(canonical(OPERATIONS)),
    policyFileSha256: 'c'.repeat(64),
    provenance: { manifestSha256: 'd'.repeat(64), nodeProvenanceSha256: '1'.repeat(64), runtimeSha256: 'f'.repeat(64), sourceArchiveSha256: '2'.repeat(64) },
    purpose: 'task9-exact-run',
    schemaVersion: 1,
    sourceBinding: { base: { ref: 'refs/heads/main', sha: '6'.repeat(40) }, deploymentSha: 'a'.repeat(40), exactRun: { admissionId: 'b'.repeat(64), workflow: { id: 2, path: '.github/workflows/cwv-runner-attestation.yml', ref: 'refs/heads/main' } }, mergeSha: '8'.repeat(40), pullRequest: { headRef: 'h0/task9', number: 9 }, ref: 'refs/pull/9/merge', repository: { id: 1100488586, name: 'ogabasseyy/Baci' }, reviewedSha: '7'.repeat(40) },
    sourceFiles: TRANSPORT_SOURCE_FILES.map((path) => ({ path, sha256: path === TRANSPORT_ENTRY ? 'e'.repeat(64) : '1'.repeat(64) })),
    transactionId: 'baci-cwv-1',
  };
  const bytes = Buffer.from(canonical(authorization));
  return createOwnerState({ sourceAuthorizationBytes: bytes, sourceAuthorizationSha256: hash(bytes), digests: { manifest: 'd'.repeat(64), policy: 'c'.repeat(64), runtime: 'f'.repeat(64), transport: 'e'.repeat(64) }, createdMonotonicMs: 1, createdWallClockMs: 0, deadlineMonotonicMs: 1200001 });
}
const row = (attempt = 1, status = 'queued') => ({ actor: { login: 'ogabasseyy' }, created_at: '2026-01-01T00:00:00Z', display_title: `CWV Runner Attestation ${'b'.repeat(64)}`, event: 'workflow_dispatch', head_branch: 'main', head_sha: 'a'.repeat(40), html_url: 'https://github.com/ogabasseyy/Baci/actions/runs/9', id: 9, path: '.github/workflows/cwv-runner-attestation.yml', run_attempt: attempt, status, url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9', workflow_id: 2 });
const page = (rows, receivedMonotonicMs) => ({ status: 200, receivedMonotonicMs, linkValues: [], body: { total_count: rows.length, workflow_runs: rows } });
const quiescent = () => consumeResponse(initial(), 'list-attestation-runs', page([]));
const accepted = () => consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', { status: 200, receivedMonotonicMs: 19, body: { html_url: row().html_url, run_url: row().url, workflow_run_id: 9 } });
const runner = { generation: 3, id: 7, name: 'baci-cwv-measurement-01' }; const runnerIdentitySha256 = hash(canonical(runner));
const publicReadback = (headSha) => ({ digests: { restoreSha256: '9'.repeat(64) }, runner, schemaVersion: 1, workflow: { headSha } });

test('requires the successful dispatch receipt to pass mandatory reconciliation before QUEUED', () => {
  const before = accepted();
  assert.equal(before.phase, 'DISPATCH_ACCEPTED');
  const after = consumeResponse(before, 'list-attestation-runs', page([row()], 20));
  assert.equal(after.phase, 'QUEUED');
  assert.equal(after.postDispatchEvidence.run.id, 9);
  assert.equal(after.postDispatchEvidence.run.attempt, 1);
  const { queuedSinceMonotonicMs: _queued, ...run } = after.run;
  assert.deepEqual(after.postDispatchEvidence.run, run);
});

test('compares a dispatched run timestamp at GitHub API second precision', () => {
  const before = accepted();
  const createdSecond = Date.parse(row().created_at);
  const sameSecond = reseal(before, {
    dispatchIntent: { ...before.dispatchIntent, createdWallClockMs: createdSecond + 900 },
  });
  assert.equal(
    consumeResponse(sameSecond, 'list-attestation-runs', page([row()], 20)).phase,
    'QUEUED',
  );

  const laterSecond = reseal(before, {
    dispatchIntent: { ...before.dispatchIntent, createdWallClockMs: createdSecond + 1000 },
  });
  assert.throws(
    () => consumeResponse(laterSecond, 'list-attestation-runs', page([row()], 20)),
    /invalid run evidence/,
  );
});

test('uses the same list receipt to reconcile an indeterminate dispatch directly to QUEUED', () => {
  const intent = beginOperation(quiescent(), 'dispatch-exact-run');
  const after = consumeResponse(intent, 'list-attestation-runs', page([row()], 20));
  assert.equal(after.phase, 'QUEUED');
  assert.equal(after.dispatchReconciliation.reason, 'same-admission-bound');
  assert.equal(after.postDispatchEvidence.run.attempt, 1);
});

test('enters manual reconciliation when intent recovery observes another active run', () => {
  const intent = beginOperation(quiescent(), 'dispatch-exact-run');
  const unrelated = { actor: { login: 'other' }, created_at: '2026-01-01T00:00:00Z', display_title: 'other', event: 'workflow_dispatch', id: 10, status: 'in_progress' };
  const after = consumeResponse(intent, 'list-attestation-runs', page([row(), unrelated], 20));
  assert.equal(after.phase, 'MANUAL_RECONCILIATION');
  assert.equal(after.dispatchReconciliation.reason, 'additional-active-run');
});

test('accepts every frozen active status only through the mandatory reconciliation read', () => {
  for (const status of ['queued', 'in_progress', 'requested', 'waiting', 'pending']) {
    const after = consumeResponse(accepted(), 'list-attestation-runs', page([row(1, status)], 20));
    assert.equal(after.phase, 'QUEUED');
    assert.equal(after.postDispatchEvidence.run.status, status);
  }
});

test('fails closed when a pre-dispatch page contains an unknown workflow status', () => {
  const unknown = { actor: { login: 'other' }, created_at: '2026-01-01T00:00:00Z', display_title: 'other', event: 'workflow_dispatch', id: 10, status: 'future-status' };
  assert.throws(() => consumeResponse(initial(), 'list-attestation-runs', page([unknown])), /invalid run evidence/);
});

test('fails closed when a post-dispatch page contains an unknown workflow status', () => {
  const unknown = { actor: { login: 'other' }, created_at: '2026-01-01T00:00:00Z', display_title: 'other', event: 'workflow_dispatch', id: 10, status: 'future-status' };
  assert.throws(() => consumeResponse(accepted(), 'list-attestation-runs', page([row(), unknown], 20)), /invalid run evidence/);
});

test('binds rerun attempt two through a fresh mandatory reconciliation receipt', () => {
  const before = accepted();
  const prior = reseal(before, { expectedAttempt: 2, phase: 'RERUN_REQUESTED', rerunUsed: true, run: { ...before.run, attempt: 1 } });
  const queued = consumeResponse(prior, 'read-exact-run', { status: 200, body: { ...row(2), conclusion: null } });
  const after = consumeResponse(queued, 'list-attestation-runs', page([row(2)], 21));
  assert.equal(after.phase, 'QUEUED');
  assert.equal(after.run.attempt, 2);
  assert.equal(after.postDispatchEvidence.run.attempt, 2);
});

test('seals exact readback and owner-handoff bytes into terminal evidence state', () => {
  const state = reseal(initial(), { artifact: { createdAt: '2026-01-01T00:00:00.000Z', digest: '1'.repeat(64), expiresAt: '2026-04-01T00:00:04.000Z', id: 5, lifetimeMilliseconds: 7776004000, name: 'h0-runner-attestation-9-1' }, phase: 'ARTIFACT_BOUND', run: { attempt: 1, id: 9 } });
  const publicValue = publicReadback(state.expectedSha); const memberBytes = Buffer.from(canonical(publicValue));
  const archiveBytes = Buffer.from('archive');
  const readback = { artifact: state.artifact, public: publicValue };
  const after = bindArtifactReadback(state, { archiveBytes, memberBytes, readback });
  assert.equal(after.phase, 'EVIDENCE_VERIFIED');
  assert.equal(after.artifactReadbackEvidence.archiveSha256, hash(archiveBytes));
  assert.equal(after.artifactReadbackEvidence.memberSha256, hash(memberBytes));
  assert.equal(after.artifactReadbackEvidence.stateBeforeSha256, state.stateDigest);
  assert.equal(after.artifactReadbackEvidence.stateBeforeFileSha256, hash(canonical(state)));
  assert.equal(after.artifactReadbackEvidence.ownerHandoffSha256, hash(canonical(after.ownerEvidenceHandoff)));
  assert.equal(after.ownerEvidenceHandoff.canonicalMember, memberBytes.toString('utf8'));
  assert.equal(after.ownerEvidenceHandoff.attempt, 1);
  assert.equal(after.ownerEvidenceHandoff.runId, 9);
  assert.equal(after.ownerEvidenceHandoff.runnerIdentitySha256, runnerIdentitySha256);
});

test('durably persists the terminal EVIDENCE_VERIFIED state before returning it', async () => {
  const state = reseal(initial(), { artifact: { createdAt: '2026-01-01T00:00:00.000Z', digest: '1'.repeat(64), expiresAt: '2026-04-01T00:00:00.000Z', id: 5, lifetimeMilliseconds: 7776000000, name: 'h0-runner-attestation-9-1' }, phase: 'ARTIFACT_BOUND', run: { attempt: 1, id: 9 } });
  const publicValue = publicReadback(state.expectedSha); const memberBytes = Buffer.from(canonical(publicValue));
  const writes = [];
  const after = await completeArtifactReadback(state, { archiveBytes: Buffer.from('archive'), memberBytes, readback: { artifact: state.artifact, public: publicValue } }, (previous, following) => { writes.push({ previous, following }); return { generation: following.generation, stateDigest: following.stateDigest }; });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].previous.stateDigest, state.stateDigest);
  assert.equal(writes[0].following.phase, 'EVIDENCE_VERIFIED');
  assert.equal(after.stateDigest, writes[0].following.stateDigest);
});

test('refuses a valid but different workflow SHA at the durable readback boundary', async () => {
  const state = reseal(initial(), { artifact: { createdAt: '2026-01-01T00:00:00.000Z', digest: '1'.repeat(64), expiresAt: '2026-04-01T00:00:00.000Z', id: 5, lifetimeMilliseconds: 7776000000, name: 'h0-runner-attestation-9-1' }, phase: 'ARTIFACT_BOUND', run: { attempt: 1, id: 9 } });
  const publicValue = publicReadback('b'.repeat(40));
  const memberBytes = Buffer.from(canonical(publicValue));
  await assert.rejects(
    completeArtifactReadback(state, { archiveBytes: Buffer.from('archive'), memberBytes, readback: { artifact: state.artifact, public: publicValue } }, () => {
      throw new Error('must not persist');
    }),
    /invalid artifact readback/
  );
});

test('accepts only artifact expiry inside the frozen 90-day plus-or-minus-five-minute window', () => {
  const state = reseal(initial(), { run: { attempt: 1, id: 9 } });
  const metadata = (expiresAt, digest = `sha256:${'1'.repeat(64)}`) => ({ total_count: 1, artifacts: [{ archive_download_url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/artifacts/5/zip', created_at: '2026-01-01T00:00:00.000Z', digest, expired: false, expires_at: expiresAt, id: 5, name: 'h0-runner-attestation-9-1', node_id: 'artifact', size_in_bytes: 7, updated_at: '2026-01-01T00:00:04.000Z', url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/artifacts/5', workflow_run: { head_branch: 'main', head_repository_id: 1100488586, head_sha: 'a'.repeat(40), id: 9, repository_id: 1100488586 } }] });
  assert.equal(artifactEvidence(state, metadata('2026-04-01T00:00:04.000Z')).artifact.lifetimeMilliseconds, 7776004000);
  assert.equal(artifactEvidence(state, metadata('2026-03-31T23:55:00.000Z')).artifact.lifetimeMilliseconds, 7775700000);
  assert.equal(artifactEvidence(state, metadata('2026-04-01T00:05:00.000Z')).artifact.lifetimeMilliseconds, 7776300000);
  assert.throws(() => artifactEvidence(state, metadata('2026-03-31T23:54:59.000Z')), /artifact metadata/);
  assert.throws(() => artifactEvidence(state, metadata('2026-04-01T00:05:01.000Z')), /artifact metadata/);
  assert.throws(() => artifactEvidence(state, metadata('2026-04-01T00:00:04.000Z', '1'.repeat(64))), /artifact metadata/);
});
