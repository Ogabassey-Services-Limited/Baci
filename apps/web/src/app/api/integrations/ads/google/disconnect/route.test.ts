import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticate = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCsrf = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };
const mockInvalidate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticate(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCsrf(...args),
}));
vi.mock('@/lib/ads/analytics-cache', () => ({
  invalidateAdsAnalyticsCache: (...args: unknown[]) => mockInvalidate(...args),
}));

import { DELETE, POST } from './route';

describe('Google Ads disconnect route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      error: null,
      supabase: mockSupabase,
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({ merchantId: 'merchant-1' });
    mockHasPermission.mockReturnValue(true);
    mockCsrf.mockResolvedValue({ valid: true });
    mockRpc.mockResolvedValue({ data: true, error: null });
  });

  it('returns 401 before mutating when unauthenticated', async () => {
    mockAuthenticate.mockResolvedValueOnce({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    const response = await DELETE(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/disconnect',
        {
          method: 'DELETE',
        }
      )
    );
    expect(response.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('requires CSRF protection for browser mutations', async () => {
    mockCsrf.mockResolvedValueOnce({
      response: Response.json({ error: 'Invalid CSRF token' }, { status: 403 }),
      valid: false,
    });
    const response = await POST(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/disconnect',
        {
          method: 'POST',
        }
      )
    );
    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('deletes only the authenticated merchant Google Ads connection', async () => {
    const response = await DELETE(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/disconnect',
        {
          method: 'DELETE',
        }
      )
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false });
    expect(mockRpc).toHaveBeenCalledWith('delete_google_ads_connection', {
      p_merchant_id: 'merchant-1',
    });
    expect(mockInvalidate).toHaveBeenCalledWith('merchant-1');
  });
});
