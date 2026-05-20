import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
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

    // Verify cron secret
    const authHeader = _request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    const legacyHeader = _request.headers.get('x-cron-secret');
    const cronSecret = bearerToken || legacyHeader;
    const expectedSecret = getCronSecret();

    if (
      !cronSecret ||
      !expectedSecret ||
      !constantTimeEqual(cronSecret, expectedSecret)
    ) {
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
