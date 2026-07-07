import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { GET } from './route';

function request(path = '?merchant=ogabassey') {
  return new Request(
    `http://localhost:3000/api/storefront/customer/wallet${path}`
  );
}

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  const eq = vi.fn(() => query);
  const select = vi.fn(() => query);
  const single = vi.fn().mockResolvedValue({ data, error });
  Object.assign(query, { eq, select, single });
  return query;
}

function maybeSingleQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

function savingsQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

describe('GET /api/storefront/customer/wallet email fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue(new Map());
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'jane@example.com', id: 'user-1' } },
      error: null,
    });
  });

  it('returns loyalty points for an email fallback customer without mutating on GET', async () => {
    let customerLookupCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return singleQuery({ id: 'merchant-1' });
      if (table === 'merchant_feature_settings') {
        return maybeSingleQuery({ wallet_paystack_dva_enabled: true });
      }
      if (table === 'customers') {
        customerLookupCount += 1;
        if (customerLookupCount === 1) {
          return singleQuery(null);
        }
        if (customerLookupCount === 2) {
          return singleQuery({
            id: 'customer-1',
            loyalty_points: 500,
          });
        }
        throw new Error('GET must not write customer links');
      }
      if (table === 'customer_savings_goals') {
        return savingsQuery([]);
      }
      if (table === 'customer_wallet_payment_accounts') {
        return maybeSingleQuery(null);
      }
      if (table === 'customer_wallets') {
        return singleQuery(null);
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      hasWallet: false,
      loyaltyPoints: 500,
      requiresFundingAccountConsent: true,
    });
  });
});
