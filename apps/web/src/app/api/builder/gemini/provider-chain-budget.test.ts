import { describe, expect, it } from 'vitest';
import {
  computeNonFinalProviderBudgetMs,
  MIN_PROVIDER_TIMEOUT_MS,
  PER_PROVIDER_TIMEOUT_MS,
} from './provider-chain-budget';

describe('computeNonFinalProviderBudgetMs', () => {
  it('caps a healthy provider at PER_PROVIDER_TIMEOUT_MS when budget is plentiful', () => {
    // Lots of time left, few providers → even share exceeds the cap.
    expect(computeNonFinalProviderBudgetMs(25_000, 2)).toBe(
      PER_PROVIDER_TIMEOUT_MS
    );
  });

  it('divides the remaining budget evenly across remaining providers', () => {
    // 25s across 5 providers → 5s each (under the 10s cap).
    expect(computeNonFinalProviderBudgetMs(25_000, 5)).toBe(5_000);
  });

  it('shrinks as the deadline approaches so later providers are not starved', () => {
    // Simulate the worst case Codex flagged: two providers already burned
    // ~20s of a 25s budget. The next attempt must NOT get a full 10s (which
    // would blow the deadline) — it gets the even share of what's left.
    const remaining = 5_000; // ~5s left
    // 3 providers remain (gemini, gemini-lite, openrouter)
    expect(computeNonFinalProviderBudgetMs(remaining, 3)).toBe(
      MIN_PROVIDER_TIMEOUT_MS // floor kicks in: 5000/3 ≈ 1666 < 2000
    );
  });

  it('never returns below the floor, even when time is nearly exhausted', () => {
    expect(computeNonFinalProviderBudgetMs(100, 4)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
    expect(computeNonFinalProviderBudgetMs(0, 4)).toBe(MIN_PROVIDER_TIMEOUT_MS);
    expect(computeNonFinalProviderBudgetMs(-500, 4)).toBe(
      MIN_PROVIDER_TIMEOUT_MS
    );
  });

  it('guards against a zero provider count', () => {
    expect(computeNonFinalProviderBudgetMs(25_000, 0)).toBe(
      PER_PROVIDER_TIMEOUT_MS
    );
  });

  it('sum of adaptive budgets across a slow chain stays within the route deadline', () => {
    // Model the true concern end-to-end: 5 providers, 25s deadline, each
    // consuming its full allotted budget. The cumulative time must not exceed
    // the deadline — i.e., the last provider is still reachable.
    const DEADLINE = 25_000;
    let elapsed = 0;
    const chainLength = 5;
    for (let index = 0; index < chainLength - 1; index++) {
      const budget = computeNonFinalProviderBudgetMs(
        DEADLINE - elapsed,
        chainLength - index
      );
      elapsed += budget;
    }
    // After the 4 non-final providers each burn their full budget, there is
    // still time left in the window for the final provider to run.
    expect(elapsed).toBeLessThan(DEADLINE);
  });
});
