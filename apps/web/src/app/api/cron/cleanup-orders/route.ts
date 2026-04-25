import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { createAdminClient } from '@/lib/supabase/admin';

// Cron job to clean up abandoned/unpaid orders
// Manual fallback only - DO NOT re-enable Vercel Cron for this route.
// Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
export async function GET(request: NextRequest) {
  try {
    // Verify authentication for manual fallback invocation.
    const authHeader = request.headers.get('authorization');
    const cronSecret = getCronSecret();

    if (
      !authHeader ||
      !cronSecret ||
      !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)
    ) {
      // Allow local development testing if needed, or stick to strict checking
      // For now, we return 401 if unauthorized
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Call the RPC function to mark abandoned orders (default 72 hours)
    // We can override the threshold if needed, e.g., { hours_threshold: 48 }
    const { error } = await supabase.rpc('mark_abandoned_orders', {
      hours_threshold: 72,
    });

    if (error) {
      console.error('Error cleaning up orders:', error);
      return NextResponse.json(
        { error: 'Failed to clean up orders' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup job completed successfully',
    });
  } catch (error) {
    console.error('Unexpected error in cleanup cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
