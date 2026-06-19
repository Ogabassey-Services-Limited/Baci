import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

function createOrdersQueryMock(response: {
  data: unknown;
  error: Error | null;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockResolvedValue(response);
  return query;
}

function createClaimDeleteQueryMock(response: { error?: Error | null } = {}) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
  };
  query.delete.mockReturnValue(query);
  query.eq.mockResolvedValue({ error: response.error ?? null });
  return query;
}

function createClaimUpdateQueryMock(response: { error?: Error | null } = {}) {
  const query = {
    eq: vi.fn(),
    update: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockResolvedValue({ error: response.error ?? null });
  return query;
}

export function createSupabaseMock(
  response: { data: unknown; error: Error | null },
  options: {
    claimDeleteResponse?: { error?: Error | null };
    claimRpcResponses?: Array<{
      data?: { claim_id?: string | null; status: 'created' | 'skipped' } | null;
      error?: Error | null;
    }>;
    claimUpdateResponse?: { error?: Error | null };
  } = {}
) {
  const ordersQuery = createOrdersQueryMock(response);
  const claimDeleteQuery = createClaimDeleteQueryMock(
    options.claimDeleteResponse ?? {}
  );
  const claimUpdateQuery = createClaimUpdateQueryMock(
    options.claimUpdateResponse ?? {}
  );
  const receiptClaimsTable = {
    delete: claimDeleteQuery.delete,
    update: claimUpdateQuery.update,
  };
  const claimRpcResponses = options.claimRpcResponses ?? [
    { data: { claim_id: 'claim-1', status: 'created' }, error: null },
  ];
  const rpc = vi.fn((name: string) => {
    if (name !== 'create_receipt_claim_for_import_notification') {
      throw new Error(`Unexpected rpc ${name}`);
    }

    return Promise.resolve(
      claimRpcResponses.shift() ?? {
        data: { claim_id: 'claim-1', status: 'created' },
        error: null,
      }
    );
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return ordersQuery;
      }
      if (table === 'receipt_claims') {
        return receiptClaimsTable;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc,
    testQueries: {
      claimDeleteQuery,
      claimUpdateQuery,
      ordersQuery,
      rpc,
    },
  } as unknown as SupabaseClient;
}
