import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { type Currency, sendPayout } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

const MINIMUM_PAYOUT_AMOUNTS: Record<Currency, number> = {
  NGN: 5000, // ₦5,000
  KES: 500, // KSh 500
  GHS: 50, // GH₵ 50
  ZAR: 100, // R 100
  XAF: 3000, // FCFA 3,000
  XOF: 3000, // CFA 3,000
};

export async function POST(_request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request as NextRequest);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const body = await _request.json();
    const { amount, currency = 'NGN', bank_code, account_number } = body;

    if (!amount || !bank_code || !account_number) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, bank_code, account_number' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user and merchant
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Permission check
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Fetch merchant email (not returned by getMerchantForApiRequest)
    const { data: merchantDetails } = await supabase
      .from('merchants')
      .select('email')
      .eq('id', merchantId)
      .single();

    // Check minimum payout amount
    const minimumAmount = MINIMUM_PAYOUT_AMOUNTS[currency as Currency] || 5000;
    if (amount < minimumAmount) {
      return NextResponse.json(
        { error: `Minimum payout amount is ${minimumAmount} ${currency}` },
        { status: 400 }
      );
    }

    // Get merchant balance
    const { data: balance } = await supabase.rpc('get_merchant_balance', {
      merchant_id_param: merchantId,
      currency_param: currency,
    });

    const availableBalance = balance || 0;

    if (availableBalance < amount) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          available: availableBalance,
          requested: amount,
        },
        { status: 400 }
      );
    }

    // Generate unique reference
    const reference = `PAYOUT-${nanoid(12).toUpperCase()}`;

    // Create payout request record
    const { data: payoutRequest, error: payoutError } = await supabase
      .from('payout_requests')
      .insert({
        merchant_id: merchantId,
        amount,
        currency,
        status: 'processing',
        bank_account_number: account_number,
        bank_code,
        korapay_reference: reference,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (payoutError) {
      logger.error({
        message: 'Failed to create payout request',
        error: payoutError,
      });
      return NextResponse.json(
        { error: 'Failed to create payout request' },
        { status: 500 }
      );
    }

    // Send payout via Korapay
    try {
      const payoutResult = await sendPayout({
        reference,
        destination: {
          type: 'bank_account',
          amount,
          currency: currency as Currency,
          narration: `Withdrawal for ${merchantContext.businessName}`,
          bank_account: {
            bank: bank_code,
            account: account_number,
          },
          customer: {
            name: merchantContext.businessName ?? '',
            email: merchantDetails?.email ?? '',
          },
        },
      });

      if (!payoutResult.success) {
        throw new Error(payoutResult.error);
      }

      const payoutData = payoutResult.data;

      logger.info({
        message: 'Payout sent successfully',
        reference,
        payoutData,
      });

      // Update payout request with Korapay response
      await supabase
        .from('payout_requests')
        .update({
          status: payoutData.status === 'success' ? 'completed' : 'processing',
          korapay_response: payoutData,
          processed_at: new Date().toISOString(),
          completed_at:
            payoutData.status === 'success' ? new Date().toISOString() : null,
        })
        .eq('id', payoutRequest.id);

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          merchant_id: merchantId,
          transaction_type: 'payout',
          amount,
          currency,
          status: payoutData.status === 'success' ? 'completed' : 'processing',
          gateway: 'korapay',
          gateway_reference: reference,
          gateway_response: payoutData,
          description: `Payout to ${account_number}`,
          metadata: {
            bank_code,
            account_number,
            payout_request_id: payoutRequest.id,
          },
        });

      if (transactionError) {
        logger.error({
          message: 'Failed to create payout transaction',
          error: transactionError,
        });
      }

      return NextResponse.json({
        success: true,
        reference,
        status: payoutData.status,
        message:
          payoutData.status === 'success'
            ? 'Payout processed successfully'
            : 'Payout is being processed',
      });
    } catch (korapayError) {
      logger.error({
        message: 'Korapay payout failed',
        reference,
        error: korapayError,
      });

      // Update payout request to failed
      await supabase
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason:
            korapayError instanceof Error
              ? korapayError.message
              : 'Unknown error',
        })
        .eq('id', payoutRequest.id);

      throw korapayError;
    }
  } catch (error) {
    logger.error({ message: 'Payout request error', error });
    return NextResponse.json(
      {
        error: 'Failed to process payout',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch payout history
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Permission check
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Fetch payout requests
    const { data: payouts, error: payoutsError } = await supabase
      .from('payout_requests')
      .select(
        'id, merchant_id, amount, currency, status, bank_name, account_number, account_name, reference, created_at, processed_at'
      )
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (payoutsError) {
      logger.error({ message: 'Failed to fetch payouts', error: payoutsError });
      return NextResponse.json(
        { error: 'Failed to fetch payouts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ payouts });
  } catch (error) {
    logger.error({ message: 'Get payouts error', error });
    return NextResponse.json(
      { error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}
