import { upsertPaystackAuthorization } from '@/lib/customer-saved-payment-methods';
import type { SavingsAutoDebitDatabaseClient } from '@/lib/customer-savings-auto-debit-types';
import { getSavingsPaystackAuthorization } from '@/lib/customer-savings-paystack-authorization';
import { creditWalletTopUp } from '@/lib/customer-wallet-top-up';

const SAVINGS_TRANSACTION_TYPES = new Set([
  'savings_authorization',
  'savings_auto_debit',
]);

interface SavingsWebhookTransaction {
  amount: number | string | null;
  id: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
}

interface SavingsWebhookResult {
  body: Record<string, unknown>;
  handled: true;
  status: number;
}

declare const verifiedPaystackWebhookSignatureBrand: unique symbol;

export type VerifiedPaystackWebhookSignature = {
  readonly [verifiedPaystackWebhookSignatureBrand]: true;
};

interface HandlePaystackSavingsWebhookInput {
  creditWalletTopUpFn?: typeof creditWalletTopUp;
  gatewayResponse: Record<string, unknown>;
  paystackSignature: VerifiedPaystackWebhookSignature | null;
  reference: string;
  supabase: SavingsAutoDebitDatabaseClient;
  transaction: SavingsWebhookTransaction;
  upsertAuthorizationFn?: typeof upsertPaystackAuthorization;
}

const VERIFIED_PAYSTACK_WEBHOOK_SIGNATURE = Object.freeze(
  {}
) as VerifiedPaystackWebhookSignature;

export function createVerifiedPaystackWebhookSignature(
  isVerified: boolean
): VerifiedPaystackWebhookSignature | null {
  return isVerified ? VERIFIED_PAYSTACK_WEBHOOK_SIGNATURE : null;
}

function getAmount(value: number | string | null) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isIdempotencyConflict(error: { code?: string; message?: string }) {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return (
    text.includes('duplicate') ||
    text.includes('idempotency') ||
    text.includes('unique constraint')
  );
}

async function findExistingContributionId({
  idempotencyKey,
  merchantId,
  supabase,
}: {
  idempotencyKey: string;
  merchantId: string;
  supabase: SavingsAutoDebitDatabaseClient;
}) {
  const { data, error } = await supabase
    .from('customer_savings_contributions')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error || !data || typeof data !== 'object' || !('id' in data)) {
    return null;
  }

  return getString((data as { id?: unknown }).id);
}

async function applySavingsContribution({
  amount,
  creditWalletTopUpFn,
  customerId,
  goalId,
  idempotencyKey,
  merchantId,
  reference,
  supabase,
  transactionId,
}: {
  amount: number;
  creditWalletTopUpFn: typeof creditWalletTopUp;
  customerId: string;
  goalId: string;
  idempotencyKey: string;
  merchantId: string;
  reference: string;
  supabase: SavingsAutoDebitDatabaseClient;
  transactionId: string;
}) {
  await creditWalletTopUpFn({
    amount,
    customerId,
    gateway: 'paystack',
    merchantId,
    reference,
    supabase,
    transactionId,
  });

  const { data, error } = await supabase.rpc(
    'allocate_customer_savings_contribution',
    {
      p_amount: amount,
      p_customer_id: customerId,
      p_description: 'Paystack savings contribution',
      p_goal_id: goalId,
      p_idempotency_key: idempotencyKey,
      p_merchant_id: merchantId,
      p_source_id: transactionId,
      p_source_type: 'paystack_authorization',
    }
  );

  if (error) {
    if (isIdempotencyConflict(error)) {
      const existingContributionId = await findExistingContributionId({
        idempotencyKey,
        merchantId,
        supabase,
      });
      if (existingContributionId) {
        return existingContributionId;
      }
    }
    throw new Error(error.message ?? 'Savings allocation failed');
  }

  const row = Array.isArray(data) ? data[0] : null;
  const contributionId =
    row && typeof row === 'object' && 'contribution_id' in row
      ? getString((row as { contribution_id?: unknown }).contribution_id)
      : null;
  return contributionId;
}

export async function handlePaystackSavingsWebhookTransaction({
  creditWalletTopUpFn = creditWalletTopUp,
  gatewayResponse,
  paystackSignature,
  reference,
  supabase,
  transaction,
  upsertAuthorizationFn = upsertPaystackAuthorization,
}: HandlePaystackSavingsWebhookInput): Promise<SavingsWebhookResult | null> {
  const metadata = transaction.metadata ?? {};
  const transactionType = getString(metadata.transaction_type);
  if (!transactionType || !SAVINGS_TRANSACTION_TYPES.has(transactionType)) {
    return null;
  }

  if (!paystackSignature) {
    return {
      body: { error: 'Verified Paystack signature is required' },
      handled: true,
      status: 401,
    };
  }

  const amount = getAmount(transaction.amount);
  const customerId = getString(metadata.customer_id);
  if (!amount || !customerId) {
    return {
      body: { error: 'Invalid savings transaction metadata' },
      handled: true,
      status: 400,
    };
  }

  if (transactionType === 'savings_authorization') {
    const customerEmail = getString(metadata.customer_email);
    const authorization = getSavingsPaystackAuthorization(gatewayResponse);
    if (authorization && customerEmail) {
      await upsertAuthorizationFn({
        authorization,
        customerEmail,
        customerId,
        merchantId: transaction.merchant_id,
        supabase,
      });
    }

    const accountingPolicy = getString(metadata.savings_accounting_policy);
    if (!accountingPolicy) {
      return {
        body: { error: 'Savings authorization accounting policy missing' },
        handled: true,
        status: 400,
      };
    }

    if (accountingPolicy === 'credit_wallet') {
      await creditWalletTopUpFn({
        amount,
        customerId,
        gateway: 'paystack',
        merchantId: transaction.merchant_id,
        reference,
        supabase,
        transactionId: transaction.id,
      });
      return {
        body: {
          message: 'Savings authorization credited to wallet',
          reference,
        },
        handled: true,
        status: 200,
      };
    }

    if (accountingPolicy !== 'apply_as_initial_contribution') {
      return {
        body: { error: 'Unsupported savings authorization accounting policy' },
        handled: true,
        status: 400,
      };
    }
  }

  const goalId = getString(metadata.goal_id);
  const idempotencyKey =
    getString(metadata.idempotency_key) ??
    (goalId ? `savings:${goalId}:initial` : null);
  if (!goalId || !idempotencyKey) {
    return {
      body: { error: 'Savings goal metadata missing' },
      handled: true,
      status: 400,
    };
  }

  let contributionId: string | null;
  try {
    contributionId = await applySavingsContribution({
      amount,
      creditWalletTopUpFn,
      customerId,
      goalId,
      idempotencyKey,
      merchantId: transaction.merchant_id,
      reference,
      supabase,
      transactionId: transaction.id,
    });
  } catch (error) {
    return {
      body: {
        error:
          error instanceof Error
            ? error.message
            : 'Savings contribution failed',
      },
      handled: true,
      status: 500,
    };
  }

  return {
    body: {
      contributionId,
      message:
        transactionType === 'savings_auto_debit'
          ? 'Savings auto-debit applied'
          : 'Savings authorization initial contribution applied',
      reference,
    },
    handled: true,
    status: 200,
  };
}
