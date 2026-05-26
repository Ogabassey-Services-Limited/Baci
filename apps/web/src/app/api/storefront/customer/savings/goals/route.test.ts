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
  getSavingsIdentifierParams: (searchParams: URLSearchParams) => ({
    merchantId: searchParams.get('merchantId') ?? undefined,
    merchantSlug: searchParams.get('merchantSlug') ?? undefined,
  }),
  resolveCustomerSavingsContext: (...args: unknown[]) =>
    mockResolveCustomerSavingsContext(...args),
}));

import { POST } from './route';

function postRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/savings/goals',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function rawPostRequest(body: string) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/savings/goals',
    {
      body,
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

describe('/api/storefront/customer/savings/goals', () => {
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
  });

  it('returns 403 on POST when savings feature is disabled', async () => {
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
        contributionAmount: 20000,
        contributionFrequency: 'daily',
        maturityDate: '2026-06-30',
        merchantSlug: 'ogabassey',
        nonWithdrawableAccepted: true,
        productId: '00000000-0000-4000-8000-000000000101',
        sourceMode: 'manual',
        startDate: '2026-05-21',
        targetAmount: 800000,
        termsAccepted: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CUSTOMER_SAVINGS_DISABLED');
  });

  it('returns 400 for invalid POST goal input', async () => {
    const response = await POST(
      postRequest({
        contributionAmount: 0,
        merchantSlug: 'ogabassey',
        sourceMode: 'manual',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed POST JSON', async () => {
    const response = await POST(rawPostRequest('{'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'MALFORMED_JSON',
      error: 'Malformed JSON',
    });
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('creates a savings goal on POST', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            contribution_id: 'contrib-1',
            current_amount: '20000',
            goal_id: 'goal-1',
            goal_status: 'active',
            success: true,
            wallet_balance: '180000',
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
        contributionAmount: 20000,
        contributionFrequency: 'daily',
        initialContributionAmount: 20000,
        maturityDate: '2026-06-30',
        merchantSlug: 'ogabassey',
        nonWithdrawableAccepted: true,
        productId: '00000000-0000-4000-8000-000000000101',
        sourceMode: 'manual',
        startDate: '2026-05-21',
        targetAmount: 800000,
        termsAccepted: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_customer_savings_goal',
      expect.objectContaining({
        p_customer_id: 'customer-1',
        p_merchant_id: 'merchant-1',
      })
    );
    expect(body).toEqual({
      contributionId: 'contrib-1',
      currentAmount: 20000,
      goalId: 'goal-1',
      goalStatus: 'active',
      success: true,
      walletBalance: 180000,
    });
  });

  it('returns 500 when savings goal creation RPC fails unexpectedly', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'XX000',
          message: 'database unavailable',
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
        contributionAmount: 20000,
        contributionFrequency: 'daily',
        maturityDate: '2026-06-30',
        merchantSlug: 'ogabassey',
        nonWithdrawableAccepted: true,
        productId: '00000000-0000-4000-8000-000000000101',
        sourceMode: 'manual',
        startDate: '2026-05-21',
        targetAmount: 800000,
        termsAccepted: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'XX000',
      error: 'Failed to create savings goal',
    });
  });

  it('maps RPC conflicts to 409 when initial contribution exceeds wallet balance', async () => {
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
        contributionAmount: 20000,
        contributionFrequency: 'daily',
        initialContributionAmount: 20000,
        maturityDate: '2026-06-30',
        merchantSlug: 'ogabassey',
        nonWithdrawableAccepted: true,
        productId: '00000000-0000-4000-8000-000000000101',
        sourceMode: 'manual',
        startDate: '2026-05-21',
        targetAmount: 800000,
        termsAccepted: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('insufficient_wallet_balance');
  });
});
