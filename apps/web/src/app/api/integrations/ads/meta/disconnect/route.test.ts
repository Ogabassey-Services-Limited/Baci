import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const csrf = vi.hoisted(() => vi.fn());
const resolveMerchant = vi.hoisted(() => vi.fn());
const permission = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: vi.fn(),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));
vi.mock('@/lib/ads/merchant-context', () => ({
  resolveAdsMerchantAccess: (...args: unknown[]) => resolveMerchant(...args),
}));
vi.mock('@/lib/ads/analytics-cache', () => ({
  invalidateAdsAnalyticsCache: (...args: unknown[]) => invalidate(...args),
}));

import { DELETE } from './route';

describe('Meta Ads disconnect route', () => {
  it('requires authentication before CSRF or deletion', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await DELETE(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/meta/disconnect',
            { method: 'DELETE' }
          )
        )
      ).status
    ).toBe(401);
  });

  it('invalidates the merchant analytics snapshots after a successful deletion', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    csrf.mockResolvedValue({ valid: true });
    resolveMerchant.mockResolvedValue({
      access: { merchantId: 'merchant' },
      response: null,
    });
    permission.mockReturnValue(true);

    const response = await DELETE(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/meta/disconnect',
        { method: 'DELETE' }
      )
    );

    expect(response.status).toBe(200);
    expect(invalidate).toHaveBeenCalledWith('merchant');
  });
});
