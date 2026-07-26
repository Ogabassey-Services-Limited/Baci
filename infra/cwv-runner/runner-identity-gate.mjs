import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { pinnedRunnerIdentity } from './policy.schema.mjs';

const recordKeys = Object.freeze([
  'admissionId',
  'campaignId',
  'expectedSha',
  'expiresMonotonicSeconds',
  'kind',
  'policyFileSha256',
  'repository',
  'run',
  'runner',
  'schemaVersion',
  'workflow',
]);

const nestedKeys = Object.freeze({
  repository: Object.freeze(['id', 'name']),
  run: Object.freeze(['attempt', 'id']),
  runner: Object.freeze(['generation', 'id', 'name']),
  workflow: Object.freeze(['id', 'job', 'path', 'ref']),
});

const sealedTarget = Object.freeze({
  repositoryId: 1100488586,
  repositoryName: 'ogabasseyy/Baci',
  workflowJob: 'attest',
  workflowPath: '.github/workflows/cwv-runner-attestation.yml',
  workflowRef: 'refs/heads/main',
});

const environmentBindings = Object.freeze([
  ['job', 'GITHUB_JOB'],
  ['ref', 'GITHUB_REF'],
  ['repository', 'GITHUB_REPOSITORY'],
  ['repositoryId', 'GITHUB_REPOSITORY_ID'],
  ['runAttempt', 'GITHUB_RUN_ATTEMPT'],
  ['runId', 'GITHUB_RUN_ID'],
  ['runnerArch', 'RUNNER_ARCH'],
  ['runnerName', 'RUNNER_NAME'],
  ['runnerOs', 'RUNNER_OS'],
  ['sha', 'GITHUB_SHA'],
  ['workflowRef', 'GITHUB_WORKFLOW_REF'],
  ['workflowSha', 'GITHUB_WORKFLOW_SHA'],
]);

const admissionFilesystem = Object.freeze({
  close: closeSync,
  fstat: fstatSync,
  open: openSync,
  read: readFileSync,
});

function parsePositiveInteger(value, name) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value))
    throw new TypeError(`${name} refused`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new TypeError(`${name} refused`);
  return parsed;
}

function hasExactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort())
  );
}

function requirePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new TypeError(`${name} refused`);
}

export function validateRunnerIdentity(record, values) {
  if (!hasExactKeys(record, recordKeys))
    throw new TypeError('admission schema refused');
  for (const [name, keys] of Object.entries(nestedKeys))
    if (!hasExactKeys(record[name], keys))
      throw new TypeError(`admission ${name} schema refused`);
  if (record.schemaVersion !== 1 || record.kind !== 'allow')
    throw new TypeError('admission version refused');
  if (
    !/^[0-9a-f]{64}$/.test(values.admissionId ?? '') ||
    values.admissionId !== record.admissionId ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(record.campaignId) ||
    !/^[0-9a-f]{40}$/.test(record.expectedSha) ||
    !/^[0-9a-f]{64}$/.test(record.policyFileSha256) ||
    !Number.isFinite(record.expiresMonotonicSeconds)
  )
    throw new TypeError('admission id refused');
  if (
    record.runner.name !== pinnedRunnerIdentity.runnerName ||
    values.runnerName !== pinnedRunnerIdentity.runnerName ||
    values.runnerOs !== 'Linux' ||
    values.runnerArch !== 'X64'
  )
    throw new TypeError('runner identity refused');
  requirePositiveInteger(record.repository.id, 'repository id');
  requirePositiveInteger(record.run.id, 'run id');
  requirePositiveInteger(record.run.attempt, 'run attempt');
  requirePositiveInteger(record.runner.id, 'runner id');
  requirePositiveInteger(record.workflow.id, 'workflow id');
  if (
    record.runner.generation !== 1 ||
    record.repository.id !== sealedTarget.repositoryId ||
    record.repository.name !== sealedTarget.repositoryName ||
    record.workflow.job !== sealedTarget.workflowJob ||
    record.workflow.path !== sealedTarget.workflowPath ||
    record.workflow.ref !== sealedTarget.workflowRef
  )
    throw new TypeError('runner authority refused');
  const expectedBindings = {
    job: record.workflow.job,
    ref: record.workflow.ref,
    repository: record.repository.name,
    repositoryId: record.repository.id,
    runAttempt: record.run.attempt,
    runId: record.run.id,
    runnerArch: 'X64',
    runnerName: record.runner.name,
    runnerOs: 'Linux',
    sha: record.expectedSha,
    workflowRef: `${record.repository.name}/${record.workflow.path}@${record.workflow.ref}`,
    workflowSha: record.expectedSha,
  };
  for (const [key] of environmentBindings) {
    const expected = ['repositoryId', 'runAttempt', 'runId'].includes(key)
      ? parsePositiveInteger(values[key], key)
      : values[key];
    if (expectedBindings[key] !== expected)
      throw new TypeError(`runner binding refused: ${key}`);
  }
  return Object.freeze({
    admissionSha256: canonicalSha256(record),
    ok: true,
  });
}

export function readAdmission(path, filesystem = admissionFilesystem) {
  const descriptor = filesystem.open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const info = filesystem.fstat(descriptor);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== 0 ||
      info.gid !== pinnedRunnerIdentity.runnerGid ||
      (info.mode & 0o777) !== 0o440
    )
      throw new TypeError('admission file identity refused');
    const raw = filesystem.read(descriptor, 'utf8');
    const value = JSON.parse(raw);
    if (`${canonicalJson(value)}\n` !== raw)
      throw new TypeError('admission canonical bytes refused');
    return value;
  } finally {
    filesystem.close(descriptor);
  }
}

function selectedEnvironment() {
  const read = (name) => Reflect.get(process.env, name);
  return {
    admissionId: read('BACI_CWV_ADMISSION_ID'),
    ...Object.fromEntries(
      environmentBindings.map(([key, name]) => [key, read(name)])
    ),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 2)
    throw new TypeError('runner identity gate accepts no arguments');
  const receipt = validateRunnerIdentity(
    readAdmission('/run/baci-cwv-admission/active.json'),
    selectedEnvironment()
  );
  process.stdout.write(`${canonicalJson(receipt)}\n`);
}
