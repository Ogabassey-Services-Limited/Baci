'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { payoutMerchantCommission } from '@/lib/kuda';
import { createClient } from '@/lib/supabase/server';

const MIN_WITHDRAWAL_AMOUNT = 1000;

export type WalletData = {
  id: string;
  availableBalance: number;
  pendingBalance: number;
  upcomingBalance: number;
  upcomingCount: number;
  totalEarned: number;
  totalWithdrawn: number;
  autoPayoutEnabled: boolean;
  autoPayoutDay: string;
  minPayoutAmount: number;
  lastPayoutAt: string | null;
  lastPayoutAmount: number | null;
  canWithdraw: boolean;
  nextSettlementDate: string | null;
  nextSettlementAmount: number | null;
};

export type PendingSettlement = {
  id: string;
  amount: number;
  gateway: string;
  sourceType: string;
  expectedDate: string;
  description: string;
};

export type Transaction = {
  id: string;
  type: 'credit' | 'debit' | 'withdrawal' | 'payout';
  amount: number;
  balanceAfter: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
};

export async function getWalletData(merchantId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get pending settlements
  const { data: pendingSettlements } = await supabase
    .from('merchant_settlements')
    .select(
      'id, net_amount, gateway, source_type, expected_settlement_date, description'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'pending')
    .order('expected_settlement_date', { ascending: true })
    .limit(10);

  // Get wallet summary
  const { data: walletSummary, error: summaryError } = await supabase.rpc(
    'get_wallet_summary',
    { p_merchant_id: merchantId }
  );

  if (summaryError || !walletSummary?.[0]) {
    // Fallback if RPC fails or returns empty
    const { data: wallet } = await supabase
      .from('merchant_wallets')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (!wallet) return null;

    return {
      wallet: {
        id: wallet.id,
        availableBalance: Number(wallet.available_balance),
        pendingBalance: Number(wallet.pending_balance),
        upcomingBalance: Number(wallet.upcoming_balance || 0),
        upcomingCount: wallet.upcoming_count || 0,
        totalEarned: Number(wallet.total_earned),
        totalWithdrawn: Number(wallet.total_withdrawn),
        autoPayoutEnabled: wallet.auto_payout_enabled,
        autoPayoutDay: wallet.auto_payout_day,
        minPayoutAmount: Number(wallet.min_payout_amount),
        lastPayoutAt: wallet.last_payout_at,
        lastPayoutAmount: wallet.last_payout_amount
          ? Number(wallet.last_payout_amount)
          : null,
        canWithdraw: Number(wallet.available_balance) >= 1000,
        nextSettlementDate: null,
        nextSettlementAmount: null,
      } as WalletData,
      pendingSettlements: [] as PendingSettlement[],
    };
  }

  const summary = walletSummary[0];

  // Get additional settings not in summary
  const { data: walletSettings } = await supabase
    .from('merchant_wallets')
    .select(
      'auto_payout_enabled, auto_payout_day, min_payout_amount, last_payout_at, last_payout_amount'
    )
    .eq('id', summary.wallet_id)
    .single();

  return {
    wallet: {
      id: summary.wallet_id,
      availableBalance: Number(summary.available_balance),
      pendingBalance: Number(summary.pending_balance),
      upcomingBalance: Number(summary.upcoming_balance),
      upcomingCount: summary.upcoming_count,
      totalEarned: Number(summary.total_earned),
      totalWithdrawn: Number(summary.total_withdrawn),
      autoPayoutEnabled: walletSettings?.auto_payout_enabled ?? true,
      autoPayoutDay: walletSettings?.auto_payout_day ?? 'monday',
      minPayoutAmount: Number(walletSettings?.min_payout_amount || 1000),
      lastPayoutAt: walletSettings?.last_payout_at,
      lastPayoutAmount: walletSettings?.last_payout_amount
        ? Number(walletSettings.last_payout_amount)
        : null,
      canWithdraw: summary.can_withdraw,
      nextSettlementDate: summary.next_settlement_date,
      nextSettlementAmount: summary.next_settlement_amount
        ? Number(summary.next_settlement_amount)
        : null,
    } as WalletData,
    pendingSettlements: (pendingSettlements || []).map((s) => ({
      id: s.id,
      amount: Number(s.net_amount),
      gateway: s.gateway,
      sourceType: s.source_type,
      expectedDate: s.expected_settlement_date,
      description: s.description,
    })) as PendingSettlement[],
  };
}

export async function getTransactions(merchantId: string, limit = 10) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: transactions } = await supabase
    .from('merchant_transactions')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (transactions || []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    balanceAfter: Number(tx.balance_after),
    status: tx.status,
    description: tx.description,
    createdAt: tx.created_at,
  })) as Transaction[];
}

export async function updateWalletSettings(
  merchantId: string,
  settings: {
    autoPayoutEnabled?: boolean;
    autoPayoutDay?: string;
    minPayoutAmount?: number;
  }
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const updates: Record<string, unknown> = {};
  if (typeof settings.autoPayoutEnabled === 'boolean') {
    updates.auto_payout_enabled = settings.autoPayoutEnabled;
  }
  if (settings.autoPayoutDay) {
    updates.auto_payout_day = settings.autoPayoutDay.toLowerCase();
  }
  if (settings.minPayoutAmount) {
    updates.min_payout_amount = settings.minPayoutAmount;
  }

  const { error } = await supabase
    .from('merchant_wallets')
    .update(updates)
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('Failed to update wallet settings:', error);
    return { success: false, error: 'Failed to update settings' };
  }

  revalidatePath('/dashboard/wallet');
  return { success: true };
}

export async function withdrawFunds(merchantId: string, amount?: number) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get merchant bank details
  const { data: merchant } = await supabase
    .from('merchants')
    .select(
      'id, business_name, bank_account_number, bank_code, bank_account_name'
    )
    .eq('id', merchantId)
    .single();

  if (
    !merchant?.bank_account_number ||
    !merchant?.bank_code ||
    !merchant?.bank_account_name
  ) {
    return {
      success: false,
      error: 'Bank details not configured. Please check your Payment settings.',
    };
  }

  // Get wallet
  const { data: wallet } = await supabase
    .from('merchant_wallets')
    .select('id, available_balance')
    .eq('merchant_id', merchantId)
    .single();

  if (!wallet) {
    return { success: false, error: 'Wallet not found' };
  }

  const availableBalance = Number(wallet.available_balance);
  const withdrawAmount = amount ? Number(amount) : availableBalance;

  if (withdrawAmount < MIN_WITHDRAWAL_AMOUNT) {
    return {
      success: false,
      error: `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`,
    };
  }

  if (withdrawAmount > availableBalance) {
    return { success: false, error: 'Insufficient balance' };
  }

  // Debit wallet (creates pending transaction)
  const { data: debitResult, error: debitError } = await supabase.rpc(
    'debit_merchant_wallet',
    {
      p_merchant_id: merchantId,
      p_amount: withdrawAmount,
      p_type: 'withdrawal',
      p_description: `Manual withdrawal to ${merchant.bank_account_name}`,
    }
  );

  if (debitError || !debitResult?.[0]?.success) {
    return {
      success: false,
      error: debitResult?.[0]?.error_message || 'Failed to process withdrawal',
    };
  }

  const transactionId = debitResult[0].transaction_id;

  // Execute bank transfer via Kuda
  try {
    const transferResult = await payoutMerchantCommission(
      {
        accountNumber: merchant.bank_account_number,
        bankCode: merchant.bank_code,
        accountName: merchant.bank_account_name,
      },
      withdrawAmount,
      merchantId
    );

    // Complete withdrawal with result
    await supabase.rpc('complete_wallet_withdrawal', {
      p_transaction_id: transactionId,
      p_success: transferResult.success,
      p_transfer_reference: transferResult.reference,
      p_transfer_message: transferResult.message,
    });

    if (!transferResult.success) {
      return {
        success: false,
        error: 'Transfer failed. Your balance has been restored.',
      };
    }

    revalidatePath('/dashboard/wallet');
    return {
      success: true,
      amount: withdrawAmount,
      reference: transferResult.reference,
    };
  } catch (transferError) {
    console.error('Transfer execution error:', transferError);
    // Refund balance on error
    await supabase.rpc('complete_wallet_withdrawal', {
      p_transaction_id: transactionId,
      p_success: false,
      p_transfer_reference: null,
      p_transfer_message:
        transferError instanceof Error
          ? transferError.message
          : 'Transfer failed',
    });

    return {
      success: false,
      error: 'Transfer failed. Your balance has been restored.',
    };
  }
}
