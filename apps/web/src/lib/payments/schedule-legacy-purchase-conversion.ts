import type { SupabaseClient } from '@supabase/supabase-js';
import { isLegacyAnalyticsFanoutDisabled } from '@/lib/events/event-pipeline-config';
import { logger } from '@/lib/logger';
import {
  type OrderForConversion,
  triggerPurchaseConversion,
} from '@/lib/trigger-purchase-conversion';

export function scheduleLegacyPurchaseConversion(args: {
  merchantId: string;
  order: OrderForConversion;
  scheduleAfter: (task: () => Promise<void>) => void;
  supabase: SupabaseClient;
}): boolean {
  if (isLegacyAnalyticsFanoutDisabled()) return false;
  args.scheduleAfter(async () => {
    try {
      await triggerPurchaseConversion(
        args.supabase,
        args.merchantId,
        args.order,
        { deliveryMode: 'legacy_only' }
      );
    } catch (error) {
      logger.error({
        error,
        message: 'Legacy ad tracking failed during pipeline migration',
        orderId: args.order.id,
      });
    }
  });
  return true;
}
