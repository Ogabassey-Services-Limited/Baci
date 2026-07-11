import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  StorefrontDatabase,
  StorefrontMerchantSnapshotRow,
} from '@/types/storefront-database';
import {
  resolveStorefrontReadResult,
  type StorefrontReadResult,
} from './storefront-read-result';

const MERCHANT_SNAPSHOT_TOTAL_DEADLINE_MS = 5_000;

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
      ? query.abortSignal(
          AbortSignal.timeout(MERCHANT_SNAPSHOT_TOTAL_DEADLINE_MS)
        )
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
