import type { SupabaseClient } from '@supabase/supabase-js';
import { hashIdempotencyRequest } from '@/lib/agentic/idempotency-hash';
import { logger } from '@/lib/logger';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_IN_PROGRESS_TTL_MS = 2 * 60 * 1000;
const POSTGRES_UNIQUE_VIOLATION = '23505';
export const IDEMPOTENCY_PARAMETER_MISMATCH_ERROR =
  'Idempotency key reused with different request parameters';
export const IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR =
  'Idempotency request in progress';
export const IDEMPOTENCY_RESERVATION_FAILED_ERROR =
  'Idempotency reservation failed';

type IdempotencyRecord = Partial<
  Record<
    'request_hash' | 'response_body' | 'status_code' | 'updated_at',
    unknown
  >
>;

type ExistingIdempotencyRecordResult =
  | { ok: true; record: IdempotencyRecord | null }
  | { error: unknown; ok: false };

export type IdempotencyReservationResult =
  | { ok: true; state: 'reserved' }
  | { ok: true; response: unknown; state: 'replay'; status: number }
  | {
      error:
        | typeof IDEMPOTENCY_PARAMETER_MISMATCH_ERROR
        | typeof IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR;
      ok: false;
    }
  | { error: typeof IDEMPOTENCY_RESERVATION_FAILED_ERROR; ok: false };

export async function reserveAgenticIdempotencyKey({
  apiVersion,
  body,
  key,
  merchantId,
  method,
  now = new Date(),
  pathname,
  route,
  supabase,
}: {
  apiVersion: string;
  body: string;
  key: string;
  merchantId: string;
  method: string;
  now?: Date;
  pathname: string;
  route: string;
  supabase: SupabaseClient;
}): Promise<IdempotencyReservationResult> {
  const requestHash = hashIdempotencyRequest({
    apiVersion,
    body,
    method,
    pathname,
  });

  const { error: purgeError } = await supabase
    .from('agentic_idempotency_records')
    .delete()
    .eq('merchant_id', merchantId)
    .lt('expires_at', now.toISOString());
  if (purgeError) {
    logger.warn({
      message: 'Failed to purge expired agentic idempotency records',
      error: purgeError,
      merchantId,
      route,
    });
  }

  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS).toISOString();
  const { error } = await supabase
    .from('agentic_idempotency_records')
    .insert({
      expires_at: expiresAt,
      idempotency_key: key,
      merchant_id: merchantId,
      request_hash: requestHash,
      route,
    })
    .select('id')
    .maybeSingle();

  if (!error) {
    return { ok: true, state: 'reserved' };
  }
  if (error.code !== POSTGRES_UNIQUE_VIOLATION) {
    return { error: IDEMPOTENCY_RESERVATION_FAILED_ERROR, ok: false };
  }

  const existing = await getExistingIdempotencyRecord({
    key,
    merchantId,
    route,
    supabase,
  });

  if (!existing.ok) {
    logger.error({
      message: 'Failed to load existing agentic idempotency record',
      error: existing.error,
      merchantId,
      route,
    });
    return { error: IDEMPOTENCY_RESERVATION_FAILED_ERROR, ok: false };
  }
  if (!existing.record || existing.record.request_hash !== requestHash) {
    return { error: IDEMPOTENCY_PARAMETER_MISMATCH_ERROR, ok: false };
  }
  if (typeof existing.record.status_code !== 'number') {
    const reclaimed = await reclaimStaleIdempotencyReservation({
      expiresAt,
      key,
      merchantId,
      now,
      record: existing.record,
      requestHash,
      route,
      supabase,
    });
    if (reclaimed.ok) {
      return { ok: true, state: 'reserved' };
    }

    return { error: IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR, ok: false };
  }

  return {
    ok: true,
    response: existing.record.response_body,
    state: 'replay',
    status: existing.record.status_code,
  };
}

async function reclaimStaleIdempotencyReservation({
  expiresAt,
  key,
  merchantId,
  now,
  record,
  requestHash,
  route,
  supabase,
}: {
  expiresAt: string;
  key: string;
  merchantId: string;
  now: Date;
  record: IdempotencyRecord;
  requestHash: string;
  route: string;
  supabase: SupabaseClient;
}): Promise<{ ok: boolean }> {
  if (!isStaleInProgressReservation(record, now)) {
    return { ok: false };
  }

  const staleBefore = new Date(
    now.getTime() - IDEMPOTENCY_IN_PROGRESS_TTL_MS
  ).toISOString();
  const { data, error } = await supabase
    .from('agentic_idempotency_records')
    .update({
      expires_at: expiresAt,
      request_hash: requestHash,
      response_body: null,
      status_code: null,
      updated_at: now.toISOString(),
    })
    .eq('route', route)
    .eq('idempotency_key', key)
    .eq('merchant_id', merchantId)
    .eq('request_hash', requestHash)
    .is('status_code', null)
    .lt('updated_at', staleBefore)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.warn({
      message: 'Failed to reclaim stale agentic idempotency reservation',
      error,
      merchantId,
      route,
    });
    return { ok: false };
  }

  return { ok: !!data };
}

function isStaleInProgressReservation(
  record: IdempotencyRecord,
  now: Date
): boolean {
  if (typeof record.updated_at !== 'string') {
    return false;
  }

  const updatedAt = new Date(record.updated_at);
  if (!Number.isFinite(updatedAt.getTime())) {
    return false;
  }

  return now.getTime() - updatedAt.getTime() >= IDEMPOTENCY_IN_PROGRESS_TTL_MS;
}

export async function storeAgenticIdempotencyResponse({
  key,
  merchantId,
  response,
  route,
  status,
  supabase,
}: {
  key: string;
  merchantId: string;
  response: unknown;
  route: string;
  status: number;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('agentic_idempotency_records')
    .update({
      response_body: response,
      status_code: status,
      updated_at: new Date().toISOString(),
    })
    .eq('route', route)
    .eq('idempotency_key', key)
    .eq('merchant_id', merchantId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error, ok: false };
  }
  if (!data) {
    return {
      error: new Error('Agentic idempotency record not found'),
      ok: false,
    };
  }

  return { error: null, ok: true };
}

async function getExistingIdempotencyRecord({
  key,
  merchantId,
  route,
  supabase,
}: {
  key: string;
  merchantId: string;
  route: string;
  supabase: SupabaseClient;
}): Promise<ExistingIdempotencyRecordResult> {
  const { data, error } = await supabase
    .from('agentic_idempotency_records')
    .select('request_hash, response_body, status_code, updated_at')
    .eq('route', route)
    .eq('idempotency_key', key)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) {
    return { error, ok: false };
  }
  return { ok: true, record: data as IdempotencyRecord | null };
}
