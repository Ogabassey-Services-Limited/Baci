import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExistingJumiaOrder = {
  id: string;
  jumia_order_id: string;
  notification_sent: boolean | null;
};

type MutationRecord = {
  filters: [string, unknown][];
  payload: Record<string, unknown>;
  table: string;
  type: 'update';
};

type UpsertRecord = {
  options: Record<string, unknown> | undefined;
  payload: Record<string, unknown> | Record<string, unknown>[];
  table: string;
};

type JumiaOrderFixture = {
  createdAt: string;
  id: number | string;
  number: number | string;
  shippingAddress: { firstName?: string; lastName?: string; phone?: string };
  status: string;
  totalAmount: { currency: string; value: number };
};

const validIntegrationId = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  existingOrders: [] as ExistingJumiaOrder[],
  getAllOrders: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  getOrderItems: vi.fn(),
  hasPermission: vi.fn(),
  inQueries: [] as Array<{ column: string; values: string[] }>,
  loggerError: vi.fn(),
  prefetchError: null as { message: string } | null,
  mutations: [] as MutationRecord[],
  notifyJumiaOrder: vi.fn(),
  upsertError: null as { message: string } | null,
  upserts: [] as UpsertRecord[],
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyJumiaOrder: (...args: unknown[]) => mocks.notifyJumiaOrder(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/lib/jumia/client', () => {
  class MockJumiaApiError extends Error {}

  return {
    JumiaApiError: MockJumiaApiError,
    JumiaClient: {
      forIntegration: vi.fn().mockResolvedValue({ shopId: 'jumia-shop-1' }),
    },
    jumiaErrorResponse: vi.fn(),
  };
});

vi.mock('@/lib/jumia/orders', () => ({
  getAllOrders: (...args: unknown[]) => mocks.getAllOrders(...args),
  getOrderItems: (...args: unknown[]) => mocks.getOrderItems(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mocks.loggerError(...args),
  },
}));

function createMutationQuery(table: string, payload: Record<string, unknown>) {
  const mutation: MutationRecord = {
    filters: [],
    payload,
    table,
    type: 'update',
  };
  mocks.mutations.push(mutation);

  type MutationQuery = Promise<{ error: null }> & {
    eq: (column: string, value: unknown) => MutationQuery;
  };

  const query = Promise.resolve({ error: null }) as MutationQuery;
  query.eq = (column: string, value: unknown) => {
    mutation.filters.push([column, value]);
    return query;
  };

  return query;
}

function createSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn((column: string, values: string[]) => {
            mocks.inQueries.push({ column, values });
            if (mocks.prefetchError) {
              return Promise.resolve({
                data: null,
                error: mocks.prefetchError,
              });
            }
            return Promise.resolve({
              data: mocks.existingOrders.filter((order) =>
                values.includes(order.jumia_order_id)
              ),
              error: null,
            });
          }),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) =>
        createMutationQuery(table, payload)
      ),
      upsert: vi.fn(
        (
          payload: Record<string, unknown> | Record<string, unknown>[],
          options?: Record<string, unknown>
        ) => {
          mocks.upserts.push({ options, payload, table });
          return Promise.resolve({ error: mocks.upsertError });
        }
      ),
    })),
  };
}

let supabase: ReturnType<typeof createSupabase>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => supabase),
}));

const { POST } = await import('./route');

function createRequest() {
  return new NextRequest(
    `http://localhost/api/marketplace/jumia/orders?integrationId=${validIntegrationId}`,
    { method: 'POST' }
  );
}

function createOrder(id: number | string): JumiaOrderFixture {
  return {
    createdAt: '2026-06-21T12:00:00.000Z',
    id,
    number: `NO-${id}`,
    shippingAddress: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+2348012345678',
    },
    status: 'pending',
    totalAmount: { currency: 'NGN', value: 12_000 },
  };
}

function expectHomogeneousPayloadKeys(
  payload: Record<string, unknown> | Record<string, unknown>[]
) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const keySets = rows.map((row) => Object.keys(row).sort().join('\0'));
  expect(new Set(keySets)).toHaveLength(1);
}

function getUpsertPayloadRows(): Record<string, unknown>[] {
  const payload = mocks.upserts[0]?.payload;
  expect(Array.isArray(payload)).toBe(true);
  return payload as Record<string, unknown>[];
}

describe('POST /api/marketplace/jumia/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existingOrders.length = 0;
    mocks.inQueries.length = 0;
    mocks.mutations.length = 0;
    mocks.prefetchError = null;
    mocks.upsertError = null;
    mocks.upserts.length = 0;
    supabase = createSupabase();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
    });
    mocks.getOrderItems.mockResolvedValue({ items: [] });
    mocks.hasPermission.mockReturnValue(true);
    mocks.notifyJumiaOrder.mockResolvedValue(undefined);
  });

  it('chunks existing-order prefetches and only counts duplicate Jumia IDs once', async () => {
    const uniqueOrders = Array.from({ length: 101 }, (_, index) =>
      createOrder(`order-${index + 1}`)
    );
    mocks.getAllOrders.mockResolvedValue([...uniqueOrders, uniqueOrders[0]]);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(101);
    expect(body.synced).toBe(102);
    expect(mocks.inQueries).toHaveLength(2);
    expect(mocks.inQueries[0].values).toHaveLength(100);
    expect(mocks.inQueries[1].values).toEqual(['order-101']);

    const upsertRows = getUpsertPayloadRows();
    expect(upsertRows).toHaveLength(101);
    expect(upsertRows.map((row) => row.jumia_order_id)).toHaveLength(
      new Set(upsertRows.map((row) => row.jumia_order_id)).size
    );
    expectHomogeneousPayloadKeys(mocks.upserts[0]?.payload ?? []);
    expect(mocks.notifyJumiaOrder).toHaveBeenCalledTimes(101);
  });

  it('normalizes IDs to strings and updates existing orders without new notifications', async () => {
    mocks.existingOrders.push({
      id: 'cache-row-123',
      jumia_order_id: '123',
      notification_sent: true,
    });
    mocks.getAllOrders.mockResolvedValue([createOrder(123)]);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(0);
    expect(mocks.notifyJumiaOrder).not.toHaveBeenCalled();

    const upsertRows = getUpsertPayloadRows();
    expect(upsertRows).toHaveLength(1);
    expect(upsertRows[0]).toMatchObject({
      jumia_order_id: '123',
      notification_sent: true,
    });
    expect(mocks.upserts[0]?.options).toEqual({ onConflict: 'jumia_order_id' });
    expect(
      mocks.mutations.some((mutation) => mutation.table === 'jumia_orders')
    ).toBe(false);
  });

  it('splits bulk upserts by payload shape when some order-item fetches fail', async () => {
    mocks.getAllOrders.mockResolvedValue([
      createOrder('order-1'),
      createOrder('order-2'),
    ]);
    mocks.getOrderItems
      .mockRejectedValueOnce(new Error('items unavailable'))
      .mockResolvedValueOnce({ items: [] });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(2);
    expect(mocks.upserts).toHaveLength(2);
    for (const upsert of mocks.upserts) {
      expectHomogeneousPayloadKeys(upsert.payload);
    }
    const upsertPayloads = mocks.upserts.flatMap((upsert) =>
      Array.isArray(upsert.payload) ? upsert.payload : [upsert.payload]
    );
    expect(upsertPayloads).toHaveLength(2);
    expect(upsertPayloads.some((payload) => 'items' in payload)).toBe(true);
    expect(upsertPayloads.some((payload) => !('items' in payload))).toBe(true);
  });

  it('fails closed when existing-order prefetch fails', async () => {
    mocks.prefetchError = { message: 'select failed' };
    mocks.getAllOrders.mockResolvedValue([createOrder('order-1')]);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to process orders' });
    expect(mocks.upserts).toHaveLength(0);
    expect(mocks.notifyJumiaOrder).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to prefetch existing Jumia orders',
      })
    );
  });

  it('fails closed when the bulk upsert fails before notifications', async () => {
    mocks.upsertError = { message: 'upsert failed' };
    mocks.getAllOrders.mockResolvedValue([createOrder('order-1')]);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to process orders' });
    expect(mocks.upserts).toHaveLength(1);
    expect(mocks.notifyJumiaOrder).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to bulk upsert Jumia orders',
        orderCount: 1,
      })
    );
  });
});
