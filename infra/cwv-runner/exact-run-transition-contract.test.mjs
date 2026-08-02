import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  canonicalTransitionJson,
  readRootReceipt,
  validateTransportLossTransition,
} from './exact-run-transition-contract.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const canonicalBytes = (value) => Buffer.from(canonicalTransitionJson(value));
const binding = Object.freeze({
  admissionId: 'a'.repeat(64),
  campaignId: 'campaign-001',
  run: { attempt: 2, id: 42 },
});
const trigger = Object.freeze({
  admissionId: binding.admissionId,
  attempt: binding.run.attempt,
  runId: binding.run.id,
  schemaVersion: 1,
  stateGeneration: 7,
});
const releaseBytes = canonicalBytes({ release: 'root-local' });
const coverage = Object.freeze({
  endedMonotonicSeconds: 140,
  startedMonotonicSeconds: 100,
});
const common = Object.freeze({
  admissionId: binding.admissionId,
  attempt: binding.run.attempt,
  campaignId: binding.campaignId,
  coverage,
  releaseSha256: sha(releaseBytes),
  runId: binding.run.id,
  schemaVersion: 1,
});

function fixture() {
  const values = {
    actionNode: { ...common, kind: 'action-node', observed: false },
    jobStartHook: { ...common, kind: 'job-start-hook', observed: false },
    listenerTerminal: {
      ...common,
      exitKind: 'transport-lost',
      exitStatus: 1,
      kind: 'listener-terminal',
      observed: true,
    },
    terminalProcesses: {
      ...common,
      kind: 'terminal-processes',
      processes: [],
    },
  };
  const sources = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, canonicalBytes(value)])
  );
  const aggregate = {
    ...common,
    coverageComplete: true,
    findings: [],
    sourceDigests: Object.fromEntries(
      Object.entries(sources).map(([key, value]) => [key, sha(value)])
    ),
  };
  return {
    aggregateBytes: canonicalBytes(aggregate),
    binding,
    releaseBytes,
    sources,
    trigger: { ...trigger },
  };
}

test('accepts only complete root-observed transport-loss evidence', () => {
  const accepted = validateTransportLossTransition(fixture());
  assert.deepEqual(accepted, {
    actionNodeObserved: false,
    admissionId: binding.admissionId,
    attempt: 2,
    findings: [],
    jobStartHookObserved: false,
    listenerExitKind: 'transport-lost',
    runId: 42,
    schemaVersion: 1,
    stateGeneration: 7,
    terminalProcessesSha256: sha(fixture().sources.terminalProcesses),
  });
});

test('rejects caller classification and incomplete source coverage', () => {
  const classified = fixture();
  classified.trigger = { ...classified.trigger, phase: 'transport-lost' };
  assert.throws(
    () => validateTransportLossTransition(classified),
    /abort trigger/
  );
  for (const key of Object.keys(fixture().sources)) {
    const missing = fixture();
    delete missing.sources[key];
    assert.throws(
      () => validateTransportLossTransition(missing),
      /source evidence/
    );
  }
});

test('rejects observed work, ambiguous listener exits, and surviving processes', () => {
  for (const [key, replacement] of [
    ['jobStartHook', { observed: true }],
    ['actionNode', { observed: true }],
    ['listenerTerminal', { exitKind: 'unknown' }],
    ['listenerTerminal', { exitStatus: 0 }],
    ['terminalProcesses', { processes: [{ pid: 9 }] }],
  ]) {
    const hostile = fixture();
    const value = JSON.parse(hostile.sources[key].toString('utf8'));
    hostile.sources[key] = canonicalBytes({ ...value, ...replacement });
    const aggregate = JSON.parse(hostile.aggregateBytes.toString('utf8'));
    aggregate.sourceDigests[key] = sha(hostile.sources[key]);
    hostile.aggregateBytes = canonicalBytes(aggregate);
    assert.throws(
      () => validateTransportLossTransition(hostile),
      /(?:transport-loss evidence|listener exit status)/
    );
  }
});

test('rejects binding, release, digest, canonical, and coverage drift', () => {
  const mutations = [
    (value) => {
      value.trigger.runId += 1;
    },
    (value) => {
      value.releaseBytes = Buffer.from('{}');
    },
    (value) => {
      value.sources.actionNode = Buffer.from(
        `${value.sources.actionNode.toString('utf8')}\n`
      );
    },
    (value) => {
      const aggregate = JSON.parse(value.aggregateBytes.toString('utf8'));
      aggregate.sourceDigests.actionNode = '0'.repeat(64);
      value.aggregateBytes = canonicalBytes(aggregate);
    },
    (value) => {
      const source = JSON.parse(value.sources.actionNode.toString('utf8'));
      source.coverage.endedMonotonicSeconds -= 1;
      value.sources.actionNode = canonicalBytes(source);
      const aggregate = JSON.parse(value.aggregateBytes.toString('utf8'));
      aggregate.sourceDigests.actionNode = sha(value.sources.actionNode);
      value.aggregateBytes = canonicalBytes(aggregate);
    },
  ];
  for (const mutate of mutations) {
    const hostile = fixture();
    mutate(hostile);
    assert.throws(() => validateTransportLossTransition(hostile));
  }
});

test('rejects dishonest aggregate claims and extra findings', () => {
  for (const replacement of [
    { coverageComplete: false },
    { findings: ['owner-classified'] },
    { ownerAssertion: true },
  ]) {
    const hostile = fixture();
    hostile.aggregateBytes = canonicalBytes({
      ...JSON.parse(hostile.aggregateBytes.toString('utf8')),
      ...replacement,
    });
    assert.throws(() => validateTransportLossTransition(hostile));
  }
});

test('reads the opened root receipt despite a path substitution and symlink race', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'exact-receipt-'));
  const receipt = path.join(directory, 'receipt.json');
  const attacker = path.join(directory, 'attacker.json');
  await writeFile(receipt, 'trusted');
  await writeFile(attacker, 'attacker');
  let closed = false;
  try {
    const trusted = await readRootReceipt(receipt, async (file, flags) => {
      assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW);
      const handle = await open(file, flags);
      await rm(file);
      await symlink(attacker, file);
      return {
        close: async () => {
          closed = true;
          await handle.close();
        },
        readFile: () => handle.readFile(),
        stat: async () => {
          const metadata = await handle.stat();
          return {
            ...metadata,
            isFile: () => true,
            isSymbolicLink: () => false,
            mode: (metadata.mode & ~0o777) | 0o600,
            uid: 0,
          };
        },
      };
    });
    assert.equal(trusted.toString('utf8'), 'trusted');
    assert.equal(await readFile(receipt, 'utf8'), 'attacker');
    assert.equal(closed, true);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('closes a descriptor after rejecting invalid root receipt authority', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'exact-receipt-'));
  const receipt = path.join(directory, 'receipt.json');
  await writeFile(receipt, 'untrusted');
  let closed = false;
  try {
    await assert.rejects(
      readRootReceipt(receipt, async (file, flags) => {
        const handle = await open(file, flags);
        return {
          close: async () => {
            closed = true;
            await handle.close();
          },
          readFile: () => handle.readFile(),
          stat: async () => handle.stat(),
        };
      }),
      /root evidence authority/
    );
    assert.equal(closed, true);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
