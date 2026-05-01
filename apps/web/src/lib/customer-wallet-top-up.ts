import type { SupabaseClient } from '@supabase/supabase-js';

export const WALLET_TOP_UP_TRANSACTION_TYPE = 'wallet_topup';
const ALLOWED_WALLET_TOP_UP_GATEWAYS = ['paystack', 'korapay'] as const;

type WalletTopUpGateway = (typeof ALLOWED_WALLET_TOP_UP_GATEWAYS)[number];

interface CreditWalletTopUpInput {
  amount: number;
  customerId: string;
  gateway: string;
  merchantId: string;
  reference: string;
  supabase: SupabaseClient;
  transactionId: string;
}

interface WalletRpcSuccess {
  success: true;
  new_balance: number | string;
  transaction_id: string;
}

interface ExistingWalletTopUpCredit {
  balance_after: number | string;
  id: string;
}

export interface CreditWalletTopUpResult {
  balance: number;
  reference: string;
  transactionId: string;
}

function assertWalletTopUpGateway(value: string): WalletTopUpGateway {
  const normalizedValue = value.toLowerCase();
  if (
    ALLOWED_WALLET_TOP_UP_GATEWAYS.includes(
      normalizedValue as WalletTopUpGateway
    )
  ) {
    return normalizedValue as WalletTopUpGateway;
  }

  throw new Error('Unsupported wallet top-up gateway');
}

function isWalletRpcSuccess(value: unknown): value is WalletRpcSuccess {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.success === true &&
    (typeof record.new_balance === 'number' ||
      typeof record.new_balance === 'string') &&
    typeof record.transaction_id === 'string'
  );
}

function normalizeWalletRpcResult(data: unknown): WalletRpcSuccess {
  const result = Array.isArray(data) ? data[0] : data;
  if (!isWalletRpcSuccess(result)) {
    throw new Error('Invalid wallet credit response');
  }
  return result;
}

function isExistingWalletTopUpCredit(
  value: unknown
): value is ExistingWalletTopUpCredit {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (typeof record.balance_after === 'number' ||
      typeof record.balance_after === 'string')
  );
}

function normalizeWalletBalance(value: number | string) {
  const balance = Number(value);
  if (!Number.isFinite(balance)) {
    throw new Error('Invalid wallet balance returned after top-up');
  }

  return balance;
}

async function findExistingWalletTopUpCredit({
  customerId,
  merchantId,
  reference,
  supabase,
  transactionId,
}: Pick<
  CreditWalletTopUpInput,
  'customerId' | 'merchantId' | 'reference' | 'supabase' | 'transactionId'
>): Promise<CreditWalletTopUpResult | null> {
  const { data, error } = await supabase
    .from('customer_wallet_transactions')
    .select('balance_after, id')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .eq('source_type', WALLET_TOP_UP_TRANSACTION_TYPE)
    .eq('source_id', transactionId)
    .eq('type', 'credit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (!isExistingWalletTopUpCredit(data)) {
    throw new Error('Invalid existing wallet top-up credit response');
  }

  return {
    balance: normalizeWalletBalance(data.balance_after),
    reference,
    transactionId: data.id,
  };
}

export async function creditWalletTopUp({
  amount,
  customerId,
  gateway,
  merchantId,
  reference,
  supabase,
  transactionId,
}: CreditWalletTopUpInput): Promise<CreditWalletTopUpResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Top-up amount must be positive');
  }

  const validatedGateway = assertWalletTopUpGateway(gateway);
  // Webhooks and explicit confirmation can both arrive for the same payment.
  // Check the ledger first; the RPC repeats the same source-id guard under an
  // advisory lock so concurrent retries cannot double-credit the wallet.
  const existingCredit = await findExistingWalletTopUpCredit({
    customerId,
    merchantId,
    reference,
    supabase,
    transactionId,
  });

  if (existingCredit) {
    return existingCredit;
  }

  const { data, error } = await supabase.rpc('credit_customer_wallet', {
    p_amount: amount,
    p_customer_id: customerId,
    p_description: `Wallet top-up via ${validatedGateway}`,
    p_merchant_id: merchantId,
    p_source_id: transactionId,
    p_source_type: WALLET_TOP_UP_TRANSACTION_TYPE,
  });

  if (error) {
    throw error;
  }

  const result = normalizeWalletRpcResult(data);
  const balance = normalizeWalletBalance(result.new_balance);

  return {
    balance,
    reference,
    transactionId: result.transaction_id,
  };
}
