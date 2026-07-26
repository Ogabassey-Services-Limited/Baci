// biome-ignore-all format: one-request runtime paths intentionally stay compact
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  bindAuthenticatedRootReceipts,
  bindRunnerInventoryHold,
  completeArtifactReadback,
  executeApiOperation,
  requestFor,
} from './owner-api-transport.mjs';
import {
  initializeState,
  parseTransportArgs,
  readSealedState,
  writeNetworkPlan,
  writeSealedState,
} from './owner-api-transport-cli-state.mjs';
import {
  bindNetworkPolicy,
  createApiNetworkPlan,
  pinnedRequest,
  readAnswers,
  sendApiRequest,
  validateNetworkPlanPolicy,
} from './owner-api-transport-http.mjs';
import { canonical, exact, fail, hash } from './owner-api-transport-primitives.mjs';
import {
  createArtifactDownloadPlan,
  validateArtifactReadback,
  validateArtifactRedirectEnvelope,
  validatePinnedPeer,
} from './owner-api-transport-security.mjs';
import { readSoleArtifactMember } from './owner-api-transport-zip.mjs';

export { parseTransportArgs } from './owner-api-transport-cli-state.mjs';
export { pinnedRequest } from './owner-api-transport-http.mjs';

export async function resolveArtifactRedirectAnswers(response, transportPolicy, resolve = readAnswers) {
  const redirectUrl = validateArtifactRedirectEnvelope(response, transportPolicy?.policy);
  if (typeof resolve !== 'function') fail('invalid resolver');
  const answers = await resolve(redirectUrl.hostname, transportPolicy.policy.timeoutsMs.connect);
  return { answers, location: response.locationValues[0], redirectUrl };
}

function tokenBytes(value) {
  if (!Buffer.isBuffer(value)) fail('invalid token pipe');
  let end = value.length;
  while (end && [10, 13].includes(value[end - 1])) { value[end - 1] = 0; end -= 1; }
  const token = value.subarray(0, end);
  if (!token.length) fail('invalid token pipe');
  return token;
}

export function readValidatedToken(state, operation, read) {
  if (typeof read !== 'function') fail('invalid token pipe');
  requestFor(state, operation);
  if (operation === 'dispatch-exact-run' && state.phase !== 'QUIESCENT')
    fail('ambiguous dispatch');
  if (
    operation === 'list-attestation-runs' &&
    !['READY', 'DISPATCH_INTENT', 'DISPATCH_INDETERMINATE', 'DISPATCH_ACCEPTED', 'QUEUED', 'RUNNING'].includes(state.phase)
  )
    fail('invalid run evidence');
  return tokenBytes(read(0));
}

export async function runTransport({
  operation,
  persist: saved,
  persistNetworkPlan: savedNetwork,
  runnerHold,
  rootFailure,
  state,
  token,
  transportPolicy,
}) {
  validateNetworkPlanPolicy(transportPolicy, state?.digests?.policy);
  const persist =
    saved ??
    (async (_previous, following) => ({
      generation: following.generation,
      stateDigest: following.stateDigest,
    }));
  const persistNetworkPlan = savedNetwork ?? (async (plan) => ({ planSha256: hash(canonical(plan)) }));
  if (!Buffer.isBuffer(token) || !token.length) fail('invalid token pipe');
  let used = false;
  const nextToken = () => {
    if (used) fail('token already consumed');
    used = true;
    return token;
  };
  const send = (value, request, active, networkPlan) => sendApiRequest(value, request, active, networkPlan);
  const apiNetworkPlan = async (active, request) => createApiNetworkPlan(
    active,
    request,
    await readAnswers('api.github.com', transportPolicy?.policy?.timeoutsMs?.connect),
    Number(process.hrtime.bigint() / 1_000_000n),
    transportPolicy
  );
  const execute = (value, name) =>
    executeApiOperation({
      state: value,
      operation: name,
      nowMonotonicMs: Number(process.hrtime.bigint() / 1_000_000n),
      nowWallClockMs: Date.now(),
      persist,
      prepare: apiNetworkPlan,
      persistNetworkPlan,
      tokenPipe: nextToken,
      send: ({ networkPlan, request, state: activeState, token: active }) => send(activeState, request, active, networkPlan),
    });
  let current = state;
  try {
    if (operation === 'read-failed-job-evidence' && !current.rootFailureEvidence) {
      current = bindAuthenticatedRootReceipts(current, rootFailure);
      await persist(state, current);
    }
    if (operation === 'list-runner-inventory' && !current.runnerInventoryHold) {
      current = bindRunnerInventoryHold(current, runnerHold);
      await persist(state, current);
    }
    if (operation !== 'download-exact-artifact')
      return execute(current, operation);
    const request = requestFor(current, operation);
    const apiPlan = await apiNetworkPlan(current, request);
    const apiReceipt = await persistNetworkPlan(apiPlan); if (apiReceipt?.planSha256 !== hash(canonical(apiPlan))) fail('invalid network plan persistence');
    const authorization = Buffer.alloc(7 + token.length); Buffer.from('Bearer ').copy(authorization); token.copy(authorization, 7);
    let redirect;
    try {
      redirect = await pinnedRequest(apiPlan, { authorization });
    } finally {
      authorization.fill(0);
    }
    validatePinnedPeer(redirect.peer, apiPlan);
    const redirectEnvelope = {
      headers: redirect.headers,
      locationValues: redirect.locationValues,
      status: redirect.status,
    };
    const { answers, location, redirectUrl } = await resolveArtifactRedirectAnswers(redirectEnvelope, transportPolicy);
    const basePlan = createArtifactDownloadPlan(
      current,
      redirectEnvelope,
      answers,
      transportPolicy.policy
    );
    const plan = bindArtifactPlan(current, basePlan, redirectUrl, location, Number(process.hrtime.bigint() / 1_000_000n), transportPolicy);
    const blobReceipt = await persistNetworkPlan(plan); if (blobReceipt?.planSha256 !== hash(canonical(plan))) fail('invalid network plan persistence');
    const archive = await pinnedRequest(plan);
    validatePinnedPeer(archive.peer, plan);
    const members = readSoleArtifactMember(archive.body);
    const readback = validateArtifactReadback({
      artifact: current.artifact,
      runId: current.run.id,
      attempt: current.run.attempt,
      expectedSha: current.expectedSha,
      archiveBytes: archive.body,
      members,
      policy: transportPolicy.policy,
    });
    return completeArtifactReadback(current, { archiveBytes: archive.body, memberBytes: members[0].bytes, readback }, persist);
  } finally {
    token.fill(0);
  }
}

function fixedBytes(path, read) {
  const value = read(path); return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

function boundSidecar(path, bytes, read, message) {
  const digest = fixedBytes(path, read).toString('utf8');
  if (!/^[a-f0-9]{64}$/.test(digest) || hash(bytes) !== digest) fail(message);
  return digest;
}

export function parseRedirectLocation(location) {
  if (typeof location !== 'string' || !location) fail('invalid redirect');
  try { return new URL(location); } catch { fail('invalid redirect'); }
}

export function bindArtifactPlan(state, basePlan, redirectUrl, location, createdMonotonicMs, transportPolicy) {
  if (!(redirectUrl instanceof URL) || typeof location !== 'string') fail('invalid redirect');
  return { ...bindNetworkPolicy(basePlan, state, createdMonotonicMs, transportPolicy), path: `${redirectUrl.pathname}${redirectUrl.search}`, redirectSha256: hash(location), stateDigest: state.stateDigest, stateGeneration: state.generation };
}

function attemptPath(attempt, name) {
  if (![1, 2].includes(attempt)) fail('invalid evidence attempt');
  return `${name}-attempt-${attempt}`;
}

export function readRootFailureEnvelope(statePath, attempt, read = readFileSync) {
  const root = dirname(statePath); const named = (name) => join(root, name);
  const channel = attemptPath(attempt, 'root-channel'); const runtime = attemptPath(attempt, 'root-terminal-runtime'); const restore = attemptPath(attempt, 'root-restore');
  const channelBytes = fixedBytes(named(`${channel}.json`), read); boundSidecar(named(`${channel}.sha256`), channelBytes, read, 'invalid authenticated root receipt');
  let receipt; try { receipt = JSON.parse(channelBytes.toString('utf8')); } catch { fail('invalid authenticated root receipt'); }
  if (channelBytes.toString('utf8') !== canonical(receipt) || !exact(receipt, ['authenticated', 'channel', 'receivedMonotonicMs', 'transactionId'])) fail('invalid authenticated root receipt');
  const runtimeBytes = fixedBytes(named(`${runtime}.json`), read); const runtimeSha256 = boundSidecar(named(`${runtime}.sha256`), runtimeBytes, read, 'invalid authenticated root receipt');
  const restoreBytes = fixedBytes(named(`${restore}.json`), read); const restoreSha256 = boundSidecar(named(`${restore}.sha256`), restoreBytes, read, 'invalid authenticated root receipt');
  return { ...receipt, restoreBytes, restoreSha256, runtimeBytes, runtimeSha256 };
}

export function readRunnerHoldEnvelope(statePath, attempt, read = readFileSync) {
  const root = dirname(statePath); const named = (name) => join(root, name); const channelName = attemptPath(attempt, 'root-runner-hold-channel'); const hold = attemptPath(attempt, 'root-runner-hold'); const channelBytes = fixedBytes(named(`${channelName}.json`), read); boundSidecar(named(`${channelName}.sha256`), channelBytes, read, 'invalid authenticated runner hold');
  let channel; try { channel = JSON.parse(channelBytes.toString('utf8')); } catch { fail('invalid authenticated runner hold'); }
  if (channelBytes.toString('utf8') !== canonical(channel) || !exact(channel, ['authenticated', 'channel', 'receivedMonotonicMs', 'transactionId'])) fail('invalid authenticated runner hold');
  const holdBytes = fixedBytes(named(`${hold}.json`), read); const holdSha256 = boundSidecar(named(`${hold}.sha256`), holdBytes, read, 'invalid authenticated runner hold');
  return { ...channel, holdBytes, holdSha256 };
}

export function runTransportCli(argv, { read = readFileSync, transportPolicy } = {}) {
  const args = parseTransportArgs(argv);
  if (args.kind === 'initialize') return initializeState(args);
  let state = readSealedState(args);
  validateNetworkPlanPolicy(transportPolicy, state?.digests?.policy);
  if (args.operation === 'read-failed-job-evidence' && !state.rootFailureEvidence) {
    state = bindAuthenticatedRootReceipts(state, readRootFailureEnvelope(args.statePath, state.run?.attempt, read)); writeSealedState({ ...args, state });
  }
  if (args.operation === 'list-runner-inventory' && !state.runnerInventoryHold) {
    state = bindRunnerInventoryHold(state, readRunnerHoldEnvelope(args.statePath, state.run?.attempt, read)); writeSealedState({ ...args, state });
  }
  const token = readValidatedToken(state, args.operation, read);
  return runTransport({
    operation: args.operation,
    persist: async (_previous, following) =>
      writeSealedState({ ...args, state: following }),
    persistNetworkPlan: async (plan) => writeNetworkPlan({ ...args, plan }),
    state,
    token,
    transportPolicy,
  });
}
