import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseCloudflareTrace,
  parseDns,
  parseLocale,
  parseLscpuSummary,
  parseMemTotal,
  parseOsRelease,
  validateHostControlEvidence,
} from './host-attestation-normalize.mjs';

const policy = {
  installationImport: {
    cpuQuotaPercent: 100,
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
};

const contract = {
  fields: {
    controlCgroup: {
      expectation: {
        cpus: '2-3',
        cpuQuota: '100%',
        ioWeight: 10,
        memoryMax: 2147483648,
        memorySwapMax: 0,
        tasksMax: 256,
      },
    },
    measurementCgroup: {
      expectation: {
        cpus: '2-3',
        cpuAccounting: 'yes',
        ioAccounting: 'yes',
        memoryAccounting: 'yes',
        memoryMax: 8589934592,
        memorySwapMax: 0,
        tasksMax: 1024,
      },
    },
  },
};

const control = (overrides = {}) => ({
  binary: {
    mode: '0550',
    path: '/srv/baci-cwv/sealed/actions-runner/bin/Runner.Listener',
    sha256: 'b'.repeat(64),
    symlink: false,
    uidGid: '0:10001',
    version: '2.335.1',
  },
  configured: {
    control: {
      AllowedCPUs: '2-3',
      CPUQuotaPerSecUSec: '1s',
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
      'cpuset.cpus.effective': '2-3',
      'cpu.max': '100000 100000',
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
  runnerArchiveSha256: 'a'.repeat(64),
  ...overrides,
});

test('accepts only an exact policy-bound binary and cgroup evidence projection', () => {
  assert.deepEqual(
    validateHostControlEvidence(policy, contract, control()),
    control()
  );
});

test('accepts copied Task 1 policy only when it cross-checks the sibling contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-policy-fixture-'));
  await Promise.all([
    copyFile(
      new URL('./policy.json', import.meta.url),
      path.join(root, 'policy.json')
    ),
    copyFile(
      new URL('./policy.schema.mjs', import.meta.url),
      path.join(root, 'policy.schema.mjs')
    ),
  ]);
  const copiedPolicy = JSON.parse(
    await readFile(path.join(root, 'policy.json'), 'utf8')
  );
  const identityContract = JSON.parse(
    await readFile(new URL('./identity-contract.json', import.meta.url), 'utf8')
  );
  const evidence = control({
    binary: {
      ...control().binary,
      version: copiedPolicy.supplyChain.runner.version,
    },
    runnerArchiveSha256: copiedPolicy.supplyChain.runner.sha256,
  });
  assert.deepEqual(
    validateHostControlEvidence(copiedPolicy, identityContract, evidence),
    evidence
  );
});

test('refuses timeout, missing, extra, and drifted host control fixtures', () => {
  assert.throws(
    () =>
      validateHostControlEvidence(policy, contract, control({ timeout: true })),
    /timeout/
  );
  const missing = control();
  delete missing.effective.measurement['pids.max'];
  assert.throws(
    () => validateHostControlEvidence(policy, contract, missing),
    /effective measurement/
  );
  const extra = control();
  extra.configured.control.Unexpected = '1';
  assert.throws(
    () => validateHostControlEvidence(policy, contract, extra),
    /configured control/
  );
  const drifted = control();
  drifted.effective.control['cpu.max'] = 'max 100000';
  assert.throws(
    () => validateHostControlEvidence(policy, contract, drifted),
    /control cpu\.max/
  );
  const binaryDrift = control();
  binaryDrift.binary.version = '2.335.2';
  assert.throws(
    () => validateHostControlEvidence(policy, contract, binaryDrift),
    /binary version/
  );
  const symlink = control();
  symlink.binary.symlink = true;
  assert.throws(
    () => validateHostControlEvidence(policy, contract, symlink),
    /runner binary symlink/
  );
  const genericMode = control();
  genericMode.binary.mode = '0755';
  assert.throws(
    () => validateHostControlEvidence(policy, contract, genericMode),
    /runner binary mode/
  );
});

test('normalizes lscpu labels with their documented trailing colons', () => {
  assert.deepEqual(
    parseLscpuSummary({
      lscpu: [
        { field: 'Architecture:', data: 'x86_64' },
        { field: 'CPU(s):', data: '4' },
      ],
    }),
    { Architecture: 'x86_64', 'CPU(s)': '4' }
  );
});

test('accepts only the exact DNS and locale projections', () => {
  assert.deepEqual(
    parseDns({
      defaultRoute: 'Link 2 (eth0): yes\n',
      servers: 'Link 2 (eth0): 1.1.1.1 8.8.4.4 145.14.155.10\n',
      status:
        'Global\n         Protocols: -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported\n  resolv.conf mode: stub\nLink 2 (eth0)\n',
    }),
    {
      defaultRoute: 'yes',
      dnssec: 'DNSSEC=no/unsupported',
      protocols: '-LLMNR,-mDNS,-DNSOverTLS',
      resolvConf: 'stub',
      servers: ['1.1.1.1', '8.8.4.4', '145.14.155.10'],
    }
  );
  assert.throws(() =>
    parseDns({
      defaultRoute: 'Link 2 (eth0): yes\n',
      servers: 'Link 2 (eth0): 1.1.1.1 1.1.1.1\n',
      status:
        'Global\n Protocols: -LLMNR DNSSEC=no/unsupported\n resolv.conf mode: stub\n',
    })
  );
  assert.deepEqual(
    parseDns({
      defaultRoute: 'Link 2 (eth0): yes\n',
      servers: 'Link 2 (eth0): 145.14.155.10 8.8.4.4 1.1.1.1\n',
      status:
        'Global\n Protocols: -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported\n resolv.conf mode: stub\n',
    }).servers,
    ['1.1.1.1', '8.8.4.4', '145.14.155.10']
  );
  assert.deepEqual(
    parseLocale({
      charmap: 'UTF-8\n',
      status: 'System Locale: LANG=C.UTF-8\n    VC Keymap: n/a\n',
    }),
    {
      charmap: 'UTF-8',
      lang: 'C.UTF-8',
    }
  );
  assert.throws(() =>
    parseLocale({
      charmap: 'UTF-8\n',
      status: 'System Locale: LANG=C.UTF-8\nSystem Locale: LANG=C.UTF-8\n',
    })
  );
});

test('requires the exact MemTotal row and unquotes os-release values', () => {
  assert.equal(parseMemTotal('MemTotal:       16376040 kB\n'), 16376040);
  assert.throws(() => parseMemTotal('MemTotal: 1 kB\nextra\n'));
  assert.deepEqual(parseOsRelease('ID="ubuntu"\nVERSION_ID="24.04"\n'), {
    ID: 'ubuntu',
    VERSION_ID: '24.04',
  });
});

test('refuses duplicate, extra, and malformed Cloudflare trace keys', () => {
  assert.deepEqual(
    parseCloudflareTrace(
      'fl=29f167\nh=www.cloudflare.com\nip=82.29.190.219\nts=1\nvisit_scheme=https\nuag=fixture\ncolo=LHR\nsliver=none\nhttp=http/2\nloc=GB\ntls=TLSv1.3\nsni=plaintext\nwarp=off\ngateway=off\nrbi=off\nkex=X25519\n'
    ),
    { ip: '82.29.190.219', tls: 'TLSv1.3', warp: 'off' }
  );
  for (const value of [
    'ip=1\nip=2\ntls=TLSv1.3\nwarp=off\n',
    'ip=1\ntls=TLSv1.3\nwarp=off\nunknown=drift\n',
    'ip=1\ntls=TLSv1.3\nwarp\n',
  ])
    assert.throws(() => parseCloudflareTrace(value));
});
