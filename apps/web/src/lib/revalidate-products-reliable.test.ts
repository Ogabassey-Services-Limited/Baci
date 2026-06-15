import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidateProducts = vi.fn();

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
}));
vi.mock('@/env', () => ({
  getAppUrl: () => 'https://app.usebaci.com',
  getInternalApiSecret: () => 'test-internal-secret',
}));

import { revalidateProductsReliable } from '@/lib/revalidate-products-reliable';

describe('revalidateProductsReliable', () => {
  const originalBaseUrl = process.env.BACI_WEB_BASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default tests exercise the getAppUrl() fallback; the BACI_WEB_BASE_URL
    // precedence has its own test.
    delete process.env.BACI_WEB_BASE_URL;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalBaseUrl === undefined) {
      delete process.env.BACI_WEB_BASE_URL;
    } else {
      process.env.BACI_WEB_BASE_URL = originalBaseUrl;
    }
  });

  it('targets BACI_WEB_BASE_URL (the worker env convention) over getAppUrl when set', async () => {
    process.env.BACI_WEB_BASE_URL = 'https://ogabassey.com';
    mockRevalidateProducts.mockImplementation(() => {
      throw new Error('no store');
    });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true } as Response);

    await revalidateProductsReliable('merchant-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://ogabassey.com/api/internal/revalidate-products'
    );
  });

  it('uses in-process revalidation and does NOT call the HTTP endpoint when a store context exists', async () => {
    mockRevalidateProducts.mockReturnValue(undefined);
    const fetchImpl = vi.fn();

    await revalidateProductsReliable('merchant-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(mockRevalidateProducts).toHaveBeenCalledWith('merchant-1');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to the internal Bearer endpoint when in-process revalidation throws (no store context)', async () => {
    mockRevalidateProducts.mockImplementation(() => {
      throw new Error('static generation store missing');
    });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true } as Response);

    await revalidateProductsReliable('merchant-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toBe(
      'https://app.usebaci.com/api/internal/revalidate-products'
    );
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-internal-secret',
      'Content-Type': 'application/json',
    });
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ merchantId: 'merchant-1' })
    );
  });

  it('never throws when the HTTP fallback returns non-2xx', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRevalidateProducts.mockImplementation(() => {
      throw new Error('no store');
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(
      revalidateProductsReliable('merchant-1', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
  });

  it('never throws when the HTTP fallback request rejects/times out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRevalidateProducts.mockImplementation(() => {
      throw new Error('no store');
    });
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));

    await expect(
      revalidateProductsReliable('merchant-1', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
  });

  it('does not fetch (no secret leak) when the revalidation target is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRevalidateProducts.mockImplementation(() => {
      throw new Error('no store');
    });
    const fetchImpl = vi.fn();

    // Empty base URL → no trusted target → fail open without an HTTP call.
    await revalidateProductsReliable('merchant-1', {
      baseUrl: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
