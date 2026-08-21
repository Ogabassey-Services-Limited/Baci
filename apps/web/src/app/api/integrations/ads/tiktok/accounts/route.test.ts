import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

import { GET } from './route';

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
});
