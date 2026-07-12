import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env, isUsdtWalletEnabled } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { USDT_WALLET_TOP_UP_TRANSACTION_TYPE } from '@/lib/customer-wallet-account';
import {
  capturePaymentWithCrypto,
  extractCryptoAddress,
  generatePaymentReference,
  initializePayment,
  isJuicywayConfigured,
} from '@/lib/juicyway';
import { formatPhoneToE164 } from '@/lib/phone';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';
import { walletUsdtTopUpInitializeSchema } from '@/schemas/wallet-usdt-top-up';

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function requestIp(request: NextRequest) {
  const candidate =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip');
  return candidate && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)
    ? candidate
    : '41.217.100.1';
}

function splitName(name: string) {
  const [firstName = 'Customer', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') || 'User' };
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || 'Unauthorized', 401);
  }
  if (!isUsdtWalletEnabled()) {
    return errorResponse('USDT wallet funding is not available', 404);
  }
  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit.limit,
      rateLimit.remaining,
      rateLimit.resetTime
    );
  }

  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request);
  if (!csrfValid) {
    return csrfResponse ?? errorResponse('CSRF validation failed', 403);
  }

  const parsed = walletUsdtTopUpInitializeSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { details: parsed.error.flatten(), error: 'Invalid input' },
      { status: 400 }
    );
  }
  if (!isJuicywayConfigured()) {
    return errorResponse('USDT wallet funding is temporarily unavailable', 503);
  }

  const supabase = createAdminClient();
  const merchant = await resolveWalletTopUpMerchant<{
    business_name: string;
    id: string;
    slug: string;
  }>(supabase, parsed.data, 'id, slug, business_name');
  if (!merchant) return errorResponse('Merchant not found', 404);

  const customer = await resolveVtuCustomer({
    merchantId: merchant.id,
    supabase,
    user: auth.user,
  });
  if (!customer) return errorResponse('Customer not found', 404);

  const email = customer.email || auth.user.email;
  const phone = formatPhoneToE164(
    parsed.data.customerPhone || customer.phone || ''
  );
  if (!email || !/^\+\d{10,15}$/.test(phone)) {
    return errorResponse('Customer email and phone are required', 400);
  }

  const reference = generatePaymentReference('wusdt');
  const amountMinor = Math.round(parsed.data.amount * 100);
  const walletCreditAmount = amountMinor / 100;
  const customerName =
    parsed.data.customerName ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
    email;
  const { firstName, lastName } = splitName(customerName);
  const metadata = {
    customer_id: customer.id,
    juicyway_expected_amount: amountMinor,
    juicyway_expected_currency: 'USDT',
    merchant_slug: merchant.slug,
    transaction_type: USDT_WALLET_TOP_UP_TRANSACTION_TYPE,
    wallet_credit_amount: walletCreditAmount,
  };

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .insert({
      amount: walletCreditAmount,
      currency: 'USDT',
      description: 'Customer USDT wallet top-up',
      gateway: 'juicyway',
      gateway_reference: reference,
      merchant_amount: 0,
      merchant_id: merchant.id,
      metadata,
      order_id: null,
      platform_fee: 0,
      status: 'pending',
      transaction_type: 'payment',
    })
    .select('id')
    .single();
  if (transactionError || !transaction?.id) {
    return errorResponse('Failed to initialize USDT wallet funding', 500);
  }

  try {
    const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
    const session = await initializePayment({
      amount: amountMinor,
      currency: 'USDT',
      customer: {
        billing_address: {
          city: parsed.data.billingAddress.city,
          country: parsed.data.billingAddress.country,
          line1: parsed.data.billingAddress.line1,
          line2: parsed.data.billingAddress.line2,
          state: parsed.data.billingAddress.state,
          zip_code: parsed.data.billingAddress.zipCode,
        },
        email,
        first_name: firstName,
        ip_address: requestIp(request),
        last_name: lastName,
        phone_number: phone,
      },
      description: `USDT wallet funding for ${merchant.business_name}`.slice(
        0,
        200
      ),
      direction: 'incoming',
      metadata,
      order: {
        identifier: transaction.id,
        items: [{ name: 'USDT Wallet Funding', type: 'digital' }],
      },
      payment_method: { type: 'crypto_address' },
      redirect_url: `${protocol}://${merchant.slug}.${env.NEXT_PUBLIC_ROOT_DOMAIN}/wallet?fund-usdt=1&funding=${reference}`,
      reference,
    });
    if (!session.id) throw new Error('Juicyway session id missing');

    const capture = await capturePaymentWithCrypto(
      session.id,
      parsed.data.chain,
      'USDT'
    );
    if (!capture.success) throw new Error(capture.error);

    const payment = capture.data.payment;
    const address = extractCryptoAddress(payment.payment_method);
    const nextMetadata = {
      ...metadata,
      juicyway_expected_amount: amountMinor,
      juicyway_payment_id: payment.id,
      juicyway_session_id: session.id,
    };
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        gateway_response: {
          address,
          payment_id: payment.id,
          session_id: session.id,
          status: payment.status,
        },
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
    if (updateError) throw updateError;

    return NextResponse.json(
      {
        amount: walletCreditAmount,
        chain: parsed.data.chain,
        currency: 'USDT',
        depositAddress: address?.address ?? null,
        paymentId: payment.id,
        reference,
        sessionId: session.id,
        success: true,
      },
      { status: address?.address ? 200 : 202 }
    );
  } catch (error) {
    await supabase
      .from('transactions')
      .update({
        gateway_response: {
          error:
            error instanceof Error ? error.message : 'Initialization failed',
        },
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
    return errorResponse('Failed to initialize USDT wallet funding', 502);
  }
}
