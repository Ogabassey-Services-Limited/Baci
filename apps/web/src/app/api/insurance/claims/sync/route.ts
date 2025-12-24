import { type NextRequest, NextResponse } from 'next/server';
import { syncClaimsStatus } from '@/services/insurance';

export async function POST(_request: NextRequest) {
  try {
    // In a real scenario, verify admin auth or cron secret
    // merchantId is available via searchParams if needed in the future
    const result = await syncClaimsStatus();

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Sync failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Claims status synced successfully',
      updatedCount: result.updated,
    });
    // biome-ignore lint/suspicious/noExplicitAny: Error from catch block
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
