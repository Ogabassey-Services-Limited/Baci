import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/wallet/transactions/route';
import type { UserAccess } from '@/lib/api-auth';
import type { MerchantContext as ResolvedMerchantContext } from '@/lib/get-merchant-for-api-request';

const {
  cookies,
  createClient,
  hasPermission,
  getMerchantForApiRequest,
  toUserAccess,
  userAccess,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  hasPermission: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  userAccess: {
    merchantId: 'merchant-1',
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: { full_access: { all: true } },
  } satisfies UserAccess,
  toUserAccess: vi.fn(() => ({
    merchantId: 'merchant-1',
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: { full_access: { all: true } },
  })),
}));

vi.mock('next/headers', () => ({
  cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient,
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest,
  toUserAccess,
}));

interface TransactionRow {
  id: string;
  type: string;
  amount: number | string;
  balance_after: number | string;
  status: string;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  transfer_reference: string | null;
  transfer_status: string | null;
  created_at: string;
}

interface QueryResult {
  data: TransactionRow[] | null;
  error: { message: string } | null;
  count: number | null;
}

let authUser: { id: string } | null;
let merchantContext: ResolvedMerchantContext | null;
let queryResult: QueryResult;
let eqCalls: [string, unknown][];
let rangeCalls: [number, number][];

function createWalletTransactionsQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      return Promise.resolve(queryResult);
    }),
  };

  return builder;
}

function createMockSupabase() {
  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: authUser },
          error: authUser ? null : { message: 'Unauthorized' },
        })
      ),
    },
    from: vi.fn((table: string) => {
      if (table !== 'wallet_transactions') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return createWalletTransactionsQueryBuilder();
    }),
  };
}

function makeRequest(query = '') {
  const suffix = query ? `?${query}` : '';
  return new Request(
    `http://localhost/api/wallet/transactions${suffix}`
  ) as unknown as NextRequest;
}

describe('GET /api/wallet/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: 'user-1' };
    merchantContext = {
      merchantId: 'merchant-1',
      merchantSlug: 'merchant-1',
      businessName: 'Merchant 1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { full_access: { all: true } },
      },
    };
    queryResult = {
      data: [
        {
          id: 'tx-1',
          type: 'debit',
          amount: '1250',
          balance_after: '8750',
          status: 'completed',
          description: 'Wallet withdrawal',
          source_type: 'withdrawal',
          source_id: 'withdrawal-1',
          transfer_reference: 'transfer-1',
          transfer_status: 'success',
          created_at: '2026-03-14T00:00:00.000Z',
        },
      ],
      error: null,
      count: 25,
    };
    eqCalls = [];
    rangeCalls = [];

    cookies.mockResolvedValue({
      get: vi.fn(),
      getAll: vi.fn(() => []),
    });
    createClient.mockReturnValue(createMockSupabase());
    getMerchantForApiRequest.mockResolvedValue(merchantContext);
    hasPermission.mockReturnValue(true);
  });

  it('returns 401 when the user is not authenticated', async () => {
    authUser = null;
    createClient.mockReturnValue(createMockSupabase());

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 400 when query params are invalid', async () => {
    const response = await GET(makeRequest('page=0&type=refund'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/>=1|greater than or equal to 1/);
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 404 when the merchant context is missing', async () => {
    merchantContext = null;
    getMerchantForApiRequest.mockResolvedValue(null);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
  });

  it('returns 403 when the user lacks permission to view analytics', async () => {
    hasPermission.mockReturnValue(false);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(toUserAccess).toHaveBeenCalledWith(merchantContext);
    expect(hasPermission).toHaveBeenCalledWith(userAccess, 'analytics', 'view');
    expect(response.status).toBe(403);
    expect(json.error).toBe('Forbidden');
  });

  it('returns 500 when the wallet transaction query fails', async () => {
    queryResult = {
      data: null,
      error: { message: 'db failure' },
      count: null,
    };

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to get transactions');
  });

  it('returns paginated transactions and applies the requested type filter', async () => {
    const response = await GET(makeRequest('page=2&limit=10&type=debit'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(eqCalls).toEqual([
      ['merchant_id', 'merchant-1'],
      ['type', 'debit'],
    ]);
    expect(rangeCalls).toEqual([[10, 19]]);
    expect(json).toEqual({
      transactions: [
        {
          id: 'tx-1',
          type: 'debit',
          amount: 1250,
          balanceAfter: 8750,
          status: 'completed',
          description: 'Wallet withdrawal',
          sourceType: 'withdrawal',
          sourceId: 'withdrawal-1',
          transferReference: 'transfer-1',
          transferStatus: 'success',
          createdAt: '2026-03-14T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });
});
