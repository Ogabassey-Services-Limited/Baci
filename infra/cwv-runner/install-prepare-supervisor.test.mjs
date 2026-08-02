import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runPrepareSupervisor,
  verifyPrepareSupervisorSample,
} from './install-prepare-supervisor.mjs';

const baseline = {
  campaignCaptureSha256: 'a'.repeat(64),
  productionIdentitySha256: 'b'.repeat(64),
  firewallIdentitySha256: 'c'.repeat(64),
  dedicatedSocket: '/run/baci-cwv/docker.sock',
  sampleSeconds: 2,
  thresholds: {
    availableMemoryBytesMin: 6_442_450_944,
    rootFreeBytesMin: 32_212_254_720,
    cpuPsiFullAvg10Max: 0,
    memoryPsiFullAvg10Max: 0,
    ioPsiFullAvg10Max: 0.1,
  },
};

const safeObservation = {
  elapsedMilliseconds: 1_900,
  campaignCaptureSha256: 'a'.repeat(64),
  productionIdentitySha256: 'b'.repeat(64),
  firewallIdentitySha256: 'c'.repeat(64),
  dedicatedSocket: '/run/baci-cwv/docker.sock',
  availableMemoryBytes: 7_000_000_000,
  rootFreeBytes: 40_000_000_000,
  psi: { cpu: 0, memory: 0, io: 0.05 },
  workers: [
    {
      pid: 42,
      executable: '/usr/bin/dockerd',
      cgroup: '0::/cwv-measurement-control.slice/baci-cwv-docker.service',
    },
  ],
};

test('accepts only bounded attributed dedicated-runtime samples', () => {
  const result = verifyPrepareSupervisorSample(baseline, {
    ...safeObservation,
  });
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.value.accepted, true);
});

test('fails closed on drift, slow sampling, or unattributed workers', () => {
  for (const patch of [
    { elapsedMilliseconds: 2_001 },
    { productionIdentitySha256: 'd'.repeat(64) },
    { availableMemoryBytes: 6_000_000_000 },
    { psi: { cpu: 0.01, memory: 0, io: 0 } },
    { psi: { cpu: null, memory: 0, io: 0 } },
    { psi: { cpu: -0.01, memory: 0, io: 0 } },
    { psi: { cpu: Number.NaN, memory: 0, io: 0 } },
    { workers: [{ ...safeObservation.workers[0], cgroup: '/system.slice' }] },
    {
      workers: [
        {
          ...safeObservation.workers[0],
          cgroup:
            '0::/foreign.slice/cwv-measurement-control.slice/baci-cwv-docker.service',
        },
      ],
    },
    {
      workers: [{ ...safeObservation.workers[0], executable: '/tmp/dockerd' }],
    },
    {
      workers: [
        {
          ...safeObservation.workers[0],
          cgroup:
            '0::/cwv-measurement-control.slice/baci-cwv-docker.service\n0::/foreign.slice',
        },
      ],
    },
  ]) {
    assert.throws(
      () =>
        verifyPrepareSupervisorSample(baseline, {
          ...safeObservation,
          ...patch,
        }),
      /supervisor/
    );
  }
});

test('samples continuously and fails on the first live safety breach', async () => {
  let calls = 0;
  await assert.rejects(
    runPrepareSupervisor({
      baseline,
      collect: () => {
        calls += 1;
        return calls < 3
          ? safeObservation
          : { ...safeObservation, firewallIdentitySha256: 'f'.repeat(64) };
      },
      sleep: () => Promise.resolve(),
      shouldStop: () => calls >= 4,
    }),
    /supervisor/
  );
  assert.equal(calls, 3);
});

test('emits a digest-chain receipt only after multiple safe samples', async () => {
  let calls = 0;
  const result = await runPrepareSupervisor({
    baseline,
    collect: () => {
      calls += 1;
      return safeObservation;
    },
    sleep: () => Promise.resolve(),
    shouldStop: () => calls === 3,
  });
  assert.equal(result.value.sampleCount, 3);
  assert.match(result.value.lastSampleSha256, /^[0-9a-f]{64}$/);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});
