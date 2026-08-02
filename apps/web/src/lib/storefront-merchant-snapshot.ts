import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  StorefrontDatabase,
  StorefrontMerchantSnapshotRow,
} from '@/types/storefront-database';
import {
  resolveStorefrontReadResult,
  type StorefrontReadResult,
} from './storefront-read-result';

const MERCHANT_SNAPSHOT_RUNTIME_DEADLINE_MS = 5_000;

function merchantSnapshotDeadlineMs() {
  return MERCHANT_SNAPSHOT_RUNTIME_DEADLINE_MS;
}

function isBoundedStorefrontBuild() {
  return process.env.BACI_STOREFRONT_BUILD_READS === 'bounded';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function readStorefrontMerchantSnapshot(
  client: SupabaseClient<StorefrontDatabase>,
  identifier: string
): Promise<StorefrontReadResult<StorefrontMerchantSnapshotRow>> {
  const query = client.rpc(
    'resolve_storefront_public_snapshot_v2',
    { p_identifier: identifier },
    { get: true }
  );
  const boundedQuery =
    typeof query.abortSignal === 'function'
      ? (isBoundedStorefrontBuild()
          ? query
          : query.abortSignal(AbortSignal.timeout(merchantSnapshotDeadlineMs()))
        )
          // Disable postgrest-js's automatic GET retry so the runtime deadline
          // or admitted build transport deadline is not extended by backoff.
          // Pinned by supabase/postgrest-timeout-retry.test.ts.
          .retry(false)
      : query;
  const response = await boundedQuery;

  const result = resolveStorefrontReadResult({
    operation: 'merchant_snapshot',
    response,
    parse: (rows) => (Array.isArray(rows) ? (rows[0] ?? null) : null),
  });

  if (result.status === 'unavailable') return result;
  if (result.status === 'not_found') {
    return {
      status: 'unavailable',
      error: {
        kind: 'integrity',
        operation: 'merchant_snapshot',
        retryable: false,
      },
    };
  }

  const row = result.value;
  if (row.resolution_status === 'not_found') {
    return { status: 'not_found' };
  }
  if (row.resolution_status !== 'found' || !isJsonObject(row.merchant_data)) {
    return {
      status: 'unavailable',
      error: {
        kind: 'integrity',
        operation: 'merchant_snapshot',
        retryable: false,
      },
    };
  }

  return result;
}
