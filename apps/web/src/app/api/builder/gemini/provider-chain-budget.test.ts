import { describe, expect, it } from 'vitest';
import {
  computeNonFinalProviderBudgetMs,
  MIN_PROVIDER_TIMEOUT_MS,
  RELIABLE_TAIL_RESERVE_MS,
} from './provider-chain-budget';

describe('computeNonFinalProviderBudgetMs', () => {
  it('gives the Gemini-only primary a generous window while reserving the tail', () => {
    // Chain [flash, lite]: flash has 1 reliable provider downstream (lite = the
    // tail). Flash gets the whole budget minus the tail reserve — ~17s of 25s,
    // NOT a fixed sub-10s cap — and lite keeps a real fallback window.
    expect(computeNonFinalProviderBudgetMs(25_000, 1)).toBe(
      25_000 - RELIABLE_TAIL_RESERVE_MS
    );
  });

  it('bounds a hung earlier provider in the full chain so the reliable tail survives', () => {
    // Chain [cerebras, groq, gemini, gemini-lite]: cerebras has 3 reliable
    // downstream. Its budget is the even share of (deadline - tail reserve), so
    // a hang is capped near ~5.7s instead of consuming ~19s of the 25s deadline.
    const budget = computeNonFinalProviderBudgetMs(25_000, 3);
    expect(budget).toBe(Math.floor((25_000 - RELIABLE_TAIL_RESERVE_MS) / 3));
    expect(budget).toBeLessThan(6_000);
  });

  it('never returns below the floor when time is nearly exhausted', () => {
    expect(computeNonFinalProviderBudgetMs(9_000, 3)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
    expect(computeNonFinalProviderBudgetMs(100, 2)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
    expect(computeNonFinalProviderBudgetMs(-500, 1)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
  });

  it('offers the full remaining budget when nothing reliable is downstream', () => {
    // Degenerate value (the caller exempts the last reliable provider and hands
    // it the raw route signal, so this branch is not hit in practice).
    expect(computeNonFinalProviderBudgetMs(25_000, 0)).toBe(25_000);
  });

  it('leaves ~RELIABLE_TAIL_RESERVE_MS for the tail even if every earlier provider burns its full share', () => {
    // 4 reliable providers, 25s deadline; each non-final provider recomputes its
    // budget and consumes it in full. The last reliable provider (the safety
    // net) must still be reachable with a realistic window.
    const DEADLINE = 25_000;
    const reliableCount = 4;
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
    // Flooring the earlier shares only ever leaves the tail MORE, never less.
    expect(tailBudget).toBeGreaterThanOrEqual(RELIABLE_TAIL_RESERVE_MS);
    expect(elapsed).toBeLessThan(DEADLINE);
  });
});
