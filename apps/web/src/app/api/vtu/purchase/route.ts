import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/admin';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';
import {
  preparePendingVtuTransaction,
  VTU_TYPE_LABELS,
} from '@/lib/vtu-pending-transaction';
import { purchaseSchema } from '@/schemas/vtu';

function getErrorStatus(message: string) {
  if (message === 'Merchant not found') return 404;
  if (message === 'Invalid phone number') return 400;
  if (
    message === 'VTU is not enabled for this merchant' ||
    message.endsWith('purchases are not enabled')
  ) {
    return 403;
  }
  if (message === 'Failed to initiate purchase') return 500;
  return 400;
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
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (
      parsed.data.source === 'direct' ||
      parsed.data.source === 'storefront_modal'
    ) {
      return NextResponse.json(
        {
          error:
            'Direct VTU purchases are disabled until payment checkout is implemented.',
        },
        { status: 409 }
      );
    }

    const supabase = createAdminClient();
    const prepared = await preparePendingVtuTransaction({
      supabase,
      user: auth.user,
      input: parsed.data,
      source: parsed.data.source,
    });

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: prepared.transaction.id,
    });

    if (result.status === 'failed') {
      return NextResponse.json(
        { error: result.error, reference: result.reference },
        { status: 400 }
      );
    }

    if (result.status === 'processing') {
      return NextResponse.json(
        {
          error: 'Purchase is still processing. Please try again shortly.',
          reference: result.reference,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${VTU_TYPE_LABELS[parsed.data.type]} purchase successful`,
      reference: result.reference,
      amount: result.amount,
      ...(result.customerIdentifier && {
        customerIdentifier: result.customerIdentifier,
      }),
      ...(result.cashback && {
        cashback: result.cashback,
      }),
      ...(result.loyaltyPoints && {
        loyaltyPoints: result.loyaltyPoints,
      }),
      ...(result.voucherPin && {
        voucherPin: result.voucherPin,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Purchase failed. Please try again.';
    return NextResponse.json(
      { error: message },
      { status: getErrorStatus(message) }
    );
  }
}
