import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockResolveCustomerSavingsContext = vi.fn();
const mockGetCustomerSavingsFeatureSettings = vi.fn();
const mockInitializePaystackTransaction = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: unknown[]) =>
    mockInitializePaystackTransaction(...args),
}));

vi.mock('@/app/api/storefront/customer/savings/shared', () => ({
  getCustomerSavingsFeatureSettings: (...args: unknown[]) =>
    mockGetCustomerSavingsFeatureSettings(...args),
  resolveCustomerSavingsContext: (...args: unknown[]) =>
    mockResolveCustomerSavingsContext(...args),
}));

import { POST } from './route';

function postRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/savings/auto-debit/authorize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

describe('/api/storefront/customer/savings/auto-debit/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { email: 'jane@example.com', id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
    mockGetCustomerSavingsFeatureSettings.mockResolvedValue({
      autoDebitEnabled: true,
      paystackEnabled: true,
      savingsEnabled: true,
    });
    mockInitializePaystackTransaction.mockResolvedValue({
      access_code: 'access-code',
      authorization_url: 'https://paystack.example.com/checkout',
      reference: 'SAV-AUTH-123',
    });
  });

  it('returns 401 when the customer is not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
    });

    const response = await POST(postRequest({ merchantSlug: 'ogabassey' }));

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid authorization input', async () => {
    const response = await POST(postRequest({ amount: -1 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed authorization JSON', async () => {
    const response = await POST(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/savings/auto-debit/authorize',
        {
          body: '{',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'MALFORMED_JSON',
      error: 'Malformed JSON',
    });
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 403 when auto debit is disabled', async () => {
    const mockSupabase = { from: vi.fn() };
    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { email: 'jane@example.com', id: 'customer-1' },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123',
        slug: 'ogabassey',
      },
      supabase: mockSupabase,
    });
    mockGetCustomerSavingsFeatureSettings.mockResolvedValue({
      autoDebitEnabled: false,
      paystackEnabled: true,
      savingsEnabled: true,
    });

    const response = await POST(postRequest({ merchantSlug: 'ogabassey' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CUSTOMER_SAVINGS_AUTO_DEBIT_DISABLED');
  });

  it('returns 403 when paystack is disabled for the merchant', async () => {
    const mockSupabase = { from: vi.fn() };
    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { email: 'jane@example.com', id: 'customer-1' },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123',
        slug: 'ogabassey',
      },
      supabase: mockSupabase,
    });
    mockGetCustomerSavingsFeatureSettings.mockResolvedValue({
      autoDebitEnabled: true,
      paystackEnabled: false,
      savingsEnabled: true,
    });

    const response = await POST(postRequest({ merchantSlug: 'ogabassey' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('PAYSTACK_DISABLED');
  });

  it('returns 500 when Paystack initialization fails', async () => {
    const mockSupabase = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: 'txn-1', error: null })
        .mockResolvedValueOnce({ data: true, error: null }),
    };
    mockInitializePaystackTransaction.mockRejectedValue(
      new Error('paystack unavailable')
    );
    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: {
        email: 'jane@example.com',
        first_name: 'Jane',
        id: 'customer-1',
        last_name: 'Doe',
        phone: '+2348012345678',
      },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123',
        slug: 'ogabassey',
      },
      supabase: mockSupabase,
    });

    const response = await POST(
      postRequest({ amount: 100, merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to initialize savings auto-debit authorization',
    });
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(
      2,
      'fail_customer_savings_authorization_transaction',
      expect.objectContaining({
        p_customer_id: 'customer-1',
        p_failure_message: 'paystack unavailable',
        p_merchant_id: 'merchant-1',
      })
    );
  });

  it('initializes paystack and persists the pending authorization transaction', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: 'txn-1', error: null }),
    };

    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: {
        email: 'jane@example.com',
        first_name: 'Jane',
        id: 'customer-1',
        last_name: 'Doe',
        phone: '+2348012345678',
      },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123',
        slug: 'ogabassey',
      },
      supabase: mockSupabase,
    });

    const response = await POST(
      postRequest({
        amount: 100,
        customerName: 'Jane Doe',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockInitializePaystackTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        email: 'jane@example.com',
        metadata: expect.objectContaining({
          purpose: 'device_savings_auto_debit',
          savings_accounting_policy: 'credit_wallet',
          transaction_type: 'savings_authorization',
        }),
      })
    );
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_customer_savings_authorization_transaction',
      expect.objectContaining({
        p_amount: 100,
        p_customer_id: 'customer-1',
        p_merchant_id: 'merchant-1',
      })
    );
    expect(mockSupabase.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitializePaystackTransaction.mock.invocationCallOrder[0]
    );
    expect(body.success).toBe(true);
    expect(body.gateway).toBe('paystack');
  });

  it('returns 500 when the pending authorization transaction cannot be inserted', async () => {
    const mockSupabase = {
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
    };

    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: {
        email: 'jane@example.com',
        first_name: 'Jane',
        id: 'customer-1',
        last_name: 'Doe',
        phone: '+2348012345678',
      },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123',
        slug: 'ogabassey',
      },
      supabase: mockSupabase,
    });

    const response = await POST(
      postRequest({ amount: 100, merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to initialize savings auto-debit authorization',
    });
    expect(mockInitializePaystackTransaction).not.toHaveBeenCalled();
  });
});
