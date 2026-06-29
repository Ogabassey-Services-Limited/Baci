import type { SupabaseClient } from '@supabase/supabase-js';
import type { MyCoverWebhookPayload } from '@/schemas/mycover-webhook';

const MYCOVER_WEBHOOK_PROCESSING_LEASE_MS = 10 * 60 * 1000;

type MyCoverWebhookEventClaimResult =
  | { receivedAt: string | null; status: 'claimed' }
  | { status: 'processed_duplicate' }
  | { status: 'processing_duplicate' };

interface MyCoverWebhookEventClaimRow {
  processing_status: string | null;
  received_at?: string | null;
}

export function isStaleWebhookClaim(
  row: MyCoverWebhookEventClaimRow,
  nowMs = Date.now()
): boolean {
  if (row.processing_status !== 'processing' || !row.received_at) {
    return false;
  }

  const receivedAtMs = Date.parse(row.received_at);
  return (
    Number.isFinite(receivedAtMs) &&
    nowMs - receivedAtMs > MYCOVER_WEBHOOK_PROCESSING_LEASE_MS
  );
}

export async function claimMyCoverWebhookEvent(
  supabase: SupabaseClient,
  payload: MyCoverWebhookPayload,
  attempt = 0
): Promise<MyCoverWebhookEventClaimResult> {
  if (!payload.event_id) {
    return { receivedAt: null, status: 'claimed' };
  }

  const receivedAt = new Date().toISOString();
  const { error } = await supabase.from('mycover_webhook_events').insert({
    event_id: payload.event_id,
    event: payload.event,
    processing_status: 'processing',
    received_at: receivedAt,
  });

  if (!error) {
    return { receivedAt, status: 'claimed' };
  }

  if (error.code !== '23505') {
    console.error('[MyCover Webhook] Failed to claim event_id:', error);
    throw error;
  }

  const { data, error: lookupError } = await supabase
    .from('mycover_webhook_events')
    .select('processing_status, received_at')
    .eq('event_id', payload.event_id)
    .maybeSingle<MyCoverWebhookEventClaimRow>();

  if (lookupError) {
    console.error(
      '[MyCover Webhook] Failed to inspect event_id claim:',
      lookupError
    );
    throw lookupError;
  }

  if (data?.processing_status === 'processed') {
    return { status: 'processed_duplicate' };
  }

  // The conflicting row vanished between our insert and this lookup — another
  // worker released its failed claim — so the event is free to claim again.
  // Retry the insert (bounded) instead of dropping the delivery.
  if (!data && attempt < 2) {
    return claimMyCoverWebhookEvent(supabase, payload, attempt + 1);
  }

  if (data && isStaleWebhookClaim(data)) {
    const reclaimedAt = new Date().toISOString();
    const { data: reclaimedRow, error: reclaimError } = await supabase
      .from('mycover_webhook_events')
      .update({
        event: payload.event,
        processed_at: null,
        processing_status: 'processing',
        received_at: reclaimedAt,
      })
      .match({
        event_id: payload.event_id,
        processing_status: 'processing',
        received_at: data.received_at,
      })
      .select('processing_status')
      .maybeSingle<MyCoverWebhookEventClaimRow>();

    if (reclaimError) {
      console.error(
        '[MyCover Webhook] Failed to reclaim stale event_id claim:',
        reclaimError
      );
      throw reclaimError;
    }

    return reclaimedRow
      ? { receivedAt: reclaimedAt, status: 'claimed' }
      : { status: 'processing_duplicate' };
  }

  return { status: 'processing_duplicate' };
}

export async function completeMyCoverWebhookEventClaim(
  supabase: SupabaseClient,
  eventId: string,
  receivedAt: string | null
): Promise<void> {
  let query = supabase
    .from('mycover_webhook_events')
    .update({
      processed_at: new Date().toISOString(),
      processing_status: 'processed',
    })
    .eq('event_id', eventId);

  if (receivedAt) {
    query = query.eq('received_at', receivedAt);
  }

  const { error } = await query;

  if (error) {
    console.error(
      '[MyCover Webhook] Failed to complete event_id claim:',
      error
    );
    throw error;
  }
}

export async function releaseMyCoverWebhookEventClaim(
  supabase: SupabaseClient,
  eventId: string,
  receivedAt: string | null
): Promise<void> {
  let query = supabase
    .from('mycover_webhook_events')
    .delete()
    .eq('event_id', eventId);

  if (receivedAt) {
    query = query.eq('received_at', receivedAt);
  }

  const { error } = await query;

  if (error) {
    console.error('[MyCover Webhook] Failed to release event_id claim:', error);
  }
}
