import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockInitializePaystackTransaction = vi.fn();
const mockInitializeKorapayPayment = vi.fn();
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

vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: unknown[]) =>
    mockInitializePaystackTransaction(...args),
}));

vi.mock('@/lib/korapay', () => ({
  initializePayment: (...args: unknown[]) =>
    mockInitializeKorapayPayment(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/wallet/top-up/initialize',
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

describe('POST /api/storefront/customer/wallet/top-up/initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: {},
      user: { email: 'customer@example.com', id: 'user-1' },
    });
    mockResolveVtuCustomer.mockResolvedValue({
      email: 'customer@example.com',
      first_name: 'Ada',
      id: 'customer-1',
      last_name: 'Lovelace',
      phone: '08012345678',
    });
    mockInitializePaystackTransaction.mockResolvedValue({
      authorization_url: 'https://paystack.com/pay/wallet',
    });
    mockInitializeKorapayPayment.mockResolvedValue({
      authorization_url: 'https://korapay.com/pay/wallet',
      checkout_url: 'https://korapay.com/pay/wallet',
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  business_name: 'Baci',
                  id: 'merchant-1',
                  paystack_subaccount_code: 'ACCT_123',
                  slug: 'ogabassey',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'merchant_feature_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  korapay_enabled: true,
                  paystack_enabled: true,
                  preferred_local_gateway: 'paystack',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'transactions') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const response = await POST(
      makeRequest({ amount: 1000, merchantSlug: 'ogabassey' })
    );

    expect(response.status).toBe(401);
  });

  it('returns a wallet checkout payload for paystack', async () => {
    const response = await POST(
      makeRequest({
        amount: 2500,
        gateway: 'paystack',
        merchantSlug: 'ogabassey',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      authorization_url: 'https://paystack.com/pay/wallet',
      gateway: 'paystack',
      success: true,
    });
    expect(mockInitializePaystackTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 250000,
        email: 'customer@example.com',
        metadata: expect.objectContaining({
          customer_id: 'customer-1',
          transaction_type: 'wallet_topup',
        }),
        subaccount: 'ACCT_123',
      })
    );
  });
});
