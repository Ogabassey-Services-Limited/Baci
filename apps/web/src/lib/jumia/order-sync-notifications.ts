import type { SupabaseClient } from '@supabase/supabase-js';

const NOTIFICATION_SENT_UPDATE_ATTEMPTS = 3;
const NOTIFICATION_SENT_UPDATE_RETRY_DELAY_MS = 25;

interface SyncErrorLike {
  message: string;
}

interface MarkNotificationOptions {
  attempts?: number;
  retryDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getJumiaNotificationAttemptKey(
  merchantId: string,
  jumiaOrderId: string
) {
  return `${encodeURIComponent(merchantId)}:${encodeURIComponent(jumiaOrderId)}`;
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
    const { data, error } = await supabase
      .from('jumia_orders')
      .update({ notification_sent: true })
      .eq('merchant_id', merchantId)
      .eq('jumia_order_id', jumiaOrderId)
      .select('jumia_order_id')
      .maybeSingle<{ jumia_order_id: string }>();
    if (!error) {
      if (data) return null;
      return {
        message: `No Jumia order notification marker updated for ${jumiaOrderId}`,
      };
    }
    lastError = error;

    if (attempt < attempts && retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
  }

  return lastError;
}
