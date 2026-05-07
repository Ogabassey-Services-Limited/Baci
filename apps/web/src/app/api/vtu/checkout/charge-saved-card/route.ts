import { customAlphabet } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getSavedPaymentMethodById,
  type PaystackAuthorization,
  upsertPaystackAuthorization,
} from '@/lib/customer-saved-payment-methods';
import {
  type ChargeAuthorizationResponse,
  chargeAuthorization,
} from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';
import { preparePendingVtuTransaction } from '@/lib/vtu-pending-transaction';
import { vtuSavedCardChargeSchema } from '@/schemas/vtu';

function savedCardProcessingResponse(
  paymentReference: string,
  extras: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      gateway: 'paystack',
      reference: paymentReference,
      status: 'processing',
      ...extras,
    },
    { status: 202 }
  );
}

function getSavedCardPaymentFailureMessage(
  chargeData: ChargeAuthorizationResponse
) {
  return (
    chargeData.gateway_response ||
    chargeData.message ||
    'Saved card charge failed'
  );
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
    const parsed = vtuSavedCardChargeSchema.safeParse({
      ...body,
      source: 'checkout',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.gateway !== 'paystack') {
      return NextResponse.json(
        { error: 'Saved cards are only available for Paystack.' },
        { status: 400 }
      );
    }

    const walletAmount = parsed.data.walletAmount ?? 0;
    if (walletAmount === parsed.data.amount && walletAmount > 0) {
      return NextResponse.json(
        {
          error: 'wallet-only payments must use /api/vtu/checkout/wallet-only.',
        },
        { status: 400 }
      );
    }
    const residualAmount = parsed.data.amount - walletAmount;
    const supabase = createAdminClient();
    const prepared = await preparePendingVtuTransaction({
      supabase,
      user: auth.user,
      input: parsed.data,
      source: 'checkout',
      requireCustomer: true,
    });
    const customer = prepared.customer;
    if (!customer?.id) {
      return NextResponse.json(
        { error: 'Customer account not found for this storefront' },
        { status: 404 }
      );
    }
    const savedCard = await getSavedPaymentMethodById({
      supabase,
      merchantId: prepared.merchant.id,
      customerId: customer.id,
      savedPaymentMethodId: parsed.data.savedPaymentMethodId,
    });

    if (!savedCard) {
      return NextResponse.json(
        { error: 'Saved card not found' },
        { status: 404 }
      );
    }

    const nanoidUppercase = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      12
    );
    const paymentReference = `VTU-${nanoidUppercase()}`;
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const callbackUrl = `${protocol}://${prepared.merchant.slug}.${rootDomain}/checkout/success?reference=${paymentReference}&kind=vtu`;
    const cancelUrl = `${protocol}://${prepared.merchant.slug}.${rootDomain}/checkout/cancelled?reference=${paymentReference}&kind=vtu`;
    const customerName =
      parsed.data.customerName ||
      [customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      auth.user.email ||
      'Customer';
    const customerEmail =
      savedCard.provider_customer_email || customer.email || auth.user.email;

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    const metadata = {
      cancel_action: cancelUrl,
      customer_email: customerEmail,
      customer_id: customer.id,
      customer_name: customerName,
      merchant_slug: prepared.merchant.slug,
      transaction_type: 'vtu_purchase',
      vtu_transaction_id: prepared.transaction.id,
      vtu_type: prepared.transaction.type,
    };
    const { error: txInsertError } = await supabase
      .from('transactions')
      .insert({
        merchant_id: prepared.merchant.id,
        order_id: null,
        transaction_type: 'payment',
        amount: residualAmount,
        currency: 'NGN',
        status: 'pending',
        gateway: 'paystack',
        gateway_reference: paymentReference,
        description: `VTU checkout for ${prepared.transaction.type}`,
        metadata,
        platform_fee: 0,
        merchant_amount: 0,
      });
    if (txInsertError) {
      console.error('Failed to create transaction before charging saved card', {
        error: txInsertError.message,
        vtuTransactionId: prepared.transaction.id,
      });
      await supabase
        .from('vtu_transactions')
        .update({
          status: 'failed',
          error_message: 'Payment record creation failed',
        })
        .eq('id', prepared.transaction.id);
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      );
    }
    const chargeResult = await chargeAuthorization({
      amount: Math.round(residualAmount * 100),
      authorization_code: savedCard.authorization_code,
      callback_url: callbackUrl,
      email: customerEmail,
      metadata,
      reference: paymentReference,
    });

    if (!chargeResult.success) {
      return NextResponse.json({ error: chargeResult.error }, { status: 400 });
    }

    await supabase
      .from('transactions')
      .update({
        gateway_response: chargeResult.data,
        status:
          chargeResult.data.status === 'success'
            ? 'completed'
            : chargeResult.data.status === 'pending'
              ? 'pending'
              : 'failed',
      })
      .eq('gateway_reference', paymentReference);

    const authorization = chargeResult.data.authorization as
      | PaystackAuthorization
      | null
      | undefined;
    if (authorization) {
      await upsertPaystackAuthorization({
        supabase,
        merchantId: prepared.merchant.id,
        customerId: customer.id,
        customerEmail,
        authorization,
      });
    }
    if (chargeResult.data.paused && chargeResult.data.authorization_url) {
      return NextResponse.json({
        authorization_url: chargeResult.data.authorization_url,
        gateway: 'paystack',
        reference: paymentReference,
        requires_authorization: true,
        success: true,
      });
    }

    if (chargeResult.data.status === 'pending') {
      return savedCardProcessingResponse(paymentReference);
    }
    if (chargeResult.data.status !== 'success') {
      const failureMessage = getSavedCardPaymentFailureMessage(
        chargeResult.data
      );
      await supabase
        .from('vtu_transactions')
        .update({
          error_message: failureMessage,
          status: 'failed',
        })
        .eq('id', prepared.transaction.id);
      return NextResponse.json(
        {
          error: failureMessage,
        },
        { status: 400 }
      );
    }
    let fulfillment: Awaited<ReturnType<typeof fulfillPendingVtuTransaction>>;
    try {
      fulfillment = await fulfillPendingVtuTransaction({
        supabase,
        transactionId: prepared.transaction.id,
      });
    } catch (error) {
      console.error('Saved-card VTU fulfillment failed after charge', {
        error: error instanceof Error ? error.message : String(error),
        paymentReference,
        vtuTransactionId: prepared.transaction.id,
      });
      return savedCardProcessingResponse(paymentReference);
    }
    if (fulfillment.status === 'failed') {
      console.warn('Saved-card VTU fulfillment returned failed after charge', {
        paymentReference,
        providerReference: fulfillment.reference,
        refundedToWallet: fulfillment.refundedToWallet,
        vtuTransactionId: prepared.transaction.id,
      });
      return savedCardProcessingResponse(paymentReference, {
        mayRequireManualCheck: true,
        message:
          'Payment was charged, but fulfillment needs review. Check transaction history for final status.',
        providerReference: fulfillment.reference,
        ...(fulfillment.refundedToWallet !== undefined && {
          refundedToWallet: fulfillment.refundedToWallet,
        }),
      });
    }

    if (fulfillment.status === 'processing') {
      return savedCardProcessingResponse(paymentReference);
    }

    return NextResponse.json({
      amount: fulfillment.amount,
      cashback: fulfillment.cashback,
      customerIdentifier: fulfillment.customerIdentifier,
      reference: fulfillment.reference,
      status: 'successful',
      success: true,
      ...(fulfillment.voucherPin != null
        ? { voucherPin: fulfillment.voucherPin }
        : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to charge saved card',
      },
      { status: 500 }
    );
  }
}
