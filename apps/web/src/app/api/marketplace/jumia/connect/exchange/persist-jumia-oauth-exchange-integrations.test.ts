import { describe, expect, it, vi } from 'vitest';
import { persistJumiaOAuthExchangeIntegrations } from './persist-jumia-oauth-exchange-integrations';

const row = {
  merchant_id: 'merchant-1',
  platform: 'jumia' as const,
  shop_id: 'shop-1',
  marketplace_key: 'oauth',
  connection_method: 'oauth' as const,
  shop_name: 'Shop',
  country_code: 'NG',
  access_token: 'access',
  refresh_token: 'refresh',
  token_expires_at: '2026-08-22T00:00:00.000Z',
  is_active: true,
  jumia_authorization_id: null,
  sync_config: { orders: true },
};

describe('persistJumiaOAuthExchangeIntegrations', () => {
  it('retries transient upsert failures before giving up', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'connection reset' } })
      .mockResolvedValueOnce({ error: null });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

    const result = await persistJumiaOAuthExchangeIntegrations({
      supabase: supabase as never,
      integrationRows: [row],
    });

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('returns the last upsert error after exhausting retries', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValue({ error: { message: 'upsert failed' } });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

    const result = await persistJumiaOAuthExchangeIntegrations({
      supabase: supabase as never,
      integrationRows: [row],
    });

    expect(result).toEqual({
      ok: false,
      error: { message: 'upsert failed' },
    });
    expect(upsert).toHaveBeenCalledTimes(3);
  });
});
