import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  loadOrderItemImageMap: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(),
  generateOrderConfirmationText: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: vi.fn(),
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeLikePattern: (value: string) => value,
  sanitizeSearchQuery: (value: string) => value,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mocks.from })),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('./order-item-images', () => ({
  loadOrderItemImageMap: mocks.loadOrderItemImageMap,
}));

const { getOrderStats, getOrders } = await import('./actions');

const MERCHANT_ID = 'merchant-456';
const NON_JUMIA_ORDERS_FILTER =
  'external_source.is.null,external_source.neq.jumia';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

interface MockSupabaseQuery extends Promise<QueryResult> {
  select: ReturnType<
    typeof vi.fn<(_columns?: string, _options?: unknown) => MockSupabaseQuery>
  >;
  eq: ReturnType<
    typeof vi.fn<(_column: string, _value: unknown) => MockSupabaseQuery>
  >;
  or: ReturnType<typeof vi.fn<(_filter: string) => MockSupabaseQuery>>;
  order: ReturnType<
    typeof vi.fn<(_column: string, _options?: unknown) => MockSupabaseQuery>
  >;
}

function createQuery(result: QueryResult): MockSupabaseQuery {
  let query: MockSupabaseQuery;
  query = Object.assign(Promise.resolve(result), {
    select: vi.fn((_columns?: string, _options?: unknown) => query),
    eq: vi.fn((_column: string, _value: unknown) => query),
    or: vi.fn((_filter: string) => query),
    order: vi.fn((_column: string, _options?: unknown) => query),
  });
  return query;
}

describe('Jumia dashboard order data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps canonical Jumia rows out of the list and includes legacy Jumia rows for All filters', async () => {
    const ordersQuery = createQuery({
      data: [
        {
          id: 'order-1',
          order_number: '#ORD-001',
          customer_name: 'ada lovelace',
          total: '10000',
          shipping_status: 'pending',
          payment_status: 'paid',
          payment_method: 'card',
          created_at: '2026-04-25T08:00:00.000Z',
          source: 'online_store',
          order_items: [],
        },
      ],
      error: null,
    });
    const jumiaQuery = createQuery({
      data: [
        {
          jumia_order_id: 'jumia-order-1',
          jumia_order_number: 'JUMIA-001',
          customer_name: 'Jumia Customer',
          total_amount: '25000',
          status: 'delivered',
          created_at_jumia: '2026-04-25T09:00:00.000Z',
          items: [],
        },
      ],
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') return ordersQuery;
      if (table === 'jumia_orders') return jumiaQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const orders = await getOrders(MERCHANT_ID, {
      paymentStatus: 'All',
      shippingStatus: 'All',
    });

    expect(ordersQuery.or).toHaveBeenCalledWith(NON_JUMIA_ORDERS_FILTER);
    expect(mocks.from).toHaveBeenCalledWith('jumia_orders');
    expect(orders.map((order) => order.orderNumber)).toEqual([
      'JUMIA-001',
      '#ORD-001',
    ]);
  });

  it('throws a generic dashboard error when canonical order loading fails', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return createQuery({
          data: null,
          error: { message: 'orders failed' },
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(getOrders(MERCHANT_ID)).rejects.toThrow(
      'Failed to fetch dashboard orders'
    );
  });

  it('returns an empty order list when both sources are empty', async () => {
    const ordersQuery = createQuery({ data: [], error: null });
    const jumiaQuery = createQuery({ data: [], error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') return ordersQuery;
      if (table === 'jumia_orders') return jumiaQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(getOrders(MERCHANT_ID)).resolves.toEqual([]);
  });

  it('counts canonical Jumia orders in dashboard stats', async () => {
    const statsQueries = [
      createQuery({ count: 3, error: null }),
      createQuery({ count: 2, error: null }),
      createQuery({ count: 1, error: null }),
      createQuery({ count: 1, error: null }),
    ];
    const queryQueue = [...statsQueries];
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'orders') {
        throw new Error(`Unexpected table: ${table}`);
      }
      const query = queryQueue.shift();
      if (!query) {
        throw new Error('Unexpected extra orders query');
      }
      return query;
    });

    const stats = await getOrderStats(MERCHANT_ID);

    expect(stats).toEqual({
      totalOrders: 3,
      completedOrders: 2,
      unpaidOrders: 1,
      urgentOrders: 1,
    });
    const orCalls = statsQueries.flatMap((query) =>
      query.or.mock.calls.map(([filter]) => filter)
    );
    expect(orCalls).not.toContain(NON_JUMIA_ORDERS_FILTER);
    expect(orCalls).toContain(
      'payment_status.eq.unpaid,shipping_status.eq.pending'
    );
  });

  it('returns zeroed dashboard stats when any count query fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const statsQueries = [
      createQuery({ count: null, error: { message: 'stats failed' } }),
      createQuery({ count: 2, error: null }),
      createQuery({ count: 1, error: null }),
      createQuery({ count: 1, error: null }),
    ];
    const queryQueue = [...statsQueries];
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'orders') {
        throw new Error(`Unexpected table: ${table}`);
      }
      const query = queryQueue.shift();
      if (!query) {
        throw new Error('Unexpected extra orders query');
      }
      return query;
    });

    await expect(getOrderStats(MERCHANT_ID)).resolves.toEqual({
      totalOrders: 0,
      completedOrders: 0,
      unpaidOrders: 0,
      urgentOrders: 0,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Error fetching order stats counts:',
      { message: 'stats failed' }
    );
  });
});
