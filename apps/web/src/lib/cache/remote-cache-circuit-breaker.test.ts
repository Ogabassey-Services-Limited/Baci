// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCircuitBreaker } from './remote-cache-circuit-breaker.mjs';

/**
 * The breaker exists so a sick remote-cache backend is not hammered once per
 * cache read. Every remaining `'use cache: remote'` site would otherwise pay
 * the backend's full failure latency on every request.
 */
describe('createCircuitBreaker', () => {
  function makeClock(start = 0) {
    let current = start;
    return {
      now: () => current,
      advance: (ms: number) => {
        current += ms;
      },
    };
  }

  it('starts closed and allows attempts', () => {
    const breaker = createCircuitBreaker({ now: makeClock().now });

    expect(breaker.getState()).toBe('closed');
    expect(breaker.shouldAttempt()).toBe(true);
  });

  it('stays closed while failures remain below the threshold', () => {
    const breaker = createCircuitBreaker({
      failureThreshold: 3,
      now: makeClock().now,
    });

    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe('closed');
    expect(breaker.shouldAttempt()).toBe(true);
  });

  it('opens after N consecutive failures and short-circuits further attempts', () => {
    const breaker = createCircuitBreaker({
      failureThreshold: 3,
      now: makeClock().now,
    });

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe('open');
    expect(breaker.shouldAttempt()).toBe(false);
  });

  it('resets the consecutive-failure count on success', () => {
    const breaker = createCircuitBreaker({
      failureThreshold: 3,
      now: makeClock().now,
    });

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();

    // Only two consecutive failures since the success — still closed.
    expect(breaker.getState()).toBe('closed');
    expect(breaker.shouldAttempt()).toBe(true);
  });

  it('stays open for the whole cooldown window', () => {
    const clock = makeClock();
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30_000,
      now: clock.now,
    });

    breaker.recordFailure();
    clock.advance(29_999);

    expect(breaker.shouldAttempt()).toBe(false);
    expect(breaker.getState()).toBe('open');
  });

  it('half-opens after the cooldown and admits exactly one probe', () => {
    const clock = makeClock();
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30_000,
      now: clock.now,
    });

    breaker.recordFailure();
    clock.advance(30_000);

    // First caller gets the probe...
    expect(breaker.shouldAttempt()).toBe(true);
    expect(breaker.getState()).toBe('half_open');
    // ...concurrent callers must not pile onto a backend that is still sick.
    expect(breaker.shouldAttempt()).toBe(false);
  });

  it('closes when the probe succeeds', () => {
    const clock = makeClock();
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30_000,
      now: clock.now,
    });

    breaker.recordFailure();
    clock.advance(30_000);
    breaker.shouldAttempt();
    breaker.recordSuccess();

    expect(breaker.getState()).toBe('closed');
    expect(breaker.shouldAttempt()).toBe(true);
  });

  it('re-opens for a fresh cooldown when the probe fails', () => {
    const clock = makeClock();
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30_000,
      now: clock.now,
    });

    breaker.recordFailure();
    clock.advance(30_000);
    breaker.shouldAttempt();
    breaker.recordFailure();

    expect(breaker.getState()).toBe('open');
    expect(breaker.shouldAttempt()).toBe(false);

    // The cooldown restarts from the failed probe, not from the original trip.
    clock.advance(29_999);
    expect(breaker.shouldAttempt()).toBe(false);
    clock.advance(1);
    expect(breaker.shouldAttempt()).toBe(true);
  });
});
