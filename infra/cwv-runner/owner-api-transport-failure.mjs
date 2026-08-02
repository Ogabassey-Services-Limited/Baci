// biome-ignore-all format: compact closed failure receipt validation stays below the repository limit
import { canonical, exact, fail, hash } from './owner-api-transport-primitives.mjs';

export const TRANSPORT_LOSS = 'RUNNER_TRANSPORT_LOST_BEFORE_ATTESTATION';
export const FAILED_TRANSPORT_JOB_STEP_NAMES = Object.freeze([
  'Validate sealed runner admission',
  'Create private authority scratch',
  'Checkout exact reviewed source',
  'Create read-only auditor token',
  'Verify authority and write projection',
  'Upload projected attestation',
  'Verify uploaded artifact metadata',
  'Download verified projected attestation',
  'Verify projected artifact readback',
  'Clean private state after platform token revocation registration',
]);
const JOB_KEYS = ['check_run_url', 'completed_at', 'conclusion', 'created_at', 'head_branch', 'head_sha', 'html_url', 'id', 'labels', 'name', 'node_id', 'run_attempt', 'run_id', 'run_url', 'runner_group_id', 'runner_group_name', 'runner_id', 'runner_name', 'started_at', 'status', 'steps', 'url', 'workflow_name'];
const RUNTIME_KEYS = ['actionNodeObserved', 'admissionId', 'attempt', 'daemonsOffline', 'findings', 'jobStartHookObserved', 'listenerExitKind', 'runId', 'runnerOffline', 'schemaVersion', 'stateGeneration', 'terminalProcessesSha256'];
const RESTORE_KEYS = ['admissionId', 'attempt', 'cleanupComplete', 'daemonsOffline', 'findings', 'networkAbsent', 'processes', 'restored', 'runId', 'runnerOffline', 'schemaVersion', 'stateGeneration', 'terminalProcessesSha256'];
const RECEIPT_KEYS = ['code', 'createdAt', 'jobsDigest', 'restoreDigest', 'rootRuntimeDigest', 'rootStateGeneration', 'runDigest', 'runId', 'attempt', 'schemaVersion', 'stateGeneration'];
const runProjection = (state) => ({ attempt: state.run.attempt, id: state.run.id });

function canonicalReceipt(bytes, digest, message) {
  if (!Buffer.isBuffer(bytes) || !/^[a-f0-9]{64}$/.test(digest) || hash(bytes) !== digest) fail(message);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(message); }
  if (bytes.toString('utf8') !== canonical(value)) fail(message);
  return value;
}

function sameBinding(state, value) {
  return value.schemaVersion === 1 && value.admissionId === state.admissionId && value.runId === state.run?.id && value.attempt === state.run?.attempt && value.stateGeneration === state.generation;
}

export function authenticatedRootFailureEvidence(state, input) {
  if (!exact(input, ['authenticated', 'channel', 'receivedMonotonicMs', 'restoreBytes', 'restoreSha256', 'runtimeBytes', 'runtimeSha256', 'transactionId']) || input.authenticated !== true || input.channel !== 'ssh-controller' || input.transactionId !== state.sourceAuthorization?.transactionId || !Number.isInteger(input.receivedMonotonicMs) || input.receivedMonotonicMs < state.createdMonotonicMs || input.receivedMonotonicMs > state.deadlineMonotonicMs || state.phase !== 'FAILED' || !state.postDispatchEvidence || !exact(state.runnerEvidence, ['boundStateGeneration', 'challengeNonce', 'holdDigest', 'pages', 'responseSha256', 'runnerId']) || !Number.isInteger(state.runnerEvidence.runnerId) || !Array.isArray(state.runnerEvidence.pages) || !state.runnerEvidence.pages.length || ![state.runnerEvidence.challengeNonce, state.runnerEvidence.holdDigest, state.runnerEvidence.responseSha256].every((value) => /^[a-f0-9]{64}$/.test(value)) || state.rerunUsed || state.rootFailureEvidence) fail('invalid authenticated root receipt');
  const runtime = canonicalReceipt(input.runtimeBytes, input.runtimeSha256, 'invalid authenticated root receipt');
  const restore = canonicalReceipt(input.restoreBytes, input.restoreSha256, 'invalid authenticated root receipt');
  if (!exact(runtime, RUNTIME_KEYS) || !sameBinding(state, runtime) || runtime.listenerExitKind !== 'transport-lost' || runtime.jobStartHookObserved !== false || runtime.actionNodeObserved !== false || runtime.runnerOffline !== true || runtime.daemonsOffline !== true || !Array.isArray(runtime.findings) || runtime.findings.length || !/^[a-f0-9]{64}$/.test(runtime.terminalProcessesSha256)) fail('invalid authenticated root receipt');
  if (!exact(restore, RESTORE_KEYS) || !sameBinding(state, restore) || restore.restored !== true || restore.cleanupComplete !== true || restore.runnerOffline !== true || restore.daemonsOffline !== true || restore.networkAbsent !== true || restore.terminalProcessesSha256 !== runtime.terminalProcessesSha256 || !Array.isArray(restore.processes) || restore.processes.length || !Array.isArray(restore.findings) || restore.findings.length) fail('invalid authenticated root receipt');
  return Object.freeze({ authenticatedChannel: input.channel, boundStateGeneration: state.generation, receivedMonotonicMs: input.receivedMonotonicMs, restoreDigest: input.restoreSha256, rootRuntimeDigest: input.runtimeSha256 });
}

function exactStep(step, index) {
  if (!exact(step, ['completed_at', 'conclusion', 'name', 'number', 'started_at', 'status']) || step.name !== FAILED_TRANSPORT_JOB_STEP_NAMES[index] || step.number !== index + 1 || step.status !== 'queued' || step.started_at !== null || step.completed_at !== null || step.conclusion !== null) fail('invalid failed job evidence');
}

function exactFailedJob(state, job) {
  if (!exact(job, JOB_KEYS) || job.id < 1 || !Number.isInteger(job.id) || job.run_id !== state.run.id || job.run_attempt !== state.run.attempt || job.name !== 'attest' || job.status !== 'completed' || job.conclusion !== 'failure' || job.head_branch !== 'main' || job.head_sha !== state.expectedSha || job.runner_id !== state.runnerEvidence?.runnerId || job.runner_name !== 'baci-cwv-measurement-01' || canonical(job.labels) !== canonical(['self-hosted', 'baci-cwv-measurement']) || !Array.isArray(job.steps) || job.steps.length !== FAILED_TRANSPORT_JOB_STEP_NAMES.length || !Number.isFinite(Date.parse(job.created_at)) || !Number.isFinite(Date.parse(job.started_at)) || !Number.isFinite(Date.parse(job.completed_at)) || Date.parse(job.created_at) > Date.parse(job.started_at) || Date.parse(job.started_at) > Date.parse(job.completed_at) || job.run_url !== `https://api.github.com/repos/${state.repository.name}/actions/runs/${state.run.id}` || job.url !== `https://api.github.com/repos/${state.repository.name}/actions/jobs/${job.id}` || job.html_url !== `https://github.com/${state.repository.name}/actions/runs/${state.run.id}/job/${job.id}` || typeof job.node_id !== 'string' || !job.node_id || !Number.isInteger(job.runner_group_id) || typeof job.runner_group_name !== 'string' || typeof job.workflow_name !== 'string' || job.check_run_url !== `https://api.github.com/repos/${state.repository.name}/check-runs/${job.id}`) fail('invalid failed job evidence');
  job.steps.forEach(exactStep);
  return job;
}

export function failedTransportReceipt(state, body, proofs = []) {
  if (state.phase !== 'FAILED' || state.rerunUsed || state.failureEvidence || !state.rootFailureEvidence || !exact(body, ['jobs', 'total_count']) || body.total_count !== 1 || !Array.isArray(body.jobs) || body.jobs.length !== 1) fail('invalid failed job evidence');
  const job = exactFailedJob(state, body.jobs[0]);
  return Object.freeze({ attempt: state.run.attempt, code: TRANSPORT_LOSS, createdAt: job.completed_at, jobsDigest: hash(canonical({ body, proofs })), restoreDigest: state.rootFailureEvidence.restoreDigest, rootRuntimeDigest: state.rootFailureEvidence.rootRuntimeDigest, rootStateGeneration: state.rootFailureEvidence.boundStateGeneration, runDigest: hash(canonical(runProjection(state))), runId: state.run.id, schemaVersion: 1, stateGeneration: state.generation });
}

export function validateTransportLossReceipt(state) {
  const receipt = state.failureEvidence;
  if (!exact(receipt, RECEIPT_KEYS) || receipt.schemaVersion !== 1 || receipt.code !== TRANSPORT_LOSS || receipt.runId !== state.run?.id || receipt.attempt !== state.run?.attempt || receipt.stateGeneration !== state.generation - 1 || receipt.rootStateGeneration + 1 !== receipt.stateGeneration || receipt.rootStateGeneration !== state.rootFailureEvidence?.boundStateGeneration || receipt.runDigest !== hash(canonical(runProjection(state))) || receipt.rootRuntimeDigest !== state.rootFailureEvidence?.rootRuntimeDigest || receipt.restoreDigest !== state.rootFailureEvidence?.restoreDigest || !/^[a-f0-9]{64}$/.test(receipt.jobsDigest) || !Number.isFinite(Date.parse(receipt.createdAt))) fail('invalid rerun');
  return receipt;
}
