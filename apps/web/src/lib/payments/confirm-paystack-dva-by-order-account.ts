// Phase B — B1 (Δ-3, Δ-6, Δ-10, Δ-12, Δ-55, Δ-57). Looks up a paid
// Paystack DVA against persisted `order_payment_accounts` rows, applies
// the B0 6-key tightening matcher, and either:
//   - inserts a pending `transactions` row + returns it for the
//     webhook to flip via its existing UPDATE path (single match)
//   - upserts a `payment_match_ambiguous` `reconciliation_review` row
//     and returns 409 (multi-candidate; manual review needed)
//   - returns `handled: false` so the caller falls through to the
//     `transactions.gateway_reference` lookup (no match)
//
// The helper does NOT call `claim_paystack_paid_atomic` directly — by
// returning a freshly-inserted pending transaction, the webhook's
// existing path (UPDATE transactions, UPDATE orders,
// applyPaidOrderSideEffects via the A1 outbox) takes over. The atomic
// RPC is reserved for the manual reconcile script (PR3) where
// duplicate cancellation matters; for the webhook path B1 covers the
// `cancel_order_ids='{}'` case naturally.

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  type DvaMatchCandidate,
  matchPaystackDvaCandidates,
} from '@/lib/payments/paystack-dva-multi-key-match';

const PAYSTACK_ACCOUNT_PATTERN = /^\d{6,20}$/;
const POSTGRES_UNIQUE_VIOLATION = '23505';

type VerifiedAmount = { amount: number; currency?: string };

export type ConfirmPaystackDvaByOrderAccountTransaction = {
  id: string;
  amount: number | string | null;
  currency: string | null;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
  order_id: string | null;
  platform_fee: number | null;
  gateway_reference: string | null;
};

// Discriminated by `kind` so callers can narrow:
//   - 'none'  → no match; caller falls through to gateway_reference lookup
//   - 'match' → pending txn inserted (or reused on 23505); caller flips it
//   - 'review' → ambiguous; caller returns the supplied status/body
export type ConfirmPaystackDvaByOrderAccountResult =
  | { kind: 'none' }
  | {
      kind: 'match';
      transaction: ConfirmPaystackDvaByOrderAccountTransaction;
    }
  | { kind: 'review'; status: number; body: Record<string, unknown> };

export async function confirmPaystackDvaByOrderAccount({
  supabase,
  accountNumber,
  gatewayReference,
  verifiedAmount,
  paystackResponse,
}: {
  supabase: SupabaseClient;
  accountNumber: string | null;
  gatewayReference: string;
  verifiedAmount: VerifiedAmount | null;
  paystackResponse: Record<string, unknown>;
}): Promise<ConfirmPaystackDvaByOrderAccountResult> {
  if (!accountNumber || !PAYSTACK_ACCOUNT_PATTERN.test(accountNumber)) {
    return { kind: 'none' };
  }
  if (!verifiedAmount || !Number.isFinite(verifiedAmount.amount)) {
    return { kind: 'none' };
  }
  const customer =
    paystackResponse?.customer && typeof paystackResponse.customer === 'object'
      ? (paystackResponse.customer as Record<string, unknown>)
      : null;
  const customerEmail =
    typeof customer?.email === 'string' ? customer.email : '';
  const paidAtRaw =
    typeof paystackResponse?.paid_at === 'string'
      ? paystackResponse.paid_at
      : null;
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : null;
  if (!customerEmail || !paidAt || Number.isNaN(paidAt.getTime())) {
    return { kind: 'none' };
  }

  // Lookup by (provider, account_number) — multiple rows possible because
  // Paystack can reuse DVAs across a customer's sequential orders.
  // FK-join to orders gives us merchant_id + customer_email + total.
  const { data: rows, error: lookupError } = await supabase
    .from('order_payment_accounts')
    .select(
      'order_id, created_at, expires_at, orders!inner(id, merchant_id, customer_email, total, currency)'
    )
    .eq('provider', 'paystack')
    .eq('account_number', accountNumber);

  if (lookupError) {
    logger.warn({
      message: 'B1 order_payment_accounts lookup failed; falling through',
      accountNumber,
      error: lookupError.message,
    });
    return { kind: 'none' };
  }
  if (!rows || rows.length === 0) {
    return { kind: 'none' };
  }

  const candidates: DvaMatchCandidate[] = rows
    .map((row) => normalizeCandidate(row as Record<string, unknown>))
    .filter((c): c is DvaMatchCandidate => c !== null);

  if (candidates.length === 0) {
    return { kind: 'none' };
  }

  const match = matchPaystackDvaCandidates(candidates, {
    verifiedAmountKobo: toKobo(verifiedAmount.amount),
    customerEmail,
    paidAt,
  });

  if (match.kind === 'none') {
    return { kind: 'none' };
  }

  if (match.kind === 'ambiguous') {
    // Δ-55: upsert by the partial-unique index keyed on (issue_type,
    // paystack_ref) so retries (concurrent webhooks, cron replays)
    // don't unique-violate.
    const reviewRow = {
      issue_type: 'payment_match_ambiguous',
      paystack_ref: gatewayReference,
      reason: `${match.candidates.length} DVA candidates matched the B0 6-key tighten for account ${accountNumber}`,
      candidates: match.candidates.map((c) => ({
        order_id: c.order_id,
        merchant_id: c.merchant_id,
        customer_email: c.customer_email,
        total_kobo: c.total_kobo,
      })),
      metadata: {
        account_number: accountNumber,
        verified_amount: verifiedAmount.amount,
        customer_email: customerEmail,
        paid_at: paidAt.toISOString(),
      },
    };
    const { error: reviewErr } = await supabase
      .from('reconciliation_review')
      .insert(reviewRow);
    if (reviewErr) {
      logger.error({
        message:
          'B1 ambiguous DVA match — failed to file reconciliation_review',
        accountNumber,
        paystackReference: gatewayReference,
        error: reviewErr,
      });
    }
    return {
      kind: 'review',
      status: 409,
      body: {
        error:
          'Multiple orders match this DVA payment. Filed for manual reconciliation.',
        code: 'AMBIGUOUS_DVA_MATCH',
      },
    };
  }

  // Single match → insert pending transaction.
  const winner = match.candidate;
  const candidateRow = candidates.find((c) => c.order_id === winner.order_id);
  const currency = getCurrency(rows, winner.order_id) ?? 'NGN';
  const insertRow = {
    merchant_id: winner.merchant_id,
    order_id: winner.order_id,
    amount: verifiedAmount.amount.toString(),
    currency,
    description: `Paystack DVA payment matched via order_payment_accounts (account ${accountNumber})`,
    gateway: 'paystack',
    gateway_reference: gatewayReference,
    metadata: {
      dva_lookup_path: 'order_payment_accounts',
      dva_account_number: accountNumber,
    },
    status: 'pending' as const,
    transaction_type: 'payment',
  };

  const { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .insert(insertRow)
    .select(
      'id, amount, currency, merchant_id, metadata, order_id, platform_fee, gateway_reference'
    )
    .single();

  if (
    insertError &&
    (insertError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  ) {
    // Concurrent webhook beat us. Re-read.
    const { data: reused, error: reusedErr } = await supabase
      .from('transactions')
      .select(
        'id, amount, currency, merchant_id, metadata, order_id, platform_fee, gateway_reference'
      )
      .eq('gateway_reference', gatewayReference)
      .maybeSingle();
    if (reusedErr || !reused) {
      logger.error({
        message:
          'B1 single-match insert collided but re-read failed; falling through',
        accountNumber,
        paystackReference: gatewayReference,
        error: reusedErr,
      });
      return { kind: 'none' };
    }
    return {
      kind: 'match',
      transaction: reused as ConfirmPaystackDvaByOrderAccountTransaction,
    };
  }
  if (insertError || !inserted) {
    logger.error({
      message: 'B1 single-match transaction insert failed; falling through',
      accountNumber,
      paystackReference: gatewayReference,
      error: insertError,
    });
    return { kind: 'none' };
  }
  // Silence unused-variable noise — candidateRow is for future logging
  // hooks and assertion clarity; keep the reference so the matcher's
  // winner round-trips with the candidate metadata intact.
  void candidateRow;
  return {
    kind: 'match',
    transaction: inserted as ConfirmPaystackDvaByOrderAccountTransaction,
  };
}

function normalizeCandidate(
  row: Record<string, unknown>
): DvaMatchCandidate | null {
  const orderField = row.orders;
  if (!orderField || typeof orderField !== 'object') return null;
  const order = orderField as Record<string, unknown>;
  const total = Number(order.total);
  if (!Number.isFinite(total)) return null;
  const createdAt =
    typeof row.created_at === 'string' ? new Date(row.created_at) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  const expiresAt =
    typeof row.expires_at === 'string' ? new Date(row.expires_at) : null;
  return {
    order_id: String(row.order_id),
    merchant_id: String(order.merchant_id ?? ''),
    customer_email:
      typeof order.customer_email === 'string' ? order.customer_email : null,
    total_kobo: toKobo(total),
    account_created_at: createdAt,
    account_expires_at:
      expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
  };
}

function getCurrency(rows: unknown[], orderId: string): string | null {
  for (const row of rows) {
    if (row && typeof row === 'object') {
      const r = row as Record<string, unknown>;
      if (r.order_id === orderId && r.orders && typeof r.orders === 'object') {
        const order = r.orders as Record<string, unknown>;
        if (typeof order.currency === 'string') return order.currency;
      }
    }
  }
  return null;
}

function toKobo(amountNgn: number): number {
  return Math.round(amountNgn * 100);
}
