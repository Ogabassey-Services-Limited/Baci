import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateTrafficDeltas,
  evaluateTrafficInterval,
} from './campaign-traffic.mjs';

const counters = (overrides = {}) => ({
  forwardedIngress: 100,
  measurementIngress: 20,
  hostLocalIngress: 5,
  forwardedEgress: 50,
  measurementEgress: 10,
  hostOriginatedEgress: 3,
  ...overrides,
});

test('separates marked measurement bytes from same-hook ambient traffic', () => {
  assert.deepEqual(
    calculateTrafficDeltas({
      start: counters(),
      end: counters({
        forwardedIngress: 180,
        measurementIngress: 50,
        hostLocalIngress: 15,
        forwardedEgress: 110,
        measurementEgress: 35,
        hostOriginatedEgress: 11,
      }),
    }),
    {
      ambientIngressBytes: 60,
      ambientEgressBytes: 43,
      measurementIngressBytes: 30,
      measurementEgressBytes: 25,
    }
  );
});

test('requires every counter and rejects reset, wrap, and subtraction ambiguity', () => {
  const { hostLocalIngress: _missing, ...incomplete } = counters();
  assert.throws(
    () => calculateTrafficDeltas({ start: incomplete, end: counters() }),
    /missing counter: hostLocalIngress/
  );
  assert.throws(
    () =>
      calculateTrafficDeltas({
        start: counters(),
        end: counters({ forwardedIngress: 99 }),
      }),
    /counter reset or wrap: forwardedIngress/
  );
  assert.throws(
    () =>
      calculateTrafficDeltas({
        start: counters(),
        end: counters({ forwardedIngress: 101, measurementIngress: 22 }),
      }),
    /measurement ingress exceeds forwarded ingress/
  );
  assert.throws(
    () =>
      calculateTrafficDeltas({
        start: counters(),
        end: counters({ forwardedEgress: 51, measurementEgress: 12 }),
      }),
    /measurement egress exceeds forwarded egress/
  );
});

test('accepts the inclusive ten-second byte limit without division', () => {
  const limit = 10 * 1_048_576;
  const result = evaluateTrafficInterval({
    start: counters({
      forwardedIngress: 0,
      measurementIngress: 0,
      hostLocalIngress: 0,
      forwardedEgress: 0,
      measurementEgress: 0,
      hostOriginatedEgress: 0,
    }),
    end: counters({
      forwardedIngress: limit,
      measurementIngress: 0,
      hostLocalIngress: 0,
      forwardedEgress: limit,
      measurementEgress: 0,
      hostOriginatedEgress: 0,
    }),
    intervalSeconds: 10,
    thresholds: {
      networkSampleSeconds: 10,
      networkRxBytesPerSecondMax: 1_048_576,
      networkTxBytesPerSecondMax: 1_048_576,
    },
  });

  assert.equal(result.ambientIngressBytes, limit);
  assert.equal(result.ambientEgressBytes, limit);
  assert.equal(result.ingressLimitBytes, limit);
  assert.equal(result.egressLimitBytes, limit);
});

test('rejects one byte above the limit, 10 MiB/s, and interval drift', () => {
  const run = (bytes, intervalSeconds = 10) =>
    evaluateTrafficInterval({
      start: counters({
        forwardedIngress: 0,
        measurementIngress: 0,
        hostLocalIngress: 0,
        forwardedEgress: 0,
        measurementEgress: 0,
        hostOriginatedEgress: 0,
      }),
      end: counters({
        forwardedIngress: bytes,
        measurementIngress: 0,
        hostLocalIngress: 0,
        forwardedEgress: bytes,
        measurementEgress: 0,
        hostOriginatedEgress: 0,
      }),
      intervalSeconds,
      thresholds: {
        networkSampleSeconds: 10,
        networkRxBytesPerSecondMax: 1_048_576,
        networkTxBytesPerSecondMax: 1_048_576,
      },
    });

  assert.throws(() => run(10 * 1_048_576 + 1), /ambient ingress exceeds/);
  assert.throws(() => run(10 * 10 * 1_048_576), /ambient ingress exceeds/);
  assert.throws(() => run(0, 9), /interval must equal 10 seconds/);
});

test('supports large decimal counters but rejects unsafe arithmetic products', () => {
  const base = '18446744073709540000';
  assert.deepEqual(
    calculateTrafficDeltas({
      start: counters({
        forwardedIngress: base,
        measurementIngress: base,
        hostLocalIngress: base,
        forwardedEgress: base,
        measurementEgress: base,
        hostOriginatedEgress: base,
      }),
      end: counters({
        forwardedIngress: '18446744073709540100',
        measurementIngress: '18446744073709540020',
        hostLocalIngress: '18446744073709540005',
        forwardedEgress: '18446744073709540050',
        measurementEgress: '18446744073709540010',
        hostOriginatedEgress: '18446744073709540003',
      }),
    }),
    {
      ambientIngressBytes: 85,
      ambientEgressBytes: 43,
      measurementIngressBytes: 20,
      measurementEgressBytes: 10,
    }
  );
  assert.throws(
    () =>
      evaluateTrafficInterval({
        start: counters(),
        end: counters(),
        intervalSeconds: 10,
        thresholds: {
          networkSampleSeconds: 10,
          networkRxBytesPerSecondMax: Number.MAX_SAFE_INTEGER,
          networkTxBytesPerSecondMax: 1,
        },
      }),
    /threshold product overflow/
  );
});

test('rejects extra counter names and values above uint64 before delta arithmetic', () => {
  assert.throws(
    () =>
      calculateTrafficDeltas({
        start: { ...counters(), extra: 0 },
        end: counters(),
      }),
    /unexpected counter: extra/
  );
  assert.throws(
    () =>
      calculateTrafficDeltas({
        start: counters(),
        end: { ...counters(), measurementEgress: '18446744073709551616' },
      }),
    /counter overflow: end.measurementEgress/
  );
});
