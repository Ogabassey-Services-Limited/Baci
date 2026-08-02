import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateHostControlEvidence } from './host-control-evidence.mjs';

const contract = (cpuQuota) => ({
  fields: {
    controlCgroup: {
      expectation: {
        cpus: '2-3',
        cpuQuota,
        ioWeight: 10,
        memoryMax: 2147483648,
        memorySwapMax: 0,
        tasksMax: 256,
      },
    },
    measurementCgroup: {
      expectation: {
        cpuAccounting: 'yes',
        cpus: '2-3',
        ioAccounting: 'yes',
        memoryAccounting: 'yes',
        memoryMax: 8589934592,
        memorySwapMax: 0,
        tasksMax: 1024,
      },
    },
  },
});

const policy = (cpuQuotaPercent) => ({
  installationImport: {
    cpuQuotaPercent,
    cpuSet: '2-3',
    ioWeight: 10,
    memoryBytes: 2147483648,
    memorySwapBytes: 0,
    pidsLimit: 256,
  },
  resources: {
    measurementCpuSet: '2-3',
    memoryBytes: 8589934592,
    memorySwapBytes: 0,
    pidsLimit: 1024,
  },
  supplyChain: { runner: { sha256: 'a'.repeat(64), version: '2.335.1' } },
});

const evidence = (
  cpuQuotaPerSecUsec,
  cpuMax,
  runner = { sha256: 'a'.repeat(64), version: '2.335.1' }
) => ({
  binary: {
    mode: '0550',
    path: '/srv/baci-cwv/sealed/actions-runner/bin/Runner.Listener',
    sha256: 'b'.repeat(64),
    symlink: false,
    uidGid: '0:10001',
    version: runner.version,
  },
  configured: {
    control: {
      AllowedCPUs: '2-3',
      CPUQuotaPerSecUSec: cpuQuotaPerSecUsec,
      IOWeight: '10',
      MemoryMax: '2147483648',
      MemorySwapMax: '0',
      TasksMax: '256',
    },
    measurement: {
      AllowedCPUs: '2-3',
      CPUAccounting: 'yes',
      IOAccounting: 'yes',
      MemoryAccounting: 'yes',
      MemoryMax: '8589934592',
      MemorySwapMax: '0',
      TasksMax: '1024',
    },
  },
  effective: {
    control: {
      'cpu.max': cpuMax,
      'cpuset.cpus.effective': '2-3',
      'io.weight': 'default 10',
      'memory.max': '2147483648',
      'memory.swap.max': '0',
      'pids.max': '256',
    },
    measurement: {
      'cpuset.cpus.effective': '2-3',
      'memory.max': '8589934592',
      'memory.swap.max': '0',
      'pids.max': '1024',
    },
  },
  runnerArchiveSha256: runner.sha256,
});

test('binds configured CPUQuotaPerSecUSec to each policy quota', async () => {
  const currentPolicy = JSON.parse(
    await readFile(new URL('./policy.json', import.meta.url), 'utf8')
  );
  assert.doesNotThrow(() =>
    validateHostControlEvidence(
      currentPolicy,
      contract(`${currentPolicy.installationImport.cpuQuotaPercent}%`),
      evidence('1s', '100000 100000', currentPolicy.supplyChain.runner)
    )
  );
  assert.doesNotThrow(() =>
    validateHostControlEvidence(
      policy(50),
      contract('50%'),
      evidence('500ms', '50000 100000')
    )
  );
  assert.throws(
    () =>
      validateHostControlEvidence(
        policy(50),
        contract('50%'),
        evidence('500ms', '100000 100000')
      ),
    /control cpu\.max/
  );
  assert.throws(
    () =>
      validateHostControlEvidence(
        policy(50),
        contract('50%'),
        evidence('1s', '50000 100000')
      ),
    /control CPUQuotaPerSecUSec/
  );
});

test('refuses unexpected configured and effective cgroup envelopes', () => {
  for (const envelope of ['configured', 'effective']) {
    const hostile = evidence('500ms', '50000 100000');
    hostile[envelope].unexpected = {};
    assert.throws(
      () => validateHostControlEvidence(policy(50), contract('50%'), hostile),
      new RegExp(`invalid ${envelope} cgroups`)
    );
  }
});
