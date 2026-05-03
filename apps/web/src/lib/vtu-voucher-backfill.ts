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
export const VOUCHER_PIN_BACKFILL_ATTEMPTS_KEY = 'voucherPinBackfillAttempts';
// After a no-pin result, clear the timestamp so the next mobile poll can
// retry immediately. Stop retrying after this many Kuda BILL_TSQ calls.
export const MAX_VOUCHER_PIN_BACKFILL_ATTEMPTS = 10;
// Short dedupe window: only block a second concurrent attempt within the same
// request burst. Once the after() callback clears the timestamp, the next poll
// can schedule a fresh attempt.
export const TOKEN_BACKFILL_DEDUPE_WINDOW_MS = 5_000;

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
  if (typeof value === 'undefined') {
    throw new TypeError(
      'Cannot stable JSON stringify metadata containing undefined'
    );
  }

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

/**
 * Serializes metadata for PostgREST JSON equality filters with deterministic
 * object key order. Undefined is rejected because JSON.stringify would either
 * omit it or convert it to null, which can corrupt compare-and-set semantics.
 */
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
): T | null {
  if (!isMetadataRecord(metadata)) {
    return null;
  }

  const value = metadata[key];
  return validator(value) ? value : null;
}

export function shouldBackfillForType(type: unknown): boolean {
  return TOKEN_BACKFILL_TYPES.has(String(type));
}

function getBackfillAttempts(metadata: MetadataRecord): number {
  const raw = metadata[VOUCHER_PIN_BACKFILL_ATTEMPTS_KEY];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

export function hasRecentBackfillSchedule(metadata: MetadataRecord): boolean {
  // Hard stop: exhausted all retry attempts.
  if (getBackfillAttempts(metadata) >= MAX_VOUCHER_PIN_BACKFILL_ATTEMPTS) {
    return true;
  }

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
}): Promise<MetadataRecord | null> {
  const nextMetadata = {
    ...metadata,
    [VOUCHER_PIN_BACKFILL_SCHEDULED_AT_KEY]: new Date().toISOString(),
    [VOUCHER_PIN_BACKFILL_ATTEMPTS_KEY]: getBackfillAttempts(metadata) + 1,
  };
  let updateQuery = supabase
    .from('vtu_transactions')
    .update({ metadata: nextMetadata })
    .eq('id', transactionId);

  updateQuery =
    originalMetadata === null
      ? updateQuery.is('metadata', null)
      : updateQuery.filter(
          'metadata',
          'eq',
          // Supabase filter() expects raw PostgREST syntax, so pass stable JSON
          // text instead of an object, which would become "[object Object]".
          stableJsonStringify(originalMetadata)
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

/**
 * After a no-pin result from Kuda, clear voucherPinBackfillScheduledAt so the
 * next mobile history poll can immediately schedule a fresh attempt (up to the
 * attempt cap).
 */
async function clearVoucherPinBackfillTimestamp({
  currentMetadata,
  supabase,
  transactionId,
}: {
  currentMetadata: MetadataRecord;
  supabase: ReturnType<typeof createAdminClient>;
  transactionId: string;
}): Promise<void> {
  const { [VOUCHER_PIN_BACKFILL_SCHEDULED_AT_KEY]: _dropped, ...rest } =
    currentMetadata;
  const { error } = await supabase
    .from('vtu_transactions')
    .update({ metadata: rest })
    .eq('id', transactionId);

  if (error) {
    console.error(
      'Failed to clear VTU voucher-pin backfill timestamp after no-pin result:',
      { error, transactionId }
    );
  }
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
}): Promise<boolean> {
  if (
    voucherPin !== null ||
    transaction.status !== 'successful' ||
    !shouldBackfillForType(transaction.type) ||
    hasRecentBackfillSchedule(metadata)
  ) {
    return false;
  }

  if (!isString(transaction.id)) {
    console.error('Cannot schedule VTU voucher-pin backfill without an id:', {
      transaction,
    });
    return false;
  }

  const transactionId = transaction.id;
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
      const pin = await backfillVtuVoucherPin({
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

      // Kuda didn't return a pin yet — clear the timestamp so the next mobile
      // poll can schedule a fresh attempt immediately instead of waiting for
      // the 15-minute dedupe window.
      if (!pin) {
        await clearVoucherPinBackfillTimestamp({
          currentMetadata: scheduledMetadata,
          supabase,
          transactionId,
        });
      }
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
