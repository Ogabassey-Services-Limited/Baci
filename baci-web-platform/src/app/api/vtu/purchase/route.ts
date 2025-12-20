import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  formatPhoneNumber,
  generateRequestRef,
  isValidPhoneNumber,
  type NetworkProvider,
  purchaseAirtime,
  purchaseData,
} from '@/lib/kuda';
import { createClient } from '@/lib/supabase/server';
import { calculateCommerce } from '@/lib/supabase/client';

interface PurchaseRequest {
  merchantSlug: string;
  phoneNumber: string;
  amount: number;
  type: 'airtime' | 'data';
  networkProvider: NetworkProvider;
  dataPlanCode?: string;
  orderId?: string;
  customerId?: string;
  source?: 'checkout' | 'loyalty_reward' | 'direct' | 'gift';
}

// POST /api/vtu/purchase - Purchase airtime or data
export async function POST(request: Request) {
  try {
    const body: PurchaseRequest = await request.json();
    const {
      merchantSlug,
      phoneNumber,
      amount,
      type,
      networkProvider,
      dataPlanCode,
      orderId,
      customerId,
      source = 'direct',
    } = body;

    // Validate required fields
    if (!merchantSlug || !phoneNumber || !amount || !type || !networkProvider) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount < 50 || amount > 50000) {
      return NextResponse.json(
        { error: 'Amount must be between ₦50 and ₦50,000' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant and verify VTU is enabled (include bank details for payout)
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, bank_account_number, bank_code, bank_account_name'
      )
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get VTU settings (including customer cashback settings)
    const { data: settings } = await supabase
      .from('merchant_feature_settings')
      .select(
        'vtu_enabled, vtu_airtime_enabled, vtu_data_enabled, vtu_merchant_commission_rate, vtu_customer_cashback_enabled, vtu_customer_cashback_rate'
      )
      .eq('merchant_id', merchant.id)
      .single();

    if (!settings?.vtu_enabled) {
      return NextResponse.json(
        { error: 'VTU is not enabled for this merchant' },
        { status: 403 }
      );
    }

    if (type === 'airtime' && !settings.vtu_airtime_enabled) {
      return NextResponse.json(
        { error: 'Airtime purchases are not enabled' },
        { status: 403 }
      );
    }

    if (type === 'data' && !settings.vtu_data_enabled) {
      return NextResponse.json(
        { error: 'Data purchases are not enabled' },
        { status: 403 }
      );
    }

    // Calculate commissions based on provider and type
    // Merchant split percentage can be configured (default 50%)
    const merchantSplitPercentage = settings.vtu_merchant_commission_rate
      ? settings.vtu_merchant_commission_rate * 100 // Convert from decimal to percentage
      : 50; // Default 50% split

    // Use the centralized Commerce Brain (Edge Function) for commission calculations
    const commissions = await calculateCommerce('calculate_vtu', {
      amount,
      provider: networkProvider,
      category: type === 'airtime' ? 'AIRTIME' : 'DATA',
      merchantSplit: merchantSplitPercentage,
    });

    // Calculate customer cashback (if enabled)
    // Merchant can share a percentage of their commission with customers
    const customerCashbackEnabled =
      settings.vtu_customer_cashback_enabled ?? false;
    const customerCashbackRate = settings.vtu_customer_cashback_rate ?? 50; // Default 50% of merchant's share

    let customerCashback = 0;
    let effectiveMerchantEarning = commissions.merchantEarning;

    if (customerCashbackEnabled && customerId) {
      // Customer gets a percentage of merchant's commission
      customerCashback =
        Math.round(
          ((commissions.merchantEarning * customerCashbackRate) / 100) * 100
        ) / 100;
      effectiveMerchantEarning = commissions.merchantEarning - customerCashback;
    }

    // Generate request reference
    const requestRef = generateRequestRef();

    // Create transaction record first (pending status)
    const { data: transaction, error: txError } = await supabase
      .from('vtu_transactions')
      .insert({
        merchant_id: merchant.id,
        customer_id: customerId || null,
        order_id: orderId || null,
        type,
        network_provider: networkProvider,
        phone_number: formattedPhone,
        amount,
        request_reference: requestRef,
        status: 'pending',
        source,
        platform_commission: commissions.platformEarning,
        merchant_commission: effectiveMerchantEarning, // After customer cashback deduction
        customer_cashback: customerCashback,
        metadata: {
          dataPlanCode,
          originalPhoneNumber: phoneNumber,
          originalMerchantCommission: commissions.merchantEarning,
          customerCashbackEnabled,
          customerCashbackRate,
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('Failed to create transaction record:', txError);
      return NextResponse.json(
        { error: 'Failed to initiate purchase' },
        { status: 500 }
      );
    }

    // Execute the purchase
    let result: Awaited<ReturnType<typeof purchaseAirtime>>;
    if (type === 'airtime') {
      result = await purchaseAirtime(formattedPhone, amount, networkProvider);
    } else if (type === 'data' && dataPlanCode) {
      result = await purchaseData(
        formattedPhone,
        dataPlanCode,
        amount,
        networkProvider
      );
    } else {
      return NextResponse.json(
        { error: 'Data plan code is required for data purchases' },
        { status: 400 }
      );
    }

    // Update transaction with result
    await supabase
      .from('vtu_transactions')
      .update({
        status: result.success ? 'successful' : 'failed',
        transaction_id: result.transactionId,
        error_message: result.success ? null : result.message,
      })
      .eq('id', transaction.id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          reference: requestRef,
        },
        { status: 400 }
      );
    }

    // WALLET CREDIT: Add merchant's commission share to their wallet
    // Weekly auto-payout or manual withdrawal when balance >= ₦1,000
    let merchantWalletCredited = false;
    let customerWalletCredited = false;
    let customerNewBalance = 0;

    // Credit merchant wallet (with effective amount after customer cashback)
    if (effectiveMerchantEarning > 0) {
      try {
        const { error: walletError } = await supabase.rpc(
          'credit_merchant_wallet',
          {
            p_merchant_id: merchant.id,
            p_amount: effectiveMerchantEarning,
            p_source_type: 'vtu_transaction',
            p_source_id: transaction.id,
            p_description: `VTU Commission - ${type} ${networkProvider} ₦${amount}${customerCashback > 0 ? ` (after ₦${customerCashback} customer cashback)` : ''}`,
          }
        );

        if (walletError) {
          console.error('Failed to credit merchant wallet:', walletError);
        } else {
          merchantWalletCredited = true;
        }
      } catch (walletError) {
        console.error('Merchant wallet credit error:', walletError);
      }
    }

    // Credit customer wallet with cashback (if enabled and customer exists)
    if (customerCashback > 0 && customerId) {
      try {
        const { data: customerWalletResult, error: customerWalletError } =
          await supabase.rpc('credit_customer_wallet', {
            p_customer_id: customerId,
            p_merchant_id: merchant.id,
            p_amount: customerCashback,
            p_source_type: 'vtu_transaction',
            p_source_id: transaction.id,
            p_description: `Cashback - ${type} ${networkProvider} ₦${amount}`,
          });

        if (customerWalletError) {
          console.error(
            'Failed to credit customer wallet:',
            customerWalletError
          );
        } else {
          customerWalletCredited = true;
          customerNewBalance = customerWalletResult?.[0]?.new_balance || 0;
        }
      } catch (walletError) {
        console.error('Customer wallet credit error:', walletError);
      }
    }

    // Update transaction with wallet credit info
    if (merchantWalletCredited || customerWalletCredited) {
      await supabase
        .from('vtu_transactions')
        .update({
          metadata: {
            ...((transaction.metadata as Record<string, unknown>) || {}),
            merchantWalletCredited,
            customerWalletCredited,
            customerNewBalance,
          },
        })
        .eq('id', transaction.id);
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'airtime' ? 'Airtime' : 'Data'} purchase successful`,
      reference: requestRef,
      transactionId: result.transactionId,
      amount,
      phoneNumber: formattedPhone,
      provider: networkProvider,
      commission: {
        merchantEarning: effectiveMerchantEarning,
        merchantWalletCredited,
      },
      // Include cashback info if customer received any
      ...(customerCashback > 0 && {
        cashback: {
          amount: customerCashback,
          credited: customerWalletCredited,
          newBalance: customerNewBalance,
        },
      }),
    });
  } catch (error) {
    console.error('VTU purchase error:', error);
    return NextResponse.json(
      { error: 'Purchase failed. Please try again.' },
      { status: 500 }
    );
  }
}
