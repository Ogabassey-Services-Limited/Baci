// biome-ignore-all format: compact security tables stay below the repository file limit
import { BlockList, isIP } from 'node:net';

import { API, ARTIFACT_MEMBER, assertState, canonical, exact, fail, hash, REPOSITORY } from './owner-api-transport-primitives.mjs';

const RESOURCE_KEYS = ['hostMemAvailableBytesAfter', 'hostMemAvailableBytesBefore', 'modelStoreAllocatedBytesBefore', 'ollamaCgroupMemoryCurrentBytesAfter', 'ollamaCgroupMemoryCurrentBytesBefore', 'recoveredDiskBytes', 'rootFreeBytesAfter', 'rootFreeBytesBefore'];
const DIGEST_KEYS = ['admissionSha256', 'appPermissionsSha256', 'holdSha256', 'hostAttestationSha256', 'imageSha256', 'liveSampleSha256', 'ollamaRetirementSha256', 'policyCanonicalSha256', 'policyFileSha256', 'processMapSha256', 'restoreSha256', 'rulesetSha256', 'runnerInventorySha256', 'scriptsSha256', 'serviceSha256', 'sourceManifestSha256'];
const FAILURE_KEYS = ['appPermissions', 'artifactReadback', 'concurrentJob', 'cpuSet', 'doubleRestore', 'egressDnsLocaleTimezone', 'hostedRunner', 'labelUniqueness', 'lease', 'networkIsolation', 'offlineRunner', 'reboot', 'retention', 'retirementIdentity', 'rollback', 'ruleset', 'serviceRestart', 'softwareIdentity', 'supplyChain', 'thresholds'];

const RESERVED = Object.freeze({
  ipv4: [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]],
  ipv6: [['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]],
});
const BLOCKED = Object.freeze({ ipv4: new BlockList(), ipv6: new BlockList() }); for (const [family, rows] of Object.entries(RESERVED)) for (const [address, prefix] of rows) BLOCKED[family].addSubnet(address, prefix, family);
function publicAddress(address) { const version = typeof address === 'string' ? isIP(address) : 0; const family = version === 4 ? 'ipv4' : version === 6 ? 'ipv6' : ''; return Boolean(family) && !BLOCKED[family].check(address, family); }
export function validatePinnedAnswerSet(hostname, answers) {
  const canonicalAnswers = Array.isArray(answers) ? [...answers].sort() : [];
  if (typeof hostname !== 'string' || canonicalAnswers.length < 1 || canonicalAnswers.length > 16 || new Set(canonicalAnswers).size !== canonicalAnswers.length || canonicalAnswers.some((address) => !publicAddress(address))) fail('invalid peer address');
  return canonicalAnswers;
}
function pinnedPlan(hostname, answers) {
  const validAnswers = validatePinnedAnswerSet(hostname, answers);
  return { address: validAnswers[0], answerSetDigest: hash(validAnswers.join(',')), answers: validAnswers, hostname, servername: hostname, hostHeader: hostname, maxRedirects: 0 };
}

export function validDigest(value) { return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value); }
export function deriveRunnerIdentitySha256(value) {
  const runner = value?.runner;
  if (!exact(runner, ['generation', 'id', 'name']) || ![runner.id, runner.generation].every((field) => Number.isInteger(field) && field >= 0) || runner.name !== 'baci-cwv-measurement-01') fail('invalid runner identity');
  return hash(canonical(runner));
}
function secretShaped(value) { const secret = /(?:token|secret|credential|access[ _-]?key|api[ _-]?key|private[ _-]?key|authorization|password|bearer\s|github_pat_|gh[pousr]_|-----begin)/i; if (typeof value === 'string') return secret.test(value); if (!value || typeof value !== 'object') return false; return Object.entries(value).some(([key, child]) => secret.test(key) || secretShaped(child)); }
export function validatePinnedPeer(peer, plan) {
  if (!exact(peer, ['answerSetDigest', 'answers', 'hostname', 'remoteAddress', 'servername'])) fail('invalid peer address');
  const answers = validatePinnedAnswerSet(peer.hostname, peer.answers);
  if (peer.servername !== peer.hostname || !answers.includes(peer.remoteAddress) || !publicAddress(peer.remoteAddress) || peer.answerSetDigest !== hash(answers.join(','))) fail('invalid peer address');
  if (plan && (peer.hostname !== plan.hostname || peer.servername !== plan.servername || peer.remoteAddress !== plan.address || peer.answerSetDigest !== plan.answerSetDigest || canonical(answers) !== canonical(plan.answers))) fail('invalid peer address');
  return answers;
}
export function createPinnedApiPlan(state, request, answers) {
  assertState(state); const url = new URL(request?.url); const prefix = `/repos/${state.repository.name}/`;
  if (url.origin !== API || url.username || url.password || url.hash || !url.pathname.startsWith(prefix) || request.redirects !== 'error') fail('invalid API target');
  return pinnedPlan('api.github.com', answers);
}
function artifactPolicy(value) {
  if (!exact(value, ['allowedQueryKeys', 'hostPattern', 'maxBytes', 'pathPrefix', 'timeoutsMs']) || !Array.isArray(value.allowedQueryKeys) || !value.allowedQueryKeys.length || typeof value.hostPattern !== 'string' || typeof value.pathPrefix !== 'string' || !Number.isInteger(value.maxBytes) || value.maxBytes < 1) fail('invalid transport policy');
  return { host: new RegExp(value.hostPattern, 'u'), keys: new Set(value.allowedQueryKeys), maxBytes: value.maxBytes, pathPrefix: value.pathPrefix };
}
export function validateArtifactRedirectTarget(location, policy) {
  const allowed = artifactPolicy(policy);
  let parsed; try { parsed = location instanceof URL ? location : new URL(location); } catch { fail('invalid redirect'); }
  const keys = [...parsed.searchParams.keys()];
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || !allowed.host.test(parsed.hostname) || !parsed.pathname.startsWith(allowed.pathPrefix) || !keys.length || new Set(keys).size !== keys.length || keys.some((key) => !allowed.keys.has(key) || !parsed.searchParams.get(key))) fail('invalid redirect');
  return parsed;
}
export function validateArtifactRedirect(state, location, addresses, policy) {
  assertState(state); const parsed = validateArtifactRedirectTarget(location, policy);
  if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 16 || addresses.some((address) => !publicAddress(address))) fail('invalid redirect');
  const answerSet = validatePinnedAnswerSet(parsed.hostname, addresses);
  return { hostname: parsed.hostname, addresses: answerSet, answerSetDigest: hash(answerSet.join(',')), stateDigest: state.stateDigest };
}
export function validateArtifactRedirectEnvelope(response, policy) {
  const headers = response?.headers;
  if (response?.status !== 302 || !exact(response, ['headers', 'locationValues', 'status']) || headers === null || typeof headers !== 'object' || Array.isArray(headers) || Object.getPrototypeOf(headers) !== Object.prototype || Object.keys(headers).length > 32 || Object.entries(headers).some(([key, value]) => !/^[a-z0-9-]{1,64}$/.test(key) || typeof value !== 'string' || value.length > 8192 || /[\r\n]/.test(value)) || !Array.isArray(response.locationValues) || response.locationValues.length !== 1 || response.locationValues[0] !== headers.location) fail('invalid redirect');
  return validateArtifactRedirectTarget(response.locationValues[0], policy);
}
export function createArtifactDownloadPlan(state, response, addresses, policy) {
  const redirect = validateArtifactRedirect(state, validateArtifactRedirectEnvelope(response, policy), addresses, policy);
  return { ...pinnedPlan(redirect.hostname, redirect.addresses), authorization: false };
}
function publicProjection(value, runId, attempt, expectedSha) {
  if (!exact(value, ['digests', 'failureMatrix', 'noMeasurement', 'repository', 'resources', 'retention', 'runner', 'schemaVersion', 'workflow']) || value.schemaVersion !== 1 || value.noMeasurement !== true || secretShaped(value) || !exact(value.repository, ['id', 'name']) || value.repository.id !== REPOSITORY.id || value.repository.name !== REPOSITORY.name || !exact(value.runner, ['generation', 'id', 'name']) || ![value.runner.id, value.runner.generation].every((field) => Number.isInteger(field) && field >= 0) || value.runner.name !== 'baci-cwv-measurement-01' || !exact(value.resources, RESOURCE_KEYS) || !exact(value.retention, ['artifactLifetimeSeconds', 'maximumAllowedDays', 'repositoryDays', 'workflowDays']) || !exact(value.digests, DIGEST_KEYS) || !exact(value.failureMatrix, FAILURE_KEYS) || !exact(value.workflow, ['attempt', 'headSha', 'job', 'publicRunUrl', 'ref', 'runId']) || value.workflow.runId !== runId || value.workflow.attempt !== attempt || !/^[a-f0-9]{40}$/.test(expectedSha) || value.workflow.headSha !== expectedSha || value.workflow.publicRunUrl !== `https://github.com/${REPOSITORY.name}/actions/runs/${runId}` || value.workflow.ref !== 'refs/heads/main' || value.workflow.job !== 'attest') fail('invalid public artifact');
  if (![...RESOURCE_KEYS.map((key) => value.resources[key]), ...Object.values(value.retention)].every((field) => Number.isInteger(field) && field >= 0) || Object.values(value.digests).some((field) => !/^[a-f0-9]{64}$/.test(field)) || Object.values(value.failureMatrix).some((field) => field !== true) || value.retention.repositoryDays !== 90 || value.retention.maximumAllowedDays < 90 || value.retention.workflowDays !== 90 || value.retention.artifactLifetimeSeconds !== 90 * 86400) fail('invalid public artifact');
  deriveRunnerIdentitySha256(value);
}
export function validateArtifactReadback({ artifact, runId, attempt, expectedSha, archiveBytes, members, policy }) {
  const { maxBytes } = artifactPolicy(policy);
  if (!artifact || artifact.name !== `h0-runner-attestation-${runId}-${attempt}` || !validDigest(artifact.digest) || !Buffer.isBuffer(archiveBytes) || archiveBytes.length > maxBytes || !Array.isArray(members) || members.length !== 1 || hash(archiveBytes) !== artifact.digest.replace('sha256:', '')) fail('invalid artifact digest');
  const member = members[0];
  if (member?.name !== ARTIFACT_MEMBER || member.type !== 'file' || member.mode !== 0o644 || member.isSymlink === true || member.linkTarget || member.pax || member.device || member.alternatePath || !Buffer.isBuffer(member.bytes) || member.bytes.length > maxBytes) fail('invalid artifact member');
  let publicValue; try { publicValue = JSON.parse(member.bytes.toString('utf8')); } catch { fail('invalid artifact member'); }
  if (member.bytes.toString('utf8') !== canonical(publicValue)) fail('invalid public artifact'); publicProjection(publicValue, runId, attempt, expectedSha);
  return { artifact, public: publicValue };
}
