import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT,
  type AgenticPaystackDvaTransaction,
  normalizeAgenticPaystackDvaTransaction,
} from '@/lib/agentic/paystack-dva-transaction';
import { findCustomerWalletPaymentAccountByReceiver } from '@/lib/customer-wallet-payment-accounts';
import { WALLET_TOP_UP_TRANSACTION_TYPE } from '@/lib/customer-wallet-top-up';
import { logger } from '@/lib/logger';
import { hasActivePaystackOrderDvaAlias } from '@/lib/payments/paystack-dva-order-alias';
import { captureServerEvent } from '@/lib/posthog/server';
import { WALLET_FUNDING_TELEMETRY } from '@/lib/posthog/wallet-funding-events';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export type ConfirmPaystackWalletDvaTopUpResult =
  | { kind: 'match'; transaction: AgenticPaystackDvaTransaction }
  | { kind: 'none' }
  | {
      body: { code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT'; error: string };
      kind: 'review';
      status: 409;
    };

function getCustomerEmail(paystackResponse: Record<string, unknown>) {
  const customer = paystackResponse.customer;
  if (!customer || typeof customer !== 'object') {
    return null;
  }

  const email = (customer as { email?: unknown }).email;
  return typeof email === 'string' && email.trim() ? email.trim() : null;
}

function getPaidAt(
  paystackResponse: Record<string, unknown>,
  gatewayReference: string
) {
  const paidAtRaw = paystackResponse.paid_at;
  const paidAt = typeof paidAtRaw === 'string' ? new Date(paidAtRaw) : null;
  if (paidAt && !Number.isNaN(paidAt.getTime())) {
    return paidAt;
  }

  logger.warn({
    message: 'Paystack wallet DVA top-up response missing valid paid_at',
    gatewayReference,
    paidAt: paidAtRaw,
  });
  return new Date();
}

async function fileOrderAliasReview({
  accountNumber,
  gatewayReference,
  paidAt,
  supabase,
  verifiedAmount,
}: {
  accountNumber: string;
  gatewayReference: string;
  paidAt: Date;
  supabase: SupabaseClient;
  verifiedAmount: { amount: number; currency?: string } | null;
}) {
  const { error } = await supabase.from('reconciliation_review').insert({
    candidates: [],
    issue_type: 'wallet_dva_order_alias_conflict',
    metadata: {
      account_number: accountNumber,
      paid_at: paidAt.toISOString(),
      verified_amount: verifiedAmount?.amount ?? null,
      verified_currency: verifiedAmount?.currency ?? null,
    },
    paystack_ref: gatewayReference,
    reason:
      'Paystack receiver account belongs to a wallet DVA but is still inside an active order DVA window.',
  });

  if (
    error &&
    (error as { code?: string }).code !== POSTGRES_UNIQUE_VIOLATION
  ) {
    logger.error({
      message: 'Failed to file wallet DVA order alias review',
      accountNumber,
      error,
      gatewayReference,
    });
  }
}

async function rereadWalletDvaTransaction({
  gatewayReference,
  supabase,
}: {
  gatewayReference: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('transactions')
    .select(AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT)
    .eq('gateway_reference', gatewayReference)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error('Wallet DVA transaction not found after conflict');
  }

  return normalizeAgenticPaystackDvaTransaction(data);
}

export async function confirmPaystackWalletDvaTopUp({
  accountNumber,
  gatewayReference,
  paystackResponse,
  supabase,
  verifiedAmount,
}: {
  accountNumber: string | null;
  gatewayReference: string;
  paystackResponse: Record<string, unknown>;
  supabase: SupabaseClient;
  verifiedAmount: { amount: number; currency?: string } | null;
}): Promise<ConfirmPaystackWalletDvaTopUpResult> {
  if (!accountNumber || !verifiedAmount) {
    return { kind: 'none' };
  }

  const walletAccount = await findCustomerWalletPaymentAccountByReceiver({
    receiverAccountNumber: accountNumber,
    supabase,
  });
  if (!walletAccount) {
    return { kind: 'none' };
  }

  const paidAt = getPaidAt(paystackResponse, gatewayReference);
  const aliasesActiveOrder = await hasActivePaystackOrderDvaAlias({
    accountNumber,
    asOf: paidAt,
    supabase,
  });

  if (aliasesActiveOrder) {
    await fileOrderAliasReview({
      accountNumber,
      gatewayReference,
      paidAt,
      supabase,
      verifiedAmount,
    });
    return {
      body: {
        code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
        error:
          'Receiver account is still reserved for an active order payment. Filed for manual reconciliation.',
      },
      kind: 'review',
      status: 409,
    };
  }

  const customerEmail = getCustomerEmail(paystackResponse);
  const metadata = {
    customer_email: customerEmail,
    customer_id: walletAccount.customerId,
    provider_account_id: walletAccount.providerAccountId,
    provider_customer_code: walletAccount.providerCustomerCode,
    transaction_type: WALLET_TOP_UP_TRANSACTION_TYPE,
    wallet_dva_account_number: accountNumber,
    wallet_payment_account_id: walletAccount.id,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      amount: verifiedAmount.amount,
      currency: verifiedAmount.currency ?? 'NGN',
      description: 'Customer wallet top-up via Paystack DVA',
      gateway: 'paystack',
      gateway_reference: gatewayReference,
      merchant_amount: 0,
      merchant_id: walletAccount.merchantId,
      metadata,
      order_id: null,
      platform_fee: 0,
      status: 'pending',
      transaction_type: 'payment',
    })
    .select(AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT)
    .single();

  if (
    error &&
    (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  ) {
    return {
      kind: 'match',
      transaction: await rereadWalletDvaTransaction({
        gatewayReference,
        supabase,
      }),
    };
  }

  if (error) {
    throw error;
  }

  // Funnel completion: fire only on the fresh insert (not the 23505 re-read
  // above, and not from the webhook call site — neither can distinguish a first
  // credit from a retry). Fail-open so telemetry never blocks the money path.
  await captureServerEvent(
    WALLET_FUNDING_TELEMETRY.events.transferCredited,
    {
      amount: verifiedAmount.amount,
      currency: verifiedAmount.currency ?? 'NGN',
      customer_id: walletAccount.customerId,
      gateway: 'paystack',
      gateway_reference: gatewayReference,
      merchant_id: walletAccount.merchantId,
    },
    walletAccount.customerId
  );

  return {
    kind: 'match',
    transaction: normalizeAgenticPaystackDvaTransaction(data),
  };
}
