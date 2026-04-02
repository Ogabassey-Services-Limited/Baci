import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  formatPhoneNumber,
  generateRequestRef,
  isValidPhoneNumber,
  type NetworkProvider,
  type PurchaseResult,
  purchaseAirtime,
  purchaseData,
} from '@/lib/kuda';
import { purchaseBill } from '@/lib/kuda-bills';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommerce } from '@/lib/supabase/client';
import { COMMISSION_CATEGORY_MAP, purchaseSchema } from '@/schemas/vtu';

const TYPE_LABELS: Record<string, string> = {
  airtime: 'Airtime',
  data: 'Data',
  electricity: 'Electricity',
  cable_tv: 'TV Subscription',
  betting: 'Betting Top-up',
};

// POST /api/vtu/purchase - Purchase airtime, data, or bill payment
// Uses admin client because this server-side route is called from both
// web (with cookies) and mobile (with Bearer token). The cookie-based
// client fails for mobile requests since they don't carry Supabase cookies.
export async function POST(request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request as NextRequest);
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

    const {
      merchantSlug,
      amount,
      type,
      phoneNumber,
      networkProvider,
      dataPlanCode,
      billItemIdentifier,
      customerIdentifier,
      billerName,
      orderId,
      customerId,
      source,
    } = parsed.data;

    const isTelco = type === 'airtime' || type === 'data';

    // Validate phone number for telco types
    let formattedPhone = '';
    if (isTelco && phoneNumber) {
      formattedPhone = formatPhoneNumber(phoneNumber);
      if (!isValidPhoneNumber(formattedPhone)) {
        return NextResponse.json(
          { error: 'Invalid phone number' },
          { status: 400 }
        );
      }
    }

    // Validate amount range
    if (amount < 50 || amount > 500000) {
      return NextResponse.json(
        { error: 'Amount must be between ₦50 and ₦500,000' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get merchant
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

    // Get VTU settings
    const { data: settings } = await supabase
      .from('merchant_feature_settings')
      .select(
        'vtu_enabled, vtu_airtime_enabled, vtu_data_enabled, vtu_electricity_enabled, vtu_tv_enabled, vtu_betting_enabled, vtu_merchant_commission_rate, vtu_customer_cashback_enabled, vtu_customer_cashback_rate'
      )
      .eq('merchant_id', merchant.id)
      .single();

    if (!settings?.vtu_enabled) {
      return NextResponse.json(
        { error: 'VTU is not enabled for this merchant' },
        { status: 403 }
      );
    }

    // Check type-specific feature flags
    const typeFlags: Record<string, boolean | null> = {
      airtime: settings.vtu_airtime_enabled,
      data: settings.vtu_data_enabled,
      electricity: settings.vtu_electricity_enabled,
      cable_tv: settings.vtu_tv_enabled,
      betting: settings.vtu_betting_enabled,
    };

    if (typeFlags[type] === false) {
      return NextResponse.json(
        { error: `${TYPE_LABELS[type]} purchases are not enabled` },
        { status: 403 }
      );
    }

    // Calculate commissions
    const merchantSplitPercentage = settings.vtu_merchant_commission_rate
      ? settings.vtu_merchant_commission_rate * 100
      : 50;

    const commissionCategory = COMMISSION_CATEGORY_MAP[type];
    const commissionProvider = isTelco
      ? (networkProvider ?? '')
      : (billerName ?? 'DEFAULT');

    const commissions = await calculateCommerce('calculate_vtu', {
      amount,
      provider: commissionProvider,
      category: commissionCategory,
      merchantSplit: merchantSplitPercentage,
    });

    // Calculate customer cashback
    const customerCashbackEnabled =
      settings.vtu_customer_cashback_enabled ?? false;
    const customerCashbackRate = settings.vtu_customer_cashback_rate ?? 50;

    let customerCashback = 0;
    let effectiveMerchantEarning = commissions.merchantEarning;

    if (customerCashbackEnabled && customerId) {
      customerCashback =
        Math.round(
          ((commissions.merchantEarning * customerCashbackRate) / 100) * 100
        ) / 100;
      effectiveMerchantEarning = commissions.merchantEarning - customerCashback;
    }

    // Generate request reference
    const requestRef = generateRequestRef();

    // Create transaction record (pending)
    const { data: transaction, error: txError } = await supabase
      .from('vtu_transactions')
      .insert({
        merchant_id: merchant.id,
        customer_id: customerId || null,
        order_id: orderId || null,
        type,
        network_provider: isTelco ? networkProvider : (billerName ?? ''),
        phone_number: isTelco ? formattedPhone : (customerIdentifier ?? ''),
        amount,
        request_reference: requestRef,
        status: 'pending',
        source,
        platform_commission: commissions.platformEarning,
        merchant_commission: effectiveMerchantEarning,
        customer_cashback: customerCashback,
        biller_name: billerName || null,
        biller_item_code: billItemIdentifier || null,
        customer_identifier: customerIdentifier || null,
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
    let result: PurchaseResult;
    const customerFirstName = merchant.business_name || 'Customer';

    if (type === 'airtime') {
      result = await purchaseAirtime(
        formattedPhone,
        amount,
        networkProvider as NetworkProvider,
        customerFirstName,
        requestRef
      );
    } else if (type === 'data') {
      if (!dataPlanCode) {
        return NextResponse.json(
          { error: 'Data plan code is required for data purchases' },
          { status: 400 }
        );
      }
      result = await purchaseData(
        formattedPhone,
        dataPlanCode,
        amount,
        networkProvider as NetworkProvider,
        customerFirstName,
        requestRef
      );
    } else if (billItemIdentifier && customerIdentifier) {
      // Electricity, Cable TV, Betting — generic bill purchase
      result = await purchaseBill(
        billItemIdentifier,
        customerIdentifier,
        amount,
        customerFirstName,
        requestRef
      );
    } else {
      return NextResponse.json(
        { error: 'Missing bill item or customer identifier' },
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
        { error: result.message, reference: requestRef },
        { status: 400 }
      );
    }

    // Credit wallets
    let merchantWalletCredited = false;
    let customerWalletCredited = false;
    let customerNewBalance = 0;

    if (effectiveMerchantEarning > 0) {
      try {
        const { error: walletError } = await supabase.rpc(
          'credit_merchant_wallet',
          {
            p_merchant_id: merchant.id,
            p_amount: effectiveMerchantEarning,
            p_source_type: 'vtu_transaction',
            p_source_id: transaction.id,
            p_description: `VTU Commission - ${TYPE_LABELS[type]} ${commissionProvider} ₦${amount}${customerCashback > 0 ? ` (after ₦${customerCashback} cashback)` : ''}`,
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

    if (customerCashback > 0 && customerId) {
      try {
        const { data: customerWalletResult, error: customerWalletError } =
          await supabase.rpc('credit_customer_wallet', {
            p_customer_id: customerId,
            p_merchant_id: merchant.id,
            p_amount: customerCashback,
            p_source_type: 'vtu_transaction',
            p_source_id: transaction.id,
            p_description: `Cashback - ${TYPE_LABELS[type]} ${commissionProvider} ₦${amount}`,
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

    // Update transaction with wallet info
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
      message: `${TYPE_LABELS[type]} purchase successful`,
      reference: requestRef,
      transactionId: result.transactionId,
      amount,
      phoneNumber: isTelco ? formattedPhone : undefined,
      provider: commissionProvider,
      commission: {
        merchantEarning: effectiveMerchantEarning,
        merchantWalletCredited,
      },
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
