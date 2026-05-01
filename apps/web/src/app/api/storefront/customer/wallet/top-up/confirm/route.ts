import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  creditWalletTopUp,
  WALLET_TOP_UP_TRANSACTION_TYPE,
} from '@/lib/customer-wallet-top-up';
import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import { verifyTransaction as verifyPaystackTransaction } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';
import { walletTopUpConfirmSchema } from '@/schemas/wallet-top-up';

function getVerifiedAmount(
  gateway: 'paystack' | 'korapay',
  payload: Record<string, unknown>
) {
  const rawAmount = payload.amount;
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) {
    return null;
  }

  return gateway === 'paystack' ? rawAmount / 100 : rawAmount;
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
    const parsed = walletTopUpConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Service role is intentionally scoped to backend-only wallet top-up
    // writes: customer identity is authenticated above, while transaction
    // claiming and wallet credit RPCs are not exposed through customer RLS.
    const supabase = createAdminClient();
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', parsed.data.merchantSlug)
      .single();

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
    if (metadata.transaction_type !== WALLET_TOP_UP_TRANSACTION_TYPE) {
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
            data: result.data as unknown as Record<string, unknown>,
            success: true,
          }
        : { error: result.error, success: false };
    } else {
      const result = await verifyKorapayPayment(parsed.data.reference);
      verification = result.success
        ? {
            data: result.data as unknown as Record<string, unknown>,
            success: true,
          }
        : { error: result.error, success: false };
    }

    if (!verification.success) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const verifiedAmount = getVerifiedAmount(
      parsed.data.gateway,
      verification.data
    );
    if (verifiedAmount === null) {
      return NextResponse.json(
        { error: 'Unable to verify payment amount' },
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

    const { data: claimedTransaction, error: claimError } = (await supabase
      .from('transactions')
      .update({
        gateway_response: verification.data,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)
      .neq('status', 'completed')
      .select('id')
      .maybeSingle()) as PostgrestSingleResponse<{ id: string } | null>;

    if (claimError) {
      console.error('Failed to claim transaction for wallet top-up confirm', {
        error: claimError.message,
        transactionId: transaction.id,
      });
      return NextResponse.json(
        { error: 'Failed to process wallet top-up' },
        { status: 500 }
      );
    }

    if (!claimedTransaction?.id) {
      console.warn('Wallet top-up transaction was already claimed', {
        reference: parsed.data.reference,
        status: transaction.status,
        transactionId: transaction.id,
      });
      return NextResponse.json(
        { error: 'Wallet top-up is already being processed' },
        { status: 409 }
      );
    }

    const walletCredit = await creditWalletTopUp({
      amount: Number(transaction.amount),
      customerId: customer.id,
      gateway: parsed.data.gateway,
      merchantId: merchant.id,
      reference: parsed.data.reference,
      supabase,
      transactionId: transaction.id,
    });

    return NextResponse.json({
      amount: Number(transaction.amount),
      reference: walletCredit.reference,
      status: 'successful',
      success: true,
      wallet: {
        balance: walletCredit.balance,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to confirm wallet top-up',
      },
      { status: 500 }
    );
  }
}
