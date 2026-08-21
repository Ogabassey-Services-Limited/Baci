import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
const csrf = vi.fn();
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));

import { GET, PATCH } from './route';

describe('TikTok Ads accounts route', () => {
  it('denies unauthorized advertiser discovery before accepting a browser account id', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts'
          )
        )
      ).status
    ).toBe(401);
  });

  it('enforces integrations permission for an authenticated merchant', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(false);
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts'
          )
        )
      ).status
    ).toBe(403);
  });

  it('rejects browser-supplied opaque IDs before provider rediscovery when CSRF is valid', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts',
            {
              body: JSON.stringify({ accountId: 'not an id' }),
              method: 'PATCH',
            }
          )
        )
      ).status
    ).toBe(400);
  });
});
