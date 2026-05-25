import { customAlphabet } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import {
  getCustomerSavingsFeatureSettings,
  resolveCustomerSavingsContext,
} from '@/app/api/storefront/customer/savings/shared';
import { env } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { initializeTransaction as initializePaystackTransaction } from '@/lib/paystack';
import { customerSavingsAutoDebitAuthorizeSchema } from '@/schemas/customer-savings';

const SAVINGS_AUTHORIZATION_TRANSACTION_TYPE = 'savings_authorization';

function getCustomerName(input: {
  customerEmail: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  requestedName?: string;
}) {
  const requested = input.requestedName?.trim();
  if (requested) {
    return requested;
  }

  const fallback = [input.customerFirstName, input.customerLastName]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .trim();
  return fallback || input.customerEmail;
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to initialize savings auto-debit authorization';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON', code: 'MALFORMED_JSON' },
        { status: 400 }
      );
    }
    const parsed = customerSavingsAutoDebitAuthorizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resolved = await resolveCustomerSavingsContext({
      identifiers: parsed.data,
      supabase: auth.supabase,
      user: auth.user,
    });
    if ('response' in resolved) {
      return resolved.response;
    }

    const featureSettings = await getCustomerSavingsFeatureSettings({
      customerId: resolved.customer.id,
      merchantId: resolved.merchant.id,
      supabase: resolved.supabase,
    });
    if (!featureSettings.savingsEnabled) {
      return NextResponse.json(
        {
          code: 'CUSTOMER_SAVINGS_DISABLED',
          error: 'Customer savings is not enabled for this merchant',
        },
        { status: 403 }
      );
    }

    if (!featureSettings.autoDebitEnabled) {
      return NextResponse.json(
        {
          code: 'CUSTOMER_SAVINGS_AUTO_DEBIT_DISABLED',
          error: 'Customer savings auto-debit is not enabled',
        },
        { status: 403 }
      );
    }

    if (!featureSettings.paystackEnabled) {
      return NextResponse.json(
        {
          code: 'PAYSTACK_DISABLED',
          error: 'Paystack is not enabled for this merchant',
        },
        { status: 403 }
      );
    }

    const customerEmail = resolved.customer.email || auth.user.email;
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    const customerName = getCustomerName({
      customerEmail,
      customerFirstName: resolved.customer.first_name,
      customerLastName: resolved.customer.last_name,
      requestedName: parsed.data.customerName,
    });

    const nanoidUppercase = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      12
    );
    const reference = `SAV-AUTH-${nanoidUppercase()}`;
    const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
    const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
    const merchantSubdomain = resolved.merchant.slug ?? 'www';
    const callbackUrl = `${protocol}://${merchantSubdomain}.${rootDomain}/checkout/success?reference=${reference}&kind=savings_auth`;

    const metadata = {
      customer_email: customerEmail,
      customer_id: resolved.customer.id,
      customer_name: customerName,
      merchant_slug: resolved.merchant.slug,
      purpose: 'device_savings_auto_debit',
      savings_accounting_policy: 'credit_wallet',
      transaction_type: SAVINGS_AUTHORIZATION_TRANSACTION_TYPE,
    };

    const { data: transactionId, error: transactionError } =
      await resolved.supabase.rpc(
        'create_customer_savings_authorization_transaction',
        {
          p_amount: parsed.data.amount,
          p_customer_id: resolved.customer.id,
          p_merchant_id: resolved.merchant.id,
          p_reference: reference,
        }
      );

    if (transactionError || typeof transactionId !== 'string') {
      console.error('Failed to insert savings authorization transaction', {
        error: transactionError,
        merchantId: resolved.merchant.id,
        reference,
      });
      return NextResponse.json(
        { error: 'Failed to initialize savings auto-debit authorization' },
        { status: 500 }
      );
    }

    let paystack: Awaited<ReturnType<typeof initializePaystackTransaction>>;
    try {
      paystack = await initializePaystackTransaction({
        amount: Math.round(parsed.data.amount * 100),
        callback_url: callbackUrl,
        email: customerEmail,
        metadata,
        phone:
          parsed.data.customerPhone || resolved.customer.phone || undefined,
        reference,
        ...(resolved.merchant.paystack_subaccount_code && {
          subaccount: resolved.merchant.paystack_subaccount_code,
        }),
      });
    } catch (error) {
      const { error: failureError } = await resolved.supabase.rpc(
        'fail_customer_savings_authorization_transaction',
        {
          p_customer_id: resolved.customer.id,
          p_failure_message: getApiErrorMessage(error),
          p_merchant_id: resolved.merchant.id,
          p_reference: reference,
        }
      );
      if (failureError) {
        console.error('Failed to mark savings authorization as failed', {
          error: failureError,
          merchantId: resolved.merchant.id,
          reference,
        });
      }
      throw error;
    }

    return NextResponse.json({
      authorization_url: paystack.authorization_url,
      checkout_url: paystack.authorization_url,
      gateway: 'paystack',
      reference,
      success: true,
    });
  } catch (error) {
    console.error(
      'Failed to initialize savings auto-debit authorization',
      error
    );
    return NextResponse.json(
      { error: 'Failed to initialize savings auto-debit authorization' },
      { status: 500 }
    );
  }
}
