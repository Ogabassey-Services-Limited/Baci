import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { formatCurrency, notifyMerchant } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import { fileStuckCreditDirectReviews } from '@/lib/payments/file-stuck-credit-direct-review';
import { createAdminClient } from '@/lib/supabase/admin';
import { STUCK_BNPL_CONFIG } from './stuck-bnpl-config';

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

function hasProviderCheckoutEvidence(notes: string | null) {
  return Boolean(
    hasProviderTransactionReference(notes) ||
      (notes && /creditdirectclientcompletedat/i.test(notes))
  );
}

function getStuckAgeDays(lastMovementAt: string, now: Date) {
  const lastMovement = new Date(lastMovementAt).getTime();
  if (!Number.isFinite(lastMovement)) return 0;
  return Math.max(0, Math.floor((now.getTime() - lastMovement) / 86_400_000));
}

// Alerts merchants and queues Credit Direct orders missing provider confirmation.
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
      now.getTime() - STUCK_BNPL_CONFIG.minAgeHours * 3_600_000
    ).toISOString();
    const maxAgeCutoff = new Date(
      now.getTime() - STUCK_BNPL_CONFIG.maxAgeDays * 86_400_000
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
      .in('payment_status', STUCK_BNPL_CONFIG.paymentStatuses)
      .in('payment_method', STUCK_BNPL_CONFIG.paymentMethods)
      .lt('updated_at', minAgeCutoff)
      .or(`payment_status.eq.bnpl_approved,updated_at.gte.${maxAgeCutoff}`)
      .order('updated_at', { ascending: true })
      .limit(STUCK_BNPL_CONFIG.orderScanLimit);

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
    if (scannedOrders.length === STUCK_BNPL_CONFIG.orderScanLimit) {
      logger.warn({
        message: 'Stuck-BNPL scan hit scan limit; report may be partial',
        scanLimit: STUCK_BNPL_CONFIG.orderScanLimit,
      });
    }
    // Some BNPL flows (e.g. CredPal via /api/payments/initialize) never write
    // a reference into notes but do create a transactions row — check that as
    // a second evidence source before dropping pending/unpaid orders. Only
    // rows that progressed beyond 'pending' count: initialize creates its
    // pending transaction row before the customer even opens the provider
    // popup, so treating those as evidence would re-admit plain abandoned
    // carts.
    const evidenceCandidates = scannedOrders.filter(
      (order) =>
        STATUSES_REQUIRING_PROVIDER_EVIDENCE.has(order.payment_status || '') &&
        !hasProviderCheckoutEvidence(order.notes)
    );
    const orderIdsWithTransactionEvidence = new Set<string>();
    const transactionEvidenceReferences = new Map<string, string>();
    let transactionEvidenceLookupFailed = false;
    if (evidenceCandidates.length > 0) {
      const { data: transactionRows, error: transactionError } = await supabase
        .from('transactions')
        .select('order_id, status, gateway_reference')
        .in(
          'order_id',
          evidenceCandidates.map((order) => order.id)
        );
      if (transactionError) {
        transactionEvidenceLookupFailed = true;
        logger.warn({
          message:
            'Stuck-BNPL scan could not check transaction evidence; pending/unpaid orders without notes evidence are skipped this run',
          error: transactionError,
        });
      } else {
        for (const row of (transactionRows ?? []) as Array<{
          gateway_reference: string | null;
          order_id: string;
          status: string | null;
        }>) {
          if (row.status !== 'processing' && row.status !== 'completed') {
            continue;
          }
          orderIdsWithTransactionEvidence.add(row.order_id);
          const reference = row.gateway_reference?.trim();
          if (reference && !transactionEvidenceReferences.has(row.order_id)) {
            transactionEvidenceReferences.set(row.order_id, reference);
          }
        }
      }
    }

    const orders = scannedOrders.filter(
      (order) =>
        !STATUSES_REQUIRING_PROVIDER_EVIDENCE.has(order.payment_status || '') ||
        hasProviderCheckoutEvidence(order.notes) ||
        orderIdsWithTransactionEvidence.has(order.id)
    );

    const reviewFailures = await fileStuckCreditDirectReviews(
      orders.filter((order) => order.payment_method === 'credit_direct'),
      transactionEvidenceReferences
    );

    // CredPal never progresses its transactions row past 'pending' and its
    // launcher flow writes no notes reference, so a stuck CredPal order is
    // indistinguishable from an abandoned cart. Surface the dropped set to
    // ops logs instead of paging merchants with unavoidable false positives.
    const weakEvidenceDropped = evidenceCandidates.filter(
      (order) => !orderIdsWithTransactionEvidence.has(order.id)
    );
    if (!transactionEvidenceLookupFailed && weakEvidenceDropped.length > 0) {
      logger.warn({
        message:
          'Stuck-BNPL scan dropped pending/unpaid BNPL orders without provider evidence (possible stuck CredPal)',
        droppedCount: weakEvidenceDropped.length,
        orderIds: weakEvidenceDropped.slice(0, 10).map((order) => order.id),
      });
    }

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

    const merchantEntries = Array.from(ordersByMerchant.entries());
    for (
      let index = 0;
      index < merchantEntries.length;
      index += STUCK_BNPL_CONFIG.notificationConcurrency
    ) {
      const batchResults = await Promise.all(
        merchantEntries
          .slice(index, index + STUCK_BNPL_CONFIG.notificationConcurrency)
          .map(async ([merchantId, merchantOrders]) => {
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

              return {
                merchantId,
                notified: result.sent > 0,
              };
            } catch (pushError) {
              logger.error({
                message: 'Failed to push stuck-BNPL alert',
                merchantId,
                error: pushError,
              });
              return {
                merchantId,
                notified: false,
              };
            }
          })
      );

      for (const result of batchResults) {
        if (result.notified) {
          merchantsNotified++;
        } else {
          pushFailures.push(result.merchantId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      stuckOrders: orders.length,
      merchants: ordersByMerchant.size,
      merchantsNotified,
      ...(reviewFailures.length > 0 && { reviewFailures }),
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
