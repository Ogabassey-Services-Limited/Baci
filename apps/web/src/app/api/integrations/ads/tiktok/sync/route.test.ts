import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

import { POST } from './route';

describe('TikTok Ads sync route', () => {
  it('denies a sync before any provider call', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/sync',
            { body: '{}', method: 'POST' }
          )
        )
      ).status
    ).toBe(401);
  });
});
