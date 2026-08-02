// biome-ignore-all format: compact finite-state transport stays below the repository file limit
import { appendRunPage, boundRunEvidence, dispatchReconciliationPatch, dispatchRunEvidence, postDispatchEvidence, preDispatchEvidence } from './owner-api-transport-evidence.mjs';
import { authenticatedRootFailureEvidence, failedTransportReceipt, validateTransportLossReceipt } from './owner-api-transport-failure.mjs';
import { authenticatedRunnerHold, validateRunnerHoldResponse } from './owner-api-transport-hold.mjs';
import { appendRunnerPage, artifactEvidence, completeRunnerPages, exactJobEvidence, runnerEvidence } from './owner-api-transport-operation-evidence.mjs';
import { appendCollectionPage } from './owner-api-transport-pagination.mjs';
import { ARTIFACT_MEMBER, assertState, canonical, exact, fail, hash, REPOSITORY, WORKFLOW_PATH } from './owner-api-transport-primitives.mjs';
import { OPERATIONS, requestFor } from './owner-api-transport-requests.mjs';
import { deriveRunnerIdentitySha256, validatePinnedPeer } from './owner-api-transport-security.mjs';
import { sourceFileDigest, TRANSPORT_ENTRY } from './owner-api-transport-source.mjs';

export { completeRunPages } from './owner-api-transport-evidence.mjs'; export { completeRunnerPages } from './owner-api-transport-operation-evidence.mjs';
export { ARTIFACT_MEMBER } from './owner-api-transport-primitives.mjs'; export { OPERATIONS, requestFor } from './owner-api-transport-requests.mjs'; export { createArtifactDownloadPlan, createPinnedApiPlan, validateArtifactReadback, validateArtifactRedirect, validatePinnedPeer } from './owner-api-transport-security.mjs';

const ACTIVE = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']); const CLEANUP_GRACE_MS = 30000;
function bindingFrom(source) {
  if (!exact(source, ['generation', 'operationSet', 'operationSetDigest', 'policyFileSha256', 'provenance', 'purpose', 'schemaVersion', 'sourceBinding', 'sourceFiles', 'transactionId']) || source.schemaVersion !== 1 || source.purpose !== 'task9-exact-run' || canonical(source.operationSet) !== canonical(OPERATIONS) || source.operationSetDigest !== hash(canonical(OPERATIONS)) || !Number.isInteger(source.generation) || source.generation < 0 || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(source.transactionId) || !/^[a-f0-9]{64}$/.test(source.policyFileSha256)) fail('invalid authorization');
  if (!exact(source.provenance, ['manifestSha256', 'nodeProvenanceSha256', 'runtimeSha256', 'sourceArchiveSha256']) || !Object.values(source.provenance).every((value) => /^[a-f0-9]{64}$/.test(value))) fail('invalid authorization');
  const binding = source.sourceBinding;
  if (
    !exact(binding, ['base', 'deploymentSha', 'exactRun', 'mergeSha', 'pullRequest', 'ref', 'repository', 'reviewedSha']) ||
    !exact(binding.repository, ['id', 'name']) ||
    !exact(binding.base, ['ref', 'sha']) || !exact(binding.pullRequest, ['headRef', 'number']) ||
    !exact(binding.exactRun, ['admissionId', 'workflow']) || !exact(binding.exactRun.workflow, ['id', 'path', 'ref']) ||
    binding.repository.id !== REPOSITORY.id ||
    binding.repository.name !== REPOSITORY.name ||
    !Number.isInteger(binding.exactRun.workflow.id) || binding.exactRun.workflow.id < 1 ||
    binding.exactRun.workflow.path !== WORKFLOW_PATH || binding.exactRun.workflow.ref !== 'refs/heads/main' ||
    ![binding.base.sha, binding.reviewedSha, binding.mergeSha, binding.deploymentSha].every((value) => /^[a-f0-9]{40}$/.test(value)) ||
    !/^[a-f0-9]{64}$/.test(binding.exactRun.admissionId)
  )
    fail('invalid authorization');
  return { admissionId: binding.exactRun.admissionId, expectedSha: binding.deploymentSha, repository: binding.repository, transportSha256: sourceFileDigest(source, TRANSPORT_ENTRY), workflow: binding.exactRun.workflow };
}
function authorizationFrom(input) {
  const bytes = input?.sourceAuthorizationBytes;
  if (!Buffer.isBuffer(bytes) || !/^[a-f0-9]{64}$/.test(input?.sourceAuthorizationSha256) || hash(bytes) !== input.sourceAuthorizationSha256) fail('invalid authorization');
  let source;
  try { source = JSON.parse(bytes.toString('utf8')); } catch { fail('invalid authorization'); }
  if (canonical(source) !== bytes.toString('utf8')) fail('invalid authorization');
  return { source, binding: bindingFrom(source) };
}
function seal(state) {
  const { stateDigest: _ignored, ...unsigned } = state;
  return Object.freeze({ ...unsigned, stateDigest: hash(canonical(unsigned)) });
}
function next(state, patch) {
  assertState(state);
  const merged = { ...state, ...patch };
  for (const [key, value] of Object.entries(patch)) if (value === undefined) delete merged[key];
  return seal({ ...merged, generation: state.generation + 1 });
}
function collecting(state, operation, page) {
  return { pageCollections: { ...(state.pageCollections ?? {}), [operation]: page.pages }, pageCursors: { ...(state.pageCursors ?? {}), [operation]: page.cursor }, pageProofs: { ...(state.pageProofs ?? {}), [operation]: page.proofs } };
}
function clearPages(state, operation) {
  const pageCollections = { ...(state.pageCollections ?? {}) }; const pageCursors = { ...(state.pageCursors ?? {}) }; const pageProofs = { ...(state.pageProofs ?? {}) };
  delete pageCollections[operation]; delete pageCursors[operation]; delete pageProofs[operation];
  return { pageCollections: Object.keys(pageCollections).length ? pageCollections : undefined, pageCursors: Object.keys(pageCursors).length ? pageCursors : undefined, pageProofs: Object.keys(pageProofs).length ? pageProofs : undefined };
}
function observedRun(state, run, attempt) { const { queuedSinceMonotonicMs: _queued, ...bound } = state.run; return { ...bound, actor: run.actor, admissionId: state.admissionId, attempt, conclusion: run.conclusion, displayTitle: run.title, event: run.event, status: run.status, ...(ACTIVE.has(run.status) ? { queuedSinceMonotonicMs: state.run.queuedSinceMonotonicMs ?? state.createdMonotonicMs } : {}) }; }
export function createOwnerState(input) {
  const { sourceAuthorization: source, binding } = (() => { const value = authorizationFrom(input); return { sourceAuthorization: value.source, binding: value.binding }; })();
  if (!exact(input?.digests, ['manifest', 'policy', 'runtime', 'transport']) || ![input.createdMonotonicMs, input.deadlineMonotonicMs, input.createdWallClockMs].every(Number.isInteger) || input.createdWallClockMs < 0 || input.deadlineMonotonicMs - input.createdMonotonicMs !== 1200000 || Object.values(input.digests).some((value) => !/^[a-f0-9]{64}$/.test(value)) || input.digests.policy !== source.policyFileSha256 || input.digests.manifest !== source.provenance.manifestSha256 || input.digests.runtime !== source.provenance.runtimeSha256 || input.digests.transport !== binding.transportSha256)
    fail('invalid state');
  return seal({
    sourceAuthorization: source,
    sourceAuthorizationSha256: input.sourceAuthorizationSha256,
    repository: binding.repository,
    workflow: binding.workflow,
    expectedSha: binding.expectedSha,
    admissionId: binding.admissionId,
    digests: input.digests,
    createdMonotonicMs: input.createdMonotonicMs,
    createdWallClockMs: input.createdWallClockMs,
    deadlineMonotonicMs: input.deadlineMonotonicMs,
    generation: 0,
    phase: 'READY',
    rerunUsed: false,
  });
}
export function beginOperation(state, operation, nowMonotonicMs = state.createdMonotonicMs, nowWallClockMs = state.createdWallClockMs) {
  requestFor(state, operation);
  if (operation === 'cancel-exact-run') {
    const operationalDeadlineMonotonicMs = state.operationalDeadlineMonotonicMs ?? state.deadlineMonotonicMs; const cleanupDeadlineMonotonicMs = state.cleanupDeadlineMonotonicMs ?? operationalDeadlineMonotonicMs + CLEANUP_GRACE_MS;
    if (!['DISPATCH_ACCEPTED', 'QUEUED', 'RUNNING', 'RERUN_INTENT', 'RERUN_REQUESTED'].includes(state.phase)) fail('ambiguous cancellation');
    if (state.queueDeadlineMonotonicMs !== undefined && state.queueTimerAttempt !== (state.phase === 'RERUN_REQUESTED' ? state.expectedAttempt : state.run?.attempt)) fail('queue timer');
    if (!Number.isInteger(nowMonotonicMs) || nowMonotonicMs < state.createdMonotonicMs || nowMonotonicMs > cleanupDeadlineMonotonicMs || !Number.isInteger(nowWallClockMs) || nowWallClockMs < state.createdWallClockMs) fail('cleanup deadline');
    const attempts = ['RERUN_INTENT', 'RERUN_REQUESTED'].includes(state.phase) ? [state.run.attempt, state.run.attempt + 1] : [state.run.attempt];
    return next(state, { cancelIntent: { attempts, createdMonotonicMs: nowMonotonicMs, requestSha256: hash(canonical(requestFor(state, operation))), runId: state.run.id }, cleanupDeadlineMonotonicMs, deadlineMonotonicMs: cleanupDeadlineMonotonicMs, operationalDeadlineMonotonicMs, phase: 'CANCEL_INTENT' });
  }
  if (operation === 'read-exact-run' && state.phase === 'CANCEL_ACCEPTED') {
    if (state.cancelReadIntent || !Number.isInteger(nowMonotonicMs) || nowMonotonicMs < state.cancelAcceptedEvidence.acceptedMonotonicMs || nowMonotonicMs > state.cleanupDeadlineMonotonicMs || !Number.isInteger(nowWallClockMs) || nowWallClockMs < state.createdWallClockMs) fail('cleanup deadline');
    if (!state.cancelAcceptedEvidence.attempts.includes(state.queueTimerAttempt)) fail('queue timer');
    return next(state, { cancelReadIntent: { createdMonotonicMs: nowMonotonicMs } });
  }
  checkQueueTimer(state, nowMonotonicMs);
  if (!Number.isInteger(nowMonotonicMs) || nowMonotonicMs < state.createdMonotonicMs || nowMonotonicMs > state.deadlineMonotonicMs || !Number.isInteger(nowWallClockMs) || nowWallClockMs < state.createdWallClockMs) fail('overall deadline');
  if (operation === 'dispatch-exact-run') {
    if (state.phase !== 'QUIESCENT' || state.preDispatchEvidence?.zeroActiveExactRuns !== true) fail('ambiguous dispatch');
    return next(state, { dispatchIntent: { admissionId: state.admissionId, createdMonotonicMs: nowMonotonicMs, createdWallClockMs: nowWallClockMs, reconcileDeadlineMonotonicMs: nowMonotonicMs + 120000, requestSha256: hash(canonical(requestFor(state, operation))) }, phase: 'DISPATCH_INTENT' });
  }
  if (operation === 'rerun-failed-exact-run') {
    if (state.phase !== 'FAILED_EVIDENCE' || state.rerunUsed || state.run?.conclusion !== 'failure') fail('invalid rerun');
    validateTransportLossReceipt(state);
    return next(state, { phase: 'RERUN_INTENT', rerunIntent: { createdMonotonicMs: nowMonotonicMs, requestSha256: hash(canonical(requestFor(state, operation))) } });
  }
  return state;
}
export function bindAuthenticatedRootReceipts(state, input) {
  assertState(state);
  return next(state, { rootFailureEvidence: authenticatedRootFailureEvidence(state, input) });
}
export function bindRunnerInventoryHold(state, input) {
  assertState(state);
  return next(state, { runnerInventoryHold: authenticatedRunnerHold(state, input) });
}
export function bindArtifactReadback(state, input) {
  assertState(state);
  if (state.phase !== 'ARTIFACT_BOUND' || !Buffer.isBuffer(input?.archiveBytes) || !Buffer.isBuffer(input?.memberBytes) || !exact(input?.readback, ['artifact', 'public']) || canonical(input.readback.artifact) !== canonical(state.artifact) || input.memberBytes.toString('utf8') !== canonical(input.readback.public) || input.readback.public?.workflow?.headSha !== state.expectedSha || !/^[a-f0-9]{64}$/.test(input.readback.public?.digests?.restoreSha256)) fail('invalid artifact readback'); const runnerIdentitySha256 = deriveRunnerIdentitySha256(input.readback.public);
  const core = { archiveSha256: hash(input.archiveBytes), artifactMetadataSha256: hash(canonical(state.artifact)), memberName: ARTIFACT_MEMBER, memberSha256: hash(input.memberBytes), memberSizeBytes: input.memberBytes.length, stateBeforeFileSha256: hash(canonical(state)), stateBeforeGeneration: state.generation, stateBeforeSha256: state.stateDigest };
  const ownerEvidenceHandoff = { admissionId: state.admissionId, archiveSha256: core.archiveSha256, artifactId: state.artifact.id, artifactMetadataSha256: core.artifactMetadataSha256, artifactName: state.artifact.name, attempt: state.run.attempt, canonicalMember: input.memberBytes.toString('utf8'), expectedSha: state.expectedSha, hostRestoreSha256: input.readback.public.digests.restoreSha256, memberName: ARTIFACT_MEMBER, memberSha256: core.memberSha256, publicArtifactSha256: core.memberSha256, runId: state.run.id, runnerIdentitySha256, schemaVersion: 1, sourceAuthorizationSha256: state.sourceAuthorizationSha256, stateBeforeFileSha256: core.stateBeforeFileSha256, stateBeforeGeneration: state.generation, stateBeforeSha256: state.stateDigest, terminalGeneration: state.generation + 1 };
  const evidence = { ...core, ownerHandoffSha256: hash(canonical(ownerEvidenceHandoff)) };
  return next(state, { artifactReadbackEvidence: evidence, ownerEvidenceHandoff, phase: 'EVIDENCE_VERIFIED' });
}
export async function completeArtifactReadback(state, input, write) {
  const following = bindArtifactReadback(state, input);
  await persist(state, following, write);
  return following;
}
export function consumeResponse(state, operation, response) {
  assertState(state);
  const body = response?.body;
  if (operation === 'dispatch-exact-run') {
    if (
      state.phase !== 'DISPATCH_INTENT' ||
      response.status !== 200 ||
      !Number.isInteger(response.receivedMonotonicMs) ||
      response.receivedMonotonicMs < state.dispatchIntent.createdMonotonicMs
    )
      fail('invalid dispatch response');
    const evidence = dispatchRunEvidence(state, body);
    return next(state, {
      dispatchEvidence: evidence,
      phase: 'DISPATCH_ACCEPTED',
      run: {
        attempt: 1,
        htmlUrl: evidence.htmlUrl,
        id: evidence.id,
        queuedSinceMonotonicMs: response.receivedMonotonicMs,
        runUrl: evidence.runUrl,
      },
      queueDeadlineMonotonicMs: response.receivedMonotonicMs + 120000,
      queueTimerAttempt: 1,
    });
  }
  if (operation === 'rerun-failed-exact-run') {
    if (state.phase !== 'RERUN_INTENT' || response.status !== 201 || body !== undefined || !Number.isInteger(response.receivedMonotonicMs) || response.receivedMonotonicMs < state.rerunIntent.createdMonotonicMs) fail('invalid rerun');
    return next(state, {
      expectedAttempt: state.run.attempt + 1,
      postDispatchEvidence: undefined,
      phase: 'RERUN_REQUESTED',
      queueDeadlineMonotonicMs: response.receivedMonotonicMs + 120000,
      queueTimerAttempt: state.run.attempt + 1,
      rerunUsed: true,
      rerunIntent: undefined,
      runnerEvidence: undefined,
      runnerInventoryAttempt: undefined,
      runnerInventoryHold: undefined,
      run: {
        ...state.run,
        queuedSinceMonotonicMs: response.receivedMonotonicMs,
      },
    });
  }
  if (operation === 'cancel-exact-run') {
    if (state.phase !== 'CANCEL_INTENT' || response.status !== 202 || body !== undefined || !Number.isInteger(response.receivedMonotonicMs) || response.receivedMonotonicMs < state.cancelIntent.createdMonotonicMs || response.receivedMonotonicMs > state.cleanupDeadlineMonotonicMs) fail('invalid cancellation');
    return next(state, { cancelAcceptedEvidence: { acceptedMonotonicMs: response.receivedMonotonicMs, attempts: state.cancelIntent.attempts, runId: state.run.id, status: 202 }, phase: 'CANCEL_ACCEPTED' });
  }
  if (operation === 'read-exact-run') {
    if (response.status !== 200 || !['CANCEL_ACCEPTED', 'QUEUED', 'RUNNING', 'RERUN_REQUESTED', 'FAILED'].includes(state.phase)) fail('unexpected response');
    if (state.phase === 'CANCEL_ACCEPTED') {
      if (!Number.isInteger(state.cancelReadIntent?.createdMonotonicMs) || !Number.isInteger(response.receivedMonotonicMs) || response.receivedMonotonicMs < state.cancelReadIntent.createdMonotonicMs || response.receivedMonotonicMs < state.cancelAcceptedEvidence.acceptedMonotonicMs || response.receivedMonotonicMs > state.cleanupDeadlineMonotonicMs || !state.cancelAcceptedEvidence.attempts.includes(body?.run_attempt)) fail('invalid cancellation evidence');
      const run = boundRunEvidence({ ...state, run: { ...state.run, attempt: body.run_attempt } }, body); const pollCount = (state.cancelPollEvidence?.pollCount ?? 0) + 1; const observation = { attempt: body.run_attempt, conclusion: run.conclusion, pollCount, receivedMonotonicMs: response.receivedMonotonicMs, responseSha256: hash(canonical(body)), status: run.status };
      if (run.status === 'completed' && run.conclusion === 'cancelled') return next(state, { cancelObservedEvidence: observation, cancelPollEvidence: observation, cancelReadIntent: undefined, phase: 'CANCELED', run: observedRun(state, run, body.run_attempt) });
      return next(state, { cancelPollEvidence: observation, cancelReadIntent: undefined, run: observedRun(state, run, body.run_attempt) });
    }
    if (state.phase === 'RERUN_REQUESTED' && body?.run_attempt === state.run?.attempt) {
      const prior = boundRunEvidence(state, body); if (prior.status !== 'completed' || prior.conclusion !== 'failure') fail('invalid rerun visibility');
      const pollCount = (state.rerunVisibility?.pollCount ?? 0) + 1; if (pollCount > 120) fail('rerun visibility deadline');
      return next(state, { rerunVisibility: { pollCount, responseSha256: hash(canonical(body)) } });
    }
    const expectedAttempt = state.phase === 'RERUN_REQUESTED' ? state.expectedAttempt : state.run?.attempt;
    const run = boundRunEvidence({ ...state, run: { ...state.run, attempt: expectedAttempt } }, body);
    const phase = run.status === 'in_progress' ? 'RUNNING' : ACTIVE.has(run.status) ? 'QUEUED' : run.conclusion === 'success' ? 'COMPLETED' : run.conclusion === 'failure' ? 'FAILED' : run.conclusion === 'cancelled' ? 'CANCELED' : fail('invalid run response');
    return next(state, {
      expectedAttempt: state.phase === 'RERUN_REQUESTED' ? undefined : state.expectedAttempt,
      phase,
      rerunVisibility: undefined,
      run: observedRun(state, run, expectedAttempt),
    });
  }
  if (operation === 'list-attestation-runs') {
    if (response.status !== 200 || !['READY', 'DISPATCH_INTENT', 'DISPATCH_INDETERMINATE', 'DISPATCH_ACCEPTED', 'QUEUED', 'RUNNING'].includes(state.phase)) fail('invalid run evidence');
    const collected = appendRunPage(state, response);
    if (!collected.complete) return next(state, collecting(state, operation, collected));
    const clear = clearPages(state, operation);
    if (['DISPATCH_INTENT', 'DISPATCH_INDETERMINATE'].includes(state.phase)) return next(state, { ...clear, ...dispatchReconciliationPatch(state, collected.body, response.receivedMonotonicMs, collected.proofs) });
    if (state.phase === 'READY') return next(state, { ...clear, phase: 'QUIESCENT', preDispatchEvidence: preDispatchEvidence(state, collected.body, collected.proofs) });
    if (['DISPATCH_ACCEPTED', 'QUEUED', 'RUNNING'].includes(state.phase)) {
      const reconciliation = postDispatchEvidence(state, collected.body, collected.proofs); if (!reconciliation) return next(state, clear);
      return next(state, { ...clear, phase: state.phase === 'DISPATCH_ACCEPTED' ? 'QUEUED' : state.phase, postDispatchEvidence: reconciliation, run: { ...reconciliation.run, queuedSinceMonotonicMs: state.run.queuedSinceMonotonicMs } });
    }
    fail('invalid run evidence');
  }
  if (operation === 'list-exact-artifacts') {
    if (response.status !== 200 || state.phase !== 'JOB_BOUND') fail('invalid artifact metadata');
    const collected = appendCollectionPage(state, operation, response, 'artifacts');
    if (!collected.complete) return next(state, collecting(state, operation, collected));
    return next(state, { ...clearPages(state, operation), ...artifactEvidence(state, collected.body, collected.proofs), phase: 'ARTIFACT_BOUND' });
  }
  if (operation === 'list-runner-inventory') {
    if (response.status !== 200) fail('invalid runner inventory');
    const hold = validateRunnerHoldResponse(state, response);
    const collected = appendRunnerPage(state, response);
    if (!collected.complete) return next(state, collecting(state, operation, collected));
    return next(state, { ...clearPages(state, operation), runnerEvidence: runnerEvidence(completeRunnerPages(collected.pages), collected.proofs, hold), runnerInventoryAttempt: state.run.attempt, runnerInventoryHold: undefined });
  }
  if (operation === 'read-failed-job-evidence') {
    if (response.status !== 200 || state.phase !== 'FAILED' || state.run?.conclusion !== 'failure') fail('invalid failed job evidence');
    const collected = appendCollectionPage(state, operation, response, 'jobs');
    if (!collected.complete) return next(state, collecting(state, operation, collected));
    return next(state, { ...clearPages(state, operation), failureEvidence: failedTransportReceipt(state, collected.body, collected.proofs), phase: 'FAILED_EVIDENCE' });
  }
  if (operation === 'read-exact-job') {
    if (response.status !== 200 || state.phase !== 'COMPLETED') fail('invalid job evidence');
    const collected = appendCollectionPage(state, operation, response, 'jobs');
    if (!collected.complete) return next(state, collecting(state, operation, collected));
    const evidence = exactJobEvidence(state, collected.body, collected.proofs);
    return next(state, { ...clearPages(state, operation), jobEvidence: evidence, jobId: evidence.jobId, phase: 'JOB_BOUND' });
  }
  if (response.status < 200 || response.status > 299) fail('unexpected response');
  return next(state, {});
}
async function persist(previous, following, write) {
  if (typeof write !== 'function') fail('missing atomic persistence');
  const receipt = await write(previous, following);
  if (!exact(receipt, ['generation', 'stateDigest']) || receipt.generation !== following.generation || receipt.stateDigest !== following.stateDigest) fail('invalid persistence receipt');
}
export async function executeApiRequest({ networkPlan, onSendInitiated, request, state, tokenPipe, send }) {
  if (typeof tokenPipe !== 'function' || typeof send !== 'function') fail('invalid transport');
  let token = await tokenPipe();
  if (!Buffer.isBuffer(token) || token.length === 0) fail('invalid token pipe');
  try {
    onSendInitiated?.();
    const response = await send({ networkPlan, request, token, state });
    validatePinnedPeer(response?.peer);
    return response;
  } finally {
    token.fill(0); token = undefined;
  }
}
export async function executeApiOperation({ state, operation, tokenPipe, send, persist: write, prepare, persistNetworkPlan, nowMonotonicMs = state.createdMonotonicMs, nowWallClockMs = state.createdWallClockMs }) {
  const request = requestFor(state, operation);
  const intent = beginOperation(state, operation, nowMonotonicMs, nowWallClockMs);
  if (intent !== state) await persist(state, intent, write);
  let sendInitiated = false;
  try {
    let networkPlan;
    if (prepare) {
      if (typeof persistNetworkPlan !== 'function') fail('missing network plan persistence');
      networkPlan = await prepare(intent, request);
      const receipt = await persistNetworkPlan(networkPlan);
      if (!exact(receipt, ['planSha256']) || receipt.planSha256 !== hash(canonical(networkPlan))) fail('invalid network plan persistence');
    }
    const response = await executeApiRequest({ networkPlan, onSendInitiated: () => { sendInitiated = true; }, request, state: intent, tokenPipe, send });
    const following = consumeResponse(intent, operation, response);
    await persist(intent, following, write);
    return following;
  } catch (error) {
    if (sendInitiated && operation === 'dispatch-exact-run' && intent.phase === 'DISPATCH_INTENT') {
      const indeterminate = next(intent, { phase: 'DISPATCH_INDETERMINATE' });
      await persist(intent, indeterminate, write);
    }
    throw error;
  }
}
export function checkQueueTimer(state, nowMonotonicMs) {
  assertState(state);
  if (!Number.isInteger(nowMonotonicMs) || nowMonotonicMs > state.deadlineMonotonicMs) fail('overall deadline');
  const attempt = state.phase === 'RERUN_REQUESTED' ? state.expectedAttempt : state.run?.attempt;
  if (state.queueDeadlineMonotonicMs !== undefined && (!Number.isInteger(state.queueTimerAttempt) || state.queueTimerAttempt !== attempt)) fail('queue timer');
  if (state.queueDeadlineMonotonicMs !== undefined && !(state.runnerEvidence && state.runnerInventoryAttempt === state.queueTimerAttempt) && nowMonotonicMs > state.queueDeadlineMonotonicMs) fail('queue deadline');
  return true;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  void import('./owner-api-transport-runtime.mjs').then(({ runTransportCli }) => runTransportCli(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`owner transport refused: ${error instanceof Error ? error.message : 'invalid invocation'}\n`); process.exitCode = 1;
  });
}
