import { timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// Cron job to clean up abandoned/unpaid orders
// Runs daily via Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (
      !cronSecret ||
      !expectedSecret ||
      cronSecret.length !== expectedSecret.length ||
      !timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service client to bypass RLS
    const supabase = createServiceClient();

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
