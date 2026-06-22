import type { SupabaseClient } from '@supabase/supabase-js';
import { JUMIA_NOTIFICATION_MARKER_RETRY_CODES } from './order-sync-notification-retry-codes';

const NOTIFICATION_SENT_UPDATE_ATTEMPTS = 3;
const NOTIFICATION_SENT_UPDATE_RETRY_DELAY_MS = 25;
const JUMIA_NOTIFICATION_CLAIM_LEASE_MS = 10 * 60 * 1000;

interface SyncErrorLike {
  message: string;
  code?: string;
}

interface MarkNotificationOptions {
  attempts?: number;
  claimedAt?: string;
  retryDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNotificationMarkerError(error: SyncErrorLike) {
  const code = error.code;
  if (!code) return true;

  return (
    JUMIA_NOTIFICATION_MARKER_RETRY_CODES.postgresPrefixes.some((prefix) =>
      code.startsWith(prefix)
    ) || JUMIA_NOTIFICATION_MARKER_RETRY_CODES.postgrestCodes.includes(code)
  );
}

export function getJumiaNotificationAttemptKey(
  merchantId: string,
  jumiaOrderId: string
) {
  return `${encodeURIComponent(merchantId)}:${encodeURIComponent(jumiaOrderId)}`;
}

export async function claimJumiaNotificationDelivery(
  supabase: SupabaseClient,
  merchantId: string,
  jumiaOrderId: string
): Promise<{
  claimed: boolean;
  claimedAt: string | null;
  error: SyncErrorLike | null;
}> {
  const claimedAt = new Date().toISOString();
  const staleBefore = new Date(
    Date.parse(claimedAt) - JUMIA_NOTIFICATION_CLAIM_LEASE_MS
  ).toISOString();
  const { data, error } = await supabase
    .from('jumia_orders')
    .update({ notification_claimed_at: claimedAt })
    .eq('merchant_id', merchantId)
    .eq('jumia_order_id', jumiaOrderId)
    .eq('notification_sent', false)
    .or(
      `notification_claimed_at.is.null,notification_claimed_at.lt.${staleBefore}`
    )
    .select('jumia_order_id')
    .maybeSingle<{ jumia_order_id: string }>();

  return { claimed: Boolean(data), claimedAt: data ? claimedAt : null, error };
}

export async function releaseJumiaNotificationDeliveryClaim(
  supabase: SupabaseClient,
  merchantId: string,
  jumiaOrderId: string,
  claimedAt: string
): Promise<SyncErrorLike | null> {
  const { error } = await supabase
    .from('jumia_orders')
    .update({ notification_claimed_at: null })
    .eq('merchant_id', merchantId)
    .eq('jumia_order_id', jumiaOrderId)
    .eq('notification_claimed_at', claimedAt)
    .select('jumia_order_id')
    .maybeSingle<{ jumia_order_id: string }>();

  return error;
}

export async function markJumiaNotificationSent(
  supabase: SupabaseClient,
  merchantId: string,
  jumiaOrderId: string,
  options: MarkNotificationOptions = {}
): Promise<SyncErrorLike | null> {
  const attempts = options.attempts ?? NOTIFICATION_SENT_UPDATE_ATTEMPTS;
  const retryDelayMs =
    options.retryDelayMs ?? NOTIFICATION_SENT_UPDATE_RETRY_DELAY_MS;
  let lastError: SyncErrorLike | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let query = supabase
      .from('jumia_orders')
      .update({ notification_claimed_at: null, notification_sent: true })
      .eq('merchant_id', merchantId)
      .eq('jumia_order_id', jumiaOrderId);

    if (options.claimedAt) {
      query = query.eq('notification_claimed_at', options.claimedAt);
    }

    const { data, error } = await query
      .select('jumia_order_id')
      .maybeSingle<{ jumia_order_id: string }>();
    if (!error) {
      if (data) return null;
      return {
        message: `No Jumia order notification marker updated for ${jumiaOrderId}`,
      };
    }
    lastError = error;

    if (!isRetryableNotificationMarkerError(error)) break;

    if (attempt < attempts && retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
  }

  return lastError;
}
