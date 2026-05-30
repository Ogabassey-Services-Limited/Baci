import type {
  DueSavingsGoalRow,
  ExistingContributionRow,
  SavingsAutoDebitDatabaseClient,
  TransactionRow,
} from '@/lib/customer-savings-auto-debit-types';

export async function getExistingSavingsContribution(
  supabase: SavingsAutoDebitDatabaseClient,
  merchantId: string,
  idempotencyKey: string
) {
  const { data, error } = await supabase
    .from('customer_savings_contributions')
    .select('id, status')
    .eq('merchant_id', merchantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Failed to check savings contribution');
  }

  return data as ExistingContributionRow | null;
}

export async function createSavingsAutoDebitTransaction({
  amount,
  goal,
  idempotencyKey,
  nowIso,
  periodKey,
  reference,
  supabase,
}: {
  amount: number;
  goal: DueSavingsGoalRow;
  idempotencyKey: string;
  nowIso: string;
  periodKey: string;
  reference: string;
  supabase: SavingsAutoDebitDatabaseClient;
}) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      amount,
      currency: 'NGN',
      description: 'Customer savings auto-debit contribution',
      gateway: 'paystack',
      gateway_reference: reference,
      merchant_amount: 0,
      merchant_id: goal.merchant_id,
      metadata: {
        customer_id: goal.customer_id,
        goal_id: goal.id,
        idempotency_key: idempotencyKey,
        period_key: periodKey,
        transaction_type: 'savings_auto_debit',
      },
      order_id: null,
      platform_fee: 0,
      status: 'pending',
      transaction_type: 'payment',
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create savings transaction');
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    (typeof (data as TransactionRow).id !== 'string' &&
      typeof (data as TransactionRow).id !== 'number')
  ) {
    throw new Error('Savings transaction insert did not return a valid id');
  }

  return String((data as TransactionRow).id);
}

export async function markSavingsAutoDebitContributionFailed(
  supabase: SavingsAutoDebitDatabaseClient,
  contributionId: string,
  reason: string,
  nowIso: string
) {
  const { error } = await supabase
    .from('customer_savings_contributions')
    .update({
      failed_at: nowIso,
      failure_reason: reason,
      status: 'failed',
      updated_at: nowIso,
    })
    .eq('id', contributionId);

  if (error) {
    throw new Error(
      `Failed to mark savings contribution ${contributionId} as failed: ${
        error.message ?? reason
      }`
    );
  }
}

export async function recordSavingsAllocationReconciliation({
  amount,
  error,
  goal,
  idempotencyKey,
  reference,
  supabase,
  transactionId,
  walletCreditApplied,
}: {
  amount: number;
  error: unknown;
  goal: DueSavingsGoalRow;
  idempotencyKey: string;
  reference: string;
  supabase: SavingsAutoDebitDatabaseClient;
  transactionId: string;
  walletCreditApplied: boolean;
}) {
  const errorMessage =
    error instanceof Error ? error.message : 'Savings allocation failed';
  const { error: reconciliationError } = await supabase
    .from('reconciliation_review')
    .insert({
      issue_type: 'customer_savings_auto_debit_allocation_failed',
      metadata: {
        amount,
        customer_id: goal.customer_id,
        goal_id: goal.id,
        idempotency_key: idempotencyKey,
        merchant_id: goal.merchant_id,
        wallet_credit_applied: walletCreditApplied,
      },
      paystack_ref: reference,
      reason: errorMessage,
      txn_id: transactionId,
    });

  if (reconciliationError) {
    throw new Error(
      `Savings auto-debit post-charge failure needed reconciliation, and reconciliation filing failed: ${
        reconciliationError.message ?? errorMessage
      }`
    );
  }
}
