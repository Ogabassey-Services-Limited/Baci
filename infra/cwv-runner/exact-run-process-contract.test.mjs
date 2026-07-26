import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProcessInventory } from './exact-run-contract.mjs';
import { processMapDigest } from './exact-run-process-contract.mjs';

const hex = (character) => character.repeat(64);
const phases = ['held', 'listener-idle', 'assigned', 'cleanup'];
const rules = [
  ['bash', '/usr/bin/bash', [1, 0, 1, 0]],
  ['runtimeNode', '/opt/node/bin/node', [1, 1, 1, 1]],
  ['listener', '/opt/runner/bin/Runner.Listener', [0, 1, 1, 1]],
  ['worker', '/opt/runner/bin/Runner.Worker', [0, 0, 1, 1]],
  ['pluginHost', '/opt/runner/bin/Runner.PluginHost', [0, 0, 1, 1]],
  ['actionNode', '/opt/runner/externals/node24/bin/node', [0, 0, 1, 1]],
  ['git', '/usr/bin/git', [0, 0, 1, 0]],
  ['gitRemoteHttps', '/usr/lib/git-core/git-remote-https', [0, 0, 1, 0]],
];

function fixture() {
  const processMap = {
    entries: rules.map(([role, path, maxInstancesByPhase], index) => ({
      maxInstancesByPhase,
      mode: '0755',
      owner: '0:0',
      path,
      realpath: path,
      role,
      sha256: hex(String((index + 1) % 10)),
    })),
    phases,
    receiptBinding: 'image-process-map-v1',
    schemaVersion: 1,
    sealed: [],
  };
  const identity = {
    cgroupPath: `/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope`,
    cpuset: '2-3',
    generation: 1,
    processMapSha256: processMapDigest(processMap),
    runnerContainerId: 'a'.repeat(64),
  };
  const process = (role, pid, parentPid, extra = {}) => {
    const entry = processMap.entries.find(
      (candidate) => candidate.role === role
    );
    return {
      cgroupPath: identity.cgroupPath,
      containerId: identity.runnerContainerId,
      cpuset: identity.cpuset,
      exe: entry.path,
      generation: identity.generation,
      parentPid,
      pid,
      role,
      sha256: entry.sha256,
      ...extra,
    };
  };
  return { identity, process, processMap };
}

test('requires every process to match the sealed map, container identity, phase maxima, and ancestry', () => {
  const value = fixture();
  const processes = [
    value.process('runtimeNode', 1, 0),
    value.process('listener', 2, 1),
    value.process('worker', 3, 2, { runId: 42 }),
    value.process('pluginHost', 4, 3),
    value.process('actionNode', 5, 4),
    value.process('git', 6, 5),
    value.process('gitRemoteHttps', 7, 6),
  ];
  assert.doesNotThrow(() =>
    validateProcessInventory({
      busy: true,
      expectedRunId: 42,
      identity: value.identity,
      phase: 'assigned',
      processMap: value.processMap,
      processes,
    })
  );
  for (const [_name, mutation] of [
    [
      'unknown executable',
      (items) => {
        items[4].exe = '/tmp/node';
      },
    ],
    [
      'wrong executable hash',
      (items) => {
        items[4].sha256 = hex('0');
      },
    ],
    [
      'wrong cgroup ancestry',
      (items) => {
        items[4].cgroupPath = '/system.slice/other.scope';
      },
    ],
    [
      'wrong cpuset',
      (items) => {
        items[4].cpuset = '0-1';
      },
    ],
    [
      'duplicate role beyond maximum',
      (items) => items.push(value.process('worker', 8, 2, { runId: 42 })),
    ],
    [
      'unapproved parent',
      (items) => {
        items[5].parentPid = 999;
      },
    ],
  ]) {
    const invalid = structuredClone(processes);
    mutation(invalid);
    assert.throws(
      () =>
        validateProcessInventory({
          busy: true,
          expectedRunId: 42,
          identity: value.identity,
          phase: 'assigned',
          processMap: value.processMap,
          processes: invalid,
        }),
      /process/
    );
  }
});

test('rejects map generation drift, forbidden phase processes, and mismatched run process identity', () => {
  const value = fixture();
  const listener = value.process('listener', 2, 1);
  const runtime = value.process('runtimeNode', 1, 0);
  assert.doesNotThrow(() =>
    validateProcessInventory({
      busy: false,
      expectedRunId: 42,
      identity: value.identity,
      phase: 'listener-idle',
      processMap: value.processMap,
      processes: [runtime, listener],
    })
  );
  assert.throws(
    () =>
      validateProcessInventory({
        busy: false,
        expectedRunId: 42,
        identity: { ...value.identity, generation: 2 },
        phase: 'listener-idle',
        processMap: value.processMap,
        processes: [runtime, listener],
      }),
    /process/
  );
  assert.throws(
    () =>
      validateProcessInventory({
        busy: false,
        expectedRunId: 42,
        identity: value.identity,
        phase: 'listener-idle',
        processMap: value.processMap,
        processes: [
          runtime,
          listener,
          value.process('worker', 3, 2, { runId: 42 }),
        ],
      }),
    /phase/
  );
  assert.throws(
    () =>
      validateProcessInventory({
        busy: true,
        expectedRunId: 42,
        identity: value.identity,
        phase: 'assigned',
        processMap: value.processMap,
        processes: [
          runtime,
          listener,
          value.process('worker', 3, 2, { runId: 43 }),
        ],
      }),
    /run/
  );
  assert.throws(
    () =>
      validateProcessInventory({
        busy: true,
        expectedRunId: 42,
        identity: value.identity,
        phase: 'cleanup',
        processMap: value.processMap,
        processes: [
          runtime,
          listener,
          value.process('worker', 3, 2, { runId: 43 }),
        ],
      }),
    /run/
  );
});

test('rejects stale or foreign measurement cgroups even when every process agrees', () => {
  const value = fixture();
  for (const cgroupPath of [
    '/system.slice/baci-cwv-measurement.service/docker-stale.scope',
    `/cwv-measurement.slice/docker-${'b'.repeat(64)}.scope`,
  ]) {
    const identity = { ...value.identity, cgroupPath };
    const processes = [
      value.process('runtimeNode', 1, 0, { cgroupPath }),
      value.process('listener', 2, 1, { cgroupPath }),
    ];
    assert.throws(
      () =>
        validateProcessInventory({
          busy: false,
          expectedRunId: 42,
          identity,
          phase: 'listener-idle',
          processMap: value.processMap,
          processes,
        }),
      /process identity/
    );
  }
});
