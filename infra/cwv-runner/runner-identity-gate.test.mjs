import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pinnedRunnerIdentity } from './policy.schema.mjs';
import * as runnerIdentityGate from './runner-identity-gate.mjs';

const { readAdmission, validateRunnerIdentity } = runnerIdentityGate;

const admissionId = 'a'.repeat(64);
const record = {
  admissionId,
  campaignId: 'campaign-01',
  expectedSha: 'b'.repeat(40),
  expiresMonotonicSeconds: 120,
  kind: 'allow',
  policyFileSha256: 'c'.repeat(64),
  repository: {
    id: 1100488586,
    name: 'ogabasseyy/Baci',
  },
  run: {
    attempt: 1,
    id: 123,
  },
  runner: {
    generation: 1,
    id: 456,
    name: 'baci-cwv-measurement-01',
  },
  schemaVersion: 1,
  workflow: {
    id: 789,
    job: 'attest',
    path: '.github/workflows/cwv-runner-attestation.yml',
    ref: 'refs/heads/main',
  },
};
const values = {
  admissionId,
  job: 'attest',
  ref: 'refs/heads/main',
  repository: 'ogabasseyy/Baci',
  repositoryId: '1100488586',
  runAttempt: '1',
  runId: '123',
  runnerArch: 'X64',
  runnerName: 'baci-cwv-measurement-01',
  runnerOs: 'Linux',
  sha: 'b'.repeat(40),
  workflowRef:
    'ogabasseyy/Baci/.github/workflows/cwv-runner-attestation.yml@refs/heads/main',
  workflowSha: 'b'.repeat(40),
};

test('accepts the exact sealed admission and emits only Boolean/digest evidence', () => {
  const receipt = validateRunnerIdentity(record, values);
  assert.deepEqual(Object.keys(receipt), ['admissionSha256', 'ok']);
  assert.match(receipt.admissionSha256, /^[0-9a-f]{64}$/);
  assert.equal(receipt.ok, true);
});

test('derives the pinned runner name and group from the sealed policy', () => {
  assert.deepEqual(pinnedRunnerIdentity, {
    runnerGid: 10001,
    runnerName: 'baci-cwv-measurement-01',
  });
});

test('closes the admission descriptor when reading rejects', () => {
  assert.equal(typeof readAdmission, 'function');
  for (const [name, fstat, read, error] of [
    [
      'fstat',
      () => {
        throw new TypeError('fstat refused');
      },
      () => {
        throw new Error('read should not run');
      },
      /fstat refused/,
    ],
    [
      'identity',
      () => ({
        gid: pinnedRunnerIdentity.runnerGid,
        isFile: () => false,
        isSymbolicLink: () => false,
        mode: 0o100440,
        uid: 0,
      }),
      () => {
        throw new Error('read should not run');
      },
      /admission file identity refused/,
    ],
    [
      'parse',
      () => ({
        gid: pinnedRunnerIdentity.runnerGid,
        isFile: () => true,
        isSymbolicLink: () => false,
        mode: 0o100440,
        uid: 0,
      }),
      () => '{',
      SyntaxError,
    ],
  ]) {
    const closed = [];
    assert.throws(
      () =>
        readAdmission('/ignored', {
          close: (descriptor) => closed.push(descriptor),
          fstat,
          open: () => 42,
          read,
        }),
      error,
      name
    );
    assert.deepEqual(closed, [42], name);
  }
});

test('refuses the absent, wrong-owner, wrong-group, and wrong-mode active receipt', () => {
  assert.throws(
    () =>
      readAdmission('/run/baci-cwv-admission/active.json', {
        close: () => undefined,
        fstat: () => {
          throw new Error('not found');
        },
        open: () => {
          throw new Error('not found');
        },
        read: () => {
          throw new Error('read should not run');
        },
      }),
    /not found/
  );
  for (const [name, info] of [
    ['owner', { uid: 1 }],
    ['group', { gid: 1 }],
    ['mode', { mode: 0o100400 }],
    ['symbolic link', { isSymbolicLink: () => true }],
    ['non-regular file', { isFile: () => false }],
  ])
    assert.throws(
      () =>
        readAdmission('/run/baci-cwv-admission/active.json', {
          close: () => undefined,
          fstat: () => ({
            gid: pinnedRunnerIdentity.runnerGid,
            isFile: () => true,
            isSymbolicLink: () => false,
            mode: 0o100440,
            uid: 0,
            ...info,
          }),
          open: () => 1,
          read: () => {
            throw new Error('read should not run');
          },
        }),
      /admission file identity refused/,
      name
    );
});

test('rejects every admission, run, and runner identity drift', () => {
  for (const [name, changedRecord, changedValues] of [
    [
      'uppercase admission',
      record,
      { ...values, admissionId: admissionId.toUpperCase() },
    ],
    [
      'runner name',
      { ...record, runner: { ...record.runner, name: 'other' } },
      values,
    ],
    ['runner os', record, { ...values, runnerOs: 'Windows' }],
    ['runner arch', record, { ...values, runnerArch: 'ARM64' }],
    ['repository', record, { ...values, repository: 'other/repo' }],
    ['repository id', record, { ...values, repositoryId: '42' }],
    ['run id', record, { ...values, runId: '124' }],
    ['ref', record, { ...values, ref: 'refs/heads/other' }],
    ['sha', record, { ...values, sha: 'd'.repeat(40) }],
    [
      'workflow ref',
      record,
      { ...values, workflowRef: values.workflowRef.replace('main', 'other') },
    ],
    ['workflow sha', record, { ...values, workflowSha: 'c'.repeat(40) }],
    ['run attempt', record, { ...values, runAttempt: '2' }],
    ['job', record, { ...values, job: 'other' }],
    ['extra record key', { ...record, extra: true }, values],
  ])
    assert.throws(
      () => validateRunnerIdentity(changedRecord, changedValues),
      /refused/,
      name
    );
});

test('rejects the obsolete flat admission contract', () => {
  const obsolete = {
    admissionId,
    job: values.job,
    ref: values.ref,
    repository: values.repository,
    repositoryId: Number(values.repositoryId),
    runAttempt: Number(values.runAttempt),
    runId: Number(values.runId),
    runnerArch: values.runnerArch,
    runnerGeneration: 1,
    runnerId: record.runner.id,
    runnerName: values.runnerName,
    runnerOs: values.runnerOs,
    schemaVersion: 1,
    sha: values.sha,
    workflowRef: values.workflowRef,
    workflowSha: values.workflowSha,
  };

  assert.throws(
    () => validateRunnerIdentity(obsolete, values),
    /admission schema refused/
  );
});

test('rejects nested allow schema, authority, and runner generation drift', () => {
  const { id: _repositoryId, ...repositoryMissingId } = record.repository;
  for (const [name, changedRecord] of [
    ['missing repository id', { ...record, repository: repositoryMissingId }],
    [
      'extra workflow key',
      { ...record, workflow: { ...record.workflow, extra: true } },
    ],
    [
      'runner generation is not exactly one',
      { ...record, runner: { ...record.runner, generation: 2 } },
    ],
    [
      'runner id is not positive',
      { ...record, runner: { ...record.runner, id: 0 } },
    ],
    ['wrong kind', { ...record, kind: 'deny' }],
    ['wrong schema', { ...record, schemaVersion: 2 }],
    ['invalid expiry', { ...record, expiresMonotonicSeconds: Number.NaN }],
    ['invalid policy digest', { ...record, policyFileSha256: 'not-a-digest' }],
    [
      'blank workflow job',
      { ...record, workflow: { ...record.workflow, job: '' } },
    ],
    [
      'wrong workflow path',
      {
        ...record,
        workflow: { ...record.workflow, path: '.github/workflows/other.yml' },
      },
    ],
  ]) {
    assert.throws(
      () => validateRunnerIdentity(changedRecord, values),
      /refused/,
      name
    );
  }
});

test('source reads only named environment keys and no event body or argv input', () => {
  const source = readFileSync(
    new URL('runner-identity-gate.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /Object\.(keys|entries|values)\(process\.env\)/);
  assert.match(source, /environmentBindings\.map\(\(\[key, name\]\)/);
  assert.doesNotMatch(
    source,
    /GITHUB_EVENT_PATH|readFileSync\(process\.env|process\.argv\[2\]/
  );
  assert.match(source, /BACI_CWV_ADMISSION_ID/);
  assert.match(source, /\/run\/baci-cwv-admission\/active\.json/);
  assert.doesNotMatch(source, /\/run\/baci-cwv-admission\/admission\.json/);
  assert.match(source, /process\.argv\.length !== 2/);
  assert.match(source, /finally\s*\{\s*filesystem\.close\(descriptor\)/);
});
