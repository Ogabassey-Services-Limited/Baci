import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithCsrf = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf }));

import { usdtWalletFundingApi } from './usdt-wallet-funding-api';

describe('usdtWalletFundingApi', () => {
  beforeEach(() => fetchWithCsrf.mockReset());

  it('initializes a customer-owned crypto address', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({
        amount: 65,
        chain: 'TRX',
        currency: 'USDT',
        depositAddress: 'TVaultAddress',
        reference: 'wusdt_ref',
        success: true,
      }),
      ok: true,
      status: 200,
    });

    await expect(
      usdtWalletFundingApi.initialize({
        amount: 65,
        billingAddress: {
          city: 'Lagos',
          country: 'NG',
          line1: '1 Baci Street',
          zipCode: '100001',
        },
        chain: 'TRX',
        merchantSlug: 'ogabassey',
      })
    ).resolves.toMatchObject({
      depositAddress: 'TVaultAddress',
      kind: 'ready',
      reference: 'wusdt_ref',
    });
  });

  it('polls the reference status without sending payment metadata', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({ fundingStatus: 'completed', success: true }),
      ok: true,
      status: 200,
    });

    await expect(
      usdtWalletFundingApi.status('wusdt_ref')
    ).resolves.toMatchObject({ fundingStatus: 'completed', kind: 'ready' });
    expect(fetchWithCsrf).toHaveBeenCalledWith(
      '/api/storefront/customer/wallet/top-up/usdt/wusdt_ref',
      { method: 'GET' }
    );
  });
});
