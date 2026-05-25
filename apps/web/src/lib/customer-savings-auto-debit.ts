import { getSavedPaymentMethodById } from '@/lib/customer-saved-payment-methods';
import {
  type GoalChargeResult,
  processSavingsGoal,
  type SavingsAutoDebitProcessDependencies,
} from '@/lib/customer-savings-auto-debit-process';
import {
  getLagosParts,
  getSavingsAutoDebitPeriodKey,
} from '@/lib/customer-savings-auto-debit-schedule';
import type {
  DueSavingsGoalRow,
  SavingsAutoDebitDatabaseClient,
} from '@/lib/customer-savings-auto-debit-types';
import { creditWalletTopUp } from '@/lib/customer-wallet-top-up';
import { chargeAuthorization } from '@/lib/paystack';

const AUTO_DEBIT_CONCURRENCY_LIMIT = 5;
const AUTO_DEBIT_FETCH_MULTIPLIER = 4;

interface ChargeDueInput {
  batchSize?: number;
  chargeAuthorizationFn?: typeof chargeAuthorization;
  creditWalletTopUpFn?: typeof creditWalletTopUp;
  loadSavedPaymentMethodFn?: typeof getSavedPaymentMethodById;
  now?: Date;
  supabase: SavingsAutoDebitDatabaseClient;
}

export interface ChargeDueCustomerSavingsGoalsResult {
  failed: number;
  processed: number;
  results: GoalChargeResult[];
  skipped: number;
}

function getLagosDate(now: Date) {
  return getLagosParts(now).date;
}

async function processSavingsGoalsWithConcurrency(
  dependencies: SavingsAutoDebitProcessDependencies,
  goals: DueSavingsGoalRow[]
) {
  const results = new Array<GoalChargeResult>(goals.length);
  let nextIndex = 0;
  const workerCount = Math.min(AUTO_DEBIT_CONCURRENCY_LIMIT, goals.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= goals.length) {
        break;
      }
      results[index] = await processSavingsGoal(dependencies, goals[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function chargeDueCustomerSavingsGoals({
  batchSize = 50,
  chargeAuthorizationFn = chargeAuthorization,
  creditWalletTopUpFn = creditWalletTopUp,
  loadSavedPaymentMethodFn = getSavedPaymentMethodById,
  now = new Date(),
  supabase,
}: ChargeDueInput): Promise<ChargeDueCustomerSavingsGoalsResult> {
  const fetchLimit = Math.max(
    batchSize * AUTO_DEBIT_FETCH_MULTIPLIER,
    batchSize
  );
  const dueGoals: DueSavingsGoalRow[] = [];
  const skippedResults: GoalChargeResult[] = [];
  let pageStart = 0;

  while (dueGoals.length < batchSize) {
    const { data, error } = await supabase
      .from('customer_savings_goals')
      .select(
        'id, merchant_id, customer_id, target_amount, current_amount, contribution_amount, contribution_frequency, preferred_debit_time, start_date, maturity_date, saved_payment_method_id'
      )
      .eq('status', 'active')
      .eq('source_mode', 'auto_debit')
      .lte('start_date', getLagosDate(now))
      .order('id', { ascending: true })
      .range(pageStart, pageStart + fetchLimit - 1);

    if (error) {
      throw new Error(error.message ?? 'Failed to fetch due savings goals');
    }

    const goals = (data ?? []) as DueSavingsGoalRow[];
    for (const goal of goals) {
      const periodKey = getSavingsAutoDebitPeriodKey(goal, now);
      if (periodKey && dueGoals.length < batchSize) {
        dueGoals.push(goal);
        continue;
      }

      skippedResults.push({
        goalId: goal.id,
        idempotencyKey: '',
        reference: '',
        reason: periodKey ? 'batch_limit' : 'not_due',
        status: 'skipped',
      });
    }

    if (goals.length < fetchLimit) {
      break;
    }

    pageStart += fetchLimit;
  }

  const results = [
    ...(await processSavingsGoalsWithConcurrency(
      {
        chargeAuthorizationFn,
        creditWalletTopUpFn,
        loadSavedPaymentMethodFn,
        now,
        supabase,
      },
      dueGoals
    )),
    ...skippedResults,
  ];

  return {
    failed: results.filter((result) => result.status === 'failed').length,
    processed: results.filter((result) => result.status === 'charged').length,
    results,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };
}
