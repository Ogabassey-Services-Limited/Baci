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

import { DELETE } from './route';

describe('TikTok Ads disconnect route', () => {
  it('requires authentication before the CSRF-protected mutation', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await DELETE(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/disconnect',
            { method: 'DELETE' }
          )
        )
      ).status
    ).toBe(401);
  });

  it('rejects a mutation with a missing CSRF token after authentication', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    csrf.mockResolvedValue({ valid: false });
    expect(
      (
        await DELETE(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/disconnect',
            { method: 'DELETE' }
          )
        )
      ).status
    ).toBe(403);
  });
});
