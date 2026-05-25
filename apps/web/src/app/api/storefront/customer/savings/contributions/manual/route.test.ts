import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockResolveCustomerSavingsContext = vi.fn();
const mockGetCustomerSavingsFeatureSettings = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
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
    'http://localhost:3000/api/storefront/customer/savings/contributions/manual',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

describe('/api/storefront/customer/savings/contributions/manual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
    mockGetCustomerSavingsFeatureSettings.mockResolvedValue({
      autoDebitEnabled: true,
      paystackEnabled: true,
      savingsEnabled: true,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
    });

    const response = await POST(
      postRequest({
        amount: 20000,
        goalId: '00000000-0000-4000-8000-000000000101',
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 403 when customer savings is disabled', async () => {
    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: { rpc: vi.fn() },
    });
    mockGetCustomerSavingsFeatureSettings.mockResolvedValue({
      autoDebitEnabled: true,
      paystackEnabled: true,
      savingsEnabled: false,
    });

    const response = await POST(
      postRequest({
        amount: 20000,
        goalId: '00000000-0000-4000-8000-000000000101',
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      })
    );

    expect(response.status).toBe(403);
  });

  it('returns 400 for malformed contribution input', async () => {
    const response = await POST(
      postRequest({
        amount: -1,
        idempotencyKey: '',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed contribution JSON', async () => {
    const response = await POST(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/savings/contributions/manual',
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

  it('returns 500 when savings context resolution throws unexpectedly', async () => {
    mockResolveCustomerSavingsContext.mockRejectedValue(
      new Error('context unavailable')
    );

    const response = await POST(
      postRequest({
        amount: 25000,
        goalId: '00000000-0000-4000-8000-000000000101',
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to add savings contribution' });
  });

  it('allocates a manual contribution from wallet balance', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            contribution_id: 'contrib-1',
            goal_current_amount: '45000',
            goal_status: 'active',
            success: true,
            wallet_balance: '155000',
            wallet_transaction_id: 'wallet-txn-1',
          },
        ],
        error: null,
      }),
    };

    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: mockSupabase,
    });

    const response = await POST(
      postRequest({
        amount: 25000,
        goalId: '00000000-0000-4000-8000-000000000101',
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'allocate_customer_savings_contribution',
      expect.objectContaining({
        p_amount: 25000,
        p_customer_id: 'customer-1',
        p_goal_id: '00000000-0000-4000-8000-000000000101',
        p_merchant_id: 'merchant-1',
      })
    );
    expect(body).toEqual({
      contributionId: 'contrib-1',
      goalCurrentAmount: 45000,
      goalStatus: 'active',
      success: true,
      walletBalance: 155000,
      walletTransactionId: 'wallet-txn-1',
    });
  });

  it('returns 500 when the allocation response has non-finite numeric fields', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            contribution_id: 'contrib-1',
            goal_current_amount: 'not-a-number',
            goal_status: 'active',
            success: true,
            wallet_balance: '155000',
            wallet_transaction_id: 'wallet-txn-1',
          },
        ],
        error: null,
      }),
    };

    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: mockSupabase,
    });

    const response = await POST(
      postRequest({
        amount: 25000,
        goalId: '00000000-0000-4000-8000-000000000101',
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to add savings contribution',
    });
  });

  it('maps insufficient wallet balance to 409 conflict', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message: 'insufficient_wallet_balance',
        },
      }),
    };

    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: mockSupabase,
    });

    const response = await POST(
      postRequest({
        amount: 25000,
        goalId: '00000000-0000-4000-8000-000000000101',
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('insufficient_wallet_balance');
  });
});
