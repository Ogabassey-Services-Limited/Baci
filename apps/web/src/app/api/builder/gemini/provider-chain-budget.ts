// Per-provider attempt budget for the AI Copilot provider chain.
//
// Each non-final provider gets an even share of the time left before the
// route deadline, capped at PER_PROVIDER_TIMEOUT_MS and floored at
// MIN_PROVIDER_TIMEOUT_MS. This keeps a single slow-but-alive upstream (cold
// start, transient stall) from consuming the whole route budget and starving
// the providers after it — the chain [cerebras, groq, gemini, gemini-lite,
// openrouter] must still reach its later links within the 25s route timeout.
// The FINAL provider is exempt and gets whatever remains of the global budget.
export const PER_PROVIDER_TIMEOUT_MS = 10_000;
export const MIN_PROVIDER_TIMEOUT_MS = 2_000;

export function computeNonFinalProviderBudgetMs(
  remainingMs: number,
  remainingProviderCount: number
): number {
  const evenShare = Math.floor(
    remainingMs / Math.max(1, remainingProviderCount)
  );
  return Math.max(
    MIN_PROVIDER_TIMEOUT_MS,
    Math.min(PER_PROVIDER_TIMEOUT_MS, evenShare)
  );
}
