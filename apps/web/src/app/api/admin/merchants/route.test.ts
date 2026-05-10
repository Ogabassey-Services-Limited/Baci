import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantForApiRequest = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

let authUser: { id: string } | null = { id: 'user-1' };
let merchantContext: {
  merchantId: string;
  staffAccess: {
    isStaff: boolean;
  };
} | null = {
  merchantId: 'merchant-1',
  staffAccess: {
    isStaff: false,
  },
};
let merchantAdminResult: QueryResult<{ is_platform_admin: boolean }> = {
  data: { is_platform_admin: true },
  error: null,
};
let rpcResult: QueryResult<
  Array<{
    merchant_id: string;
    business_name: string | null;
    email: string | null;
    joined_at: string;
    total_gmv: number;
    total_orders: number;
    last_order_date: string | null;
    active_days: number;
    health_status: 'healthy' | 'at_risk' | 'churned' | 'new';
  }>
> = {
  data: [
    {
      merchant_id: 'merchant-1',
      business_name: 'Baci Store',
      email: 'owner@example.com',
      joined_at: '2026-03-20T10:00:00.000Z',
      total_gmv: 400,
      total_orders: 2,
      last_order_date: '2026-03-19',
      active_days: 2,
      health_status: 'healthy',
    },
    {
      merchant_id: 'merchant-2',
      business_name: 'Another Store',
      email: 'another@example.com',
      joined_at: '2026-03-21T10:00:00.000Z',
      total_gmv: 100,
      total_orders: 5,
      last_order_date: '2026-03-18',
      active_days: 1,
      health_status: 'at_risk',
    },
  ],
  error: null,
};

function createMockSupabase() {
  const merchantsQuery = {
    eq: vi.fn(() => merchantsQuery),
    maybeSingle: vi.fn(async () => merchantAdminResult),
    select: vi.fn(() => merchantsQuery),
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUser },
        error: authUser ? null : { message: 'Not authenticated' },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantsQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string) => {
      if (name !== 'get_admin_merchant_health') {
        throw new Error(`Unexpected RPC: ${name}`);
      }

      return rpcResult;
    }),
  };
}

function createRequest(url: string): NextRequest {
  return new Request(url) as NextRequest;
}

import { GET } from './route';

describe('/api/admin/merchants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: 'user-1' };
    merchantContext = {
      merchantId: 'merchant-1',
      staffAccess: {
        isStaff: false,
      },
    };
    merchantAdminResult = {
      data: { is_platform_admin: true },
      error: null,
    };
    rpcResult = {
      data: [
        {
          merchant_id: 'merchant-1',
          business_name: 'Baci Store',
          email: 'owner@example.com',
          joined_at: '2026-03-20T10:00:00.000Z',
          total_gmv: 400,
          total_orders: 2,
          last_order_date: '2026-03-19',
          active_days: 2,
          health_status: 'healthy',
        },
        {
          merchant_id: 'merchant-2',
          business_name: 'Another Store',
          email: 'another@example.com',
          joined_at: '2026-03-21T10:00:00.000Z',
          total_gmv: 100,
          total_orders: 5,
          last_order_date: '2026-03-18',
          active_days: 1,
          health_status: 'at_risk',
        },
      ],
      error: null,
    };
    mockGetMerchantForApiRequest.mockResolvedValue(merchantContext);
    mockCreateClient.mockResolvedValue(createMockSupabase());
  });

  it('returns 401 when the user is not authenticated', async () => {
    authUser = null;
    mockCreateClient.mockResolvedValue(createMockSupabase());

    const response = await GET(
      createRequest('http://localhost/api/admin/merchants')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for an invalid sort parameter', async () => {
    const response = await GET(
      createRequest('http://localhost/api/admin/merchants?sortBy=health')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_SORT');
  });

  it('returns 403 when the user is not a platform admin', async () => {
    merchantAdminResult = {
      data: { is_platform_admin: false },
      error: null,
    };
    mockCreateClient.mockResolvedValue(createMockSupabase());

    const response = await GET(
      createRequest('http://localhost/api/admin/merchants')
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden - Admin access required');
  });

  it('returns 500 when the admin merchant health RPC fails', async () => {
    rpcResult = {
      data: null,
      error: { message: 'rpc failed' },
    };
    mockCreateClient.mockResolvedValue(createMockSupabase());

    const response = await GET(
      createRequest('http://localhost/api/admin/merchants')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch merchant data');
  });

  it('returns sorted merchant rows from the admin-only RPC', async () => {
    const response = await GET(
      createRequest('http://localhost/api/admin/merchants?sortBy=orders')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      merchant_id: 'merchant-2',
      total_orders: 5,
    });
    expect(body.data[1]).toMatchObject({
      merchant_id: 'merchant-1',
      total_orders: 2,
    });
    expect(body.generatedAt).toBeTypeOf('string');
  });
});
