import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{64}$/;
const CAMPAIGN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SOURCE_FILES = Object.freeze({
  actionNode: 'action-node.json',
  jobStartHook: 'job-start-hook.json',
  listenerTerminal: 'listener-terminal.json',
  terminalProcesses: 'terminal-processes.json',
});
const COMMON_KEYS = [
  'admissionId',
  'attempt',
  'campaignId',
  'coverage',
  'releaseSha256',
  'runId',
  'schemaVersion',
];

const fail = (message) => {
  throw new Error(message);
};
export const canonicalTransitionJson = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonicalTransitionJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalTransitionJson(value[key])}`
          )
          .join(',')}}`
      : JSON.stringify(value);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) =>
  canonicalTransitionJson(left) === canonicalTransitionJson(right);
const exact = (value, keys, name) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !same(Object.keys(value).sort(), [...keys].sort())
  )
    fail(`${name} keys are invalid`);
};
const integer = (value, name, minimum = 0) => {
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
  if (bytes.toString('utf8') !== canonicalTransitionJson(value))
    fail(`${name} is not canonical`);
  return value;
};

function validateBinding(binding) {
  if (
    !binding ||
    typeof binding !== 'object' ||
    !SHA.test(binding.admissionId ?? '') ||
    !CAMPAIGN.test(binding.campaignId ?? '') ||
    !binding.run ||
    typeof binding.run !== 'object'
  )
    fail('binding is invalid');
  integer(binding.run.id, 'binding run id', 1);
  integer(binding.run.attempt, 'binding attempt', 1);
}

function validateTrigger(trigger, binding) {
  exact(
    trigger,
    ['admissionId', 'attempt', 'runId', 'schemaVersion', 'stateGeneration'],
    'abort trigger'
  );
  integer(trigger.runId, 'abort trigger run id', 1);
  integer(trigger.attempt, 'abort trigger attempt', 1);
  integer(trigger.stateGeneration, 'abort trigger state generation', 1);
  if (
    trigger.schemaVersion !== 1 ||
    trigger.admissionId !== binding.admissionId ||
    trigger.runId !== binding.run.id ||
    trigger.attempt !== binding.run.attempt
  )
    fail('abort trigger binding is invalid');
}

function validateCoverage(coverage) {
  exact(
    coverage,
    ['endedMonotonicSeconds', 'startedMonotonicSeconds'],
    'observation coverage'
  );
  integer(coverage.startedMonotonicSeconds, 'observation coverage start');
  integer(coverage.endedMonotonicSeconds, 'observation coverage end', 1);
  if (coverage.endedMonotonicSeconds <= coverage.startedMonotonicSeconds)
    fail('observation coverage is incomplete');
}

function validateCommon(value, binding, releaseSha256, coverage, keys, name) {
  exact(value, [...COMMON_KEYS, ...keys], name);
  validateCoverage(value.coverage);
  if (
    value.schemaVersion !== 1 ||
    value.admissionId !== binding.admissionId ||
    value.campaignId !== binding.campaignId ||
    value.runId !== binding.run.id ||
    value.attempt !== binding.run.attempt ||
    value.releaseSha256 !== releaseSha256 ||
    !same(value.coverage, coverage)
  )
    fail(`${name} binding is invalid`);
}

function validateSources({ aggregate, binding, releaseSha256, sources }) {
  exact(sources, Object.keys(SOURCE_FILES), 'source evidence');
  const values = Object.fromEntries(
    Object.entries(sources).map(([key, bytes]) => [
      key,
      parseCanonical(bytes, `${key} source evidence`),
    ])
  );
  for (const [key, bytes] of Object.entries(sources))
    if (aggregate.sourceDigests[key] !== digest(bytes))
      fail('source evidence digest mismatch');
  validateCommon(
    values.actionNode,
    binding,
    releaseSha256,
    aggregate.coverage,
    ['kind', 'observed'],
    'action-node transport-loss evidence'
  );
  validateCommon(
    values.jobStartHook,
    binding,
    releaseSha256,
    aggregate.coverage,
    ['kind', 'observed'],
    'job-start-hook transport-loss evidence'
  );
  validateCommon(
    values.listenerTerminal,
    binding,
    releaseSha256,
    aggregate.coverage,
    ['exitKind', 'exitStatus', 'kind', 'observed'],
    'listener transport-loss evidence'
  );
  validateCommon(
    values.terminalProcesses,
    binding,
    releaseSha256,
    aggregate.coverage,
    ['kind', 'processes'],
    'terminal-process transport-loss evidence'
  );
  integer(values.listenerTerminal.exitStatus, 'listener exit status', 1);
  if (
    values.actionNode.kind !== 'action-node' ||
    values.actionNode.observed !== false ||
    values.jobStartHook.kind !== 'job-start-hook' ||
    values.jobStartHook.observed !== false ||
    values.listenerTerminal.kind !== 'listener-terminal' ||
    values.listenerTerminal.observed !== true ||
    values.listenerTerminal.exitKind !== 'transport-lost' ||
    values.listenerTerminal.exitStatus > 255 ||
    values.terminalProcesses.kind !== 'terminal-processes' ||
    !Array.isArray(values.terminalProcesses.processes) ||
    values.terminalProcesses.processes.length !== 0
  )
    fail('transport-loss evidence is not conclusive');
}

export function validateTransportLossTransition(input) {
  if (!input || typeof input !== 'object') fail('transition input is invalid');
  const { aggregateBytes, binding, releaseBytes, sources, trigger } = input;
  validateBinding(binding);
  validateTrigger(trigger, binding);
  if (!Buffer.isBuffer(releaseBytes)) fail('release bytes are invalid');
  const releaseSha256 = digest(releaseBytes);
  const aggregate = parseCanonical(aggregateBytes, 'transition evidence');
  validateCommon(
    aggregate,
    binding,
    releaseSha256,
    aggregate.coverage,
    ['coverageComplete', 'findings', 'sourceDigests'],
    'transition evidence'
  );
  exact(
    aggregate.sourceDigests,
    Object.keys(SOURCE_FILES),
    'source evidence digests'
  );
  if (
    aggregate.coverageComplete !== true ||
    !Array.isArray(aggregate.findings) ||
    aggregate.findings.length !== 0 ||
    !Object.values(aggregate.sourceDigests).every((value) => SHA.test(value))
  )
    fail('transport-loss evidence is incomplete');
  validateSources({ aggregate, binding, releaseSha256, sources });
  return Object.freeze({
    actionNodeObserved: false,
    admissionId: binding.admissionId,
    attempt: binding.run.attempt,
    findings: [],
    jobStartHookObserved: false,
    listenerExitKind: 'transport-lost',
    runId: binding.run.id,
    schemaVersion: 1,
    stateGeneration: trigger.stateGeneration,
    terminalProcessesSha256: aggregate.sourceDigests.terminalProcesses,
  });
}

const rootEvidenceAuthority = (metadata) =>
  metadata.isFile() &&
  !metadata.isSymbolicLink() &&
  metadata.uid === 0 &&
  (metadata.mode & 0o777) === 0o600;

export async function readRootReceipt(file, openFile = open) {
  const receipt = await openFile(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const before = await receipt.stat();
    if (!rootEvidenceAuthority(before))
      fail('root evidence authority is invalid');
    const bytes = await receipt.readFile();
    const after = await receipt.stat();
    if (
      !rootEvidenceAuthority(after) ||
      before.dev !== after.dev ||
      before.ino !== after.ino
    )
      fail('root evidence authority changed while reading');
    return bytes;
  } finally {
    await receipt.close();
  }
}

async function main() {
  const [bindingPath, releasePath, triggerPath, evidenceDirectory] =
    process.argv.slice(2);
  if (!evidenceDirectory || process.argv.length !== 6)
    fail(
      'usage: exact-run-transition-contract.mjs <binding> <release> <trigger> <evidence-directory>'
    );
  const binding = JSON.parse(await readFile(bindingPath, 'utf8'));
  const trigger = parseCanonical(await readFile(triggerPath), 'abort trigger');
  const sources = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_FILES).map(async ([key, name]) => [
        key,
        await readRootReceipt(path.join(evidenceDirectory, name)),
      ])
    )
  );
  const result = validateTransportLossTransition({
    aggregateBytes: await readRootReceipt(
      path.join(evidenceDirectory, 'transition.json')
    ),
    binding,
    releaseBytes: await readFile(releasePath),
    sources,
    trigger,
  });
  process.stdout.write(canonicalTransitionJson(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
