import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const csrf = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
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

  it('deletes an authorized connection after valid CSRF', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    const response = await DELETE(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/tiktok/disconnect',
        { method: 'DELETE' }
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ connected: false });
    expect(rpc).toHaveBeenCalledWith('delete_merchant_ads_connection', {
      p_merchant_id: 'merchant',
      p_provider: 'tiktok_ads',
    });
  });
});
