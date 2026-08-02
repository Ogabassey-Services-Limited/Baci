import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canonicalRearmJson,
  validateAttemptTwoRearm,
} from './exact-run-rearm-contract.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const bytes = (value) => Buffer.from(canonicalRearmJson(value));
const priorBinding = Object.freeze({
  admissionId: 'a'.repeat(64),
  campaignId: 'campaign-01',
  expectedSha: 'b'.repeat(40),
  policyFileSha256: 'c'.repeat(64),
  repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
  run: { attempt: 1, id: 42 },
  workflow: {
    id: 7,
    job: 'attest',
    path: '.github/workflows/cwv-runner-attestation.yml',
    ref: 'refs/heads/main',
  },
});
const runtime = Object.freeze({
  actionNodeObserved: false,
  admissionId: priorBinding.admissionId,
  attempt: 1,
  daemonsOffline: true,
  findings: [],
  jobStartHookObserved: false,
  listenerExitKind: 'transport-lost',
  runId: 42,
  runnerOffline: true,
  schemaVersion: 1,
  stateGeneration: 6,
  terminalProcessesSha256: 'd'.repeat(64),
});
const restore = Object.freeze({
  admissionId: priorBinding.admissionId,
  attempt: 1,
  cleanupComplete: true,
  daemonsOffline: true,
  findings: [],
  networkAbsent: true,
  processes: [],
  restored: true,
  runId: 42,
  runnerOffline: true,
  schemaVersion: 1,
  stateGeneration: 6,
  terminalProcessesSha256: 'd'.repeat(64),
});
const observation = Object.freeze({
  actionNodeObserved: false,
  admissionId: priorBinding.admissionId,
  attempt: 1,
  findings: [],
  jobStartHookObserved: false,
  listenerExitKind: 'transport-lost',
  runId: 42,
  schemaVersion: 1,
  stateGeneration: 6,
  terminalProcessesSha256: 'd'.repeat(64),
});
const FAILED_ROOT_STATE_GENERATION = runtime.stateGeneration;
const POST_BIND_FAILURE_STATE_GENERATION = FAILED_ROOT_STATE_GENERATION + 1;

function fixture() {
  const runtimeBytes = bytes(runtime);
  const restoreBytes = bytes(restore);
  const failureEvidence = {
    attempt: 1,
    code: 'RUNNER_TRANSPORT_LOST_BEFORE_ATTESTATION',
    createdAt: '2026-07-22T12:00:00.000Z',
    jobsDigest: 'e'.repeat(64),
    restoreDigest: hash(restoreBytes),
    rootStateGeneration: FAILED_ROOT_STATE_GENERATION,
    rootRuntimeDigest: hash(runtimeBytes),
    runDigest: hash(bytes(priorBinding.run)),
    runId: 42,
    schemaVersion: 1,
    stateGeneration: POST_BIND_FAILURE_STATE_GENERATION,
  };
  return {
    observationBytes: bytes(observation),
    priorBinding,
    request: {
      binding: {
        ...priorBinding,
        repository: { ...priorBinding.repository },
        run: { attempt: 2, id: 42 },
        workflow: { ...priorBinding.workflow },
      },
      failureEvidence,
      ownerStateSha256: '1'.repeat(64),
      schemaVersion: 1,
      stateGeneration: 9,
    },
    restoreBytes,
    runtimeBytes,
  };
}

test('authorizes exactly one same-run attempt-two rearm', () => {
  const input = fixture();
  const result = validateAttemptTwoRearm(input);
  assert.deepEqual(result, {
    binding: input.request.binding,
    bindingSha256: hash(bytes(input.request.binding)),
    campaignId: priorBinding.campaignId,
    failureEvidenceSha256: hash(bytes(input.request.failureEvidence)),
    ownerStateSha256: input.request.ownerStateSha256,
    priorAttempt: 1,
    runId: 42,
    schemaVersion: 1,
    stateGeneration: 9,
  });
});

test('authorizes root receipts from the FAILED generation before the post-bind failure generation', () => {
  const input = fixture();
  assert.equal(
    input.request.failureEvidence.rootStateGeneration,
    FAILED_ROOT_STATE_GENERATION
  );
  assert.equal(
    input.request.failureEvidence.stateGeneration,
    POST_BIND_FAILURE_STATE_GENERATION
  );
  assert.doesNotThrow(() => validateAttemptTwoRearm(input));
});

test('rejects attempt three and drift outside the attempt field', () => {
  for (const mutate of [
    (value) => {
      value.request.binding.run.attempt = 3;
    },
    (value) => {
      value.request.binding.run.id += 1;
    },
    (value) => {
      value.request.binding.expectedSha = '0'.repeat(40);
    },
    (value) => {
      value.request.binding.repository.name = 'other/repository';
    },
  ]) {
    const hostile = fixture();
    mutate(hostile);
    assert.throws(() => validateAttemptTwoRearm(hostile), /binding|attempt/);
  }
});

test('rejects a caller-selected class or unbound root receipts', () => {
  for (const mutate of [
    (value) => {
      value.request.failureEvidence.code = 'OPERATOR_SELECTED';
    },
    (value) => {
      value.request.failureEvidence.rootRuntimeDigest = '0'.repeat(64);
    },
    (value) => {
      value.request.failureEvidence.restoreDigest = '0'.repeat(64);
    },
    (value) => {
      value.request.failureEvidence.stateGeneration = 8;
    },
    (value) => {
      value.request.failureEvidence.rootStateGeneration = 7;
    },
    (value) => {
      value.request.stateGeneration = 6;
    },
  ]) {
    const hostile = fixture();
    mutate(hostile);
    assert.throws(() => validateAttemptTwoRearm(hostile));
  }
});

test('requires a SHA commitment for jobs and exact prior binding for the run', () => {
  for (const mutate of [
    (value) => {
      value.request.failureEvidence.jobsDigest = 'not-a-sha';
    },
    (value) => {
      value.request.failureEvidence.runDigest = 'f'.repeat(64);
    },
  ]) {
    const hostile = fixture();
    mutate(hostile);
    assert.throws(() => validateAttemptTwoRearm(hostile), /failure evidence/);
  }
});

test('rejects nonterminal runtime, restore, and observation evidence', () => {
  for (const [key, replacement] of [
    ['runtimeBytes', { ...runtime, actionNodeObserved: true }],
    ['runtimeBytes', { ...runtime, runnerOffline: false }],
    ['restoreBytes', { ...restore, networkAbsent: false }],
    ['restoreBytes', { ...restore, processes: [{ pid: 1 }] }],
    ['restoreBytes', { ...restore, terminalProcessesSha256: '0'.repeat(64) }],
    ['runtimeBytes', { ...runtime, terminalProcessesSha256: '0'.repeat(64) }],
    [
      'observationBytes',
      { ...observation, listenerExitKind: 'operator-abort' },
    ],
  ]) {
    const hostile = fixture();
    hostile[key] = bytes(replacement);
    if (key === 'runtimeBytes')
      hostile.request.failureEvidence.rootRuntimeDigest = hash(hostile[key]);
    if (key === 'restoreBytes')
      hostile.request.failureEvidence.restoreDigest = hash(hostile[key]);
    assert.throws(() => validateAttemptTwoRearm(hostile));
  }
});

test('controller exposes a root-owned rearm gate before a second begin', async () => {
  const controller = await readFile(
    new URL('./exact-run-controller.sh', import.meta.url),
    'utf8'
  );
  assert.match(controller, /--rearm/);
  assert.match(controller, /exact-run-rearm-contract\.mjs/);
  assert.match(controller, /run\.attempt == 2/);
  assert.match(controller, /rearm-authorization\.json/);
  assert.match(controller, /attempt-1/);
  assert.match(controller, /release-installed\.json/);
  assert.match(controller, /transition-evidence/);
  const rearm = controller.slice(controller.indexOf('rearm()'));
  const markerIndex = rearm.indexOf('write_receipt "$marker"');
  const archiveIndex = rearm.indexOf('/bin/mv -T "$directory" "$archive"');
  assert.ok(markerIndex >= 0 && archiveIndex >= 0);
  assert.ok(markerIndex < archiveIndex);
  assert.doesNotMatch(controller, /attempt-3/);
});
