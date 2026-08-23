import 'dotenv/config';

import { verifyTransaction } from '@/lib/paystack';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';
import { calculatePlatformFee } from '@/lib/paystack';
import { createServiceClient } from '@/lib/supabase/service';
import { parseReconcilePaystackUnmatchedPartialArgs } from '@/scripts/reconcile-paystack-unmatched-partial-args';

const ACTOR = 'script:reconcile-paystack-unmatched-partial';
const EMAIL_MISMATCH_OVERRIDE_ACTOR =
  'script:reconcile-paystack-unmatched-partial:email-mismatch-override';

export async function runReconcilePaystackUnmatchedPartialCli(
  argv: readonly string[]
): Promise<number> {
  const parsed = parseReconcilePaystackUnmatchedPartialArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const { args } = parsed;
  let verified: Awaited<ReturnType<typeof verifyTransaction>>;
  try {
    verified = await verifyTransaction(args.paystackReference);
  } catch (error: unknown) {
    console.error('Paystack verification failed', error);
    return 1;
  }
  if (!verified.success || verified.data.status !== 'success') {
    console.error('Paystack verification did not return a successful payment');
    return 1;
  }
  if (verified.data.currency !== 'NGN') {
    console.error('Only NGN Paystack payments are supported');
    return 1;
  }

  const amountNgn = verified.data.amount / 100;
  const fees = calculatePlatformFee(verified.data.amount);
  const gatewayFee = extractVerifiedGatewayFeeNgn('paystack', verified.data);
  const customer =
    verified.data.customer && typeof verified.data.customer === 'object'
      ? verified.data.customer
      : null;
  const customerEmail =
    customer && typeof customer.email === 'string' ? customer.email : '';
  const customerName =
    customer && typeof customer.first_name === 'string'
      ? [customer.first_name, customer.last_name]
          .filter((part) => typeof part === 'string' && part.length > 0)
          .join(' ')
      : customerEmail;

  if (!customerEmail || !Number.isFinite(amountNgn) || amountNgn <= 0) {
    console.error('Verified Paystack response is missing a valid amount or customer');
    return 1;
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (error: unknown) {
    console.error('Payment service unavailable', error);
    return 1;
  }
  let data: Awaited<ReturnType<typeof supabase.rpc>>['data'];
  let error: Awaited<ReturnType<typeof supabase.rpc>>['error'];
  try { ({ data, error } = await supabase.rpc(
    'reconcile_paystack_unmatched_partial_payment',
    {
      p_actor: args.allowEmailMismatch ? EMAIL_MISMATCH_OVERRIDE_ACTOR : ACTOR,
      p_allow_email_mismatch: args.allowEmailMismatch,
      p_amount: amountNgn,
      p_currency: 'NGN',
      p_customer_email: customerEmail,
      p_customer_name: customerName,
      p_gateway_fee: gatewayFee,
      p_gateway_response: verified.data,
      p_merchant_amount: fees.merchantAmount / 100,
      p_merchant_id: args.merchantId,
      p_operator_user_id: args.operatorUserId,
      p_order_id: args.canonicalOrderId,
      p_paystack_reference: args.paystackReference,
      p_platform_fee: fees.platformFee / 100,
      p_review_id: args.reviewId,
    }
  )); } catch (error: unknown) {
    console.error('Manual Paystack partial reconciliation failed', error);
    return 1;
  }
  if (error || !data) {
    console.error(error?.message ?? 'Manual Paystack partial reconciliation failed');
    return 1;
  }

  console.log(JSON.stringify({ stage: 'manual_paystack_partial_reconcile', report: data }, null, 2));
  return 0;
}

if (process.argv[1]?.endsWith('reconcile-paystack-unmatched-partial.ts')) {
  process.exitCode = await runReconcilePaystackUnmatchedPartialCli(
    process.argv.slice(2)
  );
}
