import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { formatCurrency, notifyMerchant } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const STUCK_BNPL_MIN_AGE_HOURS = 24;
const STUCK_BNPL_MAX_AGE_DAYS = 7;
const STUCK_BNPL_ORDER_SCAN_LIMIT = 500;
const BNPL_PAYMENT_METHODS = ['credit_direct', 'klump', 'credpal'];
// bnpl_pending: provider session opened, no completion webhook yet.
// bnpl_approved: customer-completed webhook arrived but the merchant-payout
//   webhook never did (partial delivery).
// pending/unpaid: BNPL methods that never reached the session RPC flip —
//   CredPal in particular never transitions to bnpl_pending.
const STUCK_BNPL_PAYMENT_STATUSES = [
  'bnpl_pending',
  'bnpl_approved',
  'pending',
  'unpaid',
];
// pending/unpaid only prove the customer PICKED a BNPL method at checkout;
// require provider-session evidence (a persisted transaction/session
// reference in notes) so plain abandoned carts — which cleanup-orders
// reclassifies at 72h — don't page merchants at 24h.
const STATUSES_REQUIRING_PROVIDER_EVIDENCE = new Set(['pending', 'unpaid']);

interface StuckBnplOrderRow {
  id: string;
  order_number: string | null;
  merchant_id: string;
  total: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
  updated_at: string;
  notes: string | null;
}

function hasProviderTransactionReference(notes: string | null) {
  return Boolean(notes && /transactionid/i.test(notes));
}

function getStuckAgeDays(lastMovementAt: string, now: Date) {
  const lastMovement = new Date(lastMovementAt).getTime();
  if (!Number.isFinite(lastMovement)) return 0;
  return Math.max(0, Math.floor((now.getTime() - lastMovement) / 86_400_000));
}

// Alerts merchants about BNPL orders stuck awaiting provider confirmation.
// BNPL success is webhook-driven; when deliveries silently stop, orders sit
// in bnpl_pending until auto-cancellation with no operator signal (July 2026
// Credit Direct incident: zero webhook deliveries ever, ₦299M unconfirmed).
// Manual fallback route — the schedule lives in vps-workers, keep CRON_SECRET
// gating intact.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = getCronSecret();

    if (
      !authHeader ||
      !cronSecret ||
      !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const minAgeCutoff = new Date(
      now.getTime() - STUCK_BNPL_MIN_AGE_HOURS * 3_600_000
    ).toISOString();
    const maxAgeCutoff = new Date(
      now.getTime() - STUCK_BNPL_MAX_AGE_DAYS * 86_400_000
    ).toISOString();

    // Age on updated_at, not created_at: resumed/reminder orders flip into a
    // BNPL state long after creation (set_credit_direct_session does not
    // touch created_at), and a genuinely stuck order has no row movement.
    const supabase = createAdminClient();
    const { data: stuckOrders, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, merchant_id, total, payment_method, payment_status, updated_at, notes'
      )
      .in('payment_status', STUCK_BNPL_PAYMENT_STATUSES)
      .in('payment_method', BNPL_PAYMENT_METHODS)
      .lt('updated_at', minAgeCutoff)
      .gte('updated_at', maxAgeCutoff)
      .order('updated_at', { ascending: true })
      .limit(STUCK_BNPL_ORDER_SCAN_LIMIT);

    if (error) {
      logger.error({
        message: 'Failed to scan for stuck BNPL orders',
        error,
      });
      return NextResponse.json(
        { error: 'Failed to scan orders' },
        { status: 500 }
      );
    }

    const scannedOrders = (stuckOrders ?? []) as StuckBnplOrderRow[];
    if (scannedOrders.length === STUCK_BNPL_ORDER_SCAN_LIMIT) {
      logger.warn({
        message: 'Stuck-BNPL scan hit scan limit; report may be partial',
        scanLimit: STUCK_BNPL_ORDER_SCAN_LIMIT,
      });
    }
    const orders = scannedOrders.filter(
      (order) =>
        !STATUSES_REQUIRING_PROVIDER_EVIDENCE.has(order.payment_status || '') ||
        hasProviderTransactionReference(order.notes)
    );
    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        stuckOrders: 0,
        merchants: 0,
        merchantsNotified: 0,
      });
    }

    const ordersByMerchant = new Map<string, StuckBnplOrderRow[]>();
    for (const order of orders) {
      const merchantOrders = ordersByMerchant.get(order.merchant_id);
      if (merchantOrders) {
        merchantOrders.push(order);
      } else {
        ordersByMerchant.set(order.merchant_id, [order]);
      }
    }

    let merchantsNotified = 0;
    const pushFailures: string[] = [];

    for (const [merchantId, merchantOrders] of ordersByMerchant) {
      const totalAmount = merchantOrders.reduce(
        (sum, order) => sum + (Number(order.total) || 0),
        0
      );
      const withProviderReference = merchantOrders.filter((order) =>
        hasProviderTransactionReference(order.notes)
      ).length;
      const oldest = merchantOrders[0];
      const oldestAgeDays = getStuckAgeDays(oldest.updated_at, now);
      const orderCount = merchantOrders.length;

      logger.warn({
        message: 'BNPL orders stuck awaiting provider confirmation',
        merchantId,
        stuckOrderCount: orderCount,
        totalAmount,
        withProviderReference,
        oldestOrderId: oldest.id,
        oldestOrderNumber: oldest.order_number,
        oldestAgeDays,
      });

      try {
        const result = await notifyMerchant(
          merchantId,
          '⚠️ BNPL orders need attention',
          `${orderCount} BNPL order${orderCount === 1 ? '' : 's'} totalling ${formatCurrency(totalAmount)} ${orderCount === 1 ? 'is' : 'are'} still awaiting payment confirmation after 24h. Oldest: #${oldest.order_number || oldest.id.slice(0, 8)} (stuck ${oldestAgeDays} day${oldestAgeDays === 1 ? '' : 's'}).`,
          {
            type: 'stuck_bnpl_alert',
            stuck_order_count: orderCount,
            total_amount: totalAmount,
            with_provider_reference: withProviderReference,
            oldest_order_id: oldest.id,
          },
          'orders'
        );

        if (result.sent > 0) {
          merchantsNotified++;
        } else {
          pushFailures.push(merchantId);
        }
      } catch (pushError) {
        logger.error({
          message: 'Failed to push stuck-BNPL alert',
          merchantId,
          error: pushError,
        });
        pushFailures.push(merchantId);
      }
    }

    return NextResponse.json({
      success: true,
      stuckOrders: orders.length,
      merchants: ordersByMerchant.size,
      merchantsNotified,
      ...(pushFailures.length > 0 && { pushFailures }),
    });
  } catch (error) {
    logger.error({
      message: 'Unexpected error in stuck-BNPL alert cron',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
