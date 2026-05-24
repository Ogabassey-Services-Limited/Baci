import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const REQUEST_RECORD_TTL_MS = 15 * 60 * 1000;
const POSTGRES_UNIQUE_VIOLATION = '23505';
export const AGENTIC_REPLAY_REQUEST_ID_ERROR = 'Replay request id';
export const AGENTIC_REPLAY_RESERVATION_FAILED_ERROR =
  'Request replay reservation failed';

export type RequestReplayResult =
  | { ok: true }
  | {
      error:
        | typeof AGENTIC_REPLAY_REQUEST_ID_ERROR
        | typeof AGENTIC_REPLAY_RESERVATION_FAILED_ERROR;
      ok: false;
    };

export async function reserveAgenticRequestId({
  agentId,
  apiVersion,
  idempotencyKey,
  merchantId,
  now = new Date(),
  requestId,
  route,
  supabase,
}: {
  agentId?: string | null;
  apiVersion: string;
  idempotencyKey?: string | null;
  merchantId: string;
  now?: Date;
  requestId: string;
  route: string;
  supabase: SupabaseClient;
}): Promise<RequestReplayResult> {
  const { error: purgeError } = await supabase
    .from('agentic_request_records')
    .delete()
    .eq('merchant_id', merchantId)
    .lt('expires_at', now.toISOString());
  if (purgeError) {
    logger.warn({
      message: 'Failed to purge expired agentic request records',
      error: purgeError,
      merchantId,
    });
    return { error: AGENTIC_REPLAY_RESERVATION_FAILED_ERROR, ok: false };
  }

  const expiresAt = new Date(
    now.getTime() + REQUEST_RECORD_TTL_MS
  ).toISOString();
  const { error } = await supabase
    .from('agentic_request_records')
    .insert({
      agent_id: agentId?.trim() || null,
      api_version: apiVersion,
      expires_at: expiresAt,
      idempotency_key: idempotencyKey ?? null,
      merchant_id: merchantId,
      request_id: requestId,
      route,
    })
    .select('id')
    .maybeSingle();

  if (!error) {
    return { ok: true };
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION) {
    return { error: AGENTIC_REPLAY_REQUEST_ID_ERROR, ok: false };
  }

  logger.error({
    message: 'Failed to reserve agentic request ID',
    error,
    merchantId,
    requestId,
  });

  return { error: AGENTIC_REPLAY_RESERVATION_FAILED_ERROR, ok: false };
}
