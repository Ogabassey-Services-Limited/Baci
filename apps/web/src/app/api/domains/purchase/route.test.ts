import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

type MutationRecord = {
  filters: [string, unknown][];
  payload: Record<string, unknown>;
};

type TransactionRecord = {
  amount: number;
  gateway: string;
  id: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
  status: string;
};

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  revalidateMerchantFeed: vi.fn(),
  transactionMutations: [] as MutationRecord[],
  verifyPaystackPayment: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mocks.after };
});

vi.mock('@/config/domain-pricing', () => ({
  calculateDomainPrice: vi.fn(() => ({ sellPrice: 100 })),
  getDomainPricing: vi.fn(() => ({ registration: 100 })),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateMerchantFeed: (...args: unknown[]) =>
    mocks.revalidateMerchantFeed(...args),
}));

vi.mock('@/lib/edge-config-sync', () => ({
  triggerDomainEdgeConfigSync: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/lib/go54', () => ({
  registerDomain: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({
  verifyTransaction: (...args: unknown[]) =>
    mocks.verifyPaystackPayment(...args),
}));

function createMutationQuery(payload: Record<string, unknown>) {
  const mutation: MutationRecord = { filters: [], payload };
  mocks.transactionMutations.push(mutation);

  const query = {
    eq(column: string, value: unknown) {
      mutation.filters.push([column, value]);
      return mutation.filters.length === 2
        ? Promise.resolve({ error: null })
        : query;
    },
  };

  return query;
}

function createSupabase(transaction: TransactionRecord) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: 'merchant@example.com', id: 'user-1' } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'merchant-1' },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === 'transactions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: transaction,
                error: null,
              }),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) =>
            createMutationQuery(payload)
          ),
        };
      }

      if (table === 'domains') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'domain-1', merchant_id: 'merchant-1' },
                error: null,
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

let supabase: ReturnType<typeof createSupabase>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => supabase),
}));

function createRequest() {
  return new NextRequest('http://localhost/api/domains/purchase', {
    method: 'POST',
    body: JSON.stringify({
      domain: 'shop.com',
      paymentReference: 'payment-ref',
    }),
  });
}

describe('POST /api/domains/purchase transaction scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMutations.length = 0;
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { status: 'success' },
      success: true,
    });
  });

  it('does not update a pending transaction for another merchant without an owner filter', async () => {
    supabase = createSupabase({
      amount: 100,
      gateway: 'paystack',
      id: 'transaction-foreign',
      merchant_id: 'merchant-2',
      metadata: null,
      status: 'pending',
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(403);
    expect(mocks.transactionMutations).toHaveLength(1);
    expect(mocks.transactionMutations[0].payload).toMatchObject({
      status: 'completed',
    });
    expect(mocks.transactionMutations[0].filters).toEqual([
      ['id', 'transaction-foreign'],
      ['merchant_id', 'merchant-1'],
    ]);
  });

  it('scopes the payment-used metadata update to the authenticated merchant', async () => {
    supabase = createSupabase({
      amount: 100,
      gateway: 'paystack',
      id: 'transaction-owned',
      merchant_id: 'merchant-1',
      metadata: null,
      status: 'completed',
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mocks.transactionMutations).toHaveLength(1);
    expect(mocks.transactionMutations[0].payload).toMatchObject({
      metadata: expect.objectContaining({ domain_purchased: 'shop.com' }),
    });
    expect(mocks.transactionMutations[0].filters).toEqual([
      ['id', 'transaction-owned'],
      ['merchant_id', 'merchant-1'],
    ]);
    expect(mocks.revalidateMerchantFeed).toHaveBeenCalledWith('merchant-1');
  });
});
