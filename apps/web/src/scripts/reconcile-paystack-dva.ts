// Phase A — A2 manual reconcile script (Δ-8, Δ-11, Δ-12, Δ-13, Δ-15,
// Δ-18, Δ-23, Δ-25, Δ-28, Δ-31, Δ-66, Δ-67, Δ-86, Δ-87).
//
// "Paystack DVA confirmed paid but our DB still says pending." Args
// are validated by the Zod-backed parser in `./reconcile-paystack-dva-
// args.ts`; outbox executors live in `./reconcile-paystack-dva-
// executors.ts`. This file orchestrates: verify → atomic RPC → reload
// → outbox.
//
// Δ-31: orders whose totals don't match their `tax_basis` see
// `firs_invoice` and `loyalty_points` short-circuit to `failed,
// error='financial_totals_inconsistent'`. Replay after B3.5 backfill
// retakes the failed claims and finishes them.

import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { logger } from '@/lib/logger';
import { verifyTransaction } from '@/lib/paystack';
import {
  applyPaidOrderSideEffects,
  type ApplyPaidOrderSideEffectsResult,
  type PaidOrder,
  type PaidTransaction,
  type SideEffectStep,
} from '@/lib/payments/apply-paid-order-side-effects';
import { createServiceClient } from '@/lib/supabase/service';
import { parseReconcileArgs } from '@/scripts/reconcile-paystack-dva-args';
import {
  buildScriptExecutors,
  type MerchantDetails,
} from '@/scripts/reconcile-paystack-dva-executors';

const ACTOR = 'script:reconcile-paystack-dva';

// Δ-31 partial-failure error string (matches helper exactly per Δ-51).
// A2 treats only these failures as expected, not script-level errors.
const FINANCIAL_INCONSISTENT_ERROR = 'financial_totals_inconsistent';

export async function runReconcilePaystackDvaCli(
  argv: readonly string[]
): Promise<number> {
  const parsed = parseReconcileArgs(argv);
  if (!parsed.ok) {
    console.error(`reconcile-paystack-dva: ${parsed.error}`);
    return 1;
  }
  const args = parsed.args;

  // Δ-66: outbox + RPC are GRANTed only to service_role. Build the
  // service client at startup so every downstream call uses it.
  const supabase = createServiceClient();

  // Step 1 — external Paystack verify. Bail on mismatch; the atomic RPC
  // would happily flip the wrong transaction otherwise.
  const verify = await verifyTransaction(args.paystackReference);
  if (!verify.success) {
    console.error(
      `reconcile-paystack-dva: paystack verify failed: ${verify.error}`
    );
    return 1;
  }
  if (verify.data.status !== 'success') {
    console.error(
      `reconcile-paystack-dva: paystack reports status=${verify.data.status} (expected success)`
    );
    return 1;
  }
  if (verify.data.currency !== 'NGN') {
    console.error(
      `reconcile-paystack-dva: paystack currency=${verify.data.currency} (expected NGN)`
    );
    return 1;
  }

  // Step 2 — load the on-record transaction so we can sanity-check the
  // Paystack-verified amount before mutating anything.
  const { data: txnRow, error: txnErr } = await supabase
    .from('transactions')
    .select(
      'id, order_id, merchant_id, amount, currency, gateway_reference, platform_fee, status, metadata'
    )
    .eq('id', args.transactionId)
    .single();
  if (txnErr || !txnRow) {
    console.error(
      `reconcile-paystack-dva: transaction lookup failed: ${txnErr?.message ?? 'no row'}`
    );
    return 1;
  }
  const onRecordAmount = Number((txnRow as { amount: unknown }).amount);
  // Paystack returns kobo on /transaction/verify; convert to NGN.
  const verifiedAmountNgn = verify.data.amount / 100;
  if (
    !Number.isFinite(onRecordAmount) ||
    Math.abs(verifiedAmountNgn - onRecordAmount) > 0.01
  ) {
    console.error(
      `reconcile-paystack-dva: amount mismatch — paystack ₦${verifiedAmountNgn} vs txn ₦${onRecordAmount}`
    );
    return 1;
  }

  // Step 3 — atomic claim. Single PL/pgSQL call so the txn flip + order
  // flip + duplicate cancellations happen under one DB transaction.
  const rpcResult = await supabase.rpc('claim_paystack_paid_atomic', {
    p_transaction_id: args.transactionId,
    p_paystack_reference: args.paystackReference,
    // Δ-59: plain TS object; PostgREST converts to jsonb at the wire.
    p_gateway_response: verify.data as unknown as Record<string, unknown>,
    p_canonical_order_id: args.canonicalOrderId,
    p_operator_user_id: args.operatorUserId,
    p_cancel_order_ids: args.cancelOrders,
    p_operator_label: ACTOR,
  });
  if (rpcResult.error) {
    console.error(
      `reconcile-paystack-dva: claim_paystack_paid_atomic raised: ${rpcResult.error.message}`
    );
    return 1;
  }
  const rpcReport = rpcResult.data as Record<string, unknown> | null;
  console.log(
    JSON.stringify(
      { stage: 'claim_paystack_paid_atomic', report: rpcReport },
      null,
      2
    )
  );

  // Step 4 — load the freshly-paid order with the rich shape the
  // executors need (customer fields, shipping_address, order_items).
  const { data: paidTxnRow, error: paidTxnErr } = await supabase
    .from('transactions')
    .select(
      'id, order_id, merchant_id, gateway_reference, amount, platform_fee'
    )
    .eq('id', args.transactionId)
    .single();
  if (paidTxnErr || !paidTxnRow) {
    console.error(
      `reconcile-paystack-dva: post-RPC txn lookup failed: ${paidTxnErr?.message ?? 'no row'}`
    );
    return 1;
  }

  const { data: orderRow, error: orderErr } = await supabase
    .from('orders')
    .select(
      'id, merchant_id, payment_status, tax_basis, subtotal, shipping_fee, gift_wrapping_fee, tax_amount, discount_amount, total, order_number, customer_id, customer_name, customer_email, customer_phone, currency, shipping_address, order_items(id, product_id, name, price, quantity, subtotal, variant_name)'
    )
    .eq('id', args.canonicalOrderId)
    .single();
  if (orderErr || !orderRow) {
    console.error(
      `reconcile-paystack-dva: post-RPC order lookup failed: ${orderErr?.message ?? 'no row'}`
    );
    return 1;
  }

  const richOrder = orderRow as Record<string, unknown>;
  const order = normalizePaidOrder(richOrder);
  const transaction = normalizePaidTransaction(
    paidTxnRow as Record<string, unknown>
  );

  const { data: merchantDetails, error: merchantErr } = await supabase
    .from('merchants')
    .select(
      'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
    )
    .eq('id', order.merchant_id)
    .single();
  // Non-PGRST116 errors are transient; PGRST116 (genuinely missing) is
  // permanently un-emailable but the other side effects can still run.
  const merchantFetchError =
    merchantErr && (merchantErr as { code?: string }).code !== 'PGRST116'
      ? merchantErr
      : null;

  const rawPlatformFee = (paidTxnRow as { platform_fee: unknown })
    .platform_fee;

  const executors = buildScriptExecutors({
    supabase,
    richOrder,
    order,
    transaction,
    paystackReference: args.paystackReference,
    merchantDetails: merchantDetails as MerchantDetails | null,
    merchantFetchError,
    rawPlatformFee,
    actor: ACTOR,
  });

  const sideEffectsResult = await applyPaidOrderSideEffects({
    supabase,
    order,
    transaction,
    gatewayResponse: verify.data as unknown as Record<string, unknown>,
    actor: ACTOR,
    executors,
  });

  console.log(
    JSON.stringify(
      { stage: 'apply_paid_order_side_effects', result: sideEffectsResult },
      null,
      2
    )
  );

  return computeExitCode(sideEffectsResult);
}

// firs_invoice + loyalty_points are wired in B3.5; in Phase A their
// failures are EXPECTED, not script-level errors. The Δ-31 consistency
// gate marks them `failed='financial_totals_inconsistent'` for orders
// like Efosa's; consistent orders get `failed='wired_in_b3_5'` from the
// stub. Either way, replay after B3.5 ships picks them up.
const PHASE_A_PENDING_STEPS: ReadonlySet<SideEffectStep> = new Set([
  'firs_invoice',
  'loyalty_points',
]);

function computeExitCode(result: ApplyPaidOrderSideEffectsResult): number {
  const blockingFailures = result.failedSteps.filter(
    (f) =>
      !(
        PHASE_A_PENDING_STEPS.has(f.step) ||
        f.error === FINANCIAL_INCONSISTENT_ERROR
      )
  );
  return blockingFailures.length > 0 ? 1 : 0;
}

function normalizePaidOrder(row: Record<string, unknown>): PaidOrder {
  const taxBasisRaw = row.tax_basis;
  const taxBasis: 'exclusive' | 'inclusive' | null =
    taxBasisRaw === 'exclusive' || taxBasisRaw === 'inclusive'
      ? taxBasisRaw
      : null;
  return {
    id: String(row.id),
    merchant_id: String(row.merchant_id),
    payment_status: String(row.payment_status),
    tax_basis: taxBasis,
    subtotal: Number(row.subtotal) || 0,
    shipping_fee: Number(row.shipping_fee) || 0,
    gift_wrapping_fee: Number(row.gift_wrapping_fee) || 0,
    tax_amount: Number(row.tax_amount) || 0,
    discount_amount: Number(row.discount_amount) || 0,
    total: Number(row.total) || 0,
  };
}

function normalizePaidTransaction(
  row: Record<string, unknown>
): PaidTransaction {
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    merchant_id: String(row.merchant_id),
    gateway_reference:
      typeof row.gateway_reference === 'string' ? row.gateway_reference : null,
    amount:
      typeof row.amount === 'number' || typeof row.amount === 'string'
        ? row.amount
        : null,
  };
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runReconcilePaystackDvaCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      logger.error({
        message: 'reconcile-paystack-dva: unhandled error',
        error: err instanceof Error ? err.message : String(err),
      });
      process.exitCode = 1;
    });
}
