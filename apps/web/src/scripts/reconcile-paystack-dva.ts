// Phase A — A2 manual reconcile script (Δ-8, Δ-11, Δ-12, Δ-13, Δ-15,
// Δ-18, Δ-23, Δ-25, Δ-28, Δ-31, Δ-66, Δ-67).
//
// "Paystack DVA confirmed paid but our DB still says pending." Operator
// runs:
//
//   pnpm tsx apps/web/src/scripts/reconcile-paystack-dva.ts \
//     --transaction-id <txn> \
//     --paystack-reference <ref> \
//     --canonical-order-id <order> \
//     --cancel-orders <comma,sep,duplicate-order-ids> \
//     --operator-user-id <auth.users.id>
//
// The script:
//   1. Verifies the payment with Paystack (bails on amount/status mismatch).
//   2. Calls `claim_paystack_paid_atomic` — atomically flips the canonical
//      transaction + order to paid AND cancels duplicate orders/txns.
//   3. Reads the freshly-paid order/transaction + merchant details.
//   4. Calls `applyPaidOrderSideEffects` from PR2 with executors that
//      mirror the production webhook: email, ad-tracking, settlement,
//      plus stubs for firs_invoice + loyalty_points (B3.5 will wire the
//      real integrations).
//
// Δ-31: orders whose totals don't match their `tax_basis` will see
// `firs_invoice` and `loyalty_points` short-circuit to `failed,
// error='financial_totals_inconsistent'`. Replay after B3.5 backfill
// retakes the failed claims and finishes them.

import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { calculatePlatformFee, verifyTransaction } from '@/lib/paystack';
import {
  applyPaidOrderSideEffects,
  type ApplyPaidOrderSideEffectsResult,
  type PaidOrder,
  type PaidTransaction,
  type SideEffectStep,
  type StepExecutor,
} from '@/lib/payments/apply-paid-order-side-effects';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';
import { createServiceClient } from '@/lib/supabase/service';
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';
import { sendEmail } from '@/lib/zeptomail';

const ACTOR = 'script:reconcile-paystack-dva';

// Δ-31 partial-failure error string (matches helper exactly per Δ-51).
// A2 treats only these failures as expected, not script-level errors.
const FINANCIAL_INCONSISTENT_ERROR = 'financial_totals_inconsistent';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ParsedArgs = {
  transactionId: string;
  paystackReference: string;
  canonicalOrderId: string;
  cancelOrders: string[];
  operatorUserId: string;
};

type ParseResult =
  | { ok: true; args: ParsedArgs }
  | { ok: false; error: string };

export function parseReconcileArgs(argv: readonly string[]): ParseResult {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!(key && key.startsWith('--')) || value === undefined) {
      return { ok: false, error: `malformed flag near "${key ?? '<end>'}"` };
    }
    map.set(key, value);
  }

  const required = [
    '--transaction-id',
    '--paystack-reference',
    '--canonical-order-id',
    '--cancel-orders',
    '--operator-user-id',
  ];
  for (const flag of required) {
    if (!map.has(flag)) {
      return { ok: false, error: `missing required flag: ${flag}` };
    }
  }

  const transactionId = map.get('--transaction-id') ?? '';
  const canonicalOrderId = map.get('--canonical-order-id') ?? '';
  const operatorUserId = map.get('--operator-user-id') ?? '';
  const paystackReference = map.get('--paystack-reference') ?? '';
  const cancelRaw = map.get('--cancel-orders') ?? '';

  if (!UUID_RE.test(transactionId)) {
    return { ok: false, error: '--transaction-id is not a UUID' };
  }
  if (!UUID_RE.test(canonicalOrderId)) {
    return { ok: false, error: '--canonical-order-id is not a UUID' };
  }
  if (!UUID_RE.test(operatorUserId)) {
    return { ok: false, error: '--operator-user-id is not a UUID' };
  }
  if (!paystackReference) {
    return { ok: false, error: '--paystack-reference is empty' };
  }

  const cancelOrders = cancelRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const id of cancelOrders) {
    if (!UUID_RE.test(id)) {
      return { ok: false, error: `--cancel-orders entry is not a UUID: ${id}` };
    }
  }

  return {
    ok: true,
    args: {
      transactionId,
      paystackReference,
      canonicalOrderId,
      cancelOrders,
      operatorUserId,
    },
  };
}

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

type MerchantDetails = {
  business_name: string | null;
  slug: string | null;
  support_email: string | null;
  email_sender_name: string | null;
  email: string | null;
  tax_identification_number: string | null;
  cac_rc_number: string | null;
};

type ServiceRoleClient = ReturnType<typeof createServiceClient>;

function buildScriptExecutors(args: {
  supabase: ServiceRoleClient;
  richOrder: Record<string, unknown>;
  order: PaidOrder;
  transaction: PaidTransaction;
  paystackReference: string;
  merchantDetails: MerchantDetails | null;
  merchantFetchError: unknown;
  rawPlatformFee: unknown;
}): Partial<Record<SideEffectStep, StepExecutor>> {
  const {
    supabase,
    richOrder,
    order,
    transaction,
    paystackReference,
    merchantDetails,
    merchantFetchError,
    rawPlatformFee,
  } = args;

  // Mirror the production webhook executors at apps/web/src/app/api/
  // payments/webhook/route.ts:1677-1834. Future cleanup PR may extract
  // them into a shared module; for now duplication is contained and the
  // script is a CLI tool with limited blast radius.

  const paidEmailExecutor: StepExecutor = async () => {
    if (merchantFetchError) {
      throw new Error(
        `merchant_fetch_error: ${(merchantFetchError as { message?: string })?.message ?? 'unknown'}`
      );
    }
    if (!(merchantDetails && richOrder.customer_email)) {
      return { skipped: 'missing_merchant_or_customer_email' };
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;
    const orderItems = Array.isArray(richOrder.order_items)
      ? (richOrder.order_items as Array<Record<string, unknown>>)
      : [];
    const emailItems = orderItems.map((item) => ({
      name:
        typeof item.variant_name === 'string' &&
        item.variant_name.trim().length > 0
          ? `${(item.name as string) || 'Product'} (${item.variant_name})`
          : (item.name as string) || 'Product',
      quantity: (item.quantity as number) || 1,
      price: (item.price as number) || 0,
    }));

    const emailData = {
      orderNumber:
        (richOrder.order_number as string) ||
        order.id.slice(0, 8).toUpperCase(),
      customerName: richOrder.customer_name as string,
      items: emailItems,
      subtotal: order.subtotal,
      shippingFee: order.shipping_fee,
      total: order.total,
      shippingAddress: {
        address:
          ((richOrder.shipping_address as Record<string, unknown>)
            ?.address as string) || '',
        city:
          ((richOrder.shipping_address as Record<string, unknown>)
            ?.city as string) || '',
        state:
          ((richOrder.shipping_address as Record<string, unknown>)
            ?.state as string) || '',
        phone: (richOrder.customer_phone as string) || '',
      },
      merchantName: merchantDetails.business_name ?? '',
      merchantUrl,
      merchantTin: merchantDetails.tax_identification_number ?? undefined,
      merchantRcNumber: merchantDetails.cac_rc_number ?? undefined,
    };

    const htmlContent = generateOrderConfirmationEmail(emailData);
    const textContent = generateOrderConfirmationText(emailData);
    const replyToEmail =
      merchantDetails.support_email ||
      merchantDetails.email ||
      `support@${merchantDetails.slug}.${rootDomain}`;
    const senderName = merchantDetails.email_sender_name
      ? `${merchantDetails.email_sender_name} Orders`
      : merchantDetails.business_name
        ? `${merchantDetails.business_name} Orders`
        : undefined;

    const result = await sendEmail({
      to: richOrder.customer_email as string,
      toName: richOrder.customer_name as string | undefined,
      subject: `Order Confirmation - #${emailData.orderNumber}`,
      htmlContent,
      textContent,
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
      // Δ-61: ZeptoMail has no Idempotency-Key. The payment_side_effects
      // claim row is the dedup record; client_reference gives a
      // server-side audit trail showing which sends actually went out.
      clientReference: `order:${order.id}:paid_email`,
      auditContext: {
        merchantId: order.merchant_id,
        orderId: order.id,
        customerId: (richOrder.customer_id as string) ?? null,
        metadata: { trigger: ACTOR },
      },
    });
    if (!result.success) {
      throw new Error(result.error || result.errorCode || 'email_failed');
    }
    return { messageId: result.messageId };
  };

  const adTrackingExecutor: StepExecutor = async () => {
    // triggerPurchaseConversion swallows individual platform errors and
    // logs them; absence of throw = success for outbox bookkeeping.
    await triggerPurchaseConversion(
      supabase,
      order.merchant_id,
      richOrder as never
    );
    return {};
  };

  const settlementExecutor: StepExecutor = async (ctx) => {
    const grossAmount = Number(transaction.amount) || 0;
    // Δ-0b: source the gateway fee from the verified Paystack response
    // (passed via StepContext.gatewayResponse).
    const gatewayFee = extractVerifiedGatewayFeeNgn(
      'paystack',
      ctx.gatewayResponse
    );
    const platformFee =
      Number(rawPlatformFee) ||
      calculatePlatformFee(grossAmount * 100).platformFee / 100;

    const { error: settlementError } = await supabase.rpc(
      'record_merchant_settlement',
      {
        p_merchant_id: order.merchant_id,
        p_source_type: 'order',
        p_source_id: order.id,
        p_gateway: 'paystack',
        // Δ-22: settlement key is our BAC-*; Paystack ref → metadata only.
        p_gateway_reference:
          transaction.gateway_reference ?? paystackReference,
        p_gross_amount: grossAmount,
        p_gateway_fee: gatewayFee,
        p_platform_fee: platformFee,
        p_description: 'Order payment via paystack (manual reconcile)',
        p_metadata: {
          paystack_reference: paystackReference,
          verified_gateway_fee: gatewayFee,
          reconciled_by: ACTOR,
        },
      }
    );
    if (settlementError) {
      throw new Error(settlementError.message);
    }
    return {
      gross_amount: grossAmount,
      gateway_fee: gatewayFee,
      platform_fee: platformFee,
    };
  };

  // Stub for steps that B3.5 wires for real. The Δ-31 consistency gate
  // short-circuits these BEFORE the executor runs for inconsistent
  // orders (Efosa); for consistent orders the stub throws and the row
  // gets `failed='wired_in_b3_5'` — replayable when the integrations
  // ship in B3.5.
  const stubExecutor: StepExecutor = () => {
    throw new Error('wired_in_b3_5');
  };

  return {
    paid_email: paidEmailExecutor,
    firs_invoice: stubExecutor,
    loyalty_points: stubExecutor,
    ad_tracking_conversion: adTrackingExecutor,
    merchant_settlement: settlementExecutor,
  };
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
