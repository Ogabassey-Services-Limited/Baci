import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRateCache,
  convertNgnKoboToUsdtCents,
  getFreshNgnPerUsdt,
  getNgnPerUsdt,
  RATE_CACHE_TTL_MS,
} from './rates';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MOCK_RATE = 1535.05; // 1 USDT = ₦1,535.05

beforeEach(() => {
  clearRateCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearRateCache();
});

describe('getNgnPerUsdt', () => {
  it('fetches rate from CoinGecko', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });

    const rate = await getNgnPerUsdt();

    expect(rate).toBe(MOCK_RATE);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('returns cached rate within TTL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });

    const first = await getNgnPerUsdt();
    const second = await getNgnPerUsdt();

    expect(first).toBe(MOCK_RATE);
    expect(second).toBe(MOCK_RATE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when API returns non-ok status and no cache', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    await expect(getNgnPerUsdt()).rejects.toThrow(
      'Unable to fetch NGN/USDT exchange rate'
    );
  });

  it('throws when rate is zero', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: 0 } }),
    });

    await expect(getNgnPerUsdt()).rejects.toThrow(
      'Unable to fetch NGN/USDT exchange rate'
    );
  });

  it('throws when response shape is unexpected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 50000 } }),
    });

    await expect(getNgnPerUsdt()).rejects.toThrow(
      'Unable to fetch NGN/USDT exchange rate'
    );
  });

  it('falls back to stale cache on API failure', async () => {
    // First call: populate cache
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });
    await getNgnPerUsdt();

    // Expire cache by advancing time
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);

    // Second call: API fails
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
    const rate = await getNgnPerUsdt();

    expect(rate).toBe(MOCK_RATE);
  });

  it('throws on network error with no cache', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('DNS resolution failed'));

    await expect(getNgnPerUsdt()).rejects.toThrow(
      'Unable to fetch NGN/USDT exchange rate'
    );
  });
});

describe('getFreshNgnPerUsdt', () => {
  it('serves a fresh cache hit within maxAgeMs without re-fetching', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });

    const first = await getFreshNgnPerUsdt(RATE_CACHE_TTL_MS);
    const second = await getFreshNgnPerUsdt(RATE_CACHE_TTL_MS);

    expect(first).toBe(MOCK_RATE);
    expect(second).toBe(MOCK_RATE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches a live rate when there is no cache', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });

    expect(await getFreshNgnPerUsdt(RATE_CACHE_TTL_MS)).toBe(MOCK_RATE);
  });

  it('FAILS CLOSED: throws (never returns a stale cache) when the fetch fails and the cache is older than maxAgeMs', async () => {
    // Populate the cache with a fresh rate.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });
    await getFreshNgnPerUsdt(RATE_CACHE_TTL_MS);

    // Age the cache past the freshness window, then break the live fetch.
    vi.spyOn(Date, 'now').mockReturnValue(
      Date.now() + RATE_CACHE_TTL_MS + 1000
    );
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('CoinGecko down'));

    await expect(getFreshNgnPerUsdt(RATE_CACHE_TTL_MS)).rejects.toThrow(
      'Unable to fetch a fresh NGN/USDT exchange rate'
    );
  });

  it('throws on a fetch failure with no cache at all', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('429 rate limited'));

    await expect(getFreshNgnPerUsdt(RATE_CACHE_TTL_MS)).rejects.toThrow(
      'Unable to fetch a fresh NGN/USDT exchange rate'
    );
  });

  it('diverges from the lenient accessor on a stale cache: getNgnPerUsdt returns stale, getFreshNgnPerUsdt throws', async () => {
    // Seed a cached rate.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: MOCK_RATE } }),
    });
    await getFreshNgnPerUsdt(RATE_CACHE_TTL_MS);

    // Cache is now stale and the API is down.
    vi.spyOn(Date, 'now').mockReturnValue(
      Date.now() + RATE_CACHE_TTL_MS + 1000
    );
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('outage'));

    // Lenient path keeps the legacy behavior (returns the stale value)...
    expect(await getNgnPerUsdt()).toBe(MOCK_RATE);
    // ...while the money path fails closed.
    await expect(getFreshNgnPerUsdt(RATE_CACHE_TTL_MS)).rejects.toThrow(
      'Unable to fetch a fresh NGN/USDT exchange rate'
    );
  });
});

describe('convertNgnKoboToUsdtCents', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: 1535 } }),
    });
  });

  it('converts NGN 5000 (500000 kobo) to USDT cents', async () => {
    // ₦5,000 / 1535 = 3.2573... USDT → ceil(325.73) = 326 cents
    const result = await convertNgnKoboToUsdtCents(500000);

    expect(result.usdtCents).toBe(326);
    expect(result.rate).toBe(1535);
    expect(result.ngnAmount).toBe(5000);
  });

  it('converts NGN 1000 (100000 kobo) to USDT cents', async () => {
    // ₦1,000 / 1535 = 0.6514... USDT → ceil(65.14) = 66 cents
    const result = await convertNgnKoboToUsdtCents(100000);

    expect(result.usdtCents).toBe(66);
    expect(result.ngnAmount).toBe(1000);
  });

  it('rounds up to protect merchant', async () => {
    // ₦1,535 / 1535 = exactly 1.0 USDT = 100 cents (no rounding needed)
    const exact = await convertNgnKoboToUsdtCents(153500);
    expect(exact.usdtCents).toBe(100);

    // ₦1,536 / 1535 = 1.000651... USDT → ceil(100.065) = 101 cents
    const slightlyOver = await convertNgnKoboToUsdtCents(153600);
    expect(slightlyOver.usdtCents).toBe(101);
  });

  it('handles small amounts', async () => {
    // ₦100 (10000 kobo) / 1535 = 0.0651... USDT → ceil(6.51) = 7 cents
    const result = await convertNgnKoboToUsdtCents(10000);

    expect(result.usdtCents).toBe(7);
    expect(result.ngnAmount).toBe(100);
  });

  it('handles large amounts', async () => {
    // ₦1,000,000 / 1535 = 651.46... USDT → ceil(65146.5) = 65147 cents
    const result = await convertNgnKoboToUsdtCents(100000000);

    expect(result.usdtCents).toBe(65147);
    expect(result.ngnAmount).toBe(1000000);
  });
});

describe('clearRateCache', () => {
  it('forces a fresh fetch after clearing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: 1500 } }),
    });

    await getNgnPerUsdt();
    expect(fetch).toHaveBeenCalledTimes(1);

    clearRateCache();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { ngn: 1600 } }),
    });

    const rate = await getNgnPerUsdt();
    expect(rate).toBe(1600);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
