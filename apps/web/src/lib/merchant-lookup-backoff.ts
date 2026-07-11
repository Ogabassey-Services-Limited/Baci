const MERCHANT_LOOKUP_RETRY_BACKOFF_MIN_MS = 200;
const MERCHANT_LOOKUP_RETRY_BACKOFF_JITTER_MS = 100;

/**
 * Waits 200-300ms (jittered) before retrying a failed merchant lookup.
 *
 * The merchant-lookup transport tail is dominated by momentary event-loop /
 * connection contention on the same lambda — an immediate back-to-back retry
 * tends to hit the exact same stall and fail identically. A short jittered
 * pause gives the contention a chance to clear and de-synchronizes retries
 * across concurrent requests.
 */
export function waitForMerchantLookupRetryBackoff(): Promise<void> {
  const delayMs =
    MERCHANT_LOOKUP_RETRY_BACKOFF_MIN_MS +
    Math.random() * MERCHANT_LOOKUP_RETRY_BACKOFF_JITTER_MS;

  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
