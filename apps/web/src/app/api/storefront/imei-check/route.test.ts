import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so these mocks are initialized BEFORE vi.mock factories
// run (vi.mock is hoisted to the top of the file by Vitest). Without this,
// the factories below would close over variables in their Temporal Dead
// Zone, causing intermittent ReferenceErrors on cold runs.
const mocks = vi.hoisted(() => ({
  mockGetDeviceImage: vi.fn<(device: string) => string>(
    () => 'https://cdn.example.com/device.png'
  ),
  mockResolveStorefrontMerchantFromRequest: vi.fn(async () => ({
    success: true as const,
    identifier: 'ogabassey',
    merchant: { id: 'merchant-1', slug: 'ogabassey' } as unknown as Record<
      string,
      unknown
    >,
  })),
  mockCheckRateLimit: vi.fn(async () => ({
    allowed: true,
    limit: 10,
    remaining: 9,
    resetTime: Date.now() + 60_000,
  })),
}));

vi.mock('@/lib/device-images', () => ({
  getDeviceImage: (device: string) => mocks.mockGetDeviceImage(device),
}));

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    (
      mocks.mockResolveStorefrontMerchantFromRequest as unknown as (
        ...a: unknown[]
      ) => Promise<unknown>
    )(...args),
}));

vi.mock('@/lib/rate-limit', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/rate-limit')>(
      '@/lib/rate-limit'
    );
  return {
    ...actual,
    checkRateLimit: (...args: unknown[]) =>
      mocks.mockCheckRateLimit(...(args as [])),
  };
});

vi.mock('@/env', () => ({
  getRootDomain: () => 'usebaci.com',
}));

function createRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: 'ogabassey.usebaci.com' }),
    url: 'https://ogabassey.usebaci.com/api/storefront/imei-check',
    nextUrl: new URL('https://ogabassey.usebaci.com/api/storefront/imei-check'),
    method: 'POST',
  } as unknown as NextRequest;
}

function importRoute() {
  vi.resetModules();
  vi.stubEnv('SICKW_API_KEY', 'test-sickw-key');
  return import('./route');
}

describe('POST /api/storefront/imei-check', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.mockGetDeviceImage.mockClear();
    mocks.mockResolveStorefrontMerchantFromRequest.mockReset();
    mocks.mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: true,
      identifier: 'ogabassey',
      merchant: { id: 'merchant-1', slug: 'ogabassey' } as unknown as Record<
        string,
        unknown
      >,
    });
    mocks.mockCheckRateLimit.mockReset();
    mocks.mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns 404 when the request host does not resolve to a storefront merchant', async () => {
    mocks.mockResolveStorefrontMerchantFromRequest.mockResolvedValueOnce({
      success: false,
      status: 404,
      error: 'IMEI check is only available on storefront hosts',
    } as unknown as ReturnType<
      typeof mocks.mockResolveStorefrontMerchantFromRequest
    > extends Promise<infer T>
      ? T
      : never);
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'full' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('IMEI check is only available on storefront hosts');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-IP rate limit is exceeded', async () => {
    mocks.mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    });
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'full' })
    );

    expect(response.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unknown service tiers before calling the provider', async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'unknown' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid service tier');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the shared provider service id for the selected tier', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            result:
              'Model Name: iPhone 15<br>Activation Status: Activated<br>Estimated Purchase Date: 2025-01-01',
            status: 'success',
          })
        ),
    } as Response);
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'activation' })
    );
    const body = (await response.json()) as {
      success: boolean;
      data: { device: string; activationStatus?: string };
      tier: { name: string; checksIncluded: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.device).toBe('iPhone 15');
    expect(body.data.activationStatus).toBe('Activated');
    expect(body.tier.name).toBe('Non-Active Status PRO');
    expect(mocks.mockGetDeviceImage).toHaveBeenCalledWith('iPhone 15');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('&service=88'),
      expect.any(Object)
    );
  });

  it('returns Xiaomi lock fields for paid Mi tiers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            result:
              'Model Name: Xiaomi 14<br>MI Lock Status: Locked<br>MI Lost Status: Clean',
            status: 'success',
          })
        ),
    } as Response);
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'miLock' })
    );
    const body = (await response.json()) as {
      data: { miLockStatus?: string; miLostStatus?: string };
      tier: { checksIncluded: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.miLockStatus).toBe('Locked');
    expect(body.data.miLostStatus).toBe('Clean');
    expect(body.tier.checksIncluded).toContain('miLockStatus');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('service=206'),
      expect.any(Object)
    );
  });

  it('rejects missing and malformed imei values before calling the provider', async () => {
    const { POST } = await importRoute();

    const missingResponse = await POST(createRequest({ tier: 'full' }));
    const malformedResponse = await POST(
      createRequest({ imei: 'invalid', tier: 'full' })
    );

    expect(missingResponse.status).toBe(400);
    expect(malformedResponse.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 503 when the provider request rejects', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'full' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('IMEI check service unavailable');
  });

  it('maps provider invalid-imei errors to a customer-safe 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ status: 'error', result: 'Error: invalid imei' })
        ),
    } as Response);
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'full' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid IMEI number');
  });

  it('returns 503 when SICKW_API_KEY is not configured', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('SICKW_API_KEY', '');
    const { POST } = await import('./route');

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'full' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Service configuration error');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 503 when the upstream provider request times out', async () => {
    const abortError = new Error('Request timed out');
    abortError.name = 'TimeoutError';
    vi.mocked(fetch).mockRejectedValueOnce(abortError);
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: '354442067957452', tier: 'full' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('IMEI check service unavailable');
  });
});
