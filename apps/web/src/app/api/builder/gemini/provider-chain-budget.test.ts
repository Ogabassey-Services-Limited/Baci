import { describe, expect, it } from 'vitest';
import {
  computeNonFinalProviderBudgetMs,
  MIN_PROVIDER_TIMEOUT_MS,
} from './provider-chain-budget';

describe('computeNonFinalProviderBudgetMs', () => {
  it('lets the primary use almost the whole deadline (no fixed per-provider cap)', () => {
    // Gemini-only chain [flash, lite]: flash has 1 reliable provider
    // downstream, so it may use the whole 25s budget minus a single MIN
    // reservation for flash-lite — NOT throttled to a fixed 10s ceiling.
    expect(computeNonFinalProviderBudgetMs(25_000, 1)).toBe(
      25_000 - MIN_PROVIDER_TIMEOUT_MS
    );
  });

  it('reserves a MIN floor for every reliable provider still downstream', () => {
    // 3 reliable providers downstream → hold back 3 × MIN for the tail.
    expect(computeNonFinalProviderBudgetMs(25_000, 3)).toBe(
      25_000 - 3 * MIN_PROVIDER_TIMEOUT_MS
    );
  });

  it('never returns below the floor, even when time is nearly exhausted', () => {
    expect(computeNonFinalProviderBudgetMs(100, 4)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
    expect(computeNonFinalProviderBudgetMs(0, 2)).toBe(MIN_PROVIDER_TIMEOUT_MS);
    expect(computeNonFinalProviderBudgetMs(-500, 1)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
  });

  it('offers the full remaining budget when nothing reliable is downstream', () => {
    // Degenerate value (the caller exempts the last reliable provider and hands
    // it the raw route signal, so this branch is not hit in practice).
    expect(computeNonFinalProviderBudgetMs(25_000, 0)).toBe(25_000);
  });

  it('keeps the reliable fallback tail reachable when every provider burns its full budget', () => {
    // 5 reliable providers, 25s deadline. Each non-final provider consumes its
    // whole allotment; the last reliable provider must still get a real window
    // (>= MIN) and the chain must stay inside the deadline.
    const DEADLINE = 25_000;
    const reliableCount = 5;
    let elapsed = 0;
    for (let index = 0; index < reliableCount - 1; index++) {
      const downstream = reliableCount - 1 - index;
      const budget = computeNonFinalProviderBudgetMs(
        DEADLINE - elapsed,
        downstream
      );
      elapsed += budget;
    }
    const tailBudget = DEADLINE - elapsed;
    expect(tailBudget).toBeGreaterThanOrEqual(MIN_PROVIDER_TIMEOUT_MS);
    expect(elapsed).toBeLessThan(DEADLINE);
  });
});
