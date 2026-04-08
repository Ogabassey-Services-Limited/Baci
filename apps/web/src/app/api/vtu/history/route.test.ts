import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

const mockAuthenticateApiRequest = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

let merchantData: { id: string } | null = null;
let merchantError: unknown = null;
let customerByUserIdData: { id: string; user_id: string | null } | null = null;
let customerByEmailData: { id: string; user_id: string | null } | null = null;
let transactionsData: Record<string, unknown>[] | null = null;
let transactionsError: unknown = null;
let transactionEqCalls: [string, unknown][] = [];
const mockCustomerUpdateEq = vi.fn();

function createMockSupabase() {
  const customerSelect = vi.fn(() => {
    const filters = new Map<string, unknown>();
    const builder = {
      eq: vi.fn((field: string, value: unknown) => {
        filters.set(field, value);
        return builder;
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        if (filters.has('user_id')) {
          return { data: customerByUserIdData, error: null };
        }

        if (filters.has('email')) {
          return { data: customerByEmailData, error: null };
        }

        return { data: null, error: null };
      }),
    };
    return builder;
  });

  const transactionQuery = {
    eq: vi.fn((field: string, value: unknown) => {
      transactionEqCalls.push([field, value]);
      return transactionQuery;
    }),
    order: vi.fn(() => transactionQuery),
    limit: vi.fn().mockResolvedValue({
      data: transactionsData,
      error: transactionsError,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: merchantData,
                error: merchantError,
              }),
            })),
          })),
        };
      }

      if (table === 'customers') {
        return {
          select: customerSelect,
          update: vi.fn(() => ({
            eq: mockCustomerUpdateEq,
          })),
        };
      }

      if (table === 'vtu_transactions') {
        return {
          select: vi.fn(() => transactionQuery),
        };
      }

      return {
        select: vi.fn(),
      };
    }),
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => createMockSupabase()),
}));

function makeRequest(search = '') {
  return new Request(`http://localhost:3000/api/vtu/history${search}`);
}

describe('GET /api/vtu/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    merchantData = { id: 'merchant-1' };
    merchantError = null;
    customerByUserIdData = { id: 'customer-1', user_id: 'user-1' };
    customerByEmailData = null;
    transactionsData = [
      {
        id: 'tx-1',
        created_at: '2026-04-08T12:00:00.000Z',
        type: 'electricity',
        status: 'successful',
        amount: '2500',
        biller_name: 'EKEDC NG',
        request_reference: 'VTU-123',
        customer_cashback: '0',
      },
    ];
    transactionsError = null;
    transactionEqCalls = [];
    mockCustomerUpdateEq.mockResolvedValue({ data: null, error: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
  });

  it('returns 401 when the request is not authenticated', async () => {
    const { GET } = await import('./route');
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Unauthorized',
      supabase: null,
    });

    const response = await GET(makeRequest('?merchantSlug=ogabassey') as never);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns transactions for the resolved customer and applies the type filter', async () => {
    const { GET } = await import('./route');
    customerByUserIdData = null;
    customerByEmailData = { id: 'customer-1', user_id: null };

    const response = await GET(
      makeRequest('?merchantSlug=ogabassey&type=electricity&limit=5') as never
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([
      expect.objectContaining({
        id: 'tx-1',
        amount: 2500,
        customer_cashback: 0,
      }),
    ]);
    expect(transactionEqCalls).toContainEqual(['merchant_id', 'merchant-1']);
    expect(transactionEqCalls).toContainEqual(['customer_id', 'customer-1']);
    expect(transactionEqCalls).toContainEqual(['type', 'electricity']);
    expect(mockCustomerUpdateEq).toHaveBeenCalledWith('id', 'customer-1');
  });

  it('returns an empty list when no customer exists for the authenticated user', async () => {
    const { GET } = await import('./route');
    customerByUserIdData = null;
    customerByEmailData = null;

    const response = await GET(makeRequest('?merchantSlug=ogabassey') as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([]);
  });
});
