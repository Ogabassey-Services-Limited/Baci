// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createCacheTrust,
  DEFAULT_DISTRUST_MS,
} from './remote-cache-trust.mjs';

/**
 * INVARIANT A's state. Freshness is a property of the SUBSYSTEM, not of an
 * individual call: `refreshTags()` failing means this instance's tag manifest
 * may be stale, so a LATER `get()` — which itself succeeds — can hand back a
 * pre-invalidation entry. Hence subsystem-level trust.
 */
describe('createCacheTrust', () => {
  function makeClock(start = 0) {
    let current = start;
    return {
      now: () => current,
      advance: (ms: number) => {
        current += ms;
      },
    };
  }

  /**
   * The blast-radius dial. Distrust pushes reads onto the ORIGIN, so a long
   * window turns a momentary cache blip into a sustained origin read storm — the
   * Supabase-pooler feedback loop from plan §4.1. It must stay far below the
   * breaker cooldown (30s), which is the OPPOSITE dial (shielding a sick backend
   * FROM load).
   */
  it('defaults to a short backstop, well under the breaker cooldown', () => {
    expect(DEFAULT_DISTRUST_MS).toBe(5_000);
    expect(DEFAULT_DISTRUST_MS).toBeLessThan(30_000);
  });

  it('recovers on the next successful probe rather than waiting out the window', () => {
    const clock = makeClock();
    const trust = createCacheTrust({ distrustMs: 5_000, now: clock.now });

    trust.degrade('refresh_tags');
    expect(trust.isTrusted()).toBe(false);

    // Next re-invokes refreshTags() before EVERY request, so under traffic the
    // recovery path is the very next request — not the timer.
    clock.advance(10);
    trust.restore('refresh_tags');

    expect(trust.isTrusted()).toBe(true);
  });

  it('starts trusted', () => {
    const trust = createCacheTrust({
      distrustMs: 30_000,
      now: makeClock().now,
    });

    expect(trust.isTrusted()).toBe(true);
  });

  it('is untrusted after a degradation', () => {
    const trust = createCacheTrust({
      distrustMs: 30_000,
      now: makeClock().now,
    });

    trust.degrade('refresh_tags');

    expect(trust.isTrusted()).toBe(false);
  });

  it('recovers when the leg that broke reports success', () => {
    const trust = createCacheTrust({
      distrustMs: 30_000,
      now: makeClock().now,
    });

    trust.degrade('get_expiration');
    trust.restore('get_expiration');

    expect(trust.isTrusted()).toBe(true);
  });

  it('stays untrusted while a DIFFERENT leg is still broken', () => {
    const trust = createCacheTrust({
      distrustMs: 30_000,
      now: makeClock().now,
    });

    trust.degrade('refresh_tags');
    trust.degrade('get_expiration');
    // The expiration lookup recovered, but the tag manifest is still stale.
    trust.restore('get_expiration');

    expect(trust.isTrusted()).toBe(false);
  });

  it('expires a distrust after the window so a dead leg cannot disable the cache forever', () => {
    const clock = makeClock();
    const trust = createCacheTrust({ distrustMs: 30_000, now: clock.now });

    trust.degrade('refresh_tags');
    clock.advance(29_999);
    expect(trust.isTrusted()).toBe(false);

    clock.advance(1);
    expect(trust.isTrusted()).toBe(true);
  });

  it('re-degrading extends the window from the new failure', () => {
    const clock = makeClock();
    const trust = createCacheTrust({ distrustMs: 30_000, now: clock.now });

    trust.degrade('refresh_tags');
    clock.advance(20_000);
    trust.degrade('refresh_tags');

    clock.advance(15_000); // 35s since the first, but only 15s since the last
    expect(trust.isTrusted()).toBe(false);

    clock.advance(15_000);
    expect(trust.isTrusted()).toBe(true);
  });
});
