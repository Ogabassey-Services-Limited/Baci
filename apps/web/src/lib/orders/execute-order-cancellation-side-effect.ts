import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrderCancellationEmailMessage } from '@/lib/orders/build-order-cancellation-email-message';
import {
  DeliveryUncertainError,
  type OrderCancellationSideEffectStep,
} from '@/lib/orders/run-order-cancellation-side-effect';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';

type CancellationOrder = Parameters<
  typeof buildOrderCancellationEmailMessage
>[0]['order'] & {
  currency: string | null;
  merchant_id: string;
  payment_status: string;
};

type CancellationMerchant = Parameters<
  typeof buildOrderCancellationEmailMessage
>[0]['merchant'];
type CancellationEmailMessage = ReturnType<
  typeof buildOrderCancellationEmailMessage
>;
type CancellationEmailResult = {
  error?: string;
  messageId?: string;
  success: boolean;
};
export type CancellationEmailSender = (
  message: CancellationEmailMessage
) => Promise<CancellationEmailResult>;

interface GatewayPaymentTransaction {
  amount: number;
  currency: string | null;
  gateway: string;
  gateway_reference: string;
  id: string;
}

export async function executeOrderCancellationSideEffect({
  merchant,
  order,
  reason,
  sendCancellationEmail,
  step,
  supabase,
}: {
  merchant: CancellationMerchant;
  order: CancellationOrder;
  reason?: string;
  sendCancellationEmail?: CancellationEmailSender;
  step: OrderCancellationSideEffectStep;
  supabase: Pick<SupabaseClient, 'from'>;
}): Promise<{ messageId: string | null } | { refundIds: number[] }> {
  const refundAmount = Number(order.amount_paid) || 0;
  if (step === 'customer_email') {
    if (!sendCancellationEmail) {
      throw new Error('Cancellation email sender is required');
    }
    const emailResult = await sendCancellationEmail(
      buildOrderCancellationEmailMessage({
        cancelledBy: 'merchant',
        merchant,
        order,
        reason,
        refundAmount,
      })
    );
    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }
    return { messageId: emailResult.messageId ?? null };
  }

  const { data: transactionRows, error: transactionError } = await supabase
    .from('transactions')
    .select('id, amount, currency, gateway, gateway_reference')
    .eq('order_id', order.id)
    .eq('merchant_id', order.merchant_id)
    .eq('transaction_type', 'payment')
    .eq('status', 'completed')
    .not(
      'gateway',
      'in',
      '(wallet,savings,store_credit,cash,manual,pay_on_delivery)'
    )
    .order('created_at', { ascending: true });
  if (transactionError || !transactionRows?.length) {
    throw new Error('No completed payment transaction found');
  }
  const transactions = transactionRows as GatewayPaymentTransaction[];
  if (transactions.some((transaction) => !transaction.gateway_reference)) {
    throw new Error('Completed payment transaction has no gateway reference');
  }
  const gatewayRefundAmount = transactions.reduce(
    (total, transaction) => total + (Number(transaction.amount) || 0),
    0
  );
  if (
    gatewayRefundAmount <= 0 ||
    transactions.some((transaction) => Number(transaction.amount) <= 0)
  ) {
    throw new Error('Completed payment transaction has no refundable amount');
  }
  const unsupportedGateways = [
    ...new Set(
      transactions
        .filter((transaction) => transaction.gateway !== 'paystack')
        .map((transaction) => transaction.gateway)
    ),
  ];
  if (unsupportedGateways.length > 0) {
    const firstTransaction = transactions[0];
    const { error: reviewError } = await supabase
      .from('reconciliation_review')
      .insert({
        candidates: transactions.map((transaction) => ({
          amount: Number(transaction.amount),
          currency: transaction.currency ?? order.currency ?? 'NGN',
          gateway: transaction.gateway,
          gatewayReference: transaction.gateway_reference,
          paymentTransactionId: transaction.id,
        })),
        issue_type: 'order_cancellation_refund_requires_review',
        merchant_id: order.merchant_id,
        order_id: order.id,
        paystack_ref: firstTransaction.gateway_reference,
        reason: `Automatic cancellation refund is unavailable for gateway(s) ${unsupportedGateways.join(', ')}`,
        txn_id: firstTransaction.id,
      });
    const duplicateReview =
      (reviewError as { code?: string } | null)?.code === '23505';
    if (reviewError && !duplicateReview) {
      throw new Error('Failed to file manual refund reconciliation review');
    }
    throw new DeliveryUncertainError(
      `Manual refund reconciliation required for gateway(s) ${unsupportedGateways.join(', ')}`
    );
  }

  const { data: refundRows, error: refundLookupError } = await supabase
    .from('transactions')
    .select('metadata')
    .eq('order_id', order.id)
    .eq('merchant_id', order.merchant_id)
    .eq('transaction_type', 'refund')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });
  if (refundLookupError) {
    throw new Error('Unable to verify existing cancellation refunds');
  }
  const refundedPaymentIds = new Set(
    (refundRows ?? [])
      .map((row) => {
        const metadata = row.metadata;
        return metadata &&
          typeof metadata === 'object' &&
          !Array.isArray(metadata)
          ? metadata.payment_transaction_id
          : null;
      })
      .filter((id): id is string => typeof id === 'string')
  );
  const refundIds: number[] = [];

  for (const transaction of transactions) {
    if (refundedPaymentIds.has(transaction.id)) continue;
    const transactionAmount = Number(transaction.amount);
    const paystackRefund = await initiatePaystackRefund(
      transaction.gateway_reference,
      Math.round(transactionAmount * 100),
      reason || 'Order cancelled'
    );
    if (!paystackRefund.success) {
      const isAmbiguousFailure =
        paystackRefund.code === 'NETWORK_ERROR' ||
        paystackRefund.code?.startsWith('HTTP_5');
      const RefundError = isAmbiguousFailure ? DeliveryUncertainError : Error;
      throw new RefundError(paystackRefund.error);
    }

    const { error: insertTxError } = await supabase
      .from('transactions')
      .insert({
        merchant_id: order.merchant_id,
        order_id: order.id,
        transaction_type: 'refund',
        amount: transactionAmount,
        currency: transaction.currency || order.currency || 'NGN',
        status: 'completed',
        gateway: transaction.gateway,
        gateway_reference: String(paystackRefund.data.id),
        description: `Refund for cancelled order #${order.order_number || order.id.slice(0, 8)}`,
        metadata: {
          cancellation_reason: reason ?? null,
          payment_transaction_id: transaction.id,
        },
      });
    if (insertTxError) {
      throw new DeliveryUncertainError(
        'Refund succeeded but its local audit record failed'
      );
    }
    refundIds.push(paystackRefund.data.id);
  }
  return { refundIds };
}
