import { jest } from '@jest/globals';
import { createUsdtWalletFundingClient } from './usdt-wallet-funding-client';

describe('createUsdtWalletFundingClient', () => {
  it('reads the isolated USDT balance from the storefront wallet contract', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      json: () => Promise.resolve({ balances: { NGN: 1000, USDT: 12.5 } }),
      ok: true,
      status: 200,
    } as Response);
    const client = createUsdtWalletFundingClient({
      accessToken: 'token',
      apiBaseUrl: 'https://shop.example.com',
      fetchImpl,
    });

    await expect(client.balance('ogabassey')).resolves.toBe(12.5);
  });

  it('initializes a USDT address with billing context', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          depositAddress: 'TVaultAddress',
          reference: 'wusdt_ref',
          success: true,
        }),
      ok: true,
      status: 200,
    } as Response);
    const client = createUsdtWalletFundingClient({
      apiBaseUrl: 'https://shop.example.com',
      fetchImpl,
    });

    await expect(
      client.initialize({
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
    ).resolves.toMatchObject({ address: 'TVaultAddress', kind: 'ready' });
  });
});
