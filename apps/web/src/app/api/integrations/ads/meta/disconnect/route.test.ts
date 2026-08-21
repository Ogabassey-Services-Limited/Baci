import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: vi.fn() }));

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
});
