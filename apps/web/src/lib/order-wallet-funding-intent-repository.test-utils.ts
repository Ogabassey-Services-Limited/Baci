import { vi } from 'vitest';

type MockSupabaseError = Error | { message: string } | null;

export const intentRow = {
  created_at: '2026-05-26T12:00:00.000Z',
  currency: 'NGN',
  customer_id: 'customer-1',
  debited_amount: 0,
  excess_amount: 0,
  expected_amount: 15_000,
  expires_at: '2026-05-26T12:30:00.000Z',
  funded_amount: 0,
  id: 'intent-1',
  idempotency_key: 'order-wallet-funding:order-1:test',
  last_gateway_reference: null,
  last_transaction_id: null,
  merchant_id: 'merchant-1',
  order_id: 'order-1',
  provider: 'paystack',
  status: 'pending',
  target_order_amount: 18_000,
  wallet_balance_snapshot: 3_000,
  wallet_payment_account_id: 'wallet-account-1',
};

export function createSupabaseMock({
  createIntentRow = intentRow,
  createError = null,
  expireError = null,
}: {
  createError?: MockSupabaseError;
  createIntentRow?: Record<string, unknown>;
  expireError?: MockSupabaseError;
} = {}) {
  const single = vi.fn(async () => ({
    data: createError ? null : createIntentRow,
    error: createError,
  }));
  // Supabase RPC builders are thenable and can also expose `.single()`;
  // Object.assign lets these mocks behave like that Promise-plus-method shape.
  const createRpcResult = Object.assign(
    Promise.resolve({
      data: createError ? null : createIntentRow,
      error: createError,
    }),
    { single }
  );
  const expireRpcResult = Object.assign(
    Promise.resolve({ data: null, error: expireError }),
    {
      single: vi.fn(async () => ({ data: null, error: expireError })),
    }
  );
  const rpc = vi.fn((name: string) => {
    if (name === 'create_order_wallet_funding_intent_for_customer') {
      return createRpcResult;
    }
    return expireRpcResult;
  });

  return {
    client: { rpc },
    rpc,
    single,
  };
}

export function createQueryResult({
  data,
  error = null,
}: {
  data: unknown;
  error?: unknown;
}) {
  const result = { data, error };
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => result),
    update: vi.fn(() => query),
  };
  return query;
}

export function createTableSupabaseMock(
  tableQueries: Record<string, ReturnType<typeof createQueryResult>[]>
) {
  const calls: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    calls[table] = calls[table] ?? 0;
    const query = tableQueries[table]?.[calls[table]];
    calls[table] += 1;
    if (!query) {
      throw new Error(
        `Unexpected table access: ${table} (call ${calls[table]}/${tableQueries[table]?.length ?? 0})`
      );
    }
    return query;
  });
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return { client: { from, rpc }, from, rpc };
}
