import {
  createSavingsAutoDebitTransaction,
  getExistingSavingsContribution,
  markSavingsAutoDebitContributionFailed,
  recordSavingsAllocationReconciliation,
} from '@/lib/customer-savings-auto-debit-db';
import {
  asSavingsNumber,
  getSavingsAutoDebitPeriodKey,
  getSavingsAutoDebitReference,
} from '@/lib/customer-savings-auto-debit-schedule';
import type {
  DueSavingsGoalRow,
  SavedChargeMethod,
  SavingsAutoDebitDatabaseClient,
} from '@/lib/customer-savings-auto-debit-types';
import type {
  ChargeAuthorizationResponse,
  PaystackResult,
} from '@/lib/paystack';

export interface GoalChargeResult {
  goalId: string;
  idempotencyKey: string;
  reference: string;
  status: 'charged' | 'failed' | 'skipped';
  reason?: string;
}

export interface SavingsAutoDebitProcessDependencies {
  chargeAuthorizationFn: typeof import('@/lib/paystack').chargeAuthorization;
  creditWalletTopUpFn: typeof import('@/lib/customer-wallet-top-up').creditWalletTopUp;
  loadSavedPaymentMethodFn: typeof import('@/lib/customer-saved-payment-methods').getSavedPaymentMethodById;
  now: Date;
  supabase: SavingsAutoDebitDatabaseClient;
}

function getFailureMessage(
  charge: PaystackResult<ChargeAuthorizationResponse>
) {
  if (!charge.success) {
    return charge.error;
  }
  return (
    charge.data.gateway_response ||
    charge.data.message ||
    'Saved card charge failed'
  );
}

function getUnexpectedChargeFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Saved card charge could not be completed';
}

export async function processSavingsGoal(
  input: SavingsAutoDebitProcessDependencies,
  goal: DueSavingsGoalRow
): Promise<GoalChargeResult> {
  const periodKey = getSavingsAutoDebitPeriodKey(goal, input.now);
  if (!periodKey) {
    return {
      goalId: goal.id,
      idempotencyKey: '',
      reference: '',
      reason: 'not_due',
      status: 'skipped',
    };
  }

  const remaining =
    asSavingsNumber(goal.target_amount) - asSavingsNumber(goal.current_amount);
  const amount = Math.min(asSavingsNumber(goal.contribution_amount), remaining);
  if (amount <= 0 || !goal.saved_payment_method_id) {
    return {
      goalId: goal.id,
      idempotencyKey: '',
      reference: '',
      reason: 'not_chargeable',
      status: 'skipped',
    };
  }

  const idempotencyKey = `savings:${goal.id}:${periodKey}`;
  const reference = getSavingsAutoDebitReference(goal.id, periodKey);
  const existing = await getExistingSavingsContribution(
    input.supabase,
    goal.merchant_id,
    idempotencyKey
  );
  if (existing) {
    return {
      goalId: goal.id,
      idempotencyKey,
      reference,
      reason: `existing_${existing.status}`,
      status: 'skipped',
    };
  }

  const savedMethod = (await input.loadSavedPaymentMethodFn({
    customerId: goal.customer_id,
    merchantId: goal.merchant_id,
    savedPaymentMethodId: goal.saved_payment_method_id,
    supabase: input.supabase,
  })) as SavedChargeMethod | null;
  if (
    !savedMethod?.authorization_code ||
    !savedMethod.provider_customer_email
  ) {
    return {
      goalId: goal.id,
      idempotencyKey,
      reference,
      reason: 'saved_payment_method_unavailable',
      status: 'failed',
    };
  }

  const nowIso = input.now.toISOString();
  const transactionId = await createSavingsAutoDebitTransaction({
    amount,
    goal,
    idempotencyKey,
    nowIso,
    periodKey,
    reference,
    supabase: input.supabase,
  });
  const { data: contribution, error: contributionError } = await input.supabase
    .from('customer_savings_contributions')
    .insert({
      amount,
      customer_id: goal.customer_id,
      goal_id: goal.id,
      idempotency_key: idempotencyKey,
      merchant_id: goal.merchant_id,
      metadata: {
        request_fingerprint: {
          amount,
          customerId: goal.customer_id,
          goalId: goal.id,
          merchantId: goal.merchant_id,
          sourceId: transactionId,
          sourceType: 'paystack_authorization',
        },
      },
      scheduled_for: nowIso,
      source_type: 'paystack_authorization',
      status: 'processing',
      transaction_id: transactionId,
    })
    .select('id')
    .single();

  if (contributionError || !contribution) {
    throw new Error(
      contributionError?.message ?? 'Failed to create savings contribution'
    );
  }
  const contributionId = contribution.id;

  let charge: PaystackResult<ChargeAuthorizationResponse>;
  try {
    charge = await input.chargeAuthorizationFn({
      amount: Math.round(amount * 100),
      authorization_code: savedMethod.authorization_code,
      email: savedMethod.provider_customer_email,
      metadata: {
        customer_id: goal.customer_id,
        goal_id: goal.id,
        idempotency_key: idempotencyKey,
        transaction_type: 'savings_auto_debit',
      },
      reference,
    });
  } catch (error) {
    const failureMessage = getUnexpectedChargeFailureMessage(error);
    const { error: transactionUpdateError } = await input.supabase
      .from('transactions')
      .update({
        gateway_response: { error: failureMessage },
        status: 'failed',
        updated_at: nowIso,
      })
      .eq('id', transactionId);

    if (transactionUpdateError) {
      throw new Error(
        `Failed to update savings auto-debit transaction ${transactionId}: ${
          transactionUpdateError.message ?? 'Transaction update failed'
        }`
      );
    }

    await markSavingsAutoDebitContributionFailed(
      input.supabase,
      contributionId,
      failureMessage,
      nowIso
    );
    return { goalId: goal.id, idempotencyKey, reference, status: 'failed' };
  }

  const { error: transactionUpdateError } = await input.supabase
    .from('transactions')
    .update({
      gateway_response: charge.success ? charge.data : charge,
      status:
        charge.success && charge.data.status === 'success'
          ? 'completed'
          : 'failed',
      updated_at: nowIso,
    })
    .eq('id', transactionId);

  if (transactionUpdateError) {
    throw new Error(
      `Failed to update savings auto-debit transaction ${transactionId}: ${
        transactionUpdateError.message ?? 'Transaction update failed'
      }`
    );
  }

  if (!charge.success || charge.data.status !== 'success') {
    await markSavingsAutoDebitContributionFailed(
      input.supabase,
      contributionId,
      getFailureMessage(charge),
      nowIso
    );
    return { goalId: goal.id, idempotencyKey, reference, status: 'failed' };
  }

  let walletCreditApplied = false;
  try {
    await input.creditWalletTopUpFn({
      amount,
      customerId: goal.customer_id,
      gateway: 'paystack',
      merchantId: goal.merchant_id,
      reference,
      supabase: input.supabase,
      transactionId,
    });
    walletCreditApplied = true;

    const { error: allocationError } = await input.supabase.rpc(
      'allocate_customer_savings_contribution',
      {
        p_amount: amount,
        p_customer_id: goal.customer_id,
        p_description: 'Scheduled device savings auto-debit',
        p_goal_id: goal.id,
        p_idempotency_key: idempotencyKey,
        p_merchant_id: goal.merchant_id,
        p_source_id: transactionId,
        p_source_type: 'paystack_authorization',
      }
    );
    if (allocationError) {
      throw new Error(allocationError.message ?? 'Savings allocation failed');
    }
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      recordSavingsAllocationReconciliation({
        amount,
        error,
        goal,
        idempotencyKey,
        reference,
        supabase: input.supabase,
        transactionId,
        walletCreditApplied,
      }),
      markSavingsAutoDebitContributionFailed(
        input.supabase,
        contributionId,
        getUnexpectedChargeFailureMessage(error),
        nowIso
      ),
    ]);
    const cleanupFailure = cleanupResults.find(
      (result) => result.status === 'rejected'
    );
    if (cleanupFailure?.status === 'rejected') {
      throw cleanupFailure.reason;
    }
    throw error;
  }

  return { goalId: goal.id, idempotencyKey, reference, status: 'charged' };
}
