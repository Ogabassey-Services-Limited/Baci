import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const POSTGRES_UNIQUE_VIOLATION = '23505';

type IdempotencyRecord = {
  request_hash?: unknown;
  response_body?: unknown;
  status_code?: unknown;
};

type ExistingIdempotencyRecordResult =
  | { ok: true; record: IdempotencyRecord | null }
  | { error: unknown; ok: false };

type IdempotencyRequestFingerprint = {
  apiVersion: string;
  body: string;
  method: string;
  pathname: string;
};

export type IdempotencyReservationResult =
  | { ok: true; state: 'reserved' }
  | { ok: true; response: unknown; state: 'replay'; status: number }
  | {
      error: 'Idempotency conflict' | 'Idempotency request in progress';
      ok: false;
    }
  | { error: 'Idempotency reservation failed'; ok: false };

export function hashIdempotencyRequest({
  apiVersion,
  body,
  method,
  pathname,
}: IdempotencyRequestFingerprint): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        api_version: apiVersion,
        body,
        method: method.toUpperCase(),
        pathname,
      })
    )
    .digest('hex');
}

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
    return { error: 'Idempotency reservation failed', ok: false };
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
    return { error: 'Idempotency reservation failed', ok: false };
  }
  if (!existing.record || existing.record.request_hash !== requestHash) {
    return { error: 'Idempotency conflict', ok: false };
  }
  if (typeof existing.record.status_code !== 'number') {
    return { error: 'Idempotency request in progress', ok: false };
  }

  return {
    ok: true,
    response: existing.record.response_body,
    state: 'replay',
    status: existing.record.status_code,
  };
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
    .select('request_hash, response_body, status_code')
    .eq('route', route)
    .eq('idempotency_key', key)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) {
    return { error, ok: false };
  }

  return { ok: true, record: data as IdempotencyRecord | null };
}
