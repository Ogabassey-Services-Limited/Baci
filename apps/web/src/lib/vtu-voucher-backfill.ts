import { after } from 'next/server';
import type { createAdminClient } from '@/lib/supabase/admin';
import { backfillVtuVoucherPin } from '@/lib/vtu-fulfillment';

export const TOKEN_BACKFILL_TYPES = new Set([
  'electricity',
  'cable_tv',
  'betting',
]);
export const MAX_TOKEN_BACKFILL_SCHEDULES = 3;
export const VOUCHER_PIN_BACKFILL_SCHEDULED_AT_KEY =
  'voucherPinBackfillScheduledAt';
export const TOKEN_BACKFILL_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

export type MetadataRecord = Record<string, unknown>;

interface VoucherPinBackfillTransaction {
  id: unknown;
  request_reference: unknown;
  status: unknown;
  transaction_id: unknown;
  type: unknown;
}

export function isMetadataRecord(
  metadata: unknown
): metadata is MetadataRecord {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
  );
}

export function normalizeMetadata(metadata: unknown): MetadataRecord {
  return isMetadataRecord(metadata) ? metadata : {};
}

function toStableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toStableJsonValue(item));
  }

  if (isMetadataRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = toStableJsonValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(toStableJsonValue(value)) ?? 'null';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function extractMetadataField<T>(
  metadata: unknown,
  key: string,
  validator: (value: unknown) => value is T
) {
  if (!isMetadataRecord(metadata)) {
    return null;
  }

  const value = metadata[key];
  return validator(value) ? value : null;
}

export function shouldBackfillForType(type: unknown) {
  return TOKEN_BACKFILL_TYPES.has(String(type));
}

export function hasRecentBackfillSchedule(metadata: MetadataRecord) {
  const scheduledAt = extractMetadataField(
    metadata,
    VOUCHER_PIN_BACKFILL_SCHEDULED_AT_KEY,
    isString
  );
  const scheduledAtMs = scheduledAt ? Date.parse(scheduledAt) : Number.NaN;
  return (
    Number.isFinite(scheduledAtMs) &&
    Date.now() - scheduledAtMs < TOKEN_BACKFILL_DEDUPE_WINDOW_MS
  );
}

async function markVoucherPinBackfillScheduled({
  metadata,
  originalMetadata,
  supabase,
  transactionId,
}: {
  metadata: MetadataRecord;
  originalMetadata: unknown;
  supabase: ReturnType<typeof createAdminClient>;
  transactionId: string;
}) {
  const nextMetadata = {
    ...metadata,
    [VOUCHER_PIN_BACKFILL_SCHEDULED_AT_KEY]: new Date().toISOString(),
  };
  let updateQuery = supabase
    .from('vtu_transactions')
    .update({ metadata: nextMetadata })
    .eq('id', transactionId);

  updateQuery =
    originalMetadata === null || typeof originalMetadata === 'undefined'
      ? updateQuery.is('metadata', null)
      : updateQuery.filter(
          'metadata',
          'eq',
          // Supabase filter() expects raw PostgREST syntax, so pass stable JSON
          // text instead of an object, which would become "[object Object]".
          `${stableJsonStringify(originalMetadata)}::jsonb`
        );

  const { data, error } = await updateQuery.select('id');
  if (error) {
    console.error('Failed to mark VTU voucher-pin backfill as scheduled:', {
      error,
      transactionId,
    });
    return null;
  }

  return Array.isArray(data) && data.length > 0 ? nextMetadata : null;
}

export async function scheduleVoucherPinBackfill({
  metadata,
  originalMetadata,
  supabase,
  transaction,
  voucherPin,
}: {
  metadata: MetadataRecord;
  originalMetadata: unknown;
  supabase: ReturnType<typeof createAdminClient>;
  transaction: VoucherPinBackfillTransaction;
  voucherPin: string | null;
}) {
  if (
    voucherPin !== null ||
    transaction.status !== 'successful' ||
    !shouldBackfillForType(transaction.type) ||
    hasRecentBackfillSchedule(metadata)
  ) {
    return false;
  }

  if (transaction.id == null) {
    console.error('Cannot schedule VTU voucher-pin backfill without an id:', {
      transaction,
    });
    return false;
  }

  const transactionId = String(transaction.id);
  const scheduledMetadata = await markVoucherPinBackfillScheduled({
    metadata,
    originalMetadata,
    supabase,
    transactionId,
  });

  if (!scheduledMetadata) {
    return false;
  }

  after(async () => {
    try {
      await backfillVtuVoucherPin({
        billRequestRef: isString(transaction.request_reference)
          ? transaction.request_reference
          : null,
        billResponseReference: isString(transaction.transaction_id)
          ? transaction.transaction_id
          : null,
        metadata: scheduledMetadata,
        supabase,
        transactionId,
      });
    } catch (error) {
      console.error('Failed to backfill VTU voucher pin from history:', {
        error,
        transactionId: transaction.id,
        transactionReference: transaction.transaction_id,
      });
    }
  });

  return true;
}
