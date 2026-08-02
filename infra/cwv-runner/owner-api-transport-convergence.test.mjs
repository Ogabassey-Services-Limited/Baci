// biome-ignore-all format: compact exact-run convergence matrix stays below the repository limit
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { validateAttemptTwoRearm } from './exact-run-rearm-contract.mjs';
import { beginOperation, bindAuthenticatedRootReceipts, bindRunnerInventoryHold, checkQueueTimer, consumeResponse, createOwnerState, executeApiOperation, OPERATIONS, requestFor } from './owner-api-transport.mjs';
import { FAILED_TRANSPORT_JOB_STEP_NAMES } from './owner-api-transport-failure.mjs';
import { canonical } from './owner-api-transport-primitives.mjs';
import { TRANSPORT_ENTRY, TRANSPORT_SOURCE_FILES } from './owner-api-transport-source.mjs';
import { rearmDocumentFrom } from './task9-owner-documents.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const reseal = (value, patch) => { const unsigned = { ...value, ...patch }; delete unsigned.stateDigest; for (const key of Object.keys(unsigned)) if (unsigned[key] === undefined) delete unsigned[key]; return Object.freeze({ ...unsigned, stateDigest: hash(canonical(unsigned)) }); };
const source = () => ({ generation: 1, operationSet: OPERATIONS, operationSetDigest: hash(canonical(OPERATIONS)), policyFileSha256: 'c'.repeat(64), provenance: { manifestSha256: 'd'.repeat(64), nodeProvenanceSha256: '1'.repeat(64), runtimeSha256: 'f'.repeat(64), sourceArchiveSha256: '2'.repeat(64) }, purpose: 'task9-exact-run', schemaVersion: 1, sourceBinding: { base: { ref: 'refs/heads/main', sha: '6'.repeat(40) }, deploymentSha: 'a'.repeat(40), exactRun: { admissionId: 'b'.repeat(64), workflow: { id: 2, path: '.github/workflows/cwv-runner-attestation.yml', ref: 'refs/heads/main' } }, mergeSha: '8'.repeat(40), pullRequest: { headRef: 'h0/task9', number: 9 }, ref: 'refs/pull/9/merge', repository: { id: 1100488586, name: 'ogabasseyy/Baci' }, reviewedSha: '7'.repeat(40) }, sourceFiles: TRANSPORT_SOURCE_FILES.map((path) => ({ path, sha256: path === TRANSPORT_ENTRY ? 'e'.repeat(64) : '1'.repeat(64) })), transactionId: 'baci-cwv-1' });
function initial(overallMs = 1200000) { const value = source(); const bytes = Buffer.from(canonical(value)); return createOwnerState({ sourceAuthorizationBytes: bytes, sourceAuthorizationSha256: hash(bytes), digests: { manifest: 'd'.repeat(64), policy: 'c'.repeat(64), runtime: 'f'.repeat(64), transport: 'e'.repeat(64) }, createdMonotonicMs: 1, createdWallClockMs: 0, deadlineMonotonicMs: 1 + overallMs }); }
const page = (body, extra = {}) => ({ status: 200, linkValues: [], body, ...extra });
const quiescent = () => consumeResponse(initial(), 'list-attestation-runs', page({ total_count: 0, workflow_runs: [] }));
const dispatchReceipt = { status: 200, receivedMonotonicMs: 19, body: { workflow_run_id: 9, run_url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9', html_url: 'https://github.com/ogabasseyy/Baci/actions/runs/9' } };
const matchingRow = { actor: { login: 'ogabasseyy' }, created_at: '2026-01-01T00:00:00Z', display_title: `CWV Runner Attestation ${'b'.repeat(64)}`, event: 'workflow_dispatch', head_branch: 'main', head_sha: 'a'.repeat(40), html_url: dispatchReceipt.body.html_url, id: 9, path: '.github/workflows/cwv-runner-attestation.yml', run_attempt: 1, status: 'queued', url: dispatchReceipt.body.run_url, workflow_id: 2 };

test('dispatches the frozen workflow path on main and requires reconciliation before a run read', () => {
  const before = quiescent();
  const request = requestFor(before, 'dispatch-exact-run');
  assert.equal(request.url, 'https://api.github.com/repos/ogabasseyy/Baci/actions/workflows/.github%2Fworkflows%2Fcwv-runner-attestation.yml/dispatches');
  assert.deepEqual(request.body, { ref: 'main', inputs: { admission_id: 'b'.repeat(64) } });
  const accepted = consumeResponse(beginOperation(before, 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  assert.equal(accepted.phase, 'DISPATCH_ACCEPTED');
  assert.equal(accepted.run.id, 9);
  assert.equal(accepted.run.queuedSinceMonotonicMs, 19);
  assert.throws(() => consumeResponse(accepted, 'read-exact-run', { status: 200, body: { ...matchingRow, conclusion: null } }), /unexpected/);
  assert.throws(() => consumeResponse(beginOperation(before, 'dispatch-exact-run'), 'dispatch-exact-run', { ...dispatchReceipt, body: { ...dispatchReceipt.body, id: 9 } }), /dispatch/);
});

test('starts independent 120-second queue and 20-minute overall timers from their authoritative receipts', () => {
  const state = initial(1200000);
  assert.equal(state.deadlineMonotonicMs, 1200001);
  const before = consumeResponse(state, 'list-attestation-runs', page({ total_count: 0, workflow_runs: [] }));
  const accepted = consumeResponse(beginOperation(before, 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  assert.equal(checkQueueTimer(accepted, 120019), true);
  assert.throws(() => checkQueueTimer(accepted, 120020), /queue/);
  assert.equal(checkQueueTimer(state, 1200001), true);
  assert.throws(() => checkQueueTimer(state, 1200002), /overall/);
});

test('enforces queue and overall boundaries through begin before a token or network send', async () => {
  const queued = consumeResponse(consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt), 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  const before = queued.queueDeadlineMonotonicMs;
  const run = async (state, operation, now) => executeApiOperation({ state, operation, nowMonotonicMs: now, persist: (_before, after) => ({ generation: after.generation, stateDigest: after.stateDigest }), tokenPipe: () => { throw new Error('token read'); }, send: () => { throw new Error('network send'); } });
  await assert.rejects(run(queued, 'read-exact-run', before + 1), /queue deadline/);
  await assert.rejects(run(initial(), 'list-attestation-runs', 1200002), /overall deadline/);
  await assert.rejects(run(queued, 'read-exact-run', before), /token read/);
  await assert.rejects(run(initial(), 'list-attestation-runs', 1200001), /token read/);
});

test('accepts one cancellation for every known active phase but requires observed same-run cancellation before terminal state', () => {
  const accepted = consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  const queued = consumeResponse(accepted, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  const running = consumeResponse(queued, 'read-exact-run', { status: 200, body: { ...matchingRow, conclusion: null, status: 'in_progress' } });
  const rerun = reseal(queued, { expectedAttempt: 2, phase: 'RERUN_REQUESTED', queueTimerAttempt: 2 });
  const rerunIntent = reseal(queued, { phase: 'RERUN_INTENT', rerunIntent: { createdMonotonicMs: 20, requestSha256: '1'.repeat(64) } });
  for (const state of [accepted, queued, running, rerun, rerunIntent]) {
    const cleanup = beginOperation(state, 'cancel-exact-run', state.deadlineMonotonicMs + 1);
    assert.equal(cleanup.phase, 'CANCEL_INTENT');
    assert.equal(cleanup.operationalDeadlineMonotonicMs, state.deadlineMonotonicMs);
    assert.equal(cleanup.cleanupDeadlineMonotonicMs, state.deadlineMonotonicMs + 30000);
    assert.equal(cleanup.deadlineMonotonicMs, cleanup.cleanupDeadlineMonotonicMs);
    assert.deepEqual(cleanup.cancelIntent.attempts, ['RERUN_REQUESTED', 'RERUN_INTENT'].includes(state.phase) ? [1, 2] : [1]);
    const cancelAccepted = consumeResponse(cleanup, 'cancel-exact-run', { status: 202, receivedMonotonicMs: state.deadlineMonotonicMs + 2 });
    assert.equal(cancelAccepted.phase, 'CANCEL_ACCEPTED');
    assert.throws(() => beginOperation(cancelAccepted, 'cancel-exact-run', state.deadlineMonotonicMs + 3), /cancellation/);
    const attempt = ['RERUN_REQUESTED', 'RERUN_INTENT'].includes(state.phase) ? 2 : 1;
    const stale = consumeResponse(beginOperation(cancelAccepted, 'read-exact-run', state.deadlineMonotonicMs + 3), 'read-exact-run', { status: 200, receivedMonotonicMs: state.deadlineMonotonicMs + 3, body: { ...matchingRow, conclusion: null, run_attempt: attempt } });
    assert.equal(stale.phase, 'CANCEL_ACCEPTED'); assert.equal(stale.cancelPollEvidence.pollCount, 1);
    const noncanceled = consumeResponse(beginOperation(stale, 'read-exact-run', state.deadlineMonotonicMs + 4), 'read-exact-run', { status: 200, receivedMonotonicMs: state.deadlineMonotonicMs + 4, body: { ...matchingRow, conclusion: 'failure', run_attempt: attempt, status: 'completed' } });
    assert.equal(noncanceled.phase, 'CANCEL_ACCEPTED'); assert.equal(noncanceled.cancelPollEvidence.pollCount, 2);
    const canceled = consumeResponse(beginOperation(noncanceled, 'read-exact-run', state.deadlineMonotonicMs + 5), 'read-exact-run', { status: 200, receivedMonotonicMs: state.deadlineMonotonicMs + 5, body: { ...matchingRow, conclusion: 'cancelled', run_attempt: attempt, status: 'completed' } });
    assert.equal(canceled.phase, 'CANCELED'); assert.equal(canceled.run.id, 9); assert.equal(canceled.run.attempt, attempt);
    assert.throws(() => beginOperation(cancelAccepted, 'read-exact-run', cancelAccepted.cleanupDeadlineMonotonicMs + 1), /cleanup deadline/);
    assert.throws(() => beginOperation(state, 'cancel-exact-run', state.deadlineMonotonicMs + 30001), /cleanup deadline/);
  }
});

test('binds cancellation observation receipt time to its request and immutable cleanup deadline', () => {
  const queued = consumeResponse(consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt), 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  const intent = beginOperation(queued, 'cancel-exact-run', queued.deadlineMonotonicMs + 1);
  const accepted = consumeResponse(intent, 'cancel-exact-run', { status: 202, receivedMonotonicMs: queued.deadlineMonotonicMs + 2 });
  const canceled = { status: 200, body: { ...matchingRow, conclusion: 'cancelled', status: 'completed' } };
  const request = beginOperation(accepted, 'read-exact-run', accepted.cancelAcceptedEvidence.acceptedMonotonicMs + 2);
  assert.throws(() => consumeResponse(request, 'read-exact-run', canceled), /cancellation evidence/);
  assert.throws(() => consumeResponse(request, 'read-exact-run', { ...canceled, receivedMonotonicMs: accepted.cancelAcceptedEvidence.acceptedMonotonicMs + 1 }), /cancellation evidence/);
  assert.throws(() => consumeResponse(request, 'read-exact-run', { ...canceled, receivedMonotonicMs: accepted.cleanupDeadlineMonotonicMs + 1 }), /cancellation evidence/);
  assert.throws(() => beginOperation(request, 'read-exact-run', accepted.cancelAcceptedEvidence.acceptedMonotonicMs + 3), /cleanup deadline/);
  const boundaryRequest = beginOperation(accepted, 'read-exact-run', accepted.cleanupDeadlineMonotonicMs);
  const observed = consumeResponse(boundaryRequest, 'read-exact-run', { ...canceled, receivedMonotonicMs: accepted.cleanupDeadlineMonotonicMs });
  assert.equal(observed.phase, 'CANCELED'); assert.equal(observed.cancelObservedEvidence.receivedMonotonicMs, accepted.cleanupDeadlineMonotonicMs);
});

test('rejects an attempt-mismatched queue timer before the transport can use it', () => {
  const queued = consumeResponse(consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt), 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  assert.throws(() => beginOperation(reseal(queued, { queueTimerAttempt: 2 }), 'read-exact-run', 20), /queue timer/);
  assert.throws(() => beginOperation(reseal(queued, { queueTimerAttempt: 2 }), 'cancel-exact-run', queued.deadlineMonotonicMs + 1), /queue timer/);
});

test('binds workflow actor SHA attempt and status through mandatory reconciliation before exact-run reads', () => {
  const accepted = consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  const body = { ...matchingRow, conclusion: null };
  const reconciled = consumeResponse(accepted, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  const queued = consumeResponse(reconciled, 'read-exact-run', { status: 200, body });
  assert.equal(queued.phase, 'QUEUED');
  assert.deepEqual(queued.run, { actor: 'ogabasseyy', admissionId: 'b'.repeat(64), attempt: 1, conclusion: null, displayTitle: `CWV Runner Attestation ${'b'.repeat(64)}`, event: 'workflow_dispatch', htmlUrl: dispatchReceipt.body.html_url, id: 9, queuedSinceMonotonicMs: 19, runUrl: dispatchReceipt.body.run_url, status: 'queued' });
});

test('binds one fresh post-dispatch reconciliation generation and rejects replay or SHA drift', () => {
  const accepted = consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  const reconciled = consumeResponse(accepted, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  assert.equal(reconciled.postDispatchEvidence.stateGeneration, accepted.generation);
  assert.throws(() => consumeResponse(reconciled, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] })), /reconciliation/);
  assert.throws(() => consumeResponse(accepted, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [{ ...matchingRow, head_sha: '0'.repeat(40) }] })), /run evidence/);
});

test('reconciles durable intent and indeterminate states without ever permitting a second POST', () => {
  const intent = beginOperation(quiescent(), 'dispatch-exact-run');
  const indeterminate = consumeResponse(intent, 'list-attestation-runs', page({ total_count: 0, workflow_runs: [] }, { receivedMonotonicMs: 2 }));
  assert.equal(indeterminate.phase, 'DISPATCH_INDETERMINATE');
  assert.equal(indeterminate.dispatchReconciliation.pollCount, 1);
  assert.throws(() => beginOperation(indeterminate, 'dispatch-exact-run'), /ambiguous/);
  const accepted = consumeResponse(indeterminate, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }, { receivedMonotonicMs: 3 }));
  assert.equal(accepted.phase, 'QUEUED');
  assert.equal(accepted.run.id, 9);
  assert.equal(accepted.run.queuedSinceMonotonicMs, intent.createdMonotonicMs);
});

test('keeps zero-match reconciliation bounded by its receipt deadline, not a poll count', () => {
  let value = beginOperation(quiescent(), 'dispatch-exact-run');
  for (let attempt = 1; attempt <= 3; attempt += 1) value = consumeResponse(value, 'list-attestation-runs', page({ total_count: 0, workflow_runs: [] }, { receivedMonotonicMs: attempt + 1 }));
  assert.equal(value.phase, 'DISPATCH_INDETERMINATE');
  value = consumeResponse(value, 'list-attestation-runs', page({ total_count: 0, workflow_runs: [] }, { receivedMonotonicMs: value.dispatchIntent.reconcileDeadlineMonotonicMs }));
  assert.equal(value.phase, 'MANUAL_RECONCILIATION');
  assert.throws(() => beginOperation(value, 'dispatch-exact-run'), /ambiguous/);
  const intent = beginOperation(quiescent(), 'dispatch-exact-run');
  const multiple = consumeResponse(intent, 'list-attestation-runs', page({ total_count: 2, workflow_runs: [matchingRow, { ...matchingRow, id: 10, html_url: 'https://github.com/ogabasseyy/Baci/actions/runs/10', url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/10' }] }, { receivedMonotonicMs: 2 }));
  assert.equal(multiple.phase, 'MANUAL_RECONCILIATION');
});

test('rejects a same-admission run owned by a collaborator and binds the repository owner', () => {
  const intent = beginOperation(quiescent(), 'dispatch-exact-run');
  assert.throws(() => consumeResponse(intent, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [{ ...matchingRow, actor: { login: 'collaborator' } }] }, { receivedMonotonicMs: 2 })), /run evidence/);
  const queued = consumeResponse(intent, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }, { receivedMonotonicMs: 2 }));
  assert.equal(queued.run.actor, 'ogabasseyy');
});

test('permits one rerun only from the canonical transport-loss join over authenticated root receipts and frozen job steps', () => {
  let value = consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  value = consumeResponse(value, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  value = consumeResponse(value, 'read-exact-run', { status: 200, body: { ...matchingRow, conclusion: 'failure', status: 'completed' } });
  value = reseal(value, { runnerEvidence: { boundStateGeneration: value.generation - 2, challengeNonce: '2'.repeat(64), holdDigest: '3'.repeat(64), pages: [{}], runnerId: 7, responseSha256: '1'.repeat(64) } });
  const terminalProcessesSha256 = 'e'.repeat(64);
  const runtime = { actionNodeObserved: false, admissionId: value.admissionId, attempt: 1, daemonsOffline: true, findings: [], jobStartHookObserved: false, listenerExitKind: 'transport-lost', runId: 9, runnerOffline: true, schemaVersion: 1, stateGeneration: value.generation, terminalProcessesSha256 };
  const restore = { admissionId: value.admissionId, attempt: 1, cleanupComplete: true, daemonsOffline: true, findings: [], networkAbsent: true, processes: [], restored: true, runId: 9, runnerOffline: true, schemaVersion: 1, stateGeneration: value.generation, terminalProcessesSha256 };
  const runtimeBytes = Buffer.from(canonical(runtime)); const restoreBytes = Buffer.from(canonical(restore));
  const hostileRuntimeBytes = Buffer.from(canonical({ ...runtime, terminalProcessesSha256: '0'.repeat(64) }));
  assert.throws(() => bindAuthenticatedRootReceipts(value, { authenticated: true, channel: 'ssh-controller', receivedMonotonicMs: 50, restoreBytes, restoreSha256: hash(restoreBytes), runtimeBytes: hostileRuntimeBytes, runtimeSha256: hash(hostileRuntimeBytes), transactionId: 'baci-cwv-1' }), /root receipt/);
  value = bindAuthenticatedRootReceipts(value, { authenticated: true, channel: 'ssh-controller', receivedMonotonicMs: 50, restoreBytes, restoreSha256: hash(restoreBytes), runtimeBytes, runtimeSha256: hash(runtimeBytes), transactionId: 'baci-cwv-1' });
  const steps = FAILED_TRANSPORT_JOB_STEP_NAMES.map((name, index) => ({ completed_at: null, conclusion: null, name, number: index + 1, started_at: null, status: 'queued' }));
  const job = { check_run_url: 'https://api.github.com/repos/ogabasseyy/Baci/check-runs/17', completed_at: '2026-01-01T00:01:00Z', conclusion: 'failure', created_at: '2026-01-01T00:00:00Z', head_branch: 'main', head_sha: 'a'.repeat(40), html_url: 'https://github.com/ogabasseyy/Baci/actions/runs/9/job/17', id: 17, labels: ['self-hosted', 'baci-cwv-measurement'], name: 'attest', node_id: 'job-node', run_attempt: 1, run_id: 9, run_url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9', runner_group_id: 1, runner_group_name: 'Default', runner_id: 7, runner_name: 'baci-cwv-measurement-01', started_at: '2026-01-01T00:00:01Z', status: 'completed', steps, url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/jobs/17', workflow_name: 'CWV Runner Attestation' };
  assert.throws(() => consumeResponse(value, 'read-failed-job-evidence', { status: 200, body: { jobs: [{ ...job, steps: [...steps.slice(0, -1), { ...steps.at(-1), name: 'Revoke auditor token and clean private state' }] }], total_count: 1 }, linkValues: [] }), /failed job/);
  assert.throws(() => consumeResponse(value, 'read-failed-job-evidence', { status: 200, body: { jobs: [{ ...job, steps: [...steps, { ...steps.at(-1), number: steps.length + 1 }] }], total_count: 1 }, linkValues: [] }), /failed job/);
  value = consumeResponse(value, 'read-failed-job-evidence', { status: 200, body: { jobs: [job], total_count: 1 }, linkValues: [] });
  assert.equal(value.failureEvidence.code, 'RUNNER_TRANSPORT_LOST_BEFORE_ATTESTATION');
  assert.equal(value.failureEvidence.rootStateGeneration + 1, value.failureEvidence.stateGeneration);
  assert.equal(value.failureEvidence.rootRuntimeDigest, hash(runtimeBytes));
  const rerun = consumeResponse(beginOperation(value, 'rerun-failed-exact-run'), 'rerun-failed-exact-run', { status: 201, receivedMonotonicMs: 70 });
  assert.equal(rerun.phase, 'RERUN_REQUESTED'); assert.equal(rerun.expectedAttempt, 2); assert.equal(rerun.run.queuedSinceMonotonicMs, 70); assert.equal(rerun.queueDeadlineMonotonicMs, 120070);
  assert.equal(rerun.runnerEvidence, undefined); assert.equal(rerun.runnerInventoryHold, undefined); assert.equal(rerun.failureEvidence.code, 'RUNNER_TRANSPORT_LOST_BEFORE_ATTESTATION');
  const attemptTwo = { ...matchingRow, run_attempt: 2 };
  const bound = consumeResponse(rerun, 'read-exact-run', { status: 200, body: { ...attemptTwo, conclusion: null } });
  assert.equal(bound.rerunVisibility, undefined);
  const reconciled = consumeResponse(bound, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [attemptTwo] }));
  assert.equal(reconciled.run.attempt, 2); assert.equal(reconciled.postDispatchEvidence.run.attempt, 2);
  const ownerReconciled = reseal(reconciled, { postDispatchEvidence: { ...reconciled.postDispatchEvidence, run: { ...reconciled.postDispatchEvidence.run, actor: 'ogabasseyy' } }, run: { ...reconciled.run, actor: 'ogabasseyy' } });
  const rearm = rearmDocumentFrom(ownerReconciled, 'f'.repeat(64));
  const observation = Buffer.from(canonical({ actionNodeObserved: false, admissionId: rearm.binding.admissionId, attempt: 1, findings: [], jobStartHookObserved: false, listenerExitKind: 'transport-lost', runId: rearm.binding.run.id, schemaVersion: 1, stateGeneration: value.failureEvidence.rootStateGeneration, terminalProcessesSha256 }));
  assert.doesNotThrow(() => validateAttemptTwoRearm({ observationBytes: observation, priorBinding: { ...rearm.binding, repository: { ...rearm.binding.repository }, run: { ...rearm.binding.run, attempt: 1 }, workflow: { ...rearm.binding.workflow } }, request: rearm, restoreBytes, runtimeBytes }));
  assert.throws(() => beginOperation(rerun, 'rerun-failed-exact-run'), /rerun/);
  assert.throws(() => consumeResponse(reseal(value, { phase: 'FAILED', failureEvidence: undefined, rootFailureEvidence: undefined }), 'read-failed-job-evidence', { status: 200, body: { jobs: [job], total_count: 1 }, linkValues: [] }), /failed job/);
  assert.throws(() => consumeResponse(reseal(value, { phase: 'FAILED', failureEvidence: undefined }), 'read-failed-job-evidence', { status: 200, body: { jobs: [{ ...job, steps: [{ ...steps[0], started_at: '2026-01-01T00:00:02Z' }, ...steps.slice(1)] }], total_count: 1 }, linkValues: [] }), /failed job/);
});

test('follows only bounded duplicate-free Link targets and reconciles total_count across every page', () => {
  const row = (id) => ({ actor: { login: 'owner' }, created_at: '2026-01-01T00:00:00Z', display_title: `old-${id}`, event: 'workflow_dispatch', id, status: 'completed' });
  const target = 'https://api.github.com/repos/ogabasseyy/Baci/actions/workflows/.github%2Fworkflows%2Fcwv-runner-attestation.yml/runs?event=workflow_dispatch&per_page=100&page=2';
  const first = { status: 200, linkValues: [`<${target}>; rel="next", <${target}>; rel="last"`], body: { total_count: 101, workflow_runs: Array.from({ length: 100 }, (_, index) => row(index + 1)) } };
  const partial = consumeResponse(initial(), 'list-attestation-runs', first);
  assert.equal(requestFor(partial, 'list-attestation-runs').url, target);
  const complete = consumeResponse(partial, 'list-attestation-runs', { status: 200, linkValues: [], body: { total_count: 101, workflow_runs: [row(101)] } });
  assert.equal(complete.phase, 'QUIESCENT'); assert.equal(complete.pageCursors, undefined); assert.equal(complete.preDispatchEvidence.runs.length, 0);
  assert.throws(() => consumeResponse(initial(), 'list-attestation-runs', { ...first, linkValues: ['<https://example.test/escape?page=2>; rel="next"'] }), /Link/);
  assert.throws(() => consumeResponse(partial, 'list-attestation-runs', { status: 200, linkValues: [], body: { total_count: 101, workflow_runs: [row(100)] } }), /duplicate/);
});

test('requires a fresh authenticated hold challenge before runner page one while permitting unrelated runners', () => {
  let value = consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  value = consumeResponse(value, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  assert.throws(() => requestFor(value, 'list-runner-inventory'), /hold/);
  const binding = { admissionId: value.admissionId, campaignId: 'baci-cwv-1', expectedSha: value.expectedSha, policyFileSha256: value.digests.policy, repository: value.repository, run: { attempt: 1, id: 9 }, workflow: { id: 2, job: 'attest', path: '.github/workflows/cwv-runner-attestation.yml', ref: 'refs/heads/main' } };
  const challenge = { bindingDigest: hash(canonical(binding)), campaignId: 'baci-cwv-1', createdMonotonicSeconds: 100, deadlineMonotonicSeconds: 105, kind: 'inventory', nonce: 'f'.repeat(64), schemaVersion: 1 };
  const hold = { challenge, holdDigest: 'e'.repeat(64), identity: { campaignId: 'baci-cwv-1', hostname: 'a'.repeat(12), runnerContainerId: 'd'.repeat(64), runnerIp: '172.24.0.2', runnerPeerIfindex: 17, runnerVeth: 'veth0' }, liveSampleDigest: 'c'.repeat(64), schemaVersion: 1 };
  const holdBytes = Buffer.from(canonical(hold));
  value = bindRunnerInventoryHold(value, { authenticated: true, channel: 'ssh-controller', holdBytes, holdSha256: hash(holdBytes), receivedMonotonicMs: 80, transactionId: 'baci-cwv-1' });
  const dedicated = { busy: false, id: 7, labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'], name: 'baci-cwv-measurement-01', os: 'linux', status: 'offline' };
  const unrelated = { busy: false, id: 8, labels: ['Linux', 'ARM64', 'self-hosted'], name: 'general-runner', os: 'linux', status: 'offline' };
  value = consumeResponse(value, 'list-runner-inventory', { status: 200, receivedMonotonicMs: 81, linkValues: [], body: { runners: [dedicated, unrelated], total_count: 2 } });
  assert.equal(value.runnerEvidence.runnerId, 7); assert.equal(value.runnerEvidence.challengeNonce, challenge.nonce);
  assert.equal(checkQueueTimer(value, 120020), true);
  assert.throws(() => requestFor(value, 'list-runner-inventory'), /hold/);
  const freshAccepted = consumeResponse(beginOperation(quiescent(), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchReceipt);
  const freshQueued = consumeResponse(freshAccepted, 'list-attestation-runs', page({ total_count: 1, workflow_runs: [matchingRow] }));
  const fresh = bindRunnerInventoryHold(freshQueued, { authenticated: true, channel: 'ssh-controller', holdBytes, holdSha256: hash(holdBytes), receivedMonotonicMs: 80, transactionId: 'baci-cwv-1' });
  assert.throws(() => consumeResponse(fresh, 'list-runner-inventory', { status: 200, receivedMonotonicMs: 81, linkValues: [], body: { runners: [dedicated, { ...dedicated, id: 10 }], total_count: 2 } }), /runner/);
});

test('persists one bounded DNS answer-set plan after mutation intent and before token read or direct-IP send', async () => {
  const events = []; const plan = { address: '1.1.1.1', answers: ['1.1.1.1'], answerSetDigest: hash('1.1.1.1'), hostHeader: 'api.github.com', hostname: 'api.github.com', maxBytes: 1048576, maxRedirects: 0, path: '/x', requestSha256: '1'.repeat(64), servername: 'api.github.com', stateDigest: '2'.repeat(64), stateGeneration: 1 };
  await executeApiOperation({ state: quiescent(), operation: 'dispatch-exact-run', persist: (_before, after) => { events.push(`persist-${after.phase}`); return { generation: after.generation, stateDigest: after.stateDigest }; }, prepare: () => { events.push('dns-once'); return plan; }, persistNetworkPlan: (value) => { assert.equal(value, plan); events.push('persist-plan'); return { planSha256: hash(canonical(value)) }; }, tokenPipe: () => { events.push('token'); return Buffer.from('mutable'); }, send: ({ networkPlan }) => { assert.equal(networkPlan, plan); events.push('send'); return { ...dispatchReceipt, peer: { answerSetDigest: hash('1.1.1.1'), answers: ['1.1.1.1'], hostname: 'api.github.com', remoteAddress: '1.1.1.1', servername: 'api.github.com' } }; } });
  assert.deepEqual(events, ['persist-DISPATCH_INTENT', 'dns-once', 'persist-plan', 'token', 'send', 'persist-DISPATCH_ACCEPTED']);
});
