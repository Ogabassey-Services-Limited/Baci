import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  InventoryPushAlertsError,
  sendInventoryPushAlerts,
} from '@/scripts/inventory-push-alerts';

/**
 * GET /api/inventory/push-alerts
 *
 * Sends push notifications for new low stock alerts that haven't been notified yet.
 * Called by the VPS web-cron wrapper every 6 hours. Keep CRON_SECRET gating intact.
 */
// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- VPS cron invokes this GET with a bearer CRON_SECRET; browser CSRF cannot supply the required Authorization header.
export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendInventoryPushAlerts());
  } catch (error) {
    console.error('[Inventory Alerts] Push notification error:', error);
    if (error instanceof InventoryPushAlertsError) {
      return NextResponse.json({ error: error.clientMessage }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Push notification failed' },
      { status: 500 }
    );
  }
}
