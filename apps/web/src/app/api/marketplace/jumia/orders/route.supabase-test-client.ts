import { vi } from 'vitest';

export type ExistingJumiaOrder = {
  id: string;
  notification_claimed_at?: string | null;
  jumia_order_id: string;
  notification_sent: boolean | null;
};

export type MutationRecord = {
  filters: [string, unknown][];
  orFilters: string[];
  payload: Record<string, unknown>;
  table: string;
  type: 'update';
};

export type UpsertRecord = {
  options: Record<string, unknown> | undefined;
  payload: Record<string, unknown> | Record<string, unknown>[];
  table: string;
};

type SupabaseTestMocks = {
  existingOrders: ExistingJumiaOrder[];
  inQueries: Array<{ column: string; values: string[] }>;
  mutations: MutationRecord[];
  notificationClaimError: { message: string } | null;
  notificationClaimRows: ExistingJumiaOrder[] | null;
  notificationMarkerError: { message: string } | null;
  notificationStates: ExistingJumiaOrder[] | null;
  prefetchError: { message: string } | null;
  upsertError: { message: string } | null;
  upsertErrors: Array<{ message: string } | null>;
  upserts: UpsertRecord[];
};

function createMutationQuery(
  mocks: SupabaseTestMocks,
  table: string,
  payload: Record<string, unknown>
) {
  const mutation: MutationRecord = {
    filters: [],
    orFilters: [],
    payload,
    table,
    type: 'update',
  };
  mocks.mutations.push(mutation);

  type MutationResult = {
    data?: ExistingJumiaOrder[] | ExistingJumiaOrder | null;
    error: { message: string } | null;
  };

  type MutationQuery = {
    eq: (column: string, value: unknown) => MutationQuery;
    maybeSingle: () => Promise<MutationResult>;
    or: (filters: string) => MutationQuery;
    select: (columns: string) => MutationQuery;
  };

  const resolveMutation = (): MutationResult => {
    if (table !== 'jumia_orders') return { error: null };
    if (payload.notification_claimed_at && mocks.notificationClaimError) {
      return { data: null, error: mocks.notificationClaimError };
    }
    if (payload.notification_sent === true && mocks.notificationMarkerError) {
      return { data: null, error: mocks.notificationMarkerError };
    }

    const orderId = mutation.filters.find(
      ([column]) => column === 'jumia_order_id'
    )?.[1];

    if (payload.notification_claimed_at) {
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
            notification_claimed_at: String(payload.notification_claimed_at),
            jumia_order_id: String(orderId),
            notification_sent: false,
          },
        ],
        error: null,
      };
    }

    if (payload.notification_sent !== true) {
      return { error: null };
    }

    return {
      data: [
        {
          id: `cache-row-${String(orderId)}`,
          notification_claimed_at: null,
          jumia_order_id: String(orderId),
          notification_sent: true,
        },
      ],
      error: null,
    };
  };

  const query = {} as MutationQuery;
  query.eq = (column: string, value: unknown) => {
    mutation.filters.push([column, value]);
    return query;
  };
  query.maybeSingle = () => {
    const result = resolveMutation();
    return Promise.resolve({
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    });
  };
  query.or = (filters: string) => {
    mutation.orFilters.push(filters);
    return query;
  };
  query.select = () => query;
  return query;
}

export function createSupabaseTestClient(mocks: SupabaseTestMocks) {
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
        createMutationQuery(mocks, table, payload)
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
