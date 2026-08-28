import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticate = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCsrf = vi.fn();
const mockSync = vi.fn();
const mockInvalidateAdsAnalyticsCache = vi.fn();
const {
  mockCredentialSupabase,
  mockCreateAdsCredentialServiceClient,
  mockSpendSupabase,
  mockCreateAdsSpendServiceClient,
} = vi.hoisted(() => ({
  mockCreateAdsCredentialServiceClient: vi.fn(),
  mockCredentialSupabase: { rpc: vi.fn() },
  mockCreateAdsSpendServiceClient: vi.fn(),
  mockSpendSupabase: { rpc: vi.fn() },
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticate(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCsrf(...args),
}));
vi.mock('@/lib/ads/analytics-cache', () => ({
  invalidateAdsAnalyticsCache: (...args: unknown[]) =>
    mockInvalidateAdsAnalyticsCache(...args),
}));
vi.mock('@/lib/ads/server-spend-client', () => ({
  createAdsSpendServiceClient: () => {
    mockCreateAdsSpendServiceClient();
    return mockSpendSupabase;
  },
}));
vi.mock('@/lib/ads/server-credential-client', () => ({
  createAdsCredentialServiceClient: () => {
    mockCreateAdsCredentialServiceClient();
    return mockCredentialSupabase;
  },
}));
vi.mock('@/lib/google-ads/sync', () => ({
  GoogleAdsSyncError: class GoogleAdsSyncError extends Error {
    code = 'GOOGLE_ADS_SYNC_FAILED';
  },
  syncGoogleAdsSpendForMerchant: (...args: unknown[]) => mockSync(...args),
}));
vi.mock('@/lib/google-ads/config', () => ({
  GoogleAdsConfigError: class GoogleAdsConfigError extends Error {},
}));
vi.mock('@/lib/google-ads/provider', () => ({
  GoogleAdsProviderError: class GoogleAdsProviderError extends Error {
    code = 'GOOGLE_ADS_PROVIDER_FAILED';
  },
}));

import { POST } from './route';

describe('POST /api/integrations/ads/google/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({ merchantId: 'merchant-1' });
    mockHasPermission.mockReturnValue(true);
    mockCsrf.mockResolvedValue({ valid: true });
    mockSync.mockResolvedValue({ customerId: '1234567890', rowsWritten: 2 });
    mockCreateAdsCredentialServiceClient.mockClear();
    mockCreateAdsSpendServiceClient.mockClear();
  });

  it('returns 401 before reading the sync body when unauthenticated', async () => {
    mockAuthenticate.mockResolvedValueOnce({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    const response = await POST(
      new NextRequest('https://usebaci.com/api/integrations/ads/google/sync', {
        method: 'POST',
      })
    );
    expect(response.status).toBe(401);
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockCreateAdsCredentialServiceClient).not.toHaveBeenCalled();
    expect(mockCreateAdsSpendServiceClient).not.toHaveBeenCalled();
  });

  it('rejects browser mutations without a valid CSRF token', async () => {
    mockCsrf.mockResolvedValueOnce({
      response: Response.json({ error: 'Invalid CSRF token' }, { status: 403 }),
      valid: false,
    });
    const response = await POST(
      new NextRequest('https://usebaci.com/api/integrations/ads/google/sync', {
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-08-20',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    expect(response.status).toBe(403);
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockCreateAdsCredentialServiceClient).not.toHaveBeenCalled();
    expect(mockCreateAdsSpendServiceClient).not.toHaveBeenCalled();
  });

  it('validates and runs a bounded sync range', async () => {
    const response = await POST(
      new NextRequest('https://usebaci.com/api/integrations/ads/google/sync', {
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-08-20',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      customerId: '1234567890',
      rowsWritten: 2,
      synced: true,
    });
    expect(mockSync).toHaveBeenCalledWith({
      endDate: '2026-08-21',
      finalChunk: true,
      merchantId: 'merchant-1',
      credentialSupabase: mockCredentialSupabase,
      spendSupabase: mockSpendSupabase,
      startDate: '2026-08-20',
      supabase: {},
      syncRunId: expect.any(String),
      syncRunStartedAt: expect.any(String),
    });
    expect(mockInvalidateAdsAnalyticsCache).toHaveBeenCalledExactlyOnceWith(
      'merchant-1'
    );
    expect(mockCreateAdsCredentialServiceClient).toHaveBeenCalledTimes(1);
  });

  it('invalidates only after a successful final chunk', async () => {
    const request = (finalChunk: boolean) =>
      new NextRequest('https://usebaci.com/api/integrations/ads/google/sync', {
        body: JSON.stringify({
          endDate: '2026-08-21',
          finalChunk,
          startDate: '2026-08-20',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

    expect((await POST(request(false))).status).toBe(200);
    expect(mockCreateAdsCredentialServiceClient).toHaveBeenCalledTimes(1);
    expect(mockInvalidateAdsAnalyticsCache).not.toHaveBeenCalled();

    mockSync.mockRejectedValueOnce(new Error('write failed'));
    expect((await POST(request(true))).status).toBe(502);
    expect(mockCreateAdsCredentialServiceClient).toHaveBeenCalledTimes(2);
    expect(mockInvalidateAdsAnalyticsCache).not.toHaveBeenCalled();
  });

  it('returns 400 for a range over the sync limit', async () => {
    const response = await POST(
      new NextRequest('https://usebaci.com/api/integrations/ads/google/sync', {
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-01-01',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    expect(response.status).toBe(400);
    expect(mockGetUserAccess).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockCreateAdsCredentialServiceClient).not.toHaveBeenCalled();
    expect(mockCreateAdsSpendServiceClient).not.toHaveBeenCalled();
  });
});
