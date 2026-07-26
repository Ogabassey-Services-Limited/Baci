// biome-ignore-all format: compact authenticated hold validation stays below the repository limit
import { canonical, exact, fail, hash } from './owner-api-transport-primitives.mjs';

const hex = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = (value) => Number.isInteger(value) && value >= 0;

function bindingFrom(state) {
  return { admissionId: state.admissionId, campaignId: state.sourceAuthorization.transactionId, expectedSha: state.expectedSha, policyFileSha256: state.digests.policy, repository: state.repository, run: { attempt: state.run.attempt, id: state.run.id }, workflow: { id: state.workflow.id, job: 'attest', path: state.workflow.path, ref: state.workflow.ref } };
}

function canonicalHold(bytes, digest) {
  if (!Buffer.isBuffer(bytes) || !hex(digest) || hash(bytes) !== digest) fail('invalid authenticated runner hold');
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('invalid authenticated runner hold'); }
  if (bytes.toString('utf8') !== canonical(value)) fail('invalid authenticated runner hold');
  return value;
}

export function authenticatedRunnerHold(state, input) {
  if (!exact(input, ['authenticated', 'channel', 'holdBytes', 'holdSha256', 'receivedMonotonicMs', 'transactionId']) || input.authenticated !== true || input.channel !== 'ssh-controller' || input.transactionId !== state.sourceAuthorization?.transactionId || !['QUEUED', 'RUNNING'].includes(state.phase) || !state.postDispatchEvidence || state.runnerInventoryHold || state.runnerEvidence || !integer(input.receivedMonotonicMs) || input.receivedMonotonicMs < state.createdMonotonicMs || input.receivedMonotonicMs > state.deadlineMonotonicMs) fail('invalid authenticated runner hold');
  const hold = canonicalHold(input.holdBytes, input.holdSha256); const challenge = hold?.challenge; const identity = hold?.identity; const binding = bindingFrom(state);
  if (!exact(hold, ['challenge', 'holdDigest', 'identity', 'liveSampleDigest', 'schemaVersion']) || hold.schemaVersion !== 1 || !hex(hold.holdDigest) || !hex(hold.liveSampleDigest) || !exact(challenge, ['bindingDigest', 'campaignId', 'createdMonotonicSeconds', 'deadlineMonotonicSeconds', 'kind', 'nonce', 'schemaVersion']) || challenge.schemaVersion !== 1 || challenge.kind !== 'inventory' || challenge.bindingDigest !== hash(canonical(binding)) || challenge.campaignId !== binding.campaignId || !hex(challenge.nonce) || !integer(challenge.createdMonotonicSeconds) || challenge.deadlineMonotonicSeconds !== challenge.createdMonotonicSeconds + 5 || !exact(identity, ['campaignId', 'hostname', 'runnerContainerId', 'runnerIp', 'runnerPeerIfindex', 'runnerVeth']) || identity.campaignId !== binding.campaignId || !/^[a-f0-9]{12}$/.test(identity.hostname) || !hex(identity.runnerContainerId) || typeof identity.runnerIp !== 'string' || !integer(identity.runnerPeerIfindex) || identity.runnerPeerIfindex < 1 || !/^[A-Za-z0-9_.-]{1,15}$/.test(identity.runnerVeth)) fail('invalid authenticated runner hold');
  return Object.freeze({ boundStateGeneration: state.generation, challengeNonce: challenge.nonce, holdDigest: hold.holdDigest, holdSha256: input.holdSha256, ownerDeadlineMonotonicMs: input.receivedMonotonicMs + 5000, ownerReceivedMonotonicMs: input.receivedMonotonicMs });
}

export function assertRunnerHoldRequest(state) {
  const hold = state.runnerInventoryHold; const continuing = Boolean(state.pageCollections?.['list-runner-inventory']);
  if (!['QUEUED', 'RUNNING'].includes(state.phase) || !hold || state.runnerEvidence || (!continuing && hold.boundStateGeneration !== state.generation - 1)) fail('missing fresh runner hold');
  return hold;
}

export function validateRunnerHoldResponse(state, response) {
  const hold = assertRunnerHoldRequest(state);
  if (!integer(response?.receivedMonotonicMs) || response.receivedMonotonicMs < hold.ownerReceivedMonotonicMs || response.receivedMonotonicMs > hold.ownerDeadlineMonotonicMs) fail('stale runner hold');
  return hold;
}
