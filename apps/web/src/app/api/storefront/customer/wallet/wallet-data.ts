/**
 * Data helpers for `GET /api/storefront/customer/wallet`. Extracted from the
 * route so the handler stays focused on auth + orchestration and under the
 * 300-line budget. Kept colocated (same folder) — these are route-private.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export interface WalletFundingAccountRow {
  account_name: string;
  account_number: string;
  bank_name: string;
  provider: string;
}

export interface CustomerWalletTransactionRow {
  amount: number | string;
  balance_after: number | string | null;
  created_at: string | null;
  description: string | null;
  id: string;
  source_type: string | null;
  type: string;
}

export function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function formatFundingAccount(row: WalletFundingAccountRow | null) {
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

export function emptyWalletResponse({
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

export function logOptionalWalletHelperFailure(
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

export async function getSavingsBalance({
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

export async function getFundingAccount({
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

export async function getUsdtBalance({
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

/**
 * The wallet's NGN balance plus its recent transactions — the pre-transfer
 * BASELINE the client-side funding check loop reads.
 *
 * Fails LOUD on any real error rather than collapsing to an empty result:
 * - PGRST116 ("no row returned") is the truth — the customer has no wallet yet
 *   — and maps to `no-wallet`, a legitimately empty response.
 * - Any OTHER wallet error, or a transactions error, maps to `error`. An empty
 *   `transactions` list served as success is indistinguishable from "this
 *   wallet has no history", which would hand the loop an empty baseline and let
 *   an OLD top-up settle as the customer's new transfer — a false "money
 *   received". The route turns `error` into a 500 so the client stays
 *   fail-closed. `source_type` is selected because `type` is 'credit' for
 *   cashback/refunds too; only `source_type = 'wallet_topup'` proves an inbound
 *   transfer landed.
 */
export type CustomerWalletFetch =
  | { kind: 'error' }
  | { kind: 'no-wallet' }
  | {
      availableBalance: number;
      kind: 'ok';
      totalEarned: number;
      totalRedeemed: number;
      transactions: CustomerWalletTransactionRow[];
    };

export async function fetchCustomerWallet({
  customerId,
  merchantId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  supabase: SupabaseClient<Database>;
}): Promise<CustomerWalletFetch> {
  const { data: wallet, error: walletError } = await supabase
    .from('customer_wallets')
    .select('id, available_balance, total_earned, total_redeemed')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (walletError && walletError.code !== 'PGRST116') {
    console.error('Customer wallet lookup error:', walletError);
    return { kind: 'error' };
  }

  if (!wallet) {
    return { kind: 'no-wallet' };
  }

  const { data: transactions, error: transactionsError } = await supabase
    .from('customer_wallet_transactions')
    .select(
      'id, type, amount, balance_after, description, created_at, source_type'
    )
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (transactionsError) {
    console.error('Customer wallet transactions error:', transactionsError);
    return { kind: 'error' };
  }

  return {
    availableBalance: toNumber(wallet.available_balance),
    kind: 'ok',
    totalEarned: toNumber(wallet.total_earned),
    totalRedeemed: toNumber(wallet.total_redeemed),
    transactions: (transactions ?? []) as CustomerWalletTransactionRow[],
  };
}
