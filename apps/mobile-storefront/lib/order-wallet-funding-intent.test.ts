import { z } from 'zod';
import {
  createOrderWalletFundingIntent,
  getOrderWalletFundingIntent,
  WalletFundingIntentValidationError,
} from '@/lib/order-wallet-funding-intent';

const mockFetchJson = jest.fn();
const intentId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const validCreateResponse = {
  account: {
    accountName: 'Ogabassey/Jane Doe',
    accountNumber: '1234567890',
    bankName: 'Titan Paystack',
    provider: 'paystack',
  },
  intent: {
    currency: 'NGN',
    expectedAmount: 15000,
    expiresAt: '2026-05-26T12:30:00.000Z',
    fundedAmount: 0,
    id: intentId,
    orderId,
    status: 'pending',
    targetOrderAmount: 18000,
  },
};

jest.mock('@/lib/storefront-customer-api-client', () => ({
  createStorefrontCustomerApiClient: () => ({
    buildMerchantIdentifiers: jest.fn(() => ({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
    })),
    fetchJson: (...args: unknown[]) => mockFetchJson(...args),
  }),
}));

describe('order wallet funding intent API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchJson.mockResolvedValue(validCreateResponse);
  });

  it('creates an order funding intent with merchant identifiers and optional consent', async () => {
    await expect(
      createOrderWalletFundingIntent({
        consent: true,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
        orderId,
      })
    ).resolves.toMatchObject({
      intent: { expectedAmount: 15000, id: intentId },
    });

    expect(mockFetchJson).toHaveBeenCalledWith({
      body: {
        consent: true,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
        orderId,
      },
      method: 'POST',
      path: '/api/storefront/customer/wallet/order-funding-intents',
    });
  });

  it('omits consent when creating an intent without account-provisioning approval', async () => {
    await expect(
      createOrderWalletFundingIntent({
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
        orderId,
      })
    ).resolves.toMatchObject({
      intent: { expectedAmount: 15000, id: intentId },
    });

    expect(mockFetchJson).toHaveBeenCalledWith({
      body: {
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
        orderId,
      },
      method: 'POST',
      path: '/api/storefront/customer/wallet/order-funding-intents',
    });
  });

  it('omits consent when consent is explicitly false', async () => {
    await createOrderWalletFundingIntent({
      consent: false,
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      orderId,
    });

    expect(mockFetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.objectContaining({ consent: expect.anything() }),
      })
    );
  });

  it('supports an injected API client for create edge cases', async () => {
    const client = {
      buildMerchantIdentifiers: jest.fn(() => ({
        merchantId: undefined,
        merchantSlug: 'ogabassey',
      })),
      fetchJson: jest.fn(async () => validCreateResponse),
    };

    await expect(
      createOrderWalletFundingIntent({
        client,
        merchantId: null,
        merchantSlug: 'ogabassey',
        orderId,
      })
    ).resolves.toMatchObject({
      intent: { expectedAmount: 15000, id: intentId },
    });

    expect(client.buildMerchantIdentifiers).toHaveBeenCalledWith({
      merchantId: null,
      merchantSlug: 'ogabassey',
    });
    expect(client.fetchJson).toHaveBeenCalledWith({
      body: {
        merchantSlug: 'ogabassey',
        orderId,
      },
      method: 'POST',
      path: '/api/storefront/customer/wallet/order-funding-intents',
    });
  });

  it('polls a scoped order funding intent', async () => {
    mockFetchJson.mockResolvedValue({
      intent: {
        currency: 'NGN',
        debitedAmount: 18000,
        excessAmount: 0,
        expectedAmount: 15000,
        expiresAt: '2026-05-26T12:30:00.000Z',
        fundedAmount: 15000,
        id: intentId,
        orderId,
        status: 'completed',
        targetOrderAmount: 18000,
      },
    });

    await expect(
      getOrderWalletFundingIntent({
        intentId,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    ).resolves.toMatchObject({
      intent: { debitedAmount: 18000, status: 'completed' },
    });

    expect(mockFetchJson).toHaveBeenCalledWith({
      path: `/api/storefront/customer/wallet/order-funding-intents/${intentId}`,
      query: { merchantId: 'merchant-1', merchantSlug: 'ogabassey' },
    });
  });

  it('supports an injected API client for poll merchant identifier variations', async () => {
    const client = {
      buildMerchantIdentifiers: jest.fn(() => ({
        merchantId: 'merchant-1',
        merchantSlug: undefined,
      })),
      fetchJson: jest.fn(async () => ({
        intent: {
          ...validCreateResponse.intent,
          debitedAmount: 18000,
          excessAmount: 0,
          fundedAmount: 15000,
          status: 'completed',
        },
      })),
    };

    await expect(
      getOrderWalletFundingIntent({
        client,
        intentId,
        merchantId: 'merchant-1',
        merchantSlug: null,
      })
    ).resolves.toMatchObject({
      intent: { debitedAmount: 18000, status: 'completed' },
    });

    expect(client.buildMerchantIdentifiers).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      merchantSlug: null,
    });
    expect(client.fetchJson).toHaveBeenCalledWith({
      path: `/api/storefront/customer/wallet/order-funding-intents/${intentId}`,
      query: { merchantId: 'merchant-1' },
    });
  });

  it('rejects malformed server payloads', async () => {
    mockFetchJson.mockResolvedValue({ intent: { id: 'intent-1' } });

    await expect(
      createOrderWalletFundingIntent({
        merchantSlug: 'ogabassey',
        orderId,
      })
    ).rejects.toBeInstanceOf(WalletFundingIntentValidationError);
  });

  it('exposes validation error details for malformed server payloads', async () => {
    mockFetchJson.mockResolvedValue({ intent: { id: 'intent-1' } });

    await expect(
      createOrderWalletFundingIntent({
        merchantSlug: 'ogabassey',
        orderId,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        'Invalid wallet order funding intent create response'
      ),
      name: 'WalletFundingIntentValidationError',
      zodError: expect.any(z.ZodError),
    });
  });

  it('propagates create transport failures', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('network down'));

    await expect(
      createOrderWalletFundingIntent({
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
        orderId,
      })
    ).rejects.toThrow(/network down/);
  });

  it('rejects malformed poll payloads', async () => {
    mockFetchJson.mockResolvedValue({ intent: { id: 'intent-1' } });

    await expect(
      getOrderWalletFundingIntent({
        intentId,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    ).rejects.toThrow(/Invalid wallet order funding intent poll response/);
  });

  it('propagates poll transport failures', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('timeout'));

    await expect(
      getOrderWalletFundingIntent({
        intentId,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    ).rejects.toThrow(/timeout/);
  });
});
