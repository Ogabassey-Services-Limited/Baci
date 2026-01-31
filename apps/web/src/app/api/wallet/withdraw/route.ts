import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { payoutMerchantCommission } from '@/lib/kuda';
import { createClient } from '@/lib/supabase/server';

const MIN_WITHDRAWAL_AMOUNT = 1000; // ₦1,000 minimum

/**
 * POST /api/wallet/withdraw
 * Manual withdrawal request - transfer to merchant's bank account
 */
export async function POST(request: NextRequest) {
  // CSRF protection - prevents cross-site request forgery attacks
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const body = await request.json();
    const { amount } = body;

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant with bank details
    const { data: merchant } = await supabase
      .from('merchants')
      .select(
        'id, business_name, bank_account_number, bank_code, bank_account_name'
      )
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Check bank details
    if (
      !merchant.bank_account_number ||
      !merchant.bank_code ||
      !merchant.bank_account_name
    ) {
      return NextResponse.json(
        {
          error: 'Bank details not configured',
          message:
            'Please add your bank account details in Settings > Payments',
        },
        { status: 400 }
      );
    }

    // Get wallet
    const { data: wallet } = await supabase
      .from('merchant_wallets')
      .select('id, available_balance')
      .eq('merchant_id', merchant.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const availableBalance = Number(wallet.available_balance);

    // Validate amount
    const withdrawAmount = amount ? Number(amount) : availableBalance;

    if (withdrawAmount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        {
          error: `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`,
          availableBalance,
        },
        { status: 400 }
      );
    }

    if (withdrawAmount > availableBalance) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          availableBalance,
          requestedAmount: withdrawAmount,
        },
        { status: 400 }
      );
    }

    // Debit wallet (creates pending transaction)
    const { data: debitResult, error: debitError } = await supabase.rpc(
      'debit_merchant_wallet',
      {
        p_merchant_id: merchant.id,
        p_amount: withdrawAmount,
        p_type: 'withdrawal',
        p_description: `Manual withdrawal to ${merchant.bank_account_name}`,
      }
    );

    if (debitError || !debitResult?.[0]?.success) {
      console.error('Debit failed:', debitError, debitResult);
      return NextResponse.json(
        {
          error:
            debitResult?.[0]?.error_message || 'Failed to process withdrawal',
        },
        { status: 400 }
      );
    }

    const transactionId = debitResult[0].transaction_id;

    // Execute bank transfer via Kuda
    let transferResult: Awaited<ReturnType<typeof payoutMerchantCommission>>;
    try {
      transferResult = await payoutMerchantCommission(
        {
          accountNumber: merchant.bank_account_number,
          bankCode: merchant.bank_code,
          accountName: merchant.bank_account_name,
        },
        withdrawAmount,
        merchant.id
      );
    } catch (transferError) {
      console.error('Transfer execution error:', transferError);
      // Complete withdrawal as failed - refund balance with retry logic
      // 2026 Best Practice: Retry rollback to prevent funds being stuck
      const errorMessage =
        transferError instanceof Error
          ? transferError.message
          : 'Transfer failed';

      let rollbackSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error: rollbackError } = await supabase.rpc(
          'complete_wallet_withdrawal',
          {
            p_transaction_id: transactionId,
            p_success: false,
            p_transfer_reference: null,
            p_transfer_message: errorMessage,
          }
        );

        if (!rollbackError) {
          rollbackSuccess = true;
          break;
        }

        console.error(`Rollback attempt ${attempt} failed:`, rollbackError);
        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }

      if (!rollbackSuccess) {
        // Critical: Log for manual intervention
        console.error(
          'CRITICAL: Failed to rollback wallet debit after transfer failure',
          {
            transactionId,
            merchantId: merchant.id,
            amount: withdrawAmount,
          }
        );
        return NextResponse.json(
          {
            error:
              'Transfer failed. Please contact support if your balance is not restored.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Transfer failed. Your balance has been restored.' },
        { status: 500 }
      );
    }

    // Complete withdrawal with result
    await supabase.rpc('complete_wallet_withdrawal', {
      p_transaction_id: transactionId,
      p_success: transferResult.success,
      p_transfer_reference: transferResult.reference,
      p_transfer_message: transferResult.message,
    });

    if (!transferResult.success) {
      return NextResponse.json(
        {
          error: 'Transfer failed',
          message: transferResult.message,
          note: 'Your balance has been restored.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal successful',
      withdrawal: {
        amount: withdrawAmount,
        reference: transferResult.reference,
        bankAccount: `${merchant.bank_account_name} - ****${merchant.bank_account_number.slice(-4)}`,
      },
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 });
  }
}
