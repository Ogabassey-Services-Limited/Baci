import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertEvidenceDirectoryDetails,
  buildLiveSample,
  collectLiveSample,
  publishLiveSample,
} from './host-sample-publisher.mjs';

const binding = {
  accountingIdentitySha256: 'a'.repeat(64),
  accountingTable: 'baci_cwv_measurement',
  campaignId: 'campaign-01',
  campaignMark: 1,
  captureSha256: 'b'.repeat(64),
  externalIfindex: 2,
  externalInterface: 'eth0',
  generation: 1,
  policySha256: 'c'.repeat(64),
  runnerContainerId: 'd'.repeat(64),
  runnerIp: '172.31.0.2',
  runnerPeerIfindex: 3,
  runnerVeth: 'veth-runner',
};
const liveIdentity = () => ({
  classifier: { handle: 42, sha256: 'e'.repeat(64) },
  container: {
    cgroup: '/cwv-measurement.slice/docker-campaign-01.scope',
    expectedImage: `sha256:${'f'.repeat(64)}`,
    expectedNetwork: 'baci-cwv-net',
    id: binding.runnerContainerId,
    image: `sha256:${'f'.repeat(64)}`,
    networkMode: 'baci-cwv-net',
    pid: 1234,
    running: true,
  },
  idleContainerSha256: '9'.repeat(64),
  nftSha256: '0'.repeat(64),
});

const collectors = () => ({
  host: { liveIdentity: liveIdentity(), schemaVersion: 1, ...binding },
  idle: {
    accepted: true,
    binding: { ...binding },
    campaignId: 'campaign-01',
    evidence: {
      boundaries: {
        endMonotonicNanoseconds: process.hrtime.bigint().toString(),
      },
      container: { end: '9'.repeat(64) },
      nft: { end: '0'.repeat(64) },
    },
    load1PerCpu: 0.25,
    mode: 'live',
  },
});

test('builds one campaign-bound sample from both successful local collectors', () => {
  const sample = buildLiveSample({
    campaignId: 'campaign-01',
    capturedAt: '2026-07-21T12:00:00.000Z',
    ...collectors(),
  });

  assert.equal(sample.campaignId, 'campaign-01');
  assert.equal(sample.capturedAt, '2026-07-21T12:00:00.000Z');
  assert.equal(sample.collectors.host.ok, true);
  assert.equal(sample.collectors.idle.ok, true);
  assert.match(sample.collectors.host.sha256, /^[0-9a-f]{64}$/);
  assert.throws(
    () =>
      buildLiveSample({
        ...sample,
        host: { ...binding, schemaVersion: 1, campaignId: 'other' },
      }),
    /campaign/
  );
});

test('fsyncs and atomically publishes a private fixed live-sample file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cwv-evidence-'));
  const evidence = join(root, 'evidence');
  await mkdir(evidence, { mode: 0o750 });
  const sample = buildLiveSample({
    campaignId: 'campaign-01',
    capturedAt: '2026-07-21T12:00:00.000Z',
    ...collectors(),
  });

  const path = await publishLiveSample(evidence, sample, {
    uid: process.getuid(),
    gid: process.getgid(),
    relativePath: (_directoryHandle, name) => join(evidence, name),
  });

  assert.equal(path, join(evidence, 'live-sample.json'));
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), sample);
  const details = await stat(path);
  assert.equal(details.gid, process.getgid());
  assert.equal(details.mode & 0o777, 0o640);
  assert.equal(details.uid, process.getuid());
});

test('requires the frozen evidence group instead of accepting root:root', () => {
  const directory = {
    gid: 10001,
    isDirectory: () => true,
    isSymbolicLink: () => false,
    mode: 0o40750,
    uid: 0,
  };
  assert.doesNotThrow(() => assertEvidenceDirectoryDetails(directory));
  assert.throws(
    () => assertEvidenceDirectoryDetails({ ...directory, gid: 0 }),
    /private evidence directory/
  );
  assert.throws(
    () => assertEvidenceDirectoryDetails({ ...directory, mode: 0o40755 }),
    /private evidence directory/
  );
});

test('refuses a stopped or identity-drifted runner after the idle collector', async () => {
  for (const mutate of [
    (identity) => {
      identity.container.running = false;
    },
    (identity) => {
      identity.container.image = `sha256:${'1'.repeat(64)}`;
    },
    (identity) => {
      identity.container.networkMode = 'bridge';
    },
    (identity) => {
      identity.container.pid = 0;
    },
    (identity) => {
      identity.container.cgroup = '/user.slice/user-1000.slice';
    },
    (identity) => {
      identity.classifier.handle = 0;
    },
    (identity) => {
      identity.idleContainerSha256 = '8'.repeat(64);
    },
    (identity) => {
      identity.nftSha256 = '7'.repeat(64);
    },
  ]) {
    const sample = collectors();
    mutate(sample.host.liveIdentity);
    const calls = [];
    await assert.rejects(
      () =>
        collectLiveSample('campaign-01', (_path, args) => {
          calls.push(args[0]);
          return Promise.resolve(
            args[0] === '--live-local' && calls.length === 1
              ? sample.idle
              : sample.host
          );
        }),
      /live host identity/
    );
    assert.deepEqual(calls, ['--live-local', '--live-local']);
  }
});

test('refuses a host collector that arrives after the 15-second freshness gap', async () => {
  const sample = collectors();
  sample.idle.evidence.boundaries.endMonotonicNanoseconds = '0';
  const calls = [];
  await assert.rejects(
    () =>
      collectLiveSample(
        'campaign-01',
        (path) => {
          calls.push(path);
          return Promise.resolve(
            path.endsWith('host-idle-check.sh') ? sample.idle : sample.host
          );
        },
        () => 15_000_000_001n
      ),
    /freshness drift/
  );
  assert.deepEqual(calls, ['/srv/baci-cwv/sealed/host-idle-check.sh']);
});

test('sampler unit permits only the canonical evidence directory', async () => {
  const unit = await readFile(
    new URL('./baci-cwv-host-sampler.service', import.meta.url),
    'utf8'
  );
  assert.match(unit, /^Group=baci-cwv$/m);
  assert.match(unit, /^ReadWritePaths=\/srv\/baci-cwv\/evidence$/m);
  assert.doesNotMatch(unit, /\/srv\/baci-cwv\/live-sample/);
});

test('accepts evaluator fractional metrics but refuses split authority tuples', () => {
  const input = {
    campaignId: 'campaign-01',
    capturedAt: '2026-07-21T12:00:00.000Z',
    ...collectors(),
  };
  assert.equal(buildLiveSample(input).idle.load1PerCpu, 0.25);
  input.idle.binding.policySha256 = 'e'.repeat(64);
  assert.throws(() => buildLiveSample(input), /campaign-bound/);
});

test('requires an exact typed binding projection instead of matching partial fields', () => {
  const input = {
    campaignId: 'campaign-01',
    capturedAt: '2026-07-21T12:00:00.000Z',
    ...collectors(),
  };
  delete input.host.runnerVeth;
  delete input.idle.binding.runnerVeth;
  assert.throws(() => buildLiveSample(input), /campaign-bound/);
  const typed = {
    campaignId: 'campaign-01',
    capturedAt: '2026-07-21T12:00:00.000Z',
    ...collectors(),
  };
  typed.host.externalIfindex = '2';
  typed.idle.binding.externalIfindex = '2';
  assert.throws(() => buildLiveSample(typed), /campaign-bound/);
  const extra = {
    campaignId: 'campaign-01',
    capturedAt: '2026-07-21T12:00:00.000Z',
    ...collectors(),
  };
  extra.idle.binding.extra = 'unexpected';
  assert.throws(() => buildLiveSample(extra), /campaign-bound/);
});

test('uses the controlled collection clock and observes durable publication order', async () => {
  let calls = 0;
  const sample = await collectLiveSample(
    'campaign-01',
    () => {
      calls += 1;
      return Promise.resolve(
        calls === 1 ? collectors().idle : collectors().host
      );
    },
    process.hrtime.bigint,
    () => new Date('2026-07-21T12:00:00.000Z')
  );
  assert.equal(sample.capturedAt, '2026-07-21T12:00:00.000Z');
  const root = await mkdtemp(join(tmpdir(), 'cwv-evidence-'));
  const evidence = join(root, 'evidence');
  const operations = [];
  await mkdir(evidence, { mode: 0o750 });

  await publishLiveSample(evidence, sample, {
    gid: process.getgid(),
    onOperation: (operation) => operations.push(operation),
    relativePath: (_directoryHandle, name) => join(evidence, name),
    uid: process.getuid(),
  });

  assert.deepEqual(operations, [
    'directory-open',
    'prior-lstat',
    'temporary-open',
    'temporary-write',
    'temporary-chown',
    'temporary-chmod',
    'temporary-fsync',
    'rename',
    'readback-lstat',
    'readback-open',
    'readback-read',
    'directory-fsync',
  ]);
});
