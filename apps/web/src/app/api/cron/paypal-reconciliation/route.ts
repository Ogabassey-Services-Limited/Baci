import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { sweepStrandedPaypalCaptures } from '@/lib/payments/paypal-reconciliation-sweep';
import { createClient as createServiceClient } from '@/lib/supabase/admin';

/**
 * Reconciles PayPal payments that our own write path lost.
 *
 * PayPal BYOK has no webhook, so a capture that succeeds at PayPal while the
 * follow-up local write fails leaves the buyer charged and the order unpaid, with
 * nothing in the system aware of it. This is the only path that goes back and looks.
 * It settles through the same funnel every other caller uses, under
 * `reconcile_only` intent, so it can never charge anyone — it can only recover money
 * that PayPal already took.
 *
 * Runs every 10 minutes (vercel.json). Idempotent: re-running is safe, because the
 * funnel's writer is a compare-and-set that no-ops on an already-settled order.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Fail closed when CRON_SECRET is not configured — this endpoint moves money.
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured', code: 'server_misconfigured' },
      { status: 500 }
    );
  }

  if (!hasValidCronSecret(request.headers, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await sweepStrandedPaypalCaptures(supabase);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error({
      message: 'paypal_reconciliation_cron_failed',
      error,
    });
    // A failing sweeper is itself an alertable condition: it means the safety net
    // is down, not that everything is fine.
    return NextResponse.json(
      { ok: false, error: 'PayPal reconciliation sweep failed' },
      { status: 500 }
    );
  }
}
