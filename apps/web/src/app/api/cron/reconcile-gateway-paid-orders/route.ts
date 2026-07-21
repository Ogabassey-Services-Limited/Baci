import { after, type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { drainFailedOrderCancellationSideEffects } from '@/lib/orders/drain-failed-order-cancellation-side-effects';
import { drainFailedPaidOrderSideEffects } from '@/lib/payments/drain-failed-paid-order-side-effects';
import { reconcileWedgedGatewayOrders } from '@/lib/payments/reconcile-wedged-gateway-orders';
import { createServiceClient } from '@/lib/supabase/service';

// Scheduled by the vercel.json cron entry. Three passes:
// 1. Retry deterministic merchant-cancellation email/refund failures.
// 2. Heal "wedged" gateway order payments — completed transaction, order
//    never flipped to paid — after re-verifying with the gateway.
// 3. Drain failed paid-order side effects (settlement/email/ad tracking)
//    for orders that ARE paid but whose outbox recorded a failure.
// Safety net behind the webhook's own heal-on-retry path.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    logger.error({
      message: 'reconcile-gateway-paid-orders: CRON_SECRET is not configured',
    });
    return NextResponse.json(
      { error: 'server_misconfigured' },
      { status: 500 }
    );
  }

  if (!hasValidCronSecret(request.headers, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const scheduleAfter = (task: () => Promise<void>) => after(task);
    const cancellationSideEffectDrain =
      await drainFailedOrderCancellationSideEffects({ supabase });
    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });
    const sideEffectDrain = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    if (
      summary.checked > 0 ||
      sideEffectDrain.drained.length > 0 ||
      sideEffectDrain.failed.length > 0 ||
      cancellationSideEffectDrain.drained.length > 0 ||
      cancellationSideEffectDrain.failed.length > 0
    ) {
      logger.warn({
        message:
          'reconcile-gateway-paid-orders found gateway payment records to reconcile',
        cancellationSideEffectDrain,
        sideEffectDrain,
        summary,
      });
    }

    return NextResponse.json({
      checked_at: new Date().toISOString(),
      ...summary,
      cancellationSideEffectDrain,
      sideEffectDrain,
    });
  } catch (error) {
    logger.error({
      error,
      message: 'reconcile-gateway-paid-orders cron failed',
    });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
