// biome-ignore-all format: compact closed contract stays within the repository file limit
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const CAMPAIGN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const FAILURE_CODE = 'RUNNER_TRANSPORT_LOST_BEFORE_ATTESTATION';
const INPUT_KEYS = 'observationBytes priorBinding request restoreBytes runtimeBytes'.split(' ');
const BINDING_KEYS = [
  'admissionId',
  'campaignId',
  'expectedSha',
  'policyFileSha256',
  'repository',
  'run',
  'workflow',
];
const FAILURE_KEYS = [
  'attempt',
  'code',
  'createdAt',
  'jobsDigest',
  'restoreDigest',
  'rootStateGeneration',
  'rootRuntimeDigest',
  'runDigest',
  'runId',
  'schemaVersion',
  'stateGeneration',
];
const REQUEST_KEYS = [
  'binding',
  'failureEvidence',
  'ownerStateSha256',
  'schemaVersion',
  'stateGeneration',
];
const RUNTIME_KEYS = [
  'actionNodeObserved',
  'admissionId',
  'attempt',
  'daemonsOffline',
  'findings',
  'jobStartHookObserved',
  'listenerExitKind',
  'runId',
  'runnerOffline',
  'schemaVersion',
  'stateGeneration',
  'terminalProcessesSha256',
];
const RESTORE_KEYS = [
  'admissionId',
  'attempt',
  'cleanupComplete',
  'daemonsOffline',
  'findings',
  'networkAbsent',
  'processes',
  'restored',
  'runId',
  'runnerOffline',
  'schemaVersion',
  'stateGeneration',
  'terminalProcessesSha256',
];
const OBSERVATION_KEYS = [
  'actionNodeObserved',
  'admissionId',
  'attempt',
  'findings',
  'jobStartHookObserved',
  'listenerExitKind',
  'runId',
  'schemaVersion',
  'stateGeneration',
  'terminalProcessesSha256',
];
const fail = (message) => {
  throw new Error(message);
};
export const canonicalRearmJson = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonicalRearmJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map(
            (key) => `${JSON.stringify(key)}:${canonicalRearmJson(value[key])}`
          )
          .join(',')}}`
      : JSON.stringify(value);
const same = (left, right) =>
  canonicalRearmJson(left) === canonicalRearmJson(right);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const exact = (value, keys, name) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !same(Object.keys(value).sort(), [...keys].sort())
  )
    fail(`${name} keys are invalid`);
};
const integer = (value, name, minimum = 1) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    fail(`${name} is invalid`);
};
const parseCanonical = (bytes, name) => {
  if (!Buffer.isBuffer(bytes)) fail(`${name} bytes are invalid`);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`${name} JSON is invalid`);
  }
  if (bytes.toString('utf8') !== canonicalRearmJson(value))
    fail(`${name} is not canonical`);
  return value;
};

function validateBinding(binding, attempt) {
  exact(binding, BINDING_KEYS, 'binding');
  exact(binding.repository, ['id', 'name'], 'binding repository');
  exact(binding.run, ['attempt', 'id'], 'binding run');
  exact(binding.workflow, ['id', 'job', 'path', 'ref'], 'binding workflow');
  integer(binding.repository.id, 'repository id');
  integer(binding.run.id, 'run id');
  integer(binding.workflow.id, 'workflow id');
  if (
    !SHA.test(binding.admissionId) ||
    !SHA.test(binding.policyFileSha256) ||
    !COMMIT.test(binding.expectedSha) ||
    !CAMPAIGN.test(binding.campaignId) ||
    binding.run.attempt !== attempt ||
    typeof binding.repository.name !== 'string' ||
    typeof binding.workflow.job !== 'string' ||
    typeof binding.workflow.path !== 'string' ||
    typeof binding.workflow.ref !== 'string'
  )
    fail('binding or attempt is invalid');
}

function validateFailure(failure, priorBinding, runtimeBytes, restoreBytes) {
  exact(failure, FAILURE_KEYS, 'failure evidence');
  integer(failure.runId, 'failure run id');
  integer(failure.rootStateGeneration, 'root state generation');
  integer(failure.stateGeneration, 'failure state generation');
  const created = new Date(failure.createdAt);
  if (
    failure.schemaVersion !== 1 ||
    failure.attempt !== 1 ||
    failure.runId !== priorBinding.run.id ||
    failure.code !== FAILURE_CODE ||
    failure.rootStateGeneration + 1 !== failure.stateGeneration ||
    Number.isNaN(created.valueOf()) ||
    ![
      failure.jobsDigest,
      failure.restoreDigest,
      failure.rootRuntimeDigest,
      failure.runDigest,
    ].every((value) => SHA.test(value)) ||
    failure.runDigest !==
      digest(Buffer.from(canonicalRearmJson(priorBinding.run))) ||
    failure.rootRuntimeDigest !== digest(runtimeBytes) ||
    failure.restoreDigest !== digest(restoreBytes)
  )
    fail('failure evidence binding is invalid');
}

function validateRootReceipts(
  { observation, restore, runtime },
  binding,
  state
) {
  exact(runtime, RUNTIME_KEYS, 'root runtime');
  exact(restore, RESTORE_KEYS, 'restore receipt');
  exact(observation, OBSERVATION_KEYS, 'transport observation');
  const bound = (value) =>
    value.schemaVersion === 1 &&
    value.admissionId === binding.admissionId &&
    value.attempt === 1 &&
    value.runId === binding.run.id &&
    value.stateGeneration === state;
  if (
    !bound(runtime) ||
    !bound(restore) ||
    !bound(observation) ||
    runtime.listenerExitKind !== 'transport-lost' ||
    runtime.jobStartHookObserved !== false ||
    runtime.actionNodeObserved !== false ||
    runtime.runnerOffline !== true ||
    runtime.daemonsOffline !== true ||
    restore.restored !== true ||
    restore.cleanupComplete !== true ||
    restore.runnerOffline !== true ||
    restore.daemonsOffline !== true ||
    restore.networkAbsent !== true ||
    observation.listenerExitKind !== 'transport-lost' ||
    observation.jobStartHookObserved !== false ||
    observation.actionNodeObserved !== false ||
    !SHA.test(observation.terminalProcessesSha256) ||
    runtime.terminalProcessesSha256 !== observation.terminalProcessesSha256 ||
    restore.terminalProcessesSha256 !== observation.terminalProcessesSha256 ||
    ![
      runtime.findings,
      restore.findings,
      restore.processes,
      observation.findings,
    ].every((value) => Array.isArray(value) && value.length === 0)
  )
    fail('root terminal evidence is invalid');
}

export function validateAttemptTwoRearm(input) {
  if (!input || typeof input !== 'object') fail('rearm input is invalid');
  exact(input, INPUT_KEYS, 'rearm input');
  const {
    observationBytes,
    priorBinding,
    request,
    restoreBytes,
    runtimeBytes,
  } = input;
  validateBinding(priorBinding, 1);
  exact(request, REQUEST_KEYS, 'rearm request');
  validateBinding(request.binding, 2);
  integer(request.stateGeneration, 'rearm state generation');
  if (
    request.schemaVersion !== 1 ||
    !SHA.test(request.ownerStateSha256) ||
    request.stateGeneration <= request.failureEvidence?.stateGeneration
  )
    fail('rearm request is invalid');
  const expectedPrior = {
    ...request.binding,
    repository: { ...request.binding.repository },
    run: { ...request.binding.run, attempt: 1 },
    workflow: { ...request.binding.workflow },
  };
  if (!same(expectedPrior, priorBinding))
    fail('rearm binding drift is invalid');
  const runtime = parseCanonical(runtimeBytes, 'root runtime');
  const restore = parseCanonical(restoreBytes, 'restore receipt');
  const observation = parseCanonical(observationBytes, 'transport observation');
  validateFailure(
    request.failureEvidence,
    priorBinding,
    runtimeBytes,
    restoreBytes
  );
  validateRootReceipts(
    { observation, restore, runtime },
    priorBinding,
    request.failureEvidence.rootStateGeneration
  );
  return Object.freeze({
    binding: request.binding,
    bindingSha256: digest(Buffer.from(canonicalRearmJson(request.binding))),
    campaignId: priorBinding.campaignId,
    failureEvidenceSha256: digest(
      Buffer.from(canonicalRearmJson(request.failureEvidence))
    ),
    ownerStateSha256: request.ownerStateSha256,
    priorAttempt: 1,
    runId: priorBinding.run.id,
    schemaVersion: 1,
    stateGeneration: request.stateGeneration,
  });
}

async function main() {
  const [
    priorBindingPath,
    requestPath,
    runtimePath,
    restorePath,
    observationPath,
  ] = process.argv.slice(2);
  if (!observationPath || process.argv.length !== 7)
    fail(
      'usage: exact-run-rearm-contract.mjs <prior-binding> <request> <runtime> <restore> <observation>'
    );
  const result = validateAttemptTwoRearm({
    observationBytes: await readFile(observationPath),
    priorBinding: JSON.parse(await readFile(priorBindingPath, 'utf8')),
    request: parseCanonical(await readFile(requestPath), 'rearm request'),
    restoreBytes: await readFile(restorePath),
    runtimeBytes: await readFile(runtimePath),
  });
  process.stdout.write(canonicalRearmJson(result));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
