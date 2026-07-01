import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { syncClaimsStatus } from '@/services/insurance';

export async function POST(_request: NextRequest) {
  try {
    // Verify cron secret before other request validation.
    if (!hasValidCronSecret(_request.headers, getCronSecret())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
