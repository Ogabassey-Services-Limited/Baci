import type { SupabaseClient } from '@supabase/supabase-js';
import { scheduleLegacyPurchaseConversion } from '@/lib/payments/schedule-legacy-purchase-conversion';
import {
  type OrderForConversion,
  triggerPurchaseConversion,
} from '@/lib/trigger-purchase-conversion';

export async function enqueueJuicywayOrderConversion({
  merchantId,
  order,
  scheduleAfter,
  supabase,
}: {
  merchantId: string;
  order: OrderForConversion;
  scheduleAfter: (task: () => Promise<void>) => void;
  supabase: SupabaseClient;
}): Promise<void> {
  await triggerPurchaseConversion(supabase, merchantId, order, {
    deliveryMode: 'enqueue_only',
  });
  scheduleLegacyPurchaseConversion({
    merchantId,
    order,
    scheduleAfter,
    supabase,
  });
}
