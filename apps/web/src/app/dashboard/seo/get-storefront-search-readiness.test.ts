import { describe, expect, it, vi } from 'vitest';
import { ensurePermission } from '@/lib/merchant-server';

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: vi.fn(),
  MerchantAuthenticationRequiredError: class MerchantAuthenticationRequiredError extends Error {},
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

const { getStorefrontSearchReadiness } = await import(
  './get-storefront-search-readiness'
);

describe('getStorefrontSearchReadiness', () => {
  it('rejects a caller-supplied merchant id that differs from the authorized merchant', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    vi.mocked(ensurePermission).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);

    await expect(getStorefrontSearchReadiness('merchant-2')).rejects.toThrow(
      'Merchant mismatch'
    );
  });
});
