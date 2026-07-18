import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { creditDirectClientCompletionSchema } from '@/schemas/credit-direct-client-completion';

const KNOWN_ERRORS = [
  ['unauthorized', 403, 'Unauthorized'],
  ['order_not_found', 404, 'Order not found'],
  ['reference_mismatch', 409, 'Payment reference does not match'],
  ['order_not_payable', 409, 'Order is not payable'],
] as const;

/**
 * Stores the Credit Direct SDK's untrusted onSuccess evidence. This route does
 * not confirm payment; the signed provider webhook remains authoritative.
 *
 * Guest checkout is supported, so the SECURITY DEFINER RPC owns authorization
 * using either the authenticated customer/merchant identity or tracking token.
 */
export async function POST(request: NextRequest) {
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return NextResponse.json(
      {
        error: csrf.response ? 'Invalid CSRF token' : 'CSRF validation failed',
        code: 'CSRF_VALIDATION_FAILED',
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = creditDirectClientCompletionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc(
    'record_credit_direct_client_completion',
    {
      p_checkout_transaction_id: parsed.data.checkoutTransactionId ?? null,
      p_email: parsed.data.customerEmail ?? null,
      p_order_id: parsed.data.orderId,
      p_session_id: parsed.data.sessionId ?? null,
      p_tracking_token: parsed.data.tracking_token ?? null,
    }
  );

  if (error) {
    const known = KNOWN_ERRORS.find(([code]) => error.message.includes(code));
    if (known) {
      const [, status, message] = known;
      logger.warn({
        message: 'Credit Direct client completion rejected',
        code: error.code,
        orderId: parsed.data.orderId,
        reason: known[0],
      });
      return NextResponse.json({ error: message }, { status });
    }

    logger.error({
      message: 'Failed to record Credit Direct client completion',
      code: error.code,
      orderId: parsed.data.orderId,
    });
    return NextResponse.json(
      { error: 'Failed to record payment confirmation' },
      { status: 500 }
    );
  }

  const result =
    data && typeof data === 'object' && 'status' in data
      ? (data as { status?: unknown })
      : null;
  const status =
    result?.status === 'already_confirmed'
      ? 'already_confirmed'
      : 'pending_confirmation';

  return NextResponse.json(
    { status, success: true },
    { status: status === 'already_confirmed' ? 200 : 202 }
  );
}
