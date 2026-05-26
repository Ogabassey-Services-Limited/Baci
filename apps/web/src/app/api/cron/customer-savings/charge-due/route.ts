import { NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { chargeDueCustomerSavingsGoals } from '@/lib/customer-savings-auto-debit';
import { createServiceClient } from '@/lib/supabase/service';

function formatChargeDueResponse(
  result: Awaited<ReturnType<typeof chargeDueCustomerSavingsGoals>>
) {
  return {
    failed: result.failed,
    processed: result.processed,
    skipped: result.skipped,
    success: true,
  };
}

// Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
export async function POST(request: Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await chargeDueCustomerSavingsGoals({ supabase });

    return NextResponse.json(formatChargeDueResponse(result));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to charge due customer savings goals';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
