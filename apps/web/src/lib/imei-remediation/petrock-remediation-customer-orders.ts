import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

const CUSTOMER_ORDER_COLUMNS = [
  'id',
  'status',
  'carrier',
  'device_model',
  'status_segment',
  'payment_currency',
  'amount_ngn',
  'amount_usdt',
  'refund_policy',
  'success_rate',
  'turnaround',
  'customer_message',
  'paid_at',
  'submitted_at',
  'completed_at',
  'refunded_at',
  'created_at',
  'updated_at',
].join(', ');

function optionalNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapCustomerOrder(row: Record<string, unknown>) {
  return {
    amountNgn: optionalNumber(row.amount_ngn),
    amountUsdt: optionalNumber(row.amount_usdt),
    carrier: typeof row.carrier === 'string' ? row.carrier : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    createdAt: String(row.created_at),
    customerMessage:
      typeof row.customer_message === 'string' ? row.customer_message : null,
    deviceModel: typeof row.device_model === 'string' ? row.device_model : null,
    id: String(row.id),
    paidAt: typeof row.paid_at === 'string' ? row.paid_at : null,
    paymentCurrency:
      row.payment_currency === 'NGN' || row.payment_currency === 'USDT'
        ? row.payment_currency
        : null,
    refundPolicy:
      row.refund_policy === 'refundable' ||
      row.refund_policy === 'no_refund_denial'
        ? row.refund_policy
        : null,
    refundedAt: typeof row.refunded_at === 'string' ? row.refunded_at : null,
    status: String(row.status),
    statusSegment:
      typeof row.status_segment === 'string' ? row.status_segment : null,
    submittedAt: typeof row.submitted_at === 'string' ? row.submitted_at : null,
    successRate: optionalNumber(row.success_rate),
    turnaround: typeof row.turnaround === 'string' ? row.turnaround : null,
    updatedAt: String(row.updated_at),
  };
}

export async function readCustomerPetrockRemediationOrders({
  customerId,
  merchantId,
  orderId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  orderId?: string;
  supabase: SupabaseClient;
}) {
  let query = supabase
    .from('petrock_order_customer_status')
    .select(CUSTOMER_ORDER_COLUMNS)
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId);
  if (orderId) query = query.eq('id', orderId);

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapCustomerOrder(row as unknown as Record<string, unknown>)
  );
}
