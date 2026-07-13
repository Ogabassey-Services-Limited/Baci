/**
 * Customer Wallet API
 * GET /api/storefront/customer/wallet - Get customer's wallet balance and recent transactions
 *
 * 2025 Best Practices:
 * - Progressive disclosure: Only show wallet if balance > 0
 * - Real-time balance for checkout
 * - Transaction history for transparency
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import type { Database } from '@/types/supabase';

interface CustomerWalletOwner {
  id: string;
  loyalty_points: number | string | null;
}

interface WalletFundingAccountRow {
  account_name: string;
  account_number: string;
  bank_name: string;
  provider: string;
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatFundingAccount(row: WalletFundingAccountRow | null) {
  if (row?.provider !== 'paystack') {
    return null;
  }

  return {
    accountName: row.account_name,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    provider: 'paystack',
  };
}

function emptyWalletResponse({
  fundingAccount = null,
  loyaltyPoints = 0,
  requiresFundingAccountConsent,
  savingsBalance = 0,
  usdtBalance = 0,
  walletDvaEnabled = false,
}: {
  fundingAccount?: ReturnType<typeof formatFundingAccount>;
  loyaltyPoints?: number;
  requiresFundingAccountConsent?: boolean;
  savingsBalance?: number;
  usdtBalance?: number;
  walletDvaEnabled?: boolean;
} = {}) {
  return {
    balance: 0,
    balances: { NGN: 0, USDT: usdtBalance },
    earningsBalance: 0,
    fundingAccount,
    hasWallet: usdtBalance > 0,
    loyaltyPoints,
    requiresFundingAccountConsent:
      requiresFundingAccountConsent ?? !fundingAccount,
    savingsBalance,
    totalEarned: 0,
    totalRedeemed: 0,
    transactions: [],
    walletDvaEnabled,
  };
}

function logOptionalWalletHelperFailure(
  label: string,
  result: PromiseSettledResult<unknown>
) {
  if (result.status === 'rejected') {
    console.error('Customer wallet optional fetch failed', {
      error: result.reason,
      label,
    });
  }
}

async function getSavingsBalance({
  customerId,
  merchantId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  supabase: SupabaseClient<Database>;
}) {
  const { data, error } = await supabase
    .from('customer_savings_goals')
    .select('current_amount')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .in('status', ['active', 'paused', 'completed']);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce(
    (total, row) => total + toNumber(row.current_amount),
    0
  );
}

async function getFundingAccount({
  customerId,
  merchantId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  supabase: SupabaseClient<Database>;
}) {
  const { data, error } = await supabase
    .from('customer_wallet_payment_accounts')
    .select('account_name, account_number, bank_name, provider')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .eq('provider', 'paystack')
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return formatFundingAccount(data as WalletFundingAccountRow | null);
}

async function getUsdtBalance({
  customerId,
  merchantId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  supabase: SupabaseClient<Database>;
}) {
  const { data, error } = await supabase
    .from('customer_wallet_accounts')
    .select('available_balance')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .eq('currency', 'USDT')
    .maybeSingle();
  if (error) throw error;
  return toNumber(data?.available_balance);
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: 'Unauthorized', balance: 0, transactions: [] },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchant');

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    const { supabase, user } = auth;

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Whether this merchant offers wallet bank-transfer (DVA) funding. Lets
    // the client hide the "Pay with Bank Transfer" CTA when it would only
    // route to a DVA_DISABLED dead end. Read via the SECURITY DEFINER
    // storefront-settings RPC — a direct merchant_feature_settings SELECT is
    // RLS-restricted to merchant staff, so it returns no row for customers.
    const { data: storefrontPaymentSettings, error: paymentSettingsError } =
      await supabase.rpc('get_storefront_payment_settings', {
        p_merchant_id: merchant.id,
      });
    if (paymentSettingsError) {
      // Fail soft (walletDvaEnabled stays false), but log so an RPC outage is
      // distinguishable from a merchant genuinely having DVA disabled.
      console.error('Customer wallet optional fetch failed', {
        error: paymentSettingsError,
        label: 'storefront payment settings',
      });
    }
    const paymentSettingsRow = Array.isArray(storefrontPaymentSettings)
      ? storefrontPaymentSettings[0]
      : storefrontPaymentSettings;
    const walletDvaEnabled =
      paymentSettingsRow?.wallet_paystack_dva_enabled === true;

    // Get customer record for this user + merchant
    // Try by user_id first, then fallback to email (guest customers may not have user_id linked)
    let customer: CustomerWalletOwner | null = null;

    // First try by user_id (for customers who registered/logged in)
    const { data: customerByUserId } = await supabase
      .from('customers')
      .select('id, loyalty_points')
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .single();

    if (customerByUserId) {
      customer = customerByUserId;
    } else if (user.email) {
      // Fallback: try by email (for customers created as guests who later logged in)
      // Keep this GET read-only. Customer user_id linkage is owned by the
      // storefront auth session upsert flow, not by wallet reads.
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select('id, loyalty_points')
        .eq('merchant_id', merchant.id)
        .eq('email', user.email)
        .single();

      if (customerByEmail) {
        customer = customerByEmail;
      }
    }

    if (!customer) {
      // Customer doesn't exist yet - return zero balance. No customer row
      // means account creation would fail ("Customer not found"), so never
      // advertise the funding consent CTA for this response.
      return NextResponse.json(
        emptyWalletResponse({
          requiresFundingAccountConsent: false,
          walletDvaEnabled,
        })
      );
    }

    const loyaltyPoints = toNumber(customer.loyalty_points);
    const [savingsBalanceResult, fundingAccountResult, usdtBalanceResult] =
      await Promise.allSettled([
        getSavingsBalance({
          customerId: customer.id,
          merchantId: merchant.id,
          supabase,
        }),
        getFundingAccount({
          customerId: customer.id,
          merchantId: merchant.id,
          supabase,
        }),
        getUsdtBalance({
          customerId: customer.id,
          merchantId: merchant.id,
          supabase,
        }),
      ]);
    const savingsBalance =
      savingsBalanceResult.status === 'fulfilled'
        ? savingsBalanceResult.value
        : 0;
    const fundingAccount =
      fundingAccountResult.status === 'fulfilled'
        ? fundingAccountResult.value
        : null;
    const usdtBalance =
      usdtBalanceResult.status === 'fulfilled' ? usdtBalanceResult.value : 0;
    logOptionalWalletHelperFailure('savings balance', savingsBalanceResult);
    logOptionalWalletHelperFailure('funding account', fundingAccountResult);
    logOptionalWalletHelperFailure('USDT balance', usdtBalanceResult);

    // Get customer wallet
    const { data: wallet, error: walletError } = await supabase
      .from('customer_wallets')
      .select('id, available_balance, total_earned, total_redeemed')
      .eq('customer_id', customer.id)
      .eq('merchant_id', merchant.id)
      .single();

    if (walletError || !wallet) {
      // No wallet yet - return zero balance
      return NextResponse.json(
        emptyWalletResponse({
          fundingAccount,
          loyaltyPoints,
          savingsBalance,
          usdtBalance,
          walletDvaEnabled,
        })
      );
    }

    // Get recent transactions (last 10)
    const { data: transactions } = await supabase
      .from('customer_wallet_transactions')
      .select('id, type, amount, balance_after, description, created_at')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      balance: toNumber(wallet.available_balance),
      balances: {
        NGN: toNumber(wallet.available_balance),
        USDT: usdtBalance,
      },
      earningsBalance: toNumber(wallet.available_balance),
      fundingAccount,
      loyaltyPoints,
      requiresFundingAccountConsent: !fundingAccount,
      savingsBalance,
      totalEarned: toNumber(wallet.total_earned),
      totalRedeemed: toNumber(wallet.total_redeemed),
      transactions: transactions || [],
      walletDvaEnabled,
      hasWallet: true,
    });
  } catch (error) {
    console.error('Customer wallet fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet', balance: 0, transactions: [] },
      { status: 500 }
    );
  }
}
