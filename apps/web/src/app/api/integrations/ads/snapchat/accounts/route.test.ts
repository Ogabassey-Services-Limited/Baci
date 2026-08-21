import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

import { GET, PATCH } from './route';

describe('Snapchat Ads accounts route', () => {
  it('denies unauthenticated discovery and selection', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts'
          )
        )
      ).status
    ).toBe(401);
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts',
            { body: '{}', method: 'PATCH' }
          )
        )
      ).status
    ).toBe(401);
  });
});
