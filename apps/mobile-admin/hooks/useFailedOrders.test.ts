import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type QueryResult = {
    data: Array<{
      created_at: string;
      customer_email: string;
      customer_id: string | null;
      customer_name: string;
      customer_phone: string;
      id: string;
      order_number: string;
      payment_method: string;
      payment_status: string;
      total: number;
      transactions: Array<{
        gateway: string;
        gateway_response: Record<string, unknown> | null;
        status: string;
      }>;
    }>;
    error: { message: string } | null;
  };

  const calls: Array<{ args: unknown[]; method: string }> = [];
  let result: QueryResult = {
    data: [
      {
        created_at: '2026-06-02T01:00:00.000Z',
        customer_email: 'ada@example.com',
        customer_id: null,
        customer_name: 'Ada Buyer',
        customer_phone: '+2348012345678',
        id: 'order-1',
        order_number: 'ORD-001',
        payment_method: 'paystack',
        payment_status: 'unpaid',
        total: 15000,
        transactions: [],
      },
    ],
    error: null,
  };

  function makeChain() {
    const chain: Record<string, unknown> = {};
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };

    for (const method of ['select', 'eq', 'or', 'order']) {
      chain[method] = passthrough(method);
    }

    // biome-ignore lint/suspicious/noThenProperty: mocks the thenable Supabase query builder chain
    chain.then = (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve);

    return chain;
  }

  return {
    calls,
    from: vi.fn(() => makeChain()),
    reset: () => {
      calls.length = 0;
      result = {
        data: [
          {
            created_at: '2026-06-02T01:00:00.000Z',
            customer_email: 'ada@example.com',
            customer_id: null,
            customer_name: 'Ada Buyer',
            customer_phone: '+2348012345678',
            id: 'order-1',
            order_number: 'ORD-001',
            payment_method: 'paystack',
            payment_status: 'unpaid',
            total: 15000,
            transactions: [],
          },
        ],
        error: null,
      };
    },
    setResult: (nextResult: QueryResult) => {
      result = nextResult;
    },
  };
});

const queryMock = vi.hoisted(() => ({
  useQuery: vi.fn((config) => config),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: queryMock.useQuery,
}));

import { ONLINE_CHECKOUT_PAYMENT_METHODS } from './orders/order-list-visibility';
import { useFailedOrders } from './useFailedOrders';

function getSelectArg(): string {
  const selectCall = supabaseMock.calls.find(
    (call) => call.method === 'select'
  );
  return String(selectCall?.args[0] ?? '');
}

describe('useFailedOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T02:00:00.000Z'));
    supabaseMock.reset();
  });

  it('routes stale unpaid online checkout initiations into customer follow-up', async () => {
    const query = useFailedOrders() as unknown as {
      queryFn: () => Promise<Array<{ payment_status: string }>>;
    };

    const result = await query.queryFn();

    expect(supabaseMock.calls).toEqual(
      expect.arrayContaining([
        {
          method: 'or',
          args: [
            `payment_status.in.(bnpl_pending,failed,expired),and(payment_status.eq.pending,created_at.lt.2026-06-02T01:30:00.000Z,payment_method.in.${ONLINE_CHECKOUT_PAYMENT_METHODS}),and(payment_status.eq.unpaid,created_at.lt.2026-06-02T01:30:00.000Z,payment_method.in.${ONLINE_CHECKOUT_PAYMENT_METHODS})`,
          ],
        },
      ])
    );
    expect(result).toEqual([
      expect.objectContaining({
        attempt_count: 1,
        customer_email: 'ada@example.com',
        payment_status: 'unpaid',
      }),
    ]);
  });

  describe('bugfix: ambiguous orders->transactions embed emptied the Follow Up tab', () => {
    it('names the order_id foreign key so PostgREST cannot reject the embed as ambiguous', async () => {
      // Arrange: orders <-> transactions is joined by two FKs since
      // 20260723000005_orders_paid_transaction_marker.sql added
      // orders.paid_transaction_id. A bare `transactions (...)` embed makes
      // PostgREST fail the whole request with PGRST201.
      const query = useFailedOrders() as unknown as {
        queryFn: () => Promise<unknown>;
      };

      // Act
      await query.queryFn();

      // Assert
      const select = getSelectArg();
      expect(select).toContain('transactions!transactions_order_id_fkey');
      expect(select).not.toMatch(/(^|[^!\w])transactions\s*\(/);
    });

    it('keeps reading the embedded rows off the unhinted `transactions` key', async () => {
      // Arrange: PostgREST returns the relation name, not the FK hint, as the
      // response key — so the row shape must stay `transactions`.
      supabaseMock.setResult({
        data: [
          {
            created_at: '2026-06-02T01:00:00.000Z',
            customer_email: 'ada@example.com',
            customer_id: null,
            customer_name: 'Ada Buyer',
            customer_phone: '+2348012345678',
            id: 'order-1',
            order_number: 'ORD-001',
            payment_method: 'credit_direct',
            payment_status: 'bnpl_pending',
            total: 15000,
            transactions: [
              {
                gateway: 'credit_direct',
                gateway_response: { message: 'Declined by issuer' },
                status: 'failed',
              },
            ],
          },
        ],
        error: null,
      });
      const query = useFailedOrders() as unknown as {
        queryFn: () => Promise<
          Array<{ gateway?: string; gateway_response?: unknown }>
        >;
      };

      // Act
      const result = await query.queryFn();

      // Assert
      expect(result[0]).toEqual(
        expect.objectContaining({
          gateway: 'credit_direct',
          gateway_response: { message: 'Declined by issuer' },
        })
      );
    });
  });

  it('propagates Supabase errors from the follow-up query', async () => {
    supabaseMock.setResult({
      data: [],
      error: { message: 'supabase failure' },
    });
    const query = useFailedOrders() as unknown as {
      queryFn: () => Promise<unknown>;
    };

    await expect(query.queryFn()).rejects.toEqual({
      message: 'supabase failure',
    });
    expect(supabaseMock.calls).toEqual(
      expect.arrayContaining([
        {
          method: 'eq',
          args: ['merchant_id', 'merchant-1'],
        },
      ])
    );
  });
});
