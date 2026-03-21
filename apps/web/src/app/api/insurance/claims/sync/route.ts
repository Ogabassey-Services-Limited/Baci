import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { syncClaimsStatus } from '@/services/insurance';

export async function POST(_request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

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
