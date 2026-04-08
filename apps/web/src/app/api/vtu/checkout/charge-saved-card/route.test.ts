import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockPreparePendingVtuTransaction = vi.fn();
const mockGetSavedPaymentMethodById = vi.fn();
const mockChargeAuthorization = vi.fn();
const mockFulfillPendingVtuTransaction = vi.fn();
const mockUpsertPaystackAuthorization = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  preparePendingVtuTransaction: (...args: unknown[]) =>
    mockPreparePendingVtuTransaction(...args),
}));

vi.mock('@/lib/customer-saved-payment-methods', () => ({
  getSavedPaymentMethodById: (...args: unknown[]) =>
    mockGetSavedPaymentMethodById(...args),
  upsertPaystackAuthorization: (...args: unknown[]) =>
    mockUpsertPaystackAuthorization(...args),
}));

vi.mock('@/lib/paystack', () => ({
  chargeAuthorization: (...args: unknown[]) => mockChargeAuthorization(...args),
}));

vi.mock('@/lib/vtu-fulfillment', () => ({
  fulfillPendingVtuTransaction: (...args: unknown[]) =>
    mockFulfillPendingVtuTransaction(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/vtu/checkout/charge-saved-card',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/vtu/checkout/charge-saved-card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
    mockPreparePendingVtuTransaction.mockResolvedValue({
      customer: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
      },
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
      },
      transaction: {
        id: 'vtu-1',
        type: 'airtime',
      },
    });
    mockGetSavedPaymentMethodById.mockResolvedValue({
      id: 'card-1',
      provider_customer_email: 'customer@example.com',
      authorization_code: 'AUTH_123',
    });
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        status: 'success',
        reference: 'VTU-123',
        authorization: {
          authorization_code: 'AUTH_123',
          card_type: 'visa DEBIT',
          last4: '1234',
          exp_month: '08',
          exp_year: '2030',
          bank: 'Access Bank',
          channel: 'card',
          signature: 'SIG_123',
          reusable: true,
          country_code: 'NG',
        },
      },
    });
    mockFulfillPendingVtuTransaction.mockResolvedValue({
      status: 'successful',
      amount: 1000,
      reference: 'VTU-123',
    });
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));
  });

  it('returns a hosted authorization flow when Paystack pauses the charge', async () => {
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        paused: true,
        authorization_url: 'https://paystack.com/pay/auth',
        gateway_response: null,
        reference: 'VTU-123',
        status: 'pending',
      },
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      requires_authorization: true,
      authorization_url: 'https://paystack.com/pay/auth',
    });
  });

  it('returns the fulfilled VTU purchase when the saved-card charge succeeds', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      status: 'successful',
      amount: 1000,
      reference: 'VTU-123',
    });
    expect(mockUpsertPaystackAuthorization).toHaveBeenCalled();
    expect(mockFulfillPendingVtuTransaction).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      transactionId: 'vtu-1',
    });
  });
});
