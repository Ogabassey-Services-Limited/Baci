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

    for (const method of ['select', 'eq', 'gte', 'or', 'order', 'limit']) {
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
import {
  FOLLOW_UP_QUERY_LIMIT,
  FOLLOW_UP_WINDOW_DAYS,
  useFailedOrders,
} from './useFailedOrders';

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

  describe('bugfix: the follow-up queue was unbounded and grew forever', () => {
    it('bounds the query to the follow-up window', async () => {
      // Arrange: the queue had a minimum age (30min) but no maximum, so
      // months-old abandoned checkouts were fetched on every open.
      const query = useFailedOrders() as unknown as {
        queryFn: () => Promise<unknown>;
      };

      // Act
      await query.queryFn();

      // Assert: 90 days before the frozen clock of 2026-06-02T02:00:00Z
      expect(supabaseMock.calls).toEqual(
        expect.arrayContaining([
          { method: 'gte', args: ['created_at', '2026-03-04T02:00:00.000Z'] },
        ])
      );
    });

    it('caps the number of rows fetched', async () => {
      const query = useFailedOrders() as unknown as {
        queryFn: () => Promise<unknown>;
      };

      await query.queryFn();

      expect(supabaseMock.calls).toEqual(
        expect.arrayContaining([
          { method: 'limit', args: [FOLLOW_UP_QUERY_LIMIT] },
        ])
      );
    });

    it('derives the window bound from FOLLOW_UP_WINDOW_DAYS', async () => {
      // Arrange: guards the constant against being edited without the query
      // following it.
      const query = useFailedOrders() as unknown as {
        queryFn: () => Promise<unknown>;
      };
      await query.queryFn();

      // Act
      const gte = supabaseMock.calls.find((call) => call.method === 'gte');
      const bound = new Date(String(gte?.args[1])).getTime();

      // Assert
      const expected =
        new Date('2026-06-02T02:00:00.000Z').getTime() -
        FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      expect(bound).toBe(expected);
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
