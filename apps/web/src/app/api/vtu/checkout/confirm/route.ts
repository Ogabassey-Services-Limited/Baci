import { after, type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  type PaystackAuthorization,
  upsertPaystackAuthorization,
} from '@/lib/customer-saved-payment-methods';
import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import {
  getPaystackRequestedAmountNgn,
  verifyTransaction as verifyPaystackTransaction,
} from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';
import {
  extractMetadataField,
  isString,
  normalizeMetadata,
  scheduleVoucherPinBackfill,
} from '@/lib/vtu-voucher-backfill';
import { withMerchantSlugAliasFallback } from '@/lib/with-merchant-slug-alias-fallback';
import { vtuCheckoutConfirmSchema } from '@/schemas/vtu';

function getVerifiedAmount(
  gateway: 'paystack' | 'korapay',
  payload: Record<string, unknown>
) {
  if (gateway === 'paystack') {
    return getPaystackRequestedAmountNgn(payload);
  }

  const rawAmount = payload.amount;
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) {
    return null;
  }

  return rawAmount;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const body = await request.json();
    const parsed = vtuCheckoutConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    // Alias-aware: a stale tab on a just-renamed store POSTs the retired slug in
    // the body (the proxy can't rewrite bodies), so resolve it to the current slug.
    const { data: merchant, error: merchantError } =
      await withMerchantSlugAliasFallback(parsed.data.merchantSlug, (s) =>
        supabase.from('merchants').select('id').eq('slug', s).maybeSingle()
      );

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const customer = await resolveVtuCustomer({
      supabase,
      merchantId: merchant.id,
      user: auth.user,
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('id, amount, currency, status, metadata, merchant_id')
      .eq('gateway_reference', parsed.data.reference)
      .maybeSingle();

    if (transactionError || !transaction) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (transaction.merchant_id !== merchant.id) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const metadata = (transaction.metadata ?? {}) as Record<string, unknown>;
    if (metadata.transaction_type !== 'vtu_purchase') {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (metadata.customer_id !== customer.id) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    let verification:
      | { success: true; data: Record<string, unknown> }
      | { success: false; error: string };

    if (parsed.data.gateway === 'paystack') {
      const result = await verifyPaystackTransaction(parsed.data.reference);
      verification = result.success
        ? {
            success: true,
            data: result.data as unknown as Record<string, unknown>,
          }
        : { success: false, error: result.error };
    } else {
      const result = await verifyKorapayPayment(parsed.data.reference);
      verification = result.success
        ? {
            success: true,
            data: result.data as unknown as Record<string, unknown>,
          }
        : { success: false, error: result.error };
    }

    if (!verification.success) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const verifiedAmount = getVerifiedAmount(
      parsed.data.gateway,
      verification.data
    );
    if (verifiedAmount == null) {
      return NextResponse.json(
        { error: 'Payment amount could not be verified' },
        { status: 400 }
      );
    }
    if (Math.abs(verifiedAmount - Number(transaction.amount)) > 0.01) {
      return NextResponse.json(
        { error: 'Payment amount mismatch' },
        { status: 400 }
      );
    }

    const paymentStatus =
      typeof verification.data.status === 'string'
        ? verification.data.status
        : '';
    if (paymentStatus !== 'success') {
      return NextResponse.json(
        { error: 'Payment is not yet successful', status: paymentStatus },
        { status: 409 }
      );
    }

    if (transaction.status !== 'completed') {
      const { data: claimed, error: claimError } = await supabase
        .from('transactions')
        .update({
          gateway_response: verification.data,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)
        .neq('status', 'completed')
        .select('id')
        .maybeSingle();

      if (claimError) {
        console.error('Failed to claim transaction for VTU confirm', {
          transactionId: transaction.id,
          error: claimError.message,
        });
        return NextResponse.json(
          { error: 'Failed to process payment' },
          { status: 500 }
        );
      }

      if (!claimed) {
        // Another process already completed or claimed this payment between
        // the read and update. Continue to fulfillment so the client receives
        // the VTU status shape it already understands.
        console.debug('VTU confirm transaction was already claimed', {
          gateway: parsed.data.gateway,
          paymentId: transaction.id,
          reference: parsed.data.reference,
        });
      }
    }

    const customerId =
      typeof metadata.customer_id === 'string' ? metadata.customer_id : null;
    const customerEmail =
      typeof metadata.customer_email === 'string'
        ? metadata.customer_email
        : (auth.user.email ?? null);

    const authorization = verification.data.authorization as
      | PaystackAuthorization
      | null
      | undefined;

    if (
      parsed.data.gateway === 'paystack' &&
      customerId &&
      customerEmail &&
      authorization
    ) {
      await upsertPaystackAuthorization({
        supabase,
        merchantId: transaction.merchant_id,
        customerId,
        customerEmail,
        authorization,
      });
    }

    const vtuTransactionId =
      typeof metadata.vtu_transaction_id === 'string'
        ? metadata.vtu_transaction_id
        : null;
    if (!vtuTransactionId) {
      return NextResponse.json(
        { error: 'VTU transaction not found' },
        { status: 404 }
      );
    }

    const fulfillment = await fulfillPendingVtuTransaction({
      retryFailed: true,
      supabase,
      transactionId: vtuTransactionId,
    });

    if (fulfillment.status === 'failed') {
      return NextResponse.json(
        {
          error: fulfillment.error,
          reference: fulfillment.reference,
          ...(fulfillment.refundedToWallet !== undefined && {
            refundedToWallet: fulfillment.refundedToWallet,
          }),
        },
        { status: 400 }
      );
    }

    const shouldScheduleVoucherBackfill =
      fulfillment.status === 'processing' ||
      (fulfillment.status === 'successful' && !fulfillment.voucherPin);

    if (shouldScheduleVoucherBackfill) {
      after(async () => {
        try {
          const { data: vtuTx, error: vtuTxError } = await supabase
            .from('vtu_transactions')
            .select(
              'id, created_at, type, status, amount, network_provider, phone_number, biller_name, biller_item_code, customer_identifier, customer_name, request_reference, transaction_id, error_message, customer_cashback, metadata'
            )
            .eq('id', vtuTransactionId)
            .single();

          if (vtuTx && !vtuTxError) {
            const metadata = normalizeMetadata(vtuTx.metadata);
            const voucherPin = extractMetadataField(
              metadata,
              'voucherPin',
              isString
            );
            await scheduleVoucherPinBackfill({
              metadata,
              originalMetadata: vtuTx.metadata,
              supabase,
              transaction: vtuTx,
              voucherPin,
            });
          }
        } catch (err) {
          console.error(
            'Failed to trigger background backfill in confirm/route.ts:',
            err
          );
        }
      });
    }

    if (fulfillment.status === 'processing') {
      return NextResponse.json(
        { reference: fulfillment.reference, status: 'processing' },
        { status: 202 }
      );
    }

    return NextResponse.json({
      amount: fulfillment.amount,
      cashback: fulfillment.cashback,
      customerIdentifier: fulfillment.customerIdentifier,
      ...(fulfillment.loyaltyPoints && {
        loyaltyPoints: fulfillment.loyaltyPoints,
      }),
      reference: fulfillment.reference,
      status: 'successful',
      success: true,
      ...(fulfillment.voucherPin && { voucherPin: fulfillment.voucherPin }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to confirm utility payment',
      },
      { status: 500 }
    );
  }
}
