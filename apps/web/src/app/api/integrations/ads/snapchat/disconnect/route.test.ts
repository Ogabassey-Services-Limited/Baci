import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

import { DELETE } from './route';

describe('Snapchat Ads disconnect route', () => {
  it('denies unauthenticated deletion before CSRF or RPC work', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await DELETE(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/disconnect',
            { method: 'DELETE' }
          )
        )
      ).status
    ).toBe(401);
  });
});
