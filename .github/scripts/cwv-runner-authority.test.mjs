import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  canonicalJson,
  projectPublicAttestation,
  verifyPublicArtifact,
  verifyRunnerAuthority,
  writeProjectedAttestation,
} from './cwv-runner-authority.mjs';

const sha = 'a'.repeat(64);
const policy = {
  artifactRetentionDays: 90,
  repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
  runner: {
    name: 'baci-cwv-measurement-01',
    labels: ['self-hosted', 'Linux', 'X64', 'baci-cwv-measurement'],
  },
  ruleset: {
    name: 'ogabassey-rollout-progress-immutable',
    target: 'tag',
    enforcement: 'active',
    tagIncludes: [
      'refs/tags/ogabassey-rollout-claim/*',
      'refs/tags/ogabassey-rollout-progress/**/*',
      'refs/tags/ogabassey-semantic-admission/*',
    ],
    tagExcludes: [],
    rules: ['update', 'deletion'],
    bypassActors: [],
  },
};

function validInput() {
  return {
    policy,
    runnerInventory: [{
      id: 7,
      name: policy.runner.name,
      status: 'online',
      busy: true,
      os: 'Linux',
      architecture: 'X64',
      labels: policy.runner.labels.map((name) => ({ name })),
      generation: 3,
    }],
    repositoryRetention: { days: 90, maximum_allowed_days: 90 },
    workflowRetentionDays: 90,
    appPermissions: { administration: 'read', metadata: 'read' },
    ruleset: {
      name: policy.ruleset.name,
      target: 'tag',
      enforcement: 'active',
      conditions: {
        ref_name: {
          include: policy.ruleset.tagIncludes,
          exclude: [],
        },
      },
      rules: policy.ruleset.rules.map((type) => ({ type })),
      bypass_actors: [],
    },
    localAttestation: { runnerId: 7, runnerGeneration: 3, workerCount: 1 },
    artifactLifetimeSeconds: 90 * 24 * 60 * 60,
  };
}

function validPrivateAttestation() {
  const input = {
    repository: policy.repository,
    workflow: {
      runId: 12,
      attempt: 1,
      publicRunUrl: 'https://github.com/ogabasseyy/Baci/actions/runs/12',
      headSha: 'b'.repeat(40),
      ref: 'refs/heads/main',
      job: 'attest',
    },
    runner: { id: 7, name: policy.runner.name, generation: 3 },
    resources: {
      ollamaCgroupMemoryCurrentBytesBefore: 8,
      ollamaCgroupMemoryCurrentBytesAfter: 0,
      hostMemAvailableBytesBefore: 8,
      hostMemAvailableBytesAfter: 16,
      modelStoreAllocatedBytesBefore: 8,
      rootFreeBytesBefore: 8,
      rootFreeBytesAfter: 16,
      recoveredDiskBytes: 8,
    },
    retention: {
      repositoryDays: 90, maximumAllowedDays: 90, workflowDays: 90,
      artifactLifetimeSeconds: 7776000, createdAt: 'private timestamp',
    },
    digests: Object.fromEntries([
      'policyFileSha256', 'policyCanonicalSha256', 'sourceManifestSha256', 'imageSha256',
      'processMapSha256', 'serviceSha256', 'scriptsSha256', 'appPermissionsSha256',
      'rulesetSha256', 'runnerInventorySha256', 'hostAttestationSha256', 'liveSampleSha256',
      'admissionSha256', 'holdSha256', 'restoreSha256', 'ollamaRetirementSha256', 'runnerIdentitySha256',
    ].map((key) => [key, sha])),
    failureMatrix: Object.fromEntries([
      'offlineRunner', 'labelUniqueness', 'hostedRunner', 'concurrentJob', 'lease',
      'serviceRestart', 'reboot', 'softwareIdentity', 'egressDnsLocaleTimezone', 'cpuSet',
      'thresholds', 'appPermissions', 'ruleset', 'retention', 'artifactReadback', 'rollback',
      'doubleRestore', 'networkIsolation', 'supplyChain', 'retirementIdentity',
    ].map((key) => [key, true])),
    noMeasurement: true,
    rawLiveSample: { private: true },
    authorization: 'never public',
  };
  input.digests.runnerIdentitySha256 = createHash('sha256').update(canonicalJson(input.runner)).digest('hex');
  return input;
}

test('accepts only the single online busy selected runner with exact authority', () => {
  assert.deepEqual(verifyRunnerAuthority(validInput()), []);
});

test('rejects an offline duplicate label and over-scoped App permission', () => {
  const input = validInput();
  input.runnerInventory.push({ ...input.runnerInventory[0], id: 8, status: 'offline' });
  input.appPermissions.issues = 'read';
  const codes = verifyRunnerAuthority(input).map(({ code }) => code);
  assert.deepEqual(codes, ['LABEL_UNIQUENESS', 'APP_PERMISSIONS']);
});

test('rejects retention and ruleset drift including a creation-only ruleset', () => {
  const input = validInput();
  input.repositoryRetention.maximum_allowed_days = 89;
  input.workflowRetentionDays = 89;
  input.artifactLifetimeSeconds -= 301;
  input.ruleset.rules = [{ type: 'creation' }, { type: 'deletion' }];
  const codes = verifyRunnerAuthority(input).map(({ code }) => code);
  assert.deepEqual(codes, ['RETENTION', 'RULESET']);
});

test('rejects a policy and readback that collude by adding tag creation protection', () => {
  const input = validInput();
  const rules = ['creation', ...policy.ruleset.rules];
  input.policy = { ...policy, ruleset: { ...policy.ruleset, rules } };
  input.ruleset.rules = rules.map((type) => ({ type }));
  assert.deepEqual(verifyRunnerAuthority(input).map(({ code }) => code), ['RULESET']);
});

test('rejects readback-only tag creation protection', () => {
  const input = validInput();
  input.ruleset.rules = ['creation', ...policy.ruleset.rules].map((type) => ({ type }));
  assert.deepEqual(verifyRunnerAuthority(input).map(({ code }) => code), ['RULESET']);
});

test('refuses a policy and ruleset that agree on incomplete protected-tag semantics', () => {
  const input = validInput();
  const drifted = {
    ...policy.ruleset,
    bypassActors: [{ actor_id: 7, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
    rules: ['update', 'deletion'],
    tagExcludes: ['refs/tags/ogabassey-rollout-progress/temporary/*'],
    tagIncludes: ['refs/tags/ogabassey-rollout-claim/*'],
  };
  input.policy = { ...policy, ruleset: drifted };
  input.ruleset = {
    name: drifted.name,
    target: drifted.target,
    enforcement: drifted.enforcement,
    conditions: { ref_name: { include: drifted.tagIncludes, exclude: drifted.tagExcludes } },
    rules: drifted.rules.map((type) => ({ type })),
    bypass_actors: drifted.bypassActors,
  };
  assert.deepEqual(verifyRunnerAuthority(input).map(({ code }) => code), ['RULESET']);
});

test('projects an explicit closed public object without private inputs', () => {
  const projection = projectPublicAttestation(validPrivateAttestation());
  assert.deepEqual(Object.keys(projection), [
    'schemaVersion', 'repository', 'workflow', 'runner', 'resources', 'retention',
    'digests', 'failureMatrix', 'noMeasurement',
  ]);
  assert.equal('rawLiveSample' in projection, false);
  assert.equal('createdAt' in projection.retention, false);
  assert.equal(projection.noMeasurement, true);
  assert.equal(Object.keys(projection.digests).length, 16);
  assert.equal('runnerIdentitySha256' in projection.digests, false);
});

test('writes and readbacks the sole canonical public member, rejecting extras', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cwv-authority-'));
  const projectedPath = await writeProjectedAttestation(directory, validPrivateAttestation());
  const bytes = await readFile(projectedPath);
  assert.doesNotThrow(() => verifyPublicArtifact({
    members: [{ name: 'h0-runner-attestation.json', type: 'file', mode: 0o644, bytes }],
  }));
  await writeFile(join(directory, 'private.json'), '{}');
  assert.throws(() => verifyPublicArtifact({
    members: [
      { name: 'h0-runner-attestation.json', type: 'file', mode: 0o644, bytes },
      { name: 'private.json', type: 'file', mode: 0o644, bytes: Buffer.from('{}') },
    ],
  }), /exactly one/);
});

test('rejects noncanonical, secret-shaped, and raw-timestamp public content', () => {
  const projection = projectPublicAttestation(validPrivateAttestation());
  const bytes = Buffer.from(JSON.stringify({ ...projection, token: 'secret' }));
  assert.throws(() => verifyPublicArtifact({
    members: [{ name: 'h0-runner-attestation.json', type: 'file', mode: 0o644, bytes }],
  }), /canonical|forbidden|keys/);
});

test('rejects links and extension metadata even with the approved member name', () => {
  const bytes = Buffer.from(canonicalJson(projectPublicAttestation(validPrivateAttestation())));
  assert.throws(() => verifyPublicArtifact({
    members: [{ name: 'h0-runner-attestation.json', type: 'file', mode: 0o644, bytes, isSymlink: true }],
  }), /invalid artifact member/);
});
