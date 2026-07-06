import { describe, expect, it } from 'vitest';
import { createStorefrontPreflightCircuitBreaker } from './storefront-preflight-circuit-breaker';

const THRESHOLD = 3;
const COOLDOWN_MS = 1_000;

function createBreaker() {
  return createStorefrontPreflightCircuitBreaker({
    threshold: THRESHOLD,
    cooldownMs: COOLDOWN_MS,
  });
}

describe('createStorefrontPreflightCircuitBreaker', () => {
  it('is closed by default', () => {
    const breaker = createBreaker();

    expect(breaker.isOpen(0)).toBe(false);
  });

  it('stays closed while failures remain below the threshold', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);

    expect(breaker.isOpen(0)).toBe(false);
  });

  it('opens after threshold consecutive failures', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);

    expect(breaker.isOpen(0)).toBe(true);
  });

  it('stays open for the entire cooldown window', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);

    expect(breaker.isOpen(COOLDOWN_MS - 1)).toBe(true);
  });

  it('becomes half-open (isOpen returns false) once the cooldown elapses', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);

    expect(breaker.isOpen(COOLDOWN_MS)).toBe(false);
  });

  it('re-opens immediately when the half-open probe fails', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.isOpen(COOLDOWN_MS)).toBe(false); // half-open transition
    breaker.recordFailure(COOLDOWN_MS);

    expect(breaker.isOpen(COOLDOWN_MS)).toBe(true);
  });

  it('fully closes when the half-open probe succeeds', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.isOpen(COOLDOWN_MS)).toBe(false); // half-open transition
    breaker.recordSuccess();
    // A single failure right after a success must not reopen the breaker —
    // recordSuccess is expected to have reset the consecutive-failure streak.
    breaker.recordFailure(COOLDOWN_MS);

    expect(breaker.isOpen(COOLDOWN_MS)).toBe(false);
  });

  it('resets the consecutive-failure streak on recordSuccess', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordSuccess();
    breaker.recordFailure(0);
    breaker.recordFailure(0);

    // Only 2 consecutive failures since the reset — still below THRESHOLD.
    expect(breaker.isOpen(0)).toBe(false);
  });

  it('returns true exactly once for a single open transition', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);

    expect(breaker.consumeOpenTransition()).toBe(true);
    expect(breaker.consumeOpenTransition()).toBe(false);
  });

  it('fires consumeOpenTransition again for a later, separate open transition', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.consumeOpenTransition()).toBe(true);

    expect(breaker.isOpen(COOLDOWN_MS)).toBe(false); // half-open probe window
    breaker.recordFailure(COOLDOWN_MS); // probe fails -> re-opens

    expect(breaker.consumeOpenTransition()).toBe(true);
  });

  it('clears the failure streak, open state, and pending transition on reset', () => {
    const breaker = createBreaker();

    breaker.recordFailure(0);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.isOpen(0)).toBe(true);

    breaker.reset();

    expect(breaker.isOpen(0)).toBe(false);
    expect(breaker.consumeOpenTransition()).toBe(false);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    // Still below THRESHOLD -- the pre-reset streak was cleared, not retained.
    expect(breaker.isOpen(0)).toBe(false);
  });

  it('uses a default threshold of 5 and a default cooldown when no options are given', () => {
    const breaker = createStorefrontPreflightCircuitBreaker();

    for (let i = 0; i < 4; i += 1) {
      breaker.recordFailure(0);
    }
    expect(breaker.isOpen(0)).toBe(false);

    breaker.recordFailure(0);

    expect(breaker.isOpen(0)).toBe(true);
  });
});
