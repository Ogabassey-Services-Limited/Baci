// biome-ignore-all format: sealed authority bytes are mirrored into the runtime image.
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const SHA256 = /^[a-f0-9]{64}$/;
const PUBLIC_KEYS = ['schemaVersion', 'repository', 'workflow', 'runner', 'resources', 'retention', 'digests', 'failureMatrix', 'noMeasurement'];
export const RESOURCE_KEYS = ['ollamaCgroupMemoryCurrentBytesBefore', 'ollamaCgroupMemoryCurrentBytesAfter', 'hostMemAvailableBytesBefore', 'hostMemAvailableBytesAfter', 'modelStoreAllocatedBytesBefore', 'rootFreeBytesBefore', 'rootFreeBytesAfter', 'recoveredDiskBytes'];
export const DIGEST_KEYS = ['policyFileSha256', 'policyCanonicalSha256', 'sourceManifestSha256', 'imageSha256', 'processMapSha256', 'serviceSha256', 'scriptsSha256', 'appPermissionsSha256', 'rulesetSha256', 'runnerInventorySha256', 'hostAttestationSha256', 'liveSampleSha256', 'admissionSha256', 'holdSha256', 'restoreSha256', 'ollamaRetirementSha256'];
export const LOCAL_ATTESTATION_DIGEST_KEYS = [...DIGEST_KEYS, 'runnerIdentitySha256'];
export const FAILURE_KEYS = ['offlineRunner', 'labelUniqueness', 'hostedRunner', 'concurrentJob', 'lease', 'serviceRestart', 'reboot', 'softwareIdentity', 'egressDnsLocaleTimezone', 'cpuSet', 'thresholds', 'appPermissions', 'ruleset', 'retention', 'artifactReadback', 'rollback', 'doubleRestore', 'networkIsolation', 'supplyChain', 'retirementIdentity'];
const RULESET_TAGS = ['refs/tags/ogabassey-rollout-claim/*', 'refs/tags/ogabassey-rollout-progress/**/*', 'refs/tags/ogabassey-semantic-admission/*'];
const RULESET_OPERATIONS = ['update', 'deletion'];

function exactKeys(value, keys, name) {
  if (!isObject(value) || !same(Object.keys(value).sort(), [...keys].sort())) throw new Error(`${name} has forbidden or missing keys`);
}
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function labels(row) { return Array.isArray(row?.labels) ? row.labels.map((label) => typeof label === 'string' ? label : label?.name).sort() : []; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function rulesetShape(value) {
  return isObject(value)
    && value.target === 'tag'
    && value.enforcement === 'active'
    && same(value.tagIncludes, RULESET_TAGS)
    && same(value.tagExcludes, [])
    && same(value.rules, RULESET_OPERATIONS)
    && same(value.bypassActors, []);
}
function rulesetReadbackShape(value) {
  return isObject(value)
    && Object.keys(value.conditions ?? {}).length === 1
    && Object.keys(value.conditions?.ref_name ?? {}).sort().join(',') === 'exclude,include'
    && same(value.conditions?.ref_name?.include, RULESET_TAGS)
    && same(value.conditions?.ref_name?.exclude, [])
    && Array.isArray(value.rules)
    && same(value.rules.map((rule) => isObject(rule) && Object.keys(rule).length === 1 ? rule.type : undefined), RULESET_OPERATIONS)
    && same(value.bypass_actors, []);
}

export function verifyRunnerAuthority(input) {
  const findings = [];
  const policy = input?.policy;
  const expectedLabels = [...(policy?.runner?.labels ?? [])].sort();
  const dedicated = (input?.runnerInventory ?? []).filter((row) => labels(row).includes('baci-cwv-measurement'));
  const selected = dedicated[0];
  if (dedicated.length !== 1 || !selected || selected.status !== 'online' || selected.busy !== true || selected.id !== input?.localAttestation?.runnerId || selected.name !== policy?.runner?.name || selected.os?.toLowerCase() !== 'linux' || !same(labels(selected), expectedLabels)) findings.push({ code: 'LABEL_UNIQUENESS' });
  // GitHub's runner inventory does not expose a registration generation.  The
  // sealed local attestation is authoritative for that host-local value; the
  // API is used only to join its immutable runner ID and public attributes.
  if (!selected || !Number.isInteger(input?.localAttestation?.runnerGeneration) || input?.localAttestation?.workerCount !== 1) findings.push({ code: 'RUNNER_IDENTITY' });
  const retention = input?.repositoryRetention;
  if (retention?.days !== 90 || !Number.isInteger(retention?.maximum_allowed_days) || retention.maximum_allowed_days < 90 || input?.workflowRetentionDays !== 90 || Math.abs((input?.artifactLifetimeSeconds ?? 0) - (policy?.artifactRetentionDays ?? 0) * 86400) > 300) findings.push({ code: 'RETENTION' });
  if (!same(input?.appPermissions, { administration: 'read', metadata: 'read' })) findings.push({ code: 'APP_PERMISSIONS' });
  const ruleset = input?.ruleset; const expected = policy?.ruleset;
  if (!rulesetShape(expected) || !rulesetReadbackShape(ruleset) || ruleset.name !== expected?.name || ruleset.target !== expected?.target || ruleset.enforcement !== expected?.enforcement) findings.push({ code: 'RULESET' });
  return findings;
}

export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('unsupported JSON value'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!isObject(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('unsupported JSON value');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function hasSecretShape(value) {
  const secret = /(?:token|secret|credential|access[ _-]?key|api[ _-]?key|private[ _-]?key|authorization|password|bearer\s|github_pat_|gh[pousr]_|-----begin)/i;
  if (typeof value === 'string') return secret.test(value);
  if (!isObject(value) && !Array.isArray(value)) return false;
  return Object.entries(value).some(([key, child]) => secret.test(key) || hasSecretShape(child));
}
function assertPublic(value) {
  exactKeys(value, PUBLIC_KEYS, 'attestation');
  if (value.schemaVersion !== 1 || value.noMeasurement !== true) throw new Error('invalid public constants');
  exactKeys(value.repository, ['id', 'name'], 'repository'); exactKeys(value.workflow, ['runId', 'attempt', 'publicRunUrl', 'headSha', 'ref', 'job'], 'workflow'); exactKeys(value.runner, ['id', 'name', 'generation'], 'runner'); exactKeys(value.resources, RESOURCE_KEYS, 'resources'); exactKeys(value.retention, ['repositoryDays', 'maximumAllowedDays', 'workflowDays', 'artifactLifetimeSeconds'], 'retention'); exactKeys(value.digests, DIGEST_KEYS, 'digests'); exactKeys(value.failureMatrix, FAILURE_KEYS, 'failureMatrix');
  const expectedRunUrl = `https://github.com/${value.repository.name}/actions/runs/${value.workflow.runId}`;
  if (!Number.isInteger(value.repository.id) || typeof value.repository.name !== 'string' || !Number.isInteger(value.workflow.runId) || !Number.isInteger(value.workflow.attempt) || value.workflow.publicRunUrl !== expectedRunUrl || !/^[a-f0-9]{40}$/.test(value.workflow.headSha) || typeof value.workflow.ref !== 'string' || typeof value.workflow.job !== 'string' || !Number.isInteger(value.runner.id) || value.runner.name !== 'baci-cwv-measurement-01' || !Number.isInteger(value.runner.generation)) throw new Error('invalid public value');
  for (const field of RESOURCE_KEYS) if (!Number.isInteger(value.resources[field]) || value.resources[field] < 0) throw new Error('invalid resource');
  if (value.retention.repositoryDays !== 90 || !Number.isInteger(value.retention.maximumAllowedDays) || value.retention.maximumAllowedDays < 90 || value.retention.workflowDays !== 90 || value.retention.artifactLifetimeSeconds !== 90 * 86400) throw new Error('invalid retention');
  for (const field of DIGEST_KEYS) if (!SHA256.test(value.digests[field])) throw new Error('invalid digest');
  for (const field of FAILURE_KEYS) if (value.failureMatrix[field] !== true) throw new Error('invalid failure matrix');
  if (hasSecretShape(value)) throw new Error('secret-shaped public content');
}

export function projectPublicAttestation(privateInput) {
  const result = { schemaVersion: 1, repository: { id: privateInput.repository.id, name: privateInput.repository.name }, workflow: Object.fromEntries(['runId', 'attempt', 'publicRunUrl', 'headSha', 'ref', 'job'].map((key) => [key, privateInput.workflow[key]])), runner: Object.fromEntries(['id', 'name', 'generation'].map((key) => [key, privateInput.runner[key]])), resources: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, privateInput.resources[key]])), retention: Object.fromEntries(['repositoryDays', 'maximumAllowedDays', 'workflowDays', 'artifactLifetimeSeconds'].map((key) => [key, privateInput.retention[key]])), digests: Object.fromEntries(DIGEST_KEYS.map((key) => [key, privateInput.digests[key]])), failureMatrix: Object.fromEntries(FAILURE_KEYS.map((key) => [key, privateInput.failureMatrix[key]])), noMeasurement: true };
  assertPublic(result); return result;
}

export function verifyPublicArtifact({ members }) {
  if (!Array.isArray(members) || members.length !== 1) throw new Error('artifact must contain exactly one member');
  const [member] = members;
  if (member?.name !== 'h0-runner-attestation.json' || member.type !== 'file' || member.mode !== 0o644 || member.isSymlink === true || member.linkTarget || member.pax || member.device || member.alternatePath) throw new Error('invalid artifact member');
  const bytes = Buffer.from(member.bytes); let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('invalid JSON'); }
  assertPublic(parsed); if (bytes.toString('utf8') !== canonicalJson(parsed)) throw new Error('noncanonical public artifact');
  return parsed;
}

export async function writeProjectedAttestation(directory, privateInput) {
  if ((await readdir(directory)).length !== 0) throw new Error('projection directory must be empty');
  const path = join(directory, 'h0-runner-attestation.json');
  await writeFile(path, canonicalJson(projectPublicAttestation(privateInput)), { encoding: 'utf8', flag: 'wx', mode: 0o644 });
  return path;
}
