import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  creditUsdtWalletTopUp,
  USDT_WALLET_TOP_UP_TRANSACTION_TYPE,
} from '@/lib/customer-wallet-account';

interface JuicywayWalletTransaction {
  id: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
  status: string;
}

interface JuicywaySettlement {
  amount: number;
  currency: string;
  [key: string]: unknown;
}

export async function handleJuicywayWalletTopUpIfNeeded({
  payment,
  reference,
  supabase,
  transaction,
}: {
  payment: JuicywaySettlement;
  reference: string;
  supabase: SupabaseClient;
  transaction: JuicywayWalletTransaction;
}): Promise<NextResponse | null> {
  const metadata = transaction.metadata ?? {};
  if (metadata.transaction_type !== USDT_WALLET_TOP_UP_TRANSACTION_TYPE) {
    return null;
  }

  const customerId = metadata.customer_id;
  const expectedAmount = Number(metadata.juicyway_expected_amount);
  const expectedCurrency = metadata.juicyway_expected_currency;
  const walletCreditAmount = Number(metadata.wallet_credit_amount);
  if (
    typeof customerId !== 'string' ||
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    expectedCurrency !== 'USDT' ||
    !Number.isFinite(walletCreditAmount) ||
    walletCreditAmount <= 0
  ) {
    return NextResponse.json(
      { error: 'Invalid wallet top-up metadata' },
      { status: 400 }
    );
  }

  const settledAmount = Number(payment.amount);
  const settledCurrency = payment.currency.trim().toUpperCase();
  if (
    !Number.isFinite(settledAmount) ||
    settledAmount < expectedAmount * 0.99 ||
    settledCurrency !== expectedCurrency
  ) {
    return NextResponse.json(
      { error: 'Payment amount or currency mismatch' },
      { status: 400 }
    );
  }

  const walletCredit = await creditUsdtWalletTopUp({
    amount: walletCreditAmount,
    customerId,
    merchantId: transaction.merchant_id,
    reference,
    supabase,
    transactionId: transaction.id,
  });
  const { error } = await supabase
    .from('transactions')
    .update({
      gateway_response: payment,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id);
  if (error) throw error;

  return NextResponse.json({
    message: 'USDT wallet top-up credited',
    reference,
    success: true,
    wallet: {
      balance: walletCredit.balance,
      currency: walletCredit.currency,
    },
  });
}
