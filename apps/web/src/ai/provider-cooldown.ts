// Rate-limit cooldown for chain providers.
//
// The free tiers this chain rides on are REQUEST-starved, not token-starved:
// Cerebras gemma-4-31b allows 5 req/min (but 1M tokens/day) and Groq
// gpt-oss-120b allows 30 req/min / 1,000 req/day. Cerebras is first in the
// chain, so once traffic is even mildly concurrent it 429s — and without a
// memory of that, EVERY subsequent request would still pay a doomed Cerebras
// round-trip before falling through to Groq/Gemini, taxing latency on the
// whole platform.
//
// So: when a provider signals rate-limiting, park it for a cooldown window and
// let the chain skip straight to the next provider. The window comes from the
// provider's own Retry-After / reset hint when it sends one, otherwise a
// default that clears the typical per-minute bucket.
//
// LIMITATION (same as ai/provider.ts's rate limiter): this Map lives in
// process memory, so on Vercel each warm instance keeps its own view and a
// cold start forgets everything. That is acceptable here — the cooldown is a
// latency optimization, not a correctness guard. A forgotten cooldown costs
// one wasted 429 round-trip, and the chain still falls through correctly.

const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 10 * 60_000;

const cooldownUntilByProvider = new Map<string, number>();

function isRateLimitStatus(error: unknown): boolean {
  const status = (error as { statusCode?: unknown; status?: unknown } | null)
    ?.statusCode;
  const altStatus = (error as { status?: unknown } | null)?.status;
  return status === 429 || altStatus === 429;
}

/**
 * Recognizes a rate-limit/quota rejection across providers, which surface it
 * inconsistently: an AI SDK APICallError with statusCode 429, or a message
 * mentioning rate limits / quota / "too many requests".
 *
 * The message match deliberately does NOT test for a bare "429" substring: a
 * real 429 already carries statusCode 429 (caught above), whereas the raw
 * digits "429" turn up incidentally in request ids, timestamps, and byte
 * counts inside 5xx/network error bodies — and parking a healthy provider on a
 * transient 5xx violates this module's "only park on rate limits" invariant
 * and needlessly sidelines the chain's fastest link.
 */
export function isRateLimitError(error: unknown): boolean {
  if (isRateLimitStatus(error)) {
    return true;
  }
  const message = (
    error instanceof Error ? error.message : String(error ?? '')
  ).toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('too many requests') ||
    message.includes('quota')
  );
}

/**
 * Reads a provider's own "come back in N" hint. Supports `Retry-After` in
 * seconds (the HTTP standard) and the `x-ratelimit-reset-*` seconds-with-
 * decimals form that Cerebras/Groq send on their OpenAI-compatible endpoints.
 */
function readRetryAfterMs(error: unknown): number | null {
  const headers = (error as { responseHeaders?: Record<string, string> } | null)
    ?.responseHeaders;
  if (!headers) {
    return null;
  }

  const candidates = [
    headers['retry-after'],
    headers['x-ratelimit-reset-requests'],
    headers['x-ratelimit-reset-tokens'],
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const seconds = Number.parseFloat(candidate);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(Math.ceil(seconds * 1000), MAX_COOLDOWN_MS);
    }
  }

  return null;
}

/** True while `providerName` is parked after a rate-limit rejection. */
export function isProviderCoolingDown(
  providerName: string,
  now: number = Date.now()
): boolean {
  const until = cooldownUntilByProvider.get(providerName);
  if (until === undefined) {
    return false;
  }
  if (until <= now) {
    cooldownUntilByProvider.delete(providerName);
    return false;
  }
  return true;
}

/**
 * Parks a provider if (and only if) the error was a rate-limit rejection.
 * Returns the cooldown length applied, or null when the error was something
 * else (a 5xx or network blip must NOT sideline a provider — the chain's
 * normal fall-through already handles those, and parking on them would
 * needlessly starve the chain of its fastest link).
 */
export function recordProviderFailure(
  providerName: string,
  error: unknown,
  now: number = Date.now()
): number | null {
  if (!isRateLimitError(error)) {
    return null;
  }
  const cooldownMs = readRetryAfterMs(error) ?? DEFAULT_COOLDOWN_MS;
  cooldownUntilByProvider.set(providerName, now + cooldownMs);
  return cooldownMs;
}

/** Clears a provider's cooldown — call after it serves a request again. */
export function clearProviderCooldown(providerName: string): void {
  cooldownUntilByProvider.delete(providerName);
}

/** Test seam: drops all cooldown state. */
export function resetProviderCooldowns(): void {
  cooldownUntilByProvider.clear();
}
