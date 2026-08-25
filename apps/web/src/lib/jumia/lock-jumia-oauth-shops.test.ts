import { describe, expect, it, vi } from 'vitest';
import { lockJumiaOAuthShops } from './lock-jumia-oauth-shops';

describe('lockJumiaOAuthShops', () => {
  it('acquires the ordered provider-shop locks through the scoped RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(
      lockJumiaOAuthShops({ rpc } as never, 'merchant-1', ['shop-b', 'shop-a'])
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('lock_jumia_oauth_shops', {
      p_merchant_id: 'merchant-1',
      p_shop_ids: ['shop-b', 'shop-a'],
    });
  });

  it('reports database lock failures', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'XX' } });
    await expect(
      lockJumiaOAuthShops({ rpc } as never, 'merchant-1', ['shop-a'])
    ).resolves.toBe(false);
  });
});
