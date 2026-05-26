import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockResolveCustomerSavingsContext = vi.fn();
const mockGetCustomerSavingsFeatureSettings = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
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

import { GET } from './route';

function getRequest() {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/savings/goals?merchantSlug=ogabassey'
  );
}

describe('/api/storefront/customer/savings/goals GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { email: 'jane@example.com', id: 'user-1' },
    });
    mockGetCustomerSavingsFeatureSettings.mockResolvedValue({
      autoDebitEnabled: true,
      paystackEnabled: true,
      savingsEnabled: true,
    });
  });

  it('returns 401 before savings context resolution when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
    });

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns formatted goals and summary', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    break_fee_percent: '5',
                    cancelled_at: null,
                    completed_at: null,
                    contribution_amount: '20000',
                    contribution_frequency: 'daily',
                    created_at: '2026-05-21T10:00:00.000Z',
                    current_amount: '150000',
                    future_debits_cancelled_at: null,
                    id: 'goal-1',
                    initial_contribution_amount: '20000',
                    maturity_date: '2026-06-30',
                    metadata: {},
                    preferred_debit_time: '06:20:00',
                    product_id: '00000000-0000-4000-8000-000000000101',
                    product_snapshot: { name: 'iPhone 13 Pro Max' },
                    saved_payment_method_id: null,
                    source_mode: 'manual',
                    spent_at: null,
                    start_date: '2026-05-21',
                    status: 'active',
                    target_amount: '800000',
                    title: 'iPhone 13 savings',
                    updated_at: '2026-05-21T10:05:00.000Z',
                    variant_id: null,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      })),
    };

    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: mockSupabase,
    });

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toEqual({
      activeGoalCount: 1,
      savingsBalance: 150000,
    });
    expect(body.goals[0]).toMatchObject({
      contributionAmount: 20000,
      currentAmount: 150000,
      id: 'goal-1',
      productId: '00000000-0000-4000-8000-000000000101',
      title: 'iPhone 13 savings',
    });
  });
});
