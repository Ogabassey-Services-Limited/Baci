import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

import { GET } from './route';

describe('Snapchat Ads connect route', () => {
  it('denies unauthenticated OAuth starts', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/connect'
          )
        )
      ).status
    ).toBe(401);
  });
});
