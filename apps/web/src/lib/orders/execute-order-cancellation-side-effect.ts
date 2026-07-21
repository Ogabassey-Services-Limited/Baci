import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrderCancellationEmailMessage } from '@/lib/orders/build-order-cancellation-email-message';
import {
  DeliveryUncertainError,
  type OrderCancellationSideEffectStep,
} from '@/lib/orders/run-order-cancellation-side-effect';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';
import { sendEmail } from '@/lib/zeptomail';

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

export async function executeOrderCancellationSideEffect({
  merchant,
  order,
  reason,
  step,
  supabase,
}: {
  merchant: CancellationMerchant;
  order: CancellationOrder;
  reason?: string;
  step: OrderCancellationSideEffectStep;
  supabase: Pick<SupabaseClient, 'from'>;
}): Promise<{ messageId: string | null } | { refundId: number }> {
  const refundAmount = Number(order.amount_paid) || 0;
  if (step === 'customer_email') {
    const emailResult = await sendEmail(
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

  const { data: transaction } = await supabase
    .from('transactions')
    .select('gateway, gateway_reference')
    .eq('order_id', order.id)
    .eq('transaction_type', 'payment')
    .eq('status', 'completed')
    .single();
  if (!transaction?.gateway_reference) {
    throw new Error('No completed payment transaction found');
  }
  if (transaction.gateway !== 'paystack') {
    throw new Error(`Unsupported gateway: ${transaction.gateway}`);
  }

  const paystackRefund = await initiatePaystackRefund(
    transaction.gateway_reference,
    refundAmount * 100,
    reason || 'Order cancelled'
  );
  if (!paystackRefund.success) {
    const isAmbiguousFailure =
      paystackRefund.code === 'NETWORK_ERROR' ||
      paystackRefund.code?.startsWith('HTTP_5');
    const RefundError = isAmbiguousFailure ? DeliveryUncertainError : Error;
    throw new RefundError(paystackRefund.error);
  }

  const { error: insertTxError } = await supabase.from('transactions').insert({
    merchant_id: order.merchant_id,
    order_id: order.id,
    transaction_type: 'refund',
    amount: refundAmount,
    currency: order.currency || 'NGN',
    status: 'completed',
    gateway: transaction.gateway,
    gateway_reference: String(paystackRefund.data.id),
    description: `Refund for cancelled order #${order.order_number || order.id.slice(0, 8)}`,
  });
  if (insertTxError) {
    throw new DeliveryUncertainError(
      'Refund succeeded but its local audit record failed'
    );
  }
  return { refundId: paystackRefund.data.id };
}
