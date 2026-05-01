import { customAlphabet } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { WALLET_TOP_UP_TRANSACTION_TYPE } from '@/lib/customer-wallet-top-up';
import { initializePayment as initializeKorapayPayment } from '@/lib/korapay';
import { initializeTransaction as initializePaystackTransaction } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';
import {
  type WalletTopUpGateway,
  walletTopUpInitializeSchema,
} from '@/schemas/wallet-top-up';

interface GatewaySettings {
  korapay_enabled: boolean | null;
  paystack_enabled: boolean | null;
  preferred_local_gateway: string | null;
}

class WalletTopUpClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletTopUpClientError';
    Object.setPrototypeOf(this, WalletTopUpClientError.prototype);
  }
}

function createErrorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function isWalletTopUpGateway(value: unknown): value is WalletTopUpGateway {
  return value === 'paystack' || value === 'korapay';
}

function selectWalletTopUpGateway({
  requestedGateway,
  settings,
}: {
  requestedGateway?: WalletTopUpGateway;
  settings: GatewaySettings;
}): WalletTopUpGateway {
  const paystackEnabled = settings.paystack_enabled ?? true;
  const korapayEnabled = settings.korapay_enabled ?? true;

  if (requestedGateway) {
    if (requestedGateway === 'paystack' && paystackEnabled) return 'paystack';
    if (requestedGateway === 'korapay' && korapayEnabled) return 'korapay';
    throw new WalletTopUpClientError(
      `${requestedGateway} is not enabled for wallet top-ups`
    );
  }

  if (
    isWalletTopUpGateway(settings.preferred_local_gateway) &&
    ((settings.preferred_local_gateway === 'paystack' && paystackEnabled) ||
      (settings.preferred_local_gateway === 'korapay' && korapayEnabled))
  ) {
    return settings.preferred_local_gateway;
  }

  if (paystackEnabled) return 'paystack';
  if (korapayEnabled) return 'korapay';

  throw new WalletTopUpClientError(
    'No wallet top-up gateway is enabled for this merchant'
  );
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
    const parsed = walletTopUpInitializeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Service role is intentionally scoped to backend-only wallet top-up
    // writes: customer identity is authenticated above, while transaction
    // creation and gateway settings lookup are not exposed through customer RLS.
    const supabase = createAdminClient();
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug, business_name, paystack_subaccount_code')
      .eq('slug', parsed.data.merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return createErrorResponse('Merchant not found', 404);
    }

    const customer = await resolveVtuCustomer({
      supabase,
      merchantId: merchant.id,
      user: auth.user,
    });

    if (!customer) {
      return createErrorResponse(
        'Customer account not found for this storefront',
        404
      );
    }

    const customerEmail = customer.email || auth.user.email;
    if (!customerEmail) {
      return createErrorResponse('Customer email is required', 400);
    }

    const { data: settings, error: settingsError } = await supabase
      .from('merchant_feature_settings')
      .select('paystack_enabled, korapay_enabled, preferred_local_gateway')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to fetch wallet top-up gateway settings', {
        error: settingsError.message,
        merchantId: merchant.id,
      });
      return createErrorResponse('Failed to load wallet top-up settings', 500);
    }

    const gateway = selectWalletTopUpGateway({
      requestedGateway: parsed.data.gateway,
      settings: (settings ?? {}) as GatewaySettings,
    });
    const customerName =
      parsed.data.customerName ||
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
      customerEmail;
    const nanoidUppercase = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      12
    );
    const paymentReference = `WAL-${nanoidUppercase()}`;
    const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
    const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
    const callbackUrl = `${protocol}://${merchant.slug}.${rootDomain}/checkout/success?reference=${paymentReference}&kind=wallet`;
    const notificationUrl = `${protocol}://${rootDomain}/api/payments/webhook`;
    const metadata = {
      customer_email: customerEmail,
      customer_id: customer.id,
      customer_name: customerName,
      merchant_slug: merchant.slug,
      transaction_type: WALLET_TOP_UP_TRANSACTION_TYPE,
    };

    let authorizationUrl = '';
    let checkoutUrl = '';
    let gatewayResponse: Record<string, unknown> | null = null;

    const { data: insertedTransaction, error: transactionError } =
      await supabase
        .from('transactions')
        .insert({
          amount: parsed.data.amount,
          currency: 'NGN',
          description: 'Customer wallet top-up',
          gateway,
          gateway_reference: paymentReference,
          merchant_amount: parsed.data.amount,
          merchant_id: merchant.id,
          metadata,
          order_id: null,
          platform_fee: 0,
          status: 'pending',
          transaction_type: 'payment',
        })
        .select('id')
        .single();

    if (transactionError || !insertedTransaction?.id) {
      console.error('Failed to create wallet top-up transaction', {
        error: transactionError?.message,
        merchantId: merchant.id,
        reference: paymentReference,
      });
      return createErrorResponse('Failed to initialize wallet top-up', 500);
    }

    try {
      if (gateway === 'paystack') {
        const paystack = await initializePaystackTransaction({
          amount: Math.round(parsed.data.amount * 100),
          callback_url: callbackUrl,
          email: customerEmail,
          metadata,
          phone: parsed.data.customerPhone || customer.phone || undefined,
          reference: paymentReference,
          ...(merchant.paystack_subaccount_code && {
            subaccount: merchant.paystack_subaccount_code,
          }),
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
    } catch (error) {
      const { error: failUpdateError } = await supabase
        .from('transactions')
        .update({
          gateway_response: {
            error:
              error instanceof Error ? error.message : 'Gateway init failed',
          },
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', insertedTransaction.id);

      if (failUpdateError) {
        console.error('Failed to mark wallet top-up transaction as failed', {
          error: failUpdateError.message,
          originalError: error instanceof Error ? error.message : error,
          transactionId: insertedTransaction.id,
        });
      }

      throw error;
    }

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        gateway_response: gatewayResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', insertedTransaction.id);

    if (updateError) {
      console.error('Failed to update wallet top-up transaction', {
        authorizationUrl,
        error: updateError.message,
        merchantId: merchant.id,
        reference: paymentReference,
        transactionId: insertedTransaction.id,
      });
      return createErrorResponse('Failed to initialize wallet top-up', 500);
    }

    return NextResponse.json({
      authorization_url: authorizationUrl,
      checkout_url: checkoutUrl,
      gateway,
      reference: paymentReference,
      success: true,
    });
  } catch (error) {
    if (error instanceof WalletTopUpClientError) {
      return createErrorResponse(error.message, 400);
    }

    console.error('Unexpected wallet top-up initialization error', { error });
    return createErrorResponse('Failed to initialize wallet top-up', 500);
  }
}
