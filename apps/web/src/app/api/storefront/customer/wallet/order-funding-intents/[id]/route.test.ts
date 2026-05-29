import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockResolveWalletTopUpMerchant = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockGetOrderWalletFundingIntent = vi.fn();
const mockExpireStaleWalletFundingIntents = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: (...args: unknown[]) =>
    mockResolveWalletTopUpMerchant(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/order-wallet-funding-intents', () => ({
  expireStaleWalletFundingIntents: (...args: unknown[]) =>
    mockExpireStaleWalletFundingIntents(...args),
  getOrderWalletFundingIntent: (...args: unknown[]) =>
    mockGetOrderWalletFundingIntent(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET } from './route';

const merchant = {
  business_name: 'Ogabassey',
  id: 'merchant-1',
  paystack_subaccount_code: 'ACCT_merchant123',
  slug: 'ogabassey',
};

const customer = {
  email: 'jane@example.com',
  first_name: 'Jane',
  id: 'customer-1',
  last_name: 'Doe',
  phone: '+2348012345678',
};

const intent = {
  currency: 'NGN',
  debitedAmount: 0,
  expectedAmount: 15_000,
  excessAmount: 0,
  expiresAt: '2026-05-26T12:30:00.000Z',
  fundedAmount: 10_000,
  id: 'intent-1',
  orderId: 'order-1',
  status: 'pending',
  targetOrderAmount: 18_000,
};

function getRequest(url: string) {
  return new NextRequest(url);
}

describe('/api/storefront/customer/wallet/order-funding-intents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { email: 'jane@example.com', id: 'user-1' },
    });
    mockResolveWalletTopUpMerchant.mockResolvedValue(merchant);
    mockResolveVtuCustomer.mockResolvedValue(customer);
    mockExpireStaleWalletFundingIntents.mockResolvedValue(undefined);
    mockGetOrderWalletFundingIntent.mockResolvedValue(intent);
  });

  it('returns 401 before database work when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=ogabassey'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );

    expect(response.status).toBe(401);
    expect(mockGetOrderWalletFundingIntent).not.toHaveBeenCalled();
  });

  it('rejects a missing merchant identifier', async () => {
    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );

    expect(response.status).toBe(400);
    expect(mockResolveWalletTopUpMerchant).not.toHaveBeenCalled();
  });

  it('returns the scoped intent for the authenticated customer', async () => {
    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=ogabassey'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockExpireStaleWalletFundingIntents).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
      })
    );
    expect(mockGetOrderWalletFundingIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-1',
        id: 'intent-1',
        merchantId: 'merchant-1',
      })
    );
    expect(body.intent).toEqual({
      ...intent,
      orderPaid: false,
      remainingAmount: 5000,
    });
  });

  it('returns 404 when the intent is not scoped to the customer', async () => {
    mockGetOrderWalletFundingIntent.mockResolvedValue(null);

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=ogabassey'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );

    expect(response.status).toBe(404);
  });

  it('returns 404 when the merchant cannot be resolved', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValue(null);

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=missing'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );

    expect(response.status).toBe(404);
    expect(mockResolveVtuCustomer).not.toHaveBeenCalled();
    expect(mockGetOrderWalletFundingIntent).not.toHaveBeenCalled();
  });

  it('returns 409 for guest checkout customers', async () => {
    mockResolveVtuCustomer.mockResolvedValue(null);

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=ogabassey'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('GUEST_CHECKOUT');
    expect(mockGetOrderWalletFundingIntent).not.toHaveBeenCalled();
  });

  it('returns 500 when expiring stale intents fails', async () => {
    mockExpireStaleWalletFundingIntents.mockRejectedValue(
      new Error('rpc failed')
    );

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=ogabassey'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );

    expect(response.status).toBe(500);
    expect(mockGetOrderWalletFundingIntent).not.toHaveBeenCalled();
  });

  it('returns 500 when polling the intent fails', async () => {
    mockGetOrderWalletFundingIntent.mockRejectedValue(
      new Error('query failed')
    );

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/order-funding-intents/intent-1?merchantSlug=ogabassey'
      ),
      { params: Promise.resolve({ id: 'intent-1' }) }
    );

    expect(response.status).toBe(500);
  });
});
