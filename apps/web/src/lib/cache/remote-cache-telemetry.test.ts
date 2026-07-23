// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_TELEMETRY_OPERATIONS,
  CACHE_TELEMETRY_OUTCOMES,
  createCacheTelemetry,
} from './remote-cache-telemetry.mjs';

/**
 * Cache telemetry is emitted from a hot path on every storefront request. Label
 * cardinality must stay bounded — a per-slug or per-cache-key label would mint
 * an unbounded metric series (and leak crawler URLs into logs).
 */
describe('createCacheTelemetry', () => {
  it('counts an operation/outcome pair', () => {
    const telemetry = createCacheTelemetry();

    telemetry.record('get', 'hit');
    telemetry.record('get', 'hit');
    telemetry.record('get', 'miss');

    expect(telemetry.snapshot()).toMatchObject({
      'get.hit': 2,
      'get.miss': 1,
    });
  });

  it('exposes only bounded label values', () => {
    // The whole label space is the cross product of two frozen allowlists —
    // it cannot grow at runtime.
    expect(Object.isFrozen(CACHE_TELEMETRY_OPERATIONS)).toBe(true);
    expect(Object.isFrozen(CACHE_TELEMETRY_OUTCOMES)).toBe(true);
    expect(CACHE_TELEMETRY_OPERATIONS).toContain('get');
    expect(CACHE_TELEMETRY_OPERATIONS).toContain('set');
    expect(CACHE_TELEMETRY_OUTCOMES).toContain('failure');
    expect(CACHE_TELEMETRY_OUTCOMES).toContain('skip_oversized');
  });

  it('folds an unknown label into a fixed bucket rather than minting a series', () => {
    const telemetry = createCacheTelemetry();

    // A cache key must never become a label, even if a future caller slips.
    telemetry.record(
      'products-9f1c2b/slug/iphone-15-pro-max' as never,
      'hit' as never
    );

    const snapshot = telemetry.snapshot();
    expect(snapshot['unknown.hit']).toBe(1);
    for (const key of Object.keys(snapshot)) {
      expect(key).not.toContain('iphone-15-pro-max');
    }
  });

  it('never records a cache key even when one is passed as the outcome', () => {
    const telemetry = createCacheTelemetry();

    telemetry.record('set', 'merchant-abc:key' as never);

    expect(telemetry.snapshot()).toMatchObject({ 'set.unknown': 1 });
  });

  it('flushes a structured summary once per interval, not per operation', () => {
    let current = 0;
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const telemetry = createCacheTelemetry({
      logger,
      flushIntervalMs: 60_000,
      now: () => current,
    });

    telemetry.record('get', 'hit');
    telemetry.maybeFlush();
    telemetry.record('get', 'hit');
    telemetry.maybeFlush();

    // Still inside the first window — no repeat emission.
    expect(logger.log).toHaveBeenCalledTimes(0);

    current = 60_000;
    telemetry.maybeFlush();

    expect(logger.log).toHaveBeenCalledTimes(1);
    const [payload] = logger.log.mock.calls[0] as [string];
    expect(payload).toContain('resilient-remote-cache');
    expect(payload).toContain('get.hit');
  });

  it('does not emit when nothing happened in the window', () => {
    let current = 0;
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const telemetry = createCacheTelemetry({
      logger,
      flushIntervalMs: 60_000,
      now: () => current,
    });

    current = 120_000;
    telemetry.maybeFlush();

    expect(logger.log).not.toHaveBeenCalled();
  });

  it('resets counters after a flush so windows do not accumulate', () => {
    let current = 0;
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const telemetry = createCacheTelemetry({
      logger,
      flushIntervalMs: 60_000,
      now: () => current,
    });

    telemetry.record('get', 'hit');
    current = 60_000;
    telemetry.maybeFlush();

    expect(telemetry.snapshot()).toEqual({});
  });
});
