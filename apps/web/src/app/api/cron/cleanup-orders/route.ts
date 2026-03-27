import { type NextRequest, NextResponse } from 'next/server';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { createServiceClient } from '@/lib/supabase/service';

// Cron job to clean up abandoned/unpaid orders
// Runs daily via Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Verify authentication from Vercel Cron
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (
      !authHeader ||
      !process.env.CRON_SECRET ||
      !constantTimeEqual(authHeader, expectedToken)
    ) {
      // Allow local development testing if needed, or stick to strict checking
      // For now, we return 401 if unauthorized
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
