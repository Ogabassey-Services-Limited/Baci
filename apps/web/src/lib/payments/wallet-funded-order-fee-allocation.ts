import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { OrderWalletFundingIntent } from '@/lib/order-wallet-funding-intents';

interface OrderWalletFundingIntentPaymentRow {
  amount: number | string | null;
  gateway_fee: number | string | null;
  paid_at?: string | null;
}

function isPaymentRow(row: unknown): row is OrderWalletFundingIntentPaymentRow {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return false;
  }
  const record = row as Record<string, unknown>;
  const hasAmount =
    record.amount === null ||
    typeof record.amount === 'number' ||
    typeof record.amount === 'string';
  const hasGatewayFee =
    record.gateway_fee === null ||
    typeof record.gateway_fee === 'number' ||
    typeof record.gateway_fee === 'string';
  const hasPaidAt =
    record.paid_at === undefined ||
    record.paid_at === null ||
    typeof record.paid_at === 'string';
  return (
    'amount' in record &&
    'gateway_fee' in record &&
    hasAmount &&
    hasGatewayFee &&
    hasPaidAt
  );
}

function toMoneyMinorUnits(value: number) {
  return Math.round(value * 100);
}

export async function getWalletFundedOrderAllocatedGatewayFee({
  fallbackFee,
  intent,
  supabase,
}: {
  fallbackFee: number;
  intent: OrderWalletFundingIntent;
  supabase: SupabaseClient;
}) {
  const validatedFallback =
    Number.isFinite(fallbackFee) && fallbackFee >= 0 ? fallbackFee : 0;
  const roundedFallback = Math.round(validatedFallback * 100) / 100;
  if (!intent.id) {
    return roundedFallback;
  }
  const { data, error } = await supabase
    .from('order_wallet_funding_intent_payments')
    .select('amount, gateway_fee, paid_at')
    .eq('intent_id', intent.id)
    .order('paid_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });
  if (error) {
    logger.warn({
      error,
      intentId: intent.id,
      message:
        'Falling back to verified gateway fee for wallet-funded order allocation',
    });
  }
  if (error || !Array.isArray(data)) {
    return roundedFallback;
  }
  if (data.length === 0) {
    return roundedFallback;
  }
  if (!Number.isFinite(intent.expectedAmount) || intent.expectedAmount <= 0) {
    return roundedFallback;
  }

  let remainingMinor = toMoneyMinorUnits(intent.expectedAmount);
  let allocatedMinor = 0;
  let totalGatewayFeeMinor: number | null = null;
  for (const row of data) {
    if (!isPaymentRow(row)) {
      continue;
    }
    if (row.amount === null || row.gateway_fee === null) {
      continue;
    }
    const amount = Number(row.amount);
    const gatewayFee = Number(row.gateway_fee);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(gatewayFee) ||
      gatewayFee < 0
    ) {
      continue;
    }
    const amountMinor = toMoneyMinorUnits(amount);
    const gatewayFeeMinor = toMoneyMinorUnits(gatewayFee);
    if (amountMinor <= 0 || gatewayFeeMinor < 0) {
      continue;
    }
    totalGatewayFeeMinor = (totalGatewayFeeMinor ?? 0) + gatewayFeeMinor;
    const appliedMinor = Math.min(amountMinor, remainingMinor);
    allocatedMinor += Math.round(
      (gatewayFeeMinor * appliedMinor) / amountMinor
    );
    remainingMinor -= appliedMinor;
    if (remainingMinor <= 0) break;
  }
  if (totalGatewayFeeMinor === null) {
    return roundedFallback;
  }
  return Math.min(allocatedMinor, totalGatewayFeeMinor) / 100;
}
