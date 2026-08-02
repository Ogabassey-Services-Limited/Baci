// biome-ignore-all format: compact exact-run contract stays below the repository file limit
import { createHash } from 'node:crypto';
import { validateSealedProcessInventory } from './exact-run-process-contract.mjs';
export const ACTIVE_STATUSES = Object.freeze([
  'queued',
  'in_progress',
  'requested',
  'waiting',
  'pending',
]);
const HEX_40 = /^[a-f0-9]{40}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const BOOT_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const REPOSITORY = Object.freeze({ id: 1100488586, name: 'ogabasseyy/Baci' });
const BINDING_KEYS = Object.freeze(['admissionId', 'campaignId', 'expectedSha', 'policyFileSha256', 'repository', 'run', 'workflow']);
const ALLOW_KEYS = Object.freeze([...BINDING_KEYS, 'expiresMonotonicSeconds', 'kind', 'runner', 'schemaVersion']);
const DEDICATED_LABEL = 'baci-cwv-measurement';
const DEDICATED_RUNNER_NAME = 'baci-cwv-measurement-01';
const DEDICATED_LABELS = Object.freeze(['Linux', 'X64', DEDICATED_LABEL, 'self-hosted']);
function fail(message) {
  throw new Error(message);
}
function object(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(`${name} must be an object`);
  return value;
}
function exactKeys(value, keys, name) {
  object(value, name);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    fail(`${name} keys are not exact`);
}
function equal(actual, expected, name) {
  if (actual !== expected) fail(`${name} binding mismatch`);
}
function integer(value, name, minimum = 0) { if (!Number.isSafeInteger(value) || value < minimum) fail(`${name} must be an integer`); }
function sha(value, name, expression = HEX_64) { if (typeof value !== 'string' || !expression.test(value)) fail(`${name} is invalid`); }
function boot(value) { if (typeof value !== 'string' || !BOOT_ID.test(value)) fail('challenge boot id is invalid'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function validateBinding(binding) {
  object(binding, 'binding');
  exactKeys(binding, BINDING_KEYS, 'binding');
  sha(binding.admissionId, 'admission id');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(binding.campaignId)) fail('campaign id is invalid');
  sha(binding.expectedSha, 'expected sha', HEX_40);
  sha(binding.policyFileSha256, 'policy digest');
  equal(binding.repository?.id, REPOSITORY.id, 'repository id');
  equal(binding.repository?.name, REPOSITORY.name, 'repository name');
  integer(binding.run?.id, 'run id', 1);
  integer(binding.run?.attempt, 'run attempt', 1);
  integer(binding.workflow?.id, 'workflow id', 1);
  for (const key of ['job', 'path', 'ref'])
    if (typeof binding.workflow?.[key] !== 'string' || binding.workflow[key] === '') fail(`workflow ${key} is invalid`);
}

function validateAllow(allow) {
  object(allow, 'allow');
  exactKeys(allow, ALLOW_KEYS, 'allow');
  validateBinding(Object.fromEntries(BINDING_KEYS.map((key) => [key, allow[key]])));
  validateRequiredRunner(allow.runner);
  equal(allow.kind, 'allow', 'allow kind');
  equal(allow.schemaVersion, 1, 'allow schema');
  if (!Number.isFinite(allow.expiresMonotonicSeconds)) fail('allow expiry is invalid');
}

export function createChallenge({ binding, bootId, kind, nonce, nowMonotonicSeconds, ttlSeconds }) {
  validateBinding(binding);
  boot(bootId);
  if (!['admission', 'inventory'].includes(kind)) fail('challenge kind is invalid');
  sha(nonce, 'challenge nonce');
  integer(nowMonotonicSeconds, 'challenge time');
  integer(ttlSeconds, 'challenge ttl', 1);
  const expectedTtl = kind === 'admission' ? 30 : 5;
  equal(ttlSeconds, expectedTtl, 'challenge ttl');
  return Object.freeze({
    bindingDigest: digest(binding),
    bootId,
    campaignId: binding.campaignId,
    createdMonotonicSeconds: nowMonotonicSeconds,
    deadlineMonotonicSeconds: nowMonotonicSeconds + ttlSeconds,
    kind,
    nonce,
    schemaVersion: 1,
  });
}

function validateChallenge({ binding, bootId, challenge, kind, nowMonotonicSeconds }) {
  boot(bootId);
  exactKeys(challenge, ['bindingDigest', 'bootId', 'campaignId', 'createdMonotonicSeconds', 'deadlineMonotonicSeconds', 'kind', 'nonce', 'schemaVersion'], 'challenge');
  equal(challenge.schemaVersion, 1, 'challenge schema');
  equal(challenge.kind, kind, 'challenge kind');
  equal(challenge.campaignId, binding.campaignId, 'challenge campaign');
  equal(challenge.bindingDigest, digest(binding), 'challenge digest');
  boot(challenge.bootId); equal(challenge.bootId, bootId, 'challenge boot epoch');
  sha(challenge.nonce, 'challenge nonce');
  integer(nowMonotonicSeconds, 'challenge time');
  integer(challenge.createdMonotonicSeconds, 'challenge created time');
  integer(challenge.deadlineMonotonicSeconds, 'challenge deadline time');
  const ttl = kind === 'admission' ? 30 : 5;
  const expectedDeadline = challenge.createdMonotonicSeconds + ttl;
  if (!Number.isSafeInteger(expectedDeadline) || challenge.deadlineMonotonicSeconds !== expectedDeadline) fail('challenge ttl binding mismatch');
  if (nowMonotonicSeconds < challenge.createdMonotonicSeconds) fail('challenge not yet valid');
  if (nowMonotonicSeconds > challenge.deadlineMonotonicSeconds) fail('challenge expired');
}

export function validateDispatchRun({ binding, run }) {
  validateBinding(binding);
  exactKeys(run, ['actor', 'admissionId', 'attempt', 'displayTitle', 'event', 'headBranch', 'headSha', 'id', 'status', 'workflowId', 'workflowPath'], 'dispatch run');
  equal(run.actor, 'ogabasseyy', 'actor');
  equal(run.admissionId, binding.admissionId, 'admission');
  equal(run.attempt, binding.run.attempt, 'run attempt');
  equal(run.displayTitle, `CWV Runner Attestation ${binding.admissionId}`, 'display title');
  equal(run.event, 'workflow_dispatch', 'event');
  equal(run.headBranch, 'main', 'branch');
  equal(run.headSha, binding.expectedSha, 'head sha');
  equal(run.id, binding.run.id, 'run id');
  equal(run.workflowId, binding.workflow.id, 'workflow id');
  equal(run.workflowPath, binding.workflow.path, 'workflow path');
  if (!ACTIVE_STATUSES.includes(run.status)) fail('run status binding mismatch');
  return run;
}

export function validateReconciliation({ binding, runs }) {
  if (!Array.isArray(runs)) fail('reconciliation runs must be an array');
  const active = runs.filter((run) => ACTIVE_STATUSES.includes(run.status));
  if (active.length !== 1) fail('reconciliation must contain the sole active run');
  validateDispatchRun({ binding, run: active[0] });
  return { activeRunCount: 1, runId: active[0].id };
}

export function validateAdmission({ binding, bootId, challenge, document, nowMonotonicSeconds }) {
  validateBinding(binding);
  validateChallenge({ binding, bootId, challenge, kind: 'admission', nowMonotonicSeconds });
  exactKeys(document, ['admissionId', 'campaignId', 'challengeNonce', 'kind', 'ownerAudit', 'policyFileSha256', 'reconciliation', 'repository', 'run', 'schemaVersion', 'workflow'], 'admission');
  exactKeys(document.ownerAudit, ['capturedAt'], 'owner audit');
  exactKeys(document.reconciliation, ['activeRunCount', 'digest', 'stateGeneration'], 'reconciliation');
  exactKeys(document.repository, ['id', 'name'], 'repository');
  exactKeys(document.run, ['actor', 'admissionId', 'attempt', 'displayTitle', 'event', 'id', 'status'], 'run');
  exactKeys(document.workflow, ['headSha', 'id', 'job', 'path', 'ref'], 'workflow');
  equal(document.schemaVersion, 1, 'admission schema');
  equal(document.kind, 'admission', 'admission kind');
  equal(document.challengeNonce, challenge.nonce, 'challenge nonce');
  for (const key of ['admissionId', 'campaignId', 'policyFileSha256']) equal(document[key], binding[key], key);
  for (const key of ['id', 'name']) equal(document.repository[key], binding.repository[key], `repository ${key}`);
  equal(document.workflow.headSha, binding.expectedSha, 'workflow sha');
  for (const key of ['id', 'job', 'path', 'ref']) equal(document.workflow[key], binding.workflow[key], `workflow ${key}`);
  const run = { ...document.run, headBranch: 'main', headSha: document.workflow.headSha, workflowId: document.workflow.id, workflowPath: document.workflow.path };
  validateDispatchRun({ binding, run });
  equal(document.reconciliation.activeRunCount, 1, 'active run count');
  sha(document.reconciliation.digest, 'reconciliation digest');
  integer(document.reconciliation.stateGeneration, 'state generation', 1);
  return Object.freeze({ ...binding, expiresMonotonicSeconds: nowMonotonicSeconds + 30, kind: 'admission-validated', schemaVersion: 1 });
}

function canonicalLabels(labels) {
  if (
    !Array.isArray(labels) ||
    labels.length === 0 ||
    labels.length > 32 ||
    labels.some((label) => typeof label !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(label)) ||
    new Set(labels).size !== labels.length ||
    canonical(labels) !== canonical([...labels].sort())
  )
    fail('runner labels are invalid');
  return labels;
}

function validateRunner(row) {
  exactKeys(row, ['architecture', 'busy', 'id', 'labels', 'name', 'os', 'status'], 'runner');
  const labels = canonicalLabels(row.labels);
  integer(row.id, 'runner id', 1);
  const architectures = labels.filter((label) => ['X64', 'ARM64', 'ARM'].includes(label));
  if (
    architectures.length !== 1 ||
    row.architecture !== architectures[0] ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(row.name) ||
    !/^[a-z0-9_-]{1,32}$/.test(row.os) ||
    !['online', 'offline'].includes(row.status) ||
    typeof row.busy !== 'boolean'
  )
    fail('runner state is invalid');
  if (labels.includes(DEDICATED_LABEL)) {
    if (canonical(labels) !== canonical(DEDICATED_LABELS)) fail('runner labels are invalid');
    equal(row.name, DEDICATED_RUNNER_NAME, 'runner name');
    equal(row.os, 'linux', 'runner os');
  }
}

function validateRequiredRunner(row) {
  exactKeys(row, ['generation', 'id', 'name'], 'runner identity');
  integer(row.id, 'runner id', 1);
  equal(row.generation, 1, 'runner generation');
  equal(row.name, DEDICATED_RUNNER_NAME, 'runner name');
}

export function validateInventoryReceipt({ binding, bootId, challenge, document, holdDigest, nowMonotonicSeconds, requiredRunner, ttlSeconds }) {
  validateBinding(binding);
  validateChallenge({ binding, bootId, challenge, kind: 'inventory', nowMonotonicSeconds });
  equal(ttlSeconds, 5, 'inventory ttl');
  sha(holdDigest, 'hold digest');
  exactKeys(document, ['admissionId', 'campaignId', 'challengeNonce', 'holdDigest', 'kind', 'ownerAudit', 'pages', 'policyFileSha256', 'repository', 'run', 'schemaVersion'], 'inventory');
  exactKeys(document.ownerAudit, ['capturedAt'], 'inventory owner audit');
  exactKeys(document.repository, ['id', 'name'], 'inventory repository');
  exactKeys(document.run, ['attempt', 'id'], 'inventory run');
  equal(document.schemaVersion, 1, 'inventory schema');
  equal(document.kind, 'runner-inventory', 'inventory kind');
  equal(document.challengeNonce, challenge.nonce, 'inventory nonce');
  for (const key of ['admissionId', 'campaignId', 'policyFileSha256']) equal(document[key], binding[key], `inventory ${key}`);
  equal(document.holdDigest, holdDigest, 'inventory hold digest');
  for (const key of ['id', 'name']) equal(document.repository[key], binding.repository[key], `inventory repository ${key}`);
  for (const key of ['id', 'attempt']) equal(document.run[key], binding.run[key], `inventory run ${key}`);
  if (!Array.isArray(document.pages) || document.pages.length === 0 || document.pages.length > 100) fail('inventory page limit is invalid');
  const rows = [];
  let totalCount;
  for (let index = 0; index < document.pages.length; index += 1) {
    const page = document.pages[index];
    exactKeys(page, ['next', 'number', 'runners', 'totalCount'], 'inventory page');
    equal(page.number, index + 1, 'inventory page number');
    integer(page.totalCount, 'inventory total count');
    totalCount ??= page.totalCount;
    equal(page.totalCount, totalCount, 'inventory total count');
    const expectedNext = index + 1 < document.pages.length ? `/repos/${REPOSITORY.name}/actions/runners?per_page=100&page=${index + 2}` : null;
    equal(page.next, expectedNext, 'inventory page link');
    if (!Array.isArray(page.runners)) fail('inventory page runners are invalid');
    for (const row of page.runners) { validateRunner(row); rows.push(row); }
  }
  equal(rows.length, totalCount, 'inventory total');
  if (new Set(rows.map((row) => row.id)).size !== rows.length) fail('inventory runner id is duplicated');
  const dedicated = rows.filter((row) => row.labels.includes(DEDICATED_LABEL));
  if (dedicated.length !== 1) fail('inventory must contain exactly one dedicated label');
  validateRequiredRunner(requiredRunner);
  if (dedicated[0].id !== requiredRunner.id || dedicated[0].name !== requiredRunner.name) fail('dedicated runner binding mismatch');
  return Object.freeze({
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    expiresMonotonicSeconds: nowMonotonicSeconds + ttlSeconds,
    holdDigest,
    policyFileSha256: binding.policyFileSha256,
    runner: requiredRunner,
    schemaVersion: 1,
  });
}

function validateInventoryReceiptBinding(binding, receipt) {
  exactKeys(receipt, ['admissionId', 'campaignId', 'expiresMonotonicSeconds', 'holdDigest', 'policyFileSha256', 'runner', 'schemaVersion'], 'inventory receipt');
  equal(receipt.schemaVersion, 1, 'inventory receipt schema');
  integer(receipt.expiresMonotonicSeconds, 'inventory receipt expiry');
  sha(receipt.holdDigest, 'inventory hold digest');
  validateRequiredRunner(receipt.runner);
  for (const key of ['admissionId', 'campaignId', 'policyFileSha256']) equal(receipt[key], binding[key], `inventory receipt ${key}`);
}

export function createFinalAllow({ binding, inventoryReceipt, nowMonotonicSeconds }) {
  validateBinding(binding); validateInventoryReceiptBinding(binding, inventoryReceipt);
  integer(nowMonotonicSeconds, 'allow time');
  if (nowMonotonicSeconds > inventoryReceipt.expiresMonotonicSeconds) fail('inventory receipt expired');
  return Object.freeze({ ...binding, expiresMonotonicSeconds: inventoryReceipt.expiresMonotonicSeconds, kind: 'allow', runner: inventoryReceipt.runner, schemaVersion: 1 });
}

export function validateRelease({ binding, classifierDigest, holdDigest, inventoryReceipt, liveSampleDigest, nowMonotonicSeconds }) {
  validateBinding(binding);
  for (const [name, value] of [['classifier digest', classifierDigest], ['hold digest', holdDigest], ['live sample digest', liveSampleDigest]]) sha(value, name);
  validateInventoryReceiptBinding(binding, inventoryReceipt);
  integer(nowMonotonicSeconds, 'release time');
  if (nowMonotonicSeconds > inventoryReceipt.expiresMonotonicSeconds) fail('inventory receipt expired');
  equal(inventoryReceipt.holdDigest, holdDigest, 'release hold digest');
  return Object.freeze({ admissionId: binding.admissionId, campaignId: binding.campaignId, classifierDigest, holdDigest, liveSampleDigest, ready: true, schemaVersion: 1 });
}

export const validateProcessInventory = validateSealedProcessInventory;

export function validateHookContext({ allow, environment, event, nowMonotonicSeconds }) {
  validateAllow(allow);
  if (nowMonotonicSeconds > allow.expiresMonotonicSeconds) fail('allow record expired');
  const expected = {
    GITHUB_JOB: allow.workflow.job,
    GITHUB_REF: allow.workflow.ref,
    GITHUB_REPOSITORY: allow.repository.name,
    GITHUB_REPOSITORY_ID: String(allow.repository.id),
    GITHUB_RUN_ATTEMPT: String(allow.run.attempt),
    GITHUB_RUN_ID: String(allow.run.id),
    GITHUB_SHA: allow.expectedSha,
    GITHUB_WORKFLOW_REF: `${allow.repository.name}/${allow.workflow.path}@${allow.workflow.ref}`,
    GITHUB_WORKFLOW_SHA: allow.expectedSha,
  };
  for (const [key, value] of Object.entries(expected)) equal(environment?.[key], value, `hook ${key}`);
  equal(event?.inputs?.admission_id, allow.admissionId, 'hook admission');
  return { ok: true };
}
