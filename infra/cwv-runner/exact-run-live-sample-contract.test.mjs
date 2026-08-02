import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canonicalLiveSampleJson,
  validateBoundLiveSample,
} from './exact-run-live-sample-contract.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const binding = Object.freeze({
  accountingIdentitySha256: 'a'.repeat(64),
  accountingTable: 'baci_cwv_measurement',
  campaignId: 'campaign-01',
  campaignMark: 41,
  captureSha256: 'b'.repeat(64),
  externalIfindex: 2,
  externalInterface: 'eth0',
  generation: 1,
  policySha256: 'c'.repeat(64),
  runnerContainerId: 'd'.repeat(64),
  runnerIp: '172.31.0.2',
  runnerPeerIfindex: 3,
  runnerVeth: 'veth0',
});
const expected = Object.freeze({
  binding,
  classifierHandle: 71,
  schemaVersion: 1,
});
const capturedAt = '2026-07-22T12:00:00.000Z';

function sample() {
  const host = {
    ...binding,
    liveIdentity: {
      classifier: { handle: 71, sha256: 'e'.repeat(64) },
      container: {
        cgroup: '/cwv-measurement.slice/docker-campaign-01.scope',
        expectedImage: `sha256:${'f'.repeat(64)}`,
        expectedNetwork: 'baci-cwv-net',
        id: binding.runnerContainerId,
        image: `sha256:${'f'.repeat(64)}`,
        networkMode: 'baci-cwv-net',
        pid: 123,
        running: true,
      },
      idleContainerSha256: '1'.repeat(64),
      nftSha256: '2'.repeat(64),
    },
    schemaVersion: 1,
  };
  const idle = {
    accepted: true,
    binding: { ...binding },
    campaignId: binding.campaignId,
    mode: 'live',
  };
  return {
    campaignId: binding.campaignId,
    capturedAt,
    collectors: {
      host: { ok: true, sha256: hash(canonicalLiveSampleJson(host)) },
      idle: { ok: true, sha256: hash(canonicalLiveSampleJson(idle)) },
    },
    host,
    idle,
    schemaVersion: 1,
  };
}
const bytes = (value) => Buffer.from(canonicalLiveSampleJson(value));

test('accepts a fresh sample bound to every root runtime and accounting fact', () => {
  const result = validateBoundLiveSample({
    expected,
    nowEpochSeconds: Date.parse(capturedAt) / 1000 + 15,
    sampleBytes: bytes(sample()),
  });
  assert.deepEqual(result, { accepted: true, capturedAt });
});

test('rejects drift in each critical root binding field', () => {
  for (const key of Object.keys(binding)) {
    const hostile = sample();
    hostile.host[key] =
      typeof binding[key] === 'number' ? binding[key] + 1 : 'drift';
    hostile.collectors.host.sha256 = hash(
      canonicalLiveSampleJson(hostile.host)
    );
    assert.throws(
      () =>
        validateBoundLiveSample({
          expected,
          nowEpochSeconds: Date.parse(capturedAt) / 1000,
          sampleBytes: bytes(hostile),
        }),
      /binding/
    );
  }
});

test('rejects classifier, collector digest, cross-collector, and age drift', () => {
  const cases = [
    (value) => {
      value.host.liveIdentity.classifier.handle += 1;
      value.collectors.host.sha256 = hash(canonicalLiveSampleJson(value.host));
    },
    (value) => {
      value.collectors.host.sha256 = '0'.repeat(64);
    },
    (value) => {
      value.idle.binding.runnerVeth = 'other';
      value.collectors.idle.sha256 = hash(canonicalLiveSampleJson(value.idle));
    },
    (value) => {
      value.idle.extra = true;
      value.collectors.idle.sha256 = hash(canonicalLiveSampleJson(value.idle));
    },
  ];
  for (const mutate of cases) {
    const hostile = sample();
    mutate(hostile);
    assert.throws(() =>
      validateBoundLiveSample({
        expected,
        nowEpochSeconds: Date.parse(capturedAt) / 1000,
        sampleBytes: bytes(hostile),
      })
    );
  }
  for (const offset of [-1, 16])
    assert.throws(() =>
      validateBoundLiveSample({
        expected,
        nowEpochSeconds: Date.parse(capturedAt) / 1000 + offset,
        sampleBytes: bytes(sample()),
      })
    );
});

test('rejects noncanonical bytes and an unsealed expected contract', () => {
  assert.throws(() =>
    validateBoundLiveSample({
      expected,
      nowEpochSeconds: Date.parse(capturedAt) / 1000,
      sampleBytes: Buffer.from(`${canonicalLiveSampleJson(sample())}\n`),
    })
  );
  assert.throws(() =>
    validateBoundLiveSample({
      expected: { ...expected, extra: true },
      nowEpochSeconds: Date.parse(capturedAt) / 1000,
      sampleBytes: bytes(sample()),
    })
  );
});

test('controller binds the Task 3 sample to root runtime and classifier facts', async () => {
  const controller = await readFile(
    new URL('./exact-run-controller.sh', import.meta.url),
    'utf8'
  );
  assert.match(controller, /EVIDENCE_ROOT=\/srv\/baci-cwv\/evidence/);
  assert.match(controller, /exact-run-live-sample-contract\.mjs/);
  for (const field of [
    'accountingIdentitySha256',
    'campaignMark',
    'classifierHandle',
    'externalIfindex',
    'generation',
    'policySha256',
    'runnerContainerId',
    'runnerPeerIfindex',
    'runnerVeth',
  ])
    assert.match(controller, new RegExp(field));
  assert.match(controller, /0:10001:640/);
});
