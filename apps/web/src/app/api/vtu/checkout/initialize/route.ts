import { customAlphabet } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { initializePayment as initializeKorapayPayment } from '@/lib/korapay';
import { initializeTransaction as initializePaystackTransaction } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { preparePendingVtuTransaction } from '@/lib/vtu-pending-transaction';
import { vtuCheckoutInitializeSchema } from '@/schemas/vtu';

function createErrorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return createErrorResponse(auth.error || 'Unauthorized', 401);
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return csrfResponse ?? createErrorResponse('CSRF validation failed', 403);
    }

    const body = await request.json();
    const parsed = vtuCheckoutInitializeSchema.safeParse({
      ...body,
      source: 'checkout',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.gateway === 'bank_transfer') {
      return createErrorResponse(
        'Bank transfer is not enabled for utility checkout yet.',
        400
      );
    }

    const supabase = createAdminClient();
    const prepared = await preparePendingVtuTransaction({
      supabase,
      user: auth.user,
      input: parsed.data,
      source: 'checkout',
      requireCustomer: true,
    });

    const customerEmail =
      prepared.customer?.email || auth.user.email || body.customerEmail;
    if (!customerEmail) {
      return createErrorResponse('Customer email is required', 400);
    }

    const customerName =
      parsed.data.customerName ||
      [prepared.customer?.first_name, prepared.customer?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      auth.user.email ||
      'Customer';
    const nanoidUppercase = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      12
    );
    const paymentReference = `VTU-${nanoidUppercase()}`;
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const callbackUrl = `${protocol}://${prepared.merchant.slug}.${rootDomain}/checkout/success?reference=${paymentReference}&kind=vtu`;
    const cancelUrl = `${protocol}://${prepared.merchant.slug}.${rootDomain}/checkout/cancelled?reference=${paymentReference}&kind=vtu`;
    const notificationUrl = `${protocol}://${rootDomain}/api/payments/webhook`;

    const metadata = {
      cancel_action: cancelUrl,
      customer_email: customerEmail,
      customer_id: prepared.customer?.id ?? null,
      customer_name: customerName,
      merchant_slug: prepared.merchant.slug,
      transaction_type: 'vtu_purchase',
      vtu_transaction_id: prepared.transaction.id,
      vtu_type: prepared.transaction.type,
    };

    try {
      let authorizationUrl = '';
      let checkoutUrl = '';
      let gatewayResponse: Record<string, unknown> | null = null;

      if (parsed.data.gateway === 'paystack') {
        const paystack = await initializePaystackTransaction({
          email: customerEmail,
          amount: Math.round(parsed.data.amount * 100),
          reference: paymentReference,
          callback_url: callbackUrl,
          metadata,
        });

        authorizationUrl = paystack.authorization_url;
        checkoutUrl = paystack.authorization_url;
        gatewayResponse = paystack as unknown as Record<string, unknown>;
      } else {
        const korapay = await initializeKorapayPayment({
          amount: parsed.data.amount,
          currency: 'NGN',
          customer: {
            email: customerEmail,
            name: customerName,
          },
          merchant_bears_cost: true,
          metadata,
          notification_url: notificationUrl,
          redirect_url: callbackUrl,
          reference: paymentReference,
        });

        authorizationUrl = korapay.authorization_url;
        checkoutUrl = korapay.checkout_url;
        gatewayResponse = korapay as unknown as Record<string, unknown>;
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          merchant_id: prepared.merchant.id,
          order_id: null,
          transaction_type: 'payment',
          amount: parsed.data.amount,
          currency: 'NGN',
          status: 'pending',
          gateway: parsed.data.gateway,
          gateway_reference: paymentReference,
          gateway_response: gatewayResponse,
          description: `VTU checkout for ${prepared.transaction.type}`,
          metadata,
          platform_fee: 0,
          merchant_amount: 0,
        });

      if (transactionError) {
        throw new Error('Failed to initialize payment');
      }

      await supabase
        .from('vtu_transactions')
        .update({
          metadata: {
            ...(prepared.transaction.metadata ?? {}),
            customerEmail,
            customerName,
            gateway: parsed.data.gateway,
            paymentReference,
            paymentTransactionType: 'gateway_checkout',
          },
        })
        .eq('id', prepared.transaction.id);

      return NextResponse.json({
        success: true,
        authorization_url: authorizationUrl,
        checkout_url: checkoutUrl,
        gateway: parsed.data.gateway,
        reference: paymentReference,
        vtu_reference: prepared.requestReference,
        vtu_transaction_id: prepared.transaction.id,
      });
    } catch (gatewayError) {
      await supabase
        .from('vtu_transactions')
        .update({
          error_message:
            gatewayError instanceof Error
              ? gatewayError.message
              : 'Failed to initialize payment',
          status: 'failed',
        })
        .eq('id', prepared.transaction.id);

      throw gatewayError;
    }
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to initialize payment',
      400
    );
  }
}
