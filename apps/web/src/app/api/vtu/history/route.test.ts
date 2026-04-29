import { NextRequest } from 'next/server';
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

const mockAfter = vi.fn();
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (callback: () => unknown) => mockAfter(callback),
  };
});

const mockBackfillVtuVoucherPin = vi.fn();
vi.mock('@/lib/vtu-fulfillment', () => ({
  backfillVtuVoucherPin: (...args: unknown[]) =>
    mockBackfillVtuVoucherPin(...args),
}));

let merchantData: { id: string } | null = null;
let merchantError: unknown = null;
let customerByUserIdData: { id: string; user_id: string | null } | null = null;
let customerByEmailData: { id: string; user_id: string | null } | null = null;
let transactionsData: Record<string, unknown>[] | null = null;
let transactionsError: unknown = null;
let paymentRowsData: Record<string, unknown>[] | null = null;
let paymentRowsError: unknown = null;
let transactionEqCalls: [string, unknown][] = [];
let vtuTransactionUpdateEqCalls: [string, unknown][] = [];
let vtuTransactionUpdateFilters: [string, string, unknown][] = [];
let vtuTransactionUpdateIsCalls: [string, unknown][] = [];
let vtuTransactionUpdatePayloads: Record<string, unknown>[] = [];
let vtuTransactionUpdateRows: Record<string, unknown>[] | null = null;
let vtuTransactionUpdateError: unknown = null;
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

  const createVtuTransactionUpdateQuery = () => {
    const builder = {
      eq: vi.fn((field: string, value: unknown) => {
        vtuTransactionUpdateEqCalls.push([field, value]);
        return builder;
      }),
      filter: vi.fn((field: string, operator: string, value: unknown) => {
        vtuTransactionUpdateFilters.push([field, operator, value]);
        return builder;
      }),
      is: vi.fn((field: string, value: unknown) => {
        vtuTransactionUpdateIsCalls.push([field, value]);
        return builder;
      }),
      select: vi.fn().mockResolvedValue({
        data: vtuTransactionUpdateRows,
        error: vtuTransactionUpdateError,
      }),
    };
    return builder;
  };

  const paymentStatusQuery = {
    eq: vi.fn(() => paymentStatusQuery),
    in: vi.fn().mockResolvedValue({
      data: paymentRowsData,
      error: paymentRowsError,
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
          update: vi.fn((payload: Record<string, unknown>) => {
            vtuTransactionUpdatePayloads.push(payload);
            return createVtuTransactionUpdateQuery();
          }),
        };
      }

      if (table === 'transactions') {
        return {
          select: vi.fn(() => paymentStatusQuery),
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

function makeRequest(search = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/vtu/history${search}`);
}

describe('GET /api/vtu/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfter.mockReset();
    mockBackfillVtuVoucherPin.mockReset();
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
        metadata: {
          dataPlanCode: 'KUD-DATA-001',
          gateway: 'paystack',
          paymentReference: 'VTU-PAYSTACK-123',
          voucherPin: '1234-5678',
        },
        request_reference: 'VTU-123',
        customer_cashback: '0',
      },
    ];
    transactionsError = null;
    paymentRowsData = [
      {
        gateway: 'paystack',
        gateway_reference: 'VTU-PAYSTACK-123',
        status: 'completed',
      },
    ];
    paymentRowsError = null;
    transactionEqCalls = [];
    vtuTransactionUpdateEqCalls = [];
    vtuTransactionUpdateFilters = [];
    vtuTransactionUpdateIsCalls = [];
    vtuTransactionUpdatePayloads = [];
    vtuTransactionUpdateRows = [{ id: 'tx-1' }];
    vtuTransactionUpdateError = null;
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

    const response = await GET(makeRequest('?merchantSlug=ogabassey'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when the query is invalid', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('?merchantSlug=ogabassey&type=invalid')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid query');
    expect(data.details.fieldErrors.type).toBeDefined();
  });

  it('returns transactions for the resolved customer and applies the type filter', async () => {
    const { GET } = await import('./route');
    customerByUserIdData = null;
    customerByEmailData = { id: 'customer-1', user_id: null };

    const response = await GET(
      makeRequest('?merchantSlug=ogabassey&type=electricity&limit=5')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([
      expect.objectContaining({
        id: 'tx-1',
        amount: 2500,
        customer_cashback: 0,
        payment_gateway: 'paystack',
        payment_reference: 'VTU-PAYSTACK-123',
        payment_status: 'completed',
        repeat_data_plan_code: 'KUD-DATA-001',
        voucher_pin: '1234-5678',
      }),
    ]);
    expect(transactionEqCalls).toContainEqual(['merchant_id', 'merchant-1']);
    expect(transactionEqCalls).toContainEqual(['customer_id', 'customer-1']);
    expect(transactionEqCalls).toContainEqual(['type', 'electricity']);
    expect(mockCustomerUpdateEq).toHaveBeenCalledWith('id', 'customer-1');
  });

  it('returns history immediately and schedules missing voucher-pin backfill after response', async () => {
    const { GET } = await import('./route');
    transactionsData = [
      {
        id: 'tx-1',
        created_at: '2026-04-08T12:00:00.000Z',
        type: 'electricity',
        status: 'successful',
        amount: '2500',
        biller_name: 'EKEDC NG',
        metadata: {
          alpha: 'first',
          zeta: 'last',
        },
        request_reference: 'VTU-123',
        transaction_id: 'kuda-bill-1',
        customer_cashback: '0',
      },
    ];
    paymentRowsData = [];
    mockBackfillVtuVoucherPin.mockResolvedValue('1234-5678');

    const response = await GET(
      makeRequest('?merchantSlug=ogabassey&type=electricity')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([
      expect.objectContaining({
        id: 'tx-1',
        voucher_pin: null,
      }),
    ]);
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(vtuTransactionUpdatePayloads).toEqual([
      {
        metadata: expect.objectContaining({
          voucherPinBackfillScheduledAt: expect.any(String),
        }),
      },
    ]);
    expect(vtuTransactionUpdateEqCalls).toContainEqual(['id', 'tx-1']);
    const metadataFilter = vtuTransactionUpdateFilters.find(
      ([field, operator]) => field === 'metadata' && operator === 'eq'
    );
    expect(metadataFilter).toBeDefined();
    expect(JSON.parse(String(metadataFilter?.[2]))).toEqual({
      alpha: 'first',
      zeta: 'last',
    });
    expect(mockBackfillVtuVoucherPin).not.toHaveBeenCalled();

    const scheduledBackfill = mockAfter.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(scheduledBackfill).toBeDefined();
    if (!scheduledBackfill) {
      throw new Error('Expected voucher-pin backfill to be scheduled');
    }
    await scheduledBackfill();

    expect(mockBackfillVtuVoucherPin).toHaveBeenCalledWith({
      billRequestRef: 'VTU-123',
      billResponseReference: 'kuda-bill-1',
      metadata: expect.objectContaining({
        voucherPinBackfillScheduledAt: expect.any(String),
      }),
      supabase: expect.any(Object),
      transactionId: 'tx-1',
    });
  });

  it('does not reschedule voucher-pin backfill when metadata already has a recent schedule marker', async () => {
    const { GET } = await import('./route');
    const dateNowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-04-29T12:00:01.000Z'));
    transactionsData = [
      {
        id: 'tx-1',
        created_at: '2026-04-08T12:00:00.000Z',
        type: 'electricity',
        status: 'successful',
        amount: '2500',
        biller_name: 'EKEDC NG',
        metadata: {
          voucherPinBackfillScheduledAt: '2026-04-29T12:00:00.000Z',
        },
        request_reference: 'VTU-123',
        transaction_id: 'kuda-bill-1',
        customer_cashback: '0',
      },
    ];
    paymentRowsData = [];

    try {
      const response = await GET(
        makeRequest('?merchantSlug=ogabassey&type=electricity')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transactions).toEqual([
        expect.objectContaining({
          id: 'tx-1',
          voucher_pin: null,
        }),
      ]);
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockBackfillVtuVoucherPin).not.toHaveBeenCalled();
      expect(vtuTransactionUpdatePayloads).toEqual([]);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('returns history when payment status lookup fails', async () => {
    const { GET } = await import('./route');
    transactionsData = [
      {
        id: 'tx-1',
        created_at: '2026-04-08T12:00:00.000Z',
        type: 'airtime',
        status: 'successful',
        amount: '2500',
        biller_name: 'EKEDC NG',
        metadata: {
          paymentReference: 'VTU-PAYSTACK-123',
        },
        request_reference: 'VTU-123',
        transaction_id: null,
        customer_cashback: '0',
      },
    ];
    paymentRowsError = { message: 'lookup failed' };

    const response = await GET(
      makeRequest('?merchantSlug=ogabassey&type=airtime')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([
      expect.objectContaining({
        id: 'tx-1',
        payment_status: null,
      }),
    ]);
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockBackfillVtuVoucherPin).not.toHaveBeenCalled();
    expect(vtuTransactionUpdatePayloads).toEqual([]);
  });

  it('matches payment statuses by gateway and reference', async () => {
    const { GET } = await import('./route');
    transactionsData = [
      {
        id: 'tx-paystack',
        created_at: '2026-04-08T12:00:00.000Z',
        type: 'airtime',
        status: 'successful',
        amount: '2500',
        biller_name: 'MTN',
        metadata: {
          gateway: 'paystack',
          paymentReference: 'SHARED-REF',
        },
        request_reference: 'VTU-PAYSTACK',
        transaction_id: null,
        customer_cashback: '0',
      },
      {
        id: 'tx-korapay',
        created_at: '2026-04-08T12:01:00.000Z',
        type: 'airtime',
        status: 'successful',
        amount: '2500',
        biller_name: 'MTN',
        metadata: {
          gateway: 'korapay',
          paymentReference: 'SHARED-REF',
        },
        request_reference: 'VTU-KORAPAY',
        transaction_id: null,
        customer_cashback: '0',
      },
    ];
    paymentRowsData = [
      {
        gateway: 'paystack',
        gateway_reference: 'SHARED-REF',
        status: 'completed',
      },
      {
        gateway: 'korapay',
        gateway_reference: 'SHARED-REF',
        status: 'failed',
      },
    ];

    const response = await GET(makeRequest('?merchantSlug=ogabassey'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([
      expect.objectContaining({
        id: 'tx-paystack',
        payment_gateway: 'paystack',
        payment_reference: 'SHARED-REF',
        payment_status: 'completed',
      }),
      expect.objectContaining({
        id: 'tx-korapay',
        payment_gateway: 'korapay',
        payment_reference: 'SHARED-REF',
        payment_status: 'failed',
      }),
    ]);
  });

  it('returns an empty list when no customer exists for the authenticated user', async () => {
    const { GET } = await import('./route');
    customerByUserIdData = null;
    customerByEmailData = null;

    const response = await GET(makeRequest('?merchantSlug=ogabassey'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([]);
  });
});
