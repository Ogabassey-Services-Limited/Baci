import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockResolveCustomerSavingsContext = vi.fn();
const mockListSavedPaymentMethods = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/app/api/storefront/customer/savings/shared', () => ({
  getSavingsIdentifierParams: (searchParams: URLSearchParams) => ({
    merchantId: searchParams.get('merchantId') ?? undefined,
    merchantSlug: searchParams.get('merchantSlug') ?? undefined,
  }),
  resolveCustomerSavingsContext: (...args: unknown[]) =>
    mockResolveCustomerSavingsContext(...args),
}));

vi.mock('@/lib/customer-saved-payment-methods', () => ({
  listSavedPaymentMethods: (...args: unknown[]) =>
    mockListSavedPaymentMethods(...args),
}));

import { GET } from './route';

describe('GET /api/storefront/customer/payment-methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { email: 'jane@example.com', id: 'user-1' },
    });
    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: { from: vi.fn() },
    });
    mockListSavedPaymentMethods.mockResolvedValue([
      {
        bank: 'Access Bank',
        brand: 'visa',
        exp_month: '08',
        exp_year: '2030',
        id: 'card-1',
        is_default: true,
        label: 'Access Bank ending 1234',
        last4: '1234',
        provider: 'paystack',
      },
    ]);
  });

  it('requires customer auth before resolving payment methods', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
    });

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/payment-methods?merchantSlug=ogabassey'
      )
    );

    expect(response.status).toBe(401);
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payment-methods query', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/payment-methods'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'VALIDATION_ERROR',
      error: 'Invalid request',
    });
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns saved Paystack payment methods for the storefront customer', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/payment-methods?merchantSlug=ogabassey'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.methods).toHaveLength(1);
    expect(body.methods[0]).toMatchObject({
      id: 'card-1',
      label: 'Access Bank ending 1234',
      provider: 'paystack',
    });
    expect(mockListSavedPaymentMethods).toHaveBeenCalledWith({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      supabase: { from: expect.any(Function) },
    });
  });

  it('returns 500 when saved payment method lookup fails', async () => {
    mockListSavedPaymentMethods.mockRejectedValue(
      new Error('payment methods unavailable')
    );

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/payment-methods?merchantSlug=ogabassey'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'PAYMENT_METHODS_FETCH_FAILED',
      error: 'Failed to fetch payment methods',
    });
  });
});
