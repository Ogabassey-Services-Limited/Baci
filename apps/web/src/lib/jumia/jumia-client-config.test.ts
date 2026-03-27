import { describe, expect, it, vi } from 'vitest';
import {
  loadJumiaIntegrationConfig,
  loadSingleJumiaMerchantIntegrationConfig,
} from '@/lib/jumia/jumia-client-config';

function createMockSupabase(response: { data: unknown; error: unknown }) {
  const chainable = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(response),
  };

  Object.defineProperty(chainable, 'then', {
    value(resolve: (value: unknown) => void, reject: (error: unknown) => void) {
      return Promise.resolve(response).then(resolve, reject);
    },
  });

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => chainable),
    })),
    chainable,
  } as unknown as import('@supabase/supabase-js').SupabaseClient & {
    chainable: typeof chainable;
  };
}

describe('jumia-client-config', () => {
  it('loads a merchant-scoped integration config by id', async () => {
    const supabase = createMockSupabase({
      data: {
        id: 'int-123',
        merchant_id: 'merchant-abc',
        shop_id: 'shop-456',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_expires_at: '2026-03-27T10:00:00.000Z',
      },
      error: null,
    });

    const config = await loadJumiaIntegrationConfig(
      supabase,
      'merchant-abc',
      'int-123'
    );

    expect(config).toMatchObject({
      integrationId: 'int-123',
      merchantId: 'merchant-abc',
      shopId: 'shop-456',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(config.tokenExpiresAt).toBeInstanceOf(Date);
    expect(supabase.from).toHaveBeenCalledWith('marketplace_integrations');
    expect(supabase.chainable.eq).toHaveBeenCalledWith('id', 'int-123');
    expect(supabase.chainable.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-abc'
    );
  });

  it('throws when multiple active integrations exist for a merchant', async () => {
    const supabase = createMockSupabase({
      data: [
        { id: 'int-1', merchant_id: 'merchant-abc' },
        { id: 'int-2', merchant_id: 'merchant-abc' },
      ],
      error: null,
    });

    const error = await loadSingleJumiaMerchantIntegrationConfig(
      supabase,
      'merchant-abc'
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      status: 400,
      message: expect.stringContaining('Multiple active Jumia integrations'),
    });
  });
});
