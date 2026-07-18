import 'server-only';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const RECONCILIATION_ISSUE_TYPE = 'credit_direct_confirmation_missing';
const POSTGRES_UNIQUE_VIOLATION = '23505';
const REVIEW_FILING_CONCURRENCY = 5;

// Credit Direct completion is webhook-driven. During the July 2026 incident,
// provider payouts had no matching webhook delivery, transaction, or paid-order
// state, leaving real payments indistinguishable from abandoned checkouts.
// This helper creates only a durable operator trail: it never infers payment,
// mutates an order, or treats browser-side completion as provider truth.

interface StuckCreditDirectOrder {
  id: string;
  merchant_id: string;
  notes: string | null;
  payment_method: string | null;
  payment_status: string | null;
  total: number | string | null;
  updated_at: string;
}

const CREDIT_DIRECT_NOTE_KEYS = [
  'creditDirectSessionId',
  'creditDirectTransactionId',
  'credit_directTransactionId',
  'creditDirectSignedAt',
  'paymentRefUpdatedAt',
] as const;

function parseNotesEvidence(notes: string | null) {
  const evidence: Record<string, boolean | string> = {
    has_transaction_id_marker: Boolean(notes && /transactionid/i.test(notes)),
    parseable: false,
  };
  let parsed: Record<string, unknown> = {};

  try {
    const value = JSON.parse(notes || '{}') as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>;
      evidence.parseable = true;
    }
  } catch {
    // Keep only a marker that notes existed; arbitrary raw order notes may
    // contain unrelated customer data and do not belong in the ops queue.
  }

  for (const key of CREDIT_DIRECT_NOTE_KEYS) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim()) {
      evidence[key] = value.trim();
    }
  }

  const activeReference =
    (evidence.creditDirectTransactionId as string | undefined) ??
    (evidence.credit_directTransactionId as string | undefined) ??
    (evidence.creditDirectSessionId as string | undefined) ??
    null;

  return { activeReference, evidence };
}

async function fileStuckCreditDirectReview(
  order: StuckCreditDirectOrder,
  fallbackProviderReference: string | null = null
): Promise<boolean> {
  const { activeReference: notesReference, evidence } = parseNotesEvidence(
    order.notes
  );
  const activeReference = notesReference ?? fallbackProviderReference;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('reconciliation_review').insert({
      candidates: null,
      issue_type: RECONCILIATION_ISSUE_TYPE,
      merchant_id: order.merchant_id,
      metadata: {
        notes_evidence: evidence,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        source: 'credit_direct_stuck_cron',
        total: order.total,
        updated_at: order.updated_at,
      },
      order_id: order.id,
      paystack_ref: activeReference,
      reason:
        'Credit Direct order is awaiting authoritative provider confirmation',
      txn_id: null,
    });

    if (!error) return true;

    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      const { data: existingReview, error: lookupError } = await supabase
        .from('reconciliation_review')
        .select('id')
        .eq('issue_type', RECONCILIATION_ISSUE_TYPE)
        .eq('order_id', order.id)
        .is('resolved_at', null)
        .maybeSingle();
      if (!lookupError && existingReview) {
        logger.info({
          message:
            'credit_direct_confirmation_missing reconciliation already filed (expected retry no-op)',
          orderId: order.id,
          providerReference: activeReference,
        });
        return true;
      }

      logger.error({
        error,
        lookupError,
        message:
          'Credit Direct reconciliation insert conflicted without an existing open review for this order',
        orderId: order.id,
        providerReference: activeReference,
      });
      return false;
    }

    logger.error({
      error,
      message: 'Failed to file stuck Credit Direct reconciliation review',
      orderId: order.id,
      providerReference: activeReference,
    });
    return false;
  } catch (error) {
    logger.error({
      error,
      message:
        'Failed to file stuck Credit Direct reconciliation review (threw)',
      orderId: order.id,
      providerReference: activeReference,
    });
    return false;
  }
}

export async function fileStuckCreditDirectReviews(
  orders: StuckCreditDirectOrder[],
  fallbackProviderReferences: ReadonlyMap<string, string> = new Map()
): Promise<string[]> {
  const failures: string[] = [];

  for (
    let index = 0;
    index < orders.length;
    index += REVIEW_FILING_CONCURRENCY
  ) {
    const results = await Promise.all(
      orders
        .slice(index, index + REVIEW_FILING_CONCURRENCY)
        .map(async (order) => ({
          filed: await fileStuckCreditDirectReview(
            order,
            fallbackProviderReferences.get(order.id) ?? null
          ),
          orderId: order.id,
        }))
    );
    for (const result of results) {
      if (!result.filed) failures.push(result.orderId);
    }
  }

  return failures;
}
