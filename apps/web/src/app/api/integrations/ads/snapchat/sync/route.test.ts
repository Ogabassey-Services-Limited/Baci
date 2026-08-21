import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

import { POST } from './route';

describe('Snapchat Ads sync route', () => {
  it('denies unauthenticated sync requests before JSON parsing', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/sync',
            { body: 'bad', method: 'POST' }
          )
        )
      ).status
    ).toBe(401);
  });
});
