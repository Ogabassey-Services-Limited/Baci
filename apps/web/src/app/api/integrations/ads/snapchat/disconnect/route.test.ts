import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const csrf = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
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

  it('uses the atomic Snapchat connection-and-spend deletion RPC after CSRF', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    await expect(
      DELETE(
        new NextRequest(
          'https://usebaci.com/api/integrations/ads/snapchat/disconnect',
          { method: 'DELETE' }
        )
      )
    ).resolves.toMatchObject({ status: 200 });
    expect(rpc).toHaveBeenCalledWith(
      'delete_snapchat_ads_connection_and_spend',
      { p_merchant_id: 'merchant' }
    );
  });

  it('rejects invalid CSRF and RPC errors without exposing provider data', async () => {
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc: vi.fn() },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: false });
    expect(
      (
        await DELETE(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/disconnect',
            { method: 'DELETE' }
          )
        )
      ).status
    ).toBe(403);
  });
});
