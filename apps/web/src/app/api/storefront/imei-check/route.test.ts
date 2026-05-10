import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDeviceImage = vi.fn<(device: string) => string>(
  () => 'https://cdn.example.com/device.png'
);

vi.mock('@/lib/device-images', () => ({
  getDeviceImage: (device: string) => mockGetDeviceImage(device),
}));

function createRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
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
    mockGetDeviceImage.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
    expect(mockGetDeviceImage).toHaveBeenCalledWith('iPhone 15');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('&service=88'),
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
