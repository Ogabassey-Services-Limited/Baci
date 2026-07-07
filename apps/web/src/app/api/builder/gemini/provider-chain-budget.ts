// Per-provider attempt budget for the AI Copilot provider chain.
//
// Rather than capping every provider at a fixed ceiling — which throttled the
// PRIMARY provider to a fixed 10s even when the 25s route deadline had ample
// time and, in a Gemini-only deployment (flash → flash-lite), aborted a
// slow-but-healthy primary before it could succeed — this reserves a MIN floor
// for each RELIABLE provider still downstream and lets the current provider use
// everything else. The primary therefore gets almost the whole route budget,
// while the reliable fallback tail is still guaranteed a real attempt (each
// downstream link keeps its MIN_PROVIDER_TIMEOUT_MS reservation). The final
// reliable provider is exempt (the caller hands it the raw route signal) and
// gets whatever remains.
export const MIN_PROVIDER_TIMEOUT_MS = 2_000;

export function computeNonFinalProviderBudgetMs(
  remainingMs: number,
  downstreamReliableCount: number
): number {
  const reservedForTail =
    MIN_PROVIDER_TIMEOUT_MS * Math.max(0, downstreamReliableCount);
  return Math.max(MIN_PROVIDER_TIMEOUT_MS, remainingMs - reservedForTail);
}
