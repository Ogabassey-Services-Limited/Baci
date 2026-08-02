// biome-ignore-all format: closed owner projections remain below the repository file limit

import { readFileSync } from 'node:fs';

import { readSealedState } from './owner-api-transport-cli-state.mjs';
import { TRANSPORT_LOSS } from './owner-api-transport-failure.mjs';
import { assertState, canonical, exact, fail, hash, REPOSITORY, WORKFLOW_PATH } from './owner-api-transport-primitives.mjs';

const ACTIVE = new Set(['pending', 'queued', 'requested', 'waiting', 'in_progress']);
const LABELS = ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'];
const JOB = 'attest';
const FAILURE_KEYS = ['attempt', 'code', 'createdAt', 'jobsDigest', 'restoreDigest', 'rootRuntimeDigest', 'rootStateGeneration', 'runDigest', 'runId', 'schemaVersion', 'stateGeneration'];
const campaign = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(value);
const hex = (value, length = 64) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const integer = (value) => Number.isInteger(value) && value >= 0;

function sealed(state) {
  assertState(state);
  const source = state.sourceAuthorization;
  if (!exact(source, ['generation', 'operationSet', 'operationSetDigest', 'policyFileSha256', 'provenance', 'purpose', 'schemaVersion', 'sourceBinding', 'sourceFiles', 'transactionId']) || state.sourceAuthorizationSha256 !== hash(canonical(source)) || source.policyFileSha256 !== state.digests?.policy || !campaign(source.transactionId)) fail('invalid sealed state');
  const binding = source.sourceBinding;
  if (!exact(binding, ['base', 'deploymentSha', 'exactRun', 'mergeSha', 'pullRequest', 'ref', 'repository', 'reviewedSha']) || !exact(binding.exactRun, ['admissionId', 'workflow']) || !exact(binding.exactRun.workflow, ['id', 'path', 'ref']) || binding.repository?.id !== REPOSITORY.id || binding.repository?.name !== REPOSITORY.name || binding.deploymentSha !== state.expectedSha || binding.exactRun.admissionId !== state.admissionId || binding.exactRun.workflow.id !== state.workflow?.id || binding.exactRun.workflow.path !== WORKFLOW_PATH || binding.exactRun.workflow.ref !== 'refs/heads/main') fail('invalid sealed state');
  if (!['QUEUED', 'RUNNING'].includes(state.phase) || !integer(state.createdWallClockMs) || !hex(state.admissionId) || !hex(state.expectedSha, 40)) fail('invalid sealed state');
  return { campaignId: source.transactionId, state };
}

function runFrom(state) {
  const { queuedSinceMonotonicMs: _queued, ...run } = state.run ?? {};
  if (!exact(run, ['actor', 'admissionId', 'attempt', 'displayTitle', 'event', 'htmlUrl', 'id', 'runUrl', 'status']) || run.actor !== 'ogabasseyy' || run.admissionId !== state.admissionId || ![1, 2].includes(run.attempt) || (run.attempt === 2) !== (state.rerunUsed === true) || run.displayTitle !== `CWV Runner Attestation ${state.admissionId}` || run.event !== 'workflow_dispatch' || !integer(run.id) || run.id < 1 || !ACTIVE.has(run.status) || run.runUrl !== `https://api.github.com/repos/${state.repository.name}/actions/runs/${run.id}` || run.htmlUrl !== `https://github.com/${state.repository.name}/actions/runs/${run.id}`) fail('invalid reconciled run');
  if (!exact(state.postDispatchEvidence, ['responseSha256', 'run', 'stateGeneration']) || !hex(state.postDispatchEvidence.responseSha256) || !integer(state.postDispatchEvidence.stateGeneration) || state.postDispatchEvidence.stateGeneration >= state.generation || canonical(state.postDispatchEvidence.run) !== canonical(run)) fail('invalid reconciled run');
  return run;
}

export function beginBindingFrom(state) {
  const { campaignId } = sealed(state); const run = runFrom(state);
  return Object.freeze({ admissionId: state.admissionId, campaignId, expectedSha: state.expectedSha, policyFileSha256: state.digests.policy, repository: state.repository, run: { attempt: run.attempt, id: run.id }, workflow: { id: state.workflow.id, job: JOB, path: state.workflow.path, ref: state.workflow.ref } });
}

export function rearmDocumentFrom(state, ownerStateSha256) {
  const binding = beginBindingFrom(state); const evidence = state.failureEvidence;
  if (binding.run.attempt !== 2 || state.rerunUsed !== true || !hex(ownerStateSha256) || !exact(evidence, FAILURE_KEYS) || evidence.schemaVersion !== 1 || evidence.code !== TRANSPORT_LOSS || evidence.attempt !== 1 || evidence.runId !== binding.run.id || !integer(evidence.rootStateGeneration) || !integer(evidence.stateGeneration) || evidence.rootStateGeneration + 1 !== evidence.stateGeneration || evidence.stateGeneration >= state.generation || !Number.isFinite(Date.parse(evidence.createdAt)) || ![evidence.jobsDigest, evidence.restoreDigest, evidence.rootRuntimeDigest, evidence.runDigest].every((value) => hex(value))) fail('invalid rearm');
  return Object.freeze({ binding, failureEvidence: evidence, ownerStateSha256, schemaVersion: 1, stateGeneration: state.generation });
}

function exactChallenge(binding, challenge, kind) {
  const ttl = kind === 'admission' ? 30 : 5;
  if (!exact(challenge, ['bindingDigest', 'campaignId', 'createdMonotonicSeconds', 'deadlineMonotonicSeconds', 'kind', 'nonce', 'schemaVersion']) || challenge.schemaVersion !== 1 || challenge.kind !== kind || challenge.bindingDigest !== hash(canonical(binding)) || challenge.campaignId !== binding.campaignId || !hex(challenge.nonce) || !integer(challenge.createdMonotonicSeconds) || challenge.deadlineMonotonicSeconds !== challenge.createdMonotonicSeconds + ttl) fail('invalid root challenge');
  return challenge;
}

export function admissionDocumentFrom(state, challenge) {
  const binding = beginBindingFrom(state); const run = runFrom(state); exactChallenge(binding, challenge, 'admission');
  return Object.freeze({ admissionId: binding.admissionId, campaignId: binding.campaignId, challengeNonce: challenge.nonce, kind: 'admission', ownerAudit: { capturedAt: new Date(state.createdWallClockMs).toISOString() }, policyFileSha256: binding.policyFileSha256, reconciliation: { activeRunCount: 1, digest: state.postDispatchEvidence.responseSha256, stateGeneration: state.generation }, repository: binding.repository, run: { actor: run.actor, admissionId: run.admissionId, attempt: run.attempt, displayTitle: run.displayTitle, event: run.event, id: run.id, status: run.status }, schemaVersion: 1, workflow: { headSha: binding.expectedSha, ...binding.workflow } });
}

function runner(row) {
  if (!exact(row, ['architecture', 'busy', 'id', 'labels', 'name', 'os', 'status']) || !['X64', 'ARM64', 'ARM'].includes(row.architecture) || typeof row.busy !== 'boolean' || !integer(row.id) || row.id < 1 || !/^[A-Za-z0-9_.-]{1,128}$/.test(row.name) || !/^[a-z0-9_-]{1,32}$/.test(row.os) || !['online', 'offline'].includes(row.status) || !Array.isArray(row.labels) || !row.labels.length || new Set(row.labels).size !== row.labels.length || !row.labels.includes(row.architecture)) fail('invalid runner inventory');
  if (row.labels.includes('baci-cwv-measurement') && (row.name !== 'baci-cwv-measurement-01' || row.os !== 'linux' || canonical(row.labels) !== canonical(LABELS))) fail('invalid runner inventory');
  return row;
}

function inventoryPages(evidence, hold) {
  if (!exact(evidence, ['boundStateGeneration', 'challengeNonce', 'holdDigest', 'pages', 'responseSha256', 'runnerId']) || evidence.challengeNonce !== hold.challenge.nonce || evidence.holdDigest !== hold.holdDigest || !integer(evidence.boundStateGeneration) || !hex(evidence.responseSha256) || !integer(evidence.runnerId) || evidence.runnerId < 1 || !Array.isArray(evidence.pages) || !evidence.pages.length || evidence.pages.length > 10) fail('invalid runner inventory');
  const rows = []; let total;
  for (let index = 0; index < evidence.pages.length; index += 1) {
    const page = evidence.pages[index]; const next = index + 1 === evidence.pages.length ? null : `/repos/${REPOSITORY.name}/actions/runners?per_page=100&page=${index + 2}`;
    if (!exact(page, ['next', 'number', 'runners', 'totalCount']) || page.number !== index + 1 || page.next !== next || !integer(page.totalCount) || !Array.isArray(page.runners)) fail('invalid runner inventory');
    total ??= page.totalCount; if (page.totalCount !== total) fail('invalid runner inventory'); for (const value of page.runners) rows.push(runner(value));
  }
  if (rows.length !== total || new Set(rows.map((row) => row.id)).size !== rows.length || rows.filter((row) => row.id === evidence.runnerId && row.labels.includes('baci-cwv-measurement')).length !== 1 || rows.filter((row) => row.labels.includes('baci-cwv-measurement')).length !== 1) fail('invalid runner inventory');
  return evidence.pages;
}

function exactHold(binding, hold) {
  if (!exact(hold, ['challenge', 'holdDigest', 'identity', 'liveSampleDigest', 'schemaVersion']) || hold.schemaVersion !== 1 || !hex(hold.holdDigest) || !hex(hold.liveSampleDigest) || !exact(hold.identity, ['campaignId', 'hostname', 'runnerContainerId', 'runnerIp', 'runnerPeerIfindex', 'runnerVeth']) || hold.identity.campaignId !== binding.campaignId || !/^[a-f0-9]{12}$/.test(hold.identity.hostname) || !hex(hold.identity.runnerContainerId) || typeof hold.identity.runnerIp !== 'string' || !integer(hold.identity.runnerPeerIfindex) || hold.identity.runnerPeerIfindex < 1 || !/^[A-Za-z0-9_.-]{1,15}$/.test(hold.identity.runnerVeth)) fail('invalid root hold');
  exactChallenge(binding, hold.challenge, 'inventory'); return hold;
}

export function inventoryDocumentFrom(state, hold) {
  const binding = beginBindingFrom(state); const exactHoldOutput = exactHold(binding, hold); const pages = inventoryPages(state.runnerEvidence, exactHoldOutput);
  return Object.freeze({ admissionId: binding.admissionId, campaignId: binding.campaignId, challengeNonce: exactHoldOutput.challenge.nonce, holdDigest: exactHoldOutput.holdDigest, kind: 'runner-inventory', ownerAudit: { capturedAt: new Date(state.createdWallClockMs).toISOString() }, pages, policyFileSha256: binding.policyFileSha256, repository: binding.repository, run: binding.run, schemaVersion: 1 });
}

export function parseOwnerDocumentArgs(argv) {
  const shared = (mode, extra) => ({ challengePath: mode === 'admission' ? extra : undefined, holdPath: mode === 'inventory' ? extra : undefined, mode, statePath: argv[2], stateShaPath: argv[4] });
  if (argv[0] === '--begin' && argv.length === 5 && argv[1] === '--state' && argv[3] === '--state-sha256' && argv[2] && argv[4]) return shared('begin');
  if (argv[0] === '--rearm' && argv.length === 5 && argv[1] === '--state' && argv[3] === '--state-sha256' && argv[2] && argv[4]) return shared('rearm');
  if (argv[0] === '--admission' && argv.length === 7 && argv[1] === '--state' && argv[3] === '--state-sha256' && argv[5] === '--challenge' && argv[2] && argv[4] && argv[6]) return shared('admission', argv[6]);
  if (argv[0] === '--inventory' && argv.length === 7 && argv[1] === '--state' && argv[3] === '--state-sha256' && argv[5] === '--hold' && argv[2] && argv[4] && argv[6]) return shared('inventory', argv[6]);
  fail('invalid invocation');
}

function canonicalInput(path, read) {
  const bytes = read(path); let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('invalid root input'); }
  const text = bytes.toString('utf8'); const encoded = canonical(value);
  if (text !== encoded && text !== `${encoded}\n`) fail('invalid root input'); return value;
}

export function runOwnerDocumentCli(argv, { read = readFileSync } = {}) {
  const args = parseOwnerDocumentArgs(argv); const before = args.mode === 'rearm' ? readFileSync(args.statePath) : undefined; const state = readSealedState({ statePath: args.statePath, stateShaPath: args.stateShaPath });
  if (args.mode === 'begin') return beginBindingFrom(state);
  if (args.mode === 'rearm') { const after = readFileSync(args.statePath); if (!before.equals(after)) fail('invalid rearm'); return rearmDocumentFrom(state, hash(before)); }
  return args.mode === 'admission' ? admissionDocumentFrom(state, canonicalInput(args.challengePath, read)) : inventoryDocumentFrom(state, canonicalInput(args.holdPath, read));
}

if (process.argv[1] === new URL(import.meta.url).pathname) process.stdout.write(canonical(runOwnerDocumentCli(process.argv.slice(2))));
