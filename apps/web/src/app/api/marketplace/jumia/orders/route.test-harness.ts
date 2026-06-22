import { NextRequest } from 'next/server';
import { expect, vi } from 'vitest';

type ExistingJumiaOrder = {
  id: string;
  jumia_order_id: string;
  notification_sent: boolean | null;
};

type MutationRecord = {
  filters: [string, unknown][];
  orFilters: string[];
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
  notificationStates: null as ExistingJumiaOrder[] | null,
  mutations: [] as MutationRecord[],
  notifyJumiaOrder: vi.fn(),
  notificationClaimError: null as { message: string } | null,
  notificationClaimRows: null as ExistingJumiaOrder[] | null,
  prefetchError: null as { message: string } | null,
  upsertError: null as { message: string } | null,
  upsertErrors: [] as Array<{ message: string } | null>,
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
    orFilters: [],
    payload,
    table,
    type: 'update',
  };
  mocks.mutations.push(mutation);

  type MutationResult = {
    data?: ExistingJumiaOrder[] | null;
    error: { message: string } | null;
  };

  type MutationQuery = Promise<MutationResult> & {
    eq: (column: string, value: unknown) => MutationQuery;
    or: (filters: string) => MutationQuery;
    select: (columns: string) => Promise<MutationResult>;
  };

  const resolveMutation = (): MutationResult => {
    if (table !== 'jumia_orders' || payload.notification_sent !== true) {
      return { error: null };
    }

    if (mocks.notificationClaimError) {
      return { data: null, error: mocks.notificationClaimError };
    }

    const orderId = mutation.filters.find(
      ([column]) => column === 'jumia_order_id'
    )?.[1];
    const claimRows = mocks.notificationClaimRows;
    if (claimRows) {
      return {
        data: claimRows.filter((row) => row.jumia_order_id === orderId),
        error: null,
      };
    }

    return {
      data: [
        {
          id: `cache-row-${String(orderId)}`,
          jumia_order_id: String(orderId),
          notification_sent: true,
        },
      ],
      error: null,
    };
  };

  const query = Promise.resolve(resolveMutation()) as MutationQuery;
  query.eq = (column: string, value: unknown) => {
    mutation.filters.push([column, value]);
    return query;
  };
  query.or = (filters: string) => {
    mutation.orFilters.push(filters);
    return query;
  };
  query.select = () => Promise.resolve(resolveMutation());

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
            const sourceRows =
              mocks.upserts.length > 0 && mocks.notificationStates
                ? mocks.notificationStates
                : mocks.existingOrders;
            return Promise.resolve({
              data: sourceRows.filter((order) =>
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
          const error =
            mocks.upsertErrors.length > 0
              ? (mocks.upsertErrors.shift() ?? null)
              : mocks.upsertError;
          mocks.upserts.push({ options, payload, table });
          return Promise.resolve({ error });
        }
      ),
    })),
  };
}

let supabase: ReturnType<typeof createSupabase>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => supabase),
}));

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

function reset() {
  vi.clearAllMocks();
  mocks.existingOrders.length = 0;
  mocks.inQueries.length = 0;
  mocks.mutations.length = 0;
  mocks.notificationClaimError = null;
  mocks.notificationClaimRows = null;
  mocks.notificationStates = null;
  mocks.prefetchError = null;
  mocks.upsertError = null;
  mocks.upsertErrors.length = 0;
  mocks.upserts.length = 0;
  supabase = createSupabase();
  mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
  mocks.getMerchantForApiRequest.mockResolvedValue({
    merchantId: 'merchant-1',
  });
  mocks.getOrderItems.mockResolvedValue({ items: [] });
  mocks.hasPermission.mockReturnValue(true);
  mocks.notifyJumiaOrder.mockResolvedValue(undefined);
}

export const jumiaOrdersRouteHarness = {
  createOrder,
  createRequest,
  expectHomogeneousPayloadKeys,
  get mocks() {
    return mocks;
  },
  getUpsertPayloadRows,
  reset,
};
