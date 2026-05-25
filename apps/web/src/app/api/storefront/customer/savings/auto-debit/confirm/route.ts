import { type NextRequest, NextResponse } from 'next/server';
import { resolveCustomerSavingsContext } from '@/app/api/storefront/customer/savings/shared';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { customerSavingsAuthorizationConfirmSchema } from '@/schemas/customer-savings';

type ConfirmationRow = {
  saved_payment_method_id: string | null;
  status: 'processing' | 'successful';
};

function getConfirmationRow(data: unknown): ConfirmationRow | null {
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== 'object') {
    return null;
  }

  const status = (row as Record<string, unknown>).status;
  const savedPaymentMethodId = (row as Record<string, unknown>)
    .saved_payment_method_id;
  if (
    (status !== 'processing' && status !== 'successful') ||
    (savedPaymentMethodId !== null && typeof savedPaymentMethodId !== 'string')
  ) {
    return null;
  }

  return {
    saved_payment_method_id: savedPaymentMethodId,
    status,
  };
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
    const parsed = customerSavingsAuthorizationConfirmSchema.safeParse(body);
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

    const { data, error } = await resolved.supabase.rpc(
      'confirm_customer_savings_authorization',
      {
        p_customer_id: resolved.customer.id,
        p_merchant_id: resolved.merchant.id,
        p_reference: parsed.data.reference,
      }
    );
    if (error) {
      throw error;
    }

    const confirmation = getConfirmationRow(data);
    if (!confirmation) {
      return NextResponse.json(
        { error: 'Savings authorization not found' },
        { status: 404 }
      );
    }

    if (
      confirmation.status === 'processing' ||
      !confirmation.saved_payment_method_id
    ) {
      return NextResponse.json({
        reference: parsed.data.reference,
        status: 'processing',
      });
    }

    return NextResponse.json({
      reference: parsed.data.reference,
      savedPaymentMethodId: confirmation.saved_payment_method_id,
      status: 'successful',
      success: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to confirm savings authorization' },
      { status: 500 }
    );
  }
}
