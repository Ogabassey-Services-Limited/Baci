import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export const USDT_WALLET_TOP_UP_TRANSACTION_TYPE = 'wallet_usdt_topup';

interface CreditUsdtWalletTopUpInput {
  amount: number;
  customerId: string;
  merchantId: string;
  reference: string;
  supabase: SupabaseClient;
  transactionId: string;
}

interface CurrencyWalletRpcResult {
  currency: 'USDT';
  new_balance: number | string;
  success: true;
  transaction_id: string;
}

function parseCurrencyWalletRpcResult(value: unknown): CurrencyWalletRpcResult {
  const result = Array.isArray(value) ? value[0] : value;
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid currency wallet credit response');
  }
  const record = result as Record<string, unknown>;
  if (
    record.success !== true ||
    record.currency !== 'USDT' ||
    (typeof record.new_balance !== 'number' &&
      typeof record.new_balance !== 'string') ||
    typeof record.transaction_id !== 'string'
  ) {
    throw new Error('Invalid currency wallet credit response');
  }
  return record as unknown as CurrencyWalletRpcResult;
}

export async function creditUsdtWalletTopUp({
  amount,
  customerId,
  merchantId,
  reference,
  supabase,
  transactionId,
}: CreditUsdtWalletTopUpInput) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('USDT wallet credit amount must be positive');
  }

  const { data, error } = await supabase.rpc('credit_customer_wallet_account', {
    p_amount: amount,
    p_currency: 'USDT',
    p_customer_id: customerId,
    p_description: 'USDT wallet top-up via Juicyway',
    p_merchant_id: merchantId,
    p_source_id: transactionId,
    p_source_type: USDT_WALLET_TOP_UP_TRANSACTION_TYPE,
  });
  if (error) throw error;

  const result = parseCurrencyWalletRpcResult(data);
  const balance = Number(result.new_balance);
  if (!Number.isFinite(balance)) {
    throw new Error('Invalid currency wallet balance');
  }
  return {
    balance,
    currency: result.currency,
    reference,
    transactionId: result.transaction_id,
  };
}
