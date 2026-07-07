// Per-provider attempt budget for the AI Copilot provider chain.
//
// Two competing goals: a slow-but-healthy PRIMARY should get a generous window
// (not a fixed sub-10s cap), yet a HUNG earlier provider must not consume the
// whole route deadline and starve the reliable Google fallbacks (Gemini ~3-4s,
// Flash-Lite ~8s), which would return "unavailable" even though a fallback
// would have succeeded.
//
// The model: hold RELIABLE_TAIL_RESERVE_MS back for the reliable-tail safety
// net (the last reliable provider, which the caller runs on the raw route
// signal), then split the rest evenly across this provider and the reliable
// providers still ahead of the tail. So an earlier provider is bounded to its
// even share (a hang can't eat everything), while — even in the worst case
// where every earlier provider burns its full share — roughly
// RELIABLE_TAIL_RESERVE_MS is left for the tail to make a real attempt. In a
// Gemini-only chain [flash, lite] the primary flash gets the whole budget minus
// the tail reserve (~17s of 25s), comfortably covering a slow-but-healthy call.
export const MIN_PROVIDER_TIMEOUT_MS = 2_000;
export const RELIABLE_TAIL_RESERVE_MS = 8_000;

export function computeNonFinalProviderBudgetMs(
  remainingMs: number,
  downstreamReliableCount: number
): number {
  if (downstreamReliableCount <= 0) {
    return Math.max(MIN_PROVIDER_TIMEOUT_MS, remainingMs);
  }
  const shareable = remainingMs - RELIABLE_TAIL_RESERVE_MS;
  const evenShare = Math.floor(shareable / downstreamReliableCount);
  return Math.max(MIN_PROVIDER_TIMEOUT_MS, evenShare);
}
