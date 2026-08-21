import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const csrf = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));

import { POST } from './route';

describe('Meta Ads sync route', () => {
  it('requires auth before parsing a browser sync request', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/meta/sync',
            { method: 'POST' }
          )
        )
      ).status
    ).toBe(401);
  });
});
