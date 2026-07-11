/**
 * Juicyway Rate Conversion
 * Converts NGN amounts to stablecoin (USDT/USDC) for Juicyway sessions.
 *
 * Juicyway treats amounts literally in the session currency — a USDT session
 * with amount=100000 means $100,000 USDT, NOT ₦1,000. We must convert
 * NGN → USDT/USDC before creating the session.
 */

import { logger } from '../logger';

// Cache rate for 5 minutes to avoid hammering the API
export const RATE_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedRate: { ngnPerUsdt: number; fetchedAt: number } | null = null;

/**
 * Fetches a live NGN/USDT rate from CoinGecko and updates the module cache.
 * THROWS on a network/HTTP failure or a non-positive/invalid rate — it never
 * returns a cached value. Shared by both the lenient and the fail-closed
 * public accessors below.
 */
async function fetchAndCacheNgnPerUsdt(): Promise<number> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn',
    { signal: AbortSignal.timeout(5000) }
  );

  if (!res.ok) {
    throw new Error(`CoinGecko returned ${res.status}`);
  }

  const data = (await res.json()) as { tether?: { ngn?: number } };
  const rate = data?.tether?.ngn;

  if (!rate || rate <= 0) {
    throw new Error(`Invalid rate from CoinGecko: ${rate}`);
  }

  cachedRate = { ngnPerUsdt: rate, fetchedAt: Date.now() };

  logger.info({
    message: 'Fetched NGN/USDT rate',
    ngnPerUsdt: rate,
    source: 'coingecko',
  });

  return rate;
}

/**
 * Fetch the current NGN/USDT exchange rate from CoinGecko (free, no key).
 * Returns the number of NGN per 1 USDT (e.g., 1535.05).
 *
 * LENIENT: falls back to the last cached value of ANY age when the API is down
 * (only throws when the cache is empty). This is acceptable for the Juicyway
 * crypto-checkout path but MUST NOT be used on a money path that would lock a
 * customer charge to an arbitrarily stale rate — use getFreshNgnPerUsdt there.
 */
export async function getNgnPerUsdt(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < RATE_CACHE_TTL_MS) {
    return cachedRate.ngnPerUsdt;
  }

  try {
    return await fetchAndCacheNgnPerUsdt();
  } catch (error) {
    logger.error({
      message: 'Failed to fetch NGN/USDT rate',
      error: error instanceof Error ? error.message : String(error),
    });

    // Use cached rate if available (even if stale)
    if (cachedRate) {
      logger.warn({
        message: 'Using stale cached rate',
        ngnPerUsdt: cachedRate.ngnPerUsdt,
        ageMs: Date.now() - cachedRate.fetchedAt,
      });
      return cachedRate.ngnPerUsdt;
    }

    throw new Error(
      'Unable to fetch NGN/USDT exchange rate. Please try again.'
    );
  }
}

/**
 * Fetch the NGN/USDT rate but FAIL CLOSED on staleness. Returns a rate only
 * when it is no older than `maxAgeMs` — a fresh cache hit or a successful live
 * fetch — and otherwise THROWS. Unlike getNgnPerUsdt it NEVER returns a stale
 * cached value, so a money path (e.g. the PayPal NGN→USD presentment) cannot
 * silently charge the customer at an arbitrarily out-of-date rate after a
 * CoinGecko outage. The existing lenient callers are unaffected.
 */
export async function getFreshNgnPerUsdt(maxAgeMs: number): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt <= maxAgeMs) {
    return cachedRate.ngnPerUsdt;
  }

  try {
    return await fetchAndCacheNgnPerUsdt();
  } catch (error) {
    logger.error({
      message: 'Failed to fetch a fresh NGN/USDT rate (failing closed)',
      error: error instanceof Error ? error.message : String(error),
    });

    // Fail closed: the only cache we may hold is older than the caller's
    // freshness window, so we must NOT charge at a stale rate.
    throw new Error(
      'Unable to fetch a fresh NGN/USDT exchange rate. Please try again.'
    );
  }
}

/**
 * Convert NGN minor units (kobo) to USDT minor units (cents).
 *
 * @param ngnKobo - Amount in NGN kobo (e.g., 500000 = ₦5,000)
 * @returns USDT amount in minor units (cents), rounded up to ensure
 *          the merchant receives at least the NGN equivalent.
 *
 * Example: ₦5,000 at rate 1535 NGN/USDT
 *   ngnKobo = 500000
 *   ngnMajor = 5000
 *   usdtMajor = 5000 / 1535 = 3.257...
 *   usdtMinor = ceil(325.7) = 326 (= $3.26 USDT)
 */
export async function convertNgnKoboToUsdtCents(
  ngnKobo: number
): Promise<{ usdtCents: number; rate: number; ngnAmount: number }> {
  const rate = await getNgnPerUsdt();
  const ngnMajor = ngnKobo / 100;
  const usdtMajor = ngnMajor / rate;
  // Round UP to nearest cent so merchant doesn't lose money
  const usdtCents = Math.ceil(usdtMajor * 100);

  logger.info({
    message: 'NGN→USDT conversion',
    ngnKobo,
    ngnMajor,
    rate,
    usdtMajor: usdtMajor.toFixed(6),
    usdtCents,
  });

  return { usdtCents, rate, ngnAmount: ngnMajor };
}

/** Clear rate cache (for testing) */
export function clearRateCache(): void {
  cachedRate = null;
}
